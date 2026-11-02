/**
 * Permission model.
 * Effective permission codes come from GET /api/v1/platform/me/permissions (user-organization).
 * PlatformSuperAdmin receives every active permission; a disabled platform user receives none.
 * These checks only shape the UI — every endpoint re-checks permissions server-side.
 */
export type PermissionRequirement =
  | string
  | { anyOf: readonly string[] }
  | { allOf: readonly string[] }
  | { role: string };

export interface AccessContext {
  permissions: ReadonlySet<string>;
  roles: ReadonlySet<string>;
}

export function hasPermission(ctx: AccessContext, code: string): boolean {
  return ctx.permissions.has(code.toLowerCase());
}

export function satisfies(ctx: AccessContext, requirement: PermissionRequirement | undefined): boolean {
  if (!requirement) return true;
  if (typeof requirement === "string") return hasPermission(ctx, requirement);
  if ("anyOf" in requirement) return requirement.anyOf.some((c) => hasPermission(ctx, c));
  if ("allOf" in requirement) return requirement.allOf.every((c) => hasPermission(ctx, c));
  return ctx.roles.has(requirement.role);
}

export function buildAccessContext(permissionCodes: readonly string[] | undefined, roleCodes: readonly string[] | undefined): AccessContext {
  return {
    // Backend compares permission codes case-insensitively.
    permissions: new Set((permissionCodes ?? []).map((c) => c.toLowerCase())),
    roles: new Set(roleCodes ?? []),
  };
}
