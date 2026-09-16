"use client";

import type {
  NotificationItem,
  NotificationListResponse,
  NotificationPreference,
  NotificationPreferencesResponse,
  NotificationStatus
} from "@fieldops/types";
import { AppShell, Button } from "@fieldops/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { apiFetch } from "../../lib/api-client";
import { useRequireAuth } from "../../lib/use-require-auth";

const statusOptions: readonly { label: string; value: NotificationStatus | "" }[] = [
  { label: "Todas", value: "" },
  { label: "Não lidas", value: "unread" },
  { label: "Lidas", value: "read" },
  { label: "Arquivadas", value: "archived" }
];

export default function NotificationsPage(): React.ReactNode {
  const { logout, session } = useRequireAuth();
  const [status, setStatus] = useState<NotificationStatus | "">("");
  const listQuery = useQuery({
    enabled: Boolean(session),
    queryFn: () => fetchNotifications({ status }),
    queryKey: ["notifications", status]
  });
  const preferencesQuery = useQuery({
    enabled: Boolean(session),
    queryFn: fetchNotificationPreferences,
    queryKey: ["notification-preferences"]
  });

  if (!session) {
    return null;
  }

  return (
    <AppShell
      activeHref="/notificacoes"
      headerAction={
        <UnreadBadge count={listQuery.data?.unreadCount ?? 0} />
      }
      headerEyebrow="Central operacional"
      headerTitle="Notificações"
      onLogout={() => void logout()}
      userLabel={session.userName}
    >
      <div className="grid flex-1 gap-5 p-6 xl:grid-cols-[1fr_360px] max-sm:p-4">
        <section className="rounded-lg border border-[#D8DEDA] bg-[#FBFCFB] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Fila de eventos</h2>
              <p className="mt-1 text-sm text-[#66736D]">Alertas de SLA, atribuições e sincronização.</p>
            </div>
            <select
              aria-label="Filtrar notificações por status"
              className="h-9 rounded-md border border-[#C7D0CB] bg-white px-3 text-sm outline-none focus:border-[#0E5F4B]"
              onChange={(event) => setStatus(event.target.value as NotificationStatus | "")}
              value={status}
            >
              {statusOptions.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </div>
          <div className="mt-4">
            <NotificationsState query={listQuery} />
          </div>
        </section>
        <section className="rounded-lg border border-[#D8DEDA] bg-[#FBFCFB] p-4">
          <h2 className="text-sm font-semibold">Preferências</h2>
          <div className="mt-4">
            <PreferencesState query={preferencesQuery} />
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function UnreadBadge({ count }: { count: number }): React.ReactNode {
  return (
    <span className="rounded-full bg-[#E4F3EC] px-3 py-1 text-xs font-semibold text-[#0E6F4F]">
      {count} não lidas
    </span>
  );
}

function NotificationsState({
  query
}: {
  query: ReturnType<typeof useQuery<NotificationListResponse, Error>>;
}): React.ReactNode {
  if (query.isLoading) {
    return <StateBox message="Carregando notificações..." />;
  }

  if (query.isError) {
    return <ErrorBox message="Não foi possível carregar as notificações." onRetry={() => void query.refetch()} />;
  }

  if (!query.data || query.data.items.length === 0) {
    return <StateBox message="Nenhuma notificação nesta fila." />;
  }

  return (
    <div className="space-y-3">
      {query.data.items.map((item) => (
        <NotificationCard item={item} key={item.id} />
      ))}
    </div>
  );
}

function NotificationCard({ item }: { item: NotificationItem }): React.ReactNode {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (status: NotificationStatus) => updateNotificationStatus(item.id, status),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
  });

  return (
    <article className="grid grid-cols-[4px_1fr] overflow-hidden rounded-lg border border-[#D8DEDA] bg-[#F9FAF9]">
      <div className={item.status === "unread" ? "bg-[#B85C38]" : "bg-[#C7D0CB]"} />
      <div className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-[#66736D]">{formatType(item.type)}</p>
            <h3 className="mt-1 text-sm font-semibold">{item.title}</h3>
          </div>
          <span className="font-mono text-xs text-[#66736D]">{formatDateTime(item.createdAt)}</span>
        </div>
        <p className="mt-2 text-sm leading-5 text-[#4F5A55]">{item.body}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {item.status !== "read" ? (
            <Button
              disabled={mutation.isPending}
              onClick={() => mutation.mutate("read")}
              variant="secondary"
            >
              Marcar lida
            </Button>
          ) : null}
          {item.status !== "archived" ? (
            <Button
              disabled={mutation.isPending}
              onClick={() => mutation.mutate("archived")}
              variant="secondary"
            >
              Arquivar
            </Button>
          ) : null}
        </div>
        {mutation.isError ? <p className="mt-3 text-sm text-[#B42318]">Não foi possível atualizar a notificação.</p> : null}
      </div>
    </article>
  );
}

function PreferencesState({
  query
}: {
  query: ReturnType<typeof useQuery<NotificationPreferencesResponse, Error>>;
}): React.ReactNode {
  if (query.isLoading) {
    return <StateBox message="Carregando preferências..." />;
  }

  if (query.isError) {
    return <ErrorBox message="Não foi possível carregar as preferências." onRetry={() => void query.refetch()} />;
  }

  if (!query.data || query.data.preferences.length === 0) {
    return <StateBox message="Nenhuma preferência configurada." />;
  }

  return (
    <div className="space-y-3">
      {query.data.preferences.map((item) => (
        <PreferenceRow allPreferences={query.data.preferences} item={item} key={item.type} />
      ))}
    </div>
  );
}

function PreferenceRow({
  allPreferences,
  item
}: {
  allPreferences: readonly NotificationPreference[];
  item: NotificationPreference;
}): React.ReactNode {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () =>
      updateNotificationPreferences(
        allPreferences.map((preference) =>
          preference.type === item.type
            ? { ...preference, enabled: !preference.enabled }
            : preference
        )
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notification-preferences"] });
    }
  });

  return (
    <div className="rounded-md border border-[#D8DEDA] bg-[#F9FAF9] p-3 text-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium">{formatType(item.type)}</p>
        <button
          aria-pressed={item.enabled}
          className={item.enabled ? "rounded-full bg-[#E4F3EC] px-3 py-1 text-xs font-semibold text-[#0E6F4F]" : "rounded-full bg-[#E9EEEB] px-3 py-1 text-xs font-semibold text-[#66736D]"}
          disabled={mutation.isPending}
          onClick={() => mutation.mutate()}
          type="button"
        >
          {item.enabled ? "Ativa" : "Pausada"}
        </button>
      </div>
      <p className="mt-2 text-xs text-[#66736D]">
        {item.channels.map(formatChannel).join(", ")}
      </p>
      {mutation.isError ? <p className="mt-2 text-xs text-[#B42318]">Não foi possível salvar.</p> : null}
    </div>
  );
}

function StateBox({ message }: { message: string }): React.ReactNode {
  return <div className="rounded-md border border-[#D8DEDA] bg-[#F9FAF9] p-4 text-sm text-[#66736D]">{message}</div>;
}

function ErrorBox({ message, onRetry }: { message: string; onRetry: () => void }): React.ReactNode {
  return (
    <div className="rounded-md border border-[#F4B5A9] bg-[#FFF5F3] p-4 text-sm text-[#8A1F11]">
      {message}
      <div className="mt-3">
        <Button onClick={onRetry} variant="secondary">Tentar novamente</Button>
      </div>
    </div>
  );
}

function formatType(type: string): string {
  const labels: Record<string, string> = {
    assignment: "Atribuição",
    sla_risk: "Risco de SLA",
    sync_conflict: "Conflito de sincronização"
  };

  return labels[type] ?? type;
}

function formatChannel(channel: string): string {
  const labels: Record<string, string> = {
    email: "E-mail",
    in_app: "Central",
    sms: "SMS"
  };

  return labels[channel] ?? channel;
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo"
  }).format(new Date(value));
}

async function fetchNotifications(input: { status: NotificationStatus | "" }): Promise<NotificationListResponse> {
  const params = new URLSearchParams({ limit: "20", offset: "0" });
  if (input.status) {
    params.set("status", input.status);
  }

  const response = await apiFetch(`/notifications?${params.toString()}`);

  if (!response.ok) {
    throw new Error("Falha ao carregar notificações.");
  }

  return response.json() as Promise<NotificationListResponse>;
}

async function fetchNotificationPreferences(): Promise<NotificationPreferencesResponse> {
  const response = await apiFetch("/notifications/preferences");

  if (!response.ok) {
    throw new Error("Falha ao carregar preferências.");
  }

  return response.json() as Promise<NotificationPreferencesResponse>;
}

async function updateNotificationStatus(id: string, status: NotificationStatus): Promise<NotificationListResponse> {
  const response = await apiFetch(`/notifications/${id}/status`, {
    body: JSON.stringify({ status }),
    method: "PATCH"
  });

  if (!response.ok) {
    throw new Error("Falha ao atualizar notificação.");
  }

  return response.json() as Promise<NotificationListResponse>;
}

async function updateNotificationPreferences(
  preferences: readonly NotificationPreference[]
): Promise<NotificationPreferencesResponse> {
  const response = await apiFetch("/notifications/preferences", {
    body: JSON.stringify({ preferences }),
    method: "PATCH"
  });

  if (!response.ok) {
    throw new Error("Falha ao atualizar preferências.");
  }

  return response.json() as Promise<NotificationPreferencesResponse>;
}
