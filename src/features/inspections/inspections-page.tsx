import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useNavigate } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRightIcon, CheckCircleIcon, ClipboardTextIcon, HourglassIcon, PlusIcon, SpinnerGapIcon, UserCheckIcon, XIcon } from "@phosphor-icons/react";
import { PageHeader } from "@/components/common/page-header";
import { StatCards } from "@/components/common/stat-cards";
import { SectionCard, Toolbar, RefreshButton, RowAction } from "@/components/common/section-card";
import { StatusBadge } from "@/components/common/status-badge";
import { EntityCell } from "@/components/common/entity-cell";
import { ExportButton } from "@/components/common/export-button";
import { FormField } from "@/components/forms/form-field";
import { DataTable } from "@/components/tables/data-table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, NativeSelect } from "@/components/ui/input";
import { RequirePermission } from "@/lib/auth/guards";
import { useAccess } from "@/lib/auth/use-access";
import { useAuth } from "@/lib/auth/auth-context";
import { useUrlState } from "@/hooks/use-url-state";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { PERMISSIONS as P } from "@/api/types/user-organization";
import type { InspectionQueueQuery, InspectionResult, InspectionStatus, InspectionSummaryDto } from "@/api/types/catalog-moderation";
import { inspectionsService } from "@/services/inspections.service";
import { formatNumber } from "@/lib/utils/format";
import { downloadCsv, toCsv } from "@/lib/utils/csv";
import { ApiErrorNotice, GUID_RE, GuidFilterInput, PersonText, dateInputToUtc, fmtUtc, shortId, useSellerNames, useUserNames } from "@/features/listings/shared";
import { inspectionKeys, useInspectionQueueQuery } from "./queries";
import { InspectionCardList } from "./inspection-card";
import { useMediaQuery } from "@/hooks/use-media-query";

export const STATUSES: InspectionStatus[] = ["PENDING", "ASSIGNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
const RESULTS: InspectionResult[] = ["PASS", "FAIL", "REINSPECTION_REQUIRED"];
const STATUS_LABEL: Record<InspectionStatus, string> = { PENDING: "Pending", ASSIGNED: "Assigned", IN_PROGRESS: "In progress", COMPLETED: "Completed", CANCELLED: "Cancelled" };
const RESULT_LABEL: Record<InspectionResult, string> = { PASS: "Pass", FAIL: "Fail", REINSPECTION_REQUIRED: "Reinspection required" };

const DEFAULTS = { page: 1, pageSize: 20, status: "", result: "", inspector: "", from: "", to: "", seller: "", category: "" };

function useStatusCount(status: InspectionStatus) {
  const q = useInspectionQueueQuery({ status, page: 1, pageSize: 1 });
  return { value: formatNumber(q.data?.totalCount), loading: q.isLoading, unavailable: q.error ? "Unavailable" : undefined };
}

function InspectionsContent() {
  const navigate = useNavigate();
  const { can } = useAccess();
  const { user } = useAuth();
  const [state, setState] = useUrlState(DEFAULTS);
  const [createOpen, setCreateOpen] = React.useState(false);
  const isPhone = useMediaQuery("(max-width: 767px)");
  const [moreFilters, setMoreFilters] = React.useState(false);
  const userNames = useUserNames();
  const sellerNames = useSellerNames();

  const query: InspectionQueueQuery = {
    page: state.page,
    pageSize: state.pageSize,
    status: (state.status || undefined) as InspectionStatus | undefined,
    result: (state.result || undefined) as InspectionResult | undefined,
    assignedInspectorUserId: state.inspector || undefined,
    dateFrom: dateInputToUtc(state.from, "start"),
    dateTo: dateInputToUtc(state.to, "end"),
    sellerId: state.seller || undefined,
    categoryId: state.category || undefined,
  };
  const queue = useInspectionQueueQuery(query);
  const items = React.useMemo(() => queue.data?.items ?? [], [queue.data]);
  const hasFilters = Boolean(state.status || state.result || state.inspector || state.from || state.to || state.seller || state.category);
  const mine = Boolean(user?.userId) && state.inspector.toLowerCase() === user?.userId.toLowerCase();

  const pending = useStatusCount("PENDING");
  const assigned = useStatusCount("ASSIGNED");
  const inProgress = useStatusCount("IN_PROGRESS");
  const completed = useStatusCount("COMPLETED");

  const columns = React.useMemo<ColumnDef<InspectionSummaryDto, unknown>[]>(
    () => [
      {
        id: "inspection",
        header: "Inspection",
        cell: ({ row }) => (
          <EntityCell
            icon={<ClipboardTextIcon />}
            title={row.original.inspectionNo}
            subtitle={`${row.original.listingTitle ?? `Listing ${shortId(row.original.listingId)}`}${row.original.reinspectionOfInspectionId ? " · re-inspection" : ""}`}
          />
        ),
      },
      { id: "status", header: "Status", cell: ({ row }) => <StatusBadge value={row.original.status} /> },
      { id: "result", header: "Result", cell: ({ row }) => <StatusBadge value={row.original.result} /> },
      { id: "inspector", header: "Inspector", cell: ({ row }) => (row.original.assignedInspectorUserId ? <PersonText id={row.original.assignedInspectorUserId} names={userNames} /> : <span className="text-muted-foreground">Unassigned</span>) },
      { id: "seller", header: "Seller", cell: ({ row }) => <PersonText id={row.original.sellerId} names={sellerNames} /> },
      { id: "created", header: "Created", cell: ({ row }) => fmtUtc(row.original.createdAtUtc) },
      {
        id: "progress",
        header: "Last milestone",
        cell: ({ row }) => {
          const i = row.original;
          if (i.completedAtUtc) return `Completed ${fmtUtc(i.completedAtUtc)}`;
          if (i.cancelledAtUtc) return `Cancelled ${fmtUtc(i.cancelledAtUtc)}`;
          if (i.startedAtUtc) return `Started ${fmtUtc(i.startedAtUtc)}`;
          if (i.assignedAtUtc) return `Assigned ${fmtUtc(i.assignedAtUtc)}`;
          return "—";
        },
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <RowAction label="Open inspection" onClick={() => navigate(`/inspections/${row.original.inspectionId}`)}>
              <ArrowRightIcon />
            </RowAction>
          </div>
        ),
      },
    ],
    [navigate, userNames, sellerNames],
  );

  const exportRows = () =>
    downloadCsv(
      `inspections-page-${state.page}-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(items, [
        { header: "Inspection ID", value: (i) => i.inspectionId },
        { header: "Inspection No", value: (i) => i.inspectionNo },
        { header: "Listing ID", value: (i) => i.listingId },
        { header: "Version ID", value: (i) => i.listingVersionId },
        { header: "Listing title", value: (i) => i.listingTitle },
        { header: "Seller ID", value: (i) => i.sellerId },
        { header: "Status", value: (i) => i.status },
        { header: "Result", value: (i) => i.result },
        { header: "Inspector user ID", value: (i) => i.assignedInspectorUserId },
        { header: "Created (UTC)", value: (i) => i.createdAtUtc },
        { header: "Started (UTC)", value: (i) => i.startedAtUtc },
        { header: "Completed (UTC)", value: (i) => i.completedAtUtc },
        { header: "Failure reason", value: (i) => i.failureReasonCode },
      ]),
    );

  return (
    <>
      <PageHeader
        eyebrow="StockOut inspection"
        title="Inspections"
        description="Every inspection in the queue. Filter by status, result or inspector and open one to work on it."
        actions={
          <>
            <ExportButton onExport={exportRows} disabled={!items.length} />
            {can(P.INSPECTIONS_OVERRIDE) && (
              <Button variant="action" size="lg" className="h-12 text-base" onClick={() => setCreateOpen(true)}>
                Create inspection <PlusIcon />
              </Button>
            )}
          </>
        }
      />
      <StatCards
        className="mb-4 hidden md:grid"
        items={[
          { label: "Pending", hint: "Waiting for an inspector", icon: <HourglassIcon />, ...pending },
          { label: "Assigned", hint: "Inspector assigned, not started", icon: <UserCheckIcon />, ...assigned },
          { label: "In progress", hint: "Being inspected", icon: <SpinnerGapIcon />, ...inProgress },
          { label: "Completed", hint: "All results", icon: <CheckCircleIcon />, ...completed },
        ]}
      />
      <SectionCard>
        <Toolbar
          left={
            <>
              <NativeSelect className="h-[38px] w-full sm:w-44" value={state.status} onChange={(e) => setState({ status: e.target.value }, { resetPage: true })} aria-label="Status">
                <option value="">All statuses</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </NativeSelect>
              <NativeSelect className="h-[38px] w-full sm:w-52" value={state.result} onChange={(e) => setState({ result: e.target.value }, { resetPage: true })} aria-label="Result">
                <option value="">All results</option>
                {RESULTS.map((r) => (
                  <option key={r} value={r}>
                    {RESULT_LABEL[r]}
                  </option>
                ))}
              </NativeSelect>
              {user?.userId && (
                <Button variant={mine ? "action" : "secondary"} className="h-[38px]" aria-pressed={mine} onClick={() => setState({ inspector: mine ? "" : user.userId.toLowerCase() }, { resetPage: true })}>
                  <UserCheckIcon /> Assigned to me
                </Button>
              )}
            </>
          }
          right={
            <>
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={() => setState({ status: "", result: "", inspector: "", from: "", to: "", seller: "", category: "" }, { resetPage: true })}>
                  <XIcon /> Clear filters
                </Button>
              )}
              <RefreshButton onClick={() => queue.refetch()} spinning={queue.isFetching} />
            </>
          }
        />
        {isPhone && (
          <Button variant="ghost" size="sm" className="-mt-1 mb-2" aria-expanded={moreFilters} onClick={() => setMoreFilters((v) => !v)}>
            {moreFilters ? "Hide filters" : "More filters"}
          </Button>
        )}
        <div hidden={isPhone && !moreFilters} className="-mt-1 mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-[auto_auto_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <label className="flex items-center gap-2 text-sm">
            <span className="w-24 shrink-0 text-muted-foreground xl:w-auto">Created from</span>
            <Input type="date" className="h-[38px] min-w-0 flex-1 xl:w-40 xl:flex-none" value={state.from} max={state.to || undefined} onChange={(e) => setState({ from: e.target.value }, { resetPage: true })} aria-label="Created from (UTC)" />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <span className="w-24 shrink-0 text-muted-foreground xl:w-auto">to</span>
            <Input type="date" className="h-[38px] min-w-0 flex-1 xl:w-40 xl:flex-none" value={state.to} min={state.from || undefined} onChange={(e) => setState({ to: e.target.value }, { resetPage: true })} aria-label="Created to (UTC)" />
          </label>
          <GuidFilterInput className="sm:w-full" value={mine ? "" : state.inspector} onChange={(inspector) => setState({ inspector }, { resetPage: true })} label="Inspector user ID" placeholder="Inspector user ID" />
          <GuidFilterInput className="sm:w-full" value={state.seller} onChange={(seller) => setState({ seller }, { resetPage: true })} label="Seller ID" placeholder="Seller ID" />
          <GuidFilterInput className="sm:w-full" value={state.category} onChange={(category) => setState({ category }, { resetPage: true })} label="Category ID" placeholder="Category ID" />
        </div>
        {isPhone ? (
          <InspectionCardList
            items={items}
            isLoading={queue.isLoading}
            error={queue.error}
            onRetry={() => queue.refetch()}
            userNames={userNames}
            emptyTitle={hasFilters ? "No inspections match these filters" : "No inspections yet"}
            emptyDescription={hasFilters ? "Clear or change the filters to see more." : undefined}
            page={state.page}
            pageSize={state.pageSize}
            totalCount={queue.data?.totalCount}
            onPageChange={(page) => setState({ page })}
          />
        ) : (
        <DataTable
          caption="Inspections"
          columns={columns}
          data={items}
          getRowId={(i) => i.inspectionId}
          isLoading={queue.isLoading}
          isFetching={queue.isFetching && !queue.isLoading}
          error={queue.error}
          onRetry={() => queue.refetch()}
          onRowClick={(i) => navigate(`/inspections/${i.inspectionId}`)}
          pagination={{
            page: state.page,
            pageSize: state.pageSize,
            totalCount: queue.data?.totalCount ?? 0,
            onPageChange: (page) => setState({ page }),
            onPageSizeChange: (pageSize) => setState({ pageSize, page: 1 }),
          }}
          emptyTitle={hasFilters ? "No inspections match these filters" : state.page > 1 ? "No inspections on this page" : "No inspections yet"}
          emptyDescription={
            state.page > 1 ? (
              <>
                The server reports no rows past the last page.{" "}
                <button type="button" className="underline underline-offset-4" onClick={() => setState({ page: 1 })}>
                  Go to page 1
                </button>
              </>
            ) : hasFilters ? (
              "Clear or change the filters to see more."
            ) : (
              "Inspections are created when a moderator approves a listing in a category that requires physical inspection."
            )
          }
        />
        )}
      </SectionCard>
      <CreateInspectionDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}

const createSchema = z.object({
  listingId: z.string().trim().regex(GUID_RE, "Enter a valid listing ID (GUID)."),
  listingVersionId: z.string().trim().regex(GUID_RE, "Enter a valid listing version ID (GUID)."),
});
type CreateValues = z.infer<typeof createSchema>;

function CreateInspectionDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate();
  const form = useForm<CreateValues>({ resolver: zodResolver(createSchema), defaultValues: { listingId: "", listingVersionId: "" } });
  const mutation = useApiMutation({
    mutationFn: (v: CreateValues) => inspectionsService.create({ listingId: v.listingId.toLowerCase(), listingVersionId: v.listingVersionId.toLowerCase() }),
    toastOnError: false,
    invalidate: [inspectionKeys.queueAll],
    successMessage: (r) => `Inspection ${r.inspectionNo} created.`,
    onSuccess: (r) => {
      form.reset();
      onOpenChange(false);
      navigate(`/inspections/${r.inspectionId}`);
    },
  });
  const submit = form.handleSubmit((v) => mutation.mutate(v));
  return (
    <Dialog open={open} onOpenChange={(o) => !mutation.isPending && onOpenChange(o)}>
      <DialogContent
        title="Create inspection"
        description="Creates a pending inspection for a listing version, using the active checklist template for its category (or the global default)."
        footer={
          <>
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button variant="primary" loading={mutation.isPending} onClick={submit}>
              Create inspection
            </Button>
          </>
        }
      >
        <form onSubmit={submit} noValidate className="space-y-4">
          <FormField label="Listing ID" htmlFor="create-listing" required error={form.formState.errors.listingId?.message}>
            <Input className="font-mono text-xs" autoComplete="off" {...form.register("listingId")} />
          </FormField>
          <FormField label="Listing version ID" htmlFor="create-version" required error={form.formState.errors.listingVersionId?.message} hint="Find both IDs on the listing review page.">
            <Input className="font-mono text-xs" autoComplete="off" {...form.register("listingVersionId")} />
          </FormField>
          <ApiErrorNotice error={mutation.error} />
          <button type="submit" hidden aria-hidden tabIndex={-1} />
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function InspectionsPage() {
  return (
    <RequirePermission permission={P.INSPECTIONS_VIEW}>
      <InspectionsContent />
    </RequirePermission>
  );
}
