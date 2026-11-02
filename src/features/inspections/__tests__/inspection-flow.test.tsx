import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RequireAuth } from "@/lib/auth/guards";
import { renderWithApp, sessionRoutes } from "@/test/render";
import { mockFetch } from "@/test/http";
import InspectionDetailPage from "../inspection-detail-page";

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

const ID = "11111111-2222-3333-4444-555555555555";
const resp = (code: string, label: string, over: object = {}) => ({
  inspectionResponseId: `r-${code}`, inspectionId: ID, sourceTemplateItemId: `t-${code}`, itemCodeSnapshot: code, itemLabelSnapshot: label, itemDescriptionSnapshot: null,
  responseTypeSnapshot: "PASS_FAIL", isRequiredSnapshot: true, requiresEvidenceSnapshot: false, displayOrderSnapshot: 1,
  passFailValue: null, yesNoValue: null, textValue: null, numberValue: null, singleSelectValue: null, multiSelectValueJson: null, inspectorNotes: null, itemResult: null, answeredAtUtc: null, ...over,
});
const detail = (over: object = {}) => ({
  inspectionId: ID, inspectionNo: "INSP-2026-000020", listingId: "l-1", listingVersionId: "v-1", inspectionChecklistTemplateId: "tpl-1", status: "IN_PROGRESS", result: null,
  assignedInspectorUserId: "u-1", assignedByUserId: "a-1", assignedAtUtc: "2026-11-02T08:00:00", startedAtUtc: "2026-11-02T09:00:00", completedAtUtc: null, cancelledAtUtc: null,
  summary: null, failureReasonCode: null, failureNotes: null, reinspectionOfInspectionId: null, createdByUserId: "a-1", createdAtUtc: "2026-11-01T08:00:00", updatedByUserId: null, updatedAtUtc: null,
  rowVersion: "rv-1", sellerId: "s-1", listingTitle: "Gate valve DN100",
  responses: [resp("SUM_SEAL", "Seal intact", { itemResult: "FAIL", passFailValue: "FAIL" }), resp("SUM_QTY", "Quantity matches", { displayOrderSnapshot: 2 })],
  evidence: [], statusHistory: [], assignmentHistory: [], ...over,
});
const page = (path = `/inspections/${ID}`) =>
  renderWithApp([{ element: <RequireAuth />, children: [{ path: "/inspections/:inspectionId", element: <InspectionDetailPage /> }] }, { path: "/login", element: <div>login</div> }], path);

describe("Inspection step flow", () => {
  it("walks Checklist → Photos → Result and submits a Fail with the latest version", async () => {
    localStorage.setItem("stockout.inspection.rt", "rt-1");
    const { calls } = mockFetch([
      ...sessionRoutes(["inspections.view", "inspections.perform"]),
      { method: "GET", path: `/api/v1/admin/catalog/inspections/${ID}`, respond: () => ({ body: detail({ responses: detail().responses.map((r) => ({ ...r, itemResult: r.itemResult ?? "PASS" })) }) }) },
      { method: "POST", path: `/api/v1/admin/catalog/inspections/${ID}/complete`, respond: () => ({ body: { ...detail(), status: "COMPLETED", result: "FAIL" } }) },
    ]);
    const user = userEvent.setup();
    page();
    expect(await screen.findByText("Gate valve DN100")).toBeInTheDocument();
    // No Save button; one primary action at the bottom.
    expect(screen.queryByRole("button", { name: "Save responses" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^Next: Photos/ }));
    expect(await screen.findByRole("button", { name: /Take photo/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next: Result" }));

    const results = await screen.findByRole("radiogroup", { name: "Inspection result" });
    expect(within(results).getByRole("radio", { name: /Fail/ })).toHaveAttribute("aria-checked", "true"); // a failed item preselects Fail
    await user.click(screen.getByRole("button", { name: "Damaged" }));
    await user.type(screen.getByLabelText(/What did you find/), "Seal broken on two pallets.");
    await user.click(screen.getByRole("button", { name: "Submit result: Fail" }));
    await waitFor(() =>
      expect(calls.find((c) => c.method === "POST" && c.url.pathname.endsWith("/complete"))?.body).toEqual({
        result: "FAIL", summary: null, failureReasonCode: "DAMAGED", failureNotes: "Seal broken on two pallets.", expectedRowVersion: "rv-1",
      }),
    );
  });

  it("autosaves, and retries once with a fresh version after a conflict", async () => {
    localStorage.setItem("stockout.inspection.rt", "rt-1");
    let puts = 0;
    let detailCalls = 0;
    const { calls } = mockFetch([
      ...sessionRoutes(["inspections.view", "inspections.perform"]),
      { method: "GET", path: `/api/v1/admin/catalog/inspections/${ID}`, respond: () => ({ body: detail({ rowVersion: detailCalls++ === 0 ? "rv-1" : "rv-9" }) }) },
      {
        method: "PUT",
        path: `/api/v1/admin/catalog/inspections/${ID}/responses`,
        respond: ({ body }) => {
          puts++;
          if (puts === 1) return { status: 409, body: { error: "MARKETPLACE_INSPECTION_VERSION_CONFLICT", message: "Changed." } };
          const sent = (body as { responses: Array<Record<string, unknown>> }).responses;
          return { body: { rowVersion: "rv-10", responses: detail().responses.map((r) => ({ ...r, ...sent.find((x) => x.inspectionResponseId === r.inspectionResponseId) })) } };
        },
      },
    ]);
    const user = userEvent.setup();
    page();
    await user.click(within(await screen.findByRole("radiogroup", { name: "Result: Quantity matches" })).getByRole("radio", { name: /Pass/ }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Saved"), { timeout: 4000 });
    const versions = calls.filter((c) => c.method === "PUT").map((c) => (c.body as { expectedRowVersion: string }).expectedRowVersion);
    expect(versions).toEqual(["rv-1", "rv-9"]);
  });
});
