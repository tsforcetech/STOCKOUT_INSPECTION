import type * as React from "react";
import { CubeIcon } from "@phosphor-icons/react";

/** Figma table "Item" cell: icon tile + primary name + secondary code line. */
export function EntityCell({ title, subtitle, icon }: { title: React.ReactNode; subtitle?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-surface-muted text-foreground [&_svg]:size-5">{icon ?? <CubeIcon />}</span>
      <div className="min-w-0">
        <div className="max-w-[320px] truncate text-sm text-foreground">{title}</div>
        {subtitle && <div className="max-w-[320px] truncate text-xs text-muted-foreground">{subtitle}</div>}
      </div>
    </div>
  );
}
