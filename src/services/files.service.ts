import { http } from "@/lib/api/client";
import { ApiError, defaultMessageFor } from "@/lib/api/errors";
import { unwrapData } from "@/lib/api/envelope";
import type {
  CreateUploadEnvelope,
  CreateUploadResponse,
  DownloadUrlEnvelope,
  DownloadUrlResponse,
  FileAssetEnvelope,
  FileAssetResponse,
  FilePurpose,
} from "@/api/types/files";

/**
 * inventory-media /api/v1/files. Success: { data }, errors: { errorCode, message }.
 * Upload flow: request presigned URL → PUT bytes directly to S3 → complete → use fileId in the
 * domain API. Files are owner-scoped: an admin can only read files they uploaded.
 * Contract: docs/contracts/files-notifications-search.md §A
 */

/**
 * Per-purpose upload policy, mirrored from FileAssetService._policies
 * (services/inventory-media/src/Emcore.InventoryMedia.Application/Services/FileAssetService.cs:30-39).
 * The server rejects a request unless BOTH the MIME type (lower-cased) and the file-name extension are
 * allowed (FileAssetService.cs:58-60 -> 400 FILE_CONTENT_TYPE_INVALID), and size must be 1..maxBytes
 * (FileAssetService.cs:55-56 -> 413 FILE_SIZE_EXCEEDED). `accept` lists the MIME types only.
 */
interface FilePurposePolicy {
  maxBytes: number;
  accept: string;
  extensions: readonly string[];
}

const IMAGE_MIME = "image/jpeg,image/png,image/webp";
const IMAGE_EXT = [".jpg", ".jpeg", ".png", ".webp"] as const;
const DOC_MIME = "application/pdf,image/jpeg,image/png";
const DOC_EXT = [".pdf", ".jpg", ".jpeg", ".png"] as const;
const DOC_IMAGE_MIME = "application/pdf,image/jpeg,image/png,image/webp";
const DOC_IMAGE_EXT = [".pdf", ".jpg", ".jpeg", ".png", ".webp"] as const;
const MB = 1024 * 1024;

export const FILE_LIMITS: Record<FilePurpose, FilePurposePolicy> = {
  USER_PROFILE_PHOTO: { maxBytes: 5 * MB, accept: IMAGE_MIME, extensions: IMAGE_EXT },
  SELLER_PROFILE_LOGO: { maxBytes: 5 * MB, accept: IMAGE_MIME, extensions: IMAGE_EXT },
  LISTING_IMAGE: { maxBytes: 10 * MB, accept: IMAGE_MIME, extensions: IMAGE_EXT },
  SELLER_DOCUMENT: { maxBytes: 20 * MB, accept: DOC_MIME, extensions: DOC_EXT },
  LISTING_DOCUMENT: { maxBytes: 20 * MB, accept: DOC_MIME, extensions: DOC_EXT },
  INSPECTION_EVIDENCE: { maxBytes: 20 * MB, accept: DOC_IMAGE_MIME, extensions: DOC_IMAGE_EXT },
  CHAT_ATTACHMENT: { maxBytes: 20 * MB, accept: DOC_IMAGE_MIME, extensions: DOC_IMAGE_EXT },
  RETURN_EVIDENCE: { maxBytes: 20 * MB, accept: DOC_IMAGE_MIME, extensions: DOC_IMAGE_EXT },
  GENERAL_ATTACHMENT: { maxBytes: 20 * MB, accept: DOC_IMAGE_MIME, extensions: DOC_IMAGE_EXT },
  INVOICE_DOCUMENT: { maxBytes: 20 * MB, accept: "application/pdf", extensions: [".pdf"] },
};

/** Same extension rule as Path.GetExtension(name).ToLowerInvariant() on the server. */
function fileExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 || (dot === 0 && name.length > 1) ? name.slice(dot).toLowerCase() : "";
}

/** True when the server would accept this file's MIME type and extension for the purpose. */
export function isAllowedFileType(file: Pick<File, "name" | "type">, purpose: FilePurpose): boolean {
  const policy = FILE_LIMITS[purpose];
  return policy.accept.split(",").includes(file.type.toLowerCase()) && policy.extensions.includes(fileExtension(file.name));
}

/** PUT to the presigned S3 URL with progress. No Authorization header is sent to S3. */
function putToStorage(upload: CreateUploadResponse, file: File, onProgress?: (fraction: number) => void, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!upload.uploadUrl) {
      reject(new ApiError({ kind: "server", status: 0, message: "The server did not return an upload URL." }));
      return;
    }
    const xhr = new XMLHttpRequest();
    xhr.open(upload.httpMethod ?? "PUT", upload.uploadUrl);
    for (const [name, value] of Object.entries(upload.requiredHeaders ?? {})) xhr.setRequestHeader(name, value);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new ApiError({ kind: "http", status: xhr.status, message: "The file could not be stored. Please try again." }));
    // A browser-blocked PUT (status 0) almost always means the storage bucket has no CORS rule for this
    // site's origin (S3 answers the preflight with "CORS is not enabled for this bucket").
    xhr.onerror = () =>
      reject(
        new ApiError({
          kind: "network",
          status: 0,
          message: navigator.onLine === false ? defaultMessageFor("network") : "The file storage blocked this upload. It needs to allow uploads from this website (storage CORS settings) — please contact support.",
        }),
      );
    xhr.onabort = () => reject(new ApiError({ kind: "aborted", status: 0, message: defaultMessageFor("aborted") }));
    signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(file);
  });
}

export const filesService = {
  requestUpload: async (file: File, purpose: FilePurpose) =>
    unwrapData<CreateUploadResponse>(
      await http.post<CreateUploadEnvelope>("/api/v1/files/upload-requests", {
        originalFileName: file.name,
        contentType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        purpose,
      }),
    ),

  complete: async (fileId: string) => unwrapData<FileAssetResponse>(await http.post<FileAssetEnvelope>(`/api/v1/files/${encodeURIComponent(fileId)}/complete`)),

  get: async (fileId: string, signal?: AbortSignal) => unwrapData<FileAssetResponse>(await http.get<FileAssetEnvelope>(`/api/v1/files/${encodeURIComponent(fileId)}`, { signal })),

  downloadUrl: async (fileId: string) => unwrapData<DownloadUrlResponse>(await http.post<DownloadUrlEnvelope>(`/api/v1/files/${encodeURIComponent(fileId)}/download-url`)),

  delete: (fileId: string) => http.delete<unknown>(`/api/v1/files/${encodeURIComponent(fileId)}`),

  /** Validates locally, then runs the full request → S3 PUT → complete flow. Returns the AVAILABLE asset. */
  async upload(file: File, purpose: FilePurpose, options: { onProgress?: (fraction: number) => void; signal?: AbortSignal } = {}): Promise<FileAssetResponse> {
    const limit = FILE_LIMITS[purpose];
    if (file.size <= 0 || file.size > limit.maxBytes) {
      throw new ApiError({
        kind: "validation",
        status: 413,
        code: "FILE_SIZE_EXCEEDED",
        message: file.size <= 0 ? "The file is empty." : `The file is larger than ${Math.round(limit.maxBytes / MB)} MB.`,
      });
    }
    if (!isAllowedFileType(file, purpose)) {
      throw new ApiError({
        kind: "validation",
        status: 400,
        code: "FILE_CONTENT_TYPE_INVALID",
        message: `This file type is not accepted. Allowed: ${limit.extensions.join(", ")}.`,
      });
    }
    const upload = await filesService.requestUpload(file, purpose);
    await putToStorage(upload, file, options.onProgress, options.signal);
    return filesService.complete(upload.fileId);
  },
};
