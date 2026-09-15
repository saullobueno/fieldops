import { BadRequestException, Body, Controller, ForbiddenException, Inject, Post, Query, Sse } from "@nestjs/common";
import { permissions, type AuthenticatedActor, type Permission } from "@fieldops/auth";
import type { MessageEvent } from "@nestjs/common";
import type { Observable } from "rxjs";
import { z } from "zod";

import { CurrentActor, RequirePermissions } from "../auth/auth.decorators.js";
import { RealtimeService } from "./realtime.service.js";

const permissionSet = new Set<Permission>(permissions);

const streamQuerySchema = z.object({
  organizationId: z.string().trim().min(1),
  permissions: z.string().trim().min(1)
});

const technicianLocationSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  technicianName: z.string().trim().min(1).max(200)
});

@Controller("realtime")
export class RealtimeController {
  constructor(@Inject(RealtimeService) private readonly realtimeService: RealtimeService) {}

  /**
   * EventSource não permite cabeçalhos customizados, então esta rota resolve o ator
   * a partir da query string em vez do AuthGuard baseado em headers usado nas demais rotas.
   */
  @Sse("stream")
  stream(@Query() query: Record<string, string | string[] | undefined>): Observable<MessageEvent> {
    const parsedQuery = streamQuerySchema.safeParse(query);

    if (!parsedQuery.success) {
      throw new BadRequestException("Parâmetros inválidos para o stream de eventos.");
    }

    const actorPermissions = parsedQuery.data.permissions
      .split(",")
      .map((item) => item.trim())
      .filter((item): item is Permission => permissionSet.has(item as Permission));

    if (!actorPermissions.includes("work_order:read")) {
      throw new ForbiddenException("Permissão insuficiente para o stream de eventos.");
    }

    return this.realtimeService.stream(parsedQuery.data.organizationId);
  }

  @Post("technician-location")
  @RequirePermissions("work_order:update")
  reportTechnicianLocation(
    @CurrentActor() actor: AuthenticatedActor | undefined,
    @Body() body: unknown
  ): { published: true } {
    if (!actor) {
      throw new ForbiddenException("Ator autenticado não informado.");
    }

    const parsedBody = technicianLocationSchema.safeParse(body);
    if (!parsedBody.success) {
      throw new BadRequestException("Dados inválidos para localização do técnico.");
    }

    this.realtimeService.publish(actor.organizationId, {
      data: {
        latitude: parsedBody.data.latitude,
        longitude: parsedBody.data.longitude,
        technicianId: actor.id,
        technicianName: parsedBody.data.technicianName
      },
      type: "technician_location_updated"
    });

    return { published: true };
  }
}
