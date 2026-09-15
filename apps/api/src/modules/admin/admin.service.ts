import { Inject, Injectable, Optional } from "@nestjs/common";
import type { AdminCatalogSummary } from "@fieldops/types";
import type pg from "pg";

import { POSTGRES_POOL } from "../infrastructure/infrastructure.module.js";

interface CountRow {
  readonly assets: string;
  readonly checklists: string;
  readonly customers: string;
  readonly service_types: string;
  readonly sites: string;
  readonly slas: string;
  readonly technicians: string;
}

@Injectable()
export class AdminService {
  constructor(
    @Optional() @Inject(POSTGRES_POOL) private readonly postgresPool?: pg.Pool
  ) {}

  async getCatalogSummary(organizationId: string): Promise<AdminCatalogSummary> {
    if (!this.postgresPool) {
      return demoCatalogSummary(organizationId);
    }

    try {
      const result = await this.postgresPool.query<CountRow>(
        `select
           (select count(*)::text from customers where organization_id = $1) as customers,
           (select count(*)::text from sites where organization_id = $1) as sites,
           (select count(*)::text from assets where organization_id = $1) as assets,
           (select count(*)::text from technician_profiles where organization_id = $1) as technicians,
           (select count(*)::text from service_types where organization_id = $1) as service_types,
           (select count(*)::text from checklist_templates where organization_id = $1) as checklists,
           (select count(*)::text from slas where organization_id = $1) as slas`,
        [organizationId]
      );
      const row = result.rows[0];

      if (!row) {
        return demoCatalogSummary(organizationId);
      }

      return {
        generatedAt: new Date().toISOString(),
        metrics: [
          { label: "Clientes", resource: "customers", value: Number(row.customers) },
          { label: "Locais", resource: "sites", value: Number(row.sites) },
          { label: "Ativos", resource: "assets", value: Number(row.assets) },
          { label: "Técnicos", resource: "technicians", value: Number(row.technicians) },
          { label: "Tipos de serviço", resource: "serviceTypes", value: Number(row.service_types) },
          { label: "Checklists", resource: "checklists", value: Number(row.checklists) },
          { label: "SLAs", resource: "slas", value: Number(row.slas) }
        ],
        organizationId
      };
    } catch {
      return demoCatalogSummary(organizationId);
    }
  }
}

function demoCatalogSummary(organizationId: string): AdminCatalogSummary {
  return {
    generatedAt: new Date().toISOString(),
    metrics: [
      { label: "Clientes", resource: "customers", value: 2 },
      { label: "Locais", resource: "sites", value: 2 },
      { label: "Ativos", resource: "assets", value: 1 },
      { label: "Técnicos", resource: "technicians", value: 2 },
      { label: "Tipos de serviço", resource: "serviceTypes", value: 2 },
      { label: "Checklists", resource: "checklists", value: 1 },
      { label: "SLAs", resource: "slas", value: 0 }
    ],
    organizationId
  };
}
