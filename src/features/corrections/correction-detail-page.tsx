import * as React from "react";
import { Link, useParams } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftIcon, ArrowUUpLeftIcon, PaperPlaneTiltIcon } from "@phosphor-icons/react";
import { PageHeader, DetailList } from "@/components/common/page-header";
import { SectionCard, RefreshButton } from "@/components/common/section-card";
import { FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/input";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/feedback/states";
import { RequirePermission } from "@/lib/auth/guards";
import { useAccess } from "@/lib/auth/use-access";
import { useAuth } from "@/lib/auth/auth-context";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { PERMISSIONS as P } from "@/api/types/user-organization";
import { WITHDRAWABLE, type AdminListingCorrectionDto } from "@/api/types/listing-corrections";
import { listingCorrectionsService } from "@/services/listing-corrections.service";
import { moderationService } from "@/services/moderation.service";
import { listingKeys } from "@/features/listings/queries";
import { Notice, PanelTitle, PersonText, fmtUtc, isGuid, shortId, useSellerNames, useUserNames } from "@/features/listings/shared";
import { correctionKeys } from "./queries";
import { AuditTimeline, ChangesTable, CorrectionError, CorrectionStatusBadge } from "./shared";

/** E5-Q1: the absolute target quantity is applied once, on successful publication of the corrected version. */
const QUANTITY_NOTE: Record<string, string> = {
  AWAITING_PUBLICATION: "Stock is set to the proposed quantity only when the corrected version is published (one adjustment).",
  APPLIED: "The proposed stock quantity was applied when the corrected version was published.",
  CANCELLED: "The proposed stock change was cancelled; stock is unchanged.",
  BLOCKED_PENDING_OWNER_DECISION: "The proposed quantity is recorded only. Stock levels are not changed automatically.",
};

function Actions({ c }: { c: AdminListingCorrectionDto }) {
  const { can } = useAccess();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = React.useState<"withdraw" | "submit" | null>(null);
  const [reason, setReason] = React.useState("");
  const isProposer = !!user?.userId && user.userId.toLowerCase() === c.proposedByUserId.toLowerCase();
  // 057 / E5-F1: once the base version is superseded, any staff with inspections.override may withdraw it.
  const base = useQuery({
    queryKey: listingKeys.detail(c.listingId, c.baseListingVersionId),
    queryFn: ({ signal }) => moderationService.detail(c.listingId, c.baseListingVersionId, signal),
    enabled: WITHDRAWABLE.includes(c.status),
    retry: false,
  });
  const baseStale = ["SUPERSEDED", "ARCHIVED", "REJECTED"].includes(base.data?.candidateVersion.versionStatus ?? "");
  const refresh = () => qc.invalidateQueries({ queryKey: correctionKeys.all });
  const withdraw = useApiMutation({
    mutationFn: () => listingCorrectionsService.withdraw(c.correctionId, { reason: reason.trim(), expectedRowVersion: c.rowVersion }),
    successMessage: "Proposal withdrawn.",
    toastOnError: false,
    onSuccess: () => {
      setOpen(null);
      void refresh();
    },
  });
  const submit = useApiMutation({
    mutationFn: () => listingCorrectionsService.submitForModeration(c.correctionId, c.rowVersion),
    successMessage: "Sent to moderation.",
    toastOnError: false,
    onSuccess: () => {
      setOpen(null);
      void refresh();
    },
  });
  const canWithdraw = (isProposer || baseStale) && can(P.INSPECTIONS_OVERRIDE) && WITHDRAWABLE.includes(c.status);
  const canSubmit = can(P.INSPECTIONS_OVERRIDE) && (c.status === "READY_FOR_MODERATION" || c.status === "SELLER_ACCEPTED");
  if (!canWithdraw && !canSubmit) return null;
  return (
    <>
      {canSubmit && (
        <Button variant="action" onClick={() => setOpen("submit")}>
          <PaperPlaneTiltIcon /> Submit for moderation
        </Button>
      )}
      {canWithdraw && (
        <Button variant="secondary" onClick={() => setOpen("withdraw")}>
          <ArrowUUpLeftIcon /> Withdraw
        </Button>
      )}
      <ConfirmDialog
        open={open === "withdraw"}
        onOpenChange={(o) => !o && setOpen(null)}
        title={`Withdraw ${c.correctionNo}?`}
        description={baseStale ? "The version this proposal was based on has been replaced, so it can't go to moderation. Withdrawing closes it, cancels any pending stock change and frees the listing for a new proposal." : "The proposal closes and the listing stays as it is. The seller can no longer accept it."}
        confirmLabel="Withdraw"
        loading={withdraw.isPending}
        onConfirm={() => (reason.trim() ? withdraw.mutate() : undefined)}
      >
        <FormField label="Reason" htmlFor="w-reason" required>
          <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={2000} />
        </FormField>
        {withdraw.error ? <div className="mt-2"><CorrectionError error={withdraw.error} /></div> : null}
      </ConfirmDialog>
      <ConfirmDialog
        open={open === "submit"}
        onOpenChange={(o) => !o && setOpen(null)}
        title={`Submit ${c.correctionNo} for moderation?`}
        description="A new version with these changes goes to the normal moderation queue. It goes live only after it's approved and published."
        confirmLabel="Submit"
        tone="primary"
        loading={submit.isPending}
        onConfirm={() => submit.mutate()}
      >
        <CorrectionError error={submit.error} />
      </ConfirmDialog>
    </>
  );
}

function DetailContent({ correctionId }: { correctionId: string }) {
  const users = useUserNames();
  const sellers = useSellerNames();
  const q = useQuery({ queryKey: correctionKeys.detail(correctionId), queryFn: ({ signal }) => listingCorrectionsService.detail(correctionId, signal) });
  const c = q.data;
  // The correction stays SUBMITTED_TO_MODERATION after publication; the corrected version's own status tells us it went live.
  const corrected = useQuery({
    queryKey: listingKeys.detail(c?.listingId ?? "", c?.correctedListingVersionId ?? ""),
    queryFn: ({ signal }) => moderationService.detail(c!.listingId, c!.correctedListingVersionId!, signal),
    enabled: !!c?.correctedListingVersionId,
    retry: false,
  });
  const versionStatus = corrected.data?.candidateVersion.versionStatus;
  if (q.isLoading) return <PageSkeleton />;
  if (q.error || !c)
    return (
      <SectionCard>
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      </SectionCard>
    );
  return (
    <>
      <div className="mb-2 px-0 sm:px-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/corrections">
            <ArrowLeftIcon /> Listing corrections
          </Link>
        </Button>
      </div>
      <PageHeader
        eyebrow="Listing correction"
        title={c.correctionNo}
        actions={
          <>
            <Actions c={c} />
            <RefreshButton onClick={() => q.refetch()} spinning={q.isFetching} />
          </>
        }
      >
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <CorrectionStatusBadge status={c.status} />
          {c.requiresSellerAcceptance && <span className="text-muted-foreground">Needs the seller's acceptance</span>}
        </div>
      </PageHeader>

      {c.correctedListingVersionId && (versionStatus === "PUBLISHED" || versionStatus === "SUPERSEDED") && (
        <Notice className="mb-4" title={versionStatus === "PUBLISHED" ? "Published" : "Published, since replaced"}>
          The corrected version{" "}
          <Link className="underline underline-offset-4" to={`/listings/${c.listingId}/versions/${c.correctedListingVersionId}`}>
            went live
          </Link>
          {versionStatus === "SUPERSEDED" ? " and has since been replaced by a newer version." : "."}
        </Notice>
      )}
      {c.status === "SUBMITTED_TO_MODERATION" && c.correctedListingVersionId && versionStatus !== "PUBLISHED" && versionStatus !== "SUPERSEDED" && (
        <Notice className="mb-4" title="In moderation">
          The corrected version is in the moderation queue.{" "}
          <Link className="underline underline-offset-4" to={`/listings/${c.listingId}/versions/${c.correctedListingVersionId}`}>
            Review it
          </Link>
          . It goes live only after it's approved and published.
        </Notice>
      )}
      {c.status === "SELLER_ACCEPTED" && (
        <Notice tone="warning" className="mb-4" title="Accepted, not yet in moderation">
          The seller accepted, but the corrected version couldn't enter moderation automatically (for example the seller has an open draft, or the listing isn't published yet). Submit it for moderation once that's resolved.
        </Notice>
      )}
      {c.changes.some((x) => x.field === "quantity") && QUANTITY_NOTE[c.quantityApplicationStatus] && <Notice className="mb-4">{QUANTITY_NOTE[c.quantityApplicationStatus]}</Notice>}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-w-0 space-y-4">
          <SectionCard>
            <PanelTitle title="Original vs proposed" />
            <ChangesTable changes={c.changes} />
          </SectionCard>
          <SectionCard>
            <PanelTitle title="Summary for the seller" />
            <p className="whitespace-pre-wrap text-sm">{c.sellerVisibleSummary}</p>
            {c.inspectorNotes && (
              <>
                <h3 className="mt-4 text-sm font-semibold">Private inspector notes</h3>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{c.inspectorNotes}</p>
              </>
            )}
          </SectionCard>
        </div>
        <div className="min-w-0 space-y-4">
          <SectionCard>
            <PanelTitle title="Details" />
            <DetailList
              columns={1}
              items={[
                { label: "Listing", value: <Link className="underline underline-offset-4" to={`/listings/${c.listingId}/versions/${c.baseListingVersionId}`}>LST-{shortId(c.listingId)} (base version)</Link> },
                { label: "Inspection", value: <Link className="underline underline-offset-4" to={`/inspections/${c.inspectionId}`}>{shortId(c.inspectionId)}</Link> },
                { label: "Seller", value: <PersonText id={c.sellerId} names={sellers} /> },
                { label: "Proposed", value: <>{fmtUtc(c.createdAtUtc)} · <PersonText id={c.proposedByUserId} names={users} /></> },
                { label: "Seller decision", value: c.sellerDecision ? <>{c.sellerDecision === "ACCEPT" ? "Accepted" : "Declined"} · {fmtUtc(c.sellerDecisionAtUtc)}</> : "—" },
                ...(c.sellerDecisionReason ? [{ label: "Seller's reason", value: <span className="whitespace-pre-wrap">{c.sellerDecisionReason}</span> }] : []),
                ...(c.disputeRequestedAtUtc ? [{ label: "Dispute raised", value: fmtUtc(c.disputeRequestedAtUtc) }] : []),
                { label: "Entered moderation", value: fmtUtc(c.moderationEnteredAtUtc) },
                ...(c.correctedListingVersionId
                  ? [{ label: "Corrected version", value: <Link className="underline underline-offset-4" to={`/listings/${c.listingId}/versions/${c.correctedListingVersionId}`}>{shortId(c.correctedListingVersionId)}</Link> }]
                  : []),
                ...(c.withdrawnAtUtc ? [{ label: "Withdrawn", value: <>{fmtUtc(c.withdrawnAtUtc)} · <PersonText id={c.withdrawnByUserId} names={users} /> {c.withdrawReason && `— “${c.withdrawReason}”`}</> }] : []),
                { label: "Quantity", value: c.quantityApplicationStatus || "—" },
              ]}
            />
          </SectionCard>
          <SectionCard>
            <AuditTimeline correctionId={c.correctionId} />
          </SectionCard>
        </div>
      </div>
    </>
  );
}

function DetailRoute() {
  const { correctionId = "" } = useParams();
  if (!isGuid(correctionId))
    return (
      <SectionCard>
        <EmptyState title="Proposal not found" description="The link does not contain a valid proposal ID." />
      </SectionCard>
    );
  return <DetailContent key={correctionId} correctionId={correctionId.toLowerCase()} />;
}

export default function CorrectionDetailPage() {
  return (
    <RequirePermission permission={P.INSPECTIONS_VIEW}>
      <DetailRoute />
    </RequirePermission>
  );
}
