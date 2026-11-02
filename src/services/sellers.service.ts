import { http } from "@/lib/api/client";
import { expectArray, unwrapData, type Envelope } from "@/lib/api/envelope";
import type {
  AdminReviewDocumentRequest,
  AdminSellerDocumentDownloadUrlResponse,
  AdminSellerDocumentResponse,
  AdminSellerReviewAction,
  MarketplaceSellerDto,
  SellerVerificationHistoryDto,
} from "@/api/types/user-organization";

/**
 * Admin marketplace sellers (user-organization). Contract: docs/contracts/user-organization.md §6.1
 * Note: the list endpoint returns only status/verification fields; other fields are empty defaults.
 */
export const sellersService = {
  list: async (signal?: AbortSignal) => unwrapData<MarketplaceSellerDto[]>(await http.get<Envelope<MarketplaceSellerDto[]>>("/api/v1/admin/marketplace/sellers", { signal })),

  /** F2-I / L16: full seller profile (legal name, registration no., country, currency) for KYC review (sellers.view). */
  detail: async (sellerId: string, signal?: AbortSignal) =>
    unwrapData<MarketplaceSellerDto>(await http.get<Envelope<MarketplaceSellerDto>>(`/api/v1/admin/marketplace/sellers/${encodeURIComponent(sellerId)}`, { signal })),

  /** Approval needs every category VERIFIED, reviewer-confirmed signatory ID + authority, an unexpired licence and accepted policies. */
  review: async (sellerId: string, action: AdminSellerReviewAction, expectedRowVersion: string, reason?: string | null) =>
    unwrapData<MarketplaceSellerDto>(
      await http.post<Envelope<MarketplaceSellerDto>>(`/api/v1/admin/marketplace/sellers/${encodeURIComponent(sellerId)}/verify`, {
        action,
        expectedRowVersion,
        ...(action === "REJECT" && reason ? { reason } : {}),
      }),
    ),

  /** PA-1B.1-R2: per-document VERIFY / REJECT with reviewer-confirmed signatory evidence and optional reclassification. */
  reviewDocument: async (sellerId: string, documentId: string, body: AdminReviewDocumentRequest) =>
    unwrapData<AdminSellerDocumentResponse>(
      await http.post<Envelope<AdminSellerDocumentResponse>>(
        `/api/v1/admin/marketplace/sellers/${encodeURIComponent(sellerId)}/documents/${encodeURIComponent(documentId)}/review`,
        body,
      ),
    ),

  /** Verification status changes, oldest first as returned (sellers.view). */
  history: async (sellerId: string, signal?: AbortSignal) =>
    expectArray<SellerVerificationHistoryDto>(
      unwrapData(await http.get<Envelope<SellerVerificationHistoryDto[]>>(`/api/v1/admin/marketplace/sellers/${encodeURIComponent(sellerId)}/history`, { signal })),
    ),

  /** F2-E: KYC documents with short-lived download URLs (sellers.view). */
  documents: async (sellerId: string, signal?: AbortSignal) =>
    unwrapData<AdminSellerDocumentResponse[]>(
      await http.get<Envelope<AdminSellerDocumentResponse[]>>(`/api/v1/admin/marketplace/sellers/${encodeURIComponent(sellerId)}/documents`, { signal }),
    ),

  /** A fresh URL for one document (the list's URLs expire after 15 minutes). */
  documentDownloadUrl: async (sellerId: string, documentId: string) =>
    unwrapData<AdminSellerDocumentDownloadUrlResponse>(
      await http.get<Envelope<AdminSellerDocumentDownloadUrlResponse>>(
        `/api/v1/admin/marketplace/sellers/${encodeURIComponent(sellerId)}/documents/${encodeURIComponent(documentId)}/download-url`,
      ),
    ),

  /** `action` is ignored by the backend but must be non-empty; `reason` is stored as suspensionReason. */
  suspend: async (sellerId: string, expectedRowVersion: string, reason?: string) =>
    unwrapData<MarketplaceSellerDto>(
      await http.post<Envelope<MarketplaceSellerDto>>(`/api/v1/admin/marketplace/sellers/${encodeURIComponent(sellerId)}/suspend`, { action: "SUSPEND", expectedRowVersion, reason: reason?.trim() || null }),
    ),
};
