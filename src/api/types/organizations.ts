/**
 * PA-1B.2 admin: material business-change review and the UAE business calendar (services/user-organization).
 * Enveloped { success, data }. Source: Contracts/OrganizationBusinessChangeContracts.cs, Contracts/Calendar/CalendarContracts.cs,
 * AdminOrganizationBusinessChangesController.cs, AdminCalendarController.cs (the PA1B2 guide differs in places).
 */
import type { Guid, IsoDateTime } from "./user-organization";

export type BusinessChangeCategory = "TRADE_LICENCE" | "VAT_TRN" | "BANK_ACCOUNT" | "AUTHORISED_SIGNATORY" | "LEGAL_OWNERSHIP" | "REGISTERED_COMPANY_DETAILS";
/** Approving these sends the company back to KYC (buyer UNDER_REVIEW, seller SUBMITTED). */
export const SENSITIVE_CHANGE_CATEGORIES: string[] = ["TRADE_LICENCE", "VAT_TRN", "BANK_ACCOUNT", "AUTHORISED_SIGNATORY", "LEGAL_OWNERSHIP"];

export interface BusinessChangeDocumentDto {
  documentId: Guid;
  requestId: Guid;
  organizationId: Guid;
  documentType: string;
  mediaAssetId: Guid;
  fileName: string;
  fileSize: number;
  mimeType: string;
  createdAtUtc: IsoDateTime;
}
/** ORG-3: GET /admin/organizations/business-changes/{requestId}/documents/{documentId}/download-url (enveloped). */
export interface BusinessChangeDocumentDownloadUrlResponse {
  documentId: Guid;
  requestId: Guid;
  mediaAssetId: Guid;
  documentType: string;
  downloadUrl: string | null;
  expiresAtUtc: IsoDateTime | null;
}
export interface BusinessChangeHistoryDto {
  historyId: Guid;
  requestId: Guid;
  organizationId: Guid;
  fromStatus: string;
  toStatus: string;
  performedByUserId: Guid;
  notes: string | null;
  occurredAtUtc: IsoDateTime;
}
/** C# BusinessChangeRequestResponse. Deadline / overdue are computed server-side from the UAE calendar. */
export interface BusinessChangeRequestResponse {
  requestId: Guid;
  organizationId: Guid;
  organizationName: string;
  organizationLegalName: string | null;
  changeCategory: string;
  status: string;
  reason: string;
  effectiveDate: IsoDateTime;
  reportingDeadlineUtc: IsoDateTime;
  isOverdue: boolean;
  previousValues: unknown;
  proposedValues: unknown;
  submittedByUserId: Guid | null;
  submittedAtUtc: IsoDateTime | null;
  reviewedByUserId: Guid | null;
  reviewedAtUtc: IsoDateTime | null;
  reviewNotes: string | null;
  createdAtUtc: IsoDateTime;
  updatedAtUtc: IsoDateTime;
  rowVersion: string;
  documents?: BusinessChangeDocumentDto[] | null;
  history?: BusinessChangeHistoryDto[] | null;
}
/** GET /admin/organizations/business-changes — paged on the live API: { items, totalCount, pageNumber, pageSize }. */
export interface BusinessChangePage {
  items: BusinessChangeRequestResponse[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
}
export interface BusinessChangeQueueQuery {
  status?: string;
  changeCategory?: string;
  overdueOnly?: boolean;
  pageNumber?: number;
  pageSize?: number;
}
export interface AdminReviewBusinessChangeRequest {
  reviewNotes?: string | null;
}
export interface AdminRejectBusinessChangeRequest {
  rejectionReason: string;
}

/** C# CalendarConfigurationDto — GET /admin/calendar/configuration (organizations.calendar.view). */
export interface CalendarConfigurationDto {
  calendarConfigId: Guid;
  calendarCode: string;
  calendarName: string;
  /** Comma-separated day numbers, 0 = Sunday … 6 = Saturday. */
  weekendDays: string;
  maxSupportedYear: number;
  maxApprovedYear: number;
  isActive: boolean;
  updatedAtUtc: IsoDateTime;
}
/** C# UpdateCalendarConfigRequest — PUT /admin/calendar/configuration (organizations.calendar.manage). */
export interface UpdateCalendarConfigRequest {
  weekendDays: string;
  maxApprovedYear: number;
  isActive: boolean;
  changeReason: string;
}
/** C# PublicHolidayDto — GET /admin/calendar/holidays?year= */
export interface PublicHolidayDto {
  publicHolidayId: Guid;
  calendarCode: string;
  holidayCode: string;
  holidayName: string;
  holidayDate: IsoDateTime;
  isObserved: boolean;
  isOverride: boolean;
  isOfficiallyConfirmed: boolean;
  /** CONFIRMED | PROVISIONAL */
  approvalStatus: string;
  sourceReference: string | null;
  confirmedAtUtc: IsoDateTime | null;
  updatedAtUtc: IsoDateTime;
  sourceAuthority?: string | null;
  sourceDocumentTitle?: string | null;
  publicationReferenceNumber?: string | null;
  publicationDate?: IsoDateTime | null;
  officialPublicationUrl?: string | null;
  evidenceMediaAssetId?: Guid | null;
  verificationRemarks?: string | null;
}
/** C# ConfirmPublicHolidayRequest — POST /admin/calendar/holidays/{id}/confirm (organizations.calendar.holidays.confirm). */
export interface ConfirmPublicHolidayRequest {
  sourceAuthority: string;
  sourceDocumentTitle: string;
  publicationReferenceNumber: string;
  /** yyyy-MM-dd, not in the future */
  publicationDate: string;
  verificationRemarks: string;
  attestationConfirmed: true;
  officialPublicationUrl?: string | null;
  evidenceMediaAssetId?: Guid | null;
}
