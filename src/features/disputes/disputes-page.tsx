import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { XIcon } from "@phosphor-icons/react";
import { PageHeader } from "@/components/common/page-header";
import { SectionCard, Toolbar, RefreshButton } from "@/components/common/section-card";
import { StatusBadge } from "@/components/common/status-badge";
import { DataTable } from "@/components/tables/data-table";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/input";
import { RequirePermission } from "@/lib/auth/guards";
import { useUrlState } from "@/hooks/use-url-state";
import { PERMISSIONS as P } from "@/api/types/user-organization";
import type { AdminInspectionDisputeDto, DisputeStatus, DisputeType } from "@/api/types/disputes";
import { disputesService } from "@/services/disputes.service";
import { GuidFilterInput, PersonText, fmtUtc, useSellerNames } from "@/features/listings/shared";

export const DISPUTE_STATUS_LABEL: Record<DisputeStatus, string> = { SUBMITTED: "Awaiting decision", APPROVED_FOR_REINSPECTION: "Re-inspection approved", REJECTED: "Rejected" };
export const DISPUTE_TYPE_LABEL: Record<DisputeType, string> = { INSPECTION_APPEAL: "Inspection appeal", CORRECTION_DECLINE_DISPUTE: "Declined-correction dispute" };
export const disputeKeys = {
  all: ["disputes"] as const,
  queue: (q: object) => ["disputes", "queue", q] as const,
  detail: (id: string) => ["disputes", "detail", id] as const,
};

const DEFAULTS = { page: 1, pageSize: 20, status: "SUBMITTED", type: "", seller: "", listing: "" };

function Content() {
  const navigate = useNavigate();
  const sellers = useSellerNames();
  const [s, set] = useUrlState(DEFAULTS);
  const query = { status: s.status as DisputeStatus | "", disputeType: s.type as DisputeType | "", sellerId: s.seller, listingId: s.listing, page: s.page, pageSize: s.pageSize };
  const q = useQuery({ queryKey: disputeKeys.queue(query), queryFn: ({ signal }) => disputesService.queue(query, signal), placeholderData: (p) => p });
  const columns = React.useMemo<ColumnDef<AdminInspectionDisputeDto, unknown>[]>(
    () => [
      { header: "Dispute", accessorKey: "disputeNo", cell: ({ row }) => <span className="font-mono text-xs">{row.original.disputeNo}</span> },
      { header: "Status", accessorKey: "status", cell: ({ row }) => <StatusBadge value={row.original.status === "SUBMITTED" ? "PENDING" : row.original.status === "REJECTED" ? "REJECTED" : "APPROVED"} label={DISPUTE_STATUS_LABEL[row.original.status]} /> },
      { header: "Type", accessorKey: "disputeType", cell: ({ row }) => DISPUTE_TYPE_LABEL[row.original.disputeType] ?? row.original.disputeType },
      { header: "Listing", accessorKey: "listingTitle", cell: ({ row }) => row.original.listingTitle ?? row.original.listingId.slice(0, 8) },
      { header: "Seller", accessorKey: "sellerId", cell: ({ row }) => <PersonText id={row.original.sellerId} names={sellers} /> },
      { header: "Inspection", accessorKey: "inspectionNo", cell: ({ row }) => <span className="font-mono text-xs">{row.original.inspectionNo ?? "—"} · {row.original.disputedInspectionResult}</span> },
      { header: "Submitted", accessorKey: "submittedAtUtc", cell: ({ row }) => fmtUtc(row.original.submittedAtUtc) },
    ],
    [sellers],
  );
  const filtered = !!(s.type || s.seller || s.listing) || s.status !== "SUBMITTED";
  return (
    <>
      <PageHeader eyebrow="Operations" title="Inspection disputes" description="Seller appeals of inspection results and disputes after declining a correction. Decide by approving a re-inspection (by a different inspector) or rejecting." />
      <SectionCard>
        <Toolbar
          left={
            <>
              <NativeSelect className="h-[38px] w-full sm:w-52" value={s.status} onChange={(e) => set({ status: e.target.value }, { resetPage: true })} aria-label="Status">
                <option value="">All statuses</option>
                {(Object.keys(DISPUTE_STATUS_LABEL) as DisputeStatus[]).map((k) => (
                  <option key={k} value={k}>
                    {DISPUTE_STATUS_LABEL[k]}
                  </option>
                ))}
              </NativeSelect>
              <NativeSelect className="h-[38px] w-full sm:w-60" value={s.type} onChange={(e) => set({ type: e.target.value }, { resetPage: true })} aria-label="Type">
                <option value="">All types</option>
                {(Object.keys(DISPUTE_TYPE_LABEL) as DisputeType[]).map((k) => (
                  <option key={k} value={k}>
                    {DISPUTE_TYPE_LABEL[k]}
                  </option>
                ))}
              </NativeSelect>
            </>
          }
          right={
            <>
              {filtered && (
                <Button variant="ghost" size="sm" onClick={() => set({ status: "SUBMITTED", type: "", seller: "", listing: "" }, { resetPage: true })}>
                  <XIcon /> Reset
                </Button>
              )}
              <RefreshButton onClick={() => q.refetch()} spinning={q.isFetching} />
            </>
          }
        />
        <div className="-mt-1 mb-4 grid gap-2 sm:grid-cols-2">
          <GuidFilterInput value={s.seller} onChange={(seller) => set({ seller }, { resetPage: true })} label="Seller ID" placeholder="Seller ID" />
          <GuidFilterInput value={s.listing} onChange={(listing) => set({ listing }, { resetPage: true })} label="Listing ID" placeholder="Listing ID" />
        </div>
        <DataTable
          caption="Inspection disputes"
          columns={columns}
          data={q.data?.items}
          getRowId={(d) => d.disputeId}
          isLoading={q.isLoading}
          isFetching={q.isFetching && !q.isLoading}
          error={q.error}
          onRetry={() => q.refetch()}
          onRowClick={(d) => navigate(`/disputes/${d.disputeId}`)}
          pagination={{ page: s.page, pageSize: s.pageSize, totalCount: q.data?.totalCount ?? 0, onPageChange: (page) => set({ page }), onPageSizeChange: (pageSize) => set({ pageSize, page: 1 }) }}
          emptyTitle={s.status === "SUBMITTED" ? "No disputes waiting for a decision" : "No disputes match these filters"}
        />
      </SectionCard>
    </>
  );
}

export default function DisputesPage() {
  return (
    <RequirePermission permission={P.INSPECTIONS_VIEW}>
      <Content />
    </RequirePermission>
  );
}
