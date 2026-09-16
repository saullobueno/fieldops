"use client";

import type {
  ReportDailyVolumeItem,
  ReportFilterOptions,
  ReportOverview,
  ReportStatusBreakdownItem,
  ReportTeamComplianceItem,
  ReportTechnicianUtilizationItem
} from "@fieldops/types";
import { AppShell, Button } from "@fieldops/ui";
import { useQuery } from "@tanstack/react-query";
import * as echarts from "echarts";
import { useEffect, useRef, useState } from "react";

import { apiFetch } from "../../lib/api-client";
import { useRequireAuth } from "../../lib/use-require-auth";

const chartColors = ["#0E5F4B", "#3E8E7E", "#9A5B00", "#B42318", "#4F5A55"];

export default function ReportsPage(): React.ReactNode {
  const { logout, session } = useRequireAuth();
  const [from, setFrom] = useState(() => defaultFrom());
  const [to, setTo] = useState(() => todayIso());
  const [teamId, setTeamId] = useState("");
  const [territoryId, setTerritoryId] = useState("");

  const filtersQuery = useQuery({
    enabled: Boolean(session),
    queryFn: fetchFilterOptions,
    queryKey: ["reports-filters"]
  });
  const overviewQuery = useQuery({
    enabled: Boolean(session),
    queryFn: () => fetchOverview({ from, teamId, territoryId, to }),
    queryKey: ["reports-overview", from, to, teamId, territoryId]
  });

  if (!session) {
    return null;
  }

  return (
    <AppShell
      activeHref="/relatorios"
      headerEyebrow="Operação"
      headerTitle="Relatórios"
      onLogout={logout}
      userLabel={session.userName}
    >
      <div className="flex flex-1 flex-col gap-5 p-6 max-sm:p-4">
        <section className="rounded-lg border border-[#D8DEDA] bg-[#FBFCFB] p-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-[#66736D]">
              De
              <input
                className="h-9 rounded-md border border-[#C7D0CB] bg-white px-3 text-sm outline-none focus:border-[#0E5F4B]"
                onChange={(event) => setFrom(event.target.value)}
                type="date"
                value={from}
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-[#66736D]">
              Até
              <input
                className="h-9 rounded-md border border-[#C7D0CB] bg-white px-3 text-sm outline-none focus:border-[#0E5F4B]"
                onChange={(event) => setTo(event.target.value)}
                type="date"
                value={to}
              />
            </label>
            <select
              aria-label="Filtrar relatório por equipe"
              className="h-9 rounded-md border border-[#C7D0CB] bg-white px-3 text-sm outline-none focus:border-[#0E5F4B]"
              onChange={(event) => setTeamId(event.target.value)}
              value={teamId}
            >
              <option value="">Todas as equipes</option>
              {(filtersQuery.data?.teams ?? []).map((team) => (
                <option key={team.id} value={team.id}>{team.name}</option>
              ))}
            </select>
            <select
              aria-label="Filtrar relatório por território"
              className="h-9 rounded-md border border-[#C7D0CB] bg-white px-3 text-sm outline-none focus:border-[#0E5F4B]"
              onChange={(event) => setTerritoryId(event.target.value)}
              value={territoryId}
            >
              <option value="">Todos os territórios</option>
              {(filtersQuery.data?.territories ?? []).map((territory) => (
                <option key={territory.id} value={territory.id}>{territory.name}</option>
              ))}
            </select>
            <Button onClick={() => void overviewQuery.refetch()} variant="secondary">Atualizar</Button>
            <Button
              disabled={!overviewQuery.data}
              onClick={() => {
                if (overviewQuery.data) {
                  downloadReportCsv(overviewQuery.data);
                }
              }}
              variant="secondary"
            >
              Exportar CSV
            </Button>
          </div>
        </section>
        <OverviewState onRetry={() => void overviewQuery.refetch()} query={overviewQuery}>
          {(overview) => <OverviewContent overview={overview} />}
        </OverviewState>
      </div>
    </AppShell>
  );
}

function OverviewContent({ overview }: { overview: ReportOverview }): React.ReactNode {
  return (
    <>
      <section className="grid gap-3 md:grid-cols-4">
        <KpiTile label="Ordens no período" value={String(overview.kpis.totalWorkOrders)} />
        <KpiTile label="Ordens concluídas" value={String(overview.kpis.completedWorkOrders)} />
        <KpiTile label="Cumprimento de SLA" value={`${overview.kpis.slaComplianceRate}%`} />
        <KpiTile
          label="Tempo médio de resolução"
          value={overview.kpis.avgResolutionMinutes !== null ? `${overview.kpis.avgResolutionMinutes} min` : "--"}
        />
      </section>
      <section className="grid gap-5 xl:grid-cols-2">
        <Panel title="Ordens por status">
          <EChart option={statusBreakdownOption(overview.statusBreakdown)} />
        </Panel>
        <Panel title="Volume diário de ordens">
          <EChart option={dailyVolumeOption(overview.dailyVolume)} />
        </Panel>
      </section>
      <section className="grid gap-5 xl:grid-cols-2">
        <Panel title="Cumprimento de SLA por equipe">
          <EChart option={teamComplianceOption(overview.teamCompliance)} />
        </Panel>
        <Panel title="Ordens concluídas por técnico">
          <EChart option={technicianUtilizationOption(overview.technicianUtilization)} />
        </Panel>
      </section>
    </>
  );
}

function EChart({ option }: { option: echarts.EChartsOption }): React.ReactNode {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const chart = echarts.init(containerRef.current);
    chart.setOption(option);

    function handleResize(): void {
      chart.resize();
    }

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.dispose();
    };
  }, [option]);

  return <div className="h-72 w-full" ref={containerRef} />;
}

function statusBreakdownOption(items: readonly ReportStatusBreakdownItem[]): echarts.EChartsOption {
  return {
    color: chartColors,
    series: [
      {
        data: items.map((item) => ({ name: formatStatus(item.status), value: item.count })),
        emphasis: { itemStyle: { shadowBlur: 10, shadowColor: "rgba(0,0,0,0.2)" } },
        radius: ["45%", "70%"],
        type: "pie"
      }
    ],
    tooltip: { trigger: "item" }
  };
}

function dailyVolumeOption(items: readonly ReportDailyVolumeItem[]): echarts.EChartsOption {
  return {
    color: chartColors,
    series: [{ data: items.map((item) => item.count), itemStyle: { color: "#0E5F4B" }, type: "bar" }],
    tooltip: { trigger: "axis" },
    xAxis: { data: items.map((item) => item.date), type: "category" },
    yAxis: { type: "value" }
  };
}

function teamComplianceOption(items: readonly ReportTeamComplianceItem[]): echarts.EChartsOption {
  return {
    color: ["#0E5F4B", "#B42318"],
    legend: { data: ["Dentro do SLA", "Fora do SLA"] },
    series: [
      { data: items.map((item) => item.compliant), name: "Dentro do SLA", stack: "sla", type: "bar" },
      { data: items.map((item) => item.breached), name: "Fora do SLA", stack: "sla", type: "bar" }
    ],
    tooltip: { trigger: "axis" },
    xAxis: { data: items.map((item) => item.teamName), type: "category" },
    yAxis: { type: "value" }
  };
}

function technicianUtilizationOption(items: readonly ReportTechnicianUtilizationItem[]): echarts.EChartsOption {
  return {
    color: chartColors,
    series: [{ data: items.map((item) => item.completedCount), itemStyle: { color: "#3E8E7E" }, type: "bar" }],
    tooltip: { trigger: "axis" },
    xAxis: { data: items.map((item) => item.technician), type: "category" },
    yAxis: { type: "value" }
  };
}

function OverviewState({
  children,
  onRetry,
  query
}: {
  children: (data: ReportOverview) => React.ReactNode;
  onRetry: () => void;
  query: ReturnType<typeof useQuery<ReportOverview, Error>>;
}): React.ReactNode {
  if (query.isLoading) {
    return <LoadingState message="Carregando relatório..." />;
  }

  if (query.isError) {
    return <ErrorState message="Não foi possível carregar o relatório." onRetry={onRetry} />;
  }

  if (!query.data) {
    return <EmptyState message="Nenhum dado disponível para o período." />;
  }

  return children(query.data);
}

function Panel({ children, title }: { children: React.ReactNode; title: string }): React.ReactNode {
  return (
    <section className="rounded-lg border border-[#D8DEDA] bg-[#FBFCFB] p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function KpiTile({ label, value }: { label: string; value: string }): React.ReactNode {
  return (
    <article className="min-h-24 rounded-lg border border-[#D8DEDA] bg-[#FBFCFB] p-4">
      <p className="text-xs font-medium text-[#66736D]">{label}</p>
      <div className="mt-3 text-2xl font-semibold">{value}</div>
    </article>
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

function formatStatus(status: string): string {
  const labels: Record<string, string> = {
    cancelled: "Cancelada",
    completed: "Concluída",
    draft: "Rascunho",
    en_route: "A caminho",
    on_site: "No local",
    paused: "Pausada",
    requires_review: "Requer revisão",
    scheduled: "Agendada"
  };

  return labels[status] ?? status;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function defaultFrom(): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - 30);
  return date.toISOString().slice(0, 10);
}

function downloadReportCsv(overview: ReportOverview): void {
  const rows = [
    ["seção", "dimensão", "valor", "extra"],
    ["kpi", "ordens_no_periodo", String(overview.kpis.totalWorkOrders), ""],
    ["kpi", "ordens_concluidas", String(overview.kpis.completedWorkOrders), ""],
    ["kpi", "cumprimento_sla", String(overview.kpis.slaComplianceRate), "%"],
    ["kpi", "tempo_medio_resolucao", String(overview.kpis.avgResolutionMinutes ?? ""), "min"],
    ...overview.statusBreakdown.map((item) => ["status", item.status, String(item.count), ""]),
    ...overview.dailyVolume.map((item) => ["volume_diario", item.date, String(item.count), ""]),
    ...overview.teamCompliance.map((item) => ["sla_equipe", item.teamName, String(item.compliant), String(item.breached)]),
    ...overview.technicianUtilization.map((item) => ["tecnico", item.technician, String(item.completedCount), ""])
  ];
  const csv = rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `fieldops-relatorio-${overview.from}-${overview.to}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function escapeCsvCell(value: string): string {
  if (!/[",\n]/.test(value)) {
    return value;
  }

  return `"${value.replaceAll("\"", "\"\"")}"`;
}

async function fetchFilterOptions(): Promise<ReportFilterOptions> {
  const response = await apiFetch("/reports/filters");

  if (!response.ok) {
    throw new Error("Falha ao carregar opções de filtro do relatório.");
  }

  return response.json() as Promise<ReportFilterOptions>;
}

async function fetchOverview(input: { from: string; to: string; teamId: string; territoryId: string }): Promise<ReportOverview> {
  const params = new URLSearchParams({ from: input.from, to: input.to });
  if (input.teamId) {
    params.set("teamId", input.teamId);
  }
  if (input.territoryId) {
    params.set("territoryId", input.territoryId);
  }

  const response = await apiFetch(`/reports/overview?${params.toString()}`);

  if (!response.ok) {
    throw new Error("Falha ao carregar o relatório.");
  }

  return response.json() as Promise<ReportOverview>;
}
