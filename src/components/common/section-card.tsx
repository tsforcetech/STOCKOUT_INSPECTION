import type * as React from "react";
import { ArrowsClockwiseIcon } from "@phosphor-icons/react";
import { Tooltip } from "@/components/ui/misc";
import { cn } from "@/lib/utils/cn";

/** Figma main content card: white, 24px radius, 24px padding. */
export function SectionCard({ className, children }: { className?: string; children: React.ReactNode }) {
  return <section className={cn("min-w-0 rounded-xl bg-surface p-4 sm:p-6", className)}>{children}</section>;
}

/** On phones, dropdown filters in a toolbar share the row evenly instead of keeping their fixed desktop widths. */
const COMBOBOX_GROW = "[&>[role=combobox]]:max-sm:w-auto! [&>[role=combobox]]:max-sm:min-w-36 [&>[role=combobox]]:max-sm:flex-1";

/** Toolbar row above a table: search on the left, filters/actions on the right. */
export function Toolbar({ left, right, className }: { left?: React.ReactNode; right?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className={cn("flex min-w-0 flex-1 flex-wrap items-center gap-2", COMBOBOX_GROW)}>{left}</div>
      {right && <div className={cn("flex flex-wrap items-center gap-2", COMBOBOX_GROW)}>{right}</div>}
    </div>
  );
}

/** Figma refresh icon button (square, bordered). */
export function RefreshButton({ onClick, spinning, label = "Refresh" }: { onClick: () => void; spinning?: boolean; label?: string }) {
  return (
    <Tooltip content={label}>
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className="flex size-[38px] cursor-pointer items-center justify-center rounded-md border border-secondary-border bg-surface text-foreground transition-colors hover:bg-surface-muted"
      >
        <ArrowsClockwiseIcon className={cn("size-[18px]", spinning && "animate-spin")} />
      </button>
    </Tooltip>
  );
}

/** Figma row action: 28px bordered square icon button with tooltip. */
export function RowAction({ label, onClick, children, tone, disabled }: { label: string; onClick: () => void; children: React.ReactNode; tone?: "danger" | "success"; disabled?: boolean }) {
  return (
    <Tooltip content={label}>
      <button
        type="button"
        aria-label={label}
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        className={cn(
          "flex size-7 cursor-pointer items-center justify-center rounded-sm border border-secondary-border bg-surface text-foreground transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-40 [&_svg]:size-4",
          tone === "danger" && "hover:border-danger hover:bg-danger-soft hover:text-danger",
          tone === "success" && "hover:border-action-border hover:bg-action hover:text-action-foreground",
        )}
      >
        {children}
      </button>
    </Tooltip>
  );
}

/** Figma bulk-action bar ("2 Selected of 5 Items" + lime buttons). */
export function BulkBar({ count, total, children, onClear }: { count: number; total: number; children: React.ReactNode; onClear: () => void }) {
  if (count === 0) return null;
  return (
    <div className="mb-4 flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between" role="region" aria-label="Bulk actions">
      <p className="text-sm text-foreground">
        {count} Selected of {total} Items
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {children}
        <button type="button" onClick={onClear} className="h-8 cursor-pointer rounded-sm border border-secondary-border bg-surface px-3 text-sm text-foreground hover:bg-surface-muted">
          Cancel
        </button>
      </div>
    </div>
  );
}

export function BulkButton({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="h-8 cursor-pointer rounded-sm border border-transparent bg-ink px-3 text-sm text-ink-foreground transition-colors hover:bg-ink-hover disabled:cursor-not-allowed disabled:opacity-50">
      {children}
    </button>
  );
}
