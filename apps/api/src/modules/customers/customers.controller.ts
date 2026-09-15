import { BadRequestException, Controller, Get, Inject, Param, Query, UnauthorizedException } from "@nestjs/common";
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
}

function requireActor(actor: AuthenticatedActor | undefined): AuthenticatedActor {
  if (!actor) {
    throw new UnauthorizedException("Ator autenticado não informado.");
  }

  return actor;
}
