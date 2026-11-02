import { useMyProfileQuery } from "@/features/account/queries";
import * as React from "react";
import { Link, useMatches, useNavigate } from "react-router";
import {
  CaretDownIcon,
  CaretRightIcon,
  ListIcon,
  MagnifyingGlassIcon,
  MonitorIcon,
  MoonIcon,
  ShieldCheckIcon,
  SignOutIcon,
  SunIcon,
  UserIcon,
} from "@phosphor-icons/react";
import { Dialog as DialogPrimitive } from "radix-ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Logo } from "@/components/common/logo";
import { useAuth } from "@/lib/auth/auth-context";
import { useTheme } from "@/app/providers/theme";
import { cn } from "@/lib/utils/cn";
import { useVisibleNav } from "./sidebar";

export interface RouteHandle {
  crumb?:
    | string
    | ((data: unknown, params: Record<string, string | undefined>) => string);
}

export function useBreadcrumbs() {
  const matches = useMatches();
  return matches
    .filter((m) => (m.handle as RouteHandle | undefined)?.crumb)
    .map((m) => {
      const handle = m.handle as RouteHandle;
      const label =
        typeof handle.crumb === "function"
          ? handle.crumb(m.data, m.params)
          : handle.crumb!;
      return { label, to: m.pathname };
    });
}

export function Breadcrumbs({ className }: { className?: string }) {
  const crumbs = useBreadcrumbs();
  if (crumbs.length < 2) return null;
  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
        {crumbs.map((c, i) => (
          <li key={c.to + i} className="flex min-w-0 items-center gap-1">
            {i > 0 && (
              <CaretRightIcon className="size-3 shrink-0" aria-hidden />
            )}
            {i < crumbs.length - 1 ? (
              <Link to={c.to} className="truncate hover:text-foreground">
                {c.label}
              </Link>
            ) : (
              <span className="truncate text-foreground" aria-current="page">
                {c.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** ⌘K page switcher. Searches the console's own pages (there is no global data-search API). */
function CommandSearch() {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [index, setIndex] = React.useState(0);
  const groups = useVisibleNav();
  const navigate = useNavigate();

  const items = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return groups
      .flatMap((g) =>
        g.items
          .filter((i) => !i.unavailable)
          .map((i) => ({ ...i, group: g.label })),
      )
      .filter(
        (i) =>
          !q ||
          i.label.toLowerCase().includes(q) ||
          i.group.toLowerCase().includes(q),
      );
  }, [groups, query]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  React.useEffect(() => {
    setIndex(0);
  }, [query, open]);

  const go = (to: string) => {
    setOpen(false);
    setQuery("");
    navigate(to);
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <button
          type="button"
          className="hidden h-[38px] w-64 cursor-pointer items-center gap-2 rounded-md border border-border bg-surface-muted pl-2.5 pr-2 text-left text-sm text-muted-foreground transition-colors hover:border-secondary-border md:flex"
          aria-label="Search pages"
        >
          <MagnifyingGlassIcon className="size-5 text-foreground" />
          <span className="flex-1">Search...</span>
          <kbd className="rounded-sm bg-surface px-1.5 py-0.5 font-sans text-[11px] text-muted-foreground">
            ⌘ K
          </kbd>
        </button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <DialogPrimitive.Content className="fixed left-1/2 top-[12vh] z-50 w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 overflow-hidden rounded-lg bg-surface shadow-raised focus:outline-none">
          <DialogPrimitive.Title className="sr-only">
            Search pages
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Type to filter portal pages, use arrow keys and Enter to open.
          </DialogPrimitive.Description>
          <div className="flex items-center gap-2 border-b border-border px-4">
            <MagnifyingGlassIcon className="size-5 text-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setIndex((i) => Math.min(items.length - 1, i + 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setIndex((i) => Math.max(0, i - 1));
                } else if (e.key === "Enter" && items[index]) {
                  go(items[index].to);
                }
              }}
              placeholder="Jump to a page…"
              className="h-12 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              role="combobox"
              aria-expanded="true"
              aria-controls="command-results"
            />
          </div>
          <ul
            id="command-results"
            role="listbox"
            className="max-h-80 overflow-y-auto p-2"
          >
            {items.length === 0 && (
              <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                No pages match “{query}”.
              </li>
            )}
            {items.map((item, i) => (
              <li key={item.to} role="option" aria-selected={i === index}>
                <button
                  type="button"
                  onMouseEnter={() => setIndex(i)}
                  onClick={() => go(item.to)}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-left text-sm",
                    i === index
                      ? "bg-action text-action-foreground"
                      : "text-action-foreground",
                  )}
                >
                  <item.icon className="size-5" />
                  <span className="flex-1">{item.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {item.group}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function TopBar({ onOpenMobileNav }: { onOpenMobileNav: () => void }) {
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const profile = useMyProfileQuery().data;
  const name =
    user?.displayName ||
    profile?.displayName ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.email ||
    "Account";

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b border-border bg-surface px-3 sm:gap-3 sm:px-6 md:border-b-0 lg:h-[71px] lg:pl-8">
      <button
        type="button"
        className="flex size-10 cursor-pointer items-center justify-center rounded-md hover:bg-surface-muted md:hidden"
        onClick={onOpenMobileNav}
        aria-label="Open navigation"
      >
        <ListIcon className="size-6" />
      </button>
      <Link
        to="/"
        className="flex items-center rounded-md"
        aria-label="StockOut inspection home"
      >
        <Logo className="h-6 sm:h-7" />
      </Link>
      <span className="rounded-full bg-ink px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-ink-foreground">Inspection</span>
      <div className="flex-1" />
      <CommandSearch />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex h-[38px] cursor-pointer items-center gap-1 rounded-full pl-1.5 pr-2 transition-colors hover:bg-surface-muted"
            aria-label="Account menu"
          >
            <UserIcon className="size-[26px] text-foreground" />
            <CaretDownIcon className="size-4 text-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-60">
          <DropdownMenuLabel className="font-normal">
            <div className="truncate text-sm text-foreground">{name}</div>
            {user?.email && (
              <div className="truncate text-xs text-muted-foreground">
                {user.email}
              </div>
            )}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => navigate("/account")}>
            <UserIcon /> My profile
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => navigate("/account/security")}>
            <ShieldCheckIcon /> Security & sessions
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Theme</DropdownMenuLabel>
          {(
            [
              ["light", "Light", SunIcon],
              ["dark", "Dark", MoonIcon],
              ["system", "System", MonitorIcon],
            ] as const
          ).map(([value, label, Icon]) => (
            <DropdownMenuItem
              key={value}
              onSelect={() => setTheme(value)}
              role="menuitemradio"
              aria-checked={theme === value}
            >
              <Icon /> {label}
              {theme === value && (
                <span
                  className="ml-auto size-2 rounded-full bg-action-border"
                  aria-hidden
                />
              )}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem tone="danger" onSelect={() => void signOut()}>
            <SignOutIcon /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
