import { BadRequestException, Body, Controller, Get, Inject, Param, Post, UnauthorizedException } from "@nestjs/common";
import type { AuthenticatedActor } from "@fieldops/auth";
import { checklistFieldTypes } from "@fieldops/domain";
import type { ChecklistTemplateDetail, ChecklistTemplateListResponse, ChecklistVersionSummary } from "@fieldops/types";
import { z } from "zod";

import { CurrentActor, RequirePermissions } from "../auth/auth.decorators.js";
import { ChecklistTemplatesService } from "./checklist-templates.service.js";

const createVersionSchema = z.object({
  fields: z
    .array(
      z.object({
        isRequired: z.boolean(),
        key: z.string().trim().min(1),
        label: z.string().trim().min(1),
        type: z.enum(checklistFieldTypes),
        validation: z.record(z.string(), z.unknown()).optional()
      })
    )
    .min(1)
});

@Controller("checklist-templates")
export class ChecklistTemplatesController {
  constructor(@Inject(ChecklistTemplatesService) private readonly checklistTemplatesService: ChecklistTemplatesService) {}

  @Get()
  @RequirePermissions("admin:manage_roles")
  async list(
    @CurrentActor() actor: AuthenticatedActor | undefined
  ): Promise<ChecklistTemplateListResponse> {
    const currentActor = requireActor(actor);
    return this.checklistTemplatesService.list(currentActor.organizationId);
  }

  @Get(":id")
  @RequirePermissions("admin:manage_roles")
  async getById(
    @CurrentActor() actor: AuthenticatedActor | undefined,
    @Param("id") id: string
  ): Promise<ChecklistTemplateDetail> {
    const currentActor = requireActor(actor);
    return this.checklistTemplatesService.getById(id, currentActor.organizationId);
  }

  @Post(":id/versions")
  @RequirePermissions("admin:manage_roles")
  async createVersion(
    @CurrentActor() actor: AuthenticatedActor | undefined,
    @Param("id") id: string,
    @Body() body: unknown
  ): Promise<ChecklistVersionSummary> {
    const currentActor = requireActor(actor);
    const parsedBody = createVersionSchema.safeParse(body);

    if (!parsedBody.success) {
      throw new BadRequestException("Campos inválidos para nova versão de checklist.");
    }

    return this.checklistTemplatesService.createVersion({
      actorUserId: currentActor.id,
      fields: parsedBody.data.fields,
      organizationId: currentActor.organizationId,
      templateId: id
    });
  }
}

function requireActor(actor: AuthenticatedActor | undefined): AuthenticatedActor {
  if (!actor) {
    throw new UnauthorizedException("Ator autenticado não informado.");
  }

  return actor;
}
