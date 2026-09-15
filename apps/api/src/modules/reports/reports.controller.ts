import { BadRequestException, Controller, Get, Inject, Query, UnauthorizedException } from "@nestjs/common";
import type { AuthenticatedActor } from "@fieldops/auth";
import type { ReportOverview } from "@fieldops/types";
import { z } from "zod";

import { CurrentActor, RequirePermissions } from "../auth/auth.decorators.js";
import { ReportsService } from "./reports.service.js";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const overviewQuerySchema = z.object({
  from: dateSchema.optional(),
  teamId: z.string().trim().min(1).optional(),
  territoryId: z.string().trim().min(1).optional(),
  to: dateSchema.optional()
});

@Controller("reports")
export class ReportsController {
  constructor(@Inject(ReportsService) private readonly reportsService: ReportsService) {}

  @Get("overview")
  @RequirePermissions("report:read")
  async getOverview(
    @CurrentActor() actor: AuthenticatedActor | undefined,
    @Query() query: Record<string, string | string[] | undefined>
  ): Promise<ReportOverview> {
    const currentActor = requireActor(actor);
    const parsedQuery = overviewQuerySchema.safeParse(query);

    if (!parsedQuery.success) {
      throw new BadRequestException("Filtros inválidos para o relatório.");
    }

    const to = parsedQuery.data.to ?? new Date().toISOString().slice(0, 10);
    const from = parsedQuery.data.from ?? defaultFrom(to);

    return this.reportsService.getOverview({
      from,
      organizationId: currentActor.organizationId,
      teamId: parsedQuery.data.teamId,
      territoryId: parsedQuery.data.territoryId,
      to
    });
  }
}

function defaultFrom(to: string): string {
  const date = new Date(`${to}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 30);
  return date.toISOString().slice(0, 10);
}

function requireActor(actor: AuthenticatedActor | undefined): AuthenticatedActor {
  if (!actor) {
    throw new UnauthorizedException("Ator autenticado não informado.");
  }

  return actor;
}
