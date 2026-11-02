import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { InfoIcon, WarningIcon } from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { filesService } from "@/services/files.service";
import { useAccess } from "@/lib/auth/use-access";
import { isApiError } from "@/lib/api/errors";
import { cn } from "@/lib/utils/cn";
import { formatDate, formatDateTime } from "@/lib/utils/format";
import { platformService } from "@/services/platform.service";
import { sellersService } from "@/services/sellers.service";
import { PERMISSIONS as P } from "@/api/types/user-organization";

/* ------------------------------------------------------------------------------------------------
 * Dates. catalog-listing writes DB timestamps WITHOUT an offset (e.g. "2026-10-17T08:30:12.1234567")
 * but they are UTC. Normalise before formatting so they are not read as local time.
 * ---------------------------------------------------------------------------------------------- */
export function asUtc(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.replace(/(\.\d{3})\d+/, "$1");
  return /([zZ]|[+-]\d{2}:?\d{2})$/.test(trimmed) ? trimmed : `${trimmed}Z`;
}

export const fmtUtc = (value: string | null | undefined) => formatDateTime(asUtc(value));
export const fmtUtcDate = (value: string | null | undefined) => formatDate(asUtc(value));

/** "2 h", "3 d" since a UTC timestamp. Display only. */
export function ageSince(value: string | null | undefined): string {
  const iso = asUtc(value);
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} h`;
  return `${Math.floor(hours / 24)} d`;
}

/** `<input type="date">` value → UTC ISO bound for the API (start or end of that day). */
/**
 * The queue procs compare the upper bound inclusively (`i.CreatedAtUtc <= @DateTo`,
 * catalog-listing 034_Stage5E_InspectionProcedures.sql:268; `v.UpdatedAtUtc <= @SubmittedToUtc`,
 * 036_Stage5F_ModerationPublicationProcedures.sql:637), so the end of the day must cover the whole
 * final second; "T23:59:59Z" silently dropped rows stamped 23:59:59.xxx.
 */
export const END_OF_DAY_UTC = "T23:59:59.9999999Z";

export function dateInputToUtc(value: string, bound: "start" | "end"): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  return bound === "start" ? `${value}T00:00:00Z` : `${value}${END_OF_DAY_UTC}`;
}

export const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isGuid = (value: string | null | undefined): value is string => Boolean(value && GUID_RE.test(value.trim()));
export const shortId = (value: string | null | undefined) => (value ? value.slice(0, 8).toUpperCase() : "—");

/* ------------------------------------------------------------------------------------------------
 * Backend error explanations (beyond the generic message already in ApiError).
 * ---------------------------------------------------------------------------------------------- */
const HINTS: Record<string, string> = {
  MARKETPLACE_LISTING_VERSION_CONFLICT: "The listing changed since this page loaded. The latest data has been reloaded; review it and try again.",
  MARKETPLACE_INSPECTION_VERSION_CONFLICT: "The inspection changed since this page loaded. The latest data has been reloaded; review it and try again.",
  MARKETPLACE_LISTING_NOT_READY_FOR_PUBLICATION:
    "The listing failed a publication gate. Known backend defect: the media gate validates the primary image against the seller organisation id instead of the uploading user, so publish/republish/rollback is likely to fail with this error until the backend is fixed.",
  MARKETPLACE_LISTING_INSPECTION_NOT_PASSED: "This category requires a PASS inspection for this version before it can be published.",
  MARKETPLACE_LISTING_TRANSITION_INVALID: "The listing or version is not in a state that allows this action. The page has been refreshed.",
  MARKETPLACE_LISTING_NOT_PUBLISHED: "The listing is not currently published.",
  MARKETPLACE_MODERATION_REASON_REQUIRED: "A reason code is required for this decision (and internal notes when waiving an inspection).",
  MARKETPLACE_MODERATION_ACCESS_DENIED: "Waiving a required inspection needs the inspections.override permission.",
  MARKETPLACE_INSPECTION_TEMPLATE_NOT_FOUND: "No active inspection checklist template exists for this category (or a global default). Create or activate one under Catalog → Inspection templates.",
  MARKETPLACE_INSPECTION_ALREADY_ACTIVE: "An inspection is already pending, assigned or in progress for this listing version.",
  MARKETPLACE_INSPECTION_CHECKLIST_INCOMPLETE:
    "Every required checklist item needs a result. Known backend defect: saving responses returns 200 but stores nothing, so inspections whose template has required items cannot be completed until the backend is fixed.",
  MARKETPLACE_INSPECTION_ACCESS_DENIED: "The selected user does not hold the inspections.perform permission, or you are not allowed to act on this inspection.",
  MARKETPLACE_INSPECTOR_NOT_ASSIGNED: "Only the assigned inspector (or a user with inspections.override) can perform this action.",
  MARKETPLACE_INSPECTION_ASSIGNMENT_REQUIRED: "Assign an inspector before starting the inspection.",
  MARKETPLACE_INSPECTION_EVIDENCE_REQUIRED: "Items that require evidence need at least one attached evidence file before the inspection can pass.",
  MARKETPLACE_INSPECTION_CANNOT_PASS_FAILED_ITEMS: "A required item is marked FAIL, so the inspection cannot be completed as PASS.",
  MARKETPLACE_INSPECTION_FAILURE_DETAILS_REQUIRED: "FAIL and REINSPECTION_REQUIRED need a failure reason code and failure notes of at least 10 characters.",
  MARKETPLACE_INSPECTION_REQUEST_INVALID: "The request was rejected. For evidence, the file must be uploaded by you with purpose INSPECTION_EVIDENCE and be AVAILABLE.",
  MARKETPLACE_INSPECTION_REINSPECTION_INVALID: "Re-inspection can only be authorised for a COMPLETED inspection with result FAIL or REINSPECTION_REQUIRED.",
  MARKETPLACE_INSPECTION_LISTING_VERSION_MISMATCH: "That version does not belong to the listing.",
};

export function errorHint(error: unknown): string | null {
  return isApiError(error) && error.code ? (HINTS[error.code] ?? null) : null;
}

export const isConflict = (error: unknown) => isApiError(error) && (error.code?.endsWith("_VERSION_CONFLICT") ?? false);

/* ------------------------------------------------------------------------------------------------
 * UI bits
 * ---------------------------------------------------------------------------------------------- */
export function Notice({ tone = "info", title, children, className }: { tone?: "info" | "warning" | "danger"; title?: React.ReactNode; children: React.ReactNode; className?: string }) {
  const styles = {
    info: "border-border bg-surface-muted text-foreground",
    warning: "border-warning/40 bg-warning-soft text-warning-soft-foreground",
    danger: "border-danger/30 bg-danger-soft text-danger-soft-foreground",
  }[tone];
  return (
    <div role={tone === "danger" ? "alert" : "note"} className={cn("flex gap-2.5 rounded-md border px-3 py-2.5 text-sm [overflow-wrap:anywhere]", styles, className)}>
      {tone === "info" ? <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden /> : <WarningIcon className="mt-0.5 size-4 shrink-0" aria-hidden />}
      <div className="min-w-0 space-y-1">
        {title && <p className="font-medium">{title}</p>}
        <div>{children}</div>
      </div>
    </div>
  );
}

/** Error message + contract-specific hint, shown inline in forms and panels. */
export function ApiErrorNotice({ error, className }: { error: unknown; className?: string }) {
  if (!error) return null;
  const message = isApiError(error) || error instanceof Error ? error.message : "Something went wrong.";
  const hint = errorHint(error);
  return (
    <Notice tone="danger" className={className} title={message}>
      {hint ?? (isApiError(error) && error.code ? <span className="font-mono text-xs">{error.code}</span> : null)}
    </Notice>
  );
}

export function PanelTitle({ title, description, actions }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1 basis-56">
        <h2 className="font-heading text-lg font-bold text-foreground">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Text input for a GUID filter. Only commits a valid GUID (or empty) to avoid server 400s. */
export function GuidFilterInput({ value, onChange, label, placeholder, className }: { value: string; onChange: (value: string) => void; label: string; placeholder: string; className?: string }) {
  const [draft, setDraft] = React.useState(value);
  React.useEffect(() => {
    setDraft(value);
  }, [value]);
  const invalid = draft.trim() !== "" && !isGuid(draft);
  const commit = () => {
    const v = draft.trim();
    if (v === "" || isGuid(v)) onChange(v.toLowerCase());
  };
  return (
    <Input
      className={cn("h-[38px] w-full font-mono text-xs placeholder:font-sans placeholder:text-sm sm:w-[300px]", className)}
      value={draft}
      aria-label={label}
      title={invalid ? "Enter a full GUID" : label}
      aria-invalid={invalid || undefined}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
      }}
    />
  );
}

/* ------------------------------------------------------------------------------------------------
 * Name lookups (best effort; only when the viewer may read those lists).
 * ---------------------------------------------------------------------------------------------- */
export function useSellerNames(): Map<string, string> {
  const { can } = useAccess();
  const query = useQuery({ queryKey: ["sellers"], queryFn: ({ signal }) => sellersService.list(signal), enabled: can(P.SELLERS_VIEW), staleTime: 5 * 60_000 });
  return React.useMemo(() => new Map((query.data ?? []).map((s) => [s.sellerId.toLowerCase(), s.displayName || "Unnamed seller"])), [query.data]);
}

export const platformUsersKey = ["platform", "users"] as const;

export function usePlatformUsers() {
  const { can } = useAccess();
  const enabled = can(P.PLATFORM_USERS_VIEW);
  const query = useQuery({ queryKey: platformUsersKey, queryFn: ({ signal }) => platformService.users(signal), enabled, staleTime: 5 * 60_000 });
  return { ...query, enabled };
}

export function useUserNames(): Map<string, string> {
  const { data } = usePlatformUsers();
  return React.useMemo(() => new Map((data ?? []).map((u) => [u.userId.toLowerCase(), u.displayName || u.email || shortId(u.userId)])), [data]);
}

/** Shows a name when known, otherwise the id (with copy). */
export function PersonText({ id, names }: { id: string | null | undefined; names: Map<string, string> }) {
  if (!id) return <span className="text-muted-foreground">—</span>;
  const name = names.get(id.toLowerCase());
  return (
    <span className="inline-flex flex-col">
      {name && <span>{name}</span>}
      <span className="font-mono text-xs text-muted-foreground" title={id}>
        {shortId(id)}
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------------------------------------
 * File links. inventory-media files are owner-scoped: an admin can only get a download URL for a
 * file they uploaded, so 403/404 is an expected outcome and is explained inline.
 * ---------------------------------------------------------------------------------------------- */
/** True while a presigned URL is still usable (with a minute of margin). Unknown expiry counts as usable. */
export function urlFresh(url: string | null | undefined, expiresAtUtc: string | null | undefined): url is string {
  if (!url) return false;
  if (!expiresAtUtc) return true;
  const t = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(expiresAtUtc) ? expiresAtUtc : `${expiresAtUtc}Z`);
  return Number.isNaN(t) || t - Date.now() > 60_000;
}

/**
 * Opens a reviewer file through a short-lived presigned URL (F2-E). Uses the URL the list already returned while it
 * is fresh, otherwise asks `refresh` for a new one. The tab opens synchronously so pop-up blockers allow it.
 */
export function SignedFileLink({
  url,
  expiresAtUtc,
  refresh,
  label = "Open",
}: {
  url: string | null | undefined;
  expiresAtUtc?: string | null;
  refresh: () => Promise<{ downloadUrl: string | null }>;
  label?: string;
}) {
  const [state, setState] = React.useState<{ status: "idle" | "loading" | "denied" | "missing" | "error"; message?: string }>({ status: "idle" });
  const open = async () => {
    if (urlFresh(url, expiresAtUtc)) {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    const tab = window.open("", "_blank");
    setState({ status: "loading" });
    try {
      const res = await refresh();
      if (!res.downloadUrl) throw new Error("No download link was returned.");
      if (tab) {
        tab.opener = null;
        tab.location.href = res.downloadUrl;
      } else window.open(res.downloadUrl, "_blank", "noopener,noreferrer");
      setState({ status: "idle" });
    } catch (error) {
      tab?.close();
      if (isApiError(error) && error.status === 403) setState({ status: "denied" });
      else if (isApiError(error) && error.status === 404) setState({ status: "missing" });
      else setState({ status: "error", message: isApiError(error) || error instanceof Error ? error.message : "Could not get a download link." });
    }
  };
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button variant="link" size="sm" onClick={() => void open()} loading={state.status === "loading"}>
        {label}
      </Button>
      {state.status === "denied" && <span className="text-xs text-muted-foreground">You don&apos;t have access to this file.</span>}
      {state.status === "missing" && <span className="text-xs text-muted-foreground">File not found (deleted or not uploaded yet).</span>}
      {state.status === "error" && <span className="text-xs text-danger-soft-foreground">{state.message}</span>}
    </span>
  );
}

export function FileLink({ fileId, presignedUrl, label = "Open" }: { fileId: string; presignedUrl?: string | null; label?: string }) {
  const [state, setState] = React.useState<{ status: "idle" | "loading" | "denied" | "missing" | "error"; message?: string }>({ status: "idle" });
  if (presignedUrl) {
    return (
      <a href={presignedUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-foreground underline underline-offset-4 hover:text-muted-foreground">
        {label}
      </a>
    );
  }
  const open = async () => {
    setState({ status: "loading" });
    try {
      const res = await filesService.downloadUrl(fileId);
      if (!res.downloadUrl) {
        setState({ status: "error", message: "No download URL was returned." });
        return;
      }
      window.open(res.downloadUrl, "_blank", "noopener,noreferrer");
      setState({ status: "idle" });
    } catch (error) {
      if (isApiError(error) && error.status === 403) setState({ status: "denied" });
      else if (isApiError(error) && error.status === 404) setState({ status: "missing" });
      else setState({ status: "error", message: isApiError(error) ? error.message : "Could not get a download link." });
    }
  };
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button variant="link" size="sm" onClick={open} loading={state.status === "loading"}>
        {label}
      </Button>
      {state.status === "denied" && <span className="text-xs text-muted-foreground">Not downloadable: files are owner-scoped and you did not upload this one.</span>}
      {state.status === "missing" && <span className="text-xs text-muted-foreground">File not found (deleted or not yet available).</span>}
      {state.status === "error" && <span className="text-xs text-danger-soft-foreground">{state.message}</span>}
    </span>
  );
}
