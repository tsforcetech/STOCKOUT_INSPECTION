import { NavLink, useLocation } from "react-router";
import { cn } from "@/lib/utils/cn";
import { isNavItemActive, useVisibleNav } from "./sidebar";

/** Phone navigation: a thumb-reachable tab bar fixed to the bottom of the screen (hidden from md up). */
export function BottomTabs() {
  const { pathname } = useLocation();
  const tabs = useVisibleNav()
    .flatMap((g) => g.items)
    .filter((i) => i.tab);
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="mx-auto grid max-w-lg" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
        {tabs.map((item) => {
          const active = isNavItemActive(pathname, item);
          const Icon = item.icon;
          return (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === "/"}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span className={cn("flex h-7 w-12 items-center justify-center rounded-full", active && "bg-ink text-ink-foreground")}>
                  <Icon className="size-5" weight={active ? "fill" : "regular"} aria-hidden />
                </span>
                <span className="max-w-full truncate px-1">{item.short ?? item.label}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
