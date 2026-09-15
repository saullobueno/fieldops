import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
  permissions,
  type AuthenticatedActor,
  type Permission
} from "@fieldops/auth";
import { createHmac, timingSafeEqual } from "node:crypto";

import {
  REQUIRED_PERMISSIONS_KEY,
  type RequiredPermissionsMetadata
} from "./auth.constants.js";
import type { AuthenticatedRequest } from "./auth.decorators.js";

const permissionSet = new Set<Permission>(permissions);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const metadata = this.reflector.getAllAndOverride<RequiredPermissionsMetadata>(
      REQUIRED_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()]
    );

    if (!metadata) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const actor = parseActorFromHeaders(request);
    request.actor = actor;

    const missingPermission = metadata.permissions.find(
      (permission) => !actor.permissions.includes(permission)
    );

    if (missingPermission) {
      throw new ForbiddenException("Permissão insuficiente para executar esta ação.");
    }

    return true;
  }
}

export function parseActorFromHeaders(request: AuthenticatedRequest): AuthenticatedActor {
  const bearerToken = readBearerToken(request);

  if (bearerToken) {
    return parseActorFromSignedToken(bearerToken);
  }

  const userId = readSingleHeader(request, "x-fieldops-user-id");
  const organizationId = readSingleHeader(request, "x-fieldops-organization-id");

  if (!userId || !organizationId) {
    throw new UnauthorizedException("Ator autenticado não informado.");
  }

  return {
    id: userId,
    organizationId,
    permissions: parsePermissions(readSingleHeader(request, "x-fieldops-permissions")),
    roleIds: parseListHeader(readSingleHeader(request, "x-fieldops-role-ids")),
    teamIds: parseListHeader(readSingleHeader(request, "x-fieldops-team-ids")),
    territoryIds: parseListHeader(readSingleHeader(request, "x-fieldops-territory-ids"))
  };
}

export function createSignedActorToken(actor: AuthenticatedActor, secret = authTokenSecret()): string {
  const payload = Buffer.from(JSON.stringify(actor)).toString("base64url");
  const signature = signPayload(payload, secret);

  return `${payload}.${signature}`;
}

function readSingleHeader(
  request: AuthenticatedRequest,
  name: string
): string | undefined {
  const value = request.headers[name];

  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function readBearerToken(request: AuthenticatedRequest): string | undefined {
  const header = readSingleHeader(request, "authorization");
  const [scheme, token] = header?.split(" ") ?? [];

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return undefined;
  }

  return token;
}

function parseActorFromSignedToken(token: string): AuthenticatedActor {
  const [payload, signature] = token.split(".");

  if (!payload || !signature) {
    throw new UnauthorizedException("Sessão inválida.");
  }

  const expected = signPayload(payload, authTokenSecret());
  const providedSignature = Buffer.from(signature);
  const expectedSignature = Buffer.from(expected);

  if (
    providedSignature.length !== expectedSignature.length ||
    !timingSafeEqual(providedSignature, expectedSignature)
  ) {
    throw new UnauthorizedException("Sessão inválida.");
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<AuthenticatedActor>;

    if (!parsed.id || !parsed.organizationId) {
      throw new UnauthorizedException("Sessão sem ator válido.");
    }

    return {
      id: parsed.id,
      organizationId: parsed.organizationId,
      permissions: (parsed.permissions ?? []).filter((item): item is Permission =>
        permissionSet.has(item)
      ),
      roleIds: parsed.roleIds ?? [],
      teamIds: parsed.teamIds ?? [],
      territoryIds: parsed.territoryIds ?? []
    };
  } catch (error) {
    if (error instanceof UnauthorizedException) {
      throw error;
    }

    throw new UnauthorizedException("Sessão inválida.");
  }
}

function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function authTokenSecret(): string {
  return process.env.FIELDOPS_SESSION_SECRET ?? "fieldops-demo-session-secret";
}

function parseListHeader(value: string | undefined): readonly string[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parsePermissions(value: string | undefined): readonly Permission[] {
  return parseListHeader(value).filter((item): item is Permission =>
    permissionSet.has(item as Permission)
  );
}
