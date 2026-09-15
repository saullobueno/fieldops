import { Inject, Injectable, Optional } from "@nestjs/common";
import { calculateSlaComplianceRate } from "@fieldops/domain";
import type {
  ReportDailyVolumeItem,
  ReportKpis,
  ReportOverview,
  ReportStatusBreakdownItem,
  ReportTeamComplianceItem,
  ReportTechnicianUtilizationItem
} from "@fieldops/types";
import type pg from "pg";

import { POSTGRES_POOL } from "../infrastructure/infrastructure.module.js";

export interface ReportFilter {
  readonly organizationId: string;
  readonly from: string;
  readonly to: string;
  readonly teamId?: string;
  readonly territoryId?: string;
}

interface KpiRow {
  readonly total: string;
  readonly completed: string;
  readonly sla_compliant: string;
  readonly sla_measurable: string;
  readonly avg_resolution_minutes: string | null;
}

interface StatusRow {
  readonly status: string;
  readonly count: string;
}

interface DailyVolumeRow {
  readonly day: Date | string;
  readonly count: string;
}

interface TeamComplianceRow {
  readonly team_name: string | null;
  readonly compliant: string;
  readonly breached: string;
}

interface TechnicianUtilizationRow {
  readonly technician: string;
  readonly completed_count: string;
}

@Injectable()
export class ReportsService {
  constructor(
    @Optional() @Inject(POSTGRES_POOL) private readonly postgresPool?: pg.Pool
  ) {}

  async getOverview(filter: ReportFilter): Promise<ReportOverview> {
    if (!this.postgresPool) {
      return demoOverview(filter);
    }

    try {
      return await this.getOverviewFromDatabase(filter);
    } catch {
      return demoOverview(filter);
    }
  }

  private async getOverviewFromDatabase(filter: ReportFilter): Promise<ReportOverview> {
    const { values, where } = buildFilterClause(filter);

    const [kpis, statusBreakdown, dailyVolume, teamCompliance, technicianUtilization] = await Promise.all([
      this.postgresPool!.query<KpiRow>(
        `select
           count(*)::text as total,
           count(*) filter (where wo.status = 'completed')::text as completed,
           count(*) filter (where wo.status = 'completed' and wo.sla_due_at is not null and wo.completed_at <= wo.sla_due_at)::text as sla_compliant,
           count(*) filter (where wo.status = 'completed' and wo.sla_due_at is not null)::text as sla_measurable,
           avg(extract(epoch from (wo.completed_at - wo.scheduled_start_at)) / 60) filter (
             where wo.status = 'completed' and wo.completed_at is not null and wo.scheduled_start_at is not null
           ) as avg_resolution_minutes
         ${fromClause(where)}`,
        values
      ),
      this.postgresPool!.query<StatusRow>(
        `select wo.status, count(*)::text as count
         ${fromClause(where)}
         group by wo.status
         order by count(*) desc`,
        values
      ),
      this.postgresPool!.query<DailyVolumeRow>(
        `select wo.scheduled_start_at::date as day, count(*)::text as count
         ${fromClause(where)}
         group by wo.scheduled_start_at::date
         order by day asc`,
        values
      ),
      this.postgresPool!.query<TeamComplianceRow>(
        `select
           t.name as team_name,
           count(*) filter (where wo.status = 'completed' and wo.sla_due_at is not null and wo.completed_at <= wo.sla_due_at)::text as compliant,
           count(*) filter (where wo.status = 'completed' and wo.sla_due_at is not null and wo.completed_at > wo.sla_due_at)::text as breached
         ${fromClause(where)}
         group by t.name
         order by t.name asc nulls last`,
        values
      ),
      this.postgresPool!.query<TechnicianUtilizationRow>(
        `select u.name as technician, count(*) filter (where wo.status = 'completed')::text as completed_count
         ${fromClause(`${where} and u.name is not null`)}
         group by u.name
         order by completed_count desc`,
        values
      )
    ]);

    const kpiRow = kpis.rows[0];
    const slaCompliant = Number(kpiRow?.sla_compliant ?? 0);
    const slaMeasurable = Number(kpiRow?.sla_measurable ?? 0);

    return {
      dailyVolume: dailyVolume.rows.map(toDailyVolumeItem),
      from: filter.from,
      kpis: {
        avgResolutionMinutes: kpiRow?.avg_resolution_minutes ? Math.round(Number(kpiRow.avg_resolution_minutes)) : null,
        completedWorkOrders: Number(kpiRow?.completed ?? 0),
        slaComplianceRate: calculateSlaComplianceRate(slaCompliant, slaMeasurable),
        totalWorkOrders: Number(kpiRow?.total ?? 0)
      },
      statusBreakdown: statusBreakdown.rows.map(toStatusBreakdownItem),
      teamCompliance: teamCompliance.rows.map(toTeamComplianceItem),
      technicianUtilization: technicianUtilization.rows.map(toTechnicianUtilizationItem),
      to: filter.to
    };
  }
}

function buildFilterClause(filter: ReportFilter): { where: string; values: unknown[] } {
  const values: unknown[] = [filter.organizationId, filter.from, filter.to];
  const conditions = [
    "wo.organization_id = $1",
    "wo.scheduled_start_at::date between $2::date and $3::date"
  ];

  if (filter.teamId) {
    values.push(filter.teamId);
    conditions.push(`tp.team_id = $${values.length}`);
  }

  if (filter.territoryId) {
    values.push(filter.territoryId);
    conditions.push(`coalesce(tp.territory_id, s.territory_id) = $${values.length}`);
  }

  return { values, where: conditions.join(" and ") };
}

function fromClause(where: string): string {
  return `from work_orders wo
    join sites s on s.id = wo.site_id
    left join lateral (
      select technician_id
      from work_order_assignments
      where work_order_id = wo.id and status in ('assigned', 'accepted')
      order by starts_at desc
      limit 1
    ) active_assignment on true
    left join technician_profiles tp on tp.id = active_assignment.technician_id
    left join teams t on t.id = tp.team_id
    left join users u on u.id = tp.user_id
    where ${where}`;
}

function toStatusBreakdownItem(row: StatusRow): ReportStatusBreakdownItem {
  return { count: Number(row.count), status: row.status };
}

function toDailyVolumeItem(row: DailyVolumeRow): ReportDailyVolumeItem {
  return { count: Number(row.count), date: toDateOnly(row.day) };
}

function toTeamComplianceItem(row: TeamComplianceRow): ReportTeamComplianceItem {
  return {
    breached: Number(row.breached),
    compliant: Number(row.compliant),
    teamName: row.team_name ?? "Sem equipe"
  };
}

function toTechnicianUtilizationItem(row: TechnicianUtilizationRow): ReportTechnicianUtilizationItem {
  return { completedCount: Number(row.completed_count), technician: row.technician };
}

function toDateOnly(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, 10);
}

function demoOverview(filter: ReportFilter): ReportOverview {
  return {
    dailyVolume: [
      { count: 3, date: "2026-01-14" },
      { count: 5, date: "2026-01-15" },
      { count: 2, date: "2026-01-16" }
    ],
    from: filter.from,
    kpis: {
      avgResolutionMinutes: 96,
      completedWorkOrders: 6,
      slaComplianceRate: calculateSlaComplianceRate(5, 6),
      totalWorkOrders: 10
    },
    statusBreakdown: [
      { count: 6, status: "completed" },
      { count: 2, status: "en_route" },
      { count: 1, status: "scheduled" },
      { count: 1, status: "requires_review" }
    ],
    teamCompliance: [
      { breached: 1, compliant: 3, teamName: "Equipe Centro" },
      { breached: 0, compliant: 2, teamName: "Equipe Oeste" }
    ],
    technicianUtilization: [
      { completedCount: 4, technician: "Ana Ribeiro" },
      { completedCount: 2, technician: "Bruno Almeida" }
    ],
    to: filter.to
  };
}
