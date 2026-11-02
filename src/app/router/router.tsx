import { createBrowserRouter, type RouteObject } from "react-router";
import { AppLayout } from "@/app/layouts/app-layout";
import { RedirectIfAuthenticated, RequireAuth } from "@/lib/auth/guards";
import { RouteError } from "./route-error";

/** Lazily loads a page module's default export (route-level code splitting). */
const page = (loader: () => Promise<{ default: React.ComponentType }>) => async () => ({ Component: (await loader()).default });

const appRoutes: RouteObject[] = [
  { index: true, lazy: page(() => import("@/features/dashboard/dashboard-page")), handle: { crumb: "Dashboard" } },
  { path: "my", lazy: page(() => import("@/features/inspections/my-inspections-page")), handle: { crumb: "My inspections" } },
  {
    path: "inspections",
    handle: { crumb: "Inspections" },
    children: [
      { index: true, lazy: page(() => import("@/features/inspections/inspections-page")) },
      { path: ":inspectionId", lazy: page(() => import("@/features/inspections/inspection-detail-page")), handle: { crumb: "Inspection" } },
    ],
  },
  {
    path: "corrections",
    handle: { crumb: "Listing corrections" },
    children: [
      { index: true, lazy: page(() => import("@/features/corrections/corrections-page")) },
      { path: ":correctionId", lazy: page(() => import("@/features/corrections/correction-detail-page")), handle: { crumb: "Proposal" } },
    ],
  },
  {
    path: "disputes",
    handle: { crumb: "Inspection disputes" },
    children: [
      { index: true, lazy: page(() => import("@/features/disputes/disputes-page")) },
      { path: ":disputeId", lazy: page(() => import("@/features/disputes/dispute-detail-page")), handle: { crumb: "Dispute" } },
    ],
  },
  {
    path: "account",
    handle: { crumb: "My profile" },
    children: [
      { index: true, lazy: page(() => import("@/features/account/profile-page")) },
      { path: "security", lazy: page(() => import("@/features/account/security-page")), handle: { crumb: "Security" } },
    ],
  },
  { path: "*", lazy: page(() => import("@/features/errors/not-found-page")), handle: { crumb: "Not found" } },
];

export const routes: RouteObject[] = [
  {
    errorElement: <RouteError />,
    children: [
      {
        element: <RedirectIfAuthenticated />,
        children: [
          { path: "login", lazy: page(() => import("@/features/auth/login-page")) },
          { path: "forgot-password", lazy: page(() => import("@/features/auth/forgot-password-page")) },
        ],
      },
      { path: "reset-password", lazy: page(() => import("@/features/auth/reset-password-page")) },
      // Link in the invitation email. Public: invitees usually have no admin access until they accept.
      { path: "platform/invitation", lazy: page(() => import("@/features/auth/accept-invitation-page")) },
      {
        element: <RequireAuth />,
        children: [{ path: "/", element: <AppLayout />, errorElement: <RouteError />, children: appRoutes }],
      },
    ],
  },
];

export function createAppRouter() {
  return createBrowserRouter(routes, { basename: import.meta.env.BASE_URL.replace(/\/$/, "") || "/" });
}
