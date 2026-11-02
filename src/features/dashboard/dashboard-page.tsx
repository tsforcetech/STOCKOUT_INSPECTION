import * as React from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRightIcon, CheckCircleIcon, ClipboardTextIcon, HourglassIcon, MagnifyingGlassIcon, NotePencilIcon, PlayIcon, ScalesIcon, SpinnerGapIcon, UserCheckIcon } from "@phosphor-icons/react";
import { PageHeader } from "@/components/common/page-header";
import { Input } from "@/components/ui/input";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/utils/cn";
import { SectionCard } from "@/components/common/section-card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/auth-context";
import { useAccess } from "@/lib/auth/use-access";
import { formatNumber } from "@/lib/utils/format";
import { PERMISSIONS as P } from "@/api/types/user-organization";
import type { InspectionQueueQuery } from "@/api/types/catalog-moderation";
import { disputesService } from "@/services/disputes.service";
import { useInspectionQueueQuery } from "@/features/inspections/queries";
import { useCorrectionsQuery } from "@/features/corrections/queries";
import { InspectionCardList, milestone } from "@/features/inspections/inspection-card";
import { shortId } from "@/features/listings/shared";
import type { InspectionSummaryDto } from "@/api/types/catalog-moderation";

function greeting(now = new Date()) {
  const h = now.getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

type CountQuery = { data?: { totalCount?: number }; isLoading: boolean; error: unknown };

function Chip({ to, icon, label, q }: { to: string; icon: React.ReactNode; label: string; q: CountQuery }) {
  return (
    <Link to={to} className="flex shrink-0 items-center gap-2 rounded-full border border-border bg-surface py-2 pl-3 pr-4 text-sm text-foreground transition-colors hover:border-secondary-border [&_svg]:size-4">
      {icon}
      <span className="text-muted-foreground">{label}</span>
      <span className="font-heading text-base font-bold tabular-nums">{q.isLoading ? "…" : q.error ? "—" : formatNumber(q.data?.totalCount)}</span>
    </Link>
  );
}

/** The one inspection to pick up next: in progress first, then the oldest assigned. */
function ContinueCard({ inspection: i }: { inspection: InspectionSummaryDto }) {
  const started = i.status === "IN_PROGRESS";
  return (
    <Link
      to={`/inspections/${i.inspectionId}`}
      className="mb-4 flex items-center gap-4 rounded-xl bg-ink p-4 text-ink-foreground shadow-sm transition-opacity hover:opacity-95 sm:p-5"
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-action text-action-foreground">
        <PlayIcon weight="fill" className="size-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold uppercase tracking-wide opacity-70">{started ? "Continue" : "Next up"}</span>
        <span className="block truncate font-heading text-lg font-bold">{i.listingTitle ?? `Listing ${shortId(i.listingId)}`}</span>
        <span className="block truncate text-sm opacity-80">
          {i.inspectionNo} · {milestone(i)}
        </span>
      </span>
      <ArrowRightIcon className="size-6 shrink-0" />
    </Link>
  );
}

/** Finds an inspection by number or listing name among the 100 most recent (the queue API has no text search). */
function Search({ enabled }: { enabled: boolean }) {
  const [text, setText] = React.useState("");
  const q = useDebouncedValue(text.trim().toLowerCase(), 250);
  const recent = useInspectionQueueQuery({ page: 1, pageSize: 100 }, enabled && q.length >= 2);
  const hits = q.length >= 2 ? (recent.data?.items ?? []).filter((i) => i.inspectionNo.toLowerCase().includes(q) || (i.listingTitle ?? "").toLowerCase().includes(q)).slice(0, 6) : [];
  return (
    <div className="mb-4">
      <div className="relative">
        <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder="Find by inspection number or listing name" aria-label="Find an inspection" className="h-12 pl-10 text-base" />
      </div>
      {q.length >= 2 && (
        <div className={cn("mt-2 rounded-lg border border-border bg-surface p-2")}>
          <InspectionCardList
            items={hits}
            isLoading={recent.isLoading}
            error={recent.error}
            showInspector={false}
            emptyTitle="No match"
            emptyDescription="Searches the 100 most recent inspections. Use All inspections for older ones."
          />
        </div>
      )}
    </div>
  );
}

function ListHeader({ title, description, to, linkLabel = "View all" }: { title: string; description?: string; to: string; linkLabel?: string }) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="font-heading text-lg font-semibold text-foreground">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      <Button variant="ghost" size="sm" asChild className="shrink-0">
        <Link to={to}>
          {linkLabel} <ArrowRightIcon />
        </Link>
      </Button>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { can } = useAccess();
  const me = user?.userId?.toLowerCase();
  const canView = can(P.INSPECTIONS_VIEW);
  const mine = (q: Omit<InspectionQueueQuery, "assignedInspectorUserId">): InspectionQueueQuery => ({ ...q, assignedInspectorUserId: me });
  const enabledMine = canView && Boolean(me);

  const myAssigned = useInspectionQueueQuery(mine({ status: "ASSIGNED", page: 1, pageSize: 5 }), enabledMine);
  const myInProgress = useInspectionQueueQuery(mine({ status: "IN_PROGRESS", page: 1, pageSize: 5 }), enabledMine);
  const myCompleted = useInspectionQueueQuery(mine({ status: "COMPLETED", page: 1, pageSize: 1 }), enabledMine);
  const pending = useInspectionQueueQuery({ status: "PENDING", page: 1, pageSize: 5 }, canView);
  const corrections = useCorrectionsQuery({ status: "AWAITING_SELLER_DECISION", page: 1, pageSize: 1 }, canView);
  const disputes = useQuery({
    queryKey: ["disputes", "queue", { status: "SUBMITTED", page: 1, pageSize: 1 }],
    queryFn: ({ signal }) => disputesService.queue({ status: "SUBMITTED", page: 1, pageSize: 1 }, signal),
    enabled: canView,
  });

  const active = [...(myInProgress.data?.items ?? []), ...(myAssigned.data?.items ?? [])];
  const next = active[0];
  const name = user?.firstName || user?.displayName?.split(" ")[0] || "";

  return (
    <>
      <PageHeader eyebrow="StockOut inspection" title={`${greeting()}${name ? `, ${name}` : ""}`} />

      {next && <ContinueCard inspection={next} />}

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1" aria-label="My numbers">
        <Chip to="/my?tab=ASSIGNED" icon={<UserCheckIcon />} label="To start" q={myAssigned} />
        <Chip to="/my?tab=IN_PROGRESS" icon={<SpinnerGapIcon />} label="In progress" q={myInProgress} />
        <Chip to="/my?tab=COMPLETED" icon={<CheckCircleIcon />} label="Done by me" q={myCompleted} />
        <Chip to="/inspections?status=PENDING" icon={<HourglassIcon />} label="Waiting" q={pending} />
      </div>

      <Search enabled={canView} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <SectionCard>
          <ListHeader title="My active inspections" description="In progress first, then assigned to you." to="/my" />
          <InspectionCardList
            items={active}
            isLoading={myAssigned.isLoading || myInProgress.isLoading}
            error={myAssigned.error ?? myInProgress.error}
            onRetry={() => {
              void myAssigned.refetch();
              void myInProgress.refetch();
            }}
            showInspector={false}
            emptyTitle="Nothing assigned to you"
            emptyDescription="New work appears here as soon as an inspection is assigned to you."
          />
        </SectionCard>

        <div className="space-y-4">
          <SectionCard>
            <ListHeader title="Waiting for an inspector" description="Pending inspections in the queue." to="/inspections?status=PENDING" />
            <InspectionCardList
              items={pending.data?.items ?? []}
              isLoading={pending.isLoading}
              error={pending.error}
              onRetry={() => void pending.refetch()}
              showInspector={false}
              emptyTitle="Queue is clear"
              emptyDescription="No inspections are waiting for assignment."
            />
          </SectionCard>

          <SectionCard>
            <h2 className="mb-3 font-heading text-lg font-semibold text-foreground">Follow-ups</h2>
            <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              <FollowUp to="/corrections" icon={<NotePencilIcon />} label="Corrections awaiting seller" value={corrections.data?.totalCount} loading={corrections.isLoading} />
              <FollowUp to="/disputes" icon={<ScalesIcon />} label="Disputes awaiting decision" value={disputes.data?.totalCount} loading={disputes.isLoading} />
              <FollowUp to="/inspections" icon={<ClipboardTextIcon />} label="All inspections" />
            </ul>
          </SectionCard>
        </div>
      </div>
    </>
  );
}

function FollowUp({ to, icon, label, value, loading }: { to: string; icon: React.ReactNode; label: string; value?: number; loading?: boolean }) {
  return (
    <li>
      <Link to={to} className="flex items-center gap-3 rounded-lg border border-border bg-surface-muted p-3 transition-colors hover:border-secondary-border">
        <span className="flex size-9 items-center justify-center rounded-md bg-surface text-foreground [&_svg]:size-5">{icon}</span>
        <span className="min-w-0 flex-1 truncate text-sm text-foreground">{label}</span>
        {value !== undefined && !loading && <span className="font-heading text-lg font-bold">{formatNumber(value)}</span>}
        <ArrowRightIcon className="size-4 text-muted-foreground" aria-hidden />
      </Link>
    </li>
  );
}
