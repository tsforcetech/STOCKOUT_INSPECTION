import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useNavigate } from "react-router";
import { XIcon } from "@phosphor-icons/react";
import { PageHeader } from "@/components/common/page-header";
import { SectionCard, Toolbar, RefreshButton } from "@/components/common/section-card";
import { DataTable } from "@/components/tables/data-table";
import { CardList, MoreFilters } from "@/components/common/card-list";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/misc";
import { NativeSelect } from "@/components/ui/input";
import { RequirePermission } from "@/lib/auth/guards";
import { useUrlState } from "@/hooks/use-url-state";
import { PERMISSIONS as P } from "@/api/types/user-organization";
import { CORRECTION_STATUSES, type AdminListingCorrectionDto, type CorrectionStatus } from "@/api/types/listing-corrections";
import { GuidFilterInput, PersonText, fmtUtc, shortId, useSellerNames } from "@/features/listings/shared";
import { useCorrectionsQuery } from "./queries";
import { CorrectionStatusBadge, FIELD_LABEL, STATUS_LABEL } from "./shared";

const DEFAULTS = { page: 1, pageSize: 20, status: "", seller: "", listing: "", inspection: "" };

function CorrectionsContent() {
  const navigate = useNavigate();
  const sellers = useSellerNames();
  const [state, setState] = useUrlState(DEFAULTS);
  const q = useCorrectionsQuery({
    page: state.page,
    pageSize: state.pageSize,
    status: state.status as CorrectionStatus | "",
    sellerId: state.seller,
    listingId: state.listing,
    inspectionId: state.inspection,
  });
  const hasFilters = !!(state.status || state.seller || state.listing || state.inspection);
  const isPhone = useMediaQuery("(max-width: 767px)");
  const [more, setMore] = React.useState(false);

  const columns = React.useMemo<ColumnDef<AdminListingCorrectionDto, unknown>[]>(
    () => [
      { header: "Proposal", accessorKey: "correctionNo", cell: ({ row }) => <span className="font-mono text-xs">{row.original.correctionNo}</span> },
      { header: "Status", accessorKey: "status", cell: ({ row }) => <CorrectionStatusBadge status={row.original.status} /> },
      { header: "Listing", accessorKey: "listingId", cell: ({ row }) => <span className="font-mono text-xs">LST-{shortId(row.original.listingId)}</span> },
      { header: "Seller", accessorKey: "sellerId", cell: ({ row }) => <PersonText id={row.original.sellerId} names={sellers} /> },
      { header: "Changes", id: "changes", cell: ({ row }) => row.original.changes.map((c) => FIELD_LABEL[c.field] ?? c.field).join(", ") },
      { header: "Seller must accept", accessorKey: "requiresSellerAcceptance", cell: ({ row }) => (row.original.requiresSellerAcceptance ? <Badge tone="warning">Yes</Badge> : "No") },
      { header: "Proposed", accessorKey: "createdAtUtc", cell: ({ row }) => fmtUtc(row.original.createdAtUtc) },
    ],
    [sellers],
  );

  return (
    <>
      <PageHeader eyebrow="StockOut inspection" title="Listing corrections" description="Changes inspectors proposed after an inspection, and where each one stands." />
      <SectionCard>
        <Toolbar
          left={
            <NativeSelect className="h-[38px] w-full sm:w-56" value={state.status} onChange={(e) => setState({ status: e.target.value }, { resetPage: true })} aria-label="Status">
              <option value="">All statuses</option>
              {CORRECTION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </NativeSelect>
          }
          right={
            <>
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={() => setState({ status: "", seller: "", listing: "", inspection: "" }, { resetPage: true })}>
                  <XIcon /> Clear filters
                </Button>
              )}
              <RefreshButton onClick={() => q.refetch()} spinning={q.isFetching} />
            </>
          }
        />
        <MoreFilters isPhone={isPhone} open={more} onToggle={() => setMore((v) => !v)} active={!!(state.seller || state.listing || state.inspection)} />
        <div hidden={isPhone && !more} className="-mt-1 mb-4 grid gap-2 sm:grid-cols-3">
          <GuidFilterInput className="sm:w-full" value={state.seller} onChange={(seller) => setState({ seller }, { resetPage: true })} label="Seller ID" placeholder="Seller ID" />
          <GuidFilterInput className="sm:w-full" value={state.listing} onChange={(listing) => setState({ listing }, { resetPage: true })} label="Listing ID" placeholder="Listing ID" />
          <GuidFilterInput className="sm:w-full" value={state.inspection} onChange={(inspection) => setState({ inspection }, { resetPage: true })} label="Inspection ID" placeholder="Inspection ID" />
        </div>
        {isPhone ? (
          <CardList
            label="Listing corrections"
            rows={(q.data?.items ?? []).map((c) => ({
              id: c.correctionId,
              to: `/corrections/${c.correctionId}`,
              title: c.correctionNo,
              badge: <CorrectionStatusBadge status={c.status} />,
              lines: [
                c.changes.map((x) => FIELD_LABEL[x.field] ?? x.field).join(", ") || "No field changes",
                <>
                  <PersonText id={c.sellerId} names={sellers} /> · LST-{shortId(c.listingId)}
                </>,
                `Proposed ${fmtUtc(c.createdAtUtc)}${c.requiresSellerAcceptance ? " · seller must accept" : ""}`,
              ],
            }))}
            isLoading={q.isLoading}
            error={q.error}
            onRetry={() => q.refetch()}
            emptyTitle={hasFilters ? "No proposals match these filters" : "No correction proposals yet"}
            emptyDescription="Propose a correction from an inspection's Details step."
            page={state.page}
            pageSize={state.pageSize}
            totalCount={q.data?.totalCount ?? 0}
            onPageChange={(page) => setState({ page })}
          />
        ) : (
        <DataTable
          caption="Listing corrections"
          columns={columns}
          data={q.data?.items}
          getRowId={(c) => c.correctionId}
          isLoading={q.isLoading}
          isFetching={q.isFetching && !q.isLoading}
          error={q.error}
          onRetry={() => q.refetch()}
          onRowClick={(c) => navigate(`/corrections/${c.correctionId}`)}
          pagination={{
            page: state.page,
            pageSize: state.pageSize,
            totalCount: q.data?.totalCount ?? 0,
            onPageChange: (page) => setState({ page }),
            onPageSizeChange: (pageSize) => setState({ pageSize, page: 1 }),
          }}
          emptyTitle={hasFilters ? "No proposals match these filters" : "No correction proposals yet"}
          emptyDescription="Inspectors propose corrections from an inspection's page."
        />
        )}
      </SectionCard>
    </>
  );
}

export default function CorrectionsPage() {
  return (
    <RequirePermission permission={P.INSPECTIONS_VIEW}>
      <CorrectionsContent />
    </RequirePermission>
  );
}
