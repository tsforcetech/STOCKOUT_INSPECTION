import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RequireAuth } from "@/lib/auth/guards";
import { renderWithApp, sessionRoutes } from "@/test/render";
import { mockFetch } from "@/test/http";
import type { InspectionDetailDto } from "@/api/types/catalog-moderation";
import { CorrectionPanel } from "../correction-panel";
import { ChangesTable } from "../shared";

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

const inspection = { inspectionId: "i-1", inspectionNo: "INSP-1", status: "IN_PROGRESS", assignedInspectorUserId: "u-1", listingId: "l-1", listingVersionId: "v-1" } as unknown as InspectionDetailDto;
const snapshot = {
  inspectionId: "i-1",
  inspectionNo: "INSP-1",
  inspectionStatus: "IN_PROGRESS",
  inspectionResult: null,
  listingId: "l-1",
  sellerId: "s-1",
  baseListingVersionId: "v-1",
  baseVersionStatus: "PUBLISHED",
  listingStatus: "PUBLISHED",
  title: "Gate valve",
  description: "Old",
  conditionId: null,
  gradeId: null,
  basePrice: 10,
  currency: "AED",
  onHandQuantity: 5,
  reservedQuantity: 0,
  media: [
    { fileAssetId: "f-1", mediaType: "IMAGE", displayOrder: 1, isPrimary: true, documentType: null },
    { fileAssetId: "f-2", mediaType: "IMAGE", displayOrder: 2, isPrimary: false, documentType: null },
  ],
  correctableFields: ["title", "description", "condition", "grade", "price", "quantity", "media"],
  sellerAcceptanceFields: ["price", "grade", "quantity"],
  hasActiveCorrection: false,
  activeCorrectionId: null,
  listingRowVersion: "rv",
};
const empty = { method: "GET", path: "/api/v1/admin/catalog/listing-corrections", respond: () => ({ body: { items: [], totalCount: 0, page: 1, pageSize: 20 } }) };
const routes = (perms: string[], snap: object = snapshot) => [
  ...sessionRoutes(perms),
  { method: "GET", path: "/api/v1/admin/catalog/listing-corrections/by-inspection/i-1/snapshot", respond: () => ({ body: snap }) },
  empty,
  { method: "GET", path: /\/conditions$/, respond: () => ({ body: { success: true, data: [] } }) },
  { method: "GET", path: /\/grades$/, respond: () => ({ body: { success: true, data: [] } }) },
  { method: "GET", path: /\/versions\/v-1\/moderation$/, respond: () => ({ status: 403, body: { error: "FORBIDDEN" } }) },
];
const render = () =>
  renderWithApp([{ element: <RequireAuth />, children: [{ path: "/", element: <CorrectionPanel inspection={inspection} /> }] }, { path: "/login", element: <div>login</div> }, { path: "/corrections/:id", element: <div>proposal page</div> }], "/");

describe("E5 propose corrections", () => {
  it("sends only the changed fields (price + title) with the seller summary", async () => {
    localStorage.setItem("stockout.inspection.rt", "rt-1");
    const { calls } = mockFetch([
      ...routes(["inspections.view", "inspections.override"]),
      { method: "POST", path: "/api/v1/admin/catalog/listing-corrections", respond: () => ({ status: 201, body: { correctionId: "c-1", correctionNo: "COR-1" } }) },
    ]);
    render();
    expect(await screen.findByText("Gate valve")).toBeInTheDocument();
    await userEvent.click(await screen.findByRole("button", { name: /Propose corrections/ }));
    const dialog = await screen.findByRole("dialog");
    const title = within(dialog).getByLabelText("Title");
    await userEvent.clear(title);
    await userEvent.type(title, "Gate valve DN100");
    const price = within(dialog).getByLabelText(/Price \(AED\)/);
    await userEvent.clear(price);
    await userEvent.type(price, "12.5");
    await userEvent.type(within(dialog).getByLabelText(/Summary for the seller/), "Size and price checked on site.");
    await userEvent.click(within(dialog).getByRole("button", { name: "Propose" }));
    await waitFor(() =>
      expect(calls.find((c) => c.method === "POST" && c.url.pathname.endsWith("/listing-corrections"))?.body).toEqual({
        inspectionId: "i-1",
        sellerVisibleSummary: "Size and price checked on site.",
        inspectorNotes: null,
        title: "Gate valve DN100",
        basePrice: 12.5,
      }),
    );
    expect(await screen.findByText("proposal page")).toBeInTheDocument();
  });

  it("blocks proposing for someone who isn't the assigned inspector", async () => {
    localStorage.setItem("stockout.inspection.rt", "rt-1");
    mockFetch(routes(["inspections.view", "inspections.override"], snapshot));
    renderWithApp(
      [{ element: <RequireAuth />, children: [{ path: "/", element: <CorrectionPanel inspection={{ ...inspection, assignedInspectorUserId: "someone-else" }} /> }] }, { path: "/login", element: <div>login</div> }],
      "/",
    );
    expect(await screen.findByText(/Only the inspector assigned/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Propose corrections/ })).toBeDisabled();
  });

  it("points to the open proposal instead of allowing a second one", async () => {
    localStorage.setItem("stockout.inspection.rt", "rt-1");
    mockFetch(routes(["inspections.view", "inspections.override"], { ...snapshot, hasActiveCorrection: true, activeCorrectionId: "c-9" }));
    render();
    expect(await screen.findByRole("link", { name: "Open it" })).toHaveAttribute("href", "/corrections/c-9");
    expect(screen.getByRole("button", { name: /Propose corrections/ })).toBeDisabled();
  });
});

describe("E5 stale inspected version", () => {
  it("explains that a superseded version needs a new inspection", async () => {
    localStorage.setItem("stockout.inspection.rt", "rt-1");
    mockFetch(routes(["inspections.view", "inspections.override"], { ...snapshot, baseVersionStatus: "SUPERSEDED" }));
    render();
    expect(await screen.findByText(/Corrections need an inspection of the current version/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Propose corrections/ })).toBeDisabled();
  });
});

describe("E5 error messages", () => {
  it("explains a blocked moderation entry in plain words", async () => {
    const { correctionErrorMessage } = await import("../shared");
    const { ApiError } = await import("@/lib/api/errors");
    const e = new ApiError({ kind: "conflict", status: 409, code: "MARKETPLACE_CORRECTION_MODERATION_ENTRY_BLOCKED", message: "MARKETPLACE_CORRECTION_MODERATION_ENTRY_BLOCKED" });
    expect(correctionErrorMessage(e)).toMatch(/Withdraw it and propose again/);
  });
});

describe("E5 before/after table", () => {
  it("shows original and proposed values and flags seller-acceptance rows", async () => {
    mockFetch([
      { method: "GET", path: /\/conditions$/, respond: () => ({ body: { success: true, data: [] } }) },
      { method: "GET", path: /\/grades$/, respond: () => ({ body: { success: true, data: [] } }) },
    ]);
    renderWithApp(
      [{ path: "/", element: <ChangesTable changes={[{ field: "price", before: "10", after: "12.5", requiresSellerAcceptance: true }, { field: "title", before: "A", after: "B", requiresSellerAcceptance: false }]} /> }],
      "/",
    );
    const row = (await screen.findByRole("rowheader", { name: "Price" })).closest("tr")!;
    expect(within(row).getByText("10")).toBeInTheDocument();
    expect(within(row).getByText("12.5")).toBeInTheDocument();
    expect(within(row).getByText("Yes")).toBeInTheDocument();
  });
});
