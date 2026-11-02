import * as React from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircleIcon, EnvelopeSimpleOpenIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/forms/password-input";
import { FormError, FormField } from "@/components/forms/form-field";
import { useAuth } from "@/lib/auth/auth-context";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { getErrorMessage, isApiError } from "@/lib/api/errors";
import { formatUtcDateTime } from "@/features/team/utc";
import { platformService } from "@/services/platform.service";
import { invitationAuthService } from "@/services/invitation-auth.service";
import type { ValidateInvitationResponse } from "@/api/types/identity";
import { userOrgErrorCode, userOrgErrorMessage } from "@/features/team/errors";
import { AuthCard, AuthShell } from "./auth-shell";

/** Same minimum as marketplace sign-up (the invitation endpoint itself accepts 8+). */
const MIN_PASSWORD = 12;

/** What each accept error means for the person holding the link (PlatformInvitationsController.cs:124-160). */
const ACCEPT_ERRORS: Record<string, string> = {
  INVALID_INVITATION_TOKEN: "This invitation link isn't valid. Open the link from the email again, or ask an admin to resend the invitation.",
  INVITATION_NOT_FOUND: "This invitation no longer exists. Ask an admin to send you a new one.",
  INVITATION_ALREADY_ACCEPTED: "This invitation has already been accepted. Log in with the invited account to use the admin console.",
  INVITATION_REVOKED: "This invitation was withdrawn by an admin. Ask them to send you a new one if you still need access.",
  INVITATION_EXPIRED: "This invitation has expired. Ask an admin to resend it.",
  INVITATION_EMAIL_MISMATCH: "This invitation was sent to a different email address. Log out, then log in with the email the invitation was sent to.",
  EMAIL_NOT_VERIFIED: "Your email address isn't verified yet. Verify it, then try again.",
  INVALID_EMAIL: "Your account has no email address, so the invitation can't be matched to it.",
  INVALID_USER: "Your session isn't valid any more. Log out and log in again.",
};

/** Validation errors are ProblemDetails with a short title (identity Handlers.cs ValidateInvitationAsync). */
function validationMessage(error: unknown): string {
  if (isApiError(error)) {
    const title = (error.body as { title?: string } | undefined)?.title;
    if (error.status === 400) return ACCEPT_ERRORS.INVALID_INVITATION_TOKEN!;
    if (title === "Revoked") return ACCEPT_ERRORS.INVITATION_REVOKED!;
    if (title === "Accepted") return ACCEPT_ERRORS.INVITATION_ALREADY_ACCEPTED!;
    if (title === "Expired") return ACCEPT_ERRORS.INVITATION_EXPIRED!;
    if (error.status === 503) return "Invitations can't be checked right now. Please try again in a few minutes.";
  }
  return getErrorMessage(error);
}

const sameEmail = (a?: string | null, b?: string | null) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Landing page for the link in the platform invitation email: /platform/invitation?token=…
 * Public route. The token is checked first (POST /auth/invitations/validate), which says whether the invited email
 * already has an account:
 *  - existing account → "Log in to accept" → back here signed in → accepted automatically;
 *  - new → create the account here (POST /auth/invitations/register), which also verifies the email and accepts;
 *  - existing but unverified → resend the verification email, then log in.
 */
export default function AcceptInvitationPage() {
  const [params] = useSearchParams();
  const token = params.get("token")?.trim() ?? "";
  const autoAccept = params.get("accept") === "1";
  const location = useLocation();
  const navigate = useNavigate();
  const { status, user, signOut, reloadAccess } = useAuth();
  const [done, setDone] = React.useState(false);

  const invitation = useQuery({
    queryKey: ["invitation", "validate", token],
    queryFn: ({ signal }) => invitationAuthService.validate(token, signal),
    enabled: !!token && !done,
    retry: false,
    staleTime: Infinity,
  });

  const shell = (body: React.ReactNode) => (
    <AuthShell>
      <AuthCard title="You're invited" subtitle="Join the StockOut admin console">
        <div className="mx-auto w-full max-w-[440px]">
          <EnvelopeSimpleOpenIcon className="mx-auto mb-6 size-10 text-foreground" aria-hidden />
          {body}
        </div>
      </AuthCard>
    </AuthShell>
  );

  if (done) {
    return shell(
      <div className="space-y-6 text-center">
        <CheckCircleIcon className="mx-auto size-14 text-success" weight="fill" aria-hidden />
        <div>
          <p className="font-heading text-xl font-bold text-foreground">You're in</p>
          <p className="mt-1 text-sm text-muted-foreground">The invitation is accepted and your admin access is ready.</p>
        </div>
        <Button size="lg" className="w-full" onClick={() => navigate("/", { replace: true })}>
          Open the admin console
        </Button>
      </div>,
    );
  }
  if (!token) {
    return shell(
      <Message tone="danger" title="This link is incomplete">
        The invitation token is missing. Open the link from the invitation email again — copy the whole address if your email app split it.
      </Message>,
    );
  }
  if (invitation.isLoading || status === "initializing") return shell(<p className="text-center text-sm text-muted-foreground">Checking your invitation…</p>);
  if (invitation.error || !invitation.data) {
    return shell(
      <Message tone="danger" title="This invitation can't be used">
        {validationMessage(invitation.error)}
      </Message>,
    );
  }

  const inv = invitation.data;
  const here = location.pathname + location.search;
  const returnHere = `${location.pathname}?token=${encodeURIComponent(token)}&accept=1`;
  const loginHref = `/login?email=${encodeURIComponent(inv.invitedEmail)}&next=${encodeURIComponent(returnHere)}`;
  const header = <InvitedTo invitation={inv} />;

  if (status === "authenticated") {
    if (!sameEmail(user?.email, inv.invitedEmail)) {
      return shell(
        <div className="space-y-6">
          {header}
          <Message tone="warning" title="You're signed in with a different account">
            You're signed in as <strong>{user?.email || user?.displayName}</strong>, but this invitation is for <strong>{inv.invitedEmail}</strong>.
          </Message>
          <Button
            size="lg"
            className="w-full"
            onClick={() => {
              void signOut().then(() => navigate(here, { replace: true }));
            }}
          >
            Log out and continue
          </Button>
        </div>,
      );
    }
    return shell(<AcceptAsSignedIn header={header} token={token} auto={autoAccept} reloadAccess={reloadAccess} onDone={() => setDone(true)} onSwitch={() => void signOut().then(() => navigate(loginHref))} />);
  }

  if (inv.accountState === "EXISTING_VERIFIED") {
    return shell(
      <div className="space-y-6">
        {header}
        <p className="text-center text-sm leading-6 text-body">You already have a StockOut account with this email. Log in and the invitation is accepted straight away.</p>
        <Button asChild size="lg" className="w-full">
          <Link to={loginHref}>Log in to accept</Link>
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Forgot your password?{" "}
          <Link to="/forgot-password" className="font-medium text-foreground underline underline-offset-4">
            Reset it
          </Link>
          , then open this link again.
        </p>
      </div>,
    );
  }
  if (inv.accountState === "EXISTING_UNVERIFIED") {
    return shell(<VerifyFirst header={header} email={inv.invitedEmail} loginHref={loginHref} />);
  }
  return shell(<CreateAccount header={header} invitation={inv} token={token} onDone={() => setDone(true)} />);
}

function InvitedTo({ invitation }: { invitation: ValidateInvitationResponse }) {
  return (
    <div className="rounded-lg border border-border px-4 py-3 text-sm">
      <p className="text-muted-foreground">Invitation for</p>
      <p className="truncate font-medium text-foreground">{invitation.invitedEmail}</p>
      <p className="mt-1 text-xs text-muted-foreground">Valid until {formatUtcDateTime(invitation.expiresAtUtc)}</p>
    </div>
  );
}

/** Signed in with the invited email: accept (automatically when coming back from login). */
function AcceptAsSignedIn({
  header,
  token,
  auto,
  reloadAccess,
  onDone,
  onSwitch,
}: {
  header: React.ReactNode;
  token: string;
  auto: boolean;
  reloadAccess: () => Promise<void>;
  onDone: () => void;
  onSwitch: () => void;
}) {
  const [errorText, setErrorText] = React.useState<string | null>(null);
  const accept = useApiMutation({
    mutationFn: () => platformService.acceptInvitation(token),
    toastOnError: false,
    onSuccess: async () => {
      await reloadAccess().catch(() => undefined);
      onDone();
    },
  });
  const run = React.useCallback(() => {
    setErrorText(null);
    accept.mutate(undefined, {
      onError: (e) => {
        const code = userOrgErrorCode(e);
        setErrorText((code && ACCEPT_ERRORS[code]) || userOrgErrorMessage(e));
      },
    });
  }, [accept]);
  const started = React.useRef(false);
  React.useEffect(() => {
    if (auto && !started.current) {
      started.current = true;
      run();
    }
  }, [auto, run]);

  return (
    <div className="space-y-6">
      {header}
      {errorText && (
        <Message tone="danger" title="The invitation couldn't be accepted">
          {errorText}
        </Message>
      )}
      <Button size="lg" className="w-full" loading={accept.isPending} onClick={run}>
        Accept invitation
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Not the invited account?{" "}
        <button type="button" onClick={onSwitch} className="cursor-pointer font-medium text-foreground underline underline-offset-4">
          Log in with a different email
        </button>
      </p>
    </div>
  );
}

function VerifyFirst({ header, email, loginHref }: { header: React.ReactNode; email: string; loginHref: string }) {
  const resend = useApiMutation({ mutationFn: () => invitationAuthService.resendVerification(email), toastOnError: true, successMessage: "Verification email sent." });
  return (
    <div className="space-y-6">
      {header}
      <Message tone="warning" title="Verify your email first">
        You have a StockOut account with this email, but the address isn't verified yet. Send yourself a verification email, open the link in it, then come back here and log in.
      </Message>
      <Button variant="secondary" size="lg" className="w-full" loading={resend.isPending} disabled={resend.isSuccess} onClick={() => resend.mutate()}>
        {resend.isSuccess ? "Verification email sent" : "Send verification email"}
      </Button>
      <Button asChild size="lg" className="w-full">
        <Link to={loginHref}>I've verified — log in to accept</Link>
      </Button>
    </div>
  );
}

const accountSchema = z
  .object({
    firstName: z.string().trim().min(1, "Enter your first name.").max(100),
    lastName: z.string().trim().min(1, "Enter your last name.").max(100),
    displayName: z.string().trim().max(100),
    mobile: z.string().trim().max(20),
    password: z.string().min(MIN_PASSWORD, `Use at least ${MIN_PASSWORD} characters.`).max(100, "Use 100 characters or fewer."),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match." });
type AccountValues = z.infer<typeof accountSchema>;

/** New to StockOut: create the account here; the backend verifies the email (the link proves it) and accepts the invitation. */
function CreateAccount({ header, invitation, token, onDone }: { header: React.ReactNode; invitation: ValidateInvitationResponse; token: string; onDone: () => void }) {
  const { startSession } = useAuth();
  const [formError, setFormError] = React.useState<string | null>(null);
  const form = useForm<AccountValues>({ resolver: zodResolver(accountSchema), defaultValues: { firstName: "", lastName: "", displayName: "", mobile: "", password: "", confirm: "" } });
  const err = form.formState.errors;

  const submit = form.handleSubmit(async (v) => {
    setFormError(null);
    try {
      const res = await invitationAuthService.register({
        invitationToken: token,
        firstName: v.firstName.trim(),
        lastName: v.lastName.trim(),
        displayName: v.displayName.trim() || `${v.firstName.trim()} ${v.lastName.trim()}`,
        password: v.password,
        mobile: v.mobile.trim() || null,
      });
      await startSession(res);
      onDone();
    } catch (e) {
      const detail = isApiError(e) ? (e.body as { detail?: string } | undefined)?.detail : undefined;
      if (isApiError(e) && (e.status === 409 || /existing account/i.test(detail ?? ""))) {
        setFormError("An account with this email already exists. Log in with it to accept the invitation.");
      } else {
        setFormError(detail || getErrorMessage(e));
      }
    }
  });

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      {header}
      <p className="text-sm leading-6 text-body">Create your StockOut account to accept. Your email is confirmed by this invitation, so there's no separate verification step.</p>
      <FormError message={formError} />
      <FormField label="Email" htmlFor="invite-email">
        <Input id="invite-email" value={invitation.invitedEmail} readOnly disabled />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="First name" htmlFor="firstName" required error={err.firstName?.message}>
          <Input autoComplete="given-name" {...form.register("firstName")} />
        </FormField>
        <FormField label="Last name" htmlFor="lastName" required error={err.lastName?.message}>
          <Input autoComplete="family-name" {...form.register("lastName")} />
        </FormField>
      </div>
      <FormField label="Display name" htmlFor="displayName" hint="How your name appears to other admins. Defaults to your full name." error={err.displayName?.message}>
        <Input {...form.register("displayName")} />
      </FormField>
      <FormField label="Mobile (optional)" htmlFor="mobile" error={err.mobile?.message}>
        <Input type="tel" autoComplete="tel" placeholder="+971 50 000 0000" {...form.register("mobile")} />
      </FormField>
      <FormField label="Password" htmlFor="password" required hint={`At least ${MIN_PASSWORD} characters.`} error={err.password?.message}>
        <PasswordInput autoComplete="new-password" {...form.register("password")} />
      </FormField>
      <FormField label="Confirm password" htmlFor="confirm" required error={err.confirm?.message}>
        <PasswordInput autoComplete="new-password" {...form.register("confirm")} />
      </FormField>
      <Button type="submit" size="lg" className="w-full" loading={form.formState.isSubmitting}>
        Create account and accept
      </Button>
    </form>
  );
}

function Message({ tone, title, children }: { tone: "danger" | "warning"; title: string; children: React.ReactNode }) {
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={tone === "danger" ? "rounded-lg bg-danger-soft p-4 text-sm text-danger-soft-foreground" : "rounded-lg bg-warning-soft p-4 text-sm text-warning-soft-foreground"}>
      <p className="flex items-center gap-1.5 font-medium">
        <WarningCircleIcon className="size-4 shrink-0" aria-hidden /> {title}
      </p>
      <p className="mt-1 leading-6">{children}</p>
    </div>
  );
}
