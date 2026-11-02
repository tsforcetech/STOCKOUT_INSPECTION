import { NavLink } from "react-router";
import { cn } from "@/lib/utils/cn";

export function AccountTabs() {
  const tabs = [
    { to: "/account", label: "Profile", end: true },
    { to: "/account/security", label: "Security", end: false },
  ];
  return (
    <nav aria-label="Account sections" className="mb-4 flex gap-2 overflow-x-auto border-b border-border px-0 sm:px-3">
      {tabs.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.end}
          className={({ isActive }) =>
            cn("-mb-px whitespace-nowrap border-b-2 border-transparent px-2 pb-2 pt-1 text-sm text-foreground transition-colors hover:text-muted-foreground", isActive && "border-action-border font-medium")
          }
        >
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
