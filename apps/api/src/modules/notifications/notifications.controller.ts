import { BadRequestException, Body, Controller, Get, Inject, Param, Patch, Query, UnauthorizedException } from "@nestjs/common";
import type { AuthenticatedActor } from "@fieldops/auth";
import type {
  NotificationListResponse,
  NotificationPreferencesResponse,
  NotificationStatus
} from "@fieldops/types";
import { z } from "zod";

import { CurrentActor, RequirePermissions } from "../auth/auth.decorators.js";
import { NotificationsService } from "./notifications.service.js";

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  status: z.enum(["unread", "read", "archived"]).optional(),
  type: z.string().trim().min(1).max(80).optional()
});

const updateStatusSchema = z.object({
  status: z.enum(["unread", "read", "archived"])
});

const updatePreferencesSchema = z.object({
  preferences: z.array(z.object({
    channels: z.array(z.enum(["in_app", "email", "sms"])).default(["in_app"]),
    enabled: z.boolean(),
    type: z.string().trim().min(1).max(80)
  })).min(1).max(20)
});

@Controller("notifications")
export class NotificationsController {
  constructor(@Inject(NotificationsService) private readonly notificationsService: NotificationsService) {}

  @Get()
  @RequirePermissions("notification:read")
  list(
    @CurrentActor() actor: AuthenticatedActor | undefined,
    @Query() query: Record<string, string | string[] | undefined>
  ): Promise<NotificationListResponse> {
    const currentActor = requireActor(actor);
    const parsedQuery = listQuerySchema.safeParse(query);

    if (!parsedQuery.success) {
      throw new BadRequestException("Filtros inválidos para notificações.");
    }

    return this.notificationsService.list({
      organizationId: currentActor.organizationId,
      userId: currentActor.id,
      ...parsedQuery.data
    });
  }

  @Patch(":id/status")
  @RequirePermissions("notification:update")
  updateStatus(
    @CurrentActor() actor: AuthenticatedActor | undefined,
    @Param("id") id: string,
    @Body() body: unknown
  ): Promise<NotificationListResponse> {
    const currentActor = requireActor(actor);
    const parsedBody = updateStatusSchema.safeParse(body);

    if (!parsedBody.success) {
      throw new BadRequestException("Status inválido para notificação.");
    }

    return this.notificationsService.updateStatus({
      id,
      organizationId: currentActor.organizationId,
      status: parsedBody.data.status,
      userId: currentActor.id
    });
  }

  @Get("preferences")
  @RequirePermissions("notification:read")
  getPreferences(
    @CurrentActor() actor: AuthenticatedActor | undefined
  ): NotificationPreferencesResponse {
    const currentActor = requireActor(actor);
    return this.notificationsService.getPreferences(currentActor.id);
  }

  @Patch("preferences")
  @RequirePermissions("notification:update")
  updatePreferences(
    @CurrentActor() actor: AuthenticatedActor | undefined,
    @Body() body: unknown
  ): NotificationPreferencesResponse {
    const currentActor = requireActor(actor);
    const parsedBody = updatePreferencesSchema.safeParse(body);

    if (!parsedBody.success) {
      throw new BadRequestException("Preferências inválidas para notificações.");
    }

    return this.notificationsService.updatePreferences({
      preferences: parsedBody.data.preferences,
      userId: currentActor.id
    });
  }
}

function requireActor(actor: AuthenticatedActor | undefined): AuthenticatedActor {
  if (!actor) {
    throw new UnauthorizedException("Ator autenticado não informado.");
  }

  return actor;
}
