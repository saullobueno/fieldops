import { BadRequestException, Body, Controller, Inject, Param, Post, UnauthorizedException } from "@nestjs/common";
import type { AuthenticatedActor } from "@fieldops/auth";
import type { CopilotApprovalResult, CopilotRecommendation } from "@fieldops/types";
import { z } from "zod";

import { CurrentActor, RequirePermissions } from "../auth/auth.decorators.js";
import { CopilotService } from "./copilot.service.js";

const askSchema = z.object({
  question: z.string().trim().min(3).max(500)
});

@Controller("copilot")
export class CopilotController {
  constructor(@Inject(CopilotService) private readonly copilotService: CopilotService) {}

  @Post("ask")
  @RequirePermissions("ai:read")
  async ask(
    @CurrentActor() actor: AuthenticatedActor | undefined,
    @Body() body: unknown
  ): Promise<CopilotRecommendation> {
    const currentActor = requireActor(actor);
    const parsedBody = askSchema.safeParse(body);

    if (!parsedBody.success) {
      throw new BadRequestException("Pergunta inválida para o copiloto.");
    }

    return this.copilotService.ask(currentActor, parsedBody.data.question);
  }

  @Post("recommendations/:id/approve")
  @RequirePermissions("work_order:assign")
  async approve(
    @CurrentActor() actor: AuthenticatedActor | undefined,
    @Param("id") id: string
  ): Promise<CopilotApprovalResult> {
    const currentActor = requireActor(actor);
    return this.copilotService.approve(currentActor, id);
  }
}

function requireActor(actor: AuthenticatedActor | undefined): AuthenticatedActor {
  if (!actor) {
    throw new UnauthorizedException("Ator autenticado não informado.");
  }

  return actor;
}
