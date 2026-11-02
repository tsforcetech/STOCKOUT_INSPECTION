/**
 * Notification template admin API types (services/notification-integration, /api/v1/admin/notification-templates/*).
 * See docs/contracts/files-notifications-search.md §B.
 */

/** ISO-8601 date-time string. */
type IsoDateTime = string;

/** C# Domain.Constants.NotificationTemplateChannels (case-sensitive). */
export type NotificationTemplateChannel = 'EMAIL' | 'WHATSAPP' | 'SMS' | 'PUSH' | 'IN_APP';

/** C# Domain.Constants.NotificationTemplatePurposes (case-sensitive). */
export type NotificationTemplatePurpose = 'TRANSACTIONAL' | 'SECURITY' | 'SYSTEM' | 'MARKETING';

/** C# Domain.Constants.NotificationTemplateStatuses. */
export type NotificationTemplateStatus = 'DRAFT' | 'ACTIVE' | 'RETIRED';

/** C# Domain.Constants.NotificationTemplateDataTypes (case-sensitive). */
export type NotificationTemplateDataType = 'STRING' | 'NUMBER' | 'DATETIME' | 'URL';

/** Permission codes checked by [RequiresPlatformPermission] via user-organization. */
export type NotificationTemplatePermission =
  | 'notification-templates.view'
  | 'notification-templates.create'
  | 'notification-templates.update'
  | 'notification-templates.activate'
  | 'notification-templates.deactivate';

/** Values of ErrorResponse.error emitted by AdminNotificationTemplatesController / attribute / validator. */
export type NotificationTemplateErrorCode =
  | 'FORBIDDEN'
  | 'NOTIFICATION_TEMPLATE_NOT_FOUND'
  | 'TEMPLATE_CODE_EXISTS'
  | 'TEMPLATE_VERSION_NOT_FOUND'
  | 'TEMPLATE_DRAFT_ALREADY_EXISTS'
  | 'TEMPLATE_NOT_EDITABLE'
  | 'TEMPLATE_VERSION_CONFLICT'
  | 'TEMPLATE_INVALID_STATE'
  | 'TEMPLATE_CONTENT_INVALID'
  | 'TEMPLATE_PARAMETER_INVALID'
  | 'TEMPLATE_PLACEHOLDER_UNDECLARED';

/** C# EnvelopeResponse<T>. */
export interface NotificationEnvelope<T> {
  success: boolean;
  data: T;
}

/** C# ErrorResponse. message is "" for everything except FORBIDDEN ("Insufficient permissions."). */
export interface NotificationErrorResponse {
  error: NotificationTemplateErrorCode;
  message: string;
}

/** C# NotificationTemplateParameterDto (request item). name: ^[A-Za-z][A-Za-z0-9_]*$, unique case-insensitively; displayOrder >= 0. */
export interface NotificationTemplateParameterDto {
  name: string;
  dataType: NotificationTemplateDataType;
  isRequired: boolean;
  description: string | null;
  displayOrder: number;
}

/** C# CreateNotificationTemplateRequest. templateCode 1..150 chars. Channel-specific content rules apply. */
export interface CreateNotificationTemplateRequest {
  templateCode: string;
  channel: NotificationTemplateChannel;
  purpose: NotificationTemplatePurpose;
  subject: string | null;
  title: string | null;
  bodyText: string | null;
  bodyHtml: string | null;
  parameters: NotificationTemplateParameterDto[];
}

/** C# UpdateNotificationTemplateDraftRequest (full replacement of content + parameters). */
export interface UpdateNotificationTemplateDraftRequest {
  expectedVersion: number;
  subject: string | null;
  title: string | null;
  bodyText: string | null;
  bodyHtml: string | null;
  parameters: NotificationTemplateParameterDto[];
}

/** C# ActivateNotificationTemplateRequest. */
export interface ActivateNotificationTemplateRequest {
  expectedVersion: number;
}

/** C# RetireNotificationTemplateRequest. */
export interface RetireNotificationTemplateRequest {
  expectedVersion: number;
}

/** Query for GET /api/v1/admin/notification-templates. */
export interface NotificationTemplateListQuery {
  page?: number; // default 1, clamped >= 1
  pageSize?: number; // default 20, clamped 1..100
  search?: string; // LIKE %search% on templateCode
  channel?: NotificationTemplateChannel;
  purpose?: NotificationTemplatePurpose;
  status?: NotificationTemplateStatus; // templates having ANY version in this status
}

/** C# NotificationTemplateSummaryResponse. */
export interface NotificationTemplateSummaryResponse {
  templateId: string;
  templateCode: string;
  channel: NotificationTemplateChannel;
  purpose: NotificationTemplatePurpose;
  activeVersionId: string | null;
  activeVersionNumber: number | null;
  createdAtUtc: IsoDateTime;
  createdByUserId: string | null;
}

/** C# NotificationTemplateListResponse. */
export interface NotificationTemplateListResponse {
  items: NotificationTemplateSummaryResponse[];
  page: number;
  pageSize: number;
  totalCount: number;
}

/** C# NotificationTemplateVersionParameterResponse. */
export interface NotificationTemplateVersionParameterResponse {
  parameterId: string;
  versionId: string;
  name: string;
  dataType: NotificationTemplateDataType;
  isRequired: boolean;
  description: string | null;
  displayOrder: number;
}

/** C# NotificationTemplateVersionResponse. concurrencyVersion is the value to send as expectedVersion. */
export interface NotificationTemplateVersionResponse {
  versionId: string;
  templateId: string;
  versionNumber: number;
  concurrencyVersion: number;
  status: NotificationTemplateStatus;
  subject: string | null;
  title: string | null;
  bodyText: string | null;
  bodyHtml: string | null;
  parameters: NotificationTemplateVersionParameterResponse[];
  createdAtUtc: IsoDateTime;
  createdByUserId: string | null;
  updatedAtUtc: IsoDateTime | null;
  updatedByUserId: string | null;
  activatedAtUtc: IsoDateTime | null;
  activatedByUserId: string | null;
  retiredAtUtc: IsoDateTime | null;
  retiredByUserId: string | null;
}

/** Anonymous data of create / create-next-draft / update-draft responses. */
export interface NotificationTemplateVersionRef {
  versionId: string;
  concurrencyVersion: number;
}

/** Anonymous data of activate / retire responses. */
export interface NotificationTemplateVersionTransition extends NotificationTemplateVersionRef {
  status: 'ACTIVE' | 'RETIRED';
}

export type NotificationTemplateListEnvelope = NotificationEnvelope<NotificationTemplateListResponse>;
export type NotificationTemplateSummaryEnvelope = NotificationEnvelope<NotificationTemplateSummaryResponse>;
export type NotificationTemplateHistoryEnvelope = NotificationEnvelope<NotificationTemplateVersionResponse[]>;
export type NotificationTemplateVersionRefEnvelope = NotificationEnvelope<NotificationTemplateVersionRef>;
export type NotificationTemplateTransitionEnvelope = NotificationEnvelope<NotificationTemplateVersionTransition>;
