import type { Permission } from "@fieldops/auth";

export const REQUIRED_PERMISSIONS_KEY = Symbol("required_permissions");

export interface RequiredPermissionsMetadata {
  permissions: readonly Permission[];
}
