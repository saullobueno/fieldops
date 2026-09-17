import { Controller, Get, Inject, UnauthorizedException } from "@nestjs/common";
import type { AuthenticatedActor } from "@fieldops/auth";
import type { MapOverview } from "@fieldops/types";

import { CurrentActor, RequirePermissions } from "../auth/auth.decorators.js";
import { MapOverviewService } from "./map-overview.service.js";

@Controller("maps")
export class MapsController {
  constructor(@Inject(MapOverviewService) private readonly mapOverviewService: MapOverviewService) {}

  @Get("overview")
  @RequirePermissions("schedule:read")
  async getOverview(@CurrentActor() actor: AuthenticatedActor | undefined): Promise<MapOverview> {
    const currentActor = requireActor(actor);
    return this.mapOverviewService.getOverview(currentActor.organizationId);
  }
}

function requireActor(actor: AuthenticatedActor | undefined): AuthenticatedActor {
  if (!actor) {
    throw new UnauthorizedException("Ator autenticado não informado.");
  }

  return actor;
}
