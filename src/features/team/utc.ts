import { formatDate, formatDateTime } from "@/lib/utils/format";

/**
 * Backend DateTimes read from SQL are UTC but serialized WITHOUT a "Z" (Kind=Unspecified), which
 * `new Date()` would treat as local time. Append "Z" when no offset is present.
 */
export function asUtc(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.startsWith("0001-01-01")) return null;
  return /([zZ]|[+-]\d\d:?\d\d)$/.test(value) || !value.includes("T") ? value : `${value}Z`;
}

export const formatUtcDateTime = (value: string | null | undefined, fallback = "—") => formatDateTime(asUtc(value), fallback);
export const formatUtcDate = (value: string | null | undefined, fallback = "—") => formatDate(asUtc(value), fallback);
