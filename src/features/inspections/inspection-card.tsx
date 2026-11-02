import { Link } from "react-router";
import { ArrowRightIcon, CaretLeftIcon, CaretRightIcon, ClipboardTextIcon } from "@phosphor-icons/react";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/feedback/states";
import type { InspectionSummaryDto } from "@/api/types/catalog-moderation";
import { PersonText, ageSince, fmtUtc, shortId } from "@/features/listings/shared";

export function milestone(i: InspectionSummaryDto): string {
  if (i.completedAtUtc) return `Completed ${fmtUtc(i.completedAtUtc)}`;
  if (i.cancelledAtUtc) return `Cancelled ${fmtUtc(i.cancelledAtUtc)}`;
  if (i.startedAtUtc) return `Started ${fmtUtc(i.startedAtUtc)}`;
  if (i.assignedAtUtc) return `Assigned ${fmtUtc(i.assignedAtUtc)}`;
  return `Created ${fmtUtc(i.createdAtUtc)}`;
}

/** Touch-friendly inspection row used on phones and in dashboard lists. */
export function InspectionCard({ inspection: i, userNames, showInspector = true }: { inspection: InspectionSummaryDto; userNames?: Map<string, string>; showInspector?: boolean }) {
  return (
    <Link
      to={`/inspections/${i.inspectionId}`}
      className="group flex items-start gap-3 rounded-lg border border-border bg-surface p-3.5 transition-colors hover:border-secondary-border hover:bg-surface-muted/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action-border"
    >
      <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-md bg-surface-muted text-foreground">
        <ClipboardTextIcon className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-mono text-xs font-semibold text-foreground">{i.inspectionNo}</span>
          <StatusBadge value={i.status} />
          {i.result && <StatusBadge value={i.result} />}
          {i.reinspectionOfInspectionId && <span className="text-[11px] text-muted-foreground">Re-inspection</span>}
        </span>
        <span className="mt-1 block truncate text-sm font-medium text-foreground">{i.listingTitle ?? `Listing ${shortId(i.listingId)}`}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {milestone(i)}
          {i.status !== "COMPLETED" && i.status !== "CANCELLED" && <> · open {ageSince(i.createdAtUtc)}</>}
        </span>
        {showInspector && userNames && (
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            Inspector: {i.assignedInspectorUserId ? <PersonText id={i.assignedInspectorUserId} names={userNames} /> : "Unassigned"}
          </span>
        )}
      </span>
      <ArrowRightIcon className="mt-3 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}

export function InspectionCardList({
  items,
  isLoading,
  error,
  onRetry,
  emptyTitle,
  emptyDescription,
  userNames,
  showInspector,
  page,
  pageSize,
  totalCount,
  onPageChange,
}: {
  items: InspectionSummaryDto[];
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  emptyTitle: string;
  emptyDescription?: React.ReactNode;
  userNames?: Map<string, string>;
  showInspector?: boolean;
  page?: number;
  pageSize?: number;
  totalCount?: number;
  onPageChange?: (page: number) => void;
}) {
  if (error) return <ErrorState error={error} onRetry={onRetry} />;
  if (isLoading)
    return (
      <ul className="space-y-2" aria-busy="true" aria-label="Loading inspections">
        {[0, 1, 2].map((k) => (
          <li key={k} className="h-[88px] animate-pulse rounded-lg border border-border bg-surface" />
        ))}
      </ul>
    );
  if (!items.length) return <EmptyState title={emptyTitle} description={emptyDescription} />;
  const pages = page && pageSize && totalCount ? Math.max(1, Math.ceil(totalCount / pageSize)) : 1;
  return (
    <div>
      <ul className="space-y-2">
        {items.map((i) => (
          <li key={i.inspectionId}>
            <InspectionCard inspection={i} userNames={userNames} showInspector={showInspector} />
          </li>
        ))}
      </ul>
      {onPageChange && page && pages > 1 && (
        <div className="mt-3 flex items-center justify-between gap-2 text-sm">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label="Previous page">
            <CaretLeftIcon /> Prev
          </Button>
          <span className="text-muted-foreground">
            Page {page} of {pages}
          </span>
          <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => onPageChange(page + 1)} aria-label="Next page">
            Next <CaretRightIcon />
          </Button>
        </div>
      )}
    </div>
  );
}
