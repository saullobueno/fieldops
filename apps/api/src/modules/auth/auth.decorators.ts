import { createParamDecorator, SetMetadata } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import type { AuthenticatedActor, Permission } from "@fieldops/auth";
import type { Request } from "express";

import { REQUIRED_PERMISSIONS_KEY } from "./auth.constants.js";

export interface AuthenticatedRequest extends Request {
  actor?: AuthenticatedActor;
}

export function RequirePermissions(...requiredPermissions: Permission[]): MethodDecorator {
  return SetMetadata(REQUIRED_PERMISSIONS_KEY, {
    permissions: requiredPermissions
  });
}

export const CurrentActor = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedActor | undefined => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.actor;
  }
);
