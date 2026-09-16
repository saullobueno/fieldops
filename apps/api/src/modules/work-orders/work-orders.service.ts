import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from "@nestjs/common";
import {
  assertWorkOrderTransition,
  validateChecklistAnswers,
  type ChecklistFieldType,
  type ChecklistValidationError,
  type WorkOrderStatus
} from "@fieldops/domain";
import type { WorkOrderAuditItem, WorkOrderDetail, WorkOrderListResponse, WorkOrderSignature, WorkOrderSummary } from "@fieldops/types";
import type pg from "pg";

import { signAttachment } from "../attachments/attachments.service.js";
import { POSTGRES_POOL } from "../infrastructure/infrastructure.module.js";
import { RealtimeService } from "../realtime/realtime.service.js";

export interface WorkOrderListFilter {
  readonly organizationId: string;
  readonly status?: string;
  readonly search?: string;
  readonly limit: number;
  readonly offset: number;
}

export interface WorkOrderChecklistUpdate {
  readonly answers: Record<string, unknown>;
  readonly actorUserId: string;
  readonly id: string;
  readonly organizationId: string;
}

export interface WorkOrderNoteInput {
  readonly actorName: string;
  readonly actorUserId: string;
  readonly body: string;
  readonly id: string;
  readonly organizationId: string;
}

export interface WorkOrderNoteUpdateInput {
  readonly id: string;
  readonly noteId: string;
  readonly organizationId: string;
  readonly actorUserId: string;
  readonly body: string;
}

export interface WorkOrderNoteDeleteInput {
  readonly id: string;
  readonly noteId: string;
  readonly organizationId: string;
  readonly actorUserId: string;
}

export interface WorkOrderAuditFilter {
  readonly action?: string;
  readonly actorUserId?: string;
  readonly from?: string;
  readonly limit: number;
  readonly to?: string;
}

export interface WorkOrderSignatureInput {
  readonly id: string;
  readonly organizationId: string;
  readonly actorUserId: string;
  readonly signerName: string;
  readonly attachmentId: string;
}

export interface WorkOrderAttachmentInput {
  readonly id: string;
  readonly organizationId: string;
  readonly actorUserId: string;
  readonly actorName: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly kind: "photo" | "document" | "signature";
  readonly storageKey: string;
  readonly byteSize: number;
}

interface WorkOrderRow {
  readonly id: string;
  readonly organization_id: string;
  readonly number: string;
  readonly customer: string;
  readonly site: string;
  readonly title: string;
  readonly description: string | null;
  readonly priority: string;
  readonly status: string;
  readonly technician: string | null;
  readonly scheduled_start_at: Date | string | null;
  readonly sla_due_at: Date | string | null;
  readonly team_id: string | null;
  readonly territory_id: string | null;
  readonly assigned_technician_user_id: string | null;
  readonly checklist_version_id: string | null;
}

interface EventRow {
  readonly id: string;
  readonly type: string;
  readonly payload: Record<string, unknown>;
  readonly occurred_at: Date | string;
  readonly actor: string | null;
}

interface AttachmentRow {
  readonly id: string;
  readonly kind: string;
  readonly file_name: string;
  readonly storage_key: string;
  readonly created_at: Date | string;
}

interface ChecklistRow {
  readonly id: string;
  readonly key: string;
  readonly label: string;
  readonly type: ChecklistFieldType;
  readonly is_required: boolean;
  readonly validation: Record<string, unknown> | null;
  readonly answers: Record<string, unknown> | null;
}

interface SignatureRow {
  readonly id: string;
  readonly signer_name: string;
  readonly signed_at: Date | string;
  readonly attachment_id: string;
}

interface AuditRow {
  readonly id: string;
  readonly action: string;
  readonly actor: string | null;
  readonly resource_type: string;
  readonly resource_id: string;
  readonly before: Record<string, unknown> | null;
  readonly after: Record<string, unknown> | null;
  readonly occurred_at: Date | string;
}

@Injectable()
export class WorkOrdersService {
  constructor(
    @Inject(RealtimeService) private readonly realtimeService: RealtimeService,
    @Optional() @Inject(POSTGRES_POOL) private readonly postgresPool?: pg.Pool
  ) {}

  async list(filter: WorkOrderListFilter): Promise<WorkOrderListResponse> {
    if (!this.postgresPool) {
      return listFromMemory(filter);
    }

    try {
      return await this.listFromDatabase(filter);
    } catch {
      return listFromMemory(filter);
    }
  }

  async getById(id: string, organizationId: string): Promise<WorkOrderDetail> {
    if (!this.postgresPool) {
      return getFromMemory(id, organizationId);
    }

    try {
      return await this.getFromDatabase(id, organizationId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      return getFromMemory(id, organizationId);
    }
  }

  async updateStatus(input: {
    readonly id: string;
    readonly organizationId: string;
    readonly status: WorkOrderStatus;
    readonly actorName: string;
    readonly actorUserId?: string;
  }): Promise<WorkOrderDetail> {
    const before = await this.getById(input.id, input.organizationId).catch(() => undefined);

    let result: WorkOrderDetail;
    if (!this.postgresPool) {
      result = updateMemoryStatus(input);
    } else {
      try {
        await this.updateDatabaseStatus(input);
        result = await this.getFromDatabase(input.id, input.organizationId);
      } catch (error) {
        if (error instanceof NotFoundException) {
          throw error;
        }

        result = updateMemoryStatus(input);
      }
    }

    this.realtimeService.publish(input.organizationId, {
      data: {
        fromStatus: before?.status ?? "desconhecido",
        toStatus: result.status,
        workOrderId: result.id,
        workOrderNumber: result.number
      },
      type: "work_order_status_changed"
    });

    return result;
  }

  async updateChecklist(input: WorkOrderChecklistUpdate): Promise<WorkOrderDetail> {
    if (!this.postgresPool) {
      return updateMemoryChecklist(input);
    }

    try {
      await this.updateDatabaseChecklist(input);
      return await this.getFromDatabase(input.id, input.organizationId);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      return updateMemoryChecklist(input);
    }
  }

  async addNote(input: WorkOrderNoteInput): Promise<WorkOrderDetail> {
    if (!this.postgresPool) {
      return addMemoryNote(input);
    }

    try {
      await this.addDatabaseNote(input);
      return await this.getFromDatabase(input.id, input.organizationId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      return addMemoryNote(input);
    }
  }

  async updateNote(input: WorkOrderNoteUpdateInput): Promise<WorkOrderDetail> {
    if (!this.postgresPool) {
      return updateMemoryNote(input);
    }

    try {
      await this.updateDatabaseNote(input);
      return await this.getFromDatabase(input.id, input.organizationId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      return updateMemoryNote(input);
    }
  }

  async deleteNote(input: WorkOrderNoteDeleteInput): Promise<WorkOrderDetail> {
    if (!this.postgresPool) {
      return deleteMemoryNote(input);
    }

    try {
      await this.deleteDatabaseNote(input);
      return await this.getFromDatabase(input.id, input.organizationId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      return deleteMemoryNote(input);
    }
  }

  async addSignature(input: WorkOrderSignatureInput): Promise<WorkOrderDetail> {
    if (!this.postgresPool) {
      return addMemorySignature(input);
    }

    try {
      await this.addDatabaseSignature(input);
      return await this.getFromDatabase(input.id, input.organizationId);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      return addMemorySignature(input);
    }
  }

  async addAttachment(input: WorkOrderAttachmentInput): Promise<WorkOrderDetail> {
    if (!this.postgresPool) {
      return addMemoryAttachment(input);
    }

    try {
      await this.addDatabaseAttachment(input);
      return await this.getFromDatabase(input.id, input.organizationId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      return addMemoryAttachment(input);
    }
  }

  async listForTechnician(actorUserId: string, organizationId: string): Promise<readonly WorkOrderSummary[]> {
    if (!this.postgresPool) {
      return listForTechnicianFromMemory(actorUserId, organizationId);
    }

    try {
      return await this.listForTechnicianFromDatabase(actorUserId, organizationId);
    } catch {
      return listForTechnicianFromMemory(actorUserId, organizationId);
    }
  }

  async getAuditTrail(id: string, organizationId: string, filter: WorkOrderAuditFilter = { limit: 20 }): Promise<readonly WorkOrderAuditItem[]> {
    if (!this.postgresPool) {
      return getMemoryAuditTrail(id, organizationId, filter);
    }

    try {
      return await this.getDatabaseAuditTrail(id, organizationId, filter);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      return getMemoryAuditTrail(id, organizationId, filter);
    }
  }

  private async listFromDatabase(filter: WorkOrderListFilter): Promise<WorkOrderListResponse> {
    const values: unknown[] = [filter.organizationId];
    const where = ["wo.organization_id = $1"];

    if (filter.status) {
      values.push(filter.status);
      where.push(`wo.status = $${values.length}`);
    }

    if (filter.search?.trim()) {
      values.push(`%${filter.search.trim()}%`);
      where.push(`(wo.number ilike $${values.length} or wo.title ilike $${values.length} or c.name ilike $${values.length})`);
    }

    const whereSql = where.join(" and ");
    const count = await this.postgresPool!.query<{ total: string }>(
      `select count(*)::text as total
       from work_orders wo
       join customers c on c.id = wo.customer_id
       where ${whereSql}`,
      values
    );

    const data = await this.postgresPool!.query<WorkOrderRow>(
      `${workOrderReadSql}
       where ${whereSql}
       order by wo.scheduled_start_at asc nulls last, wo.created_at desc
       limit $${values.length + 1} offset $${values.length + 2}`,
      [...values, filter.limit, filter.offset]
    );

    return {
      items: data.rows.map(toSummary),
      limit: filter.limit,
      offset: filter.offset,
      total: Number(count.rows[0]?.total ?? 0)
    };
  }

  private async getFromDatabase(id: string, organizationId: string): Promise<WorkOrderDetail> {
    const detail = await this.postgresPool!.query<WorkOrderRow>(
      `${workOrderReadSql}
       where wo.id = $1 and wo.organization_id = $2
       limit 1`,
      [id, organizationId]
    );

    const row = detail.rows[0];
    if (!row) {
      throw new NotFoundException("Ordem de serviço não encontrada.");
    }

    const [events, attachments, checklist, signatures] = await Promise.all([
      this.postgresPool!.query<EventRow>(
        `select e.id, e.type, e.payload, e.occurred_at, u.name as actor
         from work_order_events e
         left join users u on u.id = e.actor_user_id
         where e.work_order_id = $1 and e.organization_id = $2
         order by e.occurred_at desc`,
        [id, organizationId]
      ),
      this.postgresPool!.query<AttachmentRow>(
        `select id, kind, file_name, storage_key, created_at
         from attachments
         where work_order_id = $1 and organization_id = $2
         order by created_at desc`,
        [id, organizationId]
      ),
      this.postgresPool!.query<ChecklistRow>(
        `select f.id, f.key, f.label, f.type, f.is_required, f.validation, cr.answers
         from work_orders wo
         join form_fields f on f.checklist_version_id = wo.checklist_version_id
         left join checklist_responses cr on cr.work_order_id = wo.id and cr.checklist_version_id = wo.checklist_version_id
         where wo.id = $1 and wo.organization_id = $2
         order by f.sort_order asc`,
        [id, organizationId]
      ),
      this.postgresPool!.query<SignatureRow>(
        `select id, signer_name, signed_at, attachment_id
         from signatures
         where work_order_id = $1 and organization_id = $2
         order by signed_at desc`,
        [id, organizationId]
      )
    ]);

    return {
      ...toSummary(row),
      attachments: attachments.rows.map(toSignedAttachment),
      checklist: checklist.rows.map(toChecklistItem),
      description: row.description ?? "Sem descrição registrada.",
      notes: events.rows.filter(isNoteEvent).map(toNoteItem),
      signatures: signatures.rows.map(toSignatureItem),
      timeline: events.rows.map(toTimelineItem)
    };
  }

  private async updateDatabaseStatus(input: {
    readonly id: string;
    readonly organizationId: string;
    readonly status: WorkOrderStatus;
    readonly actorName: string;
    readonly actorUserId?: string;
  }): Promise<void> {
    const client = await this.postgresPool!.connect();

    try {
      await client.query("begin");
      const current = await client.query<{ status: WorkOrderStatus }>(
        `select status
         from work_orders
         where id = $1 and organization_id = $2
         for update`,
        [input.id, input.organizationId]
      );

      const currentStatus = current.rows[0]?.status;
      if (!currentStatus) {
        throw new NotFoundException("Ordem de serviço não encontrada.");
      }

      assertWorkOrderTransition(currentStatus, input.status);

      await client.query(
        `update work_orders
         set status = $3,
             completed_at = case when $3 = 'completed' then now() else completed_at end,
             updated_at = now()
         where id = $1 and organization_id = $2`,
        [input.id, input.organizationId, input.status]
      );

      await client.query(
        `insert into work_order_events (organization_id, work_order_id, type, payload)
         values ($1, $2, 'status_change', $3::jsonb)`,
        [
          input.organizationId,
          input.id,
          JSON.stringify({ actor: input.actorName, from: currentStatus, to: input.status })
        ]
      );

      await client.query(
        `insert into audit_logs (organization_id, actor_user_id, action, resource_type, resource_id, before, after, metadata)
         values ($1, $2, 'status_change', 'work_order', $3, $4::jsonb, $5::jsonb, $6::jsonb)`,
        [
          input.organizationId,
          input.actorUserId ?? null,
          input.id,
          JSON.stringify({ status: currentStatus }),
          JSON.stringify({ status: input.status }),
          JSON.stringify({ actor: input.actorName, source: "work-orders-api" })
        ]
      );

      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  private async updateDatabaseChecklist(input: WorkOrderChecklistUpdate): Promise<void> {
    const client = await this.postgresPool!.connect();

    try {
      await client.query("begin");
      const current = await client.query<{ checklist_version_id: string | null }>(
        `select checklist_version_id
         from work_orders
         where id = $1 and organization_id = $2
         for update`,
        [input.id, input.organizationId]
      );

      const checklistVersionId = current.rows[0]?.checklist_version_id;
      if (!current.rows[0]) {
        throw new NotFoundException("Ordem de serviço não encontrada.");
      }

      if (!checklistVersionId) {
        throw new NotFoundException("Checklist não configurado para esta ordem.");
      }

      const fields = await client.query<{
        key: string;
        is_required: boolean;
        type: ChecklistFieldType;
        validation: Record<string, unknown> | null;
      }>(
        `select key, is_required, type, validation
         from form_fields
         where checklist_version_id = $1`,
        [checklistVersionId]
      );

      const checklistErrors = validateChecklistAnswers(
        fields.rows.map((field) => ({
          isRequired: field.is_required,
          key: field.key,
          type: field.type,
          validation: field.validation ?? undefined
        })),
        input.answers
      );

      throwOnChecklistErrors(checklistErrors);

      const technician = await client.query<{ id: string }>(
        `select id
         from technician_profiles
         where organization_id = $1 and user_id = $2
         limit 1`,
        [input.organizationId, input.actorUserId]
      );

      await client.query(
        `insert into checklist_responses (organization_id, work_order_id, checklist_version_id, technician_id, answers)
         values ($1, $2, $3, $4, $5::jsonb)
         on conflict (work_order_id, checklist_version_id)
         do update set answers = excluded.answers, technician_id = excluded.technician_id, updated_at = now()`,
        [
          input.organizationId,
          input.id,
          checklistVersionId,
          technician.rows[0]?.id ?? null,
          JSON.stringify(input.answers)
        ]
      );

      await client.query(
        `insert into work_order_events (organization_id, work_order_id, actor_user_id, type, payload)
         values ($1, $2, $3, 'checklist_updated', $4::jsonb)`,
        [
          input.organizationId,
          input.id,
          input.actorUserId,
          JSON.stringify({ changedKeys: Object.keys(input.answers).sort() })
        ]
      );

      await client.query(
        `insert into audit_logs (organization_id, actor_user_id, action, resource_type, resource_id, after, metadata)
         values ($1, $2, 'update', 'work_order', $3, $4::jsonb, $5::jsonb)`,
        [
          input.organizationId,
          input.actorUserId,
          input.id,
          JSON.stringify({ checklistAnswers: input.answers }),
          JSON.stringify({ source: "work-orders-api" })
        ]
      );

      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  private async addDatabaseNote(input: WorkOrderNoteInput): Promise<void> {
    const client = await this.postgresPool!.connect();

    try {
      await client.query("begin");
      const current = await client.query<{ id: string }>(
        `select id
         from work_orders
         where id = $1 and organization_id = $2
         for update`,
        [input.id, input.organizationId]
      );

      if (!current.rows[0]) {
        throw new NotFoundException("Ordem de serviço não encontrada.");
      }

      await client.query(
        `insert into work_order_events (organization_id, work_order_id, actor_user_id, type, payload)
         values ($1, $2, $3, 'note_added', $4::jsonb)`,
        [
          input.organizationId,
          input.id,
          input.actorUserId,
          JSON.stringify({ body: input.body })
        ]
      );

      await client.query(
        `insert into audit_logs (organization_id, actor_user_id, action, resource_type, resource_id, after, metadata)
         values ($1, $2, 'update', 'work_order', $3, $4::jsonb, $5::jsonb)`,
        [
          input.organizationId,
          input.actorUserId,
          input.id,
          JSON.stringify({ noteAdded: true }),
          JSON.stringify({ source: "work-orders-api" })
        ]
      );

      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  private async updateDatabaseNote(input: WorkOrderNoteUpdateInput): Promise<void> {
    const result = await this.postgresPool!.query(
      `update work_order_events
       set payload = $1::jsonb
       where id = $2 and work_order_id = $3 and organization_id = $4 and type = 'note_added'`,
      [JSON.stringify({ body: input.body }), input.noteId, input.id, input.organizationId]
    );

    if (result.rowCount === 0) {
      throw new NotFoundException("Nota não encontrada.");
    }
  }

  private async deleteDatabaseNote(input: WorkOrderNoteDeleteInput): Promise<void> {
    const result = await this.postgresPool!.query(
      `delete from work_order_events
       where id = $1 and work_order_id = $2 and organization_id = $3 and type = 'note_added'`,
      [input.noteId, input.id, input.organizationId]
    );

    if (result.rowCount === 0) {
      throw new NotFoundException("Nota não encontrada.");
    }
  }

  private async addDatabaseSignature(input: WorkOrderSignatureInput): Promise<void> {
    const client = await this.postgresPool!.connect();

    try {
      await client.query("begin");
      const workOrder = await client.query<{ id: string }>(
        `select id
         from work_orders
         where id = $1 and organization_id = $2
         for update`,
        [input.id, input.organizationId]
      );

      if (!workOrder.rows[0]) {
        throw new NotFoundException("Ordem de serviço não encontrada.");
      }

      const attachment = await client.query<{ id: string }>(
        `select id
         from attachments
         where id = $1 and organization_id = $2 and work_order_id = $3
         limit 1`,
        [input.attachmentId, input.organizationId, input.id]
      );

      if (!attachment.rows[0]) {
        throw new BadRequestException("Anexo informado não pertence a esta ordem de serviço.");
      }

      await client.query(
        `insert into signatures (organization_id, work_order_id, attachment_id, signer_name)
         values ($1, $2, $3, $4)`,
        [input.organizationId, input.id, input.attachmentId, input.signerName]
      );

      await client.query(
        `insert into work_order_events (organization_id, work_order_id, actor_user_id, type, payload)
         values ($1, $2, $3, 'signature_captured', $4::jsonb)`,
        [
          input.organizationId,
          input.id,
          input.actorUserId,
          JSON.stringify({ signerName: input.signerName })
        ]
      );

      await client.query(
        `insert into audit_logs (organization_id, actor_user_id, action, resource_type, resource_id, after, metadata)
         values ($1, $2, 'create', 'work_order', $3, $4::jsonb, $5::jsonb)`,
        [
          input.organizationId,
          input.actorUserId,
          input.id,
          JSON.stringify({ signerName: input.signerName }),
          JSON.stringify({ source: "work-orders-api" })
        ]
      );

      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  private async addDatabaseAttachment(input: WorkOrderAttachmentInput): Promise<void> {
    const client = await this.postgresPool!.connect();

    try {
      await client.query("begin");
      const workOrder = await client.query<{ id: string }>(
        `select id
         from work_orders
         where id = $1 and organization_id = $2
         for update`,
        [input.id, input.organizationId]
      );

      if (!workOrder.rows[0]) {
        throw new NotFoundException("Ordem de serviço não encontrada.");
      }

      await client.query(
        `insert into attachments (organization_id, work_order_id, uploaded_by_user_id, kind, file_name, mime_type, storage_key, byte_size)
         values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          input.organizationId,
          input.id,
          input.actorUserId,
          input.kind,
          input.fileName,
          input.mimeType,
          input.storageKey,
          input.byteSize
        ]
      );

      await client.query(
        `insert into work_order_events (organization_id, work_order_id, actor_user_id, type, payload)
         values ($1, $2, $3, 'attachment_added', $4::jsonb)`,
        [
          input.organizationId,
          input.id,
          input.actorUserId,
          JSON.stringify({ actor: input.actorName, fileName: input.fileName, kind: input.kind })
        ]
      );

      await client.query(
        `insert into audit_logs (organization_id, actor_user_id, action, resource_type, resource_id, after, metadata)
         values ($1, $2, 'create', 'attachment', $3, $4::jsonb, $5::jsonb)`,
        [
          input.organizationId,
          input.actorUserId,
          input.id,
          JSON.stringify({ fileName: input.fileName, kind: input.kind }),
          JSON.stringify({ actor: input.actorName, source: "work-orders-api" })
        ]
      );

      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  private async listForTechnicianFromDatabase(actorUserId: string, organizationId: string): Promise<readonly WorkOrderSummary[]> {
    const result = await this.postgresPool!.query<WorkOrderRow>(
      `${workOrderReadSql}
       where wo.organization_id = $1 and tp.user_id = $2
       order by wo.scheduled_start_at asc nulls last`,
      [organizationId, actorUserId]
    );

    return result.rows.map(toSummary);
  }

  private async getDatabaseAuditTrail(id: string, organizationId: string, filter: WorkOrderAuditFilter): Promise<readonly WorkOrderAuditItem[]> {
    const exists = await this.postgresPool!.query<{ id: string }>(
      `select id
       from work_orders
       where id = $1 and organization_id = $2
       limit 1`,
      [id, organizationId]
    );

    if (!exists.rows[0]) {
      throw new NotFoundException("Ordem de serviço não encontrada.");
    }

    const values: unknown[] = [organizationId, id];
    const where = ["a.organization_id = $1", "a.resource_type = 'work_order'", "a.resource_id = $2"];

    if (filter.action) {
      values.push(filter.action);
      where.push(`a.action = $${values.length}`);
    }

    if (filter.actorUserId) {
      values.push(filter.actorUserId);
      where.push(`a.actor_user_id = $${values.length}`);
    }

    if (filter.from) {
      values.push(filter.from);
      where.push(`a.occurred_at >= $${values.length}::timestamptz`);
    }

    if (filter.to) {
      values.push(filter.to);
      where.push(`a.occurred_at <= $${values.length}::timestamptz`);
    }

    values.push(filter.limit);
    const result = await this.postgresPool!.query<AuditRow>(
      `select a.id, a.action, u.name as actor, a.resource_type, a.resource_id, a.before, a.after, a.occurred_at
       from audit_logs a
       left join users u on u.id = a.actor_user_id
       where ${where.join(" and ")}
       order by a.occurred_at desc
       limit $${values.length}`,
      values
    );

    return result.rows.map(toAuditItem);
  }
}

const workOrderReadSql = `
  select
    wo.id,
    wo.organization_id,
    wo.number,
    c.name as customer,
    s.name as site,
    wo.title,
    wo.description,
    wo.priority,
    wo.status,
    u.name as technician,
    wo.scheduled_start_at,
    wo.sla_due_at,
    tp.team_id,
    coalesce(tp.territory_id, s.territory_id) as territory_id,
    tp.user_id as assigned_technician_user_id,
    wo.checklist_version_id
  from work_orders wo
  join customers c on c.id = wo.customer_id
  join sites s on s.id = wo.site_id
  left join lateral (
    select technician_id
    from work_order_assignments
    where work_order_id = wo.id and status in ('assigned', 'accepted')
    order by starts_at desc
    limit 1
  ) active_assignment on true
  left join technician_profiles tp on tp.id = active_assignment.technician_id
  left join users u on u.id = tp.user_id`;

function listFromMemory(filter: WorkOrderListFilter): WorkOrderListResponse {
  const normalizedSearch = filter.search?.trim().toLowerCase();
  const filtered = workOrders.filter((item) => {
    const sameOrganization = item.organizationId === filter.organizationId;
    const sameStatus = !filter.status || item.status === filter.status;
    const matchesSearch =
      !normalizedSearch ||
      item.number.toLowerCase().includes(normalizedSearch) ||
      item.customer.toLowerCase().includes(normalizedSearch) ||
      item.title.toLowerCase().includes(normalizedSearch);

    return sameOrganization && sameStatus && matchesSearch;
  });

  return {
    items: filtered.slice(filter.offset, filter.offset + filter.limit),
    limit: filter.limit,
    offset: filter.offset,
    total: filtered.length
  };
}

function getFromMemory(id: string, organizationId: string): WorkOrderDetail {
  const item = workOrders.find(
    (candidate) => candidate.id === id && candidate.organizationId === organizationId
  );

  if (!item) {
    throw new NotFoundException("Ordem de serviço não encontrada.");
  }

  return item;
}

function listForTechnicianFromMemory(actorUserId: string, organizationId: string): readonly WorkOrderSummary[] {
  return workOrders.filter(
    (item) => item.organizationId === organizationId && item.assignedTechnicianUserId === actorUserId
  );
}

function getMemoryAuditTrail(id: string, organizationId: string, filter: WorkOrderAuditFilter): readonly WorkOrderAuditItem[] {
  const current = getFromMemory(id, organizationId);

  return current.timeline.map((item) => ({
    action: item.title,
    actor: null,
    after: { description: item.description },
    before: null,
    id: `audit-${item.id}`,
    occurredAt: item.occurredAt,
    resourceId: current.id,
    resourceType: "work_order"
  }))
    .filter((item) => !filter.action || item.action === filter.action)
    .filter((item) => !filter.from || item.occurredAt >= filter.from)
    .filter((item) => !filter.to || item.occurredAt <= filter.to)
    .slice(0, filter.limit);
}

function updateMemoryStatus(input: {
  readonly id: string;
  readonly organizationId: string;
  readonly status: WorkOrderStatus;
  readonly actorName: string;
  readonly actorUserId?: string;
}): WorkOrderDetail {
  const index = workOrders.findIndex(
    (candidate) => candidate.id === input.id && candidate.organizationId === input.organizationId
  );

  if (index < 0) {
    throw new NotFoundException("Ordem de serviço não encontrada.");
  }

  const current = workOrders[index];
  if (!current) {
    throw new NotFoundException("Ordem de serviço não encontrada.");
  }

  assertWorkOrderTransition(current.status as WorkOrderStatus, input.status);

  const updated: WorkOrderDetail = {
    ...current,
    status: input.status,
    timeline: [
      {
        description: `${input.actorName} alterou o status para ${input.status}.`,
        id: `evt-${current.timeline.length + 1}`,
        occurredAt: new Date().toISOString(),
        title: "Status atualizado"
      },
      ...current.timeline
    ]
  };

  workOrders[index] = updated;
  return updated;
}

function updateMemoryChecklist(input: WorkOrderChecklistUpdate): WorkOrderDetail {
  const current = getFromMemory(input.id, input.organizationId);
  const checklistErrors = validateChecklistAnswers(
    current.checklist.map((item) => ({
      isRequired: item.isRequired,
      key: item.answerKey ?? item.id,
      type: item.type,
      validation: item.validation
    })),
    input.answers
  );

  throwOnChecklistErrors(checklistErrors);

  const checklist = current.checklist.map((item) => {
    const key = item.answerKey ?? item.id;
    const hasAnswer = Object.prototype.hasOwnProperty.call(input.answers, key);
    const value = (hasAnswer ? input.answers[key] : item.value) as string | number | boolean | null;

    return {
      ...item,
      completed: !isEmptyChecklistValue(value),
      value
    };
  });
  const updated = {
    ...current,
    checklist,
    timeline: [
      {
        description: `${input.actorUserId} atualizou ${Object.keys(input.answers).length} respostas do checklist.`,
        id: `evt-${current.timeline.length + 1}`,
        occurredAt: new Date().toISOString(),
        title: "Checklist atualizado"
      },
      ...current.timeline
    ]
  };

  replaceMemoryOrder(updated);
  return updated;
}

function addMemoryNote(input: WorkOrderNoteInput): WorkOrderDetail {
  const current = getFromMemory(input.id, input.organizationId);
  const now = new Date().toISOString();
  const updated = {
    ...current,
    notes: [
      {
        author: input.actorName,
        body: input.body,
        createdAt: now,
        id: `note-${current.notes.length + 1}`
      },
      ...current.notes
    ],
    timeline: [
      {
        description: `${input.actorName} adicionou uma nota operacional.`,
        id: `evt-${current.timeline.length + 1}`,
        occurredAt: now,
        title: "Nota adicionada"
      },
      ...current.timeline
    ]
  };

  replaceMemoryOrder(updated);
  return updated;
}

function updateMemoryNote(input: WorkOrderNoteUpdateInput): WorkOrderDetail {
  const current = getFromMemory(input.id, input.organizationId);
  if (!current.notes.some((note) => note.id === input.noteId)) {
    throw new NotFoundException("Nota não encontrada.");
  }

  const updated = {
    ...current,
    notes: current.notes.map((note) => (note.id === input.noteId ? { ...note, body: input.body } : note))
  };

  replaceMemoryOrder(updated);
  return updated;
}

function deleteMemoryNote(input: WorkOrderNoteDeleteInput): WorkOrderDetail {
  const current = getFromMemory(input.id, input.organizationId);
  if (!current.notes.some((note) => note.id === input.noteId)) {
    throw new NotFoundException("Nota não encontrada.");
  }

  const updated = {
    ...current,
    notes: current.notes.filter((note) => note.id !== input.noteId)
  };

  replaceMemoryOrder(updated);
  return updated;
}

function addMemorySignature(input: WorkOrderSignatureInput): WorkOrderDetail {
  const current = getFromMemory(input.id, input.organizationId);
  const attachmentExists = current.attachments.some((attachment) => attachment.id === input.attachmentId);

  if (!attachmentExists) {
    throw new BadRequestException("Anexo informado não pertence a esta ordem de serviço.");
  }

  const now = new Date().toISOString();
  const updated = {
    ...current,
    signatures: [
      {
        attachmentId: input.attachmentId,
        id: `sig-${current.signatures.length + 1}`,
        signedAt: now,
        signerName: input.signerName
      },
      ...current.signatures
    ],
    timeline: [
      {
        description: `${input.actorUserId} coletou a assinatura de ${input.signerName}.`,
        id: `evt-${current.timeline.length + 1}`,
        occurredAt: now,
        title: "Assinatura coletada"
      },
      ...current.timeline
    ]
  };

  replaceMemoryOrder(updated);
  return updated;
}

function addMemoryAttachment(input: WorkOrderAttachmentInput): WorkOrderDetail {
  const current = getFromMemory(input.id, input.organizationId);
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 15 * 60_000);
  const updated = {
    ...current,
    attachments: [
      {
        fileName: input.fileName,
        id: `attachment-${current.attachments.length + 1}`,
        kind: input.kind,
        signedUrl: signAttachmentUrl(input.storageKey, expiresAt),
        signedUrlExpiresAt: expiresAt.toISOString(),
        uploadedAt: now
      },
      ...current.attachments
    ],
    timeline: [
      {
        description: `${input.actorName} enviou o anexo ${input.fileName}.`,
        id: `evt-${current.timeline.length + 1}`,
        occurredAt: now,
        title: "Evento registrado"
      },
      ...current.timeline
    ]
  };

  replaceMemoryOrder(updated);
  return updated;
}

function replaceMemoryOrder(updated: WorkOrderDetail): void {
  const index = workOrders.findIndex((candidate) => candidate.id === updated.id);
  if (index >= 0) {
    workOrders[index] = updated;
  }
}

function toSummary(row: WorkOrderRow): WorkOrderSummary {
  return {
    assignedTechnicianUserId: row.assigned_technician_user_id,
    customer: row.customer,
    id: row.id,
    number: row.number,
    organizationId: row.organization_id,
    priority: formatPriority(row.priority),
    scheduledStartAt: toIso(row.scheduled_start_at),
    site: row.site,
    slaDueAt: toIso(row.sla_due_at),
    status: row.status,
    teamId: row.team_id,
    technician: row.technician,
    territoryId: row.territory_id,
    title: row.title
  };
}

function toTimelineItem(row: EventRow) {
  const from = typeof row.payload.from === "string" ? row.payload.from : undefined;
  const to = typeof row.payload.to === "string" ? row.payload.to : undefined;
  const actor = row.actor ?? (typeof row.payload.actor === "string" ? row.payload.actor : "Sistema");

  return {
    description: eventDescription(row, actor, from, to),
    id: row.id,
    occurredAt: toIso(row.occurred_at),
    title: row.type === "status_change" ? "Status atualizado" : "Evento registrado"
  };
}

function isNoteEvent(row: EventRow): boolean {
  return row.type === "note_added" && typeof row.payload.body === "string";
}

function toNoteItem(row: EventRow) {
  return {
    author: row.actor ?? "Sistema",
    body: String(row.payload.body),
    createdAt: toIso(row.occurred_at),
    id: row.id
  };
}

function toAuditItem(row: AuditRow): WorkOrderAuditItem {
  return {
    action: row.action,
    actor: row.actor,
    after: row.after,
    before: row.before,
    id: row.id,
    occurredAt: toIso(row.occurred_at),
    resourceId: row.resource_id,
    resourceType: row.resource_type
  };
}

function eventDescription(row: EventRow, actor: string, from: string | undefined, to: string | undefined): string {
  if (from && to) {
    return `${actor} alterou o status de ${from} para ${to}.`;
  }

  if (row.type === "checklist_updated") {
    return `${actor} atualizou o checklist.`;
  }

  if (row.type === "note_added") {
    return `${actor} adicionou uma nota operacional.`;
  }

  if (row.type === "signature_captured") {
    const signerName = typeof row.payload.signerName === "string" ? row.payload.signerName : "cliente";
    return `${actor} coletou a assinatura de ${signerName}.`;
  }

  if (row.type === "attachment_added") {
    const fileName = typeof row.payload.fileName === "string" ? row.payload.fileName : "um anexo";
    return `${actor} enviou o anexo ${fileName}.`;
  }

  return `${actor} registrou ${row.type}.`;
}

function toSignedAttachment(row: AttachmentRow) {
  const expiresAt = new Date(Date.now() + 15 * 60_000);

  return {
    fileName: row.file_name,
    id: row.id,
    kind: row.kind,
    signedUrl: signAttachmentUrl(row.storage_key, expiresAt),
    signedUrlExpiresAt: expiresAt.toISOString(),
    uploadedAt: toIso(row.created_at)
  };
}

function toChecklistItem(row: ChecklistRow) {
  const value = (row.answers?.[row.key] ?? null) as string | number | boolean | null;
  const options = Array.isArray(row.validation?.options)
    ? (row.validation.options as string[])
    : undefined;

  return {
    answerKey: row.key,
    completed: !isEmptyChecklistValue(value),
    id: row.id,
    isRequired: row.is_required,
    label: row.label,
    options,
    type: row.type,
    validation: row.validation ?? undefined,
    value
  };
}

function isEmptyChecklistValue(value: unknown): boolean {
  return value === undefined || value === null || value === "";
}

function throwOnChecklistErrors(errors: readonly ChecklistValidationError[]): void {
  const missingKeys = errors.filter((error) => error.reason === "required").map((error) => error.key);
  if (missingKeys.length > 0) {
    throw new BadRequestException(`Campos obrigatórios sem resposta: ${missingKeys.join(", ")}.`);
  }

  const invalidKeys = errors.filter((error) => error.reason === "format").map((error) => error.key);
  if (invalidKeys.length > 0) {
    throw new BadRequestException(`Campos com formato inválido: ${invalidKeys.join(", ")}.`);
  }
}

function toSignatureItem(row: SignatureRow): WorkOrderSignature {
  return {
    attachmentId: row.attachment_id,
    id: row.id,
    signedAt: toIso(row.signed_at),
    signerName: row.signer_name
  };
}

function signAttachmentUrl(storageKey: string, expiresAt: Date): string {
  const expires = Math.floor(expiresAt.getTime() / 1000).toString();
  const signature = signAttachment(storageKey, expires);

  return `/attachments/${encodeURIComponent(storageKey)}?expires=${expires}&signature=${signature}`;
}

function toIso(value: Date | string | null): string {
  if (!value) {
    return "";
  }

  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function formatPriority(priority: string): string {
  const labels: Record<string, string> = {
    high: "Alta",
    low: "Baixa",
    medium: "Média",
    urgent: "Urgente"
  };

  return labels[priority] ?? priority;
}

const organizationId = "00000000-0000-4000-8000-000000000001";
const teamId = "00000000-0000-4000-8000-000000000201";
const territoryId = "00000000-0000-4000-8000-000000000801";

const workOrders: WorkOrderDetail[] = [
  {
    assignedTechnicianUserId: "00000000-0000-4000-8000-000000000012",
    attachments: [
      {
        fileName: "foto-bomba-a.jpg",
        id: "att-1",
        kind: "foto",
        signedUrl: signAttachmentUrl("demo/work-orders/WO-1001/foto-bomba-a.jpg", new Date("2026-10-09T10:35:00.000Z")),
        signedUrlExpiresAt: "2026-10-09T10:35:00.000Z",
        uploadedAt: "2026-01-16T10:20:00.000Z"
      }
    ],
    checklist: [
      { answerKey: "pressao_entrada", completed: true, id: "chk-1", isRequired: true, label: "Verificar pressão de entrada", type: "pass_fail", value: true },
      { answerKey: "leitura_eletrica", completed: false, id: "chk-2", isRequired: true, label: "Registrar leitura elétrica", type: "number", validation: { max: 250, min: 0 }, value: null },
      { answerKey: "foto_painel", completed: false, id: "chk-3", isRequired: false, label: "Anexar foto do painel", type: "photo", value: null }
    ],
    customer: "Hospital Santa Clara",
    description: "Inspeção preventiva da bomba pressurizadora principal da unidade Centro.",
    id: "00000000-0000-4000-8000-000000000901",
    notes: [{ author: "Marina Costa", body: "Cliente solicitou chegada pela portaria técnica.", createdAt: "2026-01-15T18:00:00.000Z", id: "note-1" }],
    number: "WO-1001",
    organizationId,
    priority: "Alta",
    scheduledStartAt: "2026-01-16T08:30:00.000Z",
    signatures: [],
    site: "Unidade Centro",
    slaDueAt: "2026-01-16T12:30:00.000Z",
    status: "scheduled",
    teamId,
    technician: "Ana Ribeiro",
    territoryId,
    timeline: [
      { description: "Ana Ribeiro foi atribuída à ordem.", id: "evt-1", occurredAt: "2026-01-15T17:30:00.000Z", title: "Técnico atribuído" }
    ],
    title: "Inspeção preventiva da bomba"
  },
  {
    assignedTechnicianUserId: "00000000-0000-4000-8000-000000000013",
    attachments: [],
    checklist: [
      { answerKey: "temperatura_atual", completed: false, id: "chk-4", isRequired: true, label: "Confirmar temperatura atual", type: "number", value: null },
      { answerKey: "validar_compressor", completed: false, id: "chk-5", isRequired: true, label: "Validar compressor", type: "pass_fail", value: null }
    ],
    customer: "Rede Mercado Norte",
    description: "Falha reportada em câmara fria com risco de perda de estoque.",
    id: "00000000-0000-4000-8000-000000000902",
    notes: [{ author: "Operação", body: "Priorizar antes do pico de abastecimento.", createdAt: "2026-01-15T19:10:00.000Z", id: "note-2" }],
    number: "WO-1002",
    organizationId,
    priority: "Urgente",
    scheduledStartAt: "2026-01-16T10:30:00.000Z",
    signatures: [],
    site: "Loja Pinheiros",
    slaDueAt: "2026-01-16T13:00:00.000Z",
    status: "en_route",
    teamId,
    technician: "Bruno Almeida",
    territoryId: "00000000-0000-4000-8000-000000000802",
    timeline: [
      { description: "Bruno iniciou deslocamento.", id: "evt-2", occurredAt: "2026-01-16T09:45:00.000Z", title: "A caminho" }
    ],
    title: "Falha em câmara fria"
  },
  {
    assignedTechnicianUserId: null,
    attachments: [],
    checklist: [],
    customer: "Condomínio Jardim Sul",
    description: "Vazamento em tubulação com risco de infiltração nas áreas comuns.",
    id: "demo-work-order-1003",
    notes: [],
    number: "WO-1003",
    organizationId,
    priority: "Média",
    scheduledStartAt: "2026-01-16T13:00:00.000Z",
    signatures: [],
    site: "Condomínio Jardim Sul",
    slaDueAt: "2026-01-16T16:00:00.000Z",
    status: "scheduled",
    teamId: null,
    technician: null,
    territoryId: "00000000-0000-4000-8000-000000000802",
    timeline: [],
    title: "Vazamento em tubulação"
  }
];
