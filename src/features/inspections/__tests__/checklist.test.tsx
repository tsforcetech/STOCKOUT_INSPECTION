import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RequireAuth } from "@/lib/auth/guards";
import { renderWithApp, sessionRoutes } from "@/test/render";
import { mockFetch } from "@/test/http";
import type { InspectionDetailDto, InspectionResponseDto } from "@/api/types/catalog-moderation";
import { ChecklistPanel, buildSections } from "../detail/checklist";
import { InspectionWriterProvider } from "../detail/writer";
import { PhotoUploadsProvider } from "../detail/evidence";

const Panel = ({ inspection: i }: { inspection: InspectionDetailDto }) => (
  <InspectionWriterProvider inspection={i}>
    <PhotoUploadsProvider inspection={i}>
      <ChecklistPanel inspection={i} editable />
    </PhotoUploadsProvider>
  </InspectionWriterProvider>
);

afterEach(() => vi.unstubAllGlobals());

const SCORES = ["5 - Excellent / As-New", "4 - Good", "3 - Fair (usable, must disclose)", "2 - Poor (conditional only)", "1 - Damaged / Non-functional (reject)", "NA - Not applicable"];

const item = (code: string, label: string, type: InspectionResponseDto["responseTypeSnapshot"], order: number, over: Partial<InspectionResponseDto> = {}): InspectionResponseDto => ({
  inspectionResponseId: `r-${code}`,
  inspectionId: "i-1",
  sourceTemplateItemId: `t-${code}`,
  itemCodeSnapshot: code,
  itemLabelSnapshot: label,
  itemDescriptionSnapshot: null,
  responseTypeSnapshot: type,
  isRequiredSnapshot: true,
  requiresEvidenceSnapshot: false,
  displayOrderSnapshot: order,
  passFailValue: null,
  yesNoValue: null,
  textValue: null,
  numberValue: null,
  singleSelectValue: null,
  multiSelectValueJson: null,
  inspectorNotes: null,
  itemResult: null,
  answeredAtUtc: null,
  ...over,
});

const docDesc = "Documentation & Compliance (weight 15%). Score 5-1 or NA.";
const responses = [
  item("HDR_QTY_VERIFIED", "Quantity verified", "NUMBER", 10),
  item("DOC_1", "Invoice available", "SINGLE_SELECT", 20, { itemDescriptionSnapshot: docDesc }),
  item("DOC_2", "[CRITICAL] Test certificate available", "SINGLE_SELECT", 30, { itemDescriptionSnapshot: `${docDesc} CRITICAL: a score of 1 or 2 makes it Not Eligible.` }),
  item("SUM_SEAL", "Seal intact", "PASS_FAIL", 40),
];

const inspection = { inspectionId: "i-1", inspectionChecklistTemplateId: "tpl-1", rowVersion: "rv-1", responses, evidence: [] } as unknown as InspectionDetailDto;

describe("buildSections", () => {
  it("groups by code prefix and names sections from the shared description", () => {
    const s = buildSections(responses);
    expect(s.map((x) => x.title)).toEqual(["General", "Documentation & Compliance", "Summary"]);
    expect(s[1].note).toBe("Weight 15% · Score 5-1 or NA.");
    expect(s[1].extra.get("r-DOC_2")).toBe("CRITICAL: a score of 1 or 2 makes it Not Eligible.");
    expect(s[1].extra.get("r-DOC_1")).toBe("");
  });
});

describe("Checklist panel", () => {
  it("answers with one tap, suggests results from scores, bulk-passes a section and autosaves", async () => {
    sessionStorage.setItem("stockout.inspection.rt", "rt-1");
    let saved: { responses: Array<Record<string, unknown>> } | null = null;
    mockFetch([
      ...sessionRoutes(["inspections.perform", "inspections.templates.manage"]),
      {
        method: "GET",
        path: "/api/v1/admin/catalog/inspection-templates/tpl-1",
        respond: () => ({
          body: { items: responses.map((r) => ({ inspectionChecklistTemplateItemId: r.sourceTemplateItemId, allowedOptionsJson: r.responseTypeSnapshot === "SINGLE_SELECT" ? JSON.stringify(SCORES) : null })) },
        }),
      },
      {
        method: "PUT",
        path: "/api/v1/admin/catalog/inspections/i-1/responses",
        respond: ({ body }) => {
          saved = body as typeof saved;
          return { body: { inspectionId: "i-1", rowVersion: "rv-2", responses: responses.map((r) => ({ ...r, ...(saved!.responses.find((x) => x.inspectionResponseId === r.inspectionResponseId) ?? {}) })) } };
        },
      },
    ]);
    const user = userEvent.setup();
    renderWithApp([{ element: <RequireAuth />, children: [{ path: "/", element: <Panel inspection={inspection} /> }] }, { path: "/login", element: <div>login</div> }], "/");

    expect(await screen.findByText("Documentation & Compliance")).toBeInTheDocument();
    expect(screen.getByText("Critical")).toBeInTheDocument();

    // Score chip → result suggested (2 = Poor → Fail).
    const invoice = await screen.findByRole("radiogroup", { name: "Answer: Invoice available" });
    await user.click(await within(invoice).findByRole("radio", { name: /2 Poor/ }));
    expect(within(screen.getByRole("radiogroup", { name: "Result: Invoice available" })).getByRole("radio", { name: /Fail/ })).toHaveAttribute("aria-checked", "true");

    // Section "All Pass" fills only the empty result.
    const doc = screen.getByRole("region", { name: "Documentation & Compliance" });
    await user.click(within(doc).getByRole("button", { name: /All Pass/ }));
    await user.click(await screen.findByRole("button", { name: "Mark as Pass" }));
    expect(within(screen.getByRole("radiogroup", { name: "Result: Test certificate available" })).getByRole("radio", { name: /Pass/ })).toHaveAttribute("aria-checked", "true");

    // Pass/fail items are answered by the result buttons.
    await user.click(within(screen.getByRole("radiogroup", { name: "Result: Seal intact" })).getByRole("radio", { name: /Pass/ }));
    await user.type(screen.getByRole("spinbutton", { name: "Answer: Quantity verified" }), "120");

    // No save button: answers are stored automatically shortly after the last change.
    expect(screen.queryByRole("button", { name: "Save responses" })).not.toBeInTheDocument();
    const by = (id: string) => saved!.responses.find((x) => x.inspectionResponseId === id)!;
    await waitFor(() => expect(saved && by("r-HDR_QTY_VERIFIED").numberValue).toBe(120), { timeout: 4000 });
    expect(by("r-DOC_1")).toMatchObject({ singleSelectValue: "2 - Poor (conditional only)", itemResult: "FAIL" });
    expect(by("r-DOC_2")).toMatchObject({ itemResult: "PASS" });
    expect(by("r-SUM_SEAL")).toMatchObject({ passFailValue: "PASS", itemResult: "PASS" });
    expect(by("r-HDR_QTY_VERIFIED")).toMatchObject({ numberValue: 120, itemResult: null });
  });

  it("filters to the items still to do", async () => {
    sessionStorage.setItem("stockout.inspection.rt", "rt-1");
    mockFetch([...sessionRoutes(["inspections.perform"])]);
    const done = { ...inspection, responses: responses.map((r, i) => (i === 0 ? { ...r, itemResult: "PASS" as const, numberValue: 5 } : r)) } as InspectionDetailDto;
    const user = userEvent.setup();
    renderWithApp([{ element: <RequireAuth />, children: [{ path: "/", element: <Panel inspection={done} /> }] }, { path: "/login", element: <div>login</div> }], "/");
    await user.click(await screen.findByRole("tab", { name: /^To do/ }));
    expect(screen.queryByText("Quantity verified")).not.toBeInTheDocument();
    expect(screen.getByText("Seal intact")).toBeInTheDocument();
  });
});
