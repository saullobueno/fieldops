import { BadRequestException, Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query, UnauthorizedException } from "@nestjs/common";
import type { AuthenticatedActor } from "@fieldops/auth";
import type { CustomerDetail, CustomerListResponse, NamedOption } from "@fieldops/types";
import { z } from "zod";

import { CurrentActor, RequirePermissions } from "../auth/auth.decorators.js";
import { CustomersService } from "./customers.service.js";

const listQuerySchema = z.object({
  activeContract: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  search: z.string().optional(),
  territoryId: z.string().trim().min(1).optional()
});

const writeBodySchema = z.object({
  externalRef: z.string().trim().min(1).max(100).nullable().optional(),
  name: z.string().trim().min(1).max(200),
  notes: z.string().trim().max(2_000).nullable().optional()
});

const optionalText = (max = 500) => z.string().trim().min(1).max(max).nullable().optional();
const optionalDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional();

const siteWriteBodySchema = z.object({
  accessInstructions: optionalText(2_000),
  addressLine1: z.string().trim().min(1).max(300),
  addressLine2: optionalText(300),
  city: z.string().trim().min(1).max(120),
  country: z.string().trim().min(2).max(2).default("BR"),
  latitude: z.coerce.number().min(-90).max(90).nullable().optional(),
  longitude: z.coerce.number().min(-180).max(180).nullable().optional(),
  name: z.string().trim().min(1).max(200),
  postalCode: z.string().trim().min(1).max(30),
  state: z.string().trim().min(1).max(80),
  territoryId: optionalText(80)
});

const contactWriteBodySchema = z.object({
  email: z.string().trim().email().max(320).nullable().optional(),
  name: z.string().trim().min(1).max(200),
  phone: optionalText(80),
  title: optionalText(120)
});

const contractWriteBodySchema = z.object({
  endsOn: optionalDate,
  name: z.string().trim().min(1).max(200),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});

const assetWriteBodySchema = z.object({
  model: optionalText(120),
  name: z.string().trim().min(1).max(200),
  serialNumber: optionalText(120),
  siteId: z.string().trim().min(1).max(80),
  warrantyExpiresOn: optionalDate
});

@Controller("customers")
export class CustomersController {
  constructor(@Inject(CustomersService) private readonly customersService: CustomersService) {}

  @Get()
  @RequirePermissions("customer:read")
  async list(
    @CurrentActor() actor: AuthenticatedActor | undefined,
    @Query() query: Record<string, string | string[] | undefined>
  ): Promise<CustomerListResponse> {
    const currentActor = requireActor(actor);
    const parsedQuery = listQuerySchema.safeParse(query);

    if (!parsedQuery.success) {
      throw new BadRequestException("Filtros inválidos para clientes.");
    }

    return this.customersService.list({
      organizationId: currentActor.organizationId,
      ...parsedQuery.data
    });
  }

  @Get("territories")
  @RequirePermissions("customer:read")
  async listTerritories(@CurrentActor() actor: AuthenticatedActor | undefined): Promise<readonly NamedOption[]> {
    const currentActor = requireActor(actor);
    return this.customersService.listTerritories(currentActor.organizationId);
  }

  @Get(":id")
  @RequirePermissions("customer:read")
  async getById(
    @CurrentActor() actor: AuthenticatedActor | undefined,
    @Param("id") id: string
  ): Promise<CustomerDetail> {
    const currentActor = requireActor(actor);
    return this.customersService.getById(id, currentActor.organizationId);
  }

  @Post()
  @RequirePermissions("customer:manage")
  async create(
    @CurrentActor() actor: AuthenticatedActor | undefined,
    @Body() body: unknown
  ): Promise<CustomerDetail> {
    const currentActor = requireActor(actor);
    const parsedBody = writeBodySchema.safeParse(body);

    if (!parsedBody.success) {
      throw new BadRequestException("Dados inválidos para criar cliente.");
    }

    return this.customersService.create({
      externalRef: parsedBody.data.externalRef ?? null,
      name: parsedBody.data.name,
      notes: parsedBody.data.notes ?? null,
      organizationId: currentActor.organizationId
    });
  }

  @Patch(":id")
  @RequirePermissions("customer:manage")
  async update(
    @CurrentActor() actor: AuthenticatedActor | undefined,
    @Param("id") id: string,
    @Body() body: unknown
  ): Promise<CustomerDetail> {
    const currentActor = requireActor(actor);
    const parsedBody = writeBodySchema.safeParse(body);

    if (!parsedBody.success) {
      throw new BadRequestException("Dados inválidos para atualizar cliente.");
    }

    return this.customersService.update({
      externalRef: parsedBody.data.externalRef ?? null,
      id,
      name: parsedBody.data.name,
      notes: parsedBody.data.notes ?? null,
      organizationId: currentActor.organizationId
    });
  }

  @Post(":customerId/sites")
  @RequirePermissions("customer:manage")
  async createSite(
    @CurrentActor() actor: AuthenticatedActor | undefined,
    @Param("customerId") customerId: string,
    @Body() body: unknown
  ): Promise<CustomerDetail> {
    const currentActor = requireActor(actor);
    const parsedBody = siteWriteBodySchema.safeParse(body);

    if (!parsedBody.success) {
      throw new BadRequestException("Dados inválidos para criar local.");
    }

    return this.customersService.createSite({
      accessInstructions: parsedBody.data.accessInstructions ?? null,
      addressLine1: parsedBody.data.addressLine1,
      addressLine2: parsedBody.data.addressLine2 ?? null,
      city: parsedBody.data.city,
      country: parsedBody.data.country.toUpperCase(),
      customerId,
      latitude: parsedBody.data.latitude ?? null,
      longitude: parsedBody.data.longitude ?? null,
      name: parsedBody.data.name,
      organizationId: currentActor.organizationId,
      postalCode: parsedBody.data.postalCode,
      state: parsedBody.data.state,
      territoryId: parsedBody.data.territoryId ?? null
    });
  }

  @Patch(":customerId/sites/:siteId")
  @RequirePermissions("customer:manage")
  async updateSite(
    @CurrentActor() actor: AuthenticatedActor | undefined,
    @Param("customerId") customerId: string,
    @Param("siteId") siteId: string,
    @Body() body: unknown
  ): Promise<CustomerDetail> {
    const currentActor = requireActor(actor);
    const parsedBody = siteWriteBodySchema.safeParse(body);

    if (!parsedBody.success) {
      throw new BadRequestException("Dados inválidos para atualizar local.");
    }

    return this.customersService.updateSite({
      accessInstructions: parsedBody.data.accessInstructions ?? null,
      addressLine1: parsedBody.data.addressLine1,
      addressLine2: parsedBody.data.addressLine2 ?? null,
      city: parsedBody.data.city,
      country: parsedBody.data.country.toUpperCase(),
      customerId,
      id: siteId,
      latitude: parsedBody.data.latitude ?? null,
      longitude: parsedBody.data.longitude ?? null,
      name: parsedBody.data.name,
      organizationId: currentActor.organizationId,
      postalCode: parsedBody.data.postalCode,
      state: parsedBody.data.state,
      territoryId: parsedBody.data.territoryId ?? null
    });
  }

  @Delete(":customerId/sites/:siteId")
  @RequirePermissions("customer:manage")
  async deleteSite(
    @CurrentActor() actor: AuthenticatedActor | undefined,
    @Param("customerId") customerId: string,
    @Param("siteId") siteId: string
  ): Promise<CustomerDetail> {
    const currentActor = requireActor(actor);
    return this.customersService.deleteSite({ customerId, id: siteId, organizationId: currentActor.organizationId });
  }

  @Post(":customerId/contacts")
  @RequirePermissions("customer:manage")
  async createContact(
    @CurrentActor() actor: AuthenticatedActor | undefined,
    @Param("customerId") customerId: string,
    @Body() body: unknown
  ): Promise<CustomerDetail> {
    const currentActor = requireActor(actor);
    const parsedBody = contactWriteBodySchema.safeParse(body);

    if (!parsedBody.success) {
      throw new BadRequestException("Dados inválidos para criar contato.");
    }

    return this.customersService.createContact({
      customerId,
      email: parsedBody.data.email ?? null,
      name: parsedBody.data.name,
      organizationId: currentActor.organizationId,
      phone: parsedBody.data.phone ?? null,
      title: parsedBody.data.title ?? null
    });
  }

  @Patch(":customerId/contacts/:contactId")
  @RequirePermissions("customer:manage")
  async updateContact(
    @CurrentActor() actor: AuthenticatedActor | undefined,
    @Param("customerId") customerId: string,
    @Param("contactId") contactId: string,
    @Body() body: unknown
  ): Promise<CustomerDetail> {
    const currentActor = requireActor(actor);
    const parsedBody = contactWriteBodySchema.safeParse(body);

    if (!parsedBody.success) {
      throw new BadRequestException("Dados inválidos para atualizar contato.");
    }

    return this.customersService.updateContact({
      customerId,
      email: parsedBody.data.email ?? null,
      id: contactId,
      name: parsedBody.data.name,
      organizationId: currentActor.organizationId,
      phone: parsedBody.data.phone ?? null,
      title: parsedBody.data.title ?? null
    });
  }

  @Delete(":customerId/contacts/:contactId")
  @RequirePermissions("customer:manage")
  async deleteContact(
    @CurrentActor() actor: AuthenticatedActor | undefined,
    @Param("customerId") customerId: string,
    @Param("contactId") contactId: string
  ): Promise<CustomerDetail> {
    const currentActor = requireActor(actor);
    return this.customersService.deleteContact({ customerId, id: contactId, organizationId: currentActor.organizationId });
  }

  @Post(":customerId/contracts")
  @RequirePermissions("customer:manage")
  async createContract(
    @CurrentActor() actor: AuthenticatedActor | undefined,
    @Param("customerId") customerId: string,
    @Body() body: unknown
  ): Promise<CustomerDetail> {
    const currentActor = requireActor(actor);
    const parsedBody = contractWriteBodySchema.safeParse(body);

    if (!parsedBody.success) {
      throw new BadRequestException("Dados inválidos para criar contrato.");
    }

    return this.customersService.createContract({
      customerId,
      endsOn: parsedBody.data.endsOn ?? null,
      name: parsedBody.data.name,
      organizationId: currentActor.organizationId,
      startsOn: parsedBody.data.startsOn
    });
  }

  @Patch(":customerId/contracts/:contractId")
  @RequirePermissions("customer:manage")
  async updateContract(
    @CurrentActor() actor: AuthenticatedActor | undefined,
    @Param("customerId") customerId: string,
    @Param("contractId") contractId: string,
    @Body() body: unknown
  ): Promise<CustomerDetail> {
    const currentActor = requireActor(actor);
    const parsedBody = contractWriteBodySchema.safeParse(body);

    if (!parsedBody.success) {
      throw new BadRequestException("Dados inválidos para atualizar contrato.");
    }

    return this.customersService.updateContract({
      customerId,
      endsOn: parsedBody.data.endsOn ?? null,
      id: contractId,
      name: parsedBody.data.name,
      organizationId: currentActor.organizationId,
      startsOn: parsedBody.data.startsOn
    });
  }

  @Delete(":customerId/contracts/:contractId")
  @RequirePermissions("customer:manage")
  async deleteContract(
    @CurrentActor() actor: AuthenticatedActor | undefined,
    @Param("customerId") customerId: string,
    @Param("contractId") contractId: string
  ): Promise<CustomerDetail> {
    const currentActor = requireActor(actor);
    return this.customersService.deleteContract({ customerId, id: contractId, organizationId: currentActor.organizationId });
  }

  @Post(":customerId/assets")
  @RequirePermissions("asset:manage")
  async createAsset(
    @CurrentActor() actor: AuthenticatedActor | undefined,
    @Param("customerId") customerId: string,
    @Body() body: unknown
  ): Promise<CustomerDetail> {
    const currentActor = requireActor(actor);
    const parsedBody = assetWriteBodySchema.safeParse(body);

    if (!parsedBody.success) {
      throw new BadRequestException("Dados inválidos para criar ativo.");
    }

    return this.customersService.createAsset({
      customerId,
      model: parsedBody.data.model ?? null,
      name: parsedBody.data.name,
      organizationId: currentActor.organizationId,
      serialNumber: parsedBody.data.serialNumber ?? null,
      siteId: parsedBody.data.siteId,
      warrantyExpiresOn: parsedBody.data.warrantyExpiresOn ?? null
    });
  }

  @Patch(":customerId/assets/:assetId")
  @RequirePermissions("asset:manage")
  async updateAsset(
    @CurrentActor() actor: AuthenticatedActor | undefined,
    @Param("customerId") customerId: string,
    @Param("assetId") assetId: string,
    @Body() body: unknown
  ): Promise<CustomerDetail> {
    const currentActor = requireActor(actor);
    const parsedBody = assetWriteBodySchema.safeParse(body);

    if (!parsedBody.success) {
      throw new BadRequestException("Dados inválidos para atualizar ativo.");
    }

    return this.customersService.updateAsset({
      customerId,
      id: assetId,
      model: parsedBody.data.model ?? null,
      name: parsedBody.data.name,
      organizationId: currentActor.organizationId,
      serialNumber: parsedBody.data.serialNumber ?? null,
      siteId: parsedBody.data.siteId,
      warrantyExpiresOn: parsedBody.data.warrantyExpiresOn ?? null
    });
  }

  @Delete(":customerId/assets/:assetId")
  @RequirePermissions("asset:manage")
  async deleteAsset(
    @CurrentActor() actor: AuthenticatedActor | undefined,
    @Param("customerId") customerId: string,
    @Param("assetId") assetId: string
  ): Promise<CustomerDetail> {
    const currentActor = requireActor(actor);
    return this.customersService.deleteAsset({ customerId, id: assetId, organizationId: currentActor.organizationId });
  }
}

function requireActor(actor: AuthenticatedActor | undefined): AuthenticatedActor {
  if (!actor) {
    throw new UnauthorizedException("Ator autenticado não informado.");
  }

  return actor;
}
