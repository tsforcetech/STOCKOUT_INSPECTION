import type * as React from "react";
import { Skeleton } from "@/components/ui/misc";
import { cn } from "@/lib/utils/cn";

export interface StatItem {
  label: string;
  value: React.ReactNode;
  /** Secondary line under the value. Must describe real data — never a fabricated trend. */
  hint?: React.ReactNode;
  hintTone?: "muted" | "success" | "danger";
  icon?: React.ReactNode;
  loading?: boolean;
  /** Shown instead of the value when this metric failed to load or is not permitted. */
  unavailable?: string;
}

/** Figma "Stats cards": white 24px container with grey 16px cards (title + icon, H3 value, sub line). */
export function StatCards({ items, className }: { items: StatItem[]; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-2 rounded-xl bg-surface p-2 xl:grid-cols-4", className)}>
      {items.map((item) => (
        <div key={item.label} className="flex min-w-0 flex-col gap-2 rounded-lg border border-border bg-surface-muted p-3 sm:gap-3 sm:p-4">
          <div className="flex items-start gap-2">
            <p className="line-clamp-2 min-w-0 flex-1 text-sm leading-5 text-foreground">{item.label}</p>
            {item.icon && <span className="shrink-0 text-foreground [&_svg]:size-5">{item.icon}</span>}
          </div>
          <div className="flex flex-col gap-1">
            {item.loading ? (
              <Skeleton className="h-8 w-20 sm:h-10 sm:w-24" />
            ) : item.unavailable ? (
              <p className="font-heading text-[26px] font-bold leading-8 text-muted-foreground sm:text-[32px] sm:leading-10" title={item.unavailable}>
                —
              </p>
            ) : (
              <p className="truncate font-heading text-[26px] font-bold leading-8 text-foreground sm:text-[32px] sm:leading-10">{item.value}</p>
            )}
            <p
              className={cn(
                "line-clamp-2 text-sm",
                item.unavailable ? "text-muted-foreground" : item.hintTone === "success" ? "text-success" : item.hintTone === "danger" ? "text-danger" : "text-muted-foreground",
              )}
            >
              {item.unavailable ?? item.hint ?? " "}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
