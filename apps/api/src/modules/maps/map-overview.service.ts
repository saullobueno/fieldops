import { Inject, Injectable, Optional } from "@nestjs/common";
import type { MapOverview, MapOverviewTechnician, MapOverviewWorkOrder } from "@fieldops/types";
import type pg from "pg";

import { POSTGRES_POOL } from "../infrastructure/infrastructure.module.js";

interface TechnicianRow {
  readonly id: string;
  readonly name: string;
  readonly status: string;
  readonly latitude: string | null;
  readonly longitude: string | null;
}

interface WorkOrderRow {
  readonly id: string;
  readonly number: string;
  readonly title: string;
  readonly customer: string;
  readonly status: string;
  readonly sla_due_at: Date | string | null;
  readonly latitude: string | null;
  readonly longitude: string | null;
}

@Injectable()
export class MapOverviewService {
  constructor(
    @Optional() @Inject(POSTGRES_POOL) private readonly postgresPool?: pg.Pool
  ) {}

  async getOverview(organizationId: string): Promise<MapOverview> {
    if (!this.postgresPool) {
      return demoOverview();
    }

    try {
      return await this.getOverviewFromDatabase(organizationId);
    } catch {
      return demoOverview();
    }
  }

  private async getOverviewFromDatabase(organizationId: string): Promise<MapOverview> {
    const [technicians, workOrders] = await Promise.all([
      this.postgresPool!.query<TechnicianRow>(
        `select tp.id, u.name, tp.status,
           coalesce(tp.current_latitude, tp.home_latitude)::text as latitude,
           coalesce(tp.current_longitude, tp.home_longitude)::text as longitude
         from technician_profiles tp
         join users u on u.id = tp.user_id
         where tp.organization_id = $1
         order by u.name asc`,
        [organizationId]
      ),
      this.postgresPool!.query<WorkOrderRow>(
        `select wo.id, wo.number, wo.title, c.name as customer, wo.status, wo.sla_due_at,
           s.latitude::text as latitude, s.longitude::text as longitude
         from work_orders wo
         join customers c on c.id = wo.customer_id
         join sites s on s.id = wo.site_id
         where wo.organization_id = $1 and wo.status not in ('completed', 'cancelled')
         order by wo.scheduled_start_at asc nulls last`,
        [organizationId]
      )
    ]);

    return {
      technicians: technicians.rows.map(toTechnician),
      workOrders: workOrders.rows.map(toWorkOrder)
    };
  }
}

function toTechnician(row: TechnicianRow): MapOverviewTechnician {
  return {
    id: row.id,
    latitude: row.latitude ? Number(row.latitude) : null,
    longitude: row.longitude ? Number(row.longitude) : null,
    name: row.name,
    status: row.status
  };
}

function toWorkOrder(row: WorkOrderRow): MapOverviewWorkOrder {
  return {
    customer: row.customer,
    id: row.id,
    latitude: row.latitude ? Number(row.latitude) : null,
    longitude: row.longitude ? Number(row.longitude) : null,
    number: row.number,
    slaDueAt: row.sla_due_at ? new Date(row.sla_due_at).toISOString() : null,
    status: row.status,
    title: row.title
  };
}

function demoOverview(): MapOverview {
  return {
    technicians: [
      { id: "00000000-0000-4000-8000-000000000701", latitude: -23.550520, longitude: -46.633308, name: "Ana Ribeiro", status: "assigned" },
      { id: "00000000-0000-4000-8000-000000000702", latitude: -23.561684, longitude: -46.655981, name: "Bruno Almeida", status: "en_route" },
      { id: "demo-technician-carla", latitude: -23.56, longitude: -46.66, name: "Carla Nunes", status: "available" }
    ],
    workOrders: [
      {
        customer: "Hospital Santa Clara",
        id: "00000000-0000-4000-8000-000000000901",
        latitude: -23.5452,
        longitude: -46.6339,
        number: "WO-1001",
        slaDueAt: "2026-01-16T13:10:00.000Z",
        status: "on_site",
        title: "Inspeção preventiva da bomba"
      },
      {
        customer: "Rede Mercado Norte",
        id: "00000000-0000-4000-8000-000000000902",
        latitude: -23.5666,
        longitude: -46.6934,
        number: "WO-1002",
        slaDueAt: "2026-01-16T11:30:00.000Z",
        status: "en_route",
        title: "Falha em câmara fria"
      },
      {
        customer: "Condomínio Jardim Sul",
        id: "demo-work-order-1003",
        latitude: -23.5617,
        longitude: -46.656,
        number: "WO-1003",
        slaDueAt: "2026-01-16T16:00:00.000Z",
        status: "scheduled",
        title: "Vazamento em tubulação"
      }
    ]
  };
}
