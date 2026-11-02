/**
 * Inventory & Media file API types (services/inventory-media, /api/v1/files/*).
 * See docs/contracts/files-notifications-search.md §A.
 */

/** ISO-8601 date-time string. */
type IsoDateTime = string;

/** C# Domain.Constants.FilePurpose (input case-insensitive; stored/returned uppercase). */
export type FilePurpose =
  | 'USER_PROFILE_PHOTO'
  | 'SELLER_PROFILE_LOGO'
  | 'SELLER_DOCUMENT'
  | 'LISTING_IMAGE'
  | 'LISTING_DOCUMENT'
  | 'INSPECTION_EVIDENCE'
  | 'CHAT_ATTACHMENT'
  | 'RETURN_EVIDENCE'
  | 'INVOICE_DOCUMENT'
  | 'GENERAL_ATTACHMENT';

/** C# Domain.Constants.FileStatus. */
export type FileStatus = 'PENDING_UPLOAD' | 'AVAILABLE' | 'DELETED';

/** Error codes produced by FilesController.MapException. */
export type FileErrorCode =
  | 'FILE_NOT_FOUND'
  | 'FILE_ACCESS_DENIED'
  | 'FILE_PURPOSE_INVALID'
  | 'FILE_CONTENT_TYPE_INVALID'
  | 'FILE_SIZE_EXCEEDED'
  | 'FILE_UPLOAD_EXPIRED'
  | 'FILE_NOT_PENDING'
  | 'FILE_ALREADY_DELETED'
  | 'FILE_OBJECT_NOT_FOUND'
  | 'FILE_OBJECT_MISMATCH'
  | 'FILE_VERSION_CONFLICT'
  | 'STORAGE_UNAVAILABLE'
  | 'INTERNAL_SERVER_ERROR';

/** C# Contracts.Responses.ApiResponse<T> success envelope. */
export interface FilesApiResponse<T> {
  data: T;
}

/** C# Contracts.Responses.ErrorResponse. */
export interface FilesErrorResponse {
  errorCode: FileErrorCode;
  message: string;
}

/** C# Contracts.Requests.CreateUploadRequest (all reference props nullable in C#). */
export interface CreateUploadRequest {
  originalFileName: string | null;
  contentType: string | null;
  sizeBytes: number;
  purpose: FilePurpose | null;
}

/** C# Contracts.Responses.CreateUploadResponse. requiredHeaders key is literally "Content-Type". */
export interface CreateUploadResponse {
  fileId: string;
  uploadUrl: string | null;
  httpMethod: 'PUT' | null;
  requiredHeaders: Record<string, string>;
  expiresAtUtc: IsoDateTime;
}

/** C# Contracts.Responses.FileAssetResponse. */
export interface FileAssetResponse {
  fileId: string;
  purpose: FilePurpose | null;
  originalFileName: string | null;
  actualContentType: string | null;
  actualSizeBytes: number;
  status: FileStatus | null;
  createdAtUtc: IsoDateTime;
  completedAtUtc: IsoDateTime | null;
}

/** C# Contracts.Responses.DownloadUrlResponse. */
export interface DownloadUrlResponse {
  fileId: string;
  downloadUrl: string | null;
  expiresAtUtc: IsoDateTime;
}

/** Response of POST /api/v1/files/upload-requests. */
export type CreateUploadEnvelope = FilesApiResponse<CreateUploadResponse>;
/** Response of POST /api/v1/files/{fileId}/complete and GET /api/v1/files/{fileId}. */
export type FileAssetEnvelope = FilesApiResponse<FileAssetResponse>;
/** Response of POST /api/v1/files/{fileId}/download-url. */
export type DownloadUrlEnvelope = FilesApiResponse<DownloadUrlResponse>;
