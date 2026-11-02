import * as React from "react";
import { useNavigate } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormError, FormField } from "@/components/forms/form-field";
import { PasswordInput } from "@/components/forms/password-input";
import { useAuth } from "@/lib/auth/auth-context";
import { getErrorMessage, isApiError } from "@/lib/api/errors";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { authService } from "@/services/auth.service";

const MIN = 12; // Identity:MinimumPasswordLength; no complexity rules server-side.
const schema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: z.string().min(MIN, `Use at least ${MIN} characters.`),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords don't match." })
  .refine((v) => v.newPassword !== v.currentPassword, { path: ["newPassword"], message: "Choose a password different from the current one." });
type Values = z.infer<typeof schema>;

export const PASSWORD_CHANGED_MESSAGE = "Your password was changed and every session was signed out. Sign in with your new password.";

/**
 * POST /auth/password/change. The backend revokes ALL sessions including this one, so on success we
 * clear local state and send the user to /login.
 */
export function ChangePasswordCard() {
  const { endSessionLocally } = useAuth();
  const navigate = useNavigate();
  const [formError, setFormError] = React.useState<string | null>(null);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" } });

  const change = useApiMutation({
    mutationFn: (v: Values) => authService.changePassword({ currentPassword: v.currentPassword, newPassword: v.newPassword, stepUpToken: null }),
    toastOnError: false,
    onSuccess: () => {
      toast.success(PASSWORD_CHANGED_MESSAGE);
      endSessionLocally("signed-out");
      navigate("/login?reason=password-changed", { replace: true, state: { message: PASSWORD_CHANGED_MESSAGE } });
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    change.mutate(values, {
      onError: (e) => {
        const msg = getErrorMessage(e);
        if (isApiError(e) && e.status === 400 && /current password/i.test(msg)) form.setError("currentPassword", { type: "server", message: "The current password is incorrect." });
        else if (isApiError(e) && e.status === 400 && /at least/i.test(msg)) form.setError("newPassword", { type: "server", message: msg });
        else setFormError(msg);
      },
    });
  });

  const e = form.formState.errors;
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <FormError message={formError} />
      <FormField label="Current password" htmlFor="pw-current" required error={e.currentPassword?.message}>
        <PasswordInput autoComplete="current-password" {...form.register("currentPassword")} />
      </FormField>
      <FormField label="New password" htmlFor="pw-new" required error={e.newPassword?.message} hint={`At least ${MIN} characters.`}>
        <PasswordInput autoComplete="new-password" {...form.register("newPassword")} />
      </FormField>
      <FormField label="Confirm new password" htmlFor="pw-confirm" required error={e.confirmPassword?.message}>
        <PasswordInput autoComplete="new-password" {...form.register("confirmPassword")} />
      </FormField>
      <p className="text-xs text-muted-foreground">Changing your password signs you out everywhere, including this browser.</p>
      <Button type="submit" loading={change.isPending}>
        Change password
      </Button>
    </form>
  );
}
