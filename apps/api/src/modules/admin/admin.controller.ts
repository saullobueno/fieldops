import { Controller, Get, UnauthorizedException } from "@nestjs/common";
import type { AuthenticatedActor } from "@fieldops/auth";
import type { AdminCatalogSummary } from "@fieldops/types";

import { CurrentActor, RequirePermissions } from "../auth/auth.decorators.js";
import { AdminService } from "./admin.service.js";

@Controller("admin")
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get("catalog-summary")
  @RequirePermissions("admin:manage_roles")
  getCatalogSummary(
    @CurrentActor() actor: AuthenticatedActor | undefined
  ): Promise<AdminCatalogSummary> {
    const currentActor = requireActor(actor);
    return this.adminService.getCatalogSummary(currentActor.organizationId);
  }
}

function requireActor(actor: AuthenticatedActor | undefined): AuthenticatedActor {
  if (!actor) {
    throw new UnauthorizedException("Ator autenticado não informado.");
  }

  return actor;
}
