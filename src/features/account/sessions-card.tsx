import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { DesktopIcon, SignOutIcon } from "@phosphor-icons/react";
import { RefreshButton, RowAction } from "@/components/common/section-card";
import { EntityCell } from "@/components/common/entity-cell";
import { IdText } from "@/components/common/copy-button";
import { DataTable } from "@/components/tables/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/misc";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth/auth-context";
import { decodeJwtPayload, tokenStore } from "@/lib/auth/token-store";
import { getErrorMessage } from "@/lib/api/errors";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { authService } from "@/services/auth.service";
import type { SessionDto } from "@/api/types/identity";
import { formatUtcDateTime } from "@/features/team/utc";
import { accountKeys, useSessionsQuery } from "./queries";

const normalise = (id: string) => id.replace(/-/g, "").toLowerCase();

function currentSid(): string | null {
  const token = tokenStore.getAccessToken();
  const sid = token ? decodeJwtPayload(token)?.sid : undefined;
  return typeof sid === "string" && sid ? normalise(sid) : null;
}

type Pending = { kind: "one"; session: SessionDto; isCurrent: boolean } | { kind: "all" } | null;

export function SessionsCard() {
  const { endSessionLocally } = useAuth();
  const query = useSessionsQuery();
  const [pending, setPending] = React.useState<Pending>(null);
  const sid = currentSid();
  const isCurrent = React.useCallback((s: SessionDto) => s.isCurrentSession || (sid !== null && normalise(s.sessionId) === sid), [sid]);

  const mutation = useApiMutation({
    mutationFn: (p: NonNullable<Pending>) => (p.kind === "all" ? authService.logoutAll() : authService.revokeSession(p.session.sessionId)),
    invalidate: (_d, p) => (p.kind === "one" && !p.isCurrent ? [accountKeys.sessions] : []),
    toastOnError: false,
    onSuccess: (_d, p) => {
      setPending(null);
      if (p.kind === "all" || p.isCurrent) {
        toast.success(p.kind === "all" ? "All sessions were signed out." : "You have been signed out.");
        endSessionLocally("signed-out");
      } else {
        toast.success("Session revoked.");
      }
    },
  });

  const columns = React.useMemo<ColumnDef<SessionDto, unknown>[]>(
    () => [
      {
        id: "device",
        header: "Session",
        accessorFn: (s) => s.createdAtUtc,
        cell: ({ row }) => (
          <EntityCell
            icon={<DesktopIcon />}
            title={
              <span className="flex items-center gap-2">
                {row.original.deviceLabel || "Unknown device"}
                {isCurrent(row.original) && <Badge tone="primary">This browser</Badge>}
              </span>
            }
            subtitle={row.original.ipAddress || undefined}
          />
        ),
      },
      { id: "created", header: "Signed in", accessorFn: (s) => s.createdAtUtc, cell: ({ row }) => formatUtcDateTime(row.original.createdAtUtc) },
      { id: "id", header: "Session ID", enableSorting: false, cell: ({ row }) => <IdText value={row.original.sessionId} /> },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <RowAction label={isCurrent(row.original) ? "Sign out this browser" : "Revoke session"} tone="danger" onClick={() => setPending({ kind: "one", session: row.original, isCurrent: isCurrent(row.original) })}>
              <SignOutIcon />
            </RowAction>
          </div>
        ),
      },
    ],
    [isCurrent],
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <RefreshButton onClick={() => query.refetch()} spinning={query.isFetching} />
        <Button variant="danger" size="sm" className="h-[38px] px-4" onClick={() => setPending({ kind: "all" })}>
          Sign out all sessions
        </Button>
      </div>
      <DataTable
        caption="Active sessions"
        columns={columns}
        data={query.data}
        getRowId={(s) => s.sessionId}
        isLoading={query.isLoading}
        isFetching={query.isFetching && !query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
        emptyTitle="No active sessions"
      />
      <p className="text-xs text-muted-foreground">Device and IP details are not recorded by the identity service yet, so every session shows the same placeholder values.</p>
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(o) => !o && setPending(null)}
        title={pending?.kind === "all" ? "Sign out all sessions?" : pending?.isCurrent ? "Sign out this browser?" : "Revoke this session?"}
        description={
          pending?.kind === "all"
            ? "Every session — including this one — is ended immediately. You'll need to sign in again."
            : pending?.isCurrent
              ? "This is the session you're using now. You'll be signed out."
              : "The device using this session will be signed out at its next request."
        }
        confirmLabel={pending?.kind === "all" ? "Sign out all" : pending?.isCurrent ? "Sign out" : "Revoke"}
        loading={mutation.isPending}
        onConfirm={() => pending && mutation.mutate(pending, { onError: (e) => toast.error(getErrorMessage(e)) })}
      />
    </div>
  );
}
