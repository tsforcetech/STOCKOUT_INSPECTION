import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { RequireAuth } from "@/lib/auth/guards";
import { renderWithApp, sessionRoutes } from "@/test/render";
import { mockFetch } from "@/test/http";
import { AppLayout } from "../app-layout";
import MyInspectionsPage from "@/features/inspections/my-inspections-page";

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

const inspection = (over: object = {}) => ({
  inspectionId: "i-1", inspectionNo: "INSP-2026-000011", listingId: "l-1", listingVersionId: "v-1", inspectionChecklistTemplateId: "t-1",
  status: "ASSIGNED", result: null, assignedInspectorUserId: "u-1", assignedByUserId: "a-1", assignedAtUtc: "2026-11-02T08:00:00", startedAtUtc: null,
  completedAtUtc: null, cancelledAtUtc: null, summary: null, failureReasonCode: null, failureNotes: null, reinspectionOfInspectionId: null,
  createdByUserId: "a-1", createdAtUtc: "2026-11-01T08:00:00", updatedByUserId: null, updatedAtUtc: null, rowVersion: "rv", sellerId: "s-1", listingTitle: "Gate valve DN100", ...over,
});

const app = (path: string) =>
  renderWithApp(
    [
      { path: "/login", element: <div>login</div> },
      { element: <RequireAuth />, children: [{ path: "/", element: <AppLayout />, children: [{ index: true, element: <div>home</div> }, { path: "my", element: <MyInspectionsPage /> }] }] },
    ],
    path,
  );

describe("Inspector portal shell", () => {
  it("shows the inspector-only screen to accounts without an inspection permission", async () => {
    localStorage.setItem("stockout.inspection.rt", "rt-1");
    mockFetch([...sessionRoutes(["sellers.view"])]);
    app("/");
    expect(await screen.findByRole("heading", { name: "Inspector access only" })).toBeInTheDocument();
    expect(screen.queryByText("home")).not.toBeInTheDocument();
  });

  it("shows only inspection navigation, including the phone tab bar", async () => {
    localStorage.setItem("stockout.inspection.rt", "rt-1");
    mockFetch([...sessionRoutes(["inspections.view", "inspections.perform"])]);
    app("/");
    expect(await screen.findByText("home")).toBeInTheDocument();
    const tabs = screen.getByRole("navigation", { name: "Primary" });
    for (const label of ["Home", "My work", "All", "Corrections", "Profile"]) expect(within(tabs).getByRole("link", { name: label })).toBeInTheDocument();
    expect(screen.queryByText(/Sellers|Team & Access|Categories/)).not.toBeInTheDocument();
  });

  it("lists my inspections filtered to the signed-in inspector", async () => {
    localStorage.setItem("stockout.inspection.rt", "rt-1");
    const { calls } = mockFetch([
      ...sessionRoutes(["inspections.view", "inspections.perform"]),
      { method: "GET", path: "/api/v1/admin/catalog/inspections/queue", respond: () => ({ body: { items: [inspection()], totalCount: 1, page: 1, pageSize: 10 } }) },
    ]);
    app("/my");
    expect(await screen.findByText("Gate valve DN100")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /INSP-2026-000011/ })).toHaveAttribute("href", "/inspections/i-1");
    await waitFor(() => {
      const list = calls.find((c) => c.url.pathname.endsWith("/queue") && c.url.searchParams.get("pageSize") === "10");
      expect(list?.url.searchParams.get("assignedInspectorUserId")).toBe("u-1");
      expect(list?.url.searchParams.get("status")).toBe("ASSIGNED");
    });
  });
});
