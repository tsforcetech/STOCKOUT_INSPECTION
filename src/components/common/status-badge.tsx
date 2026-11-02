import { Badge, type BadgeTone } from "@/components/ui/misc";
import { humanize } from "@/lib/utils/format";

const TONES: Record<string, BadgeTone> = {
  // generic
  ACTIVE: "success",
  INACTIVE: "neutral",
  ENABLED: "success",
  DISABLED: "danger",
  // sellers
  VERIFIED: "success",
  PENDING: "warning",
  UNVERIFIED: "neutral",
  REJECTED: "danger",
  SUSPENDED: "danger",
  DRAFT: "neutral",
  SUBMITTED: "warning",
  UNDER_REVIEW: "warning",
  COMPLETED: "success",
  // invitations
  ACCEPTED: "success",
  REVOKED: "neutral",
  EXPIRED: "neutral",
  // listings / moderation
  PUBLISHED: "success",
  APPROVED: "success",
  CHANGES_REQUIRED: "warning",
  INSPECTION_REQUIRED: "info",
  SUPERSEDED: "neutral",
  ARCHIVED: "neutral",
  // inspections
  ASSIGNED: "info",
  IN_PROGRESS: "warning",
  CANCELLED: "neutral",
  PASS: "success",
  FAIL: "danger",
  REINSPECTION_REQUIRED: "warning",
  AWAITING_SELLER_DECISION: "warning",
  READY_FOR_MODERATION: "info",
  SELLER_ACCEPTED: "info",
  SUBMITTED_TO_MODERATION: "info",
  SELLER_DECLINED: "danger",
  WITHDRAWN: "neutral",
  // templates
  RETIRED: "neutral",
};

/** Plain words for inspectors (the backend codes stay unchanged). */
const LABELS: Record<string, string> = {
  PENDING: "Waiting",
  ASSIGNED: "To start",
  IN_PROGRESS: "In progress",
  COMPLETED: "Done",
  REINSPECTION_REQUIRED: "Re-inspect",
  NOT_APPLICABLE: "N/A",
  AWAITING_SELLER_DECISION: "Waiting for seller",
  READY_FOR_MODERATION: "Ready to submit",
  SUBMITTED_TO_MODERATION: "In moderation",
  SELLER_ACCEPTED: "Seller accepted",
  SELLER_DECLINED: "Seller declined",
};

/** Figma status pill: small dot + label. Tone is derived from the backend value. */
export function StatusBadge({ value, label }: { value: string | null | undefined; label?: string }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  const tone = TONES[value.toUpperCase().replace(/\s+/g, "_")] ?? "neutral";
  return (
    <Badge tone={tone} dot>
      {label ?? LABELS[value.toUpperCase()] ?? humanize(value)}
    </Badge>
  );
}
