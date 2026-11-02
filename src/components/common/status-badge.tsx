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

/** Figma status pill: small dot + label. Tone is derived from the backend value. */
export function StatusBadge({ value, label }: { value: string | null | undefined; label?: string }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  const tone = TONES[value.toUpperCase().replace(/\s+/g, "_")] ?? "neutral";
  return (
    <Badge tone={tone} dot>
      {label ?? humanize(value)}
    </Badge>
  );
}
