import { Link, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftIcon } from "@phosphor-icons/react";
import { PageHeader, DetailList } from "@/components/common/page-header";
import { SectionCard, RefreshButton } from "@/components/common/section-card";
import { StatusBadge } from "@/components/common/status-badge";
import { IdText } from "@/components/common/copy-button";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/feedback/states";
import { RequirePermission } from "@/lib/auth/guards";
import { useAccess } from "@/lib/auth/use-access";
import { PERMISSIONS as P } from "@/api/types/user-organization";
import { inspectionsService } from "@/services/inspections.service";
import { Notice, PanelTitle, PersonText, fmtUtc, isGuid, shortId, useSellerNames, useUserNames } from "@/features/listings/shared";
import { inspectionKeys } from "./queries";
import { ChecklistPanel } from "./detail/checklist";
import { EvidencePanel } from "./detail/evidence";
import { InspectionActions, useInspectorRights } from "./detail/actions";
import { InspectionHistory } from "./detail/history";
import { CorrectionPanel } from "@/features/corrections/correction-panel";
import type { InspectionDetailDto } from "@/api/types/catalog-moderation";

function Summary({ inspection }: { inspection: InspectionDetailDto }) {
  const { can } = useAccess();
  const users = useUserNames();
  const sellers = useSellerNames();
  const i = inspection;
  const listingHref = `/listings/${i.listingId}/versions/${i.listingVersionId}`;
  return (
    <SectionCard>
      <PanelTitle title="Summary" />
      <DetailList
        columns={3}
        items={[
          {
            label: "Listing",
            value: (
              <span className="inline-flex flex-col">
                {can(P.CATALOG_LISTINGS_REVIEW) ? (
                  <Link className="underline underline-offset-4" to={listingHref}>
                    {i.listingTitle ?? `LST-${shortId(i.listingId)}`}
                  </Link>
                ) : (
                  (i.listingTitle ?? `LST-${shortId(i.listingId)}`)
                )}
                <IdText value={i.listingVersionId} />
              </span>
            ),
          },
          { label: "Seller", value: <PersonText id={i.sellerId} names={sellers} /> },
          { label: "Checklist template", value: <IdText value={i.inspectionChecklistTemplateId} /> },
          { label: "Inspector", value: i.assignedInspectorUserId ? <PersonText id={i.assignedInspectorUserId} names={users} /> : "Unassigned" },
          { label: "Assigned", value: i.assignedAtUtc ? <>{fmtUtc(i.assignedAtUtc)} {i.assignedByUserId && <PersonText id={i.assignedByUserId} names={users} />}</> : "—" },
          { label: "Created", value: <>{fmtUtc(i.createdAtUtc)} <PersonText id={i.createdByUserId} names={users} /></> },
          { label: "Started", value: fmtUtc(i.startedAtUtc) },
          { label: "Completed", value: fmtUtc(i.completedAtUtc) },
          { label: "Cancelled", value: fmtUtc(i.cancelledAtUtc) },
          ...(i.reinspectionOfInspectionId
            ? [{ label: "Re-inspection of", value: <Link className="underline underline-offset-4" to={`/inspections/${i.reinspectionOfInspectionId}`}>{shortId(i.reinspectionOfInspectionId)}</Link> }]
            : []),
          ...(i.summary ? [{ label: "Summary", value: <span className="whitespace-pre-wrap">{i.summary}</span>, full: true }] : []),
          ...(i.failureReasonCode ? [{ label: "Failure reason", value: i.failureReasonCode }] : []),
          ...(i.failureNotes ? [{ label: "Failure notes", value: <span className="whitespace-pre-wrap">{i.failureNotes}</span>, full: true }] : []),
        ]}
      />
    </SectionCard>
  );
}

function DetailContent({ inspectionId }: { inspectionId: string }) {
  const query = useQuery({ queryKey: inspectionKeys.detail(inspectionId), queryFn: ({ signal }) => inspectionsService.detail(inspectionId, signal) });
  const inspection = query.data;
  const rights = useInspectorRights(inspection?.assignedInspectorUserId);

  if (query.isLoading) return <PageSkeleton />;
  if (query.error || !inspection) {
    return (
      <SectionCard>
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      </SectionCard>
    );
  }

  const s = inspection.status;
  const responsesEditable = s === "IN_PROGRESS" && rights.canAct;
  const evidenceEditable = (s === "ASSIGNED" || s === "IN_PROGRESS") && rights.canAct;

  return (
    <>
      <div className="mb-2 px-0 sm:px-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/inspections">
            <ArrowLeftIcon /> Inspections
          </Link>
        </Button>
      </div>
      <PageHeader
        eyebrow="Inspection"
        title={inspection.inspectionNo}
        description={inspection.listingTitle ?? undefined}
        actions={
          <>
            <InspectionActions inspection={inspection} />
            <RefreshButton onClick={() => query.refetch()} spinning={query.isFetching} />
          </>
        }
      >
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <StatusBadge value={s} />
          {inspection.result && <StatusBadge value={inspection.result} />}
        </div>
      </PageHeader>

      {(s === "ASSIGNED" || s === "IN_PROGRESS") && !rights.canAct && (
        <Notice className="mb-4">Only the assigned inspector, or a user with inspections.override, can record responses and evidence. You need inspections.perform to act.</Notice>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-w-0 space-y-4">
          <Summary inspection={inspection} />
          <ChecklistPanel key={inspection.inspectionId} inspection={inspection} editable={responsesEditable} />
          <CorrectionPanel inspection={inspection} />
        </div>
        <div className="min-w-0 space-y-4">
          <EvidencePanel inspection={inspection} editable={evidenceEditable} />
        </div>
      </div>
      <div className="mt-4">
        {/* Full width: the status/assignment tables have too many columns for the 420px side rail. */}
        <InspectionHistory inspection={inspection} />
      </div>
    </>
  );
}

function DetailRoute() {
  const { inspectionId = "" } = useParams();
  if (!isGuid(inspectionId)) {
    return (
      <SectionCard>
        <EmptyState title="Inspection not found" description="The link does not contain a valid inspection ID." />
      </SectionCard>
    );
  }
  return <DetailContent key={inspectionId} inspectionId={inspectionId.toLowerCase()} />;
}

export default function InspectionDetailPage() {
  return (
    <RequirePermission permission={P.INSPECTIONS_VIEW}>
      <DetailRoute />
    </RequirePermission>
  );
}
