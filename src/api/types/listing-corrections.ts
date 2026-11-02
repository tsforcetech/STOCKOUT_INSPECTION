/**
 * E5 inspector listing corrections (CatalogListing). Source: CorrectionDtos.cs, AdminListingCorrectionsController.cs.
 * No response envelope; errors are { error, message }. rowVersion is Base64.
 */
import type { Guid, IsoDateTime, RowVersion } from "./catalog-moderation";

export type CorrectionStatus =
  | "AWAITING_SELLER_DECISION"
  | "READY_FOR_MODERATION"
  | "SELLER_ACCEPTED"
  | "SUBMITTED_TO_MODERATION"
  | "SELLER_DECLINED"
  | "WITHDRAWN";

export type CorrectionField = "title" | "description" | "condition" | "grade" | "price" | "quantity" | "media";

export interface CorrectionMediaItemDto {
  fileAssetId: Guid;
  mediaType: "IMAGE" | "DOCUMENT";
  displayOrder: number;
  isPrimary: boolean;
  documentType: string | null;
}

/** Null/omitted = unchanged. media, when sent, is the COMPLETE desired list. onHandQuantity is stored only (E5-Q1). */
export interface ProposeListingCorrectionRequest {
  inspectionId: Guid;
  title?: string | null;
  description?: string | null;
  conditionId?: Guid | null;
  gradeId?: Guid | null;
  basePrice?: number | null;
  onHandQuantity?: number | null;
  media?: CorrectionMediaItemDto[] | null;
  sellerVisibleSummary: string;
  inspectorNotes?: string | null;
}

export interface CorrectionFieldComparisonDto {
  field: CorrectionField | string;
  before: string | null;
  after: string | null;
  requiresSellerAcceptance: boolean;
}

export interface SellerListingCorrectionDto {
  correctionId: Guid;
  correctionNo: string;
  listingId: Guid;
  baseListingVersionId: Guid;
  inspectionId: Guid;
  status: CorrectionStatus;
  requiresSellerAcceptance: boolean;
  sellerVisibleSummary: string;
  changes: CorrectionFieldComparisonDto[];
  quantityApplicationStatus: string;
  sellerDecision: "ACCEPT" | "DECLINE" | null;
  sellerDecisionAtUtc: IsoDateTime | null;
  sellerDecisionReason: string | null;
  disputeRequestedAtUtc: IsoDateTime | null;
  correctedListingVersionId: Guid | null;
  createdAtUtc: IsoDateTime;
  updatedAtUtc: IsoDateTime | null;
  rowVersion: RowVersion;
}

export interface AdminListingCorrectionDto extends SellerListingCorrectionDto {
  sellerId: Guid;
  proposedByUserId: Guid;
  inspectorNotes: string | null;
  sellerDecisionByUserId: Guid | null;
  moderationEnteredAtUtc: IsoDateTime | null;
  withdrawnByUserId: Guid | null;
  withdrawnAtUtc: IsoDateTime | null;
  withdrawReason: string | null;
}

export interface PagedAdminCorrectionsResponse {
  items: AdminListingCorrectionDto[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface AdminCorrectionsQuery {
  sellerId?: string;
  listingId?: string;
  inspectionId?: string;
  status?: CorrectionStatus | "";
  page: number;
  pageSize: number;
}

export interface CorrectionAuditEntryDto {
  correctionAuditId: Guid;
  correctionId: Guid;
  eventType: "PROPOSED" | "SELLER_ACCEPTED" | "SELLER_DECLINED" | "WITHDRAWN" | "SUBMITTED_TO_MODERATION" | string;
  fromStatus: string | null;
  toStatus: string;
  actorUserId: Guid;
  actorType: "INSPECTOR" | "SELLER" | "STAFF" | string;
  beforeJson: string | null;
  afterJson: string | null;
  reason: string | null;
  correctedListingVersionId: Guid | null;
  occurredAtUtc: IsoDateTime;
}

export interface CorrectionSnapshotResponse {
  inspectionId: Guid;
  inspectionNo: string;
  inspectionStatus: string;
  inspectionResult: string | null;
  listingId: Guid;
  sellerId: Guid;
  baseListingVersionId: Guid;
  baseVersionStatus: string;
  listingStatus: string;
  title: string;
  description: string | null;
  conditionId: Guid | null;
  gradeId: Guid | null;
  basePrice: number;
  currency: string;
  onHandQuantity: number;
  reservedQuantity: number;
  media: CorrectionMediaItemDto[];
  correctableFields: string[];
  sellerAcceptanceFields: string[];
  hasActiveCorrection: boolean;
  activeCorrectionId: Guid | null;
  listingRowVersion: RowVersion;
}

export interface WithdrawCorrectionRequest {
  reason: string;
  expectedRowVersion?: RowVersion | null;
}

export const CORRECTION_STATUSES: CorrectionStatus[] = [
  "AWAITING_SELLER_DECISION",
  "READY_FOR_MODERATION",
  "SELLER_ACCEPTED",
  "SUBMITTED_TO_MODERATION",
  "SELLER_DECLINED",
  "WITHDRAWN",
];

/** Proposals the proposer can still withdraw. */
export const WITHDRAWABLE: CorrectionStatus[] = ["AWAITING_SELLER_DECISION", "READY_FOR_MODERATION", "SELLER_ACCEPTED"];
