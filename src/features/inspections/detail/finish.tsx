import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowsClockwiseIcon, CheckCircleIcon, SpinnerGapIcon, WarningIcon, XCircleIcon } from "@phosphor-icons/react";
import { SectionCard } from "@/components/common/section-card";
import { FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { cn } from "@/lib/utils/cn";
import type { InspectionDetailDto, InspectionResult } from "@/api/types/catalog-moderation";
import { inspectionsService } from "@/services/inspections.service";
import { listingKeys } from "@/features/listings/queries";
import { ApiErrorNotice, Notice, PanelTitle } from "@/features/listings/shared";
import { inspectionKeys } from "../queries";
import { completeSchema, type CompleteValues } from "./actions";
import { itemName } from "./evidence";
import { useInspectionWriter } from "./writer";

export type Step = "checklist" | "photos" | "finish" | "details";

const RESULTS: Array<{ value: InspectionResult; label: string; hint: string; icon: React.ReactNode; on: string }> = [
  { value: "PASS", label: "Pass", hint: "Matches the listing", icon: <CheckCircleIcon weight="fill" />, on: "border-success bg-success-soft text-success-soft-foreground" },
  { value: "FAIL", label: "Fail", hint: "Does not match", icon: <XCircleIcon weight="fill" />, on: "border-danger bg-danger-soft text-danger-soft-foreground" },
  { value: "REINSPECTION_REQUIRED", label: "Re-inspect", hint: "Needs another visit", icon: <ArrowsClockwiseIcon weight="bold" />, on: "border-warning bg-warning-soft text-warning-soft-foreground" },
];

const REASONS = ["NOT_AS_DESCRIBED", "DAMAGED", "QUANTITY_MISMATCH", "GRADE_MISMATCH", "MISSING_DOCUMENTS", "NOT_ACCESSIBLE"];

/** What is still blocking a result, from what the server has stored. */
export function readiness(inspection: InspectionDetailDto) {
  const r = inspection.responses;
  const unanswered = r.filter((x) => !x.itemResult);
  const missingRequired = r.filter((x) => x.isRequiredSnapshot && !x.itemResult);
  const failedRequired = r.filter((x) => x.isRequiredSnapshot && x.itemResult === "FAIL");
  const hasGeneral = inspection.evidence.some((e) => !e.inspectionResponseId);
  const missingPhotos = r.filter((x) => x.requiresEvidenceSnapshot && !hasGeneral && !inspection.evidence.some((e) => e.inspectionResponseId === x.inspectionResponseId));
  return {
    passed: r.filter((x) => x.itemResult === "PASS").length,
    failed: r.filter((x) => x.itemResult === "FAIL").length,
    na: r.filter((x) => x.itemResult === "NOT_APPLICABLE").length,
    unanswered,
    missingRequired,
    failedRequired,
    missingPhotos,
  };
}

function Count({ label, value, tone }: { label: string; value: number; tone?: "success" | "danger" | "muted" | "warning" }) {
  return (
    <div className="rounded-lg border border-border bg-surface-muted p-3 text-center">
      <p className={cn("font-heading text-2xl font-bold", tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning-soft-foreground" : "text-foreground")}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

export function FinishStep({ inspection, canComplete, goTo }: { inspection: InspectionDetailDto; canComplete: boolean; goTo: (step: Step) => void }) {
  const writer = useInspectionWriter();
  const r = readiness(inspection);
  const form = useForm<CompleteValues>({ resolver: zodResolver(completeSchema), defaultValues: { result: r.failed > 0 ? "FAIL" : "PASS", summary: "", failureReasonCode: "", failureNotes: "" } });
  const result = useWatch({ control: form.control, name: "result" });
  const reason = useWatch({ control: form.control, name: "failureReasonCode" });
  const errors = form.formState.errors;

  const mutation = useApiMutation({
    mutationFn: async (v: CompleteValues) => {
      await writer.idle();
      return writer.run((rv) =>
        inspectionsService.complete(inspection.inspectionId, {
          result: v.result as InspectionResult,
          summary: v.summary.trim() || null,
          failureReasonCode: v.result === "PASS" ? null : v.failureReasonCode.trim(),
          failureNotes: v.result === "PASS" ? null : v.failureNotes.trim(),
          expectedRowVersion: rv,
        }),
      );
    },
    toastOnError: false,
    invalidate: [inspectionKeys.detail(inspection.inspectionId), inspectionKeys.queueAll, listingKeys.listing(inspection.listingId)],
    successMessage: (x) => `Result submitted: ${x.result === "PASS" ? "Pass" : x.result === "FAIL" ? "Fail" : "Re-inspect"}.`,
  });

  const saving = writer.saveState === "pending" || writer.saveState === "saving";
  const saveFailed = writer.saveState === "error";
  const blockers = [
    r.missingRequired.length > 0 && { text: `${r.missingRequired.length} required item${r.missingRequired.length === 1 ? " is" : "s are"} not answered`, step: "checklist" as const },
    result === "PASS" && r.failedRequired.length > 0 && { text: `A required item failed, so the result can't be Pass`, step: "checklist" as const },
    result === "PASS" && r.missingPhotos.length > 0 && { text: `Photo missing for: ${r.missingPhotos.map((x) => itemName(x.itemLabelSnapshot)).join(", ")}`, step: "photos" as const },
  ].filter(Boolean) as Array<{ text: string; step: Step }>;
  const submit = form.handleSubmit((v) => mutation.mutate(v));

  return (
    <SectionCard>
      <PanelTitle title="Result" description="Check the summary, choose the result and submit." />
      <div className="grid grid-cols-4 gap-2">
        <Count label="Pass" value={r.passed} tone="success" />
        <Count label="Fail" value={r.failed} tone={r.failed ? "danger" : "muted"} />
        <Count label="N/A" value={r.na} />
        <Count label="Not answered" value={r.unanswered.length} tone={r.unanswered.length ? "warning" : "muted"} />
      </div>

      {blockers.length > 0 && (
        <ul className="mt-4 space-y-2">
          {blockers.map((b) => (
            <li key={b.text} className="flex items-start justify-between gap-3 rounded-lg border border-warning/40 bg-warning-soft p-3 text-sm text-warning-soft-foreground">
              <span className="flex items-start gap-2">
                <WarningIcon className="mt-0.5 size-4 shrink-0" /> {b.text}
              </span>
              <Button type="button" size="sm" variant="secondary" className="shrink-0" onClick={() => goTo(b.step)}>
                Fix
              </Button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={submit} noValidate className="mt-5 space-y-4">
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-foreground">Result</legend>
          <div role="radiogroup" aria-label="Inspection result" className="grid grid-cols-3 gap-2">
            {RESULTS.map((x) => {
              const on = result === x.value;
              return (
                <button
                  key={x.value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  disabled={!canComplete}
                  onClick={() => form.setValue("result", x.value as CompleteValues["result"], { shouldValidate: form.formState.isSubmitted })}
                  className={cn(
                    "flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 px-2 py-4 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-60 [&_svg]:size-7",
                    on ? x.on : "border-border bg-surface text-foreground hover:border-foreground/40",
                  )}
                >
                  {x.icon}
                  <span className="font-heading text-base font-bold">{x.label}</span>
                  <span className="hidden text-xs opacity-80 sm:block">{x.hint}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        {result !== "PASS" && (
          <>
            <FormField label="Reason" htmlFor="finish-reason" required error={errors.failureReasonCode?.message}>
              <Input maxLength={100} placeholder="Choose below or type a reason code" {...form.register("failureReasonCode")} />
            </FormField>
            <div className="-mt-2 flex flex-wrap gap-1.5" aria-label="Common reasons">
              {REASONS.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => form.setValue("failureReasonCode", code, { shouldValidate: form.formState.isSubmitted })}
                  className={cn("cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium", reason === code ? "border-foreground bg-foreground text-surface" : "border-border bg-surface text-foreground hover:border-foreground/40")}
                >
                  {code.replaceAll("_", " ").toLowerCase().replace(/^./, (c) => c.toUpperCase())}
                </button>
              ))}
            </div>
            <FormField label="What did you find?" htmlFor="finish-notes" required error={errors.failureNotes?.message} hint="At least 10 characters. The seller sees this.">
              <Textarea rows={3} maxLength={2000} {...form.register("failureNotes")} />
            </FormField>
          </>
        )}

        <FormField label="Summary (optional)" htmlFor="finish-summary" error={errors.summary?.message}>
          <Textarea rows={2} maxLength={2000} placeholder="Anything the reviewer should know" {...form.register("summary")} />
        </FormField>

        {saveFailed && <Notice tone="danger">Some checklist answers are not saved yet. Go back to the checklist and save them before submitting.</Notice>}
        <ApiErrorNotice error={mutation.error} />
        {!canComplete && <Notice>Only the assigned inspector can submit the result.</Notice>}
        <Button type="submit" variant="action" size="lg" className="h-12 w-full text-base" disabled={!canComplete || saving || saveFailed} loading={mutation.isPending}>
          {saving ? (
            <>
              <SpinnerGapIcon className="animate-spin" /> Saving answers…
            </>
          ) : (
            `Submit result: ${result === "PASS" ? "Pass" : result === "FAIL" ? "Fail" : "Re-inspect"}`
          )}
        </Button>
      </form>
    </SectionCard>
  );
}
