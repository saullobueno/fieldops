import { BadRequestException, Controller, Get, Inject, Param, Query, UnauthorizedException } from "@nestjs/common";
import type { AuthenticatedActor } from "@fieldops/auth";
import type { DashboardWidgetKey, DashboardWidgetPayload } from "@fieldops/types";
import { z } from "zod";

import { CurrentActor, RequirePermissions } from "../auth/auth.decorators.js";
import { DashboardService } from "./dashboard.service.js";

const widgetSchema = z.enum([
  "kpis",
  "dispatch-preview",
  "sla-risk",
  "active-services-map",
  "recent-work-orders",
  "technician-utilization",
  "ai-insights"
]);

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(6)
});

@Controller("dashboard")
export class DashboardController {
  constructor(@Inject(DashboardService) private readonly dashboardService: DashboardService) {}

  @Get("widgets/:widget")
  @RequirePermissions("report:read")
  async getWidget(
    @CurrentActor() actor: AuthenticatedActor | undefined,
    @Param("widget") widget: string,
    @Query() query: Record<string, string | string[] | undefined>
  ): Promise<DashboardWidgetPayload> {
    const currentActor = requireActor(actor);
    const parsedWidget = widgetSchema.safeParse(widget);
    const parsedQuery = querySchema.safeParse(query);

    if (!parsedWidget.success || !parsedQuery.success) {
      throw new BadRequestException("Parâmetros inválidos para o widget do dashboard.");
    }

    return this.dashboardService.getWidget(
      parsedWidget.data satisfies DashboardWidgetKey,
      parsedQuery.data.limit,
      { organizationId: currentActor.organizationId }
    );
  }
}

function requireActor(actor: AuthenticatedActor | undefined): AuthenticatedActor {
  if (!actor) {
    throw new UnauthorizedException("Ator autenticado não informado.");
  }

  return actor;
}
