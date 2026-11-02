import * as React from "react";
import { Link, useParams } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftIcon } from "@phosphor-icons/react";
import { PageHeader, DetailList } from "@/components/common/page-header";
import { SectionCard, RefreshButton } from "@/components/common/section-card";
import { StatusBadge } from "@/components/common/status-badge";
import { FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/feedback/states";
import { RequirePermission } from "@/lib/auth/guards";
import { useAccess } from "@/lib/auth/use-access";
import { useAuth } from "@/lib/auth/auth-context";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { isApiError } from "@/lib/api/errors";
import { PERMISSIONS as P } from "@/api/types/user-organization";
import type { AdminInspectionDisputeDetailDto, DisputeDecision } from "@/api/types/disputes";
import { disputesService } from "@/services/disputes.service";
import { Notice, PanelTitle, PersonText, fmtUtc, isGuid, useSellerNames, useUserNames } from "@/features/listings/shared";
import { DISPUTE_STATUS_LABEL, DISPUTE_TYPE_LABEL, disputeKeys } from "./disputes-page";

const MESSAGES: Record<string, string> = {
  MARKETPLACE_DISPUTE_SELF_ADJUDICATION_FORBIDDEN: "You inspected this listing, so you can't decide this dispute. Ask another reviewer.",
  MARKETPLACE_DISPUTE_VERSION_CONFLICT: "This dispute changed since you opened it. It has been reloaded — check it and decide again.",
  MARKETPLACE_DISPUTE_TRANSITION_INVALID: "This dispute has already been decided.",
  MARKETPLACE_DISPUTE_REASON_REQUIRED: "Write a decision note of at least 10 characters for the seller.",
  MARKETPLACE_DISPUTE_ACCESS_DENIED: "Deciding disputes needs the inspections.override permission.",
};
const message = (e: unknown) => (isApiError(e) && e.code && MESSAGES[e.code]) || (isApiError(e) ? e.message : "Something went wrong.");

function Decide({ d }: { d: AdminInspectionDisputeDetailDto }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [notes, setNotes] = React.useState("");
  const [internal, setInternal] = React.useState("");
  const isOriginalInspector = !!user?.userId && !!d.disputedInspectorUserId && user.userId.toLowerCase() === d.disputedInspectorUserId.toLowerCase();
  const decide = useApiMutation({
    toastOnError: false,
    mutationFn: (decision: DisputeDecision) => disputesService.decide(d.disputeId, { decision, decisionNotes: notes.trim(), internalDecisionNotes: internal.trim() || null, expectedRowVersion: d.rowVersion }),
    successMessage: (r) => (r.decision === "APPROVE_REINSPECTION" ? `Re-inspection ${r.authorizedReinspectionNo ?? ""} authorised.` : "Dispute rejected."),
    onSuccess: (r) => {
      qc.setQueryData(disputeKeys.detail(d.disputeId), r);
      void qc.invalidateQueries({ queryKey: disputeKeys.all });
    },
  });
  const onError = (e: unknown) => {
    if (isApiError(e) && e.code === "MARKETPLACE_DISPUTE_VERSION_CONFLICT") void qc.invalidateQueries({ queryKey: disputeKeys.detail(d.disputeId) });
  };
  if (isOriginalInspector)
    return <Notice tone="warning" title="You can't decide this">You carried out the disputed inspection. Another reviewer must decide.</Notice>;
  const ok = notes.trim().length >= 10;
  return (
    <div className="space-y-3">
      {decide.error ? <Notice tone="danger">{message(decide.error)}</Notice> : null}
      <FormField label="Decision note for the seller" htmlFor="d-notes" required hint="At least 10 characters. The seller sees this.">
        <Textarea rows={3} value={notes} maxLength={2000} onChange={(e) => setNotes(e.target.value)} />
      </FormField>
      <FormField label="Internal notes" htmlFor="d-internal" hint="Staff only — never shown to the seller.">
        <Textarea rows={2} value={internal} maxLength={2000} onChange={(e) => setInternal(e.target.value)} />
      </FormField>
      <div className="flex flex-wrap gap-2">
        <Button variant="action" disabled={!ok} loading={decide.isPending && decide.variables === "APPROVE_REINSPECTION"} onClick={() => decide.mutate("APPROVE_REINSPECTION", { onError })}>
          Approve re-inspection
        </Button>
        <Button variant="danger-ghost" disabled={!ok} loading={decide.isPending && decide.variables === "REJECT"} onClick={() => decide.mutate("REJECT", { onError })}>
          Reject dispute
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Approving creates an authorised re-inspection that must be assigned to a different inspector. Publishing stays blocked until it is resolved.</p>
    </div>
  );
}

function Content({ disputeId }: { disputeId: string }) {
  const { can } = useAccess();
  const users = useUserNames();
  const sellers = useSellerNames();
  const q = useQuery({ queryKey: disputeKeys.detail(disputeId), queryFn: ({ signal }) => disputesService.detail(disputeId, signal) });
  if (q.isLoading) return <PageSkeleton />;
  if (q.error || !q.data)
    return (
      <SectionCard>
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      </SectionCard>
    );
  const d = q.data;
  return (
    <>
      <div className="mb-2 px-0 sm:px-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/disputes">
            <ArrowLeftIcon /> Inspection disputes
          </Link>
        </Button>
      </div>
      <PageHeader eyebrow={DISPUTE_TYPE_LABEL[d.disputeType]} title={d.disputeNo} description={d.listingTitle ?? undefined} actions={<RefreshButton onClick={() => q.refetch()} spinning={q.isFetching} />}>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <StatusBadge value={d.status === "SUBMITTED" ? "PENDING" : d.status === "REJECTED" ? "REJECTED" : "APPROVED"} label={DISPUTE_STATUS_LABEL[d.status]} />
          {d.requiresDifferentInspector && <span className="text-muted-foreground">Re-inspection needs a different inspector</span>}
        </div>
      </PageHeader>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-w-0 space-y-4">
          <SectionCard>
            <PanelTitle title="Seller's case" />
            <DetailList
              columns={2}
              items={[
                { label: "Reason", value: d.reasonCode },
                { label: "Disputed result", value: d.disputedInspectionResult },
                { label: "Explanation", value: <span className="whitespace-pre-wrap">{d.sellerReason}</span>, full: true },
              ]}
            />
            <h3 className="mb-2 mt-4 text-sm font-semibold">Evidence ({d.evidence.length})</h3>
            <ul className="space-y-1">
              {d.evidence.map((e) => (
                <li key={e.disputeEvidenceId} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">{e.description ?? e.evidenceType}</span>
                  {e.downloadUrl ? (
                    <a className="text-xs underline underline-offset-4" href={e.downloadUrl} target="_blank" rel="noreferrer">
                      Open
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground">Link unavailable — refresh</span>
                  )}
                </li>
              ))}
            </ul>
          </SectionCard>
          <SectionCard>
            <PanelTitle title="Decision" />
            {d.status === "SUBMITTED" ? (
              can(P.INSPECTIONS_OVERRIDE) ? (
                <Decide d={d} />
              ) : (
                <Notice>Deciding disputes needs the inspections.override permission.</Notice>
              )
            ) : (
              <DetailList
                columns={1}
                items={[
                  { label: "Decision", value: d.decision === "APPROVE_REINSPECTION" ? "Re-inspection approved" : "Rejected" },
                  { label: "Note to seller", value: <span className="whitespace-pre-wrap">{d.decisionNotes ?? "—"}</span> },
                  ...(d.internalDecisionNotes ? [{ label: "Internal notes", value: <span className="whitespace-pre-wrap">{d.internalDecisionNotes}</span> }] : []),
                  { label: "Decided", value: <>{fmtUtc(d.decidedAtUtc)} · <PersonText id={d.decidedByUserId} names={users} /></> },
                  ...(d.authorizedReinspectionId
                    ? [{ label: "Re-inspection", value: <Link className="underline underline-offset-4" to={`/inspections/${d.authorizedReinspectionId}`}>{d.authorizedReinspectionNo ?? d.authorizedReinspectionId.slice(0, 8)}</Link> }]
                    : []),
                ]}
              />
            )}
          </SectionCard>
        </div>
        <div className="min-w-0 space-y-4">
          <SectionCard>
            <PanelTitle title="Details" />
            <DetailList
              columns={1}
              items={[
                { label: "Listing", value: <Link className="underline underline-offset-4" to={`/listings/${d.listingId}/versions/${d.listingVersionId}`}>{d.listingTitle ?? d.listingId.slice(0, 8)}</Link> },
                { label: "Seller", value: <PersonText id={d.sellerId} names={sellers} /> },
                { label: "Inspection", value: <Link className="underline underline-offset-4" to={`/inspections/${d.inspectionId}`}>{d.inspectionNo ?? d.inspectionId.slice(0, 8)}</Link> },
                { label: "Original inspector", value: <PersonText id={d.disputedInspectorUserId} names={users} /> },
                ...(d.correctionId ? [{ label: "Declined proposal", value: <Link className="underline underline-offset-4" to={`/corrections/${d.correctionId}`}>{d.correctionNo ?? d.correctionId.slice(0, 8)}</Link> }] : []),
                { label: "Inspection completed", value: fmtUtc(d.inspectionCompletedAtUtc) },
                { label: "Submitted", value: <>{fmtUtc(d.submittedAtUtc)} · <PersonText id={d.submittedByUserId} names={users} /></> },
                { label: "Retention", value: `${fmtUtc(d.retentionUntilUtc)}${d.legalHoldYn ? " · legal hold" : ""}` },
              ]}
            />
          </SectionCard>
          <SectionCard>
            <PanelTitle title="Audit trail" />
            {d.auditHistory.length === 0 ? (
              <EmptyState title="No audit entries" />
            ) : (
              <ol className="space-y-3 border-l border-border pl-4">
                {[...d.auditHistory]
                  .sort((a, b) => a.occurredAtUtc.localeCompare(b.occurredAtUtc))
                  .map((a) => (
                    <li key={a.disputeAuditId} className="text-sm">
                      <p className="font-medium">
                        {a.eventType.replace(/_/g, " ").toLowerCase()} → {a.toStatus.replace(/_/g, " ").toLowerCase()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {fmtUtc(a.occurredAtUtc)} · {a.actorType.toLowerCase()} <PersonText id={a.actorUserId} names={users} />
                      </p>
                      {a.notes && <p className="mt-0.5 whitespace-pre-wrap">{a.notes}</p>}
                    </li>
                  ))}
              </ol>
            )}
          </SectionCard>
        </div>
      </div>
    </>
  );
}

function Route() {
  const { disputeId = "" } = useParams();
  if (!isGuid(disputeId))
    return (
      <SectionCard>
        <EmptyState title="Dispute not found" />
      </SectionCard>
    );
  return <Content key={disputeId} disputeId={disputeId.toLowerCase()} />;
}

export default function DisputeDetailPage() {
  return (
    <RequirePermission permission={P.INSPECTIONS_VIEW}>
      <Route />
    </RequirePermission>
  );
}
