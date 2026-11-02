import * as React from "react";
import { Link, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowsClockwiseIcon,
  CameraIcon,
  CheckCircleIcon,
  CloudCheckIcon,
  CloudSlashIcon,
  DotsThreeVerticalIcon,
  InfoIcon,
  ListChecksIcon,
  PlayIcon,
  ProhibitIcon,
  SpinnerGapIcon,
  FlagCheckeredIcon,
  UserPlusIcon,
  UserSwitchIcon,
} from "@phosphor-icons/react";
import { DetailList } from "@/components/common/page-header";
import { SectionCard } from "@/components/common/section-card";
import { StatusBadge } from "@/components/common/status-badge";
import { IdText } from "@/components/common/copy-button";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/feedback/states";
import { RequirePermission } from "@/lib/auth/guards";
import { useAccess } from "@/lib/auth/use-access";
import { useUrlState } from "@/hooks/use-url-state";
import { cn } from "@/lib/utils/cn";
import { PERMISSIONS as P } from "@/api/types/user-organization";
import { inspectionsService } from "@/services/inspections.service";
import { Notice, PanelTitle, PersonText, fmtUtc, isGuid, shortId, useSellerNames, useUserNames } from "@/features/listings/shared";
import { inspectionKeys } from "./queries";
import { ChecklistPanel } from "./detail/checklist";
import { PhotoUploadsProvider, PhotosPanel } from "./detail/evidence";
import { InspectionDialogs, useActionFlags, useInspectorRights, type ActionKind } from "./detail/actions";
import { InspectionHistory } from "./detail/history";
import { FinishStep, readiness, type Step } from "./detail/finish";
import { InspectionWriterProvider, useInspectionWriter } from "./detail/writer";
import { CorrectionPanel } from "@/features/corrections/correction-panel";
import type { InspectionDetailDto } from "@/api/types/catalog-moderation";

function Details({ inspection }: { inspection: InspectionDetailDto }) {
  const { can } = useAccess();
  const users = useUserNames();
  const sellers = useSellerNames();
  const i = inspection;
  return (
    <SectionCard>
      <PanelTitle title="Details" />
      <DetailList
        columns={2}
        items={[
          {
            label: "Listing",
            value: can(P.CATALOG_LISTINGS_REVIEW) ? (
              <Link className="underline underline-offset-4" to={`/listings/${i.listingId}/versions/${i.listingVersionId}`}>
                {i.listingTitle ?? `LST-${shortId(i.listingId)}`}
              </Link>
            ) : (
              (i.listingTitle ?? `LST-${shortId(i.listingId)}`)
            ),
          },
          { label: "Seller", value: <PersonText id={i.sellerId} names={sellers} /> },
          { label: "Inspector", value: i.assignedInspectorUserId ? <PersonText id={i.assignedInspectorUserId} names={users} /> : "Unassigned" },
          { label: "Assigned", value: i.assignedAtUtc ? <>{fmtUtc(i.assignedAtUtc)} {i.assignedByUserId && <>by <PersonText id={i.assignedByUserId} names={users} /></>}</> : "—" },
          { label: "Created", value: fmtUtc(i.createdAtUtc) },
          { label: "Started", value: fmtUtc(i.startedAtUtc) },
          ...(i.completedAtUtc ? [{ label: "Completed", value: fmtUtc(i.completedAtUtc) }] : []),
          ...(i.cancelledAtUtc ? [{ label: "Cancelled", value: fmtUtc(i.cancelledAtUtc) }] : []),
          ...(i.reinspectionOfInspectionId
            ? [{ label: "Re-inspection of", value: <Link className="underline underline-offset-4" to={`/inspections/${i.reinspectionOfInspectionId}`}>{shortId(i.reinspectionOfInspectionId)}</Link> }]
            : []),
          { label: "Reference IDs", value: <span className="flex flex-col gap-0.5"><IdText value={i.listingVersionId} /><IdText value={i.inspectionChecklistTemplateId} /></span>, full: true },
        ]}
      />
    </SectionCard>
  );
}

/** Shown on a finished inspection instead of the Result form. */
function ResultBanner({ inspection: i }: { inspection: InspectionDetailDto }) {
  if (i.status === "CANCELLED")
    return (
      <SectionCard>
        <p className="flex items-center gap-2 font-heading text-lg font-bold"><ProhibitIcon className="size-6 text-muted-foreground" /> Cancelled</p>
        <p className="mt-1 text-sm text-muted-foreground">Cancelled {fmtUtc(i.cancelledAtUtc)}.</p>
      </SectionCard>
    );
  const tone = i.result === "PASS" ? "border-success/40 bg-success-soft text-success-soft-foreground" : i.result === "FAIL" ? "border-danger/40 bg-danger-soft text-danger-soft-foreground" : "border-warning/40 bg-warning-soft text-warning-soft-foreground";
  return (
    <div className={cn("rounded-xl border p-4 sm:p-5", tone)}>
      <p className="flex items-center gap-2 font-heading text-xl font-bold">
        <CheckCircleIcon weight="fill" className="size-6" /> Result: {i.result === "PASS" ? "Pass" : i.result === "FAIL" ? "Fail" : "Re-inspect"}
      </p>
      <p className="mt-1 text-sm opacity-90">Submitted {fmtUtc(i.completedAtUtc)}.</p>
      {i.failureReasonCode && <p className="mt-3 text-sm"><span className="font-medium">Reason:</span> {i.failureReasonCode.replaceAll("_", " ").toLowerCase()}</p>}
      {i.failureNotes && <p className="mt-1 whitespace-pre-wrap text-sm">{i.failureNotes}</p>}
      {i.summary && <p className="mt-3 whitespace-pre-wrap text-sm"><span className="font-medium">Summary:</span> {i.summary}</p>}
    </div>
  );
}

function SaveIndicator({ announce = true }: { announce?: boolean }) {
  const { saveState } = useInspectionWriter();
  if (saveState === "idle") return null;
  const map = {
    pending: { icon: <SpinnerGapIcon className="animate-spin" />, text: "Saving…", cls: "text-muted-foreground" },
    saving: { icon: <SpinnerGapIcon className="animate-spin" />, text: "Saving…", cls: "text-muted-foreground" },
    saved: { icon: <CloudCheckIcon weight="fill" />, text: "Saved", cls: "text-success" },
    error: { icon: <CloudSlashIcon weight="fill" />, text: "Not saved", cls: "text-danger" },
  } as const;
  const m = map[saveState];
  return (
    <span role={announce ? "status" : undefined} aria-live={announce ? "polite" : undefined} className={cn("inline-flex items-center gap-1 text-xs font-medium [&_svg]:size-4", m.cls)}>
      {m.icon} {m.text}
    </span>
  );
}

const STEPS: Array<{ id: Step; label: string; icon: React.ReactNode }> = [
  { id: "checklist", label: "Checklist", icon: <ListChecksIcon /> },
  { id: "photos", label: "Photos", icon: <CameraIcon /> },
  { id: "finish", label: "Result", icon: <FlagCheckeredIcon /> },
  { id: "details", label: "Details", icon: <InfoIcon /> },
];

function DetailContent({ inspection, refetch, fetching }: { inspection: InspectionDetailDto; refetch: () => void; fetching: boolean }) {
  const rights = useInspectorRights(inspection.assignedInspectorUserId);
  const flags = useActionFlags(inspection);
  const [dialog, setDialog] = React.useState<ActionKind | null>(null);
  const [state, setState] = useUrlState({ step: "checklist" });
  const step = (STEPS.some((x) => x.id === state.step) ? state.step : "checklist") as Step;
  const goTo = React.useCallback((s: Step) => {
    setState({ step: s });
    document.scrollingElement?.scrollTo?.({ top: 0, behavior: "smooth" });
  }, [setState]);

  const s = inspection.status;
  const open = s === "PENDING" || s === "ASSIGNED" || s === "IN_PROGRESS";
  const responsesEditable = s === "IN_PROGRESS" && rights.canAct;
  const photosEditable = (s === "ASSIGNED" || s === "IN_PROGRESS") && rights.canAct;
  const total = inspection.responses.length;
  const answered = inspection.responses.filter((r) => r.itemResult).length;
  const pct = total ? Math.round((answered / total) * 100) : 0;
  const ready = readiness(inspection);

  const menu: Array<{ kind: ActionKind; label: string; icon: React.ReactNode; danger?: boolean }> = [
    { kind: "reassign" as const, label: "Reassign inspector", icon: <UserSwitchIcon /> },
    { kind: "reinspect" as const, label: "Authorize re-inspection", icon: <ArrowsClockwiseIcon /> },
    { kind: "cancel" as const, label: "Cancel inspection", icon: <ProhibitIcon />, danger: true },
  ].filter((m) => flags[m.kind]);

  // One primary action at a time, at the bottom of the screen.
  let primary: { label: string; icon: React.ReactNode; onClick: () => void } | null = null;
  if (flags.assign) primary = { label: "Assign inspector", icon: <UserPlusIcon />, onClick: () => setDialog("assign") };
  else if (flags.start) primary = { label: "Start inspection", icon: <PlayIcon />, onClick: () => setDialog("start") };
  else if (flags.complete && step === "checklist") primary = { label: ready.unanswered.length ? `Next: Photos (${ready.unanswered.length} not answered)` : "Next: Photos", icon: <ArrowRightIcon />, onClick: () => goTo("photos") };
  else if (flags.complete && step === "photos") primary = { label: "Next: Result", icon: <ArrowRightIcon />, onClick: () => goTo("finish") };
  else if (flags.complete && step === "details") primary = { label: "Back to checklist", icon: <ArrowLeftIcon />, onClick: () => goTo("checklist") };
  else if (flags.reinspect) primary = { label: "Authorize re-inspection", icon: <ArrowsClockwiseIcon />, onClick: () => setDialog("reinspect") };

  const counts: Partial<Record<Step, string>> = { checklist: `${answered}/${total}`, photos: String(inspection.evidence.length) };

  return (
    <>
      {/* Sticky header: where am I, how far am I, is it saved. */}
      <div className="sticky top-16 z-20 -mx-3 -mt-4 mb-4 border-b border-border bg-surface/95 px-3 pb-3 pt-3 backdrop-blur sm:-mx-6 sm:px-6 md:-mt-6 md:rounded-b-xl lg:top-[71px] lg:-mx-8 lg:-mt-8 lg:px-8">
        <div className="flex items-start gap-2">
          <Button asChild variant="ghost" size="icon" className="-ml-2 shrink-0">
            <Link to="/my" aria-label="Back to my inspections">
              <ArrowLeftIcon className="size-5" />
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h1 className="font-mono text-sm font-bold text-foreground sm:text-base">{inspection.inspectionNo}</h1>
              <StatusBadge value={s} />
              {inspection.result && <StatusBadge value={inspection.result} />}
              <SaveIndicator />
            </div>
            <p className="truncate font-heading text-base font-semibold text-foreground sm:text-lg">{inspection.listingTitle ?? `Listing ${shortId(inspection.listingId)}`}</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="More actions" className="shrink-0">
                <DotsThreeVerticalIcon className="size-6" weight="bold" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-60">
              {menu.map((m) => (
                <DropdownMenuItem key={m.kind} tone={m.danger ? "danger" : undefined} onSelect={() => setDialog(m.kind)}>
                  {m.icon} {m.label}
                </DropdownMenuItem>
              ))}
              {menu.length > 0 && <DropdownMenuSeparator />}
              <DropdownMenuItem onSelect={() => goTo("details")}>
                <InfoIcon /> Details & history
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => refetch()}>
                <ArrowsClockwiseIcon className={cn(fetching && "animate-spin")} /> Refresh
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {total > 0 && (
          <div className="mt-2 flex items-center gap-2" aria-label={`${answered} of ${total} checklist items answered`}>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-muted" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={answered}>
              <div className={cn("h-full rounded-full transition-all", answered === total ? "bg-success" : "bg-action-border")} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs font-medium tabular-nums text-muted-foreground">
              {answered}/{total}
            </span>
          </div>
        )}
        <nav aria-label="Inspection steps" className="mt-3 grid grid-cols-4 gap-1 rounded-lg bg-surface-muted p-1">
          {STEPS.map((x, n) => {
            const on = x.id === step;
            return (
              <button
                key={x.id}
                type="button"
                aria-current={on ? "step" : undefined}
                onClick={() => goTo(x.id)}
                className={cn(
                  "flex min-h-11 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-md px-1 text-[11px] font-medium transition-colors sm:flex-row sm:gap-1.5 sm:text-sm [&_svg]:size-4",
                  on ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span className="flex items-center gap-1">
                  {x.id !== "details" && <span className="hidden font-bold sm:inline">{n + 1}.</span>}
                  {x.icon}
                </span>
                <span>
                  {x.label}
                  {counts[x.id] && <span className="ml-1 tabular-nums opacity-70">{counts[x.id]}</span>}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      {open && !rights.canAct && s !== "PENDING" && <Notice className="mb-4">You can view this inspection. Only the assigned inspector can answer the checklist and add photos.</Notice>}
      {s === "ASSIGNED" && rights.canAct && (
        <div className="mb-4 rounded-xl border border-action-border bg-action-soft p-4 text-sm text-foreground">
          <p className="font-heading text-base font-bold">Ready when you are</p>
          <p className="mt-1">Tap <span className="font-semibold">Start inspection</span> when you are on site. You can already add photos.</p>
        </div>
      )}
      {s === "PENDING" && <Notice className="mb-4">Waiting for an inspector to be assigned.</Notice>}

      <div className="space-y-4">
        {/* Kept mounted so answers typed just before switching steps are still saved. */}
        <div hidden={step !== "checklist"}>
          <ChecklistPanel key={inspection.inspectionId} inspection={inspection} editable={responsesEditable} />
        </div>
        {step === "photos" && <PhotosPanel inspection={inspection} editable={photosEditable} />}
        {step === "finish" &&
          (s === "COMPLETED" || s === "CANCELLED" ? (
            <ResultBanner inspection={inspection} />
          ) : s === "IN_PROGRESS" ? (
            <FinishStep inspection={inspection} canComplete={flags.complete} goTo={goTo} />
          ) : (
            <Notice>Start the inspection first. The result is submitted after the checklist.</Notice>
          ))}
        {step === "details" && (
          <>
            {(s === "COMPLETED" || s === "CANCELLED") && <ResultBanner inspection={inspection} />}
            <Details inspection={inspection} />
            <CorrectionPanel inspection={inspection} />
            <InspectionHistory inspection={inspection} />
          </>
        )}
      </div>

      {primary && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 backdrop-blur md:sticky md:-mx-6 md:mt-4 md:rounded-t-xl md:px-6 lg:-mx-8 lg:px-8">
          <div className="mx-auto flex max-w-[1320px] items-center gap-3">
            <span className="hidden flex-1 md:block">
              <SaveIndicator announce={false} />
            </span>
            <Button variant="action" size="lg" className="h-12 w-full text-base md:w-auto md:min-w-64" onClick={primary.onClick}>
              {primary.icon} {primary.label}
            </Button>
          </div>
        </div>
      )}

      <InspectionDialogs inspection={inspection} open={dialog} onClose={() => setDialog(null)} />
    </>
  );
}

function DetailLoader({ inspectionId }: { inspectionId: string }) {
  const query = useQuery({ queryKey: inspectionKeys.detail(inspectionId), queryFn: ({ signal }) => inspectionsService.detail(inspectionId, signal) });
  const inspection = query.data;
  if (query.isLoading) return <PageSkeleton />;
  if (query.error || !inspection) {
    return (
      <SectionCard>
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      </SectionCard>
    );
  }
  return (
    <InspectionWriterProvider inspection={inspection}>
      <PhotoUploadsProvider inspection={inspection}>
        <DetailContent inspection={inspection} refetch={() => void query.refetch()} fetching={query.isFetching} />
      </PhotoUploadsProvider>
    </InspectionWriterProvider>
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
  return <DetailLoader key={inspectionId} inspectionId={inspectionId.toLowerCase()} />;
}

export default function InspectionDetailPage() {
  return (
    <RequirePermission permission={P.INSPECTIONS_VIEW}>
      <DetailRoute />
    </RequirePermission>
  );
}
