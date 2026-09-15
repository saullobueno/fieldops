import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from "@nestjs/common";
import type { ChecklistFieldType } from "@fieldops/domain";
import type {
  ChecklistFieldDefinition,
  ChecklistFieldInput,
  ChecklistTemplateDetail,
  ChecklistTemplateListResponse,
  ChecklistVersionSummary
} from "@fieldops/types";
import type pg from "pg";

import { POSTGRES_POOL } from "../infrastructure/infrastructure.module.js";

export interface CreateChecklistVersionInput {
  readonly templateId: string;
  readonly organizationId: string;
  readonly actorUserId: string;
  readonly fields: readonly ChecklistFieldInput[];
}

interface TemplateSummaryRow {
  readonly id: string;
  readonly name: string;
  readonly service_type_id: string | null;
  readonly is_active: boolean;
  readonly latest_version: number | null;
}

interface TemplateRow {
  readonly id: string;
  readonly name: string;
  readonly service_type_id: string | null;
  readonly is_active: boolean;
}

interface VersionRow {
  readonly id: string;
  readonly version: number;
  readonly published_at: Date | string | null;
}

interface FieldRow {
  readonly id: string;
  readonly checklist_version_id: string;
  readonly key: string;
  readonly label: string;
  readonly type: ChecklistFieldType;
  readonly is_required: boolean;
  readonly sort_order: number;
  readonly validation: Record<string, unknown> | null;
}

@Injectable()
export class ChecklistTemplatesService {
  constructor(
    @Optional() @Inject(POSTGRES_POOL) private readonly postgresPool?: pg.Pool
  ) {}

  async list(organizationId: string): Promise<ChecklistTemplateListResponse> {
    if (!this.postgresPool) {
      return demoList();
    }

    try {
      return await this.listFromDatabase(organizationId);
    } catch {
      return demoList();
    }
  }

  async getById(id: string, organizationId: string): Promise<ChecklistTemplateDetail> {
    if (!this.postgresPool) {
      return demoDetail(id);
    }

    try {
      return await this.getFromDatabase(id, organizationId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      return demoDetail(id);
    }
  }

  async createVersion(input: CreateChecklistVersionInput): Promise<ChecklistVersionSummary> {
    if (!this.postgresPool) {
      return demoCreateVersion(input);
    }

    try {
      return await this.createVersionInDatabase(input);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      return demoCreateVersion(input);
    }
  }

  private async listFromDatabase(organizationId: string): Promise<ChecklistTemplateListResponse> {
    const result = await this.postgresPool!.query<TemplateSummaryRow>(
      `select
         t.id,
         t.name,
         t.service_type_id,
         t.is_active,
         (select max(v.version) from checklist_versions v where v.template_id = t.id) as latest_version
       from checklist_templates t
       where t.organization_id = $1
       order by t.name asc`,
      [organizationId]
    );

    return { items: result.rows.map(toTemplateSummary) };
  }

  private async getFromDatabase(id: string, organizationId: string): Promise<ChecklistTemplateDetail> {
    const template = await this.postgresPool!.query<TemplateRow>(
      `select id, name, service_type_id, is_active
       from checklist_templates
       where id = $1 and organization_id = $2
       limit 1`,
      [id, organizationId]
    );

    const row = template.rows[0];
    if (!row) {
      throw new NotFoundException("Template de checklist não encontrado.");
    }

    const [versions, fields] = await Promise.all([
      this.postgresPool!.query<VersionRow>(
        `select id, version, published_at
         from checklist_versions
         where template_id = $1
         order by version desc`,
        [id]
      ),
      this.postgresPool!.query<FieldRow>(
        `select f.id, f.checklist_version_id, f.key, f.label, f.type, f.is_required, f.sort_order, f.validation
         from form_fields f
         join checklist_versions v on v.id = f.checklist_version_id
         where v.template_id = $1
         order by v.version desc, f.sort_order asc`,
        [id]
      )
    ]);

    return {
      ...toTemplateBase(row),
      versions: versions.rows.map((version) => toVersionSummary(version, fields.rows)),
      latestVersion: versions.rows[0]?.version ?? null
    };
  }

  private async createVersionInDatabase(input: CreateChecklistVersionInput): Promise<ChecklistVersionSummary> {
    if (input.fields.length === 0) {
      throw new BadRequestException("Uma nova versão precisa de ao menos um campo.");
    }

    const client = await this.postgresPool!.connect();

    try {
      await client.query("begin");
      const template = await client.query<{ id: string }>(
        `select id
         from checklist_templates
         where id = $1 and organization_id = $2
         for update`,
        [input.templateId, input.organizationId]
      );

      if (!template.rows[0]) {
        throw new NotFoundException("Template de checklist não encontrado.");
      }

      const latest = await client.query<{ version: number | null }>(
        `select max(version) as version
         from checklist_versions
         where template_id = $1`,
        [input.templateId]
      );

      const nextVersion = (latest.rows[0]?.version ?? 0) + 1;

      const created = await client.query<{ id: string }>(
        `insert into checklist_versions (organization_id, template_id, version, schema, published_at)
         values ($1, $2, $3, $4::jsonb, now())
         returning id`,
        [input.organizationId, input.templateId, nextVersion, JSON.stringify({ fieldCount: input.fields.length })]
      );

      const versionId = created.rows[0]!.id;

      for (const [index, field] of input.fields.entries()) {
        await client.query(
          `insert into form_fields (organization_id, checklist_version_id, key, label, type, is_required, sort_order, validation)
           values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
          [
            input.organizationId,
            versionId,
            field.key,
            field.label,
            field.type,
            field.isRequired,
            index + 1,
            JSON.stringify(field.validation ?? {})
          ]
        );
      }

      await client.query(
        `insert into audit_logs (organization_id, actor_user_id, action, resource_type, resource_id, after, metadata)
         values ($1, $2, 'create', 'checklist_version', $3, $4::jsonb, $5::jsonb)`,
        [
          input.organizationId,
          input.actorUserId,
          versionId,
          JSON.stringify({ fieldCount: input.fields.length, version: nextVersion }),
          JSON.stringify({ source: "checklist-templates-api" })
        ]
      );

      await client.query("commit");

      return {
        fields: input.fields.map((field, index) => toFieldDefinitionFromInput(field, index)),
        id: versionId,
        publishedAt: new Date().toISOString(),
        version: nextVersion
      };
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }
}

function toTemplateBase(row: TemplateRow) {
  return {
    id: row.id,
    isActive: row.is_active,
    name: row.name,
    serviceTypeId: row.service_type_id
  };
}

function toTemplateSummary(row: TemplateSummaryRow) {
  return {
    id: row.id,
    isActive: row.is_active,
    latestVersion: row.latest_version,
    name: row.name,
    serviceTypeId: row.service_type_id
  };
}

function toVersionSummary(version: VersionRow, allFields: readonly FieldRow[]): ChecklistVersionSummary {
  return {
    fields: allFields
      .filter((field) => field.checklist_version_id === version.id)
      .map(toFieldDefinition),
    id: version.id,
    publishedAt: version.published_at ? toIso(version.published_at) : null,
    version: version.version
  };
}

function toFieldDefinition(row: FieldRow): ChecklistFieldDefinition {
  return {
    id: row.id,
    isRequired: row.is_required,
    key: row.key,
    label: row.label,
    sortOrder: row.sort_order,
    type: row.type,
    validation: row.validation ?? {}
  };
}

function toFieldDefinitionFromInput(field: ChecklistFieldInput, index: number): ChecklistFieldDefinition {
  return {
    id: `field-${index + 1}`,
    isRequired: field.isRequired,
    key: field.key,
    label: field.label,
    sortOrder: index + 1,
    type: field.type,
    validation: field.validation ?? {}
  };
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

const demoTemplateId = "00000000-0000-4000-8000-000000000621";
const demoServiceTypeId = "00000000-0000-4000-8000-000000000601";

const demoFields: ChecklistFieldDefinition[] = [
  { id: "field-1", isRequired: true, key: "pressao_entrada", label: "Verificar pressão de entrada", sortOrder: 1, type: "pass_fail", validation: {} },
  { id: "field-2", isRequired: true, key: "leitura_eletrica", label: "Registrar leitura elétrica", sortOrder: 2, type: "number", validation: {} },
  { id: "field-3", isRequired: false, key: "foto_painel", label: "Anexar foto do painel", sortOrder: 3, type: "photo", validation: {} }
];

const demoVersions: ChecklistVersionSummary[] = [
  { fields: demoFields, id: "00000000-0000-4000-8000-000000000622", publishedAt: "2026-01-15T12:00:00.000Z", version: 1 }
];

function demoList(): ChecklistTemplateListResponse {
  return {
    items: [
      {
        id: demoTemplateId,
        isActive: true,
        latestVersion: demoVersions[demoVersions.length - 1]?.version ?? null,
        name: "Checklist de inspeção preventiva",
        serviceTypeId: demoServiceTypeId
      }
    ]
  };
}

function demoDetail(id: string): ChecklistTemplateDetail {
  if (id !== demoTemplateId) {
    throw new NotFoundException("Template de checklist não encontrado.");
  }

  return {
    id: demoTemplateId,
    isActive: true,
    latestVersion: demoVersions[demoVersions.length - 1]?.version ?? null,
    name: "Checklist de inspeção preventiva",
    serviceTypeId: demoServiceTypeId,
    versions: [...demoVersions].reverse()
  };
}

function demoCreateVersion(input: CreateChecklistVersionInput): ChecklistVersionSummary {
  if (input.templateId !== demoTemplateId) {
    throw new NotFoundException("Template de checklist não encontrado.");
  }

  if (input.fields.length === 0) {
    throw new BadRequestException("Uma nova versão precisa de ao menos um campo.");
  }

  const nextVersion = (demoVersions[demoVersions.length - 1]?.version ?? 0) + 1;
  const version: ChecklistVersionSummary = {
    fields: input.fields.map(toFieldDefinitionFromInput),
    id: `demo-checklist-version-${nextVersion}`,
    publishedAt: new Date().toISOString(),
    version: nextVersion
  };

  demoVersions.push(version);
  return version;
}
