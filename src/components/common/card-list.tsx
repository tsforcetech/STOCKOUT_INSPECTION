import type * as React from "react";
import { Link } from "react-router";
import { ArrowRightIcon, CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/feedback/states";

export interface CardRow {
  id: string;
  to: string;
  title: React.ReactNode;
  badge?: React.ReactNode;
  lines: React.ReactNode[];
}

/** Phone replacement for a wide table: one tappable card per row, with simple Prev/Next paging. */
export function CardList({
  rows,
  isLoading,
  error,
  onRetry,
  emptyTitle,
  emptyDescription,
  page,
  pageSize,
  totalCount,
  onPageChange,
  label,
}: {
  rows: CardRow[];
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  emptyTitle: string;
  emptyDescription?: React.ReactNode;
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  label: string;
}) {
  if (error) return <ErrorState error={error} onRetry={onRetry} />;
  if (isLoading)
    return (
      <ul className="space-y-2" aria-busy="true" aria-label={`Loading ${label}`}>
        {[0, 1, 2].map((k) => (
          <li key={k} className="h-[84px] animate-pulse rounded-lg border border-border bg-surface" />
        ))}
      </ul>
    );
  if (!rows.length) return <EmptyState title={emptyTitle} description={emptyDescription} />;
  const pages = Math.max(1, Math.ceil(totalCount / pageSize));
  return (
    <div>
      <ul className="space-y-2" aria-label={label}>
        {rows.map((r) => (
          <li key={r.id}>
            <Link to={r.to} className="flex items-start gap-3 rounded-lg border border-border bg-surface p-3.5 transition-colors hover:border-secondary-border">
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-foreground">{r.title}</span>
                  {r.badge}
                </span>
                {r.lines.map((l, n) => (
                  <span key={n} className={n === 0 ? "mt-1 block truncate text-sm font-medium text-foreground" : "mt-0.5 block truncate text-xs text-muted-foreground"}>
                    {l}
                  </span>
                ))}
              </span>
              <ArrowRightIcon className="mt-3 size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
      {pages > 1 && (
        <div className="mt-3 flex items-center justify-between gap-2 text-sm">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            <CaretLeftIcon /> Prev
          </Button>
          <span className="text-muted-foreground">
            Page {page} of {pages}
          </span>
          <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => onPageChange(page + 1)}>
            Next <CaretRightIcon />
          </Button>
        </div>
      )}
    </div>
  );
}

/** "Filters" toggle for phones; on larger screens the filters are always shown. */
export function MoreFilters({ isPhone, open, onToggle, active }: { isPhone: boolean; open: boolean; onToggle: () => void; active: boolean }) {
  if (!isPhone) return null;
  return (
    <Button variant="ghost" size="sm" className="-mt-1 mb-2" aria-expanded={open} onClick={onToggle}>
      {open ? "Hide filters" : active ? "Filters (on)" : "More filters"}
    </Button>
  );
}
