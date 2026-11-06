import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { Outlet } from "react-router";
import { RequireAuth, RequirePermission } from "../guards";
import { renderWithApp, sessionRoutes } from "@/test/render";
import { mockFetch } from "@/test/http";

afterEach(() => vi.unstubAllGlobals());

const routes = [
  { path: "/login", element: <div>Login screen</div> },
  {
    element: <RequireAuth />,
    children: [
      {
        path: "/",
        element: <Outlet />,
        children: [
          { path: "secret", element: <div>Secret page</div> },
          {
            path: "roles",
            element: (
              <RequirePermission permission="roles.view">
                <div>Roles page</div>
              </RequirePermission>
            ),
          },
        ],
      },
    ],
  },
];

describe("route guards", () => {
  it("redirects anonymous users to /login and preserves the target", async () => {
    mockFetch([]);
    const { router } = renderWithApp(routes, "/secret?x=1");
    expect(await screen.findByText("Login screen")).toBeInTheDocument();
    expect(router.state.location.search).toBe("?next=%2Fsecret%3Fx%3D1");
  });

  it("restores a session from the stored refresh token", async () => {
    sessionStorage.setItem("stockout.inspection.rt", "rt-1");
    const { calls } = mockFetch(sessionRoutes(["inspections.perform"]));
    renderWithApp(routes, "/secret");
    expect(await screen.findByText("Secret page")).toBeInTheDocument();
    expect(calls.find((c) => c.url.pathname === "/api/v1/auth/token/refresh")?.body).toEqual({ refreshToken: "rt-1" });
    expect(localStorage.getItem("stockout.inspection.rt")).toBe("rt-2");
  });

  it("shows a permission-denied state when the permission is missing", async () => {
    sessionStorage.setItem("stockout.inspection.rt", "rt-1");
    mockFetch(sessionRoutes(["inspections.view"]));
    renderWithApp(routes, "/roles");
    expect(await screen.findByText("You don't have access")).toBeInTheDocument();
    expect(screen.queryByText("Roles page")).not.toBeInTheDocument();
  });

  it("falls back to login when the refresh token is rejected", async () => {
    sessionStorage.setItem("stockout.inspection.rt", "rt-bad");
    mockFetch([{ method: "POST", path: "/api/v1/auth/token/refresh", respond: () => ({ status: 401, body: { title: "Unauthorized", status: 401 } }) }]);
    renderWithApp(routes, "/secret");
    expect(await screen.findByText("Login screen")).toBeInTheDocument();
    await waitFor(() => expect(localStorage.getItem("stockout.inspection.rt") ?? sessionStorage.getItem("stockout.inspection.rt")).toBeNull());
  });
});

describe("session restore resilience", () => {
  it("keeps the refresh token when profile loading fails for a non-auth reason", async () => {
    sessionStorage.setItem("stockout.inspection.rt", "rt-1");
    mockFetch([...sessionRoutes([]).filter((r) => r.path !== "/api/v1/identity/me"), { method: "GET", path: "/api/v1/identity/me", respond: () => ({ status: 503 }) }]);
    renderWithApp(routes, "/secret");
    expect(await screen.findByText("Login screen")).toBeInTheDocument();
    expect(localStorage.getItem("stockout.inspection.rt")).toBe("rt-2");
  });
});
