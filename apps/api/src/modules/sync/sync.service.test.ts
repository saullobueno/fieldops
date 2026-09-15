import type { AuthenticatedActor } from "@fieldops/auth";
import { describe, expect, it } from "vitest";

import { RealtimeService } from "../realtime/realtime.service.js";
import { WorkOrdersService } from "../work-orders/work-orders.service.js";
import { SyncService } from "./sync.service.js";

const actor: AuthenticatedActor = {
  id: "00000000-0000-4000-8000-000000000012",
  organizationId: "00000000-0000-4000-8000-000000000001",
  permissions: ["work_order:update"],
  roleIds: [],
  teamIds: ["00000000-0000-4000-8000-000000000201"],
  territoryIds: ["00000000-0000-4000-8000-000000000801"]
};

function createService(): SyncService {
  return new SyncService(new WorkOrdersService(new RealtimeService()));
}

describe("SyncService", () => {
  it("aplica uma operação de nota e retorna a ordem atualizada", async () => {
    const service = createService();

    const [result] = await service.processBatch(actor, {
      deviceSessionId: "device-1",
      operations: [
        {
          idempotencyKey: `note-${Date.now()}`,
          payload: { body: "Cliente confirmou o horário." },
          type: "note_add",
          workOrderId: "00000000-0000-4000-8000-000000000901"
        }
      ]
    });

    expect(result?.outcome).toBe("completed");
    expect(result?.workOrder?.notes[0]?.body).toBe("Cliente confirmou o horário.");
  });

  it("deduplica reenvio da mesma chave de idempotência", async () => {
    const service = createService();
    const idempotencyKey = `dup-${Date.now()}`;
    const operation = {
      idempotencyKey,
      payload: { body: "Nota duplicada." },
      type: "note_add" as const,
      workOrderId: "00000000-0000-4000-8000-000000000901"
    };

    const first = await service.processBatch(actor, { deviceSessionId: "device-1", operations: [operation] });
    const second = await service.processBatch(actor, { deviceSessionId: "device-1", operations: [operation] });

    expect(first[0]?.outcome).toBe("completed");
    expect(second[0]?.outcome).toBe("duplicate");
  });

  it("retorna conflito quando a transição de status é inválida", async () => {
    const service = createService();

    const [result] = await service.processBatch(actor, {
      deviceSessionId: "device-1",
      operations: [
        {
          idempotencyKey: `invalid-${Date.now()}`,
          payload: { status: "completed" },
          type: "status_change",
          workOrderId: "00000000-0000-4000-8000-000000000901"
        }
      ]
    });

    expect(result?.outcome).toBe("conflict");
  });
});
