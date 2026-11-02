import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RequireAuth } from "@/lib/auth/guards";
import { renderWithApp, sessionRoutes } from "@/test/render";
import { mockFetch } from "@/test/http";
import DisputeDetailPage from "../dispute-detail-page";

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

const ID = "11111111-2222-3333-4444-555555555555";
const dispute = (over: object = {}) => ({
  disputeId: ID, disputeNo: "DSP-2026-000001", listingId: "l-1", listingVersionId: "v-1", inspectionId: "i-1", inspectionNo: "INSP-1",
  correctionId: null, correctionNo: null, disputeType: "INSPECTION_APPEAL", status: "SUBMITTED", disputedInspectionResult: "PASS",
  reasonCode: "GRADE_OR_RESULT", sellerReason: "Grade was misread on site.", requiresDifferentInspector: true, inspectionCompletedAtUtc: "2026-11-01T10:00:00",
  submittedAtUtc: "2026-11-02T10:00:00", decision: null, decisionNotes: null, decidedAtUtc: null, authorizedReinspectionId: null, authorizedReinspectionNo: null,
  rowVersion: "rv-1", sellerId: "s-1", listingTitle: "Gate valve", disputedInspectorUserId: "insp-9", submittedByUserId: "u-s", internalDecisionNotes: null,
  decidedByUserId: null, retentionUntilUtc: null, legalHoldYn: false, evidence: [{ disputeEvidenceId: "e-1", fileAssetId: "f-1", evidenceType: "DOCUMENT", description: "nameplate.pdf", displayOrder: 1, createdAtUtc: "2026-11-02T10:00:00", downloadUrl: "https://s3/x", expiresAtUtc: null }],
  auditHistory: [], ...over,
});
const page = () => renderWithApp([{ element: <RequireAuth />, children: [{ path: "/disputes/:disputeId", element: <DisputeDetailPage /> }] }, { path: "/login", element: <div>login</div> }], `/disputes/${ID}`);

describe("E5-DISP admin decision", () => {
  it("approves a re-inspection with a seller note and internal notes", async () => {
    localStorage.setItem("stockout.inspection.rt", "rt-1");
    const { calls } = mockFetch([
      ...sessionRoutes(["inspections.view", "inspections.override"]),
      { method: "GET", path: `/api/v1/admin/catalog/disputes/${ID}`, respond: () => ({ body: dispute() }) },
      { method: "POST", path: `/api/v1/admin/catalog/disputes/${ID}/decision`, respond: () => ({ body: dispute({ status: "APPROVED_FOR_REINSPECTION", decision: "APPROVE_REINSPECTION", authorizedReinspectionNo: "INSP-2" }) }) },
    ]);
    page();
    expect(await screen.findByText("nameplate.pdf")).toBeInTheDocument();
    const approve = screen.getByRole("button", { name: "Approve re-inspection" });
    expect(approve).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/Decision note for the seller/), "Evidence supports a second look.");
    await userEvent.type(screen.getByLabelText(/Internal notes/), "Original inspector excluded.");
    await userEvent.click(approve);
    await waitFor(() =>
      expect(calls.find((c) => c.method === "POST" && c.url.pathname.endsWith("/decision"))?.body).toEqual({ decision: "APPROVE_REINSPECTION", decisionNotes: "Evidence supports a second look.", internalDecisionNotes: "Original inspector excluded.", expectedRowVersion: "rv-1" }),
    );
  });

  it("stops the original inspector from deciding their own dispute", async () => {
    localStorage.setItem("stockout.inspection.rt", "rt-1");
    mockFetch([...sessionRoutes(["inspections.view", "inspections.override"]), { method: "GET", path: `/api/v1/admin/catalog/disputes/${ID}`, respond: () => ({ body: dispute({ disputedInspectorUserId: "u-1" }) }) }]);
    page();
    expect(await screen.findByText(/You carried out the disputed inspection/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve re-inspection" })).not.toBeInTheDocument();
  });
});
