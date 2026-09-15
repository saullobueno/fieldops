import { Controller, Get, Inject, UnauthorizedException } from "@nestjs/common";
import type { AuthenticatedActor } from "@fieldops/auth";
import type { WorkOrderSummary } from "@fieldops/types";

import { CurrentActor, RequirePermissions } from "../auth/auth.decorators.js";
import { WorkOrdersService } from "../work-orders/work-orders.service.js";

@Controller("technician")
export class TechnicianController {
  constructor(@Inject(WorkOrdersService) private readonly workOrdersService: WorkOrdersService) {}

  @Get("work-orders")
  @RequirePermissions("work_order:read")
  async listMyWorkOrders(
    @CurrentActor() actor: AuthenticatedActor | undefined
  ): Promise<readonly WorkOrderSummary[]> {
    const currentActor = requireActor(actor);
    return this.workOrdersService.listForTechnician(currentActor.id, currentActor.organizationId);
  }
}

function requireActor(actor: AuthenticatedActor | undefined): AuthenticatedActor {
  if (!actor) {
    throw new UnauthorizedException("Ator autenticado não informado.");
  }

  return actor;
}
