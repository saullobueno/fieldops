import { Inject, Injectable, Optional } from "@nestjs/common";
import type {
  ActiveServiceMapItem,
  AiInsightItem,
  DashboardKpi,
  DashboardWidgetKey,
  DashboardWidgetPayload,
  DispatchPreviewItem,
  RecentWorkOrderItem,
  SlaRiskItem,
  TechnicianUtilizationItem
} from "@fieldops/types";
import type pg from "pg";

import { POSTGRES_POOL } from "../infrastructure/infrastructure.module.js";

interface DashboardScope {
  readonly organizationId: string;
}

interface KpiRows {
  readonly active_technicians: string;
  readonly open_count: string;
  readonly sla_risk_count: string;
  readonly today_count: string;
}

interface WorkOrderWidgetRow {
  readonly customer: string;
  readonly latitude: string | null;
  readonly longitude: string | null;
  readonly priority: string;
  readonly scheduled_start_at: Date | string | null;
  readonly sla_due_at: Date | string | null;
  readonly status: string;
  readonly technician: string | null;
  readonly title: string;
  readonly work_order_number: string;
}

interface TechnicianUtilizationRow {
  readonly active_work_orders: string;
  readonly technician: string;
}

@Injectable()
export class DashboardService {
  constructor(
    @Optional() @Inject(POSTGRES_POOL) private readonly postgresPool?: pg.Pool
  ) {}

  async getWidget(widget: DashboardWidgetKey, limit: number, scope?: DashboardScope): Promise<DashboardWidgetPayload> {
    if (!this.postgresPool || !scope) {
      return getDemoWidget(widget, limit);
    }

    try {
      return await this.getDatabaseWidget(widget, limit, scope);
    } catch {
      return getDemoWidget(widget, limit);
    }
  }

  private async getDatabaseWidget(widget: DashboardWidgetKey, limit: number, scope: DashboardScope): Promise<DashboardWidgetPayload> {
    switch (widget) {
      case "active-services-map":
        return { widget, items: await this.getActiveServicesMap(limit, scope) };
      case "ai-insights":
        return { widget, items: await this.getAiInsights(limit, scope) };
      case "dispatch-preview":
        return { widget, items: await this.getDispatchPreview(limit, scope) };
      case "kpis":
        return { widget, items: await this.getKpis(limit, scope) };
      case "recent-work-orders":
        return { widget, items: await this.getRecentWorkOrders(limit, scope) };
      case "sla-risk":
        return { widget, items: await this.getSlaRisk(limit, scope) };
      case "technician-utilization":
        return { widget, items: await this.getTechnicianUtilization(limit, scope) };
    }
  }

  private async getKpis(limit: number, scope: DashboardScope): Promise<readonly DashboardKpi[]> {
    const result = await this.postgresPool!.query<KpiRows>(
      `select
         count(*) filter (where wo.status not in ('completed', 'cancelled'))::text as open_count,
         count(*) filter (where wo.scheduled_start_at::date = now()::date)::text as today_count,
         count(*) filter (where wo.sla_due_at is not null and wo.sla_due_at <= now() + interval '4 hours' and wo.status not in ('completed', 'cancelled'))::text as sla_risk_count,
         (select count(*)::text from technician_profiles tp where tp.organization_id = $1 and tp.status in ('available', 'assigned', 'en_route', 'on_site')) as active_technicians
       from work_orders wo
       where wo.organization_id = $1`,
      [scope.organizationId]
    );
    const row = result.rows[0];

    if (!row) {
      return [];
    }

    const items: DashboardKpi[] = [
      { label: "Ordens abertas", tone: "neutral", trend: "base persistente", value: row.open_count },
      { label: "Serviços de hoje", tone: "good", trend: "agenda do dia", value: row.today_count },
      { label: "SLAs em risco", tone: Number(row.sla_risk_count) > 0 ? "danger" : "good", trend: "próximas 4h", value: row.sla_risk_count },
      { label: "Técnicos ativos", tone: "good", trend: "online ou atribuídos", value: row.active_technicians }
    ];

    return items.slice(0, limit);
  }

  private async getDispatchPreview(limit: number, scope: DashboardScope): Promise<readonly DispatchPreviewItem[]> {
    const rows = await this.getWorkOrderRows(limit, scope, "wo.scheduled_start_at asc nulls last");
    return rows.map((row) => ({
      status: formatStatus(row.status),
      technician: row.technician ?? "Não atribuído",
      time: formatTime(row.scheduled_start_at),
      title: row.title,
      workOrderNumber: row.work_order_number
    }));
  }

  private async getSlaRisk(limit: number, scope: DashboardScope): Promise<readonly SlaRiskItem[]> {
    const rows = await this.getWorkOrderRows(limit, scope, "wo.sla_due_at asc nulls last", "wo.sla_due_at is not null and wo.status not in ('completed', 'cancelled')");
    return rows.map((row) => ({
      customer: row.customer,
      dueAt: formatTime(row.sla_due_at),
      risk: riskLevel(row.sla_due_at),
      workOrderNumber: row.work_order_number
    }));
  }

  private async getActiveServicesMap(limit: number, scope: DashboardScope): Promise<readonly ActiveServiceMapItem[]> {
    const rows = await this.getWorkOrderRows(limit, scope, "wo.scheduled_start_at asc nulls last", "s.latitude is not null and s.longitude is not null");
    return rows.flatMap((row) => {
      if (!row.latitude || !row.longitude) {
        return [];
      }

      return [{
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        status: formatStatus(row.status),
        workOrderNumber: row.work_order_number
      }];
    });
  }

  private async getRecentWorkOrders(limit: number, scope: DashboardScope): Promise<readonly RecentWorkOrderItem[]> {
    const rows = await this.getWorkOrderRows(limit, scope, "wo.created_at desc");
    return rows.map((row) => ({
      customer: row.customer,
      priority: formatPriority(row.priority),
      status: formatStatus(row.status),
      workOrderNumber: row.work_order_number
    }));
  }

  private async getTechnicianUtilization(limit: number, scope: DashboardScope): Promise<readonly TechnicianUtilizationItem[]> {
    const result = await this.postgresPool!.query<TechnicianUtilizationRow>(
      `select u.name as technician, count(woa.id)::text as active_work_orders
       from technician_profiles tp
       join users u on u.id = tp.user_id
       left join work_order_assignments woa on woa.technician_id = tp.id and woa.status in ('assigned', 'accepted')
       where tp.organization_id = $1
       group by u.name
       order by count(woa.id) desc, u.name asc
       limit $2`,
      [scope.organizationId, limit]
    );

    return result.rows.map((row) => {
      const activeWorkOrders = Number(row.active_work_orders);
      return {
        activeWorkOrders,
        technician: row.technician,
        utilizationPercent: Math.min(100, activeWorkOrders * 25)
      };
    });
  }

  private async getAiInsights(limit: number, scope: DashboardScope): Promise<readonly AiInsightItem[]> {
    const [slaRiskItems, utilizationItems] = await Promise.all([
      this.getSlaRisk(1, scope),
      this.getTechnicianUtilization(1, scope)
    ]);
    const items: AiInsightItem[] = [];

    if (slaRiskItems[0]) {
      items.push({
        evidence: `${slaRiskItems[0].workOrderNumber} vence às ${slaRiskItems[0].dueAt} para ${slaRiskItems[0].customer}.`,
        severity: slaRiskItems[0].risk === "alto" ? "crítico" : "atenção",
        title: "Risco de SLA priorizado"
      });
    }

    if (utilizationItems[0]) {
      items.push({
        evidence: `${utilizationItems[0].technician} concentra ${utilizationItems[0].activeWorkOrders} ordens ativas.`,
        severity: utilizationItems[0].utilizationPercent >= 75 ? "atenção" : "informativo",
        title: "Utilização de técnico"
      });
    }

    return items.slice(0, limit);
  }

  private async getWorkOrderRows(
    limit: number,
    scope: DashboardScope,
    orderBy: string,
    extraWhere = "true"
  ): Promise<readonly WorkOrderWidgetRow[]> {
    const result = await this.postgresPool!.query<WorkOrderWidgetRow>(
      `select
         wo.number as work_order_number,
         wo.title,
         wo.priority,
         wo.status,
         wo.scheduled_start_at,
         wo.sla_due_at,
         c.name as customer,
         s.latitude,
         s.longitude,
         u.name as technician
       from work_orders wo
       join customers c on c.id = wo.customer_id
       join sites s on s.id = wo.site_id
       left join lateral (
         select technician_id
         from work_order_assignments
         where work_order_id = wo.id and status in ('assigned', 'accepted')
         order by starts_at desc
         limit 1
       ) active_assignment on true
       left join technician_profiles tp on tp.id = active_assignment.technician_id
       left join users u on u.id = tp.user_id
       where wo.organization_id = $1 and ${extraWhere}
       order by ${orderBy}
       limit $2`,
      [scope.organizationId, limit]
    );

    return result.rows;
  }
}

function getDemoWidget(widget: DashboardWidgetKey, limit: number): DashboardWidgetPayload {
  switch (widget) {
    case "active-services-map":
      return { widget, items: activeServicesMap.slice(0, limit) };
    case "ai-insights":
      return { widget, items: aiInsights.slice(0, limit) };
    case "dispatch-preview":
      return { widget, items: dispatchPreview.slice(0, limit) };
    case "kpis":
      return { widget, items: kpis.slice(0, limit) };
    case "recent-work-orders":
      return { widget, items: recentWorkOrders.slice(0, limit) };
    case "sla-risk":
      return { widget, items: slaRisk.slice(0, limit) };
    case "technician-utilization":
      return { widget, items: technicianUtilization.slice(0, limit) };
  }
}

function formatTime(value: Date | string | null): string {
  if (!value) {
    return "--:--";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo"
  }).format(new Date(value));
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

function formatPriority(priority: string): string {
  const labels: Record<string, string> = {
    high: "Alta",
    low: "Baixa",
    medium: "Média",
    urgent: "Urgente"
  };

  return labels[priority] ?? priority;
}

function riskLevel(value: Date | string | null): SlaRiskItem["risk"] {
  if (!value) {
    return "baixo";
  }

  const remainingMinutes = (new Date(value).getTime() - Date.now()) / 60_000;
  if (remainingMinutes <= 120) {
    return "alto";
  }

  if (remainingMinutes <= 360) {
    return "medio";
  }

  return "baixo";
}

const kpis = [
  { label: "Ordens abertas", tone: "neutral", trend: "+4 hoje", value: "42" },
  { label: "Serviços de hoje", tone: "good", trend: "18 atribuídos", value: "26" },
  { label: "SLAs em risco", tone: "danger", trend: "3 críticos", value: "7" },
  { label: "Técnicos ativos", tone: "good", trend: "2 offline", value: "18" },
  { label: "Tempo médio de resposta", tone: "warning", trend: "+8 min", value: "1h24" },
  { label: "Resolução na primeira visita", tone: "good", trend: "+3,2%", value: "86%" }
] as const;

const dispatchPreview = [
  { status: "Agendada", technician: "Ana Ribeiro", time: "08:30", title: "Inspeção preventiva da bomba", workOrderNumber: "WO-1001" },
  { status: "A caminho", technician: "Bruno Almeida", time: "09:45", title: "Falha em câmara fria", workOrderNumber: "WO-1002" },
  { status: "No local", technician: "Carla Nunes", time: "10:20", title: "Troca de sensor de pressão", workOrderNumber: "WO-1003" }
] as const;

const slaRisk = [
  { customer: "Condomínio Jardim Sul", dueAt: "16:00", risk: "alto", workOrderNumber: "WO-1003" },
  { customer: "Hospital Santa Clara", dueAt: "13:10", risk: "medio", workOrderNumber: "WO-1001" },
  { customer: "Rede Mercado Norte", dueAt: "11:30", risk: "medio", workOrderNumber: "WO-1002" }
] as const;

const activeServicesMap = [
  { latitude: -23.5452, longitude: -46.6339, status: "No local", workOrderNumber: "WO-1001" },
  { latitude: -23.5666, longitude: -46.6934, status: "A caminho", workOrderNumber: "WO-1002" },
  { latitude: -23.5617, longitude: -46.656, status: "Agendada", workOrderNumber: "WO-1003" }
] as const;

const recentWorkOrders = [
  { customer: "Hospital Santa Clara", priority: "Alta", status: "Agendada", workOrderNumber: "WO-1001" },
  { customer: "Rede Mercado Norte", priority: "Urgente", status: "A caminho", workOrderNumber: "WO-1002" },
  { customer: "Shopping Vila Leste", priority: "Média", status: "Requer revisão", workOrderNumber: "WO-1007" }
] as const;

const technicianUtilization = [
  { activeWorkOrders: 4, technician: "Ana Ribeiro", utilizationPercent: 82 },
  { activeWorkOrders: 3, technician: "Bruno Almeida", utilizationPercent: 74 },
  { activeWorkOrders: 2, technician: "Carla Nunes", utilizationPercent: 61 }
] as const;

const aiInsights = [
  { evidence: "WO-1002 combina prioridade urgente, deslocamento longo e SLA às 11:30.", severity: "crítico", title: "Risco concentrado em refrigeração" },
  { evidence: "Equipe Centro está com 82% de utilização e duas janelas livres após 14:00.", severity: "atenção", title: "Realocar serviços de baixa prioridade" },
  { evidence: "3 ordens recentes usam o mesmo ativo PX-900 em 30 dias.", severity: "informativo", title: "Ativo candidato a manutenção preventiva" }
] as const;
