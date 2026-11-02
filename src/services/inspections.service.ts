import { http } from "@/lib/api/client";
import type {
  AssignInspectorRequest,
  AttachEvidenceRequest,
  CancelInspectionRequest,
  ChecklistTemplateDto,
  CompleteInspectionRequest,
  CreateInspectionRequest,
  Guid,
  InspectionDetailDto,
  InspectionEvidenceDownloadUrlResponse,
  InspectionEvidenceDto,
  InspectionQueueQuery,
  InspectionSummaryDto,
  PagedInspectionQueueResponse,
  ReassignInspectorRequest,
  RowVersion,
  SaveInspectionResponsesRequest,
  SaveResponsesResult,
} from "@/api/types/catalog-moderation";

/**
 * catalog-listing admin inspections (/api/v1/admin/catalog/inspections/*).
 * NO response envelope. Every write takes the INSPECTION rowVersion as expectedRowVersion
 * (in the body, or in the query string for evidence DELETE).
 * Contract: docs/contracts/catalog-moderation-inspections.md §5–6
 */
const seg = encodeURIComponent;
const base = "/api/v1/admin/catalog/inspections";
const one = (id: Guid) => `${base}/${seg(id)}`;

export const inspectionsService = {
  /** Server-paginated, newest first (createdAtUtc DESC). */
  queue: (query: InspectionQueueQuery, signal?: AbortSignal) =>
    http.get<PagedInspectionQueueResponse>(`${base}/queue`, {
      signal,
      query: {
        status: query.status,
        result: query.result,
        assignedInspectorUserId: query.assignedInspectorUserId,
        categoryId: query.categoryId,
        sellerId: query.sellerId,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        page: query.page,
        pageSize: query.pageSize,
      },
    }),

  detail: (inspectionId: Guid, signal?: AbortSignal) => http.get<InspectionDetailDto>(one(inspectionId), { signal }),

  /** Requires inspections.override. 201 with the new PENDING inspection. */
  create: (body: CreateInspectionRequest) => http.post<InspectionSummaryDto>(base, body),

  assign: (inspectionId: Guid, body: AssignInspectorRequest) => http.post<InspectionSummaryDto>(`${one(inspectionId)}/assign`, body),

  reassign: (inspectionId: Guid, body: ReassignInspectorRequest) => http.post<InspectionSummaryDto>(`${one(inspectionId)}/reassign`, body),

  start: (inspectionId: Guid, expectedRowVersion: RowVersion) => http.post<InspectionSummaryDto>(`${one(inspectionId)}/start`, { expectedRowVersion }),

  /** Saves checklist answers (fixed in R3-A: answers now persist). Every item needs its inspectionResponseId. */
  saveResponses: (inspectionId: Guid, body: SaveInspectionResponsesRequest) => http.put<SaveResponsesResult>(`${one(inspectionId)}/responses`, body),

  /** F2-E: fresh URL for one evidence file (admins, or the assigned inspector). */
  evidenceDownloadUrl: (inspectionId: Guid, evidenceId: Guid) =>
    http.get<InspectionEvidenceDownloadUrlResponse>(`${one(inspectionId)}/evidence/${seg(evidenceId)}/download-url`),

  attachEvidence: (inspectionId: Guid, body: AttachEvidenceRequest) => http.post<InspectionEvidenceDto>(`${one(inspectionId)}/evidence`, body),

  /** 204. expectedRowVersion goes in the query string (URL-encoded by buildUrl). */
  detachEvidence: (inspectionId: Guid, evidenceId: Guid, expectedRowVersion: RowVersion) =>
    http.delete<void>(`${one(inspectionId)}/evidence/${seg(evidenceId)}`, { query: { expectedRowVersion } }),

  complete: (inspectionId: Guid, body: CompleteInspectionRequest) => http.post<InspectionSummaryDto>(`${one(inspectionId)}/complete`, body),

  cancel: (inspectionId: Guid, body: CancelInspectionRequest) => http.post<InspectionSummaryDto>(`${one(inspectionId)}/cancel`, body),

  /** 201 with the NEW inspection. The server ignores `notes`, but the body must be non-empty. */
  authorizeReinspection: (inspectionId: Guid) => http.post<InspectionSummaryDto>(`${one(inspectionId)}/authorize-reinspection`, {}),

  /** Template with items (requires inspections.templates.manage). Used to read allowedOptionsJson. */
  template: (templateId: Guid, signal?: AbortSignal) =>
    http.get<ChecklistTemplateDto>(`/api/v1/admin/catalog/inspection-templates/${seg(templateId)}`, { signal }),
};
