/** E5-DISP-1/2 admin inspection disputes (AdminListingDisputesController, DisputeDtos.cs). No envelope. */
import type { Guid, IsoDateTime, RowVersion } from "./catalog-moderation";

export type DisputeType = "INSPECTION_APPEAL" | "CORRECTION_DECLINE_DISPUTE";
export type DisputeStatus = "SUBMITTED" | "APPROVED_FOR_REINSPECTION" | "REJECTED";
export type DisputeDecision = "APPROVE_REINSPECTION" | "REJECT";

export interface InspectionDisputeEvidenceDto {
  disputeEvidenceId: Guid;
  fileAssetId: Guid;
  evidenceType: string;
  description: string | null;
  displayOrder: number;
  createdAtUtc: IsoDateTime;
  downloadUrl: string | null;
  expiresAtUtc: IsoDateTime | null;
}

export interface InspectionDisputeAuditDto {
  disputeAuditId: Guid;
  disputeId: Guid;
  eventType: string;
  fromStatus: string | null;
  toStatus: string;
  actorUserId: Guid;
  actorType: string;
  notes: string | null;
  snapshotJson: string | null;
  occurredAtUtc: IsoDateTime;
}

export interface AdminInspectionDisputeDto {
  disputeId: Guid;
  disputeNo: string;
  listingId: Guid;
  listingVersionId: Guid;
  inspectionId: Guid;
  inspectionNo: string | null;
  correctionId: Guid | null;
  correctionNo: string | null;
  disputeType: DisputeType;
  status: DisputeStatus;
  disputedInspectionResult: string;
  reasonCode: string;
  sellerReason: string;
  requiresDifferentInspector: boolean;
  inspectionCompletedAtUtc: IsoDateTime;
  submittedAtUtc: IsoDateTime;
  decision: DisputeDecision | null;
  decisionNotes: string | null;
  decidedAtUtc: IsoDateTime | null;
  authorizedReinspectionId: Guid | null;
  authorizedReinspectionNo: string | null;
  rowVersion: RowVersion;
  sellerId: Guid;
  listingTitle: string | null;
  disputedInspectorUserId: Guid | null;
  submittedByUserId: Guid;
  internalDecisionNotes: string | null;
  decidedByUserId: Guid | null;
  retentionUntilUtc: IsoDateTime | null;
  legalHoldYn: boolean;
}

export interface AdminInspectionDisputeDetailDto extends AdminInspectionDisputeDto {
  evidence: InspectionDisputeEvidenceDto[];
  auditHistory: InspectionDisputeAuditDto[];
}

export interface AdminInspectionDisputeQueueResponse {
  items: AdminInspectionDisputeDto[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface DisputeQueueQuery {
  status?: DisputeStatus | "";
  disputeType?: DisputeType | "";
  sellerId?: string;
  listingId?: string;
  inspectionId?: string;
  page: number;
  pageSize: number;
}

export interface DecideInspectionDisputeRequest {
  decision: DisputeDecision;
  /** 10–2000, shown to the seller. */
  decisionNotes: string;
  /** Staff only. */
  internalDecisionNotes?: string | null;
  expectedRowVersion: RowVersion;
}
