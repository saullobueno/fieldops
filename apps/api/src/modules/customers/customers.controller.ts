import { BadRequestException, Body, Controller, Get, Inject, Param, Patch, Post, Query, UnauthorizedException } from "@nestjs/common";
import type { AuthenticatedActor } from "@fieldops/auth";
import type { CustomerDetail, CustomerListResponse } from "@fieldops/types";
import { z } from "zod";

import { CurrentActor, RequirePermissions } from "../auth/auth.decorators.js";
import { CustomersService } from "./customers.service.js";

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  search: z.string().optional()
});

const writeBodySchema = z.object({
  externalRef: z.string().trim().min(1).max(100).nullable().optional(),
  name: z.string().trim().min(1).max(200),
  notes: z.string().trim().max(2_000).nullable().optional()
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
}

function requireActor(actor: AuthenticatedActor | undefined): AuthenticatedActor {
  if (!actor) {
    throw new UnauthorizedException("Ator autenticado não informado.");
  }

  return actor;
}
