/**
 * Catalog-Listing service: admin moderation, publication, inspections, and read-only listing views.
 * Mirrors the JSON produced by services/catalog-listing (ASP.NET Core web defaults: camelCase,
 * nulls emitted, no response envelope). See docs/contracts/catalog-moderation-inspections.md.
 *
 * Conventions:
 *  - Guid      -> string (lowercase, hyphenated)
 *  - DateTime  -> string (ISO-8601; DB-sourced values carry NO 'Z' suffix but are UTC)
 *  - decimal   -> number
 *  - rowVersion / expectedRowVersion -> Base64 string of SQL ROWVERSION (8 bytes)
 *  - All "status"/code fields are plain C# strings; unions below list the values the server writes.
 */

// ---------------------------------------------------------------------------
// Primitive aliases
// ---------------------------------------------------------------------------

/** System.Guid */
export type Guid = string;
/** System.DateTime (UTC; usually without offset suffix) */
export type IsoDateTime = string;
/** Base64-encoded SQL ROWVERSION (8 bytes) */
export type RowVersion = string;

// ---------------------------------------------------------------------------
// Enumerations (string constants in C# / SQL CHECK constraints)
// ---------------------------------------------------------------------------

/** Domain.Listings.ListingStatus */
export type ListingStatus = 'DRAFT' | 'PUBLISHED' | 'SUSPENDED' | 'EXPIRED' | 'ARCHIVED';

/** Domain.Listings.ListingVersionStatus */
export type ListingVersionStatus =
  | 'DRAFT'
  | 'UNDER_REVIEW'
  | 'CHANGES_REQUIRED'
  | 'APPROVED'
  | 'INSPECTION_REQUIRED'
  | 'REJECTED'
  | 'PUBLISHED'
  | 'SUPERSEDED'
  | 'ARCHIVED';

/** Domain.Moderation.ModerationDecision */
export type ModerationDecision = 'APPROVE' | 'REQUEST_CHANGES' | 'REJECT';

/** Domain.Publication.PublicationHistoryAction */
export type PublicationHistoryAction =
  | 'INITIAL_PUBLISH'
  | 'VERSION_UPDATE'
  | 'REPUBLISH_AFTER_SUSPENSION'
  | 'ROLLBACK';

/** Domain.Publication.SuspensionReasonCode (known constants; server accepts any non-empty string) */
export type SuspensionReasonCode =
  | 'SELLER_REQUESTED_PAUSE'
  | 'ADMINISTRATIVE_SUSPENSION'
  | 'POLICY_VIOLATION'
  | 'COUNTERFEIT_INVESTIGATION'
  | 'SELLER_ACCOUNT_SUSPENDED'
  | 'ADMINISTRATIVE_HOLD';

/** Listing pricing mode (MarketplaceListingService validation) */
export type PricingMode = 'FIXED_PRICE' | 'BIDDING' | 'BOTH';

/** LISTING_INSPECTION.Status CHECK constraint */
export type InspectionStatus = 'PENDING' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

/** LISTING_INSPECTION.Result CHECK constraint (null until COMPLETED) */
export type InspectionResult = 'PASS' | 'FAIL' | 'REINSPECTION_REQUIRED';

/** INSPECTION_CHECKLIST_TEMPLATE_ITEM.ResponseType CHECK constraint */
export type ChecklistResponseType =
  | 'PASS_FAIL'
  | 'YES_NO'
  | 'TEXT'
  | 'NUMBER'
  | 'SINGLE_SELECT'
  | 'MULTI_SELECT';

/** LISTING_INSPECTION_RESPONSE.ItemResult CHECK constraint */
export type InspectionItemResult = 'PASS' | 'FAIL' | 'NOT_APPLICABLE';

/** LISTING_INSPECTION_EVIDENCE.EvidenceType CHECK constraint */
export type InspectionEvidenceType = 'IMAGE' | 'DOCUMENT';

/** LISTING_INSPECTION_STATUS_HISTORY.Action values written by procedures */
export type InspectionStatusHistoryAction =
  | 'CREATED'
  | 'ASSIGNED'
  | 'STARTED'
  | 'COMPLETED'
  | 'CANCELLED';

/** LISTING_VERSION_MEDIA.MediaType CHECK constraint */
export type ListingMediaType = 'IMAGE' | 'DOCUMENT';

/** Seller listing list sort (PR_LISTING_GET_BY_SELLER; unknown values fall back to CreatedAtUtcDesc) */
export type SellerListingSort = 'CreatedAtUtcDesc' | 'CreatedAtUtcAsc' | 'TitleAsc' | 'TitleDesc';

/** inventory-media FilePurpose to use when uploading inspection evidence */
export const INSPECTION_EVIDENCE_FILE_PURPOSE = 'INSPECTION_EVIDENCE' as const;

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/** Contracts.Responses.ErrorResponse */
export interface ErrorResponse {
  error: CatalogErrorCode | string;
  message: string | null;
}

/** Error codes emitted by catalog-listing for the endpoints in scope */
export type CatalogErrorCode =
  | 'INVALID_DATA'
  | 'INVALID_ROW_VERSION'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'INTERNAL_SERVER_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'MARKETPLACE_LISTING_DEPENDENCY_UNAVAILABLE'
  | 'MARKETPLACE_LISTING_INTERNAL_ERROR'
  | 'MARKETPLACE_SELLER_ACCESS_DENIED'
  | 'MARKETPLACE_SELLER_NOT_AUTHORIZED'
  | 'MARKETPLACE_SELLER_RESUME_BLOCKED'
  | 'MARKETPLACE_LISTING_NOT_FOUND'
  | 'MARKETPLACE_LISTING_VERSION_NOT_FOUND'
  | 'MARKETPLACE_LISTING_VERSION_CONFLICT'
  | 'MARKETPLACE_LISTING_VERSION_OWNERSHIP_INVALID'
  | 'MARKETPLACE_LISTING_NOT_READY_FOR_SUBMISSION'
  | 'MARKETPLACE_LISTING_TRANSITION_INVALID'
  | 'MARKETPLACE_LISTING_NOT_READY_FOR_PUBLICATION'
  | 'MARKETPLACE_LISTING_INSPECTION_NOT_PASSED'
  | 'MARKETPLACE_LISTING_NOT_PUBLISHED'
  | 'MARKETPLACE_LISTING_RESERVATION_ACTIVE'
  | 'MARKETPLACE_LISTING_UNAVAILABLE'
  | 'MARKETPLACE_MODERATION_REASON_REQUIRED'
  | 'MARKETPLACE_MODERATION_ACCESS_DENIED'
  | 'MARKETPLACE_INSPECTION_ROW_VERSION_INVALID'
  | 'MARKETPLACE_INSPECTION_REQUEST_INVALID'
  | 'MARKETPLACE_INSPECTION_CHECKLIST_INCOMPLETE'
  | 'MARKETPLACE_INSPECTION_CHECKLIST_ITEM_REQUIRED'
  | 'MARKETPLACE_INSPECTION_RESULT_INVALID'
  | 'MARKETPLACE_INSPECTION_FAILURE_DETAILS_REQUIRED'
  | 'MARKETPLACE_INSPECTION_EVIDENCE_TYPE_INVALID'
  | 'MARKETPLACE_INSPECTION_ACCESS_DENIED'
  | 'MARKETPLACE_INSPECTOR_NOT_ASSIGNED'
  | 'MARKETPLACE_INSPECTION_NOT_FOUND'
  | 'MARKETPLACE_INSPECTION_TEMPLATE_NOT_FOUND'
  | 'MARKETPLACE_INSPECTION_RESPONSE_NOT_FOUND'
  | 'MARKETPLACE_INSPECTION_EVIDENCE_NOT_FOUND'
  | 'MARKETPLACE_INSPECTION_VERSION_CONFLICT'
  | 'MARKETPLACE_INSPECTION_TRANSITION_INVALID'
  | 'MARKETPLACE_INSPECTION_ALREADY_ACTIVE'
  | 'MARKETPLACE_INSPECTION_CANNOT_PASS_FAILED_ITEMS'
  | 'MARKETPLACE_INSPECTION_COMPLETED_IMMUTABLE'
  | 'MARKETPLACE_INSPECTION_REINSPECTION_INVALID'
  | 'MARKETPLACE_INSPECTION_ASSIGNMENT_CONFLICT'
  | 'MARKETPLACE_INSPECTION_LISTING_VERSION_MISMATCH'
  | 'MARKETPLACE_INSPECTION_ASSIGNMENT_REQUIRED'
  | 'MARKETPLACE_INSPECTION_EVIDENCE_REQUIRED'
  | 'MARKETPLACE_INSPECTION_TEMPLATE_ACTIVE_CONFLICT';

/** Platform permission codes enforced by RequiresPlatformPermission / in-service checks */
export type CatalogPermissionCode =
  | 'catalog:listings:view'
  | 'catalog:listings:review'
  | 'catalog:listings:approve'
  | 'catalog:listings:publish'
  | 'catalog:listings:suspend'
  | 'inspections.view'
  | 'inspections.assign'
  | 'inspections.perform'
  | 'inspections.override'
  | 'inspections.templates.manage';

// ---------------------------------------------------------------------------
// Moderation (Contracts.Moderation)
// ---------------------------------------------------------------------------

/** Query for GET /api/v1/admin/catalog/listings/moderation/queue */
export interface ModerationQueueQuery {
  categoryId?: Guid;
  sellerId?: Guid;
  submittedFromUtc?: IsoDateTime;
  submittedToUtc?: IsoDateTime;
  /** Equality filter: false returns only categories NOT requiring inspection */
  requiresInspectionOnly?: boolean;
  /** default 1 */
  page?: number;
  /** default 20, server caps at 100 */
  pageSize?: number;
}

/** ListingModerationQueueItemResponse */
export interface ListingModerationQueueItem {
  listingId: Guid;
  listingVersionId: Guid;
  versionNumber: number;
  title: string;
  categoryId: Guid;
  categoryName: string;
  sellerId: Guid;
  pricingMode: PricingMode;
  basePrice: number;
  currency: string;
  submittedAtUtc: IsoDateTime;
  requiresPhysicalInspection: boolean;
}

/** ListingModerationQueueResponse (page/pageSize echo the raw request values) */
export interface ListingModerationQueueResponse {
  totalCount: number;
  page: number;
  pageSize: number;
  items: ListingModerationQueueItem[];
}

/** CandidateVersionDto */
export interface CandidateVersionDto {
  listingId: Guid;
  sellerId: Guid;
  listingAggregateStatus: ListingStatus;
  publishedVersionId: Guid | null;
  /** LISTING rowVersion: use as expectedRowVersion for decide/publish/suspend/republish/rollback */
  listingRowVersion: RowVersion;
  listingVersionId: Guid;
  versionNumber: number;
  versionStatus: ListingVersionStatus;
  title: string;
  description: string | null;
  pricingMode: PricingMode;
  basePrice: number;
  currency: string;
  categoryId: Guid;
  categoryName: string;
  categoryRequiresPhysicalInspection: boolean;
  brandId: Guid | null;
  conditionId: Guid | null;
  gradeId: Guid | null;
  quantityUnitId: Guid | null;
  createdAtUtc: IsoDateTime;
  updatedAtUtc: IsoDateTime | null;
  versionRowVersion: RowVersion;
}

/** PublishedVersionDto */
export interface PublishedVersionDto {
  listingVersionId: Guid;
  versionNumber: number;
  versionStatus: ListingVersionStatus;
  title: string;
  description: string | null;
  pricingMode: PricingMode;
  basePrice: number;
  currency: string;
  categoryId: Guid;
  brandId: Guid | null;
  conditionId: Guid | null;
  gradeId: Guid | null;
  quantityUnitId: Guid | null;
  createdAtUtc: IsoDateTime;
  updatedAtUtc: IsoDateTime | null;
}

/** CandidateAttributeDto (note: integerValue is a C# decimal) */
export interface CandidateAttributeDto {
  attributeDefinitionId: Guid;
  textValue: string | null;
  integerValue: number | null;
  decimalValue: number | null;
  booleanValue: boolean | null;
  dateValue: IsoDateTime | null;
}

/** MediaAssetDto (fileAssetId refers to inventory-media /api/v1/files/{id}) */
export interface MediaAssetDto {
  listingMediaAssetId: Guid;
  fileAssetId: Guid;
  isPrimary: boolean;
  displayOrder: number;
  /** F2-E: short-lived (15 min) presigned URL for reviewers; null when it couldn't be issued. */
  downloadUrl?: string | null;
  expiresAtUtc?: IsoDateTime | null;
}

/** ListingMediaDownloadUrlResponse: GET …/versions/{versionId}/media/{listingMediaAssetId}/download-url (catalog:listings:review) */
export interface ListingMediaDownloadUrlResponse {
  listingId: Guid;
  listingVersionId: Guid;
  listingMediaAssetId: Guid;
  fileAssetId: Guid;
  downloadUrl: string | null;
  expiresAtUtc: IsoDateTime | null;
}

/** InspectionEvidenceDownloadUrlResponse: GET /admin/catalog/inspections/{id}/evidence/{evidenceId}/download-url (admin or assigned inspector) */
export interface InspectionEvidenceDownloadUrlResponse {
  inspectionId: Guid;
  inspectionEvidenceId: Guid;
  fileAssetId: Guid;
  evidenceType: string | null;
  downloadUrl: string | null;
  expiresAtUtc: IsoDateTime | null;
}

/** ModerationHistoryDto */
export interface ModerationHistoryDto {
  moderationId: Guid;
  listingId: Guid;
  listingVersionId: Guid;
  decision: ModerationDecision;
  reasonCode: string | null;
  sellerNotes: string | null;
  internalNotes: string | null;
  reviewedByUserId: Guid;
  reviewedAtUtc: IsoDateTime;
}

/** ListingModerationDetailResponse */
export interface ListingModerationDetailResponse {
  candidateVersion: CandidateVersionDto;
  candidateAttributes: CandidateAttributeDto[];
  mediaAssets: MediaAssetDto[];
  publishedVersion: PublishedVersionDto | null;
  publishedAttributes: CandidateAttributeDto[];
  /** newest first */
  history: ModerationHistoryDto[];
}

/** ModerationDecisionRequest */
export interface ModerationDecisionRequest {
  decision: ModerationDecision;
  /** required for REQUEST_CHANGES / REJECT and for inspection waiver */
  reasonCode?: string | null;
  sellerNotes?: string | null;
  /** required for inspection waiver */
  internalNotes?: string | null;
  /** null = category policy; true = force inspection; false = waive (needs inspections.override if category requires) */
  requiresInspectionOverride?: boolean | null;
  /** LISTING rowVersion */
  expectedRowVersion: RowVersion;
}

/** ModerationDecisionResponse */
export interface ModerationDecisionResponse {
  moderationId: Guid;
  listingId: Guid;
  listingVersionId: Guid;
  decision: ModerationDecision;
  versionStatus: Extract<ListingVersionStatus, 'CHANGES_REQUIRED' | 'REJECTED' | 'APPROVED' | 'INSPECTION_REQUIRED'>;
  /** non-null only when an inspection was created (versionStatus INSPECTION_REQUIRED) */
  inspectionId: Guid | null;
  inspectionNo: string | null;
  reviewedAtUtc: IsoDateTime;
  /** new LISTING rowVersion */
  rowVersion: RowVersion;
}

// ---------------------------------------------------------------------------
// Publication (Contracts.Publication)
// ---------------------------------------------------------------------------

/** GateItemDto */
export interface GateItemDto {
  passed: boolean;
  details: string | null;
}

/** PublicationGatesDto */
export interface PublicationGatesDto {
  sellerStanding: GateItemDto;
  versionModeration: GateItemDto;
  inspectionCompliance: GateItemDto;
  catalogCompleteness: GateItemDto;
  inventoryAvailability: GateItemDto;
  mediaAvailability: GateItemDto;
  aggregateState: GateItemDto;
}

/** PublicationEligibilityResponse */
export interface PublicationEligibilityResponse {
  listingId: Guid;
  candidateVersionId: Guid;
  isEligible: boolean;
  gates: PublicationGatesDto;
  /** human-readable English messages */
  blockers: string[];
}

/** PublishListingRequest */
export interface PublishListingRequest {
  expectedRowVersion: RowVersion;
}

/** PublishListingResponse */
export interface PublishListingResponse {
  listingId: Guid;
  publishedVersionId: Guid;
  previousPublishedVersionId: Guid | null;
  status: ListingStatus;
  publishedAtUtc: IsoDateTime;
  rowVersion: RowVersion;
}

/** SuspendListingRequest */
export interface SuspendListingRequest {
  /** required, free text; known constants in SuspensionReasonCode */
  reasonCode: SuspensionReasonCode | string;
  remarks?: string | null;
  expectedRowVersion: RowVersion;
}

/** SuspendListingResponse */
export interface SuspendListingResponse {
  listingId: Guid;
  status: ListingStatus;
  reasonCode: string;
  updatedAtUtc: IsoDateTime;
  rowVersion: RowVersion;
}

/** RepublishListingRequest */
export interface RepublishListingRequest {
  expectedRowVersion: RowVersion;
}

/** RepublishListingResponse */
export interface RepublishListingResponse {
  listingId: Guid;
  publishedVersionId: Guid;
  status: ListingStatus;
  updatedAtUtc: IsoDateTime;
  rowVersion: RowVersion;
}

/** RollbackListingRequest */
export interface RollbackListingRequest {
  /** must be a SUPERSEDED version of this listing */
  targetRollbackVersionId: Guid;
  reasonCode: string;
  remarks?: string | null;
  expectedRowVersion: RowVersion;
}

/** RollbackListingResponse */
export interface RollbackListingResponse {
  listingId: Guid;
  publishedVersionId: Guid;
  previousPublishedVersionId: Guid | null;
  status: ListingStatus;
  updatedAtUtc: IsoDateTime;
  rowVersion: RowVersion;
}

/** ListingPublicationHistoryDto (endpoint returns a bare array, newest first) */
export interface ListingPublicationHistoryDto {
  publicationHistoryId: Guid;
  listingId: Guid;
  listingVersionId: Guid;
  previousPublishedVersionId: Guid | null;
  action: PublicationHistoryAction;
  reasonCode: string | null;
  remarks: string | null;
  publishedByUserId: Guid;
  publishedAtUtc: IsoDateTime;
}

export type ListingPublicationHistoryResponse = ListingPublicationHistoryDto[];

// ---------------------------------------------------------------------------
// Public listing detail (GET /api/v1/catalog/listings/{listingId})
// ---------------------------------------------------------------------------

/** PublishedListingImageDto (cdnUrl is relative: /api/v1/files/{id}/download) */
export interface PublishedListingImageDto {
  fileAssetId: Guid;
  cdnUrl: string;
}

/** PublishedListingSellerDto */
export interface PublishedListingSellerDto {
  sellerId: Guid;
  displayName: string;
  entityType: string;
  isVerified: boolean;
}

/** PublishedListingLocationDto (empty strings when unknown) */
export interface PublishedListingLocationDto {
  countryCode: string;
  stateOrEmirate: string;
  city: string;
}

/** PublicListingGalleryImageDto */
export interface PublicListingGalleryImageDto {
  fileAssetId: Guid;
  cdnUrl: string;
  displayOrder: number;
  isPrimary: boolean;
}

/** PublicListingAttributeDetailDto (numericValue duplicates numValue) */
export interface PublicListingAttributeDetailDto {
  code: string;
  name: string;
  textValue: string | null;
  numValue: number | null;
  numericValue: number | null;
}

/** PublicListingDetailResponse (200) */
export interface PublicListingDetailResponse {
  listingId: Guid;
  listingVersionId: Guid;
  publishedVersionId: Guid;
  versionNumber: number;
  listingNumber: string;
  title: string;
  description: string | null;
  pricingMode: PricingMode;
  basePrice: number;
  currency: string;
  quantityUnitId: Guid | null;
  quantityUnitName: string | null;
  quantityUnitSymbol: string | null;
  unitOfMeasure: string | null;
  categoryId: Guid;
  categoryName: string;
  categoryBreadcrumb: string[];
  categoryPathIds: string[];
  brandId: Guid | null;
  brandName: string | null;
  conditionId: Guid | null;
  conditionName: string | null;
  gradeId: Guid | null;
  gradeName: string | null;
  sellableQuantity: number;
  sellableOnHandQuantity: number;
  isAvailable: boolean;
  expiresAtUtc: IsoDateTime | null;
  publishedAtUtc: IsoDateTime;
  location: PublishedListingLocationDto;
  primaryImage: PublishedListingImageDto | null;
  primaryMediaUrl: string | null;
  galleryImages: PublicListingGalleryImageDto[];
  galleryMediaUrls: string[];
  attributes: PublicListingAttributeDetailDto[];
  seller: PublishedListingSellerDto;
}

/** PublicListingUnavailableResponse (HTTP 410) */
export interface PublicListingUnavailableResponse {
  listingId: Guid;
  error: 'MARKETPLACE_LISTING_UNAVAILABLE';
  message: string;
  alertBanner: string;
  isAvailable: false;
}

// ---------------------------------------------------------------------------
// Inspection templates (Contracts.Inspections.ChecklistTemplateDtos)
// ---------------------------------------------------------------------------

/** ChecklistTemplateItemDto */
export interface ChecklistTemplateItemDto {
  inspectionChecklistTemplateItemId: Guid;
  inspectionChecklistTemplateId: Guid;
  itemCode: string;
  label: string;
  description: string | null;
  responseType: ChecklistResponseType;
  isRequired: boolean;
  requiresEvidence: boolean;
  displayOrder: number;
  /** raw string, structure not defined by the backend */
  allowedOptionsJson: string | null;
  isActive: boolean;
  createdAtUtc: IsoDateTime;
  updatedAtUtc: IsoDateTime | null;
}

/** ChecklistTemplateDto (items is [] except on GET /{templateId}) */
export interface ChecklistTemplateDto {
  inspectionChecklistTemplateId: Guid;
  code: string;
  name: string;
  description: string | null;
  /** null = platform default template */
  categoryId: Guid | null;
  isActive: boolean;
  createdByUserId: Guid;
  createdAtUtc: IsoDateTime;
  updatedByUserId: Guid | null;
  updatedAtUtc: IsoDateTime | null;
  rowVersion: RowVersion;
  items: ChecklistTemplateItemDto[];
}

/** CreateChecklistTemplateRequest */
export interface CreateChecklistTemplateRequest {
  /** required, max 50, globally unique */
  code: string;
  /** required, max 150 */
  name: string;
  /** max 500 */
  description?: string | null;
  categoryId?: Guid | null;
  /** default true */
  isActive?: boolean;
}

/** UpdateChecklistTemplateRequest */
export interface UpdateChecklistTemplateRequest {
  name: string;
  description?: string | null;
  expectedRowVersion: RowVersion;
}

/** TemplateItemInput */
export interface TemplateItemInput {
  itemId?: Guid | null;
  /** required, max 50, unique per template */
  itemCode: string;
  /** required, max 255 */
  label: string;
  description?: string | null;
  responseType: ChecklistResponseType;
  /** default true */
  isRequired?: boolean;
  /** default false */
  requiresEvidence?: boolean;
  /** 0 (or omitted) = array index + 1; must be >= 0 */
  displayOrder?: number;
  allowedOptionsJson?: string | null;
}

/** ReplaceTemplateItemsRequest (full replace) */
export interface ReplaceTemplateItemsRequest {
  items: TemplateItemInput[];
}

// ---------------------------------------------------------------------------
// Inspections (Contracts.Inspections.InspectionDtos)
// ---------------------------------------------------------------------------

/** Query for GET /api/v1/admin/catalog/inspections/queue */
export interface InspectionQueueQuery {
  status?: InspectionStatus;
  result?: InspectionResult;
  assignedInspectorUserId?: Guid;
  categoryId?: Guid;
  sellerId?: Guid;
  /** compared to createdAtUtc */
  dateFrom?: IsoDateTime;
  dateTo?: IsoDateTime;
  /** default 1 */
  page?: number;
  /** default 20, server caps at 100 */
  pageSize?: number;
}

/** InspectionSummaryDto */
export interface InspectionSummaryDto {
  inspectionId: Guid;
  /** INSP-YYYY-NNNNNN */
  inspectionNo: string;
  listingId: Guid;
  listingVersionId: Guid;
  inspectionChecklistTemplateId: Guid;
  status: InspectionStatus;
  result: InspectionResult | null;
  assignedInspectorUserId: Guid | null;
  assignedByUserId: Guid | null;
  assignedAtUtc: IsoDateTime | null;
  startedAtUtc: IsoDateTime | null;
  completedAtUtc: IsoDateTime | null;
  cancelledAtUtc: IsoDateTime | null;
  summary: string | null;
  failureReasonCode: string | null;
  failureNotes: string | null;
  reinspectionOfInspectionId: Guid | null;
  createdByUserId: Guid;
  createdAtUtc: IsoDateTime;
  updatedByUserId: Guid | null;
  updatedAtUtc: IsoDateTime | null;
  /** inspection rowVersion: expectedRowVersion for all inspection writes */
  rowVersion: RowVersion;
  sellerId: Guid | null;
  listingTitle: string | null;
}

/** InspectionResponseDto */
export interface InspectionResponseDto {
  inspectionResponseId: Guid;
  inspectionId: Guid;
  sourceTemplateItemId: Guid;
  itemCodeSnapshot: string;
  itemLabelSnapshot: string;
  itemDescriptionSnapshot: string | null;
  responseTypeSnapshot: ChecklistResponseType;
  isRequiredSnapshot: boolean;
  requiresEvidenceSnapshot: boolean;
  displayOrderSnapshot: number;
  /** allowed values not constrained server-side */
  passFailValue: string | null;
  yesNoValue: boolean | null;
  textValue: string | null;
  numberValue: number | null;
  singleSelectValue: string | null;
  multiSelectValueJson: string | null;
  inspectorNotes: string | null;
  itemResult: InspectionItemResult | null;
  answeredAtUtc: IsoDateTime | null;
}

/** InspectionEvidenceDto */
export interface InspectionEvidenceDto {
  inspectionEvidenceId: Guid;
  inspectionId: Guid;
  inspectionResponseId: Guid | null;
  fileAssetId: Guid;
  evidenceType: InspectionEvidenceType;
  description: string | null;
  displayOrder: number;
  createdByUserId: Guid;
  createdAtUtc: IsoDateTime;
  /** presigned URL from inventory-media; null if broker call failed */
  downloadUrl: string | null;
}

/** InspectionStatusHistoryDto */
export interface InspectionStatusHistoryDto {
  inspectionStatusHistoryId: Guid;
  inspectionId: Guid;
  fromStatus: InspectionStatus | null;
  toStatus: InspectionStatus;
  result: InspectionResult | null;
  action: InspectionStatusHistoryAction;
  changedByUserId: Guid;
  reasonCode: string | null;
  notes: string | null;
  changedAtUtc: IsoDateTime;
}

/** InspectionAssignmentHistoryDto */
export interface InspectionAssignmentHistoryDto {
  assignmentHistoryId: Guid;
  inspectionId: Guid;
  previousInspectorUserId: Guid | null;
  newInspectorUserId: Guid;
  assignedByUserId: Guid;
  /** 'MANUAL_ASSIGNMENT' for assign; free text for reassign */
  reasonCode: string | null;
  notes: string | null;
  assignedAtUtc: IsoDateTime;
}

/** InspectionDetailDto (extends InspectionSummaryDto) */
export interface InspectionDetailDto extends InspectionSummaryDto {
  responses: InspectionResponseDto[];
  evidence: InspectionEvidenceDto[];
  statusHistory: InspectionStatusHistoryDto[];
  assignmentHistory: InspectionAssignmentHistoryDto[];
}

/** PagedInspectionQueueResponse (page/pageSize echo raw request; totalCount 0 on empty page) */
export interface PagedInspectionQueueResponse {
  items: InspectionSummaryDto[];
  totalCount: number;
  page: number;
  pageSize: number;
}

/** CreateInspectionRequest */
export interface CreateInspectionRequest {
  listingId: Guid;
  listingVersionId: Guid;
}

/** AssignInspectorRequest (target user must hold inspections.perform) */
export interface AssignInspectorRequest {
  inspectorUserId: Guid;
  expectedRowVersion: RowVersion;
}

/** ReassignInspectorRequest (does not change status) */
export interface ReassignInspectorRequest {
  newInspectorUserId: Guid;
  /** max 50 (SQL VARCHAR(50)) */
  reasonCode?: string | null;
  notes?: string | null;
  expectedRowVersion: RowVersion;
}

/** StartInspectionRequest */
export interface StartInspectionRequest {
  expectedRowVersion: RowVersion;
}

/** SaveInspectionResponseItem (see contract doc: save is currently broken server-side) */
export interface SaveInspectionResponseItem {
  inspectionResponseId: Guid;
  passFailValue?: string | null;
  yesNoValue?: boolean | null;
  textValue?: string | null;
  numberValue?: number | null;
  singleSelectValue?: string | null;
  multiSelectValueJson?: string | null;
  inspectorNotes?: string | null;
  itemResult?: InspectionItemResult | null;
}

/** SaveInspectionResponsesRequest */
export interface SaveInspectionResponsesRequest {
  expectedRowVersion: RowVersion;
  responses: SaveInspectionResponseItem[];
}

/** Application.Inspections.SaveResponsesResult (PUT /responses 200 body) */
export interface SaveResponsesResult {
  /** new inspection rowVersion */
  rowVersion: RowVersion;
  responses: InspectionResponseDto[];
}

/** AttachEvidenceRequest (file: purpose INSPECTION_EVIDENCE, AVAILABLE, uploaded by the acting user) */
export interface AttachEvidenceRequest {
  fileAssetId: Guid;
  inspectionResponseId?: Guid | null;
  evidenceType: InspectionEvidenceType;
  /** max 500 */
  description?: string | null;
  /** >= 0 */
  displayOrder: number;
  expectedRowVersion: RowVersion;
}

/** Query for DELETE /api/v1/admin/catalog/inspections/{id}/evidence/{evidenceId} (204 No Content) */
export interface DetachEvidenceQuery {
  /** Base64; must be URL-encoded */
  expectedRowVersion: RowVersion;
}

/** CompleteInspectionRequest */
export interface CompleteInspectionRequest {
  result: InspectionResult;
  summary?: string | null;
  /** required for FAIL / REINSPECTION_REQUIRED */
  failureReasonCode?: string | null;
  /** required for FAIL / REINSPECTION_REQUIRED, >= 10 chars trimmed */
  failureNotes?: string | null;
  expectedRowVersion: RowVersion;
}

/** CancelInspectionRequest */
export interface CancelInspectionRequest {
  reasonCode: string;
  notes?: string | null;
  expectedRowVersion: RowVersion;
}

/** AuthorizeReinspectionRequest (notes is ignored by the server; send at least {}) */
export interface AuthorizeReinspectionRequest {
  notes?: string | null;
}

// ---------------------------------------------------------------------------
// Seller read views (owner-only; admins receive 403 MARKETPLACE_SELLER_ACCESS_DENIED)
// ---------------------------------------------------------------------------

/** Query for GET /api/v1/marketplace/sellers/{sellerId}/listings */
export interface SellerListingListQuery {
  page?: number;
  pageSize?: number;
  status?: ListingStatus;
  categoryId?: Guid;
  search?: string;
  sort?: SellerListingSort;
}

/** Contracts.Listings.SellerListingListItemResponse */
export interface SellerListingListItemResponse {
  listingId: Guid;
  sellerId: Guid;
  status: ListingStatus;
  currentDraftVersionId: Guid | null;
  publishedVersionId: Guid | null;
  createdAtUtc: IsoDateTime;
  updatedAtUtc: IsoDateTime | null;
  title: string;
  categoryId: Guid;
}

/** Contracts.Listings.SellerListingListResponse (no page echo) */
export interface SellerListingListResponse {
  items: SellerListingListItemResponse[];
  totalCount: number;
}

/** Contracts.Listings.LocationDto */
export interface LocationDto {
  countryCode: string;
  stateOrEmirate: string;
  city: string;
}

/** Contracts.Listings.ListingVersionDto */
export interface ListingVersionDto {
  listingVersionId: Guid;
  versionNumber: number;
  categoryId: Guid;
  title: string;
  description: string | null;
  pricingMode: PricingMode;
  currency: string;
  basePrice: number;
  brandId: Guid | null;
  conditionId: Guid | null;
  gradeId: Guid | null;
  quantityUnitId: Guid | null;
  location: LocationDto | null;
}

/** Contracts.Listings.ListingDetailResponse */
export interface ListingDetailResponse {
  listingId: Guid;
  sellerId: Guid;
  status: ListingStatus;
  currentDraftVersionId: Guid | null;
  publishedVersionId: Guid | null;
  expiresAtUtc: IsoDateTime | null;
  rowVersion: RowVersion;
  currentDraftVersion: ListingVersionDto | null;
  publishedVersion: ListingVersionDto | null;
}

/** Contracts.Inventory.ListingInventoryResponse */
export interface ListingInventoryResponse {
  listingId: Guid;
  onHandQuantity: number;
  reservedQuantity: number;
  sellableQuantity: number;
  quantityUnitId: Guid | null;
  /** null when no inventory row exists yet */
  rowVersion: RowVersion | null;
}

/** Contracts.Listings.ListingMediaItemResponse */
export interface ListingMediaItemResponse {
  listingVersionMediaId: Guid;
  fileAssetId: Guid;
  mediaType: ListingMediaType;
  displayOrder: number;
  isPrimary: boolean;
  documentType: string | null;
}

/** Contracts.Listings.ListingMediaResponse */
export interface ListingMediaResponse {
  listingId: Guid;
  listingVersionId: Guid;
  rowVersion: RowVersion;
  media: ListingMediaItemResponse[];
}

// ---------------------------------------------------------------------------------------------
// Admin all-listings (F2-A): GET /api/v1/admin/catalog/listings, permission catalog:listings:view.
// C# Contracts.Listings.AdminListingQuery / AdminListingItemDto / AdminListingListResponse (enveloped).
// ---------------------------------------------------------------------------------------------

/** Aggregate listing state (LISTING.Status). Anything else → 400 INVALID_STATUS. */
export type AdminListingStatus = 'DRAFT' | 'PUBLISHED' | 'SUSPENDED' | 'EXPIRED' | 'ARCHIVED';
/** Candidate / active version state. Anything else → 400 INVALID_MODERATION_STATUS. */
export type AdminListingModerationStatus =
  | 'DRAFT'
  | 'UNDER_REVIEW'
  | 'CHANGES_REQUIRED'
  | 'APPROVED'
  | 'INSPECTION_REQUIRED'
  | 'REJECTED'
  | 'PUBLISHED'
  | 'SUPERSEDED'
  | 'ARCHIVED';
export type AdminListingSort = 'CreatedAtUtcDesc' | 'CreatedAtUtcAsc' | 'UpdatedAtUtcDesc' | 'UpdatedAtUtcAsc' | 'TitleAsc' | 'TitleDesc';

export interface AdminListingQuery {
  page?: number; // 1-based; > 100000 → 400 INVALID_PAGE
  pageSize?: number; // default 20, max 100
  status?: AdminListingStatus;
  moderationStatus?: AdminListingModerationStatus;
  sellerId?: Guid;
  categoryId?: Guid;
  /** Title, LST-XXXXXXXX listing number, or exact listing GUID; max 255 chars. */
  search?: string;
  sort?: AdminListingSort;
}

export interface AdminListingItem {
  listingId: Guid;
  sellerId: Guid;
  /** Display reference only (LST- + first 8 of listingId); always act on listingId. */
  listingNumber: string;
  title: string;
  categoryId: Guid | null;
  categoryName: string | null;
  status: AdminListingStatus | string;
  currentDraftVersionId: Guid | null;
  currentDraftVersionStatus: AdminListingModerationStatus | string | null;
  publishedVersionId: Guid | null;
  primaryFileAssetId: Guid | null;
  requiresPhysicalInspection: boolean;
  /** Candidate version is APPROVED and needs an admin to publish it (first time or replacement). */
  isApprovedAwaitingPublication: boolean;
  isApprovedAwaitingInitialPublication: boolean;
  isApprovedAwaitingReplacementPublication: boolean;
  createdAtUtc: IsoDateTime;
  updatedAtUtc: IsoDateTime | null;
  publishedAtUtc: IsoDateTime | null;
}

export interface AdminListingListResponse {
  items: AdminListingItem[];
  page: number;
  pageSize: number;
  totalCount: number;
}
