import { http } from "@/lib/api/client";
import type { Guid } from "@/api/types/catalog-moderation";
import type { AdminInspectionDisputeDetailDto, AdminInspectionDisputeQueueResponse, DecideInspectionDisputeRequest, DisputeQueueQuery } from "@/api/types/disputes";

/** E5-DISP admin disputes (/api/v1/admin/catalog/disputes). View: inspections.view; decide: inspections.override. */
const seg = encodeURIComponent;
const base = "/api/v1/admin/catalog/disputes";

export const disputesService = {
  queue: (q: DisputeQueueQuery, signal?: AbortSignal) =>
    http.get<AdminInspectionDisputeQueueResponse>(base, {
      signal,
      query: { status: q.status || undefined, disputeType: q.disputeType || undefined, sellerId: q.sellerId || undefined, listingId: q.listingId || undefined, inspectionId: q.inspectionId || undefined, page: q.page, pageSize: q.pageSize },
    }),
  detail: (disputeId: Guid, signal?: AbortSignal) => http.get<AdminInspectionDisputeDetailDto>(`${base}/${seg(disputeId)}`, { signal }),
  decide: (disputeId: Guid, body: DecideInspectionDisputeRequest) => http.post<AdminInspectionDisputeDetailDto>(`${base}/${seg(disputeId)}/decision`, body),
};
