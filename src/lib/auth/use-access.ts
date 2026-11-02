import { useCallback } from "react";
import { satisfies, type PermissionRequirement } from "@/lib/permissions/permissions";
import { useAuth } from "./auth-context";

/** UI permission checks. The backend re-validates every request. */
export function useAccess() {
  const { access } = useAuth();
  const can = useCallback((requirement?: PermissionRequirement) => satisfies(access, requirement), [access]);
  const isSuperAdmin = access.roles.has("PlatformSuperAdmin");
  return { can, isSuperAdmin, access };
}
