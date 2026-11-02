import { cn } from "@/lib/utils/cn";
import { formatNumber } from "@/lib/utils/format";

export interface FilterPill {
  value: string;
  label: string;
  /** Shown as a small badge; omitted while unknown. */
  count?: number;
  /** Lime badge for states that need action (e.g. ready to publish, pending KYC). */
  highlight?: boolean;
}

/** One-tap status views above a list: a horizontally scrolling row of pills with optional counts. */
export function FilterPills({ items, value, onChange, label, className }: { items: FilterPill[]; value: string; onChange: (value: string) => void; label: string; className?: string }) {
  return (
    <div className={cn("-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1", className)} role="tablist" aria-label={label}>
      {items.map((p) => {
        const on = p.value === value;
        return (
          <button
            key={p.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(p.value)}
            className={cn(
              "inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
              on ? "border-foreground bg-foreground text-surface" : "border-border bg-surface text-foreground hover:border-foreground/40",
            )}
          >
            {p.label}
            {p.count !== undefined && p.count > 0 && (
              <span
                className={cn(
                  "min-w-5 rounded-full px-1.5 text-center text-xs leading-5",
                  p.highlight ? "bg-action text-action-foreground" : on ? "bg-surface/20 text-surface" : "bg-surface-muted text-muted-foreground",
                )}
              >
                {formatNumber(p.count)}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
