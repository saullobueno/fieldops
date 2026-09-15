import type { SyncBatchResponse, SyncOperationRequest } from "@fieldops/types";

import { apiFetch } from "./api-client";
import { getQueuedCommands, removeCommand, updateCommandStatus } from "./offline-db";

const DEVICE_SESSION_STORAGE_KEY = "fieldops-device-session-id";

export function getDeviceSessionId(): string {
  if (typeof window === "undefined") {
    return "server";
  }

  const existing = window.localStorage.getItem(DEVICE_SESSION_STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const created = crypto.randomUUID();
  window.localStorage.setItem(DEVICE_SESSION_STORAGE_KEY, created);
  return created;
}

export interface FlushSummary {
  readonly synced: number;
  readonly conflicts: number;
  readonly failed: number;
  readonly attempted: number;
}

export async function flushQueue(): Promise<FlushSummary> {
  const queued = (await getQueuedCommands()).filter((command) => command.status === "queued");

  if (queued.length === 0) {
    return { attempted: 0, conflicts: 0, failed: 0, synced: 0 };
  }

  const operations: SyncOperationRequest[] = queued.map((command) => ({
    idempotencyKey: command.idempotencyKey,
    payload: command.payload,
    type: command.type,
    workOrderId: command.workOrderId
  }));

  let response: SyncBatchResponse;
  try {
    response = await postBatch(operations);
  } catch {
    return { attempted: queued.length, conflicts: 0, failed: 0, synced: 0 };
  }

  let synced = 0;
  let conflicts = 0;
  let failed = 0;

  for (const result of response.results) {
    if (result.outcome === "completed" || result.outcome === "duplicate") {
      await removeCommand(result.idempotencyKey);
      synced += 1;
    } else if (result.outcome === "conflict") {
      await updateCommandStatus(result.idempotencyKey, "conflict", result.reason);
      conflicts += 1;
    } else {
      await updateCommandStatus(result.idempotencyKey, "failed", result.reason);
      failed += 1;
    }
  }

  return { attempted: queued.length, conflicts, failed, synced };
}

async function postBatch(operations: readonly SyncOperationRequest[]): Promise<SyncBatchResponse> {
  const response = await apiFetch("/sync/operations", {
    body: JSON.stringify({ deviceSessionId: getDeviceSessionId(), operations }),
    method: "POST"
  });

  if (!response.ok) {
    throw new Error("Falha ao sincronizar comandos pendentes.");
  }

  return response.json() as Promise<SyncBatchResponse>;
}
