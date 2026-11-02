/**
 * PA-1A policies (services/user-organization, gateway /api/v1/policies). Enveloped { success, data }.
 * C# source: Contracts/Policies/PolicyContracts.cs, Api/Controllers/PoliciesController.cs.
 * There is no admin endpoint that lists draft or historical revisions — only the currently published ones.
 */
import type { Guid, IsoDateTime } from "./user-organization";

/** C# PolicySummaryResponse — GET /policies?lang= (anonymous). */
export interface PolicySummaryResponse {
  policyDocumentId: Guid;
  policyCode: string;
  name: string;
  description: string | null;
  audience: string;
  isMandatory: boolean;
  policyRevisionId: Guid;
  revisionCode: string;
  languageCode: string;
  effectiveFromUtc: IsoDateTime;
  publishedAtUtc: IsoDateTime | null;
  /** PUBLISHED for live revisions; a new revision starts as DRAFT. */
  status: string;
  title: string;
  contentHash: string;
}

/** C# PolicyDetailResponse — GET /policies/{code}?lang=, and the result of creating a revision. `content` is Markdown. */
export interface PolicyDetailResponse extends PolicySummaryResponse {
  content: string;
}

/** C# CreatePolicyRevisionRequest — POST /policies/admin/revisions (policies.manage). The server computes the hash. */
export interface CreatePolicyRevisionRequest {
  policyCode: string;
  revisionCode: string;
  /** "en" | "ar" */
  languageCode: string;
  effectiveFromUtc: IsoDateTime;
  title: string;
  content: string;
  contentHash?: string | null;
}
