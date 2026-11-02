import type * as React from "react";
import { LeafIcon } from "@phosphor-icons/react";
import { Logo } from "@/components/common/logo";
import { loginHeroUrl } from "@/assets/brand";

/**
 * Login layout: dark brand panel on the left (lime glow, ring motif, eyebrow + two-tone headline),
 * sign-in card on the right. An optional photo from src/assets/brand/login-hero.* sits under the glow.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  const year = new Date().getFullYear();
  return (
    <div className="flex min-h-dvh bg-surface sm:p-6">
      <aside className="relative hidden w-[47%] max-w-[860px] shrink-0 overflow-hidden rounded-xl bg-[#181817] text-white ring-1 ring-black/5 lg:flex lg:flex-col">
        {loginHeroUrl && <img src={loginHeroUrl} alt="" className="pointer-events-none absolute inset-0 size-full object-cover opacity-30" />}
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(45%_40%_at_82%_28%,rgba(248,255,44,0.16)_0%,rgba(248,255,44,0.05)_45%,transparent_75%)]" />
        <div aria-hidden className="pointer-events-none absolute -bottom-40 -right-40 size-[440px] rounded-full border-[56px] border-white/[0.04]" />
        <div aria-hidden className="pointer-events-none absolute -bottom-28 -right-28 size-[320px] rounded-full border-[44px] border-[#f8ff2c]/20" />

        <div className="relative px-12 pt-12 xl:px-16 xl:pt-14">
          <Logo tone="light" className="h-8" />
        </div>

        <div className="relative flex flex-1 flex-col justify-center px-12 pt-24 xl:px-16">
          <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-[#f8ff2c]">
            <LeafIcon className="size-5" aria-hidden /> StockOut inspection portal
          </p>
          <h2 className="mt-5 font-heading text-[44px] font-bold leading-[1.05] tracking-tight text-white xl:text-[56px]">
            Inspect on site. <span className="text-[#f8ff2c]">Report in minutes.</span>
          </h2>
          <p className="mt-5 max-w-[34rem] text-lg leading-7 text-white/80">
            Your assigned inspections, checklists, photo evidence, corrections and disputes in one place, on phone, tablet or desktop.
          </p>
        </div>

        <footer className="relative pb-8 text-center text-sm text-white/80">
          <p>© {year}. All rights reserved.</p>
        </footer>
      </aside>

      <section className="relative flex min-w-0 flex-1 flex-col bg-surface sm:rounded-xl sm:border sm:border-border lg:ml-6">
        <div className="flex items-center gap-2 px-6 pt-8 sm:px-10">
          <Logo className="h-7" />
          <span className="rounded-full bg-ink px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-ink-foreground">Inspection</span>
        </div>
        <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">{children}</div>
        <footer className="pb-6 text-center text-xs text-muted-foreground lg:hidden">
          <p>© {year}. All rights reserved.</p>
        </footer>
      </section>
    </div>
  );
}

/** Figma "Sign in" card: 24px radius, #c9c9c6 border, centred H3 + subtitle. */
export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="w-full max-w-[504px] rounded-xl border border-secondary-border bg-surface px-6 py-12 sm:px-8 sm:py-16">
      <div className="mb-10 text-center sm:mb-14">
        <h1 className="font-heading text-[28px] font-bold leading-9 text-foreground sm:text-[32px] sm:leading-10">{title}</h1>
        {subtitle && <p className="mt-2 text-lg leading-6 tracking-[-0.03em] text-body/60 sm:text-xl">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
