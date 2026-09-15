import { Inject, Injectable, NotFoundException, Optional } from "@nestjs/common";
import type {
  NotificationChannel,
  NotificationItem,
  NotificationListResponse,
  NotificationPreference,
  NotificationPreferencesResponse,
  NotificationStatus
} from "@fieldops/types";
import type pg from "pg";

import { POSTGRES_POOL } from "../infrastructure/infrastructure.module.js";

interface NotificationRow {
  readonly id: string;
  readonly type: string;
  readonly title: string;
  readonly body: string;
  readonly status: NotificationStatus;
  readonly metadata: Record<string, unknown> | null;
  readonly created_at: Date | string;
  readonly updated_at: Date | string;
  readonly total: string;
  readonly unread_count: string;
}

interface NotificationListFilter {
  readonly organizationId: string;
  readonly userId: string;
  readonly limit: number;
  readonly offset: number;
  readonly status?: NotificationStatus;
  readonly type?: string;
}

interface UpdateNotificationStatusInput {
  readonly organizationId: string;
  readonly userId: string;
  readonly id: string;
  readonly status: NotificationStatus;
}

interface CreateNotificationInput {
  readonly organizationId: string;
  readonly userId: string;
  readonly type: string;
  readonly title: string;
  readonly body: string;
  readonly metadata?: Record<string, unknown>;
}

interface UpdatePreferencesInput {
  readonly userId: string;
  readonly preferences: readonly NotificationPreference[];
}

const demoPreferences = new Map<string, readonly NotificationPreference[]>();

@Injectable()
export class NotificationsService {
  constructor(
    @Optional() @Inject(POSTGRES_POOL) private readonly postgresPool?: pg.Pool
  ) {}

  async list(filter: NotificationListFilter): Promise<NotificationListResponse> {
    if (!this.postgresPool) {
      return demoList(filter);
    }

    try {
      return await this.listFromDatabase(filter);
    } catch {
      return demoList(filter);
    }
  }

  async create(input: CreateNotificationInput): Promise<NotificationItem> {
    if (!this.postgresPool) {
      return {
        body: input.body,
        createdAt: new Date().toISOString(),
        id: crypto.randomUUID(),
        metadata: input.metadata ?? {},
        status: "unread",
        title: input.title,
        type: input.type,
        updatedAt: new Date().toISOString()
      };
    }

    const result = await this.postgresPool.query<Omit<NotificationRow, "total" | "unread_count">>(
      `insert into notifications (organization_id, user_id, type, title, body, metadata)
       values ($1, $2, $3, $4, $5, $6::jsonb)
       returning id, type, title, body, status, metadata, created_at, updated_at`,
      [
        input.organizationId,
        input.userId,
        input.type,
        input.title,
        input.body,
        JSON.stringify(input.metadata ?? {})
      ]
    );
    const row = result.rows[0];

    if (!row) {
      throw new NotFoundException("Notificação não foi criada.");
    }

    return toNotificationItem(row);
  }

  async updateStatus(input: UpdateNotificationStatusInput): Promise<NotificationListResponse> {
    if (!this.postgresPool) {
      return updateDemoStatus(input);
    }

    const result = await this.postgresPool.query(
      `update notifications
       set status = $1, updated_at = now()
       where id = $2 and organization_id = $3 and user_id = $4
       returning id`,
      [input.status, input.id, input.organizationId, input.userId]
    );

    if (result.rowCount === 0) {
      throw new NotFoundException("Notificação não encontrada.");
    }

    return this.list({
      limit: 20,
      offset: 0,
      organizationId: input.organizationId,
      userId: input.userId
    });
  }

  getPreferences(userId: string): NotificationPreferencesResponse {
    return {
      preferences: demoPreferences.get(userId) ?? defaultPreferences,
      userId
    };
  }

  updatePreferences(input: UpdatePreferencesInput): NotificationPreferencesResponse {
    demoPreferences.set(input.userId, input.preferences);
    return this.getPreferences(input.userId);
  }

  private async listFromDatabase(filter: NotificationListFilter): Promise<NotificationListResponse> {
    const { values, where } = buildNotificationWhere(filter);
    values.push(filter.limit, filter.offset);
    const limitIndex = values.length - 1;
    const offsetIndex = values.length;

    const result = await this.postgresPool!.query<NotificationRow>(
      `select
         id,
         type,
         title,
         body,
         status,
         metadata,
         created_at,
         updated_at,
         count(*) over()::text as total,
         count(*) filter (where status = 'unread') over()::text as unread_count
       from notifications
       where ${where}
       order by created_at desc
       limit $${limitIndex} offset $${offsetIndex}`,
      values
    );

    const first = result.rows[0];

    return {
      items: result.rows.map(toNotificationItem),
      limit: filter.limit,
      offset: filter.offset,
      total: Number(first?.total ?? 0),
      unreadCount: Number(first?.unread_count ?? 0)
    };
  }
}

function buildNotificationWhere(filter: NotificationListFilter): { values: unknown[]; where: string } {
  const values: unknown[] = [filter.organizationId, filter.userId];
  const conditions = ["organization_id = $1", "user_id = $2"];

  if (filter.status) {
    values.push(filter.status);
    conditions.push(`status = $${values.length}`);
  }

  if (filter.type) {
    values.push(filter.type);
    conditions.push(`type = $${values.length}`);
  }

  return { values, where: conditions.join(" and ") };
}

function toNotificationItem(row: Omit<NotificationRow, "total" | "unread_count">): NotificationItem {
  return {
    body: row.body,
    createdAt: toIso(row.created_at),
    id: row.id,
    metadata: row.metadata ?? {},
    status: row.status,
    title: row.title,
    type: row.type,
    updatedAt: toIso(row.updated_at)
  };
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

const defaultPreferences: readonly NotificationPreference[] = [
  { channels: ["in_app", "email"], enabled: true, type: "sla_risk" },
  { channels: ["in_app"], enabled: true, type: "assignment" },
  { channels: ["in_app"], enabled: true, type: "sync_conflict" }
];

const demoNotifications: readonly NotificationItem[] = [
  {
    body: "WO-1002 vence em janela curta e ainda precisa de confirmação de despacho.",
    createdAt: "2026-01-15T10:45:00.000Z",
    id: "demo-notification-sla",
    metadata: { workOrderNumber: "WO-1002" },
    status: "unread",
    title: "SLA crítico no varejo",
    type: "sla_risk",
    updatedAt: "2026-01-15T10:45:00.000Z"
  },
  {
    body: "Ana Ribeiro recebeu WO-1001 para a janela da manhã.",
    createdAt: "2026-01-15T09:20:00.000Z",
    id: "demo-notification-assignment",
    metadata: { workOrderNumber: "WO-1001", technician: "Ana Ribeiro" },
    status: "read",
    title: "Atribuição confirmada",
    type: "assignment",
    updatedAt: "2026-01-15T09:35:00.000Z"
  }
];

function demoList(filter: NotificationListFilter): NotificationListResponse {
  const filtered = demoNotifications.filter((item) =>
    (!filter.status || item.status === filter.status) && (!filter.type || item.type === filter.type)
  );
  const items = filtered.slice(filter.offset, filter.offset + filter.limit);

  return {
    items,
    limit: filter.limit,
    offset: filter.offset,
    total: filtered.length,
    unreadCount: demoNotifications.filter((item) => item.status === "unread").length
  };
}

function updateDemoStatus(input: UpdateNotificationStatusInput): NotificationListResponse {
  const exists = demoNotifications.some((item) => item.id === input.id);

  if (!exists) {
    throw new NotFoundException("Notificação não encontrada.");
  }

  return demoList({
    limit: 20,
    offset: 0,
    organizationId: input.organizationId,
    userId: input.userId
  });
}
