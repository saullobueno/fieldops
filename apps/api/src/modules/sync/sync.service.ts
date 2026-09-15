import { Inject, Injectable, NotFoundException, Optional } from "@nestjs/common";
import type { AuthenticatedActor } from "@fieldops/auth";
import type { WorkOrderStatus } from "@fieldops/domain";
import type {
  SyncBatchRequest,
  SyncOperationOutcome,
  SyncOperationRequest,
  SyncOperationResult,
  WorkOrderDetail
} from "@fieldops/types";
import type pg from "pg";

import { POSTGRES_POOL } from "../infrastructure/infrastructure.module.js";
import { WorkOrdersService } from "../work-orders/work-orders.service.js";

const demoProcessedKeys = new Map<string, SyncOperationResult>();

@Injectable()
export class SyncService {
  constructor(
    @Inject(WorkOrdersService) private readonly workOrdersService: WorkOrdersService,
    @Optional() @Inject(POSTGRES_POOL) private readonly postgresPool?: pg.Pool
  ) {}

  async processBatch(actor: AuthenticatedActor, batch: SyncBatchRequest): Promise<readonly SyncOperationResult[]> {
    await this.touchDeviceSession(actor, batch.deviceSessionId);

    const results: SyncOperationResult[] = [];
    for (const operation of batch.operations) {
      results.push(await this.processOperation(actor, batch.deviceSessionId, operation));
    }

    return results;
  }

  private async processOperation(
    actor: AuthenticatedActor,
    deviceSessionId: string,
    operation: SyncOperationRequest
  ): Promise<SyncOperationResult> {
    const dedupeKey = `${actor.organizationId}:${operation.idempotencyKey}`;

    const existing = await this.findExisting(actor.organizationId, operation.idempotencyKey);
    if (existing) {
      return { idempotencyKey: operation.idempotencyKey, outcome: "duplicate" };
    }

    let outcome: SyncOperationOutcome;
    let reason: string | undefined;
    let workOrder: WorkOrderDetail | undefined;

    try {
      workOrder = await this.applyOperation(actor, operation);
      outcome = "completed";
    } catch (error) {
      if (error instanceof NotFoundException) {
        outcome = "failed";
        reason = "Ordem de serviço não encontrada.";
      } else {
        outcome = "conflict";
        reason = error instanceof Error ? error.message : "Conflito ao aplicar a operação.";
      }
    }

    const result: SyncOperationResult = {
      idempotencyKey: operation.idempotencyKey,
      outcome,
      reason,
      workOrder
    };

    await this.persistResult(actor.organizationId, deviceSessionId, operation, result);
    demoProcessedKeys.set(dedupeKey, result);

    return result;
  }

  private async applyOperation(actor: AuthenticatedActor, operation: SyncOperationRequest): Promise<WorkOrderDetail> {
    switch (operation.type) {
      case "status_change":
        return this.workOrdersService.updateStatus({
          actorName: actor.id,
          id: operation.workOrderId,
          organizationId: actor.organizationId,
          status: operation.payload.status as WorkOrderStatus
        });
      case "checklist_update":
        return this.workOrdersService.updateChecklist({
          actorUserId: actor.id,
          answers: operation.payload.answers as Record<string, unknown>,
          id: operation.workOrderId,
          organizationId: actor.organizationId
        });
      case "note_add":
        return this.workOrdersService.addNote({
          actorName: actor.id,
          actorUserId: actor.id,
          body: operation.payload.body as string,
          id: operation.workOrderId,
          organizationId: actor.organizationId
        });
    }
  }

  private async findExisting(organizationId: string, idempotencyKey: string): Promise<boolean> {
    if (!this.postgresPool) {
      return demoProcessedKeys.has(`${organizationId}:${idempotencyKey}`);
    }

    try {
      const result = await this.postgresPool.query<{ id: string }>(
        `select id from sync_operations where organization_id = $1 and idempotency_key = $2 limit 1`,
        [organizationId, idempotencyKey]
      );

      return Boolean(result.rows[0]);
    } catch {
      return demoProcessedKeys.has(`${organizationId}:${idempotencyKey}`);
    }
  }

  private async persistResult(
    organizationId: string,
    deviceSessionId: string,
    operation: SyncOperationRequest,
    result: SyncOperationResult
  ): Promise<void> {
    if (!this.postgresPool) {
      return;
    }

    try {
      await this.postgresPool.query(
        `insert into sync_operations (organization_id, device_session_id, idempotency_key, resource_type, operation, payload, status, conflict)
         values ($1, $2, $3, 'work_order', $4, $5::jsonb, $6, $7::jsonb)
         on conflict (organization_id, idempotency_key) do nothing`,
        [
          organizationId,
          deviceSessionId,
          operation.idempotencyKey,
          operation.type,
          JSON.stringify({ ...operation.payload, workOrderId: operation.workOrderId }),
          toStoredStatus(result.outcome),
          result.outcome === "conflict" ? JSON.stringify({ reason: result.reason }) : null
        ]
      );
    } catch {
      // Persistência de auditoria de sincronização é best-effort; o resultado já foi calculado.
    }
  }

  private async touchDeviceSession(actor: AuthenticatedActor, deviceSessionId: string): Promise<void> {
    if (!this.postgresPool) {
      return;
    }

    try {
      await this.postgresPool.query(
        `insert into device_sessions (id, organization_id, user_id, device_name, last_seen_at)
         values ($1, $2, $3, 'mobile-web', now())
         on conflict (id) do update set last_seen_at = now()`,
        [deviceSessionId, actor.organizationId, actor.id]
      );
    } catch {
      // Sessão de dispositivo é informativa; falha aqui não deve bloquear a sincronização.
    }
  }
}

function toStoredStatus(outcome: SyncOperationOutcome): "completed" | "failed" | "conflict" {
  if (outcome === "duplicate") {
    return "completed";
  }

  return outcome;
}
