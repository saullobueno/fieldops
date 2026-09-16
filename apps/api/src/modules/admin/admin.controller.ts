import { BadRequestException, Body, Controller, Get, Inject, Param, Post, UnauthorizedException } from "@nestjs/common";
import type { AuthenticatedActor } from "@fieldops/auth";
import type { AdminCatalogSummary, NamedOption, UserAccountSummary } from "@fieldops/types";
import { z } from "zod";

import { CurrentActor, RequirePermissions } from "../auth/auth.decorators.js";
import { UsersService, type InviteUserResult } from "../users/users.service.js";
import { AdminService } from "./admin.service.js";

const inviteBodySchema = z.object({
  email: z.string().trim().email(),
  name: z.string().trim().min(1).max(200),
  roleIds: z.array(z.string().trim().min(1)).default([])
});

@Controller("admin")
export class AdminController {
  constructor(
    @Inject(AdminService) private readonly adminService: AdminService,
    @Inject(UsersService) private readonly usersService: UsersService
  ) {}

  @Get("catalog-summary")
  @RequirePermissions("admin:manage_roles")
  getCatalogSummary(
    @CurrentActor() actor: AuthenticatedActor | undefined
  ): Promise<AdminCatalogSummary> {
    const currentActor = requireActor(actor);
    return this.adminService.getCatalogSummary(currentActor.organizationId);
  }

  @Get("users")
  @RequirePermissions("admin:manage_users")
  listUsers(@CurrentActor() actor: AuthenticatedActor | undefined): Promise<readonly UserAccountSummary[]> {
    return this.usersService.list(requireActor(actor).organizationId);
  }

  @Get("roles")
  @RequirePermissions("admin:manage_users")
  listRoles(@CurrentActor() actor: AuthenticatedActor | undefined): Promise<readonly NamedOption[]> {
    return this.usersService.listRoles(requireActor(actor).organizationId);
  }

  @Post("users")
  @RequirePermissions("admin:manage_users")
  inviteUser(
    @CurrentActor() actor: AuthenticatedActor | undefined,
    @Body() body: unknown
  ): Promise<InviteUserResult> {
    const currentActor = requireActor(actor);
    const parsedBody = inviteBodySchema.safeParse(body);

    if (!parsedBody.success) {
      throw new BadRequestException("Dados inválidos para convidar usuário.");
    }

    return this.usersService.invite({ organizationId: currentActor.organizationId, ...parsedBody.data });
  }

  @Post("users/:id/resend-invite")
  @RequirePermissions("admin:manage_users")
  resendInvite(
    @CurrentActor() actor: AuthenticatedActor | undefined,
    @Param("id") id: string
  ): Promise<{ inviteLink: string }> {
    return this.usersService.resendInvite(requireActor(actor).organizationId, id);
  }

  @Post("users/:id/disable")
  @RequirePermissions("admin:manage_users")
  disableUser(
    @CurrentActor() actor: AuthenticatedActor | undefined,
    @Param("id") id: string
  ): Promise<UserAccountSummary> {
    return this.usersService.setStatus(requireActor(actor).organizationId, id, "disabled");
  }

  @Post("users/:id/enable")
  @RequirePermissions("admin:manage_users")
  enableUser(
    @CurrentActor() actor: AuthenticatedActor | undefined,
    @Param("id") id: string
  ): Promise<UserAccountSummary> {
    return this.usersService.setStatus(requireActor(actor).organizationId, id, "active");
  }
}

function requireActor(actor: AuthenticatedActor | undefined): AuthenticatedActor {
  if (!actor) {
    throw new UnauthorizedException("Ator autenticado não informado.");
  }

  return actor;
}
