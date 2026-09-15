import { Controller, Get, Inject, Param, UnauthorizedException } from "@nestjs/common";
import type { AuthenticatedActor } from "@fieldops/auth";
import type { AssetDetail } from "@fieldops/types";

import { CurrentActor, RequirePermissions } from "../auth/auth.decorators.js";
import { AssetsService } from "./assets.service.js";

@Controller("assets")
export class AssetsController {
  constructor(@Inject(AssetsService) private readonly assetsService: AssetsService) {}

  @Get(":id")
  @RequirePermissions("asset:read")
  async getById(
    @CurrentActor() actor: AuthenticatedActor | undefined,
    @Param("id") id: string
  ): Promise<AssetDetail> {
    const currentActor = requireActor(actor);
    return this.assetsService.getById(id, currentActor.organizationId);
  }
}

function requireActor(actor: AuthenticatedActor | undefined): AuthenticatedActor {
  if (!actor) {
    throw new UnauthorizedException("Ator autenticado não informado.");
  }

  return actor;
}
