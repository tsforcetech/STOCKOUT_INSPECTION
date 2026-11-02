import type * as React from "react";
import { cn } from "@/lib/utils/cn";

/** Page heading: Space Grotesk caps eyebrow (secondary brand font) above a Geist H3 (32/40). */
export function PageHeader({ title, eyebrow, description, actions, className, children }: { title: React.ReactNode; eyebrow?: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; className?: string; children?: React.ReactNode }) {
  return (
    <div className={cn("mb-6 flex flex-col gap-4 px-0 sm:flex-row sm:items-end sm:justify-between sm:px-3", className)}>
      <div className="min-w-0">
        {eyebrow && <p className="text-eyebrow mb-1 font-display text-foreground">{eyebrow}</p>}
        <h1 className="font-heading text-[26px] font-bold leading-8 text-foreground sm:text-[32px] sm:leading-10">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        {children}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div>}
    </div>
  );
}

export function DetailList({ items, columns = 2 }: { items: Array<{ label: React.ReactNode; value: React.ReactNode; full?: boolean }>; columns?: 1 | 2 | 3 }) {
  const grid = { 1: "sm:grid-cols-1", 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 lg:grid-cols-3" }[columns];
  return (
    <dl className={cn("grid grid-cols-1 gap-x-6 gap-y-4", grid)}>
      {items.map((item, i) => (
        <div key={i} className={cn("min-w-0", item.full && "sm:col-span-full")}>
          <dt className="text-xs text-muted-foreground">{item.label}</dt>
          <dd className="mt-1 break-words text-sm text-foreground">{item.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
