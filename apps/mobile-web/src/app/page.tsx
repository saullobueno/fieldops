"use client";

import type { WorkOrderAttachment, WorkOrderChecklistItem, WorkOrderDetail, WorkOrderSummary } from "@fieldops/types";
import { Button } from "@fieldops/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { apiFetch } from "../lib/api-client";
import {
  cacheWorkOrders,
  enqueueCommand,
  getCachedWorkOrderDetail,
  getCachedWorkOrders,
  getQueuedCommands,
  putCachedWorkOrder,
  putCachedWorkOrderDetail,
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

    const command: QueuedCommand = {
      createdAt: new Date().toISOString(),
      idempotencyKey: crypto.randomUUID(),
      label: `${item.number}: status para ${status}`,
      payload: { status },
      status: "queued",
      type: "status_change",
      workOrderId: item.id
    };
    await enqueueCommand(command);
    queryClient.setQueryData<QueuedCommand[]>(QUEUE_QUERY_KEY, (current) => [...(current ?? []), command]);
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

    const command: QueuedCommand = {
      createdAt: new Date().toISOString(),
      idempotencyKey: crypto.randomUUID(),
      label: `${item.number}: nova nota`,
      payload: { body },
      status: "queued",
      type: "note_add",
      workOrderId: item.id
    };
    await enqueueCommand(command);
    queryClient.setQueryData<QueuedCommand[]>(QUEUE_QUERY_KEY, (current) => [...(current ?? []), command]);
    setNoteDrafts((current) => ({ ...current, [item.id]: "" }));
    await queryClient.invalidateQueries({ queryKey: QUEUE_QUERY_KEY });

    if (navigator.onLine) {
      syncMutation.mutate();
    }
  }

  async function submitChecklist(item: WorkOrderSummary, answers: Record<string, unknown>): Promise<void> {
    const command: QueuedCommand = {
      createdAt: new Date().toISOString(),
      idempotencyKey: crypto.randomUUID(),
      label: `${item.number}: checklist atualizado`,
      payload: { answers },
      status: "queued",
      type: "checklist_update",
      workOrderId: item.id
    };
    await enqueueCommand(command);
    queryClient.setQueryData<QueuedCommand[]>(QUEUE_QUERY_KEY, (current) => [...(current ?? []), command]);
    await queryClient.invalidateQueries({ queryKey: QUEUE_QUERY_KEY });

    if (navigator.onLine) {
      syncMutation.mutate();
    }
  }

  async function discardCommand(idempotencyKey: string): Promise<void> {
    await removeCommand(idempotencyKey);
    queryClient.setQueryData<QueuedCommand[]>(QUEUE_QUERY_KEY, (current) =>
      current?.filter((command) => command.idempotencyKey !== idempotencyKey) ?? []
    );
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
    <main className="mx-auto flex min-h-screen max-w-md flex-col bg-muted text-foreground">
      <header className="border-b border-border bg-card px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">FieldOps Mobile</p>
            <h1 className="mt-1 text-xl font-semibold">Meu dia</h1>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={
                isOnline
                  ? "rounded-full bg-success/10 px-2 py-1 text-xs font-semibold text-success"
                  : "rounded-full bg-warning/10 px-2 py-1 text-xs font-semibold text-warning"
              }
            >
              {isOnline ? "Online" : "Offline"}
            </span>
            <button
              className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent"
              onClick={() => void logout()}
              type="button"
            >
              Sair
            </button>
          </div>
        </div>
      </header>
      <section className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
          <p className="text-sm text-muted-foreground">{pendingCount} comando(s) pendente(s) de sincronização.</p>
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
          <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">Carregando ordens...</div>
        ) : workOrders.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
            Nenhuma ordem atribuída disponível{isOnline ? "." : " no cache offline."}
          </div>
        ) : (
          workOrders.map((item) => (
            <WorkOrderCard
              isOnline={isOnline}
              item={item}
              key={item.id}
              noteDraft={noteDrafts[item.id] ?? ""}
              onAdvanceStatus={(workOrder) => void advanceStatus(workOrder)}
              onChecklistUpdate={(workOrder, answers) => void submitChecklist(workOrder, answers)}
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
    <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
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
  isOnline,
  item,
  noteDraft,
  onAdvanceStatus,
  onChecklistUpdate,
  onNoteChange,
  onSubmitNote
}: {
  isOnline: boolean;
  item: WorkOrderSummary;
  noteDraft: string;
  onAdvanceStatus: (item: WorkOrderSummary) => void;
  onChecklistUpdate: (item: WorkOrderSummary, answers: Record<string, unknown>) => void;
  onNoteChange: (value: string) => void;
  onSubmitNote: (item: WorkOrderSummary) => void;
}): React.ReactNode {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const detailQueryKey = ["technician-work-order-detail", item.id];
  const detailQuery = useQuery({
    enabled: expanded,
    queryFn: () => loadWorkOrderDetail(item.id),
    queryKey: detailQueryKey
  });
  const uploadMutation = useMutation({
    mutationFn: (input: { file: File; kind: "photo" | "document" }) =>
      uploadAttachment(item.id, input.file, input.kind),
    onSuccess: async (detail) => {
      await putCachedWorkOrderDetail(detail);
      queryClient.setQueryData(detailQueryKey, detail);
    }
  });
  const signatureMutation = useMutation({
    mutationFn: async (input: { file: File; signerName: string }) => {
      const previousIds = new Set(detailQuery.data?.attachments.map((attachment) => attachment.id) ?? []);
      const withAttachment = await uploadAttachment(item.id, input.file, "signature");
      const uploaded =
        withAttachment.attachments.find((attachment) => !previousIds.has(attachment.id)) ??
        withAttachment.attachments[0];

      if (!uploaded) {
        throw new Error("Assinatura enviada sem anexo retornado.");
      }

      return addSignature(item.id, uploaded.id, input.signerName);
    },
    onSuccess: async (detail) => {
      await putCachedWorkOrderDetail(detail);
      queryClient.setQueryData(detailQueryKey, detail);
    }
  });

  function handleChecklistSubmit(answers: Record<string, unknown>): void {
    onChecklistUpdate(item, answers);
    const detail = detailQuery.data;
    if (!detail) {
      return;
    }

    const optimistic: WorkOrderDetail = {
      ...detail,
      checklist: detail.checklist.map((field) => {
        const key = field.answerKey ?? field.id;
        const value = Object.prototype.hasOwnProperty.call(answers, key) ? answers[key] : field.value;

        return { ...field, completed: !isEmptyChecklistValue(value), value: value as string | number | boolean | null };
      })
    };
    queryClient.setQueryData(detailQueryKey, optimistic);
    void putCachedWorkOrderDetail(optimistic);
  }

  return (
    <article className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">{item.number}</p>
        <span className="text-xs font-medium text-muted-foreground">{formatStatus(item.status)}</span>
      </div>
      <p className="mt-1 text-sm text-foreground">{item.title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{item.customer} · {item.site}</p>
      <div className="mt-3 flex gap-2">
        {nextStatusMap[item.status] ? (
          <Button onClick={() => onAdvanceStatus(item)} variant="primary">
            Avançar status
          </Button>
        ) : null}
        <Button onClick={() => setExpanded((current) => !current)} variant="secondary">
          {expanded ? "Fechar detalhes" : "Abrir detalhes"}
        </Button>
      </div>
      {expanded ? (
        <div className="mt-4 space-y-4 border-t border-border pt-4">
          {detailQuery.isLoading ? (
            <div className="rounded-md border border-border bg-muted p-3 text-sm text-muted-foreground">Carregando detalhes...</div>
          ) : null}
          {detailQuery.isError ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              Não foi possível carregar os detalhes desta ordem.
            </div>
          ) : null}
          {detailQuery.data ? (
            <>
              <ChecklistPanel checklist={detailQuery.data.checklist} onSubmit={handleChecklistSubmit} />
              <AttachmentPanel
                attachments={detailQuery.data.attachments}
                disabled={!isOnline || uploadMutation.isPending}
                error={uploadMutation.isError}
                onUpload={(file, kind) => uploadMutation.mutate({ file, kind })}
              />
              <SignaturePanel
                disabled={!isOnline || signatureMutation.isPending}
                error={signatureMutation.isError}
                onSubmit={(file, signerName) => signatureMutation.mutate({ file, signerName })}
              />
            </>
          ) : null}
        </div>
      ) : null}
      <form
        className="mt-3 flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmitNote(item);
        }}
      >
        <textarea
          className="min-h-16 resize-y rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:border-ring"
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

function ChecklistPanel({
  checklist,
  onSubmit
}: {
  checklist: readonly WorkOrderChecklistItem[];
  onSubmit: (answers: Record<string, unknown>) => void;
}): React.ReactNode {
  const [answers, setAnswers] = useState<Record<string, string | boolean>>(() => initialChecklistAnswers(checklist));

  if (checklist.length === 0) {
    return <MobileSection title="Checklist"><p className="text-sm text-muted-foreground">Nenhum checklist vinculado.</p></MobileSection>;
  }

  return (
    <MobileSection title="Checklist">
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(answers);
        }}
      >
        {checklist.map((field) => {
          const key = field.answerKey ?? field.id;

          return (
            <label className="block text-sm" key={field.id}>
              <span className="font-medium text-foreground">
                {field.label}{field.isRequired ? " *" : ""}
              </span>
              <ChecklistInput
                field={field}
                onChange={(value) => setAnswers((current) => ({ ...current, [key]: value }))}
                value={answers[key]}
              />
            </label>
          );
        })}
        <Button type="submit" variant="primary">Salvar checklist</Button>
      </form>
    </MobileSection>
  );
}

function ChecklistInput({
  field,
  onChange,
  value
}: {
  field: WorkOrderChecklistItem;
  onChange: (value: string | boolean) => void;
  value: string | boolean | undefined;
}): React.ReactNode {
  if (field.type === "pass_fail") {
    return (
      <select
        className={mobileInputClassName}
        onChange={(event) => onChange(event.target.value === "true")}
        value={typeof value === "boolean" ? String(value) : ""}
      >
        <option value="">Selecionar</option>
        <option value="true">Conforme</option>
        <option value="false">Não conforme</option>
      </select>
    );
  }

  if (field.type === "checkbox") {
    return (
      <span className="mt-2 flex items-center gap-2">
        <input
          checked={Boolean(value)}
          className="h-4 w-4"
          onChange={(event) => onChange(event.target.checked)}
          type="checkbox"
        />
        <span className="text-muted-foreground">Concluído</span>
      </span>
    );
  }

  return (
    <input
      className={mobileInputClassName}
      onChange={(event) => onChange(event.target.value)}
      placeholder={field.type === "photo" ? "Referência da foto anexada" : "Resposta"}
      type={field.type === "number" ? "number" : "text"}
      value={typeof value === "string" ? value : ""}
    />
  );
}

function AttachmentPanel({
  attachments,
  disabled,
  error,
  onUpload
}: {
  attachments: readonly WorkOrderAttachment[];
  disabled: boolean;
  error: boolean;
  onUpload: (file: File, kind: "photo" | "document") => void;
}): React.ReactNode {
  const [kind, setKind] = useState<"photo" | "document">("photo");

  return (
    <MobileSection title="Anexos">
      <div className="space-y-2">
        {attachments.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum anexo enviado.</p>
        ) : (
          attachments.map((attachment) => (
            <p className="rounded-md border border-border bg-card p-2 text-sm" key={attachment.id}>
              {attachment.fileName} · {attachment.kind}
            </p>
          ))
        )}
      </div>
      <div className="mt-3 grid gap-2">
        <select className={mobileInputClassName} onChange={(event) => setKind(event.target.value as "photo" | "document")} value={kind}>
          <option value="photo">Foto</option>
          <option value="document">Documento</option>
        </select>
        <input
          className="text-sm"
          disabled={disabled}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              onUpload(file, kind);
              event.target.value = "";
            }
          }}
          type="file"
        />
        {!disabled ? null : <p className="text-xs text-muted-foreground">Envio disponível quando o dispositivo estiver online.</p>}
        {error ? <p className="text-sm text-destructive">Não foi possível enviar o anexo.</p> : null}
      </div>
    </MobileSection>
  );
}

function SignaturePanel({
  disabled,
  error,
  onSubmit
}: {
  disabled: boolean;
  error: boolean;
  onSubmit: (file: File, signerName: string) => void;
}): React.ReactNode {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [signerName, setSignerName] = useState("");
  const [isDrawing, setIsDrawing] = useState(false);

  async function submitSignature(): Promise<void> {
    const canvas = canvasRef.current;
    const name = signerName.trim();
    if (!canvas || !name || disabled) {
      return;
    }

    const blob = await canvasToBlob(canvas);
    onSubmit(new File([blob], "assinatura.png", { type: "image/png" }), name);
  }

  function clearCanvas(): void {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) {
      return;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
  }

  function draw(event: React.PointerEvent<HTMLCanvasElement>): void {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context || !isDrawing) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    context.lineWidth = 2;
    context.lineCap = "round";
    context.strokeStyle = "#18181b";
    context.lineTo(event.clientX - rect.left, event.clientY - rect.top);
    context.stroke();
  }

  return (
    <MobileSection title="Assinatura">
      <input
        className={mobileInputClassName}
        onChange={(event) => setSignerName(event.target.value)}
        placeholder="Nome do assinante"
        value={signerName}
      />
      <canvas
        className="mt-2 h-32 w-full touch-none rounded-md border border-input bg-card"
        height={160}
        onPointerDown={(event) => {
          const canvas = canvasRef.current;
          const context = canvas?.getContext("2d");
          if (!canvas || !context) {
            return;
          }
          const rect = canvas.getBoundingClientRect();
          context.beginPath();
          context.moveTo(event.clientX - rect.left, event.clientY - rect.top);
          setIsDrawing(true);
        }}
        onPointerLeave={() => setIsDrawing(false)}
        onPointerMove={draw}
        onPointerUp={() => setIsDrawing(false)}
        ref={canvasRef}
        width={360}
      />
      <div className="mt-2 flex gap-2">
        <Button disabled={disabled || !signerName.trim()} onClick={() => void submitSignature()} type="button" variant="primary">
          Salvar assinatura
        </Button>
        <Button onClick={clearCanvas} type="button" variant="secondary">Limpar</Button>
      </div>
      {!disabled ? null : <p className="mt-2 text-xs text-muted-foreground">Assinatura exige conexão para enviar a imagem.</p>}
      {error ? <p className="mt-2 text-sm text-destructive">Não foi possível salvar a assinatura.</p> : null}
    </MobileSection>
  );
}

function MobileSection({ children, title }: { children: React.ReactNode; title: string }): React.ReactNode {
  return (
    <section className="rounded-lg border border-border bg-muted p-3">
      <h2 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">{title}</h2>
      {children}
    </section>
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

async function loadWorkOrderDetail(id: string): Promise<WorkOrderDetail> {
  if (navigator.onLine) {
    try {
      const response = await apiFetch(`/work-orders/${id}`);

      if (response.ok) {
        const detail = (await response.json()) as WorkOrderDetail;
        await putCachedWorkOrderDetail(detail);
        return detail;
      }
    } catch {
      // Segue para o cache local quando a rede falhar.
    }
  }

  const cached = await getCachedWorkOrderDetail(id);
  if (!cached) {
    throw new Error("Detalhe da ordem indisponível no cache offline.");
  }

  return cached;
}

async function uploadAttachment(
  workOrderId: string,
  file: File,
  kind: "photo" | "document" | "signature"
): Promise<WorkOrderDetail> {
  const body = new FormData();
  body.set("file", file);
  body.set("kind", kind);

  const response = await apiFetch(`/work-orders/${workOrderId}/attachments`, {
    body,
    method: "POST"
  });

  if (!response.ok) {
    throw new Error("Falha ao enviar anexo.");
  }

  return response.json() as Promise<WorkOrderDetail>;
}

async function addSignature(workOrderId: string, attachmentId: string, signerName: string): Promise<WorkOrderDetail> {
  const response = await apiFetch(`/work-orders/${workOrderId}/signature`, {
    body: JSON.stringify({ attachmentId, signerName }),
    method: "POST"
  });

  if (!response.ok) {
    throw new Error("Falha ao salvar assinatura.");
  }

  return response.json() as Promise<WorkOrderDetail>;
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

const mobileInputClassName = "mt-1 h-9 w-full rounded-md border border-border bg-card px-3 text-sm outline-none focus:border-ring";

function initialChecklistAnswers(checklist: readonly WorkOrderChecklistItem[]): Record<string, string | boolean> {
  const answers: Record<string, string | boolean> = {};
  for (const field of checklist) {
    const key = field.answerKey ?? field.id;
    if (typeof field.value === "boolean") {
      answers[key] = field.value;
    } else if (field.value !== null) {
      answers[key] = String(field.value);
    }
  }

  return answers;
}

function isEmptyChecklistValue(value: unknown): boolean {
  return value === undefined || value === null || value === "";
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }

      reject(new Error("Não foi possível gerar a imagem da assinatura."));
    }, "image/png");
  });
}
