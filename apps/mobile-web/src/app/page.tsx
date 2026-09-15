"use client";

import type { WorkOrderSummary } from "@fieldops/types";
import { Button } from "@fieldops/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { apiFetch } from "../lib/api-client";
import {
  cacheWorkOrders,
  enqueueCommand,
  getCachedWorkOrders,
  getQueuedCommands,
  putCachedWorkOrder,
  removeCommand,
  type QueuedCommand
} from "../lib/offline-db";
import { flushQueue } from "../lib/sync-engine";
import { useRequireAuth } from "../lib/use-require-auth";

const WORK_ORDERS_QUERY_KEY = ["technician-work-orders"];
const QUEUE_QUERY_KEY = ["technician-queue"];

const nextStatusMap: Record<string, string> = {
  en_route: "on_site",
  on_site: "completed",
  scheduled: "en_route"
};

export default function TechnicianHomePage(): React.ReactNode {
  const { logout, session } = useRequireAuth();
  const queryClient = useQueryClient();
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  const workOrdersQuery = useQuery({
    enabled: Boolean(session),
    queryFn: loadWorkOrders,
    queryKey: WORK_ORDERS_QUERY_KEY
  });
  const queueQuery = useQuery({
    enabled: Boolean(session),
    queryFn: getQueuedCommands,
    queryKey: QUEUE_QUERY_KEY
  });

  const syncMutation = useMutation({
    mutationFn: () => flushQueue(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: QUEUE_QUERY_KEY });
    }
  });

  useEffect(() => {
    function handleOnline(): void {
      setIsOnline(true);
      syncMutation.mutate();
      void queryClient.invalidateQueries({ queryKey: WORK_ORDERS_QUERY_KEY });
    }

    function handleOffline(): void {
      setIsOnline(false);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const retryInterval = window.setInterval(() => {
      if (navigator.onLine) {
        syncMutation.mutate();
      }
    }, 15_000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.clearInterval(retryInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function advanceStatus(item: WorkOrderSummary): Promise<void> {
    const status = nextStatusMap[item.status];
    if (!status) {
      return;
    }

    const updated = { ...item, status };
    queryClient.setQueryData<WorkOrderSummary[]>(WORK_ORDERS_QUERY_KEY, (current) =>
      current?.map((wo) => (wo.id === item.id ? updated : wo))
    );
    await putCachedWorkOrder(updated);

    await enqueueCommand({
      createdAt: new Date().toISOString(),
      idempotencyKey: crypto.randomUUID(),
      label: `${item.number}: status para ${status}`,
      payload: { status },
      status: "queued",
      type: "status_change",
      workOrderId: item.id
    });
    await queryClient.invalidateQueries({ queryKey: QUEUE_QUERY_KEY });

    if (navigator.onLine) {
      syncMutation.mutate();
    }
  }

  async function submitNote(item: WorkOrderSummary): Promise<void> {
    const body = noteDrafts[item.id]?.trim();
    if (!body) {
      return;
    }

    await enqueueCommand({
      createdAt: new Date().toISOString(),
      idempotencyKey: crypto.randomUUID(),
      label: `${item.number}: nova nota`,
      payload: { body },
      status: "queued",
      type: "note_add",
      workOrderId: item.id
    });
    setNoteDrafts((current) => ({ ...current, [item.id]: "" }));
    await queryClient.invalidateQueries({ queryKey: QUEUE_QUERY_KEY });

    if (navigator.onLine) {
      syncMutation.mutate();
    }
  }

  async function discardCommand(idempotencyKey: string): Promise<void> {
    await removeCommand(idempotencyKey);
    await queryClient.invalidateQueries({ queryKey: QUEUE_QUERY_KEY });
  }

  const workOrders = workOrdersQuery.data ?? [];
  const queue = queueQuery.data ?? [];
  const pendingCount = queue.filter((command) => command.status === "queued").length;
  const conflicts = queue.filter((command) => command.status === "conflict");

  if (!session) {
    return null;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col bg-zinc-50 text-zinc-950">
      <header className="border-b border-zinc-200 bg-white px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase text-zinc-500">FieldOps Mobile</p>
            <h1 className="mt-1 text-xl font-semibold">Meu dia</h1>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={
                isOnline
                  ? "rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700"
                  : "rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700"
              }
            >
              {isOnline ? "Online" : "Offline"}
            </span>
            <button
              className="rounded-md px-2 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-100"
              onClick={logout}
              type="button"
            >
              Sair
            </button>
          </div>
        </div>
      </header>
      <section className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-3">
          <p className="text-sm text-zinc-600">{pendingCount} comando(s) pendente(s) de sincronização.</p>
          <Button
            disabled={syncMutation.isPending || pendingCount === 0}
            onClick={() => syncMutation.mutate()}
            variant="primary"
          >
            {syncMutation.isPending ? "Sincronizando..." : "Sincronizar"}
          </Button>
        </div>

        {conflicts.length > 0 ? (
          <div className="space-y-2">
            {conflicts.map((command) => (
              <ConflictCard
                command={command}
                key={command.idempotencyKey}
                onDiscard={(idempotencyKey) => void discardCommand(idempotencyKey)}
              />
            ))}
          </div>
        ) : null}

        {workOrdersQuery.isLoading ? (
          <div className="rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-600">Carregando ordens...</div>
        ) : workOrders.length === 0 ? (
          <div className="rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-600">
            Nenhuma ordem atribuída disponível{isOnline ? "." : " no cache offline."}
          </div>
        ) : (
          workOrders.map((item) => (
            <WorkOrderCard
              item={item}
              key={item.id}
              noteDraft={noteDrafts[item.id] ?? ""}
              onAdvanceStatus={(workOrder) => void advanceStatus(workOrder)}
              onNoteChange={(value) => setNoteDrafts((current) => ({ ...current, [item.id]: value }))}
              onSubmitNote={(workOrder) => void submitNote(workOrder)}
            />
          ))
        )}
      </section>
    </main>
  );
}

function ConflictCard({
  command,
  onDiscard
}: {
  command: QueuedCommand;
  onDiscard: (idempotencyKey: string) => void;
}): React.ReactNode {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
      <p className="font-medium">Conflito: {command.label}</p>
      <p className="mt-1 text-xs">{command.reason ?? "O servidor rejeitou este comando."}</p>
      <div className="mt-2">
        <Button onClick={() => onDiscard(command.idempotencyKey)} variant="secondary">
          Descartar
        </Button>
      </div>
    </div>
  );
}

function WorkOrderCard({
  item,
  noteDraft,
  onAdvanceStatus,
  onNoteChange,
  onSubmitNote
}: {
  item: WorkOrderSummary;
  noteDraft: string;
  onAdvanceStatus: (item: WorkOrderSummary) => void;
  onNoteChange: (value: string) => void;
  onSubmitNote: (item: WorkOrderSummary) => void;
}): React.ReactNode {
  return (
    <article className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">{item.number}</p>
        <span className="text-xs font-medium text-zinc-500">{formatStatus(item.status)}</span>
      </div>
      <p className="mt-1 text-sm text-zinc-700">{item.title}</p>
      <p className="mt-1 text-xs text-zinc-500">{item.customer} · {item.site}</p>
      <div className="mt-3 flex gap-2">
        {nextStatusMap[item.status] ? (
          <Button onClick={() => onAdvanceStatus(item)} variant="primary">
            Avançar status
          </Button>
        ) : null}
      </div>
      <form
        className="mt-3 flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmitNote(item);
        }}
      >
        <textarea
          className="min-h-16 resize-y rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-950"
          onChange={(event) => onNoteChange(event.target.value)}
          placeholder="Adicionar nota de campo"
          value={noteDraft}
        />
        <div>
          <Button disabled={!noteDraft.trim()} type="submit" variant="secondary">
            Adicionar nota
          </Button>
        </div>
      </form>
    </article>
  );
}

async function loadWorkOrders(): Promise<WorkOrderSummary[]> {
  if (navigator.onLine) {
    try {
      const response = await apiFetch("/technician/work-orders");

      if (response.ok) {
        const items = (await response.json()) as WorkOrderSummary[];
        await cacheWorkOrders(items);
        return items;
      }
    } catch {
      // Segue para o cache local quando a rede falhar.
    }
  }

  return getCachedWorkOrders();
}

function formatStatus(status: string): string {
  const labels: Record<string, string> = {
    completed: "Concluída",
    en_route: "A caminho",
    on_site: "No local",
    paused: "Pausada",
    scheduled: "Agendada"
  };

  return labels[status] ?? status;
}
