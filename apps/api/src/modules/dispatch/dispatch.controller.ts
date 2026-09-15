import { BadRequestException, Body, Controller, Get, Inject, Param, Post, Query, UnauthorizedException } from "@nestjs/common";
import type { AuthenticatedActor } from "@fieldops/auth";
import type { DispatchAssignmentResult, DispatchBoard, DispatchCandidate } from "@fieldops/types";
import { z } from "zod";

import { CurrentActor, RequirePermissions } from "../auth/auth.decorators.js";
import { DispatchService } from "./dispatch.service.js";

const boardQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
});

const createAssignmentSchema = z.object({
  technicianId: z.string().trim().min(1),
  workOrderId: z.string().trim().min(1)
});

@Controller("dispatch")
export class DispatchController {
  constructor(@Inject(DispatchService) private readonly dispatchService: DispatchService) {}

  @Get("board")
  @RequirePermissions("schedule:read")
  async getBoard(
    @CurrentActor() actor: AuthenticatedActor | undefined,
    @Query() query: Record<string, string | string[] | undefined>
  ): Promise<DispatchBoard> {
    const currentActor = requireActor(actor);
    const parsedQuery = boardQuerySchema.safeParse(query);

    if (!parsedQuery.success) {
      throw new BadRequestException("Data inválida para o painel de despacho.");
    }

    const date = parsedQuery.data.date ?? new Date().toISOString().slice(0, 10);
    return this.dispatchService.getBoard(currentActor.organizationId, date);
  }

  @Get("candidates/:workOrderId")
  @RequirePermissions("work_order:assign")
  async getCandidates(
    @CurrentActor() actor: AuthenticatedActor | undefined,
    @Param("workOrderId") workOrderId: string
  ): Promise<readonly DispatchCandidate[]> {
    const currentActor = requireActor(actor);
    return this.dispatchService.getCandidates(workOrderId, currentActor.organizationId);
  }

  @Post("assignments")
  @RequirePermissions("work_order:assign")
  async createAssignment(
    @CurrentActor() actor: AuthenticatedActor | undefined,
    @Body() body: unknown
  ): Promise<DispatchAssignmentResult> {
    const currentActor = requireActor(actor);
    const parsedBody = createAssignmentSchema.safeParse(body);

    if (!parsedBody.success) {
      throw new BadRequestException("Payload inválido para atribuição de despacho.");
    }

    return this.dispatchService.createAssignment({
      actorUserId: currentActor.id,
      organizationId: currentActor.organizationId,
      technicianId: parsedBody.data.technicianId,
      workOrderId: parsedBody.data.workOrderId
    });
  }
}

function requireActor(actor: AuthenticatedActor | undefined): AuthenticatedActor {
  if (!actor) {
    throw new UnauthorizedException("Ator autenticado não informado.");
  }

  return actor;
}
