import { useMyProfileQuery } from "@/features/account/queries";
import * as React from "react";
import { NavLink, useLocation, useNavigate } from "react-router";
import {
  CaretRightIcon,
  DotsThreeIcon,
  MagnifyingGlassIcon,
  SidebarSimpleIcon,
  SignOutIcon,
  ShieldCheckIcon,
  UserIcon,
} from "@phosphor-icons/react";
import { Tooltip } from "@/components/ui/misc";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils/cn";
import { useAccess } from "@/lib/auth/use-access";
import { useAuth } from "@/lib/auth/auth-context";
import {
  NAV_GROUPS,
  SHOW_UNAVAILABLE_MODULES,
  type NavGroup,
  type NavItem,
} from "@/app/router/nav";

export function isNavItemActive(pathname: string, item: NavItem): boolean {
  return item.to === "/"
    ? pathname === "/"
    : pathname === item.to || pathname.startsWith(`${item.to}/`);
}

export function useVisibleNav(): NavGroup[] {
  const { can } = useAccess();
  return React.useMemo(
    () =>
      NAV_GROUPS.map((g) => ({
        ...g,
        items: g.items.filter((i) =>
          i.unavailable ? SHOW_UNAVAILABLE_MODULES : can(i.permission),
        ),
      })).filter((g) => g.items.some((i) => !i.unavailable)),
    [can],
  );
}

function NavRow({
  item,
  active,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const base = cn(
    "flex h-[34px] w-full items-center gap-2 rounded-md px-3 text-sm transition-colors",
    collapsed && "justify-center px-0",
  );

  if (item.unavailable) {
    const row = (
      <span
        className={cn(base, "cursor-not-allowed text-muted-foreground/70")}
        aria-disabled="true"
      >
        <Icon className="size-5 shrink-0 opacity-60" aria-hidden />
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            <span className="rounded-sm bg-surface-muted px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Soon
            </span>
          </>
        )}
      </span>
    );
    return (
      <Tooltip
        content={`${item.label} — backend API not available yet`}
        side="right"
      >
        {row}
      </Tooltip>
    );
  }

  const link = (
    <NavLink
      to={item.to}
      end={item.to === "/"}
      onClick={onNavigate}
      aria-label={collapsed ? item.label : undefined}
      className={cn(
        base,
        "border",
        active
          ? "border-transparent bg-ink font-medium text-ink-foreground"
          : "border-transparent text-muted-foreground hover:bg-surface-muted hover:text-foreground",
      )}
    >
      <Icon
        className={cn("size-5 shrink-0", !active && "text-foreground")}
        weight={active ? "fill" : "regular"}
        aria-hidden
      />
      {!collapsed && (
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
      )}
      {!collapsed && active && (
        <CaretRightIcon className="size-4 shrink-0" aria-hidden />
      )}
    </NavLink>
  );
  return collapsed ? (
    <Tooltip content={item.label} side="right">
      {link}
    </Tooltip>
  ) : (
    link
  );
}

export function SidebarNav({
  collapsed,
  onToggleCollapsed,
  onNavigate,
  showCollapseToggle = true,
}: {
  collapsed: boolean;
  onToggleCollapsed?: () => void;
  onNavigate?: () => void;
  showCollapseToggle?: boolean;
}) {
  const groups = useVisibleNav();
  const { pathname } = useLocation();
  const [filter, setFilter] = React.useState("");
  const q = filter.trim().toLowerCase();

  const filtered = q
    ? groups
        .map((g) => ({
          ...g,
          items: g.items.filter((i) => i.label.toLowerCase().includes(q)),
        }))
        .filter((g) => g.items.length)
    : groups;

  return (
    <>
      <div
        className={cn(
          "flex items-center gap-2 px-5 pb-2 pt-4",
          collapsed && "flex-col px-3",
        )}
      >
        {!collapsed && (
          <div className="relative min-w-0 flex-1">
            <MagnifyingGlassIcon
              className="pointer-events-none absolute left-2.5 top-1/2 size-5 -translate-y-1/2 text-foreground"
              aria-hidden
            />
            <input
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search..."
              aria-label="Filter navigation"
              className="h-[38px] w-full rounded-md border border-border bg-surface pl-9 pr-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-action-border focus-visible:outline-none"
            />
          </div>
        )}
        {showCollapseToggle && onToggleCollapsed && (
          <Tooltip
            content={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            side="right"
          >
            <button
              type="button"
              onClick={onToggleCollapsed}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-md text-foreground hover:bg-surface-muted"
            >
              <SidebarSimpleIcon className="size-6" />
            </button>
          </Tooltip>
        )}
      </div>
      <nav
        aria-label="Main"
        className={cn(
          "flex-1 overflow-y-auto overflow-x-hidden pb-6 pt-2",
          collapsed ? "px-3" : "px-5",
        )}
      >
        {filtered.length === 0 && (
          <p className="px-1 py-2 text-sm text-muted-foreground">
            No matching pages.
          </p>
        )}
        <ul className="space-y-5">
          {filtered.map((group) => (
            <li key={group.id}>
              {collapsed ? (
                <div className="mx-2 mb-2 h-px bg-border" aria-hidden />
              ) : (
                <p className="p-1 text-xs leading-[14px] text-muted-foreground">
                  {group.label}
                </p>
              )}
              <ul className="mt-1 space-y-1.5">
                {group.items.map((item) => (
                  <li key={item.to}>
                    <NavRow
                      item={item}
                      active={isNavItemActive(pathname, item)}
                      collapsed={collapsed}
                      onNavigate={onNavigate}
                    />
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}

/** Figma sidebar footer: avatar, name, email and "more" menu. */
export function SidebarUser({ collapsed }: { collapsed: boolean }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const profile = useMyProfileQuery().data;
  const name =
    user?.displayName ||
    profile?.displayName ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    "Inspector";
  return (
    <div
      className={cn(
        "flex items-center gap-1 border-t border-border bg-surface py-4 pl-3 pr-5",
        collapsed && "justify-center px-0",
      )}
    >
      {!collapsed && (
        <div className="flex min-w-0 flex-1 items-center gap-1 px-2 py-1">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full">
            <UserIcon className="size-[26px] text-foreground" />
          </span>
          <div className="min-w-0 px-1">
            <p className="truncate text-sm text-foreground">{name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {user?.email}
            </p>
          </div>
        </div>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Account actions"
            className="flex size-8 cursor-pointer items-center justify-center rounded-md text-foreground hover:bg-surface-muted"
          >
            <DotsThreeIcon className="size-6" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="end">
          <DropdownMenuItem onSelect={() => navigate("/account")}>
            <UserIcon /> My profile
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => navigate("/account/security")}>
            <ShieldCheckIcon /> Security & sessions
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem tone="danger" onSelect={() => void signOut()}>
            <SignOutIcon /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
