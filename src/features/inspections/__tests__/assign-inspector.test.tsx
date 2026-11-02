import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RequireAuth } from "@/lib/auth/guards";
import { renderWithApp, sessionRoutes } from "@/test/render";
import { mockFetch } from "@/test/http";
import type { InspectionDetailDto } from "@/api/types/catalog-moderation";
import { InspectionActions } from "../detail/actions";

afterEach(() => vi.unstubAllGlobals());

const INSPECTOR = "11111111-1111-1111-1111-111111111111";
const inspection = {
  inspectionId: "i-1",
  status: "PENDING",
  result: null,
  assignedInspectorUserId: null,
  rowVersion: "rv",
  responses: [],
  evidence: [],
  statusHistory: [],
  assignmentHistory: [],
} as unknown as InspectionDetailDto;

describe("Assign inspector", () => {
  it("picks from the eligible-inspectors API and assigns the chosen user", async () => {
    sessionStorage.setItem("stockout.inspection.rt", "rt-1");
    const { calls } = mockFetch([
      ...sessionRoutes(["inspections.assign"]),
      {
        method: "GET",
        path: "/api/v1/platform/inspectors/eligible",
        respond: () => ({
          body: {
            success: true,
            data: {
              items: [{ userId: INSPECTOR, email: "ina@x.ae", displayName: "Ina Inspector", isEnabled: true, roles: [{ code: "INSPECTION_001", name: "INSPECTION" }] }],
              totalCount: 1,
              page: 1,
              pageSize: 100,
            },
          },
        }),
      },
      { method: "POST", path: "/api/v1/admin/catalog/inspections/i-1/assign", respond: () => ({ body: { ...inspection, status: "ASSIGNED" } }) },
    ]);
    renderWithApp([{ element: <RequireAuth />, children: [{ path: "/", element: <InspectionActions inspection={inspection} /> }] }, { path: "/login", element: <div>login</div> }], "/");
    await userEvent.click(await screen.findByRole("button", { name: /Assign inspector/ }));
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText("1 inspector available.")).toBeInTheDocument();
    const option = Array.from(dialog.querySelectorAll("select option")).find((o) => o.textContent?.includes("Ina Inspector")) as HTMLOptionElement;
    expect(option.textContent).toContain("INSPECTION");
    const hidden = dialog.querySelector("select") as HTMLSelectElement;
    hidden.value = INSPECTOR;
    hidden.dispatchEvent(new Event("change", { bubbles: true }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Assign" }));
    await waitFor(() => expect(calls.find((c) => c.url.pathname.endsWith("/assign"))?.body).toEqual({ inspectorUserId: INSPECTOR, expectedRowVersion: "rv" }));
    expect(calls.find((c) => c.url.pathname.endsWith("/eligible"))?.url.searchParams.get("pageSize")).toBe("100");
  });
});
