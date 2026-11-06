import * as React from "react";
import { Navigate, Outlet, useLocation } from "react-router";
import { PermissionDenied } from "@/components/feedback/states";
import type { PermissionRequirement } from "@/lib/permissions/permissions";
import { isPlatformStaff, useAuth } from "./auth-context";
import { useAccess } from "./use-access";
import { BrandLoader } from "@/components/feedback/brand-loader";

function FullScreenLoader() {
  return <BrandLoader fullScreen />;
}

/**
 * Requires an authenticated platform-staff session; otherwise redirects to /login preserving the target. A signed-in
 * account with no platform role or permission (a marketplace buyer or seller) is signed out here as a backstop to the
 * sign-in check, e.g. if their last admin role was removed while they were signed in.
 */
export function RequireAuth() {
  const { status, access, denyAccess } = useAuth();
  const location = useLocation();
  const denied = status === "authenticated" && !isPlatformStaff(access);
  React.useEffect(() => {
    if (denied) void denyAccess();
  }, [denied, denyAccess]);
  if (status === "initializing" || denied) return <FullScreenLoader />;
  if (status === "anonymous") {
    const next = location.pathname + location.search;
    return <Navigate to={next && next !== "/" ? `/login?next=${encodeURIComponent(next)}` : "/login"} replace />;
  }
  return <Outlet />;
}

/** Keeps signed-in users away from the login screens. */
export function RedirectIfAuthenticated() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === "initializing") return <FullScreenLoader />;
  if (status === "authenticated") {
    const next = new URLSearchParams(location.search).get("next");
    return <Navigate to={next && next.startsWith("/") && !next.startsWith("//") ? next : "/"} replace />;
  }
  return <Outlet />;
}

export function RequirePermission({ permission, children }: { permission: PermissionRequirement; children: React.ReactNode }) {
  const { can } = useAccess();
  if (!can(permission)) return <PermissionDenied />;
  return <>{children}</>;
}
