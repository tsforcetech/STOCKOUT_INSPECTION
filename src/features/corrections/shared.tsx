import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { StatusBadge } from "@/components/common/status-badge";
import { Badge } from "@/components/ui/misc";
import { EmptyState, ErrorState } from "@/components/feedback/states";
import { listingCorrectionsService } from "@/services/listing-corrections.service";
import { isApiError } from "@/lib/api/errors";
import type { CorrectionFieldComparisonDto, CorrectionStatus } from "@/api/types/listing-corrections";
import { PanelTitle, PersonText, fmtUtc, useUserNames } from "@/features/listings/shared";
import { correctionKeys, useConditionGradeNames } from "./queries";

export const FIELD_LABEL: Record<string, string> = {
  title: "Title",
  description: "Description",
  condition: "Condition",
  grade: "Grade",
  price: "Price",
  quantity: "Quantity (on hand)",
  media: "Photos & documents",
};

export const STATUS_LABEL: Record<CorrectionStatus, string> = {
  AWAITING_SELLER_DECISION: "Awaiting seller",
  READY_FOR_MODERATION: "Ready for moderation",
  SELLER_ACCEPTED: "Seller accepted",
  SUBMITTED_TO_MODERATION: "In moderation",
  SELLER_DECLINED: "Seller declined",
  WITHDRAWN: "Withdrawn",
};

export function CorrectionStatusBadge({ status }: { status: CorrectionStatus | string }) {
  return <StatusBadge value={status} label={STATUS_LABEL[status as CorrectionStatus] ?? undefined} />;
}

/** before/after come back as strings; condition and grade are ids. */
function Value({ field, value, names }: { field: string; value: string | null; names: Map<string, string> }) {
  if (value === null || value === "") return <span className="text-muted-foreground">—</span>;
  if (field === "condition" || field === "grade") return <>{names.get(value.toLowerCase()) ?? value}</>;
  return <span className="whitespace-pre-wrap break-words">{value}</span>;
}

/** Original vs proposed values. Rows the seller must accept are highlighted. */
export function ChangesTable({ changes }: { changes: CorrectionFieldComparisonDto[] }) {
  const names = useConditionGradeNames();
  if (changes.length === 0) return <EmptyState title="No field changes" description="This proposal does not change any listing field." />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">Original and proposed values</caption>
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="py-2 pr-3 font-medium">Field</th>
            <th className="py-2 pr-3 font-medium">Original</th>
            <th className="py-2 pr-3 font-medium">Proposed</th>
            <th className="py-2 font-medium">Seller must accept</th>
          </tr>
        </thead>
        <tbody>
          {changes.map((c) => (
            <tr key={c.field} className={c.requiresSellerAcceptance ? "border-b border-border bg-warning-soft/40" : "border-b border-border"}>
              <th scope="row" className="py-2 pr-3 text-left align-top font-medium text-foreground">
                {FIELD_LABEL[c.field] ?? c.field}
              </th>
              <td className="py-2 pr-3 align-top text-muted-foreground line-through decoration-muted-foreground/40">
                <Value field={c.field} value={c.before} names={names} />
              </td>
              <td className="py-2 pr-3 align-top font-medium text-foreground">
                <Value field={c.field} value={c.after} names={names} />
              </td>
              <td className="py-2 align-top">{c.requiresSellerAcceptance ? <Badge tone="warning">Yes</Badge> : <span className="text-muted-foreground">No</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function JsonBlock({ label, json }: { label: string; json: string | null }) {
  if (!json) return null;
  let pretty = json;
  try {
    pretty = JSON.stringify(JSON.parse(json), null, 2);
  } catch {
    /* show as stored */
  }
  return (
    <details className="mt-1">
      <summary className="cursor-pointer text-xs text-muted-foreground">{label}</summary>
      <pre className="mt-1 max-h-64 overflow-auto rounded-md bg-surface-muted p-2 text-[11px] leading-4">{pretty}</pre>
    </details>
  );
}

const EVENT_LABEL: Record<string, string> = {
  PROPOSED: "Proposed",
  SELLER_ACCEPTED: "Seller accepted",
  SELLER_DECLINED: "Seller declined",
  WITHDRAWN: "Withdrawn",
  SUBMITTED_TO_MODERATION: "Submitted to moderation",
};

/** Append-only audit trail (oldest first). */
export function AuditTimeline({ correctionId }: { correctionId: string }) {
  const users = useUserNames();
  const q = useQuery({ queryKey: correctionKeys.audit(correctionId), queryFn: ({ signal }) => listingCorrectionsService.audit(correctionId, signal) });
  const rows = React.useMemo(() => [...(q.data ?? [])].sort((a, b) => a.occurredAtUtc.localeCompare(b.occurredAtUtc)), [q.data]);
  return (
    <section aria-label="Audit trail">
      <PanelTitle title="Audit trail" description="Every change to this proposal, oldest first. Entries can't be edited or deleted." />
      {q.error ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <EmptyState title="No audit entries" />
      ) : (
        <ol className="space-y-3 border-l border-border pl-4">
          {rows.map((r) => (
            <li key={r.correctionAuditId} className="relative">
              <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full bg-primary" aria-hidden />
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium text-foreground">{EVENT_LABEL[r.eventType] ?? r.eventType}</span>
                {r.fromStatus && <CorrectionStatusBadge status={r.fromStatus} />}
                {r.fromStatus && <span aria-hidden>→</span>}
                <CorrectionStatusBadge status={r.toStatus} />
              </div>
              <p className="text-xs text-muted-foreground">
                {fmtUtc(r.occurredAtUtc)} · {r.actorType.toLowerCase()} <PersonText id={r.actorUserId} names={users} />
              </p>
              {r.reason && <p className="mt-1 whitespace-pre-wrap text-sm">“{r.reason}”</p>}
              {r.correctedListingVersionId && <p className="mt-1 text-xs text-muted-foreground">Corrected version {r.correctedListingVersionId}</p>}
              <JsonBlock label="Before" json={r.beforeJson} />
              <JsonBlock label="After" json={r.afterJson} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

const CODE_MESSAGES: Record<string, string> = {
  MARKETPLACE_CORRECTION_ALREADY_ACTIVE: "This listing already has an open proposal. Open it from the inspection page, or withdraw it first.",
  MARKETPLACE_CORRECTION_BASE_VERSION_NOT_CURRENT: "The inspected version is no longer current. Corrections need an inspection of the current version.",
  MARKETPLACE_CORRECTION_LISTING_DRAFT_CONFLICT: "The seller has an open draft or another version in review. Try again once that is published, rejected or withdrawn.",
  MARKETPLACE_CORRECTION_MODERATION_ENTRY_BLOCKED: "This proposal can't enter moderation — the version it was based on has been replaced or the listing isn't published. Withdraw it and propose again from a new inspection.",
  MARKETPLACE_CORRECTION_NO_CHANGES: "Change at least one field.",
  MARKETPLACE_CORRECTION_VERSION_CONFLICT: "This proposal changed since you opened it. Refresh and try again.",
  MARKETPLACE_CORRECTION_TRANSITION_INVALID: "That isn't possible in the proposal's current state.",
  MARKETPLACE_CORRECTION_WITHDRAW_FORBIDDEN: "Only the inspector who proposed it can withdraw this proposal.",
  MARKETPLACE_CORRECTION_INSPECTION_STATE_INVALID: "Corrections can be proposed only while the inspection is in progress or completed.",
  MARKETPLACE_INSPECTOR_NOT_ASSIGNED: "Only the inspector assigned to this inspection can propose corrections.",
  MARKETPLACE_CORRECTION_MEDIA_LIMIT_EXCEEDED: "Too many photos or documents.",
  MARKETPLACE_LISTING_PRICE_INVALID: "Enter a price above 0 with at most 4 decimal places.",
  MARKETPLACE_INVENTORY_QUANTITY_BELOW_RESERVED: "Quantity can't be below the reserved quantity.",
  MARKETPLACE_CORRECTION_INVENTORY_STALE: "Stock changed since this proposal was made. Refresh and propose the quantity again.",
  MARKETPLACE_INVENTORY_NOT_FOUND: "This listing has no stock record yet.",
  MARKETPLACE_LISTING_INSPECTION_NOT_PASSED: "Needs a PASS inspection completed in the last 30 days (and no open appeal) before it can be published.",
  MARKETPLACE_INSPECTION_DIFFERENT_INSPECTOR_REQUIRED: "This is an appealed re-inspection — assign a different inspector from the original one.",
};

/** Plain-language message for E5 errors (the backend message often repeats the code). */
export function correctionErrorMessage(error: unknown): string {
  if (isApiError(error) && error.code && CODE_MESSAGES[error.code]) return CODE_MESSAGES[error.code]!;
  return isApiError(error) ? error.message : "Something went wrong. Try again.";
}

export function CorrectionError({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <div role="alert" className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger-soft-foreground">
      {correctionErrorMessage(error)}
      {isApiError(error) && error.code && <span className="mt-0.5 block font-mono text-[11px] opacity-70">{error.code}</span>}
    </div>
  );
}
