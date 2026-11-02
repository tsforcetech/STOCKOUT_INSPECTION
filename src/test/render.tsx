import type * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider, type RouteObject } from "react-router";
import { render } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/misc";
import { AuthProvider } from "@/lib/auth/auth-context";
import { ThemeProvider } from "@/app/providers/theme";
import { Toaster } from "sonner";

export function renderWithApp(routes: RouteObject[], initialPath: string, extra?: React.ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const router = createMemoryRouter(routes, { initialEntries: [initialPath] });
  const utils = render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthProvider>
            <RouterProvider router={router} />
          </AuthProvider>
          <Toaster />
          {extra}
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  );
  return { ...utils, router, queryClient };
}

/** Responses needed for an authenticated session restore. */
export function sessionRoutes(permissions: string[], roles: Array<{ code: string; name: string }> = []) {
  return [
    { method: "POST", path: "/api/v1/auth/token/refresh", respond: () => ({ body: { accessToken: "header.eyJzaWQiOiJzaWQtMSJ9.sig", refreshToken: "rt-2", expiresIn: 900, tokenType: "Bearer" } }) },
    {
      method: "GET",
      path: "/api/v1/identity/me",
      respond: () => ({ body: { userId: "u-1", email: "admin@stockout.test", emailVerified: true, mobile: "", mobileVerified: false, status: "Active", authTime: "", amr: "pwd", firstName: "Ada", lastName: "Admin", displayName: "Ada Admin" } }),
    },
    { method: "GET", path: "/api/v1/platform/me/permissions", respond: () => ({ body: { success: true, data: { userId: "u-1", permissions } } }) },
    { method: "GET", path: "/api/v1/platform/me/roles", respond: () => ({ body: { success: true, data: { userId: "u-1", roles } } }) },
  ];
}
