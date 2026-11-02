import * as React from "react";
import { Link, useSearchParams } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormError, FormField } from "@/components/forms/form-field";
import { authService } from "@/services/auth.service";
import { getErrorMessage, isApiError } from "@/lib/api/errors";
import { AuthCard, AuthShell } from "./auth-shell";

/** identity-access: minimum length 12, no complexity rules (Identity:MinimumPasswordLength). */
export const PASSWORD_MIN_LENGTH = 12;

const schema = z
  .object({
    token: z.string().trim().min(1, "Enter the reset code from your email."),
    newPassword: z.string().min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters.`),
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, { path: ["confirm"], message: "Passwords don't match." });

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { token: params.get("token") ?? "", newPassword: "", confirm: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await authService.resetPassword(values.token.trim(), values.newPassword, params.get("email"));
      setDone(true);
    } catch (err) {
      setError(isApiError(err) && err.status === 400 ? (err.message || "The reset code is incorrect or has expired.") : getErrorMessage(err));
    }
  });

  return (
    <AuthShell>
      <AuthCard title="Choose a new password" subtitle={done ? "Password updated" : undefined}>
        {done ? (
          <div className="mx-auto max-w-[440px] space-y-8 text-center">
            <p className="text-sm text-body">Your password has been reset and all existing sessions were signed out.</p>
            <Button asChild size="lg" className="w-full">
              <Link to="/login">Sign in</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} noValidate className="mx-auto w-full max-w-[440px] space-y-6">
            <FormError message={error} />
            <FormField label="Reset code" htmlFor="token" required error={form.formState.errors.token?.message}>
              <Input autoComplete="one-time-code" {...form.register("token")} />
            </FormField>
            <FormField label="New password" htmlFor="newPassword" required hint={`At least ${PASSWORD_MIN_LENGTH} characters.`} error={form.formState.errors.newPassword?.message}>
              <Input type="password" autoComplete="new-password" {...form.register("newPassword")} />
            </FormField>
            <FormField label="Confirm new password" htmlFor="confirm" required error={form.formState.errors.confirm?.message}>
              <Input type="password" autoComplete="new-password" {...form.register("confirm")} />
            </FormField>
            <Button type="submit" size="lg" className="w-full" loading={form.formState.isSubmitting}>
              Reset password
            </Button>
            <p className="text-center text-sm">
              <Link to="/login" className="text-muted-foreground hover:text-foreground">
                Back to sign in
              </Link>
            </p>
          </form>
        )}
      </AuthCard>
    </AuthShell>
  );
}
