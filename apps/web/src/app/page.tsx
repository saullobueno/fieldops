"use client";

import type {
  ActiveServiceMapItem,
  AiInsightItem,
  DashboardKpi,
  DashboardWidgetKey,
  DashboardWidgetPayload,
  DispatchPreviewItem,
  RealtimeEnvelope,
  RecentWorkOrderItem,
  SlaRiskItem,
  TechnicianUtilizationItem
} from "@fieldops/types";
import { AppShell, Button } from "@fieldops/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import { useEffect } from "react";

import { apiFetch } from "../lib/api-client";
import { MapView, type MapMarker } from "../lib/map-view";
import { RealtimeStatusBadge } from "../lib/realtime-status-badge";
import { useRealtimeStream } from "../lib/use-realtime-stream";
import { useRequireAuth } from "../lib/use-require-auth";

const widgetLimits: Record<DashboardWidgetKey, number> = {
  "active-services-map": 6,
  "ai-insights": 3,
  "dispatch-preview": 4,
  kpis: 6,
  "recent-work-orders": 5,
  "sla-risk": 4,
  "technician-utilization": 5
};

export default function HomePage(): React.ReactNode {
  const queryClient = useQueryClient();
  const { logout, session } = useRequireAuth();
  const { events, status } = useRealtimeStream(session?.organizationId ?? "", "work_order:read");

  useEffect(() => {
    if (events.length === 0) {
      return;
    }

    void queryClient.invalidateQueries({ queryKey: ["dashboard-widget"] });
  }, [events, queryClient]);

  if (!session) {
    return null;
  }

  return (
    <AppShell
      activeHref="/"
      headerAction={
        <div className="flex items-center gap-3">
          <RealtimeStatusBadge status={status} />
          <Button variant="primary">Criar</Button>
        </div>
      }
      headerEyebrow="Área de trabalho"
      headerTitle="Acme Field Services"
      onLogout={logout}
      userLabel={session.userName}
    >
      <div className="flex flex-1 flex-col gap-5 p-6 max-sm:p-4">
        <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <KpiWidget />
        </section>
        <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <DispatchPreviewWidget />
          <SlaRiskWidget />
        </section>
        <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr_0.85fr]">
          <ActiveServicesMapWidget />
          <RecentWorkOrdersWidget />
          <AiInsightsWidget />
        </section>
        <section className="grid gap-5 xl:grid-cols-[1fr_0.6fr]">
          <TechnicianUtilizationWidget />
          <RealtimeEventsPanel events={events} />
        </section>
      </div>
    </AppShell>
  );
}

function RealtimeEventsPanel({ events }: { events: readonly RealtimeEnvelope[] }): React.ReactNode {
  return (
    <Panel title="Eventos em tempo real">
      {events.length === 0 ? (
        <div className="rounded-md border border-[#D8DEDA] bg-[#F9FAF9] p-4 text-sm text-[#66736D]">
          Nenhum evento recebido ainda.
        </div>
      ) : (
        <div className="max-h-72 space-y-2 overflow-y-auto">
          {events.map((envelope) => (
            <div className="rounded-md border border-[#D8DEDA] bg-[#F9FAF9] p-3 text-sm" key={envelope.id}>
              <p className="font-medium">{describeRealtimeEvent(envelope)}</p>
              <p className="mt-1 font-mono text-xs text-[#66736D]">{formatEventTime(envelope.occurredAt)}</p>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function describeRealtimeEvent(envelope: RealtimeEnvelope): string {
  switch (envelope.event.type) {
    case "work_order_status_changed":
      return `${envelope.event.data.workOrderNumber}: ${envelope.event.data.fromStatus} → ${envelope.event.data.toStatus}`;
    case "assignment_created":
      return `${envelope.event.data.workOrderNumber} atribuída a ${envelope.event.data.technicianName}`;
    case "technician_location_updated":
      return `${envelope.event.data.technicianName} atualizou a localização`;
    case "notification_created":
      return envelope.event.data.title;
  }
}

function formatEventTime(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "America/Sao_Paulo"
  }).format(new Date(value));
}

function KpiWidget(): React.ReactNode {
  const query = useDashboardWidget("kpis");

  return (
    <WidgetState query={query} emptyMessage="Nenhum KPI disponível." title="KPIs">
      {(payload) =>
        payload.items.map((item) => <KpiCard item={item} key={item.label} />)
      }
    </WidgetState>
  );
}

function KpiCard({ item }: { item: DashboardKpi }): React.ReactNode {
  const toneClass = {
    danger: "text-[#B42318]",
    good: "text-[#0E6F4F]",
    neutral: "text-[#36413C]",
    warning: "text-[#9A5B00]"
  }[item.tone];

  return (
    <article className="min-h-28 rounded-lg border border-[#D8DEDA] bg-[#FBFCFB] p-4">
      <p className="text-xs font-medium text-[#66736D]">{item.label}</p>
      <div className="mt-3 text-2xl font-semibold">{item.value}</div>
      <p className={`mt-2 text-xs font-medium ${toneClass}`}>{item.trend}</p>
    </article>
  );
}

function DispatchPreviewWidget(): React.ReactNode {
  const query = useDashboardWidget("dispatch-preview");

  return (
    <Panel title="Prévia do despacho">
      <WidgetState query={query} emptyMessage="Sem serviços no despacho." title="Prévia do despacho">
        {(payload) => (
          <div className="divide-y divide-[#E1E6E3]">
            {payload.items.map((item) => (
              <DispatchRow item={item} key={item.workOrderNumber} />
            ))}
          </div>
        )}
      </WidgetState>
    </Panel>
  );
}

function DispatchRow({ item }: { item: DispatchPreviewItem }): React.ReactNode {
  return (
    <div className="grid grid-cols-[64px_1fr_auto] gap-3 py-3 text-sm max-sm:grid-cols-1">
      <span className="font-mono text-[#0E5F4B]">{item.time}</span>
      <div>
        <p className="font-medium">
          {item.workOrderNumber} · {item.title}
        </p>
        <p className="text-[#66736D]">{item.technician}</p>
      </div>
      <span className="text-xs font-medium text-[#36413C]">{item.status}</span>
    </div>
  );
}

function SlaRiskWidget(): React.ReactNode {
  const query = useDashboardWidget("sla-risk");

  return (
    <Panel title="Radar de SLA">
      <WidgetState query={query} emptyMessage="Nenhum SLA em risco." title="Radar de SLA">
        {(payload) => (
          <div className="space-y-3">
            {payload.items.map((item) => <SlaRiskRow item={item} key={item.workOrderNumber} />)}
          </div>
        )}
      </WidgetState>
    </Panel>
  );
}

function SlaRiskRow({ item }: { item: SlaRiskItem }): React.ReactNode {
  const riskClass = item.risk === "alto" ? "bg-[#FDE8E4] text-[#B42318]" : "bg-[#FFF4D6] text-[#8A4B00]";

  return (
    <div className="rounded-md border border-[#D8DEDA] bg-[#F9FAF9] p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium">{item.workOrderNumber}</p>
        <span className={`rounded px-2 py-1 text-xs font-semibold ${riskClass}`}>{item.risk}</span>
      </div>
      <p className="mt-1 text-sm text-[#66736D]">{item.customer}</p>
      <p className="mt-2 font-mono text-sm text-[#151A18]">vence {item.dueAt}</p>
    </div>
  );
}

function ActiveServicesMapWidget(): React.ReactNode {
  const query = useDashboardWidget("active-services-map");

  return (
    <Panel title="Mapa ativo">
      <WidgetState query={query} emptyMessage="Sem serviços ativos no mapa." title="Mapa ativo">
        {(payload) => <MapPreview items={payload.items} />}
      </WidgetState>
    </Panel>
  );
}

function MapPreview({ items }: { items: readonly ActiveServiceMapItem[] }): React.ReactNode {
  const markers: readonly MapMarker[] = items.map((item) => ({
    id: item.workOrderNumber,
    label: item.workOrderNumber,
    latitude: item.latitude,
    longitude: item.longitude,
    tone: item.status === "requires_review" ? "risk" : "default"
  }));

  return <MapView className="h-64 w-full overflow-hidden rounded-lg border border-[#C7D0CB]" markers={markers} />;
}

function RecentWorkOrdersWidget(): React.ReactNode {
  const query = useDashboardWidget("recent-work-orders");

  return (
    <Panel title="Ordens recentes">
      <WidgetState query={query} emptyMessage="Nenhuma ordem recente." title="Ordens recentes">
        {(payload) => (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-[#66736D]">
                <tr>
                  <th className="pb-2 font-medium">Ordem</th>
                  <th className="pb-2 font-medium">Cliente</th>
                  <th className="pb-2 font-medium">Prioridade</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E1E6E3]">
                {payload.items.map((item) => <RecentWorkOrderRow item={item} key={item.workOrderNumber} />)}
              </tbody>
            </table>
          </div>
        )}
      </WidgetState>
    </Panel>
  );
}

function RecentWorkOrderRow({ item }: { item: RecentWorkOrderItem }): React.ReactNode {
  return (
    <tr>
      <td className="py-3 font-mono text-[#0E5F4B]">{item.workOrderNumber}</td>
      <td className="py-3">{item.customer}</td>
      <td className="py-3">{item.priority}</td>
      <td className="py-3 text-[#66736D]">{item.status}</td>
    </tr>
  );
}

function AiInsightsWidget(): React.ReactNode {
  const query = useDashboardWidget("ai-insights");

  return (
    <Panel title="Insights operacionais">
      <WidgetState query={query} emptyMessage="Sem insights no momento." title="Insights operacionais">
        {(payload) => (
          <div className="space-y-3">
            {payload.items.map((item) => <AiInsight item={item} key={item.title} />)}
          </div>
        )}
      </WidgetState>
    </Panel>
  );
}

function AiInsight({ item }: { item: AiInsightItem }): React.ReactNode {
  return (
    <article className="rounded-md border border-[#D8DEDA] bg-[#F9FAF9] p-3">
      <p className="text-xs font-semibold uppercase text-[#0E5F4B]">{item.severity}</p>
      <h3 className="mt-1 text-sm font-semibold">{item.title}</h3>
      <p className="mt-2 text-sm leading-5 text-[#66736D]">{item.evidence}</p>
    </article>
  );
}

function TechnicianUtilizationWidget(): React.ReactNode {
  const query = useDashboardWidget("technician-utilization");

  return (
    <Panel title="Utilização dos técnicos">
      <WidgetState query={query} emptyMessage="Sem técnicos ativos." title="Utilização dos técnicos">
        {(payload) => (
          <div className="grid gap-3 md:grid-cols-3">
            {payload.items.map((item) => <TechnicianUtilization item={item} key={item.technician} />)}
          </div>
        )}
      </WidgetState>
    </Panel>
  );
}

function TechnicianUtilization({ item }: { item: TechnicianUtilizationItem }): React.ReactNode {
  return (
    <article className="rounded-md border border-[#D8DEDA] bg-[#F9FAF9] p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{item.technician}</h3>
        <span className="font-mono text-sm">{item.utilizationPercent}%</span>
      </div>
      <div className="mt-3 h-2 rounded bg-[#E1E6E3]">
        <div
          className="h-2 rounded bg-[#0E5F4B]"
          style={{ width: `${item.utilizationPercent}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-[#66736D]">{item.activeWorkOrders} ordens ativas</p>
    </article>
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

function WidgetState<TPayload extends DashboardWidgetPayload>({
  children,
  emptyMessage,
  query,
  title
}: {
  children: (payload: TPayload) => React.ReactNode;
  emptyMessage: string;
  query: UseQueryResult<TPayload, Error>;
  title: string;
}): React.ReactNode {
  if (query.isLoading) {
    return <div className="rounded-md border border-[#D8DEDA] bg-[#F9FAF9] p-4 text-sm text-[#66736D]">Carregando {title.toLowerCase()}...</div>;
  }

  if (query.isError) {
    return (
      <div className="rounded-md border border-[#F4B5A9] bg-[#FFF5F3] p-4 text-sm text-[#8A1F11]">
        Não foi possível carregar {title.toLowerCase()}.
        <div className="mt-3">
          <Button onClick={() => void query.refetch()} variant="secondary">Tentar novamente</Button>
        </div>
      </div>
    );
  }

  if (!query.data || query.data.items.length === 0) {
    return <div className="rounded-md border border-[#D8DEDA] bg-[#F9FAF9] p-4 text-sm text-[#66736D]">{emptyMessage}</div>;
  }

  return children(query.data);
}

function useDashboardWidget<TWidget extends DashboardWidgetKey>(
  widget: TWidget
): UseQueryResult<Extract<DashboardWidgetPayload, { widget: TWidget }>, Error> {
  return useQuery<Extract<DashboardWidgetPayload, { widget: TWidget }>, Error>({
    queryFn: () => fetchDashboardWidget(widget),
    queryKey: ["dashboard-widget", widget, widgetLimits[widget]]
  });
}

async function fetchDashboardWidget<TWidget extends DashboardWidgetKey>(
  widget: TWidget
): Promise<Extract<DashboardWidgetPayload, { widget: TWidget }>> {
  const response = await apiFetch(`/dashboard/widgets/${widget}?limit=${widgetLimits[widget]}`);

  if (!response.ok) {
    throw new Error("Falha ao carregar widget do dashboard.");
  }

  return response.json() as Promise<Extract<DashboardWidgetPayload, { widget: TWidget }>>;
}
