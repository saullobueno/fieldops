import { Inject, Injectable, NotFoundException, Optional } from "@nestjs/common";
import type { AssetDetail } from "@fieldops/types";
import type pg from "pg";

import { signAttachment } from "../attachments/attachments.service.js";
import { POSTGRES_POOL } from "../infrastructure/infrastructure.module.js";

interface AssetRow {
  readonly id: string;
  readonly organization_id: string;
  readonly name: string;
  readonly model: string | null;
  readonly serial_number: string | null;
  readonly warranty_expires_on: Date | string | null;
  readonly customer_id: string;
  readonly customer_name: string;
  readonly site_id: string;
  readonly site_name: string;
}

interface MaintenanceEventRow {
  readonly id: string;
  readonly type: string;
  readonly payload: Record<string, unknown>;
  readonly occurred_at: Date | string;
  readonly work_order_number: string;
  readonly actor: string | null;
}

interface DocumentRow {
  readonly id: string;
  readonly kind: string;
  readonly file_name: string;
  readonly storage_key: string;
  readonly created_at: Date | string;
}

@Injectable()
export class AssetsService {
  constructor(
    @Optional() @Inject(POSTGRES_POOL) private readonly postgresPool?: pg.Pool
  ) {}

  async getById(id: string, organizationId: string): Promise<AssetDetail> {
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

  private async getFromDatabase(id: string, organizationId: string): Promise<AssetDetail> {
    const asset = await this.postgresPool!.query<AssetRow>(
      `select
         a.id,
         a.organization_id,
         a.name,
         a.model,
         a.serial_number,
         a.warranty_expires_on,
         c.id as customer_id,
         c.name as customer_name,
         s.id as site_id,
         s.name as site_name
       from assets a
       join customers c on c.id = a.customer_id
       join sites s on s.id = a.site_id
       where a.id = $1 and a.organization_id = $2
       limit 1`,
      [id, organizationId]
    );

    const row = asset.rows[0];
    if (!row) {
      throw new NotFoundException("Ativo não encontrado.");
    }

    const [events, documents] = await Promise.all([
      this.postgresPool!.query<MaintenanceEventRow>(
        `select e.id, e.type, e.payload, e.occurred_at, wo.number as work_order_number, u.name as actor
         from work_order_events e
         join work_orders wo on wo.id = e.work_order_id
         left join users u on u.id = e.actor_user_id
         where wo.asset_id = $1 and wo.organization_id = $2
         order by e.occurred_at desc
         limit 50`,
        [id, organizationId]
      ),
      this.postgresPool!.query<DocumentRow>(
        `select id, kind, file_name, storage_key, created_at
         from attachments
         where asset_id = $1 and organization_id = $2
         order by created_at desc`,
        [id, organizationId]
      )
    ]);

    return {
      customerId: row.customer_id,
      customerName: row.customer_name,
      documents: documents.rows.map(toSignedDocument),
      id: row.id,
      maintenanceTimeline: events.rows.map(toMaintenanceEvent),
      model: row.model,
      name: row.name,
      organizationId: row.organization_id,
      serialNumber: row.serial_number,
      siteId: row.site_id,
      siteName: row.site_name,
      warrantyExpiresOn: row.warranty_expires_on ? toIso(row.warranty_expires_on) : null
    };
  }
}

function toMaintenanceEvent(row: MaintenanceEventRow) {
  const actor = row.actor ?? (typeof row.payload.actor === "string" ? row.payload.actor : "Sistema");

  return {
    description: describeEvent(row, actor),
    id: row.id,
    occurredAt: toIso(row.occurred_at),
    title: row.type === "status_change" ? "Status atualizado" : "Evento de manutenção",
    workOrderNumber: row.work_order_number
  };
}

function describeEvent(row: MaintenanceEventRow, actor: string): string {
  const from = typeof row.payload.from === "string" ? row.payload.from : undefined;
  const to = typeof row.payload.to === "string" ? row.payload.to : undefined;

  if (from && to) {
    return `${actor} alterou o status da ordem ${row.work_order_number} de ${from} para ${to}.`;
  }

  if (row.type === "checklist_updated") {
    return `${actor} atualizou o checklist da ordem ${row.work_order_number}.`;
  }

  return `${actor} registrou ${row.type} na ordem ${row.work_order_number}.`;
}

function toSignedDocument(row: DocumentRow) {
  const expiresAt = new Date(Date.now() + 15 * 60_000);
  const expires = Math.floor(expiresAt.getTime() / 1000).toString();
  const signature = signAttachment(row.storage_key, expires);

  return {
    fileName: row.file_name,
    id: row.id,
    kind: row.kind,
    signedUrl: `/attachments/${encodeURIComponent(row.storage_key)}?expires=${expires}&signature=${signature}`,
    signedUrlExpiresAt: expiresAt.toISOString(),
    uploadedAt: toIso(row.created_at)
  };
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

const organizationId = "00000000-0000-4000-8000-000000000001";

const assets: AssetDetail[] = [
  {
    customerId: "00000000-0000-4000-8000-000000000301",
    customerName: "Hospital Santa Clara",
    documents: [
      {
        fileName: "foto-bomba-a.jpg",
        id: "att-1",
        kind: "photo",
        uploadedAt: "2026-01-16T10:20:00.000Z"
      }
    ],
    id: "00000000-0000-4000-8000-000000000501",
    maintenanceTimeline: [
      {
        description: "Ana Ribeiro foi atribuída à inspeção preventiva.",
        id: "evt-1",
        occurredAt: "2026-01-15T17:30:00.000Z",
        title: "Técnico atribuído",
        workOrderNumber: "WO-1001"
      }
    ],
    model: "PX-900",
    name: "Bomba pressurizadora A",
    organizationId,
    serialNumber: "BMB-ACME-001",
    siteId: "00000000-0000-4000-8000-000000000401",
    siteName: "Unidade Centro",
    warrantyExpiresOn: null
  }
];

function getFromMemory(id: string, organizationId: string): AssetDetail {
  const item = assets.find(
    (candidate) => candidate.id === id && candidate.organizationId === organizationId
  );

  if (!item) {
    throw new NotFoundException("Ativo não encontrado.");
  }

  return item;
}
