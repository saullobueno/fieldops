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

export const SESSION_COOKIE_NAME = "fieldops_session";
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

interface SignedTokenPayload {
  readonly actor: AuthenticatedActor;
  readonly exp: number;
}

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
  const sessionCookie = readSessionCookie(request);
  if (sessionCookie) {
    return parseActorFromSignedToken(sessionCookie);
  }

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
  const tokenPayload: SignedTokenPayload = { actor, exp: Date.now() + SESSION_TTL_MS };
  const payload = Buffer.from(JSON.stringify(tokenPayload)).toString("base64url");
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

function readSessionCookie(request: AuthenticatedRequest): string | undefined {
  return parseCookieHeader(readSingleHeader(request, "cookie"))[SESSION_COOKIE_NAME];
}

function parseCookieHeader(header: string | undefined): Record<string, string> {
  if (!header) {
    return {};
  }

  const cookies: Record<string, string> = {};
  for (const part of header.split(";")) {
    const separatorIndex = part.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = part.slice(0, separatorIndex).trim();
    const value = part.slice(separatorIndex + 1).trim();
    if (key) {
      cookies[key] = decodeURIComponent(value);
    }
  }

  return cookies;
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
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<SignedTokenPayload>;
    const actor = parsed.actor;

    if (!actor?.id || !actor.organizationId) {
      throw new UnauthorizedException("Sessão sem ator válido.");
    }

    if (typeof parsed.exp !== "number" || Date.now() > parsed.exp) {
      throw new UnauthorizedException("Sessão expirada.");
    }

    return {
      id: actor.id,
      organizationId: actor.organizationId,
      permissions: (actor.permissions ?? []).filter((item): item is Permission =>
        permissionSet.has(item)
      ),
      roleIds: actor.roleIds ?? [],
      teamIds: actor.teamIds ?? [],
      territoryIds: actor.territoryIds ?? []
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
