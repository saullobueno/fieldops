"use client";

import type {
  WorkOrderAuditItem,
  WorkOrderChecklistItem,
  WorkOrderDetail,
  WorkOrderListResponse,
  WorkOrderSummary
} from "@fieldops/types";
import { AppShell, Button } from "@fieldops/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { apiBaseUrl, apiFetch, getStoredSession } from "../../lib/api-client";
import { RealtimeStatusBadge } from "../../lib/realtime-status-badge";
import { useRealtimeStream } from "../../lib/use-realtime-stream";
import { useRequireAuth } from "../../lib/use-require-auth";

const statusOptions = [
  { label: "Todos", value: "" },
  { label: "Agendada", value: "scheduled" },
  { label: "A caminho", value: "en_route" },
  { label: "No local", value: "on_site" },
  { label: "Pausada", value: "paused" },
  { label: "Concluída", value: "completed" },
  { label: "Requer revisão", value: "requires_review" }
] as const;

const pageSize = 20;

export default function WorkOrdersPage(): React.ReactNode {
  const { logout, session } = useRequireAuth();
  const queryClient = useQueryClient();
  const [limit, setLimit] = useState(pageSize);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("00000000-0000-4000-8000-000000000901");
  const { events, status: realtimeStatus } = useRealtimeStream(session?.organizationId ?? "", "work_order:read");
  const listQuery = useQuery({
    enabled: Boolean(session),
    queryFn: () => fetchWorkOrders({ limit, search, status }),
    queryKey: ["work-orders", limit, search, status]
  });

  useEffect(() => {
    if (events.length === 0) {
      return;
    }

    void queryClient.invalidateQueries({ queryKey: ["work-orders"] });
    void queryClient.invalidateQueries({ queryKey: ["work-order-detail"] });
    void queryClient.invalidateQueries({ queryKey: ["work-order-audit"] });
  }, [events, queryClient]);

  const selectedFromList = useMemo(
    () => listQuery.data?.items.find((item) => item.id === selectedId),
    [listQuery.data?.items, selectedId]
  );

  if (!session) {
    return null;
  }

  return (
    <AppShell
      activeHref="/ordens"
      headerAction={
        <div className="flex items-center gap-3">
          <RealtimeStatusBadge status={realtimeStatus} />
          <Button variant="primary">Nova ordem</Button>
        </div>
      }
      headerEyebrow="Operação"
      headerTitle="Ordens de serviço"
      onLogout={logout}
      userLabel={session.userName}
    >
      <div className="grid flex-1 gap-5 p-6 xl:grid-cols-[1fr_420px] max-sm:p-4">
        <section className="rounded-lg border border-[#D8DEDA] bg-[#FBFCFB] p-4">
          <div className="flex flex-wrap items-center gap-3">
            <input
              aria-label="Buscar ordens"
              className="h-9 min-w-64 rounded-md border border-[#C7D0CB] bg-white px-3 text-sm outline-none focus:border-[#0E5F4B]"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por número, cliente ou título"
              value={search}
            />
            <select
              aria-label="Filtrar ordens por status"
              className="h-9 rounded-md border border-[#C7D0CB] bg-white px-3 text-sm outline-none focus:border-[#0E5F4B]"
              onChange={(event) => setStatus(event.target.value)}
              value={status}
            >
              {statusOptions.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
            <Button onClick={() => void listQuery.refetch()} variant="secondary">Atualizar</Button>
          </div>
          <div className="mt-4">
            <ListState query={listQuery} onRetry={() => void listQuery.refetch()}>
              {(data) => (
                <WorkOrderTable
                  items={data.items}
                  onSelect={setSelectedId}
                  selectedId={selectedFromList?.id ?? selectedId}
                />
              )}
            </ListState>
            {listQuery.data && listQuery.data.items.length < listQuery.data.total ? (
              <div className="mt-4 flex justify-center">
                <Button
                  disabled={listQuery.isFetching}
                  onClick={() => setLimit((current) => current + pageSize)}
                  variant="secondary"
                >
                  Carregar mais
                </Button>
              </div>
            ) : null}
          </div>
        </section>
        <WorkOrderDetailPanel id={selectedId} />
      </div>
    </AppShell>
  );
}

function WorkOrderTable({
  items,
  onSelect,
  selectedId
}: {
  items: readonly WorkOrderSummary[];
  onSelect: (id: string) => void;
  selectedId: string;
}): React.ReactNode {
  if (items.length === 0) {
    return <EmptyState message="Nenhuma ordem encontrada com os filtros atuais." />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase text-[#66736D]">
          <tr>
            <th className="pb-2 font-medium">Ordem</th>
            <th className="pb-2 font-medium">Cliente</th>
            <th className="pb-2 font-medium">Prioridade</th>
            <th className="pb-2 font-medium">Status</th>
            <th className="pb-2 font-medium">SLA</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E1E6E3]">
          {items.map((item) => (
            <tr
              className={item.id === selectedId ? "bg-[#EEF5F1]" : "hover:bg-[#F4F6F5]"}
              key={item.id}
            >
              <td className="py-3">
                <button
                  className="font-mono text-[#0E5F4B] underline-offset-4 hover:underline"
                  onClick={() => onSelect(item.id)}
                  type="button"
                >
                  {item.number}
                </button>
              </td>
              <td className="py-3">{item.customer}</td>
              <td className="py-3">{item.priority}</td>
              <td className="py-3">{item.status}</td>
              <td className="py-3 font-mono">{formatHour(item.slaDueAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WorkOrderDetailPanel({ id }: { id: string }): React.ReactNode {
  const queryClient = useQueryClient();
  const [auditAction, setAuditAction] = useState("");
  const [auditActorUserId, setAuditActorUserId] = useState("");
  const [auditFrom, setAuditFrom] = useState("");
  const [auditLimit, setAuditLimit] = useState("20");
  const [auditTo, setAuditTo] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [signerName, setSignerName] = useState("");
  const [signatureAttachmentId, setSignatureAttachmentId] = useState("");
  const [attachmentFile, setAttachmentFile] = useState<File | undefined>(undefined);
  const [attachmentKind, setAttachmentKind] = useState<"photo" | "document" | "signature">("photo");
  const [uploadProgress, setUploadProgress] = useState<number | undefined>(undefined);
  const detailQuery = useQuery({
    enabled: Boolean(id),
    queryFn: () => fetchWorkOrderDetail(id),
    queryKey: ["work-order-detail", id]
  });
  const auditQuery = useQuery({
    enabled: Boolean(id),
    queryFn: () => fetchWorkOrderAudit({
      action: auditAction,
      actorUserId: auditActorUserId,
      from: auditFrom,
      id,
      limit: auditLimit,
      to: auditTo
    }),
    queryKey: ["work-order-audit", id, auditAction, auditActorUserId, auditFrom, auditLimit, auditTo]
  });
  const statusMutation = useMutation({
    mutationFn: (status: string) => updateWorkOrderStatus(id, status),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["work-orders"] }),
        queryClient.invalidateQueries({ queryKey: ["work-order-detail", id] }),
        queryClient.invalidateQueries({ queryKey: ["work-order-audit", id] })
      ]);
    }
  });
  const checklistMutation = useMutation({
    mutationFn: (answers: Record<string, unknown>) => updateWorkOrderChecklist(id, answers),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["work-order-detail", id] });
      await queryClient.invalidateQueries({ queryKey: ["work-order-audit", id] });
    }
  });
  const noteMutation = useMutation({
    mutationFn: (body: string) => addWorkOrderNote(id, body),
    onSuccess: async () => {
      setNoteBody("");
      await queryClient.invalidateQueries({ queryKey: ["work-order-detail", id] });
      await queryClient.invalidateQueries({ queryKey: ["work-order-audit", id] });
    }
  });
  const signatureMutation = useMutation({
    mutationFn: () => addWorkOrderSignature(id, { attachmentId: signatureAttachmentId, signerName }),
    onSuccess: async () => {
      setSignerName("");
      setSignatureAttachmentId("");
      await queryClient.invalidateQueries({ queryKey: ["work-order-detail", id] });
      await queryClient.invalidateQueries({ queryKey: ["work-order-audit", id] });
    }
  });
  const attachmentMutation = useMutation({
    mutationFn: () =>
      uploadWorkOrderAttachment(id, { file: attachmentFile!, kind: attachmentKind }, setUploadProgress),
    onError: () => {
      setUploadProgress(undefined);
    },
    onSuccess: async () => {
      setAttachmentFile(undefined);
      setUploadProgress(undefined);
      await queryClient.invalidateQueries({ queryKey: ["work-order-detail", id] });
      await queryClient.invalidateQueries({ queryKey: ["work-order-audit", id] });
    }
  });
  const revokeAttachmentMutation = useMutation({
    mutationFn: (attachmentId: string) => revokeWorkOrderAttachment(id, attachmentId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["work-order-detail", id] });
      await queryClient.invalidateQueries({ queryKey: ["work-order-audit", id] });
    }
  });

  if (detailQuery.isLoading) {
    return <Panel title="Detalhe"><LoadingState message="Carregando ordem selecionada..." /></Panel>;
  }

  if (detailQuery.isError) {
    return (
      <Panel title="Detalhe">
        <ErrorState message="Não foi possível carregar a ordem." onRetry={() => void detailQuery.refetch()} />
      </Panel>
    );
  }

  if (!detailQuery.data) {
    return <Panel title="Detalhe"><EmptyState message="Selecione uma ordem para ver os detalhes." /></Panel>;
  }

  const detail = detailQuery.data;

  return (
    <Panel title={`${detail.number} · ${detail.title}`}>
      <div className="space-y-5">
        <div>
          <p className="text-sm text-[#66736D]">{detail.description}</p>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <Metric label="Cliente" value={detail.customer} />
            <Metric label="Local" value={detail.site} />
            <Metric label="Técnico" value={detail.technician ?? "Não atribuído"} />
            <Metric label="SLA" value={formatHour(detail.slaDueAt)} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            disabled={statusMutation.isPending}
            onClick={() => statusMutation.mutate(nextStatus(detail.status))}
            variant="primary"
          >
            Avançar status
          </Button>
          {statusMutation.isError ? <span className="self-center text-sm text-[#B42318]">Transição bloqueada.</span> : null}
        </div>
        <DetailSection title="Checklist">
          {detail.checklist.map((item) => (
            <div className="flex items-center justify-between gap-3 text-sm" key={item.id}>
              <span className="flex-1">
                {item.label}
                {item.isRequired ? <span className="ml-1 text-[#B42318]">*</span> : null}
                {item.completed ? <span className="ml-2 text-xs text-[#0E6F4F]">preenchido</span> : null}
              </span>
              <ChecklistFieldControl
                detail={detail}
                disabled={checklistMutation.isPending}
                item={item}
                onSubmit={(answers) => checklistMutation.mutate(answers)}
              />
            </div>
          ))}
          {checklistMutation.isError ? (
            <p className="text-sm text-[#B42318]">{checklistMutation.error.message}</p>
          ) : null}
        </DetailSection>
        <DetailSection title="Linha do tempo">
          {detail.timeline.map((item) => (
            <div className="border-l-2 border-[#C7D0CB] pl-3 text-sm" key={item.id}>
              <p className="font-medium">{item.title}</p>
              <p className="text-[#66736D]">{item.description}</p>
              <p className="mt-1 font-mono text-xs text-[#66736D]">{formatHour(item.occurredAt)}</p>
            </div>
          ))}
        </DetailSection>
        <DetailSection title="Anexos">
          {detail.attachments.length === 0 ? <EmptyState message="Nenhum anexo registrado." /> : detail.attachments.map((item) => (
            <div className="flex items-center justify-between gap-3 rounded-md border border-[#D8DEDA] bg-[#F9FAF9] p-3 text-sm" key={item.id}>
              <div>
                <p className="font-medium">{item.fileName}</p>
                <p className="text-xs text-[#66736D]">
                  {item.revokedAt
                    ? `Revogado em ${formatHour(item.revokedAt)}`
                    : `${item.kind} · expira ${item.signedUrlExpiresAt ? formatHour(item.signedUrlExpiresAt) : "--:--"}`}
                </p>
              </div>
              <div className="flex gap-2">
                {item.signedUrl ? (
                  <a
                    className="rounded-md border border-[#C7D0CB] bg-white px-3 py-2 text-sm font-medium text-[#151A18] hover:bg-[#F4F6F5]"
                    href={`${apiBaseUrl()}${item.signedUrl}`}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Abrir
                  </a>
                ) : null}
                {!item.revokedAt ? (
                  <Button
                    disabled={revokeAttachmentMutation.isPending}
                    onClick={() => revokeAttachmentMutation.mutate(item.id)}
                    variant="secondary"
                  >
                    Revogar
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (attachmentFile) {
                attachmentMutation.mutate();
              }
            }}
          >
            <input
              accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
              aria-label="Selecionar arquivo para anexar"
              className="text-sm"
              onChange={(event) => setAttachmentFile(event.target.files?.[0])}
              type="file"
            />
            <select
              aria-label="Tipo do anexo"
              className="h-9 rounded-md border border-[#C7D0CB] bg-white px-3 text-sm outline-none focus:border-[#0E5F4B]"
              onChange={(event) => setAttachmentKind(event.target.value as "photo" | "document" | "signature")}
              value={attachmentKind}
            >
              <option value="photo">Foto</option>
              <option value="document">Documento</option>
              <option value="signature">Assinatura</option>
            </select>
            <Button disabled={attachmentMutation.isPending || !attachmentFile} type="submit" variant="secondary">
              {attachmentMutation.isPending ? "Enviando..." : "Enviar anexo"}
            </Button>
            {attachmentMutation.isPending && uploadProgress !== undefined ? (
              <div className="h-2 w-full min-w-40 flex-1 rounded-full bg-[#E1E6E3]" role="progressbar" aria-valuenow={uploadProgress} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-2 rounded-full bg-[#0E5F4B] transition-all" style={{ width: `${uploadProgress}%` }} />
              </div>
            ) : null}
            {attachmentMutation.isError ? (
              <p className="w-full text-sm text-[#B42318]">{attachmentMutation.error.message}</p>
            ) : null}
          </form>
        </DetailSection>
        <DetailSection title="Assinatura">
          <form
            className="flex flex-col gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (signerName.trim() && signatureAttachmentId) {
                signatureMutation.mutate();
              }
            }}
          >
            <input
              className="h-9 rounded-md border border-[#C7D0CB] bg-white px-3 text-sm outline-none focus:border-[#0E5F4B]"
              onChange={(event) => setSignerName(event.target.value)}
              placeholder="Nome de quem assina"
              value={signerName}
            />
            <select
              aria-label="Filtrar auditoria por ação"
              className="h-9 rounded-md border border-[#C7D0CB] bg-white px-3 text-sm outline-none focus:border-[#0E5F4B]"
              onChange={(event) => setSignatureAttachmentId(event.target.value)}
              value={signatureAttachmentId}
            >
              <option value="">Selecione o anexo como evidência</option>
              {detail.attachments.map((attachment) => (
                <option key={attachment.id} value={attachment.id}>{attachment.fileName}</option>
              ))}
            </select>
            <div>
              <Button
                disabled={signatureMutation.isPending || !signerName.trim() || !signatureAttachmentId}
                type="submit"
                variant="secondary"
              >
                Registrar assinatura
              </Button>
            </div>
            {signatureMutation.isError ? (
              <p className="text-sm text-[#B42318]">{signatureMutation.error.message}</p>
            ) : null}
          </form>
          {detail.signatures.length === 0 ? (
            <EmptyState message="Nenhuma assinatura registrada." />
          ) : (
            detail.signatures.map((signature) => (
              <div className="rounded-md bg-[#F4F6F5] p-3 text-sm" key={signature.id}>
                <p className="font-medium">{signature.signerName}</p>
                <p className="text-xs text-[#66736D]">{formatHour(signature.signedAt)}</p>
              </div>
            ))
          )}
        </DetailSection>
        <DetailSection title="Notas">
          <form
            className="flex flex-col gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const trimmed = noteBody.trim();
              if (trimmed) {
                noteMutation.mutate(trimmed);
              }
            }}
          >
            <textarea
              className="min-h-20 resize-y rounded-md border border-[#C7D0CB] bg-white px-3 py-2 text-sm outline-none focus:border-[#0E5F4B]"
              onChange={(event) => setNoteBody(event.target.value)}
              placeholder="Adicionar nota operacional"
              value={noteBody}
            />
            <div>
              <Button disabled={noteMutation.isPending || !noteBody.trim()} type="submit" variant="secondary">Adicionar nota</Button>
            </div>
            {noteMutation.isError ? <p className="text-sm text-[#B42318]">Não foi possível adicionar a nota.</p> : null}
          </form>
          {detail.notes.map((item) => (
            <blockquote className="rounded-md bg-[#F4F6F5] p-3 text-sm" key={item.id}>
              <p>{item.body}</p>
              <footer className="mt-2 text-xs text-[#66736D]">{item.author}</footer>
            </blockquote>
          ))}
        </DetailSection>
        <DetailSection title="Auditoria">
          <div className="mb-3 grid grid-cols-2 gap-2">
            <select
              className="h-9 rounded-md border border-[#C7D0CB] bg-white px-3 text-sm outline-none focus:border-[#0E5F4B]"
              onChange={(event) => setAuditAction(event.target.value)}
              value={auditAction}
            >
              <option value="">Todas as ações</option>
              <option value="assign">Atribuição</option>
              <option value="status_change">Mudança de status</option>
              <option value="update">Atualização</option>
            </select>
            <input
              aria-label="Filtrar auditoria por ID do ator"
              className="h-9 rounded-md border border-[#C7D0CB] bg-white px-3 text-sm outline-none focus:border-[#0E5F4B]"
              onChange={(event) => setAuditActorUserId(event.target.value)}
              placeholder="ID do ator"
              value={auditActorUserId}
            />
            <input
              aria-label="Início do período de auditoria"
              className="h-9 rounded-md border border-[#C7D0CB] bg-white px-3 text-sm outline-none focus:border-[#0E5F4B]"
              onChange={(event) => setAuditFrom(event.target.value)}
              type="date"
              value={auditFrom}
            />
            <input
              aria-label="Fim do período de auditoria"
              className="h-9 rounded-md border border-[#C7D0CB] bg-white px-3 text-sm outline-none focus:border-[#0E5F4B]"
              onChange={(event) => setAuditTo(event.target.value)}
              type="date"
              value={auditTo}
            />
            <select
              aria-label="Limite de eventos de auditoria"
              className="h-9 rounded-md border border-[#C7D0CB] bg-white px-3 text-sm outline-none focus:border-[#0E5F4B]"
              onChange={(event) => setAuditLimit(event.target.value)}
              value={auditLimit}
            >
              <option value="10">10 eventos</option>
              <option value="20">20 eventos</option>
              <option value="50">50 eventos</option>
            </select>
          </div>
          <AuditState query={auditQuery} />
        </DetailSection>
      </div>
    </Panel>
  );
}

function withChecklistAnswer(detail: WorkOrderDetail, key: string, value: unknown): Record<string, unknown> {
  const snapshot = Object.fromEntries(detail.checklist.map((item) => [item.answerKey ?? item.id, item.value]));
  return { ...snapshot, [key]: value };
}

function ChecklistFieldControl({
  detail,
  disabled,
  item,
  onSubmit
}: {
  detail: WorkOrderDetail;
  disabled: boolean;
  item: WorkOrderChecklistItem;
  onSubmit: (answers: Record<string, unknown>) => void;
}): React.ReactNode {
  const key = item.answerKey ?? item.id;
  const fieldClassName = "h-9 min-w-40 rounded-md border border-[#C7D0CB] bg-white px-3 text-sm outline-none focus:border-[#0E5F4B]";
  const resetKey = `${item.id}-${String(item.value)}`;

  if (item.type === "pass_fail" || item.type === "checkbox") {
    return (
      <input
        checked={Boolean(item.value)}
        disabled={disabled}
        onChange={(event) => onSubmit(withChecklistAnswer(detail, key, event.target.checked))}
        type="checkbox"
      />
    );
  }

  if (item.type === "number") {
    return (
      <input
        className={fieldClassName}
        defaultValue={item.value === null || item.value === undefined ? "" : String(item.value)}
        disabled={disabled}
        key={resetKey}
        onBlur={(event) => {
          const raw = event.target.value.trim();
          onSubmit(withChecklistAnswer(detail, key, raw === "" ? null : Number(raw)));
        }}
        type="number"
      />
    );
  }

  if (item.type === "select" || item.type === "photo" || item.type === "signature") {
    const options =
      item.type === "select"
        ? (item.options ?? []).map((option) => ({ label: option, value: option }))
        : detail.attachments.map((attachment) => ({ label: attachment.fileName, value: attachment.id }));
    const placeholder = item.type === "select" ? "Selecione" : "Selecione um anexo";

    return (
      <select
        className={fieldClassName}
        defaultValue={item.value === null || item.value === undefined ? "" : String(item.value)}
        disabled={disabled}
        key={resetKey}
        onChange={(event) => onSubmit(withChecklistAnswer(detail, key, event.target.value || null))}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    );
  }

  return (
    <input
      className={fieldClassName}
      defaultValue={item.value === null || item.value === undefined ? "" : String(item.value)}
      disabled={disabled}
      key={resetKey}
      onBlur={(event) => onSubmit(withChecklistAnswer(detail, key, event.target.value.trim() || null))}
      type="text"
    />
  );
}

function ListState({
  children,
  onRetry,
  query
}: {
  children: (data: WorkOrderListResponse) => React.ReactNode;
  onRetry: () => void;
  query: ReturnType<typeof useQuery<WorkOrderListResponse, Error>>;
}): React.ReactNode {
  if (query.isLoading) {
    return <LoadingState message="Carregando ordens..." />;
  }

  if (query.isError) {
    return <ErrorState message="Não foi possível carregar as ordens." onRetry={onRetry} />;
  }

  if (!query.data) {
    return <EmptyState message="Nenhum dado disponível." />;
  }

  return children(query.data);
}

function AuditState({
  query
}: {
  query: ReturnType<typeof useQuery<readonly WorkOrderAuditItem[], Error>>;
}): React.ReactNode {
  if (query.isLoading) {
    return <LoadingState message="Carregando auditoria..." />;
  }

  if (query.isError) {
    return <ErrorState message="Não foi possível carregar a auditoria." onRetry={() => void query.refetch()} />;
  }

  if (!query.data || query.data.length === 0) {
    return <EmptyState message="Nenhum evento de auditoria registrado." />;
  }

  return (
    <div className="space-y-2">
      {query.data.map((item) => (
        <div className="rounded-md border border-[#D8DEDA] bg-[#F9FAF9] p-3 text-sm" key={item.id}>
          <div className="flex items-center justify-between gap-3">
            <p className="font-medium">{formatAuditAction(item.action)}</p>
            <p className="font-mono text-xs text-[#66736D]">{formatHour(item.occurredAt)}</p>
          </div>
          <p className="mt-1 text-xs text-[#66736D]">{item.actor ?? "Sistema"} · {item.resourceType}</p>
          <p className="mt-2 break-words font-mono text-xs text-[#4F5A55]">{formatAuditDelta(item)}</p>
        </div>
      ))}
    </div>
  );
}

function Panel({ children, title }: { children: React.ReactNode; title: string }): React.ReactNode {
  return (
    <section className="rounded-lg border border-[#D8DEDA] bg-[#FBFCFB] p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function DetailSection({ children, title }: { children: React.ReactNode; title: string }): React.ReactNode {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase text-[#66736D]">{title}</h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }): React.ReactNode {
  return (
    <div className="rounded-md border border-[#D8DEDA] bg-[#F9FAF9] p-3">
      <p className="text-xs text-[#66736D]">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}

function LoadingState({ message }: { message: string }): React.ReactNode {
  return <div className="rounded-md border border-[#D8DEDA] bg-[#F9FAF9] p-4 text-sm text-[#66736D]">{message}</div>;
}

function EmptyState({ message }: { message: string }): React.ReactNode {
  return <div className="rounded-md border border-[#D8DEDA] bg-[#F9FAF9] p-4 text-sm text-[#66736D]">{message}</div>;
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }): React.ReactNode {
  return (
    <div className="rounded-md border border-[#F4B5A9] bg-[#FFF5F3] p-4 text-sm text-[#8A1F11]">
      {message}
      <div className="mt-3">
        <Button onClick={onRetry} variant="secondary">Tentar novamente</Button>
      </div>
    </div>
  );
}

function formatHour(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo"
  }).format(new Date(value));
}

function nextStatus(status: string): string {
  if (status === "scheduled") {
    return "en_route";
  }

  if (status === "en_route") {
    return "on_site";
  }

  if (status === "on_site") {
    return "completed";
  }

  return "scheduled";
}

function formatAuditAction(action: string): string {
  const labels: Record<string, string> = {
    assign: "Atribuição",
    status_change: "Mudança de status",
    update: "Atualização"
  };

  return labels[action] ?? action;
}

function formatAuditDelta(item: WorkOrderAuditItem): string {
  const source = item.after ?? item.before;

  if (!source || Object.keys(source).length === 0) {
    return "Sem detalhes adicionais.";
  }

  return JSON.stringify(source);
}

async function fetchWorkOrders(input: { limit: number; search: string; status: string }): Promise<WorkOrderListResponse> {
  const params = new URLSearchParams({ limit: String(input.limit), offset: "0" });
  if (input.search) {
    params.set("search", input.search);
  }
  if (input.status) {
    params.set("status", input.status);
  }

  const response = await apiFetch(`/work-orders?${params.toString()}`);

  if (!response.ok) {
    throw new Error("Falha ao carregar ordens de serviço.");
  }

  return response.json() as Promise<WorkOrderListResponse>;
}

async function fetchWorkOrderDetail(id: string): Promise<WorkOrderDetail> {
  const response = await apiFetch(`/work-orders/${id}`);

  if (!response.ok) {
    throw new Error("Falha ao carregar detalhe da ordem.");
  }

  return response.json() as Promise<WorkOrderDetail>;
}

async function updateWorkOrderStatus(id: string, status: string): Promise<WorkOrderDetail> {
  const response = await apiFetch(`/work-orders/${id}/status`, {
    body: JSON.stringify({ status }),
    method: "PATCH"
  });

  if (!response.ok) {
    throw new Error("Falha ao alterar status da ordem.");
  }

  return response.json() as Promise<WorkOrderDetail>;
}

async function fetchWorkOrderAudit(input: {
  action: string;
  actorUserId: string;
  from: string;
  id: string;
  limit: string;
  to: string;
}): Promise<readonly WorkOrderAuditItem[]> {
  const params = new URLSearchParams({ limit: input.limit });
  if (input.action) {
    params.set("action", input.action);
  }
  if (input.actorUserId) {
    params.set("actorUserId", input.actorUserId);
  }
  if (input.from) {
    params.set("from", `${input.from}T00:00:00.000Z`);
  }
  if (input.to) {
    params.set("to", `${input.to}T23:59:59.999Z`);
  }

  const response = await apiFetch(`/work-orders/${input.id}/audit?${params.toString()}`);

  if (!response.ok) {
    throw new Error("Falha ao carregar auditoria da ordem.");
  }

  return response.json() as Promise<readonly WorkOrderAuditItem[]>;
}

async function updateWorkOrderChecklist(id: string, answers: Record<string, unknown>): Promise<WorkOrderDetail> {
  const response = await apiFetch(`/work-orders/${id}/checklist`, {
    body: JSON.stringify({ answers }),
    method: "PATCH"
  });

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, "Falha ao atualizar checklist."));
  }

  return response.json() as Promise<WorkOrderDetail>;
}

async function addWorkOrderSignature(
  id: string,
  input: { signerName: string; attachmentId: string }
): Promise<WorkOrderDetail> {
  const response = await apiFetch(`/work-orders/${id}/signature`, {
    body: JSON.stringify(input),
    method: "POST"
  });

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, "Falha ao registrar assinatura."));
  }

  return response.json() as Promise<WorkOrderDetail>;
}

/**
 * Usa XMLHttpRequest (não `fetch`) porque só o XHR expõe progresso de upload
 * via `upload.onprogress` — necessário para a barra de progresso na UI.
 */
async function uploadWorkOrderAttachment(
  id: string,
  input: { file: File; kind: "photo" | "document" | "signature" },
  onProgress: (percent: number) => void
): Promise<WorkOrderDetail> {
  const formData = new FormData();
  formData.append("file", input.file);
  formData.append("kind", input.kind);

  return new Promise<WorkOrderDetail>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${apiBaseUrl()}/work-orders/${id}/attachments`);

    const session = getStoredSession();
    if (session) {
      xhr.setRequestHeader("authorization", `Bearer ${session.token}`);
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText) as WorkOrderDetail);
        return;
      }

      let message = "Falha ao enviar anexo.";
      try {
        message = (JSON.parse(xhr.responseText) as { message?: string }).message ?? message;
      } catch {
        // corpo da resposta não era JSON; mantém a mensagem padrão.
      }
      reject(new Error(message));
    };

    xhr.onerror = () => reject(new Error("Falha ao enviar anexo."));

    xhr.send(formData);
  });
}

async function revokeWorkOrderAttachment(id: string, attachmentId: string): Promise<WorkOrderDetail> {
  const response = await apiFetch(`/work-orders/${id}/attachments/${attachmentId}/revoke`, {
    method: "POST"
  });

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, "Falha ao revogar anexo."));
  }

  return response.json() as Promise<WorkOrderDetail>;
}

async function extractErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string };
    return body.message ?? fallback;
  } catch {
    return fallback;
  }
}

async function addWorkOrderNote(id: string, body: string): Promise<WorkOrderDetail> {
  const response = await apiFetch(`/work-orders/${id}/notes`, {
    body: JSON.stringify({ body }),
    method: "POST"
  });

  if (!response.ok) {
    throw new Error("Falha ao adicionar nota.");
  }

  return response.json() as Promise<WorkOrderDetail>;
}

