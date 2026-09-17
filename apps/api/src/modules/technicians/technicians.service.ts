import { Inject, Injectable, Optional } from "@nestjs/common";
import type { TechnicianListResponse, TechnicianSummary } from "@fieldops/types";
import type pg from "pg";

import { POSTGRES_POOL } from "../infrastructure/infrastructure.module.js";

interface TechnicianSummaryRow {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly status: string;
  readonly skills: readonly string[];
  readonly team_id: string | null;
  readonly team_name: string | null;
  readonly territory_id: string | null;
  readonly territory_name: string | null;
  readonly latitude: string | null;
  readonly longitude: string | null;
  readonly location_updated_at: Date | string | null;
  readonly active_assignments_count: string;
}

@Injectable()
export class TechniciansService {
  constructor(
    @Optional() @Inject(POSTGRES_POOL) private readonly postgresPool?: pg.Pool
  ) {}

  async list(organizationId: string): Promise<TechnicianListResponse> {
    if (!this.postgresPool) {
      return demoTechnicianList();
    }

    try {
      return await this.listFromDatabase(organizationId);
    } catch {
      return demoTechnicianList();
    }
  }

  private async listFromDatabase(organizationId: string): Promise<TechnicianListResponse> {
    const result = await this.postgresPool!.query<TechnicianSummaryRow>(
      `select
         tp.id,
         u.name,
         u.email,
         tp.status,
         tp.skills,
         tp.team_id,
         t.name as team_name,
         tp.territory_id,
         ter.name as territory_name,
         coalesce(tp.current_latitude, tp.home_latitude)::text as latitude,
         coalesce(tp.current_longitude, tp.home_longitude)::text as longitude,
         tp.location_updated_at,
         count(woa.id) filter (where woa.status in ('assigned', 'accepted'))::text as active_assignments_count
       from technician_profiles tp
       join users u on u.id = tp.user_id
       left join teams t on t.id = tp.team_id
       left join territories ter on ter.id = tp.territory_id
       left join work_order_assignments woa on woa.technician_id = tp.id
       where tp.organization_id = $1
       group by tp.id, u.name, u.email, tp.status, tp.skills, tp.team_id, t.name, tp.territory_id, ter.name,
         tp.current_latitude, tp.home_latitude, tp.current_longitude, tp.home_longitude, tp.location_updated_at
       order by u.name asc`,
      [organizationId]
    );

    const items = result.rows.map(toSummary);
    return { items, total: items.length };
  }
}

function toSummary(row: TechnicianSummaryRow): TechnicianSummary {
  return {
    activeAssignmentsCount: Number(row.active_assignments_count ?? 0),
    email: row.email,
    id: row.id,
    latitude: row.latitude ? Number(row.latitude) : null,
    locationUpdatedAt: row.location_updated_at ? new Date(row.location_updated_at).toISOString() : null,
    longitude: row.longitude ? Number(row.longitude) : null,
    name: row.name,
    skills: row.skills,
    status: row.status,
    teamId: row.team_id,
    teamName: row.team_name,
    territoryId: row.territory_id,
    territoryName: row.territory_name
  };
}

const demoTechnicians: readonly TechnicianSummary[] = [
  {
    activeAssignmentsCount: 1,
    email: "ana@acmefield.example",
    id: "00000000-0000-4000-8000-000000000701",
    latitude: -23.550520,
    locationUpdatedAt: null,
    longitude: -46.633308,
    name: "Ana Ribeiro",
    skills: ["elétrica", "inspeção", "bombas"],
    status: "assigned",
    teamId: "00000000-0000-4000-8000-000000000201",
    teamName: "Equipe Centro",
    territoryId: "00000000-0000-4000-8000-000000000801",
    territoryName: "Centro"
  },
  {
    activeAssignmentsCount: 1,
    email: "bruno@acmefield.example",
    id: "00000000-0000-4000-8000-000000000702",
    latitude: -23.561684,
    locationUpdatedAt: null,
    longitude: -46.655981,
    name: "Bruno Almeida",
    skills: ["refrigeração", "manutenção", "hidráulica"],
    status: "en_route",
    teamId: "00000000-0000-4000-8000-000000000202",
    teamName: "Equipe Oeste",
    territoryId: "00000000-0000-4000-8000-000000000802",
    territoryName: "Oeste"
  },
  {
    activeAssignmentsCount: 0,
    email: "carla@acmefield.example",
    id: "demo-technician-carla",
    latitude: -23.56,
    locationUpdatedAt: null,
    longitude: -46.66,
    name: "Carla Nunes",
    skills: ["hidráulica", "instrumentação"],
    status: "available",
    teamId: "00000000-0000-4000-8000-000000000202",
    teamName: "Equipe Oeste",
    territoryId: "00000000-0000-4000-8000-000000000802",
    territoryName: "Oeste"
  }
];

function demoTechnicianList(): TechnicianListResponse {
  return { items: demoTechnicians, total: demoTechnicians.length };
}
