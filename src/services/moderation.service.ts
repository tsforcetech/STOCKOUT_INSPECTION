import { http } from "@/lib/api/client";
import type {
  Guid,
  ListingMediaDownloadUrlResponse,
  ListingModerationDetailResponse,
  ListingModerationQueueResponse,
  ListingPublicationHistoryResponse,
  ModerationDecisionRequest,
  ModerationDecisionResponse,
  ModerationQueueQuery,
  PublicationEligibilityResponse,
  PublishListingResponse,
  RepublishListingResponse,
  RollbackListingRequest,
  RollbackListingResponse,
  RowVersion,
  SuspendListingRequest,
  SuspendListingResponse,
  AdminListingListResponse,
  AdminListingQuery,
} from "@/api/types/catalog-moderation";
import { unwrapData, type Envelope } from "@/lib/api/envelope";

/**
 * catalog-listing admin moderation + publication (/api/v1/admin/catalog/listings/*).
 * NO response envelope: every success body is the bare DTO (or bare array).
 * Every write takes the LISTING rowVersion (`candidateVersion.listingRowVersion`) and returns a new one.
 * Contract: docs/contracts/catalog-moderation-inspections.md §3–4
 */
const seg = encodeURIComponent;
const base = "/api/v1/admin/catalog/listings";
const versionPath = (listingId: Guid, versionId: Guid) => `${base}/${seg(listingId)}/versions/${seg(versionId)}`;

export const moderationService = {
  /** F2-A: every listing from every seller in any state (server-paginated). */
  allListings: async (query: AdminListingQuery, signal?: AbortSignal) =>
    unwrapData<AdminListingListResponse>(
      await http.get<Envelope<AdminListingListResponse>>(base, {
        signal,
        query: {
          page: query.page,
          pageSize: query.pageSize,
          status: query.status,
          moderationStatus: query.moderationStatus,
          sellerId: query.sellerId,
          categoryId: query.categoryId,
          search: query.search,
          sort: query.sort,
        },
      }),
    ),

  /** Server-paginated; only current draft versions with status UNDER_REVIEW, oldest first. */
  queue: (query: ModerationQueueQuery, signal?: AbortSignal) =>
    http.get<ListingModerationQueueResponse>(`${base}/moderation/queue`, {
      signal,
      query: {
        categoryId: query.categoryId,
        sellerId: query.sellerId,
        submittedFromUtc: query.submittedFromUtc,
        submittedToUtc: query.submittedToUtc,
        requiresInspectionOnly: query.requiresInspectionOnly,
        page: query.page,
        pageSize: query.pageSize,
      },
    }),

  /** Works for any version of the listing; the only source of the listing rowVersion. */
  detail: (listingId: Guid, versionId: Guid, signal?: AbortSignal) =>
    http.get<ListingModerationDetailResponse>(`${versionPath(listingId, versionId)}/moderation`, { signal }),

  /** F2-E: fresh reviewer URL for one photo (the detail's URLs expire after 15 minutes). */
  mediaDownloadUrl: (listingId: Guid, versionId: Guid, listingMediaAssetId: Guid) =>
    http.get<ListingMediaDownloadUrlResponse>(`${versionPath(listingId, versionId)}/media/${seg(listingMediaAssetId)}/download-url`),

  decide: (listingId: Guid, versionId: Guid, body: ModerationDecisionRequest) =>
    http.post<ModerationDecisionResponse>(`${versionPath(listingId, versionId)}/moderation/decide`, body),

  eligibility: (listingId: Guid, versionId: Guid, signal?: AbortSignal) =>
    http.get<PublicationEligibilityResponse>(`${versionPath(listingId, versionId)}/publication-eligibility`, { signal }),

  publish: (listingId: Guid, versionId: Guid, expectedRowVersion: RowVersion) =>
    http.post<PublishListingResponse>(`${versionPath(listingId, versionId)}/publish`, { expectedRowVersion }),

  suspend: (listingId: Guid, body: SuspendListingRequest) => http.post<SuspendListingResponse>(`${base}/${seg(listingId)}/suspend`, body),

  republish: (listingId: Guid, expectedRowVersion: RowVersion) =>
    http.post<RepublishListingResponse>(`${base}/${seg(listingId)}/republish`, { expectedRowVersion }),

  rollback: (listingId: Guid, body: RollbackListingRequest) => http.post<RollbackListingResponse>(`${base}/${seg(listingId)}/rollback`, body),

  /** Bare array, newest first. Unknown listing returns []. */
  publicationHistory: (listingId: Guid, signal?: AbortSignal) =>
    http.get<ListingPublicationHistoryResponse>(`${base}/${seg(listingId)}/publication-history`, { signal }),
};
