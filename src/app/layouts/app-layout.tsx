import * as React from "react";
import { Outlet, useLocation, useNavigation } from "react-router";
import { LockIcon, SignOutIcon } from "@phosphor-icons/react";
import { Dialog, SheetContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/components/feedback/error-boundary";
import { PageSkeleton } from "@/components/feedback/states";
import { Logo } from "@/components/common/logo";
import { cn } from "@/lib/utils/cn";
import { useAccess } from "@/lib/auth/use-access";
import { useAuth } from "@/lib/auth/auth-context";
import { useMediaQuery } from "@/hooks/use-media-query";
import { INSPECTOR_ACCESS } from "@/app/router/nav";
import { SidebarNav, SidebarUser } from "./sidebar";
import { Breadcrumbs, TopBar } from "./header";
import { BottomTabs } from "./bottom-tabs";

const COLLAPSE_KEY = "stockout.inspection.sidebar.collapsed";

/** Signed in, but the account has no inspection permission: this portal is for inspection staff only. */
export function InspectorAccessOnly() {
  const { user, signOut } = useAuth();
  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface-muted p-6" role="alert">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-8 text-center shadow-sm">
        <Logo className="mx-auto" />
        <div className="mx-auto mt-6 flex size-14 items-center justify-center rounded-lg bg-warning-soft text-warning-soft-foreground">
          <LockIcon className="size-7" />
        </div>
        <h1 className="mt-4 font-heading text-2xl font-bold">Inspector access only</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {user?.email ? <><span className="font-medium text-foreground">{user.email}</span> doesn&apos;t</> : "This account doesn't"} have an
          inspection role. Ask a platform administrator to grant inspection access, or sign in with your inspector account.
        </p>
        <Button className="mt-6 w-full" variant="secondary" onClick={() => void signOut()}>
          <SignOutIcon /> Sign out
        </Button>
      </div>
    </div>
  );
}

/**
 * Responsive shell. Phones: top bar + bottom tab bar. Tablets: icon rail. Desktops: full sidebar (collapsible).
 */
export function AppLayout() {
  const { can } = useAccess();
  const [collapsedPref, setCollapsedPref] = React.useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const collapsed = !isDesktop || collapsedPref;
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const location = useLocation();
  const navigation = useNavigation();
  const mainRef = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    mainRef.current?.scrollTo?.({ top: 0 });
    document.documentElement.scrollTop = 0;
  }, [location.pathname]);

  const toggleCollapsed = () =>
    setCollapsedPref((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
      } catch {
        /* ignore */
      }
      return !c;
    });

  if (!can(INSPECTOR_ACCESS)) return <InspectorAccessOnly />;

  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-action focus:px-3 focus:py-2 focus:text-action-foreground"
      >
        Skip to content
      </a>
      <TopBar onOpenMobileNav={() => setMobileOpen(true)} />
      {navigation.state === "loading" && (
        <div className="fixed inset-x-0 top-0 z-50 h-0.5 animate-pulse bg-action-border" role="progressbar" aria-label="Loading page" />
      )}

      <div className="flex min-h-0 flex-1">
        <aside
          className={cn(
            "sticky top-[64px] hidden h-[calc(100dvh-64px)] shrink-0 flex-col bg-sidebar transition-[width] duration-200 md:flex lg:top-[71px] lg:h-[calc(100dvh-71px)]",
            collapsed ? "w-[76px]" : "w-[262px]",
          )}
        >
          <SidebarNav collapsed={collapsed} onToggleCollapsed={isDesktop ? toggleCollapsed : undefined} showCollapseToggle={isDesktop} />
          <SidebarUser collapsed={collapsed} />
        </aside>

        <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent title="Navigation" className="bg-sidebar">
            <div className="flex h-[64px] items-center gap-2 px-6">
              <Logo />
            </div>
            <SidebarNav collapsed={false} showCollapseToggle={false} onNavigate={() => setMobileOpen(false)} />
            <SidebarUser collapsed={false} />
          </SheetContent>
        </Dialog>

        <main
          id="main"
          ref={mainRef}
          tabIndex={-1}
          className="min-w-0 flex-1 bg-surface-muted px-3 pb-24 pt-4 focus:outline-none sm:px-6 md:rounded-tl-xl md:border-l md:border-t md:border-border md:pb-8 md:pt-6 lg:px-8 lg:py-8"
        >
          <div className="mx-auto w-full max-w-[1320px]">
            <Breadcrumbs className="mb-3 px-0 sm:px-3" />
            <ErrorBoundary resetKey={location.pathname}>
              <React.Suspense fallback={<PageSkeleton />}>
                <Outlet />
              </React.Suspense>
            </ErrorBoundary>
          </div>
        </main>
      </div>
      <BottomTabs />
    </div>
  );
}
