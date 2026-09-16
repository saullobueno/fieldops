import { randomUUID } from "node:crypto";

import { Inject, Injectable, NotFoundException, Optional } from "@nestjs/common";
import type { CustomerDetail, CustomerListResponse, CustomerSummary, NamedOption } from "@fieldops/types";
import type pg from "pg";

import { POSTGRES_POOL } from "../infrastructure/infrastructure.module.js";

export interface CustomerListFilter {
  readonly organizationId: string;
  readonly search?: string;
  readonly territoryId?: string;
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

export interface SiteWriteInput {
  readonly organizationId: string;
  readonly customerId: string;
  readonly name: string;
  readonly addressLine1: string;
  readonly addressLine2: string | null;
  readonly city: string;
  readonly state: string;
  readonly postalCode: string;
  readonly country: string;
  readonly territoryId: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly accessInstructions: string | null;
}

export interface SiteUpdateInput extends SiteWriteInput {
  readonly id: string;
}

export interface ContactWriteInput {
  readonly organizationId: string;
  readonly customerId: string;
  readonly name: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly title: string | null;
}

export interface ContactUpdateInput extends ContactWriteInput {
  readonly id: string;
}

export interface ContractWriteInput {
  readonly organizationId: string;
  readonly customerId: string;
  readonly name: string;
  readonly startsOn: string;
  readonly endsOn: string | null;
}

export interface ContractUpdateInput extends ContractWriteInput {
  readonly id: string;
}

export interface AssetWriteInput {
  readonly organizationId: string;
  readonly customerId: string;
  readonly siteId: string;
  readonly name: string;
  readonly model: string | null;
  readonly serialNumber: string | null;
  readonly warrantyExpiresOn: string | null;
}

export interface AssetUpdateInput extends AssetWriteInput {
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
  readonly address_line_2: string | null;
  readonly city: string;
  readonly state: string;
  readonly postal_code: string;
  readonly country: string;
  readonly territory_id: string | null;
  readonly latitude: string | null;
  readonly longitude: string | null;
  readonly access_instructions: string | null;
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
  readonly warranty_expires_on: Date | string | null;
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

  async listTerritories(organizationId: string): Promise<readonly NamedOption[]> {
    if (!this.postgresPool) {
      return demoTerritories();
    }

    try {
      const result = await this.postgresPool.query<NamedOption>(
        `select id, name from territories where organization_id = $1 order by name asc`,
        [organizationId]
      );
      return result.rows;
    } catch {
      return demoTerritories();
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

  async createSite(input: SiteWriteInput): Promise<CustomerDetail> {
    if (!this.postgresPool) {
      createSiteInMemory(input);
      return getFromMemory(input.customerId, input.organizationId);
    }

    try {
      await this.createSiteInDatabase(input);
      return await this.getFromDatabase(input.customerId, input.organizationId);
    } catch {
      createSiteInMemory(input);
      return getFromMemory(input.customerId, input.organizationId);
    }
  }

  async updateSite(input: SiteUpdateInput): Promise<CustomerDetail> {
    if (!this.postgresPool) {
      updateSiteInMemory(input);
      return getFromMemory(input.customerId, input.organizationId);
    }

    try {
      await this.updateSiteInDatabase(input);
      return await this.getFromDatabase(input.customerId, input.organizationId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      updateSiteInMemory(input);
      return getFromMemory(input.customerId, input.organizationId);
    }
  }

  async createContact(input: ContactWriteInput): Promise<CustomerDetail> {
    if (!this.postgresPool) {
      createContactInMemory(input);
      return getFromMemory(input.customerId, input.organizationId);
    }

    try {
      await this.createContactInDatabase(input);
      return await this.getFromDatabase(input.customerId, input.organizationId);
    } catch {
      createContactInMemory(input);
      return getFromMemory(input.customerId, input.organizationId);
    }
  }

  async updateContact(input: ContactUpdateInput): Promise<CustomerDetail> {
    if (!this.postgresPool) {
      updateContactInMemory(input);
      return getFromMemory(input.customerId, input.organizationId);
    }

    try {
      await this.updateContactInDatabase(input);
      return await this.getFromDatabase(input.customerId, input.organizationId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      updateContactInMemory(input);
      return getFromMemory(input.customerId, input.organizationId);
    }
  }

  async createContract(input: ContractWriteInput): Promise<CustomerDetail> {
    if (!this.postgresPool) {
      createContractInMemory(input);
      return getFromMemory(input.customerId, input.organizationId);
    }

    try {
      await this.createContractInDatabase(input);
      return await this.getFromDatabase(input.customerId, input.organizationId);
    } catch {
      createContractInMemory(input);
      return getFromMemory(input.customerId, input.organizationId);
    }
  }

  async updateContract(input: ContractUpdateInput): Promise<CustomerDetail> {
    if (!this.postgresPool) {
      updateContractInMemory(input);
      return getFromMemory(input.customerId, input.organizationId);
    }

    try {
      await this.updateContractInDatabase(input);
      return await this.getFromDatabase(input.customerId, input.organizationId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      updateContractInMemory(input);
      return getFromMemory(input.customerId, input.organizationId);
    }
  }

  async createAsset(input: AssetWriteInput): Promise<CustomerDetail> {
    if (!this.postgresPool) {
      createAssetInMemory(input);
      return getFromMemory(input.customerId, input.organizationId);
    }

    try {
      await this.createAssetInDatabase(input);
      return await this.getFromDatabase(input.customerId, input.organizationId);
    } catch {
      createAssetInMemory(input);
      return getFromMemory(input.customerId, input.organizationId);
    }
  }

  async updateAsset(input: AssetUpdateInput): Promise<CustomerDetail> {
    if (!this.postgresPool) {
      updateAssetInMemory(input);
      return getFromMemory(input.customerId, input.organizationId);
    }

    try {
      await this.updateAssetInDatabase(input);
      return await this.getFromDatabase(input.customerId, input.organizationId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      updateAssetInMemory(input);
      return getFromMemory(input.customerId, input.organizationId);
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

  private async createSiteInDatabase(input: SiteWriteInput): Promise<void> {
    await this.postgresPool!.query(
      `insert into sites (
         organization_id, customer_id, territory_id, name, address_line_1, address_line_2,
         city, state, postal_code, country, latitude, longitude, access_instructions
       )
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        input.organizationId,
        input.customerId,
        input.territoryId,
        input.name,
        input.addressLine1,
        input.addressLine2,
        input.city,
        input.state,
        input.postalCode,
        input.country,
        input.latitude,
        input.longitude,
        input.accessInstructions
      ]
    );
  }

  private async updateSiteInDatabase(input: SiteUpdateInput): Promise<void> {
    const result = await this.postgresPool!.query(
      `update sites
       set territory_id = $4,
           name = $5,
           address_line_1 = $6,
           address_line_2 = $7,
           city = $8,
           state = $9,
           postal_code = $10,
           country = $11,
           latitude = $12,
           longitude = $13,
           access_instructions = $14,
           updated_at = now()
       where id = $1 and organization_id = $2 and customer_id = $3`,
      [
        input.id,
        input.organizationId,
        input.customerId,
        input.territoryId,
        input.name,
        input.addressLine1,
        input.addressLine2,
        input.city,
        input.state,
        input.postalCode,
        input.country,
        input.latitude,
        input.longitude,
        input.accessInstructions
      ]
    );

    if (result.rowCount === 0) {
      throw new NotFoundException("Local não encontrado.");
    }
  }

  private async createContactInDatabase(input: ContactWriteInput): Promise<void> {
    await this.postgresPool!.query(
      `insert into contacts (organization_id, customer_id, name, email, phone, title)
       values ($1, $2, $3, $4, $5, $6)`,
      [input.organizationId, input.customerId, input.name, input.email, input.phone, input.title]
    );
  }

  private async updateContactInDatabase(input: ContactUpdateInput): Promise<void> {
    const result = await this.postgresPool!.query(
      `update contacts
       set name = $4, email = $5, phone = $6, title = $7, updated_at = now()
       where id = $1 and organization_id = $2 and customer_id = $3`,
      [input.id, input.organizationId, input.customerId, input.name, input.email, input.phone, input.title]
    );

    if (result.rowCount === 0) {
      throw new NotFoundException("Contato não encontrado.");
    }
  }

  private async createContractInDatabase(input: ContractWriteInput): Promise<void> {
    await this.postgresPool!.query(
      `insert into contracts (organization_id, customer_id, name, starts_on, ends_on)
       values ($1, $2, $3, $4, $5)`,
      [input.organizationId, input.customerId, input.name, input.startsOn, input.endsOn]
    );
  }

  private async updateContractInDatabase(input: ContractUpdateInput): Promise<void> {
    const result = await this.postgresPool!.query(
      `update contracts
       set name = $4, starts_on = $5, ends_on = $6, updated_at = now()
       where id = $1 and organization_id = $2 and customer_id = $3`,
      [input.id, input.organizationId, input.customerId, input.name, input.startsOn, input.endsOn]
    );

    if (result.rowCount === 0) {
      throw new NotFoundException("Contrato não encontrado.");
    }
  }

  private async createAssetInDatabase(input: AssetWriteInput): Promise<void> {
    const result = await this.postgresPool!.query(
      `insert into assets (
         organization_id, customer_id, site_id, name, serial_number, model, warranty_expires_on
       )
       select $1, $2, s.id, $4, $5, $6, $7
       from sites s
       where s.id = $3 and s.organization_id = $1 and s.customer_id = $2`,
      [
        input.organizationId,
        input.customerId,
        input.siteId,
        input.name,
        input.serialNumber,
        input.model,
        input.warrantyExpiresOn
      ]
    );

    if (result.rowCount === 0) {
      throw new NotFoundException("Local do ativo não encontrado.");
    }
  }

  private async updateAssetInDatabase(input: AssetUpdateInput): Promise<void> {
    const result = await this.postgresPool!.query(
      `update assets
       set site_id = $4,
           name = $5,
           serial_number = $6,
           model = $7,
           warranty_expires_on = $8,
           updated_at = now()
       where id = $1
         and organization_id = $2
         and customer_id = $3
         and exists (
           select 1 from sites s
           where s.id = $4 and s.organization_id = $2 and s.customer_id = $3
         )`,
      [
        input.id,
        input.organizationId,
        input.customerId,
        input.siteId,
        input.name,
        input.serialNumber,
        input.model,
        input.warrantyExpiresOn
      ]
    );

    if (result.rowCount === 0) {
      throw new NotFoundException("Ativo não encontrado.");
    }
  }

  private async listFromDatabase(filter: CustomerListFilter): Promise<CustomerListResponse> {
    const values: unknown[] = [filter.organizationId];
    const where = ["c.organization_id = $1"];

    if (filter.search?.trim()) {
      values.push(`%${filter.search.trim()}%`);
      where.push(`c.name ilike $${values.length}`);
    }

    if (filter.territoryId?.trim()) {
      values.push(filter.territoryId.trim());
      where.push(`exists (select 1 from sites s2 where s2.customer_id = c.id and s2.territory_id = $${values.length})`);
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
        `select
           id, name, address_line_1, address_line_2, city, state, postal_code, country,
           territory_id, latitude::text, longitude::text, access_instructions
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
        `select a.id, a.name, a.model, a.serial_number, a.warranty_expires_on, a.site_id, s.name as site_name
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
    accessInstructions: row.access_instructions,
    addressLine1: row.address_line_1,
    addressLine2: row.address_line_2,
    city: row.city,
    country: row.country,
    id: row.id,
    latitude: row.latitude ? Number(row.latitude) : null,
    longitude: row.longitude ? Number(row.longitude) : null,
    name: row.name,
    postalCode: row.postal_code,
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
    siteName: row.site_name,
    warrantyExpiresOn: row.warranty_expires_on ? toIso(row.warranty_expires_on) : null
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
        siteName: "Unidade Centro",
        warrantyExpiresOn: null
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
        accessInstructions: "Acesso pela portaria técnica.",
        addressLine1: "Rua Boa Vista, 120",
        addressLine2: null,
        city: "São Paulo",
        country: "BR",
        id: "00000000-0000-4000-8000-000000000401",
        latitude: -23.5452,
        longitude: -46.6339,
        name: "Unidade Centro",
        postalCode: "01014-000",
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
        accessInstructions: null,
        addressLine1: "Rua dos Pinheiros, 950",
        addressLine2: null,
        city: "São Paulo",
        country: "BR",
        id: "00000000-0000-4000-8000-000000000402",
        latitude: -23.5666,
        longitude: -46.6934,
        name: "Loja Pinheiros",
        postalCode: "05422-001",
        state: "SP",
        territoryId: "00000000-0000-4000-8000-000000000802"
      }
    ],
    sitesCount: 1
  }
];

function demoTerritories(): readonly NamedOption[] {
  return [
    { id: "00000000-0000-4000-8000-000000000801", name: "Centro" },
    { id: "00000000-0000-4000-8000-000000000802", name: "Oeste" }
  ];
}

function listFromMemory(filter: CustomerListFilter): CustomerListResponse {
  const normalizedSearch = filter.search?.trim().toLowerCase();
  const territoryId = filter.territoryId?.trim();
  const filtered = customers.filter((item) => {
    const sameOrganization = item.organizationId === filter.organizationId;
    const matchesSearch = !normalizedSearch || item.name.toLowerCase().includes(normalizedSearch);
    const matchesTerritory = !territoryId || item.sites.some((site) => site.territoryId === territoryId);

    return sameOrganization && matchesSearch && matchesTerritory;
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

function createSiteInMemory(input: SiteWriteInput): void {
  const customer = getFromMemory(input.customerId, input.organizationId);
  const created = {
    accessInstructions: input.accessInstructions,
    addressLine1: input.addressLine1,
    addressLine2: input.addressLine2,
    city: input.city,
    country: input.country,
    id: randomUUID(),
    latitude: input.latitude,
    longitude: input.longitude,
    name: input.name,
    postalCode: input.postalCode,
    state: input.state,
    territoryId: input.territoryId
  };

  replaceCustomer({
    ...customer,
    sites: [...customer.sites, created],
    sitesCount: customer.sitesCount + 1
  });
}

function updateSiteInMemory(input: SiteUpdateInput): void {
  const customer = getFromMemory(input.customerId, input.organizationId);
  const siteIndex = customer.sites.findIndex((site) => site.id === input.id);

  if (siteIndex === -1) {
    throw new NotFoundException("Local não encontrado.");
  }

  const sites = [...customer.sites];
  sites[siteIndex] = {
    accessInstructions: input.accessInstructions,
    addressLine1: input.addressLine1,
    addressLine2: input.addressLine2,
    city: input.city,
    country: input.country,
    id: input.id,
    latitude: input.latitude,
    longitude: input.longitude,
    name: input.name,
    postalCode: input.postalCode,
    state: input.state,
    territoryId: input.territoryId
  };

  const updatedAssets = customer.assets.map((asset) =>
    asset.siteId === input.id ? { ...asset, siteName: input.name } : asset
  );

  replaceCustomer({ ...customer, assets: updatedAssets, sites });
}

function createContactInMemory(input: ContactWriteInput): void {
  const customer = getFromMemory(input.customerId, input.organizationId);
  replaceCustomer({
    ...customer,
    contacts: [
      ...customer.contacts,
      {
        email: input.email,
        id: randomUUID(),
        name: input.name,
        phone: input.phone,
        title: input.title
      }
    ]
  });
}

function updateContactInMemory(input: ContactUpdateInput): void {
  const customer = getFromMemory(input.customerId, input.organizationId);
  const contactIndex = customer.contacts.findIndex((contact) => contact.id === input.id);

  if (contactIndex === -1) {
    throw new NotFoundException("Contato não encontrado.");
  }

  const contacts = [...customer.contacts];
  contacts[contactIndex] = {
    email: input.email,
    id: input.id,
    name: input.name,
    phone: input.phone,
    title: input.title
  };

  replaceCustomer({ ...customer, contacts });
}

function createContractInMemory(input: ContractWriteInput): void {
  const customer = getFromMemory(input.customerId, input.organizationId);
  replaceCustomer({
    ...customer,
    contracts: [
      ...customer.contracts,
      {
        endsOn: input.endsOn,
        id: randomUUID(),
        name: input.name,
        startsOn: input.startsOn
      }
    ]
  });
}

function updateContractInMemory(input: ContractUpdateInput): void {
  const customer = getFromMemory(input.customerId, input.organizationId);
  const contractIndex = customer.contracts.findIndex((contract) => contract.id === input.id);

  if (contractIndex === -1) {
    throw new NotFoundException("Contrato não encontrado.");
  }

  const contracts = [...customer.contracts];
  contracts[contractIndex] = {
    endsOn: input.endsOn,
    id: input.id,
    name: input.name,
    startsOn: input.startsOn
  };

  replaceCustomer({ ...customer, contracts });
}

function createAssetInMemory(input: AssetWriteInput): void {
  const customer = getFromMemory(input.customerId, input.organizationId);
  const site = customer.sites.find((candidate) => candidate.id === input.siteId);

  if (!site) {
    throw new NotFoundException("Local do ativo não encontrado.");
  }

  replaceCustomer({
    ...customer,
    assets: [
      ...customer.assets,
      {
        id: randomUUID(),
        model: input.model,
        name: input.name,
        serialNumber: input.serialNumber,
        siteId: input.siteId,
        siteName: site.name,
        warrantyExpiresOn: input.warrantyExpiresOn
      }
    ]
  });
}

function updateAssetInMemory(input: AssetUpdateInput): void {
  const customer = getFromMemory(input.customerId, input.organizationId);
  const assetIndex = customer.assets.findIndex((asset) => asset.id === input.id);
  const site = customer.sites.find((candidate) => candidate.id === input.siteId);

  if (assetIndex === -1 || !site) {
    throw new NotFoundException("Ativo não encontrado.");
  }

  const assets = [...customer.assets];
  assets[assetIndex] = {
    id: input.id,
    model: input.model,
    name: input.name,
    serialNumber: input.serialNumber,
    siteId: input.siteId,
    siteName: site.name,
    warrantyExpiresOn: input.warrantyExpiresOn
  };

  replaceCustomer({ ...customer, assets });
}

function replaceCustomer(updated: CustomerDetail): void {
  const index = customers.findIndex(
    (candidate) => candidate.id === updated.id && candidate.organizationId === updated.organizationId
  );

  if (index !== -1) {
    customers[index] = updated;
  }
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
