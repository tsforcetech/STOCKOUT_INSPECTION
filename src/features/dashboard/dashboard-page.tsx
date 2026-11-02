import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRightIcon, CheckCircleIcon, ClipboardTextIcon, HourglassIcon, NotePencilIcon, ScalesIcon, SpinnerGapIcon, UserCheckIcon } from "@phosphor-icons/react";
import { PageHeader } from "@/components/common/page-header";
import { StatCards } from "@/components/common/stat-cards";
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
import { InspectionCardList } from "@/features/inspections/inspection-card";

function greeting(now = new Date()) {
  const h = now.getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function count(q: { data?: { totalCount?: number }; isLoading: boolean; error: unknown }) {
  return { value: formatNumber(q.data?.totalCount), loading: q.isLoading, unavailable: q.error ? "Unavailable" : undefined };
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
  const name = user?.firstName || user?.displayName?.split(" ")[0] || "";

  return (
    <>
      <PageHeader
        eyebrow="StockOut inspection"
        title={`${greeting()}${name ? `, ${name}` : ""}`}
        description="Your inspection work at a glance: what's assigned to you, what's in progress and what's waiting."
        actions={
          <Button variant="action" size="lg" className="h-12 w-full text-base sm:w-auto" asChild>
            <Link to="/my">
              <UserCheckIcon /> My inspections
            </Link>
          </Button>
        }
      />
      <StatCards
        className="mb-4"
        items={[
          { label: "Assigned to me", hint: "Ready to start", icon: <UserCheckIcon />, ...count(myAssigned) },
          { label: "In progress", hint: "Started by me", icon: <SpinnerGapIcon />, ...count(myInProgress) },
          { label: "Completed by me", hint: "All time", icon: <CheckCircleIcon />, ...count(myCompleted) },
          { label: "Waiting for inspector", hint: "Unassigned in the queue", icon: <HourglassIcon />, ...count(pending) },
        ]}
      />

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
