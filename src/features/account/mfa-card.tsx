import * as React from "react";
import { Link } from "react-router";
import { ShieldCheckIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge, Skeleton } from "@/components/ui/misc";
import { FormError, FormField } from "@/components/forms/form-field";
import { ErrorState } from "@/components/feedback/states";
import { useAuth } from "@/lib/auth/auth-context";
import { getErrorMessage } from "@/lib/api/errors";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { authService } from "@/services/auth.service";
import { accountKeys, useMfaStatusQuery } from "./queries";

/** EMAIL_OTP enrolment: register (code emailed) → confirm. Disable is not offered (backend always returns 422). */
export function MfaCard() {
  const { user } = useAuth();
  const status = useMfaStatusQuery();
  const [challengeId, setChallengeId] = React.useState<string | null>(null);
  const [code, setCode] = React.useState("");
  const [codeError, setCodeError] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const register = useApiMutation({
    mutationFn: () => authService.mfaRegister(),
    toastOnError: false,
    successMessage: "A 6-digit code was sent to your email.",
    onSuccess: (res) => {
      if (!res.challengeId) {
        setError("The server did not return a verification challenge. Try again.");
        return;
      }
      setChallengeId(res.challengeId);
      setCode("");
    },
  });

  const confirm = useApiMutation({
    mutationFn: (vars: { code: string; challengeId: string }) => authService.mfaConfirm({ type: "EMAIL_OTP", code: vars.code, challengeId: vars.challengeId }),
    invalidate: [accountKeys.mfa],
    toastOnError: false,
    successMessage: "Two-factor authentication is now enabled.",
    onSuccess: () => setChallengeId(null),
  });

  const start = () => {
    setError(null);
    register.mutate(undefined, { onError: (e) => setError(getErrorMessage(e)) });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setCodeError(null);
    setError(null);
    if (!/^\d{6}$/.test(code)) return setCodeError("Enter the 6-digit code from the email.");
    if (challengeId) confirm.mutate({ code, challengeId }, { onError: (err) => setCodeError(getErrorMessage(err)) });
  };

  if (status.isLoading) return <Skeleton className="h-24 w-full" />;
  if (status.error) return <ErrorState error={status.error} onRetry={() => status.refetch()} />;

  const enabled = status.data?.enabled === true;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <ShieldCheckIcon className="size-6 text-foreground" aria-hidden />
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">Email one-time code</p>
          <p className="text-xs text-muted-foreground">A code is emailed to {user?.email ?? "you"} each time you sign in.</p>
        </div>
        <Badge tone={enabled ? "success" : "neutral"} dot>
          {enabled ? "Enabled" : "Off"}
        </Badge>
      </div>
      <FormError message={error} />
      {enabled ? (
        <p role="note" className="rounded-md border border-border bg-surface-muted px-3 py-2 text-xs text-muted-foreground">
          Turning MFA off is not available: the identity service's disable endpoint currently rejects every request (step-up proof bug). Contact a platform administrator if you need it removed.
        </p>
      ) : !user?.emailVerified ? (
        <p role="note" className="rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-sm text-warning-soft-foreground">
          Verify your email address before enabling two-factor authentication. See{" "}
          <Link to="/account" className="underline underline-offset-4">
            your profile
          </Link>
          .
        </p>
      ) : challengeId ? (
        <form onSubmit={submit} noValidate className="space-y-3">
          <FormField label="Verification code" htmlFor="mfa-code" required error={codeError ?? undefined} hint="The code expires after 5 minutes.">
            <Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className="w-40 font-mono tracking-widest" />
          </FormField>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" loading={confirm.isPending}>
              Confirm and enable
            </Button>
            <Button variant="secondary" onClick={start} loading={register.isPending} disabled={confirm.isPending}>
              Send a new code
            </Button>
            <Button variant="ghost" onClick={() => setChallengeId(null)} disabled={confirm.isPending}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button onClick={start} loading={register.isPending}>
          Enable two-factor authentication
        </Button>
      )}
    </div>
  );
}
