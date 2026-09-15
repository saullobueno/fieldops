import type { SyncOperationType, WorkOrderDetail, WorkOrderSummary } from "@fieldops/types";

export interface QueuedCommand {
  readonly idempotencyKey: string;
  readonly workOrderId: string;
  readonly type: SyncOperationType;
  readonly payload: Record<string, unknown>;
  readonly createdAt: string;
  readonly label: string;
  status: "queued" | "conflict" | "failed";
  reason?: string;
}

const DB_NAME = "fieldops-technician";
const DB_VERSION = 2;
const WORK_ORDERS_STORE = "work-orders";
const WORK_ORDER_DETAILS_STORE = "work-order-details";
const COMMAND_QUEUE_STORE = "command-queue";

function isIndexedDbAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(WORK_ORDERS_STORE)) {
        db.createObjectStore(WORK_ORDERS_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(WORK_ORDER_DETAILS_STORE)) {
        db.createObjectStore(WORK_ORDER_DETAILS_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(COMMAND_QUEUE_STORE)) {
        db.createObjectStore(COMMAND_QUEUE_STORE, { keyPath: "idempotencyKey" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openDatabase();

  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(storeName, mode);
      const store = transaction.objectStore(storeName);
      const request = run(store);
      let result: T | undefined;

      request.onsuccess = () => {
        result = request.result;
      };
      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => resolve(result as T);
      transaction.onerror = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}

export async function cacheWorkOrders(items: readonly WorkOrderSummary[]): Promise<void> {
  if (!isIndexedDbAvailable()) {
    return;
  }

  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(WORK_ORDERS_STORE, "readwrite");
      const store = transaction.objectStore(WORK_ORDERS_STORE);
      store.clear();
      for (const item of items) {
        store.put(item);
      }
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}

export async function getCachedWorkOrders(): Promise<WorkOrderSummary[]> {
  if (!isIndexedDbAvailable()) {
    return [];
  }

  return withStore(WORK_ORDERS_STORE, "readonly", (store) => store.getAll());
}

export async function putCachedWorkOrder(item: WorkOrderSummary): Promise<void> {
  if (!isIndexedDbAvailable()) {
    return;
  }

  await withStore(WORK_ORDERS_STORE, "readwrite", (store) => store.put(item));
}

export async function getCachedWorkOrderDetail(id: string): Promise<WorkOrderDetail | undefined> {
  if (!isIndexedDbAvailable()) {
    return undefined;
  }

  return withStore(WORK_ORDER_DETAILS_STORE, "readonly", (store) => store.get(id));
}

export async function putCachedWorkOrderDetail(item: WorkOrderDetail): Promise<void> {
  if (!isIndexedDbAvailable()) {
    return;
  }

  await withStore(WORK_ORDER_DETAILS_STORE, "readwrite", (store) => store.put(item));
}

export async function enqueueCommand(command: QueuedCommand): Promise<void> {
  if (!isIndexedDbAvailable()) {
    return;
  }

  await withStore(COMMAND_QUEUE_STORE, "readwrite", (store) => store.put(command));
}

export async function getQueuedCommands(): Promise<QueuedCommand[]> {
  if (!isIndexedDbAvailable()) {
    return [];
  }

  return withStore(COMMAND_QUEUE_STORE, "readonly", (store) => store.getAll());
}

export async function updateCommandStatus(
  idempotencyKey: string,
  status: QueuedCommand["status"],
  reason?: string
): Promise<void> {
  if (!isIndexedDbAvailable()) {
    return;
  }

  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(COMMAND_QUEUE_STORE, "readwrite");
      const store = transaction.objectStore(COMMAND_QUEUE_STORE);
      const getRequest = store.get(idempotencyKey);

      getRequest.onsuccess = () => {
        const existing = getRequest.result as QueuedCommand | undefined;
        if (existing) {
          store.put({ ...existing, reason, status });
        }
      };

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}

export async function removeCommand(idempotencyKey: string): Promise<void> {
  if (!isIndexedDbAvailable()) {
    return;
  }

  await withStore(COMMAND_QUEUE_STORE, "readwrite", (store) => store.delete(idempotencyKey));
}
