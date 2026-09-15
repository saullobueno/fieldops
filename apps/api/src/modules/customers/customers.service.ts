import { randomUUID } from "node:crypto";

import { Inject, Injectable, NotFoundException, Optional } from "@nestjs/common";
import type { CustomerDetail, CustomerListResponse, CustomerSummary } from "@fieldops/types";
import type pg from "pg";

import { POSTGRES_POOL } from "../infrastructure/infrastructure.module.js";

export interface CustomerListFilter {
  readonly organizationId: string;
  readonly search?: string;
  readonly limit: number;
  readonly offset: number;
}

export interface CustomerWriteInput {
  readonly organizationId: string;
  readonly name: string;
  readonly externalRef: string | null;
  readonly notes: string | null;
}

export interface CustomerUpdateInput extends CustomerWriteInput {
  readonly id: string;
}

interface CustomerSummaryRow {
  readonly id: string;
  readonly organization_id: string;
  readonly name: string;
  readonly external_ref: string | null;
  readonly sites_count: string;
  readonly open_work_orders_count: string;
}

interface CustomerRow {
  readonly id: string;
  readonly organization_id: string;
  readonly name: string;
  readonly external_ref: string | null;
  readonly notes: string | null;
}

interface SiteRow {
  readonly id: string;
  readonly name: string;
  readonly address_line_1: string;
  readonly city: string;
  readonly state: string;
  readonly territory_id: string | null;
}

interface ContactRow {
  readonly id: string;
  readonly name: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly title: string | null;
}

interface ContractRow {
  readonly id: string;
  readonly name: string;
  readonly starts_on: Date | string;
  readonly ends_on: Date | string | null;
}

interface AssetRow {
  readonly id: string;
  readonly name: string;
  readonly model: string | null;
  readonly serial_number: string | null;
  readonly site_id: string;
  readonly site_name: string;
}

@Injectable()
export class CustomersService {
  constructor(
    @Optional() @Inject(POSTGRES_POOL) private readonly postgresPool?: pg.Pool
  ) {}

  async list(filter: CustomerListFilter): Promise<CustomerListResponse> {
    if (!this.postgresPool) {
      return listFromMemory(filter);
    }

    try {
      return await this.listFromDatabase(filter);
    } catch {
      return listFromMemory(filter);
    }
  }

  async getById(id: string, organizationId: string): Promise<CustomerDetail> {
    if (!this.postgresPool) {
      return getFromMemory(id, organizationId);
    }

    try {
      return await this.getFromDatabase(id, organizationId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      return getFromMemory(id, organizationId);
    }
  }

  async create(input: CustomerWriteInput): Promise<CustomerDetail> {
    if (!this.postgresPool) {
      return createInMemory(input);
    }

    try {
      const id = await this.createInDatabase(input);
      return await this.getFromDatabase(id, input.organizationId);
    } catch {
      return createInMemory(input);
    }
  }

  async update(input: CustomerUpdateInput): Promise<CustomerDetail> {
    if (!this.postgresPool) {
      return updateInMemory(input);
    }

    try {
      await this.updateInDatabase(input);
      return await this.getFromDatabase(input.id, input.organizationId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      return updateInMemory(input);
    }
  }

  private async createInDatabase(input: CustomerWriteInput): Promise<string> {
    const result = await this.postgresPool!.query<{ id: string }>(
      `insert into customers (organization_id, name, external_ref, notes)
       values ($1, $2, $3, $4)
       returning id`,
      [input.organizationId, input.name, input.externalRef, input.notes]
    );

    return result.rows[0]!.id;
  }

  private async updateInDatabase(input: CustomerUpdateInput): Promise<void> {
    const result = await this.postgresPool!.query(
      `update customers
       set name = $3, external_ref = $4, notes = $5, updated_at = now()
       where id = $1 and organization_id = $2`,
      [input.id, input.organizationId, input.name, input.externalRef, input.notes]
    );

    if (result.rowCount === 0) {
      throw new NotFoundException("Cliente não encontrado.");
    }
  }

  private async listFromDatabase(filter: CustomerListFilter): Promise<CustomerListResponse> {
    const values: unknown[] = [filter.organizationId];
    const where = ["c.organization_id = $1"];

    if (filter.search?.trim()) {
      values.push(`%${filter.search.trim()}%`);
      where.push(`c.name ilike $${values.length}`);
    }

    const whereSql = where.join(" and ");
    const count = await this.postgresPool!.query<{ total: string }>(
      `select count(*)::text as total from customers c where ${whereSql}`,
      values
    );

    const data = await this.postgresPool!.query<CustomerSummaryRow>(
      `select
         c.id,
         c.organization_id,
         c.name,
         c.external_ref,
         count(distinct s.id)::text as sites_count,
         count(distinct wo.id) filter (where wo.status not in ('completed', 'cancelled'))::text as open_work_orders_count
       from customers c
       left join sites s on s.customer_id = c.id
       left join work_orders wo on wo.customer_id = c.id
       where ${whereSql}
       group by c.id
       order by c.name asc
       limit $${values.length + 1} offset $${values.length + 2}`,
      [...values, filter.limit, filter.offset]
    );

    return {
      items: data.rows.map(toSummary),
      limit: filter.limit,
      offset: filter.offset,
      total: Number(count.rows[0]?.total ?? 0)
    };
  }

  private async getFromDatabase(id: string, organizationId: string): Promise<CustomerDetail> {
    const customer = await this.postgresPool!.query<CustomerRow>(
      `select id, organization_id, name, external_ref, notes
       from customers
       where id = $1 and organization_id = $2
       limit 1`,
      [id, organizationId]
    );

    const row = customer.rows[0];
    if (!row) {
      throw new NotFoundException("Cliente não encontrado.");
    }

    const [sites, contacts, contracts, assets, openWorkOrders] = await Promise.all([
      this.postgresPool!.query<SiteRow>(
        `select id, name, address_line_1, city, state, territory_id
         from sites
         where customer_id = $1 and organization_id = $2
         order by name asc`,
        [id, organizationId]
      ),
      this.postgresPool!.query<ContactRow>(
        `select id, name, email, phone, title
         from contacts
         where customer_id = $1 and organization_id = $2
         order by name asc`,
        [id, organizationId]
      ),
      this.postgresPool!.query<ContractRow>(
        `select id, name, starts_on, ends_on
         from contracts
         where customer_id = $1 and organization_id = $2
         order by starts_on desc`,
        [id, organizationId]
      ),
      this.postgresPool!.query<AssetRow>(
        `select a.id, a.name, a.model, a.serial_number, a.site_id, s.name as site_name
         from assets a
         join sites s on s.id = a.site_id
         where a.customer_id = $1 and a.organization_id = $2
         order by a.name asc`,
        [id, organizationId]
      ),
      this.postgresPool!.query<{ count: string }>(
        `select count(*)::text as count
         from work_orders
         where customer_id = $1 and organization_id = $2 and status not in ('completed', 'cancelled')`,
        [id, organizationId]
      )
    ]);

    return {
      assets: assets.rows.map(toAssetSummary),
      contacts: contacts.rows.map(toContact),
      contracts: contracts.rows.map(toContract),
      externalRef: row.external_ref,
      id: row.id,
      name: row.name,
      notes: row.notes,
      openWorkOrdersCount: Number(openWorkOrders.rows[0]?.count ?? 0),
      organizationId: row.organization_id,
      sites: sites.rows.map(toSite),
      sitesCount: sites.rows.length
    };
  }
}

function toSummary(row: CustomerSummaryRow): CustomerSummary {
  return {
    externalRef: row.external_ref,
    id: row.id,
    name: row.name,
    openWorkOrdersCount: Number(row.open_work_orders_count),
    organizationId: row.organization_id,
    sitesCount: Number(row.sites_count)
  };
}

function toSite(row: SiteRow) {
  return {
    addressLine1: row.address_line_1,
    city: row.city,
    id: row.id,
    name: row.name,
    state: row.state,
    territoryId: row.territory_id
  };
}

function toContact(row: ContactRow) {
  return {
    email: row.email,
    id: row.id,
    name: row.name,
    phone: row.phone,
    title: row.title
  };
}

function toContract(row: ContractRow) {
  return {
    endsOn: row.ends_on ? toIso(row.ends_on) : null,
    id: row.id,
    name: row.name,
    startsOn: toIso(row.starts_on)
  };
}

function toAssetSummary(row: AssetRow) {
  return {
    id: row.id,
    model: row.model,
    name: row.name,
    serialNumber: row.serial_number,
    siteId: row.site_id,
    siteName: row.site_name
  };
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

const organizationId = "00000000-0000-4000-8000-000000000001";

const customers: CustomerDetail[] = [
  {
    assets: [
      {
        id: "00000000-0000-4000-8000-000000000501",
        model: "PX-900",
        name: "Bomba pressurizadora A",
        serialNumber: "BMB-ACME-001",
        siteId: "00000000-0000-4000-8000-000000000401",
        siteName: "Unidade Centro"
      }
    ],
    contacts: [
      {
        email: "facilities@santaclara.example",
        id: "contact-1",
        name: "Renata Farias",
        phone: "+55 11 4000-1000",
        title: "Gerente de Facilities"
      }
    ],
    contracts: [
      { endsOn: "2026-12-31", id: "contract-1", name: "Manutenção preventiva anual", startsOn: "2026-01-01" }
    ],
    externalRef: "CRM-100",
    id: "00000000-0000-4000-8000-000000000301",
    name: "Hospital Santa Clara",
    notes: "Acesso pela portaria técnica após as 7h.",
    openWorkOrdersCount: 1,
    organizationId,
    sites: [
      {
        addressLine1: "Rua Boa Vista, 120",
        city: "São Paulo",
        id: "00000000-0000-4000-8000-000000000401",
        name: "Unidade Centro",
        state: "SP",
        territoryId: "00000000-0000-4000-8000-000000000801"
      }
    ],
    sitesCount: 1
  },
  {
    assets: [],
    contacts: [
      {
        email: "operacoes@mercadonorte.example",
        id: "contact-2",
        name: "Diego Prado",
        phone: "+55 11 4000-2000",
        title: "Coordenador de Operações"
      }
    ],
    contracts: [],
    externalRef: "CRM-200",
    id: "00000000-0000-4000-8000-000000000302",
    name: "Rede Mercado Norte",
    notes: null,
    openWorkOrdersCount: 1,
    organizationId,
    sites: [
      {
        addressLine1: "Rua dos Pinheiros, 950",
        city: "São Paulo",
        id: "00000000-0000-4000-8000-000000000402",
        name: "Loja Pinheiros",
        state: "SP",
        territoryId: "00000000-0000-4000-8000-000000000802"
      }
    ],
    sitesCount: 1
  }
];

function listFromMemory(filter: CustomerListFilter): CustomerListResponse {
  const normalizedSearch = filter.search?.trim().toLowerCase();
  const filtered = customers.filter((item) => {
    const sameOrganization = item.organizationId === filter.organizationId;
    const matchesSearch = !normalizedSearch || item.name.toLowerCase().includes(normalizedSearch);

    return sameOrganization && matchesSearch;
  });

  return {
    items: filtered.slice(filter.offset, filter.offset + filter.limit).map(toSummaryFromDetail),
    limit: filter.limit,
    offset: filter.offset,
    total: filtered.length
  };
}

function getFromMemory(id: string, organizationId: string): CustomerDetail {
  const item = customers.find(
    (candidate) => candidate.id === id && candidate.organizationId === organizationId
  );

  if (!item) {
    throw new NotFoundException("Cliente não encontrado.");
  }

  return item;
}

function createInMemory(input: CustomerWriteInput): CustomerDetail {
  const created: CustomerDetail = {
    assets: [],
    contacts: [],
    contracts: [],
    externalRef: input.externalRef,
    id: randomUUID(),
    name: input.name,
    notes: input.notes,
    openWorkOrdersCount: 0,
    organizationId: input.organizationId,
    sites: [],
    sitesCount: 0
  };

  customers.push(created);
  return created;
}

function updateInMemory(input: CustomerUpdateInput): CustomerDetail {
  const index = customers.findIndex(
    (candidate) => candidate.id === input.id && candidate.organizationId === input.organizationId
  );

  if (index === -1) {
    throw new NotFoundException("Cliente não encontrado.");
  }

  const updated: CustomerDetail = {
    ...customers[index]!,
    externalRef: input.externalRef,
    name: input.name,
    notes: input.notes
  };

  customers[index] = updated;
  return updated;
}

function toSummaryFromDetail(detail: CustomerDetail): CustomerSummary {
  return {
    externalRef: detail.externalRef,
    id: detail.id,
    name: detail.name,
    openWorkOrdersCount: detail.openWorkOrdersCount,
    organizationId: detail.organizationId,
    sitesCount: detail.sitesCount
  };
}
