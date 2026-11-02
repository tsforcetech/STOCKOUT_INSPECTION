import { CheckCircleIcon, SpinnerGapIcon, UserCheckIcon, XCircleIcon } from "@phosphor-icons/react";
import { PageHeader } from "@/components/common/page-header";
import { SectionCard, RefreshButton } from "@/components/common/section-card";
import { RequirePermission } from "@/lib/auth/guards";
import { useAuth } from "@/lib/auth/auth-context";
import { useUrlState } from "@/hooks/use-url-state";
import { cn } from "@/lib/utils/cn";
import { formatNumber } from "@/lib/utils/format";
import { PERMISSIONS as P } from "@/api/types/user-organization";
import type { InspectionStatus } from "@/api/types/catalog-moderation";
import { useInspectionQueueQuery } from "./queries";
import { InspectionCardList } from "./inspection-card";

const TABS: Array<{ status: InspectionStatus; label: string; icon: React.ReactNode; empty: string }> = [
  { status: "ASSIGNED", label: "To start", icon: <UserCheckIcon />, empty: "No inspections are waiting for you to start." },
  { status: "IN_PROGRESS", label: "In progress", icon: <SpinnerGapIcon />, empty: "You have no inspections in progress." },
  { status: "COMPLETED", label: "Completed", icon: <CheckCircleIcon />, empty: "You haven't completed any inspections yet." },
  { status: "CANCELLED", label: "Cancelled", icon: <XCircleIcon />, empty: "None of your inspections were cancelled." },
];

const DEFAULTS = { tab: "ASSIGNED", page: 1, pageSize: 10 };

function TabCount({ status, me }: { status: InspectionStatus; me: string }) {
  const q = useInspectionQueueQuery({ status, assignedInspectorUserId: me, page: 1, pageSize: 1 });
  if (q.data?.totalCount === undefined) return null;
  return <span className="rounded-full bg-surface-muted px-1.5 text-[11px] font-semibold text-foreground">{formatNumber(q.data.totalCount)}</span>;
}

function MyInspections() {
  const { user } = useAuth();
  const me = user?.userId?.toLowerCase() ?? "";
  const [state, setState] = useUrlState(DEFAULTS);
  const tab = TABS.find((t) => t.status === state.tab) ?? TABS[0];
  const q = useInspectionQueueQuery({ status: tab.status, assignedInspectorUserId: me, page: state.page, pageSize: state.pageSize }, Boolean(me));

  return (
    <>
      <PageHeader eyebrow="StockOut inspection" title="My inspections" description="Inspections assigned to you. Open one to start it, fill in the checklist, add photos and complete it." />
      <SectionCard>
        <div className="mb-4 flex items-center gap-2">
          <div role="tablist" aria-label="Inspection status" className="-mx-1 flex min-w-0 flex-1 gap-1 overflow-x-auto px-1 pb-1">
            {TABS.map((t) => {
              const selected = t.status === tab.status;
              return (
                <button
                  key={t.status}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setState({ tab: t.status, page: 1 })}
                  className={cn(
                    "flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 text-sm transition-colors [&_svg]:size-4",
                    selected ? "border-transparent bg-ink text-ink-foreground [&_span]:bg-surface/20 [&_span]:text-ink-foreground" : "border-border bg-surface text-foreground hover:bg-surface-muted",
                  )}
                >
                  {t.icon}
                  {t.label}
                  {me && <TabCount status={t.status} me={me} />}
                </button>
              );
            })}
          </div>
          <RefreshButton onClick={() => q.refetch()} spinning={q.isFetching} />
        </div>
        <div role="tabpanel" aria-label={tab.label}>
          <InspectionCardList
            items={q.data?.items ?? []}
            isLoading={q.isLoading}
            error={q.error}
            onRetry={() => q.refetch()}
            showInspector={false}
            emptyTitle={`Nothing ${tab.label.toLowerCase()}`}
            emptyDescription={tab.empty}
            page={state.page}
            pageSize={state.pageSize}
            totalCount={q.data?.totalCount}
            onPageChange={(page) => setState({ page })}
          />
        </div>
      </SectionCard>
    </>
  );
}

export default function MyInspectionsPage() {
  return (
    <RequirePermission permission={P.INSPECTIONS_VIEW}>
      <MyInspections />
    </RequirePermission>
  );
}
