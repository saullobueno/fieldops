import bcrypt from "bcryptjs";

const PASSWORD_SALT_ROUNDS = 12;

export async function hashPassword(plainTextPassword: string): Promise<string> {
  return bcrypt.hash(plainTextPassword, PASSWORD_SALT_ROUNDS);
}

export async function verifyPassword(plainTextPassword: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(plainTextPassword, passwordHash);
}

export interface AuthenticatedActor {
  id: string;
  organizationId: string;
  roleIds: readonly string[];
  permissions: readonly Permission[];
  teamIds: readonly string[];
  territoryIds: readonly string[];
}

export const permissions = [
  "work_order:read",
  "work_order:create",
  "work_order:update",
  "work_order:assign",
  "work_order:cancel",
  "schedule:read",
  "schedule:update",
  "customer:read",
  "customer:manage",
  "asset:read",
  "asset:manage",
  "technician:read",
  "report:read",
  "notification:read",
  "notification:update",
  "admin:manage_users",
  "admin:manage_roles",
  "audit_log:read",
  "ai:read"
] as const;

export type Permission = (typeof permissions)[number];

export interface OrganizationScopedResource {
  organizationId: string;
  teamId?: string | null;
  territoryId?: string | null;
  assignedUserId?: string | null;
  assignedTechnicianUserId?: string | null;
}

export interface AuthorizationDecision {
  allowed: boolean;
  reason?: string;
}

export function hasPermission(
  actor: AuthenticatedActor,
  permission: Permission
): boolean {
  return actor.permissions.includes(permission);
}

export function authorizeOrganizationAccess(
  actor: AuthenticatedActor,
  resource: OrganizationScopedResource
): AuthorizationDecision {
  if (actor.organizationId !== resource.organizationId) {
    return {
      allowed: false,
      reason: "Recurso pertence a outra organização."
    };
  }

  return { allowed: true };
}

export function authorizeObjectAccess(
  actor: AuthenticatedActor,
  permission: Permission,
  resource: OrganizationScopedResource
): AuthorizationDecision {
  if (!hasPermission(actor, permission)) {
    return {
      allowed: false,
      reason: "Ator não possui a permissão necessária."
    };
  }

  const organizationDecision = authorizeOrganizationAccess(actor, resource);
  if (!organizationDecision.allowed) {
    return organizationDecision;
  }

  if (resource.assignedUserId === actor.id || resource.assignedTechnicianUserId === actor.id) {
    return { allowed: true };
  }

  if (resource.teamId && actor.teamIds.includes(resource.teamId)) {
    return { allowed: true };
  }

  if (resource.territoryId && actor.territoryIds.includes(resource.territoryId)) {
    return { allowed: true };
  }

  if (actor.permissions.includes("admin:manage_roles")) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: "Ator não possui escopo de equipe, território ou atribuição para este recurso."
  };
}
