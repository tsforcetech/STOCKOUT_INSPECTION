import * as React from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormError, FormField } from "@/components/forms/form-field";
import { PasswordInput } from "@/components/forms/password-input";
import { useAuth, type MfaChallenge } from "@/lib/auth/auth-context";
import { getErrorMessage, isApiError } from "@/lib/api/errors";
import { AuthCard, AuthShell } from "./auth-shell";

const credentialsSchema = z.object({
  emailOrMobile: z.string().trim().min(1, "Enter your email address."),
  password: z.string().min(1, "Enter your password."),
});
type Credentials = z.infer<typeof credentialsSchema>;

/** Identity returns ProblemDetails without an error code; map by status + title (see contract). */
function loginErrorMessage(error: unknown): string {
  if (!isApiError(error)) return getErrorMessage(error);
  const title = typeof (error.body as { title?: unknown } | undefined)?.title === "string" ? (error.body as { title: string }).title : "";
  if (error.status === 401) return "The email or password is incorrect.";
  if (error.status === 403 && title === "Account Locked") return "This account is temporarily locked after too many failed attempts. Try again in 15 minutes.";
  if (error.status === 403 && title === "Account Disabled") return "This account is not active. Contact a platform administrator.";
  if (error.status === 429) return error.retryAfterSeconds ? `Too many attempts. Try again in ${error.retryAfterSeconds} seconds.` : "Too many attempts. Please wait a minute and try again.";
  return getErrorMessage(error);
}

export default function LoginPage() {
  const { signIn, endReason } = useAuth();
  const [challenge, setChallenge] = React.useState<MfaChallenge | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const form = useForm<Credentials>({ resolver: zodResolver(credentialsSchema), defaultValues: { emailOrMobile: params.get("email") ?? "", password: "" } });

  const goNext = () => {
    const next = params.get("next");
    navigate(next && next.startsWith("/") && !next.startsWith("//") ? next : "/", { replace: true });
  };

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      const result = await signIn(values.emailOrMobile.trim(), values.password);
      if (result.kind === "mfa-required") setChallenge(result.challenge);
      else goNext();
    } catch (error) {
      setFormError(loginErrorMessage(error));
      form.setValue("password", "");
    }
  });

  if (challenge) {
    return <MfaStep challenge={challenge} onBack={() => setChallenge(null)} onDone={goNext} />;
  }

  return (
    <AuthShell>
      <AuthCard title="Inspector sign in" subtitle="Use your StockOut staff account">
        <form onSubmit={onSubmit} noValidate className="mx-auto w-full max-w-[440px] space-y-8">
          {params.get("reason") === "password-changed" && !formError && (
            <div role="status" className="rounded-md bg-success-soft px-3 py-2 text-sm text-success-soft-foreground">
              Your password was changed and all sessions were signed out. Sign in with your new password.
            </div>
          )}
          {endReason === "expired" && !formError && params.get("reason") !== "password-changed" && (
            <div role="status" className="rounded-md border border-action-border/40 bg-action-soft px-3 py-2 text-sm text-foreground">
              Your session has expired. Please sign in again.
            </div>
          )}
          <FormError message={formError} />
          <FormField label="Email" htmlFor="emailOrMobile" error={form.formState.errors.emailOrMobile?.message}>
            <Input type="text" inputMode="email" autoComplete="username" placeholder="Enter your email address" autoFocus {...form.register("emailOrMobile")} />
          </FormField>
          <div className="space-y-2">
            <FormField label="Password" htmlFor="password" error={form.formState.errors.password?.message}>
              <PasswordInput autoComplete="current-password" placeholder="Enter your password" {...form.register("password")} />
            </FormField>
            <div className="text-right">
              <Link to="/forgot-password" className="text-xs text-muted-foreground hover:text-foreground">
                Forgot password?
              </Link>
            </div>
          </div>
          <Button type="submit" size="lg" className="w-full" loading={form.formState.isSubmitting}>
            Continue
          </Button>
        </form>
      </AuthCard>
    </AuthShell>
  );
}

function MfaStep({ challenge: initial, onBack, onDone }: { challenge: MfaChallenge; onBack: () => void; onDone: () => void }) {
  const { verifyMfa, resendMfa } = useAuth();
  const [challenge, setChallenge] = React.useState(initial);
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [resending, setResending] = React.useState(false);
  const [cooldown, setCooldown] = React.useState(60);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await verifyMfa(challenge, code);
      onDone();
    } catch (err) {
      setError(isApiError(err) && err.status === 401 ? "That code is incorrect or has expired." : getErrorMessage(err));
      setCode("");
    } finally {
      setSubmitting(false);
    }
  };

  const resend = async () => {
    setResending(true);
    setError(null);
    try {
      setChallenge(await resendMfa(challenge));
      setInfo("A new code has been sent. Earlier codes no longer work.");
      setCooldown(60);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthShell>
      <AuthCard title="Verify it's you" subtitle={<>We emailed a 6-digit code for {challenge.emailOrMobile}.</>}>
        <form onSubmit={submit} noValidate className="mx-auto w-full max-w-[440px] space-y-8">
          <FormError message={error} />
          {info && !error && (
            <p role="status" className="rounded-md bg-success-soft px-3 py-2 text-sm text-success-soft-foreground">
              {info}
            </p>
          )}
          <FormField label="Verification code" htmlFor="otp" hint="The code expires after 5 minutes.">
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="h-12 text-center font-heading text-2xl tracking-[0.5em]"
              autoFocus
            />
          </FormField>
          <Button type="submit" size="lg" className="w-full" loading={submitting}>
            Verify and continue
          </Button>
          <div className="flex items-center justify-between text-sm">
            <button type="button" onClick={onBack} className="cursor-pointer text-muted-foreground hover:text-foreground">
              ← Use a different account
            </button>
            <button type="button" onClick={resend} disabled={cooldown > 0 || resending} className="cursor-pointer text-foreground underline underline-offset-4 disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline">
              {cooldown > 0 ? `Resend in ${cooldown}s` : resending ? "Sending…" : "Resend code"}
            </button>
          </div>
        </form>
      </AuthCard>
    </AuthShell>
  );
}
