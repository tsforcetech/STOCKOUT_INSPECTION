import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Toolbar, RefreshButton } from "@/components/common/section-card";
import { DataTable } from "@/components/tables/data-table";
import { Input, Label, NativeSelect } from "@/components/ui/input";
import { Badge } from "@/components/ui/misc";
import { useUrlState } from "@/hooks/use-url-state";
import { humanize } from "@/lib/utils/format";
import type { AccountActivityItem, AccountActivityQuery, KnownAccountActivityEventType } from "@/api/types/identity";
import { formatUtcDateTime } from "@/features/team/utc";
import { useActivityQuery } from "./queries";

const EVENT_TYPES: KnownAccountActivityEventType[] = [
  "LOGIN_SUCCEEDED",
  "LOGIN_FAILED",
  "MFA_LOGIN_SUCCEEDED",
  "MFA_LOGIN_FAILED",
  "MFA_ENABLED",
  "MFA_DISABLED",
  "MFA_RESEND_REQUESTED",
  "PASSWORD_CHANGED",
  "PASSWORD_RESET",
  "SESSION_REVOKED",
  "ALL_SESSIONS_REVOKED",
  "LOGOUT",
  "STEP_UP_SUCCEEDED",
  "STEP_UP_FAILED",
  "ACCOUNT_LOCKED",
  "ACCOUNT_UNLOCKED",
  "ACCOUNT_STATUS_CHANGED",
  "USER_STATUS_CHANGE",
  "REGISTRATION_SUCCEEDED",
  "EMAIL_VERIFICATION_SUCCEEDED",
  "MOBILE_VERIFICATION_SUCCEEDED",
];

/** GET /auth/account/activity — server-paginated (pageSize clamped to 100 server-side). Rate limited: 10 req/min. */
export function ActivityCard() {
  const [state, setState] = useUrlState({ apage: 1, asize: 20, event: "", from: "", to: "" });
  const query: AccountActivityQuery = React.useMemo(
    () => ({
      page: state.apage,
      pageSize: Math.min(100, state.asize),
      eventType: state.event || undefined,
      fromUtc: state.from ? `${state.from}T00:00:00Z` : undefined,
      // Inclusive `OccurredAtUtc <= @ToUtc` (identity-access 016_Add_Account_Activity_Tracking.sql:59): cover the whole last second.
      toUtc: state.to ? `${state.to}T23:59:59.9999999Z` : undefined,
    }),
    [state.apage, state.asize, state.event, state.from, state.to],
  );
  const activity = useActivityQuery(query);

  const columns = React.useMemo<ColumnDef<AccountActivityItem, unknown>[]>(
    () => [
      { id: "when", header: "When", cell: ({ row }) => formatUtcDateTime(row.original.occurredAtUtc) },
      { id: "event", header: "Event", cell: ({ row }) => humanize(row.original.eventType) },
      {
        id: "result",
        header: "Result",
        cell: ({ row }) => (
          <Badge tone={row.original.success ? "success" : "danger"} dot>
            {row.original.success ? "Success" : "Failed"}
          </Badge>
        ),
      },
      { id: "ip", header: "IP address", cell: ({ row }) => row.original.ipAddress || "—" },
      {
        id: "details",
        header: "Details",
        cell: ({ row }) => (
          <span className="block max-w-[320px] truncate font-mono text-xs text-muted-foreground" title={row.original.details ?? undefined}>
            {row.original.details || "—"}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <>
      <Toolbar
        left={
          <>
            <NativeSelect className="h-[38px] w-56" value={state.event} onChange={(e) => setState({ event: e.target.value, apage: 1 })} aria-label="Event type">
              <option value="">All events</option>
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {humanize(t)}
                </option>
              ))}
            </NativeSelect>
            <div className="flex items-center gap-2">
              <Label htmlFor="activity-from" className="text-xs">
                From
              </Label>
              <Input id="activity-from" type="date" className="h-[38px] w-40" value={state.from} max={state.to || undefined} onChange={(e) => setState({ from: e.target.value, apage: 1 })} />
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="activity-to" className="text-xs">
                To
              </Label>
              <Input id="activity-to" type="date" className="h-[38px] w-40" value={state.to} min={state.from || undefined} onChange={(e) => setState({ to: e.target.value, apage: 1 })} />
            </div>
          </>
        }
        right={<RefreshButton onClick={() => activity.refetch()} spinning={activity.isFetching} />}
      />
      <DataTable
        caption="Account activity"
        columns={columns}
        data={activity.data?.items}
        getRowId={(a) => a.id}
        isLoading={activity.isLoading}
        isFetching={activity.isFetching && !activity.isLoading}
        error={activity.error}
        onRetry={() => activity.refetch()}
        pagination={{
          page: state.apage,
          pageSize: Math.min(100, state.asize),
          totalCount: activity.data?.totalCount ?? 0,
          onPageChange: (apage) => setState({ apage }),
          onPageSizeChange: (asize) => setState({ asize, apage: 1 }),
        }}
        emptyTitle="No activity found"
        emptyDescription={state.event || state.from || state.to ? "Try a wider date range or another event type." : undefined}
      />
      <p className="mt-3 text-xs text-muted-foreground">Dates are interpreted in UTC. This view is rate limited (10 requests per minute); if it stops loading, wait a minute and refresh.</p>
    </>
  );
}
