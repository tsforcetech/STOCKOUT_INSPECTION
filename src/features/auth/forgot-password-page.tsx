import * as React from "react";
import { Link } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormError, FormField } from "@/components/forms/form-field";
import { authService } from "@/services/auth.service";
import { getErrorMessage } from "@/lib/api/errors";
import { AuthCard, AuthShell } from "./auth-shell";

const schema = z.object({ emailOrMobile: z.string().trim().min(1, "Enter your email address.") });

export default function ForgotPasswordPage() {
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { emailOrMobile: "" } });

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await authService.forgotPassword(values.emailOrMobile.trim());
      setSent(true);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  });

  return (
    <AuthShell>
      <AuthCard title="Reset your password" subtitle={sent ? "Check your inbox" : "We'll email you a reset link"}>
        {sent ? (
          <div className="mx-auto max-w-[440px] space-y-8 text-center">
            <p className="text-sm text-body">
              If an account exists for that address, password reset instructions have been sent. The link expires in 15 minutes.
            </p>
            <div className="flex flex-col gap-3">
              <Button asChild size="lg" className="w-full">
                <Link to="/reset-password">I have a reset code</Link>
              </Button>
              <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground">
                Back to sign in
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} noValidate className="mx-auto w-full max-w-[440px] space-y-8">
            <FormError message={error} />
            <FormField label="Email" htmlFor="emailOrMobile" error={form.formState.errors.emailOrMobile?.message}>
              <Input autoComplete="username" placeholder="Enter your email address" autoFocus {...form.register("emailOrMobile")} />
            </FormField>
            <Button type="submit" size="lg" className="w-full" loading={form.formState.isSubmitting}>
              Send reset instructions
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
