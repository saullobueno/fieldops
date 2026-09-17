import { Controller, Get, Inject, UnauthorizedException } from "@nestjs/common";
import type { AuthenticatedActor } from "@fieldops/auth";
import type { TechnicianListResponse } from "@fieldops/types";

import { CurrentActor, RequirePermissions } from "../auth/auth.decorators.js";
import { TechniciansService } from "./technicians.service.js";

@Controller("technicians")
export class TechniciansController {
  constructor(@Inject(TechniciansService) private readonly techniciansService: TechniciansService) {}

  @Get()
  @RequirePermissions("technician:read")
  async list(@CurrentActor() actor: AuthenticatedActor | undefined): Promise<TechnicianListResponse> {
    const currentActor = requireActor(actor);
    return this.techniciansService.list(currentActor.organizationId);
  }
}

function requireActor(actor: AuthenticatedActor | undefined): AuthenticatedActor {
  if (!actor) {
    throw new UnauthorizedException("Ator autenticado não informado.");
  }

  return actor;
}
