import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { SectionCard } from "@/components/common/section-card";
import { StatusBadge } from "@/components/common/status-badge";
import { DataTable } from "@/components/tables/data-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/misc";
import { humanize } from "@/lib/utils/format";
import type { InspectionAssignmentHistoryDto, InspectionDetailDto, InspectionStatusHistoryDto } from "@/api/types/catalog-moderation";
import { PanelTitle, PersonText, asUtc, fmtUtc, useUserNames } from "@/features/listings/shared";

/** History ordering is not specified by the backend; sort newest first client-side. */
const byNewest = <T,>(rows: T[], at: (r: T) => string) => [...rows].sort((a, b) => (asUtc(at(b)) ?? "").localeCompare(asUtc(at(a)) ?? ""));

export function InspectionHistory({ inspection }: { inspection: InspectionDetailDto }) {
  const names = useUserNames();
  const statusRows = React.useMemo(() => byNewest(inspection.statusHistory, (r) => r.changedAtUtc), [inspection.statusHistory]);
  const assignmentRows = React.useMemo(() => byNewest(inspection.assignmentHistory, (r) => r.assignedAtUtc), [inspection.assignmentHistory]);

  const statusColumns = React.useMemo<ColumnDef<InspectionStatusHistoryDto, unknown>[]>(
    () => [
      { id: "at", header: "When", cell: ({ row }) => fmtUtc(row.original.changedAtUtc) },
      { id: "action", header: "Action", cell: ({ row }) => humanize(row.original.action) },
      {
        id: "transition",
        header: "Status",
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1.5">
            {row.original.fromStatus && (
              <>
                <StatusBadge value={row.original.fromStatus} /> →
              </>
            )}
            <StatusBadge value={row.original.toStatus} />
          </span>
        ),
      },
      { id: "result", header: "Result", cell: ({ row }) => <StatusBadge value={row.original.result} /> },
      { id: "reason", header: "Reason", cell: ({ row }) => row.original.reasonCode ?? "—" },
      { id: "notes", header: "Notes", cell: ({ row }) => <span className="block max-w-[280px] whitespace-normal">{row.original.notes ?? "—"}</span> },
      { id: "by", header: "By", cell: ({ row }) => <PersonText id={row.original.changedByUserId} names={names} /> },
    ],
    [names],
  );
  const assignmentColumns = React.useMemo<ColumnDef<InspectionAssignmentHistoryDto, unknown>[]>(
    () => [
      { id: "at", header: "When", cell: ({ row }) => fmtUtc(row.original.assignedAtUtc) },
      { id: "from", header: "Previous inspector", cell: ({ row }) => <PersonText id={row.original.previousInspectorUserId} names={names} /> },
      { id: "to", header: "New inspector", cell: ({ row }) => <PersonText id={row.original.newInspectorUserId} names={names} /> },
      { id: "reason", header: "Reason", cell: ({ row }) => (row.original.reasonCode ? humanize(row.original.reasonCode) : "—") },
      { id: "notes", header: "Notes", cell: ({ row }) => <span className="block max-w-[280px] whitespace-normal">{row.original.notes ?? "—"}</span> },
      { id: "by", header: "Assigned by", cell: ({ row }) => <PersonText id={row.original.assignedByUserId} names={names} /> },
    ],
    [names],
  );

  return (
    <SectionCard>
      <PanelTitle title="History" />
      <Tabs defaultValue="status">
        <TabsList aria-label="History type">
          <TabsTrigger value="status">Status ({statusRows.length})</TabsTrigger>
          <TabsTrigger value="assignment">Assignments ({assignmentRows.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="status">
          <DataTable caption="Status history" columns={statusColumns} data={statusRows} getRowId={(r) => r.inspectionStatusHistoryId} clientSorting={false} emptyTitle="No status changes recorded" />
        </TabsContent>
        <TabsContent value="assignment">
          <DataTable caption="Assignment history" columns={assignmentColumns} data={assignmentRows} getRowId={(r) => r.assignmentHistoryId} clientSorting={false} emptyTitle="Never assigned" />
        </TabsContent>
      </Tabs>
    </SectionCard>
  );
}
