import * as React from "react";
import { Link } from "react-router";
import { CaretRightIcon, CheckCircleIcon, DeviceMobileIcon, EnvelopeSimpleIcon, IdentificationCardIcon, LockSimpleIcon, ShieldCheckIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { IdText } from "@/components/common/copy-button";
import { Badge } from "@/components/ui/misc";

type IdentityUser = { email?: string | null; emailVerified?: boolean; mobile?: string | null; mobileVerified?: boolean; userId?: string | null } | null | undefined;

function Row({ icon, label, children, badge }: { icon: React.ReactNode; label: string; children: React.ReactNode; badge?: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 px-3 py-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-muted-foreground [&>svg]:size-[18px]" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <p className="text-xs text-muted-foreground">{label}</p>
          {badge}
        </div>
        <div className="mt-0.5 break-all text-sm font-medium text-foreground">{children}</div>
      </div>
    </li>
  );
}

function Verified({ ok }: { ok?: boolean }) {
  return ok ? (
    <Badge tone="success">
      <CheckCircleIcon weight="fill" aria-hidden /> Verified
    </Badge>
  ) : (
    <Badge tone="warning">
      <WarningCircleIcon weight="fill" aria-hidden /> Not verified
    </Badge>
  );
}

/** Read-only sign-in details (email, mobile, user ID) with a link to Security. */
export function SignInIdentity({ user, securityPath = "/account/security" }: { user: IdentityUser; securityPath?: string }) {
  return (
    <section aria-labelledby="sign-in-identity">
      <h2 id="sign-in-identity" className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Sign-in identity
      </h2>
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
        <Row icon={<EnvelopeSimpleIcon />} label="Email" badge={user?.email ? <Verified ok={user.emailVerified} /> : undefined}>
          {user?.email ? user.email : <span className="font-normal text-muted-foreground">Not added</span>}
        </Row>
        <Row icon={<DeviceMobileIcon />} label="Mobile" badge={user?.mobile ? <Verified ok={user.mobileVerified} /> : undefined}>
          {user?.mobile ? <span dir="ltr">{user.mobile}</span> : <span className="font-normal text-muted-foreground">Not added</span>}
        </Row>
        <Row icon={<IdentificationCardIcon />} label="User ID">
          <IdText value={user?.userId} />
        </Row>
      </ul>
      <p className="mt-3 flex gap-2 text-xs leading-relaxed text-muted-foreground">
        <LockSimpleIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        Your email and mobile are used to sign in, so they can't be changed here.
      </p>
      <Link
        to={securityPath}
        className="mt-3 flex items-center gap-3 rounded-xl border border-border px-3 py-3 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <ShieldCheckIcon className="size-[18px] shrink-0 text-muted-foreground" aria-hidden />
        <span className="flex-1">
          Security
          <span className="block text-xs font-normal text-muted-foreground">Password, sessions and 2-step sign-in</span>
        </span>
        <CaretRightIcon className="size-4 text-muted-foreground" aria-hidden />
      </Link>
    </section>
  );
}
