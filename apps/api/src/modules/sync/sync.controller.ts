import { BadRequestException, Body, Controller, Inject, Post, UnauthorizedException } from "@nestjs/common";
import type { AuthenticatedActor } from "@fieldops/auth";
import { workOrderStatuses } from "@fieldops/domain";
import type { SyncBatchResponse } from "@fieldops/types";
import { z } from "zod";

import { CurrentActor, RequirePermissions } from "../auth/auth.decorators.js";
import { SyncService } from "./sync.service.js";

const operationSchema = z.discriminatedUnion("type", [
  z.object({
    idempotencyKey: z.string().trim().min(1),
    payload: z.object({ status: z.enum(workOrderStatuses) }),
    type: z.literal("status_change"),
    workOrderId: z.string().trim().min(1)
  }),
  z.object({
    idempotencyKey: z.string().trim().min(1),
    payload: z.object({ answers: z.record(z.string(), z.unknown()) }),
    type: z.literal("checklist_update"),
    workOrderId: z.string().trim().min(1)
  }),
  z.object({
    idempotencyKey: z.string().trim().min(1),
    payload: z.object({ body: z.string().trim().min(1).max(2_000) }),
    type: z.literal("note_add"),
    workOrderId: z.string().trim().min(1)
  })
]);

const batchSchema = z.object({
  deviceSessionId: z.string().trim().min(1),
  operations: z.array(operationSchema).min(1).max(50)
});

@Controller("sync")
export class SyncController {
  constructor(@Inject(SyncService) private readonly syncService: SyncService) {}

  @Post("operations")
  @RequirePermissions("work_order:update")
  async processOperations(
    @CurrentActor() actor: AuthenticatedActor | undefined,
    @Body() body: unknown
  ): Promise<SyncBatchResponse> {
    const currentActor = requireActor(actor);
    const parsedBody = batchSchema.safeParse(body);

    if (!parsedBody.success) {
      throw new BadRequestException("Lote de sincronização inválido.");
    }

    const results = await this.syncService.processBatch(currentActor, parsedBody.data);
    return { results };
  }
}

function requireActor(actor: AuthenticatedActor | undefined): AuthenticatedActor {
  if (!actor) {
    throw new UnauthorizedException("Ator autenticado não informado.");
  }

  return actor;
}
