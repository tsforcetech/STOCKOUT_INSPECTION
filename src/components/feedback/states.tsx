import type * as React from "react";
import { WarningIcon, FileXIcon, TrayIcon, LockIcon, ArrowClockwiseIcon, CloudXIcon, WifiSlashIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { cn } from "@/lib/utils/cn";
import { getErrorMessage, isApiError } from "@/lib/api/errors";

function StateFrame({ icon, title, description, action, className, tone = "neutral" }: { icon: React.ReactNode; title: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode; className?: string; tone?: "neutral" | "danger" }) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)} role={tone === "danger" ? "alert" : undefined}>
      <div className={cn("mb-4 flex size-14 items-center justify-center rounded-lg [&_svg]:size-7", tone === "danger" ? "bg-danger-soft text-danger-soft-foreground" : "bg-action-soft text-foreground ring-1 ring-action-border/30")}>
        {icon}
      </div>
      <h3 className="font-heading text-lg font-bold text-foreground">{title}</h3>
      {description && <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

export function EmptyState({ title = "Nothing here yet", description, action, icon, className }: { title?: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode; icon?: React.ReactNode; className?: string }) {
  return <StateFrame icon={icon ?? <TrayIcon />} title={title} description={description} action={action} className={className} />;
}

export function ErrorState({ error, onRetry, title, className }: { error: unknown; onRetry?: () => void; title?: string; className?: string }) {
  if (isApiError(error) && error.kind === "forbidden") return <PermissionDenied className={className} />;
  const icon = isApiError(error) && (error.kind === "network" || error.kind === "timeout") ? <WifiSlashIcon /> : isApiError(error) && (error.kind === "server" || error.kind === "unavailable") ? <CloudXIcon /> : isApiError(error) && error.kind === "not_found" ? <FileXIcon /> : <WarningIcon />;
  const heading = title ?? (isApiError(error) && error.kind === "not_found" ? "Record not found" : "Couldn't load this data");
  return (
    <StateFrame
      tone="danger"
      icon={icon}
      title={heading}
      description={
        <>
          {getErrorMessage(error)}
          {isApiError(error) && error.requestId && <span className="mt-1 block font-mono text-xs opacity-70">Ref: {error.requestId}</span>}
        </>
      }
      action={
        onRetry && (
          <Button variant="secondary" onClick={onRetry}>
            <ArrowClockwiseIcon /> Try again
          </Button>
        )
      }
      className={className}
    />
  );
}

export function PermissionDenied({ className, description }: { className?: string; description?: string }) {
  return (
    <StateFrame
      icon={<LockIcon />}
      title="You don't have access"
      description={description ?? "Your account doesn't have the permission required for this page. Contact a platform administrator if you need access."}
      className={className}
    />
  );
}

/** Shown for features that are routed by the gateway but whose backend endpoints don't exist yet. */
export function BackendPendingState({ feature, routes }: { feature: string; routes: string[] }) {
  return (
    <StateFrame
      icon={<CloudXIcon />}
      title={`${feature} isn't available yet`}
      description={
        <>
          The backend has not implemented these APIs yet, so this screen has no data source. It will be enabled when
          the endpoints ship:
          <span className="mt-2 block font-mono text-xs">{routes.join(" · ")}</span>
        </>
      }
    />
  );
}

export function TableSkeleton({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="divide-y divide-border" aria-label="Loading" role="status">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-4 py-3.5">
          {Array.from({ length: columns }).map((__, c) => (
            <Skeleton key={c} className={cn("h-4", c === 0 ? "w-1/4" : "flex-1")} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading page">
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <Skeleton className="h-72 w-full rounded-xl" />
    </div>
  );
}
