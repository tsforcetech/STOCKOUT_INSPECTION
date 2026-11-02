import { http } from "@/lib/api/client";
import type { Guid, RowVersion } from "@/api/types/catalog-moderation";
import type {
  AdminCorrectionsQuery,
  AdminListingCorrectionDto,
  CorrectionAuditEntryDto,
  CorrectionSnapshotResponse,
  PagedAdminCorrectionsResponse,
  ProposeListingCorrectionRequest,
  WithdrawCorrectionRequest,
} from "@/api/types/listing-corrections";

/**
 * E5 inspector corrections (/api/v1/admin/catalog/listing-corrections). No response envelope.
 * Contract: docs/development/STOCKOUT_E5_FRONTEND_API_HANDOFF.md §1.1
 */
const seg = encodeURIComponent;
const base = "/api/v1/admin/catalog/listing-corrections";

export const listingCorrectionsService = {
  /** inspections.view or the assigned inspector. */
  snapshot: (inspectionId: Guid, signal?: AbortSignal) => http.get<CorrectionSnapshotResponse>(`${base}/by-inspection/${seg(inspectionId)}/snapshot`, { signal }),
  /** inspections.override AND assigned to the inspection. 201. */
  propose: (body: ProposeListingCorrectionRequest) => http.post<AdminListingCorrectionDto>(base, body),
  list: (query: AdminCorrectionsQuery, signal?: AbortSignal) =>
    http.get<PagedAdminCorrectionsResponse>(base, {
      signal,
      query: {
        sellerId: query.sellerId || undefined,
        listingId: query.listingId || undefined,
        inspectionId: query.inspectionId || undefined,
        status: query.status || undefined,
        page: query.page,
        pageSize: query.pageSize,
      },
    }),
  detail: (correctionId: Guid, signal?: AbortSignal) => http.get<AdminListingCorrectionDto>(`${base}/${seg(correctionId)}`, { signal }),
  audit: (correctionId: Guid, signal?: AbortSignal) => http.get<CorrectionAuditEntryDto[]>(`${base}/${seg(correctionId)}/audit`, { signal }),
  /** The proposer only. */
  withdraw: (correctionId: Guid, body: WithdrawCorrectionRequest) => http.post<AdminListingCorrectionDto>(`${base}/${seg(correctionId)}/withdraw`, body),
  /** READY_FOR_MODERATION, or a SELLER_ACCEPTED that came back PENDING_MODERATION_ENTRY. */
  submitForModeration: (correctionId: Guid, expectedRowVersion?: RowVersion | null) =>
    http.post<AdminListingCorrectionDto>(`${base}/${seg(correctionId)}/submit-for-moderation`, { expectedRowVersion: expectedRowVersion ?? null }),
};
