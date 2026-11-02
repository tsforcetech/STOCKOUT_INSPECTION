import * as React from "react";
import { EyeIcon, EyeSlashIcon } from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";

/** Password field with show/hide toggle (Figma "EyeSlash" affordance). Forwards id/aria props to the input. */
export const PasswordInput = React.forwardRef<HTMLInputElement, Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">>(({ className, ...props }, ref) => {
  const [visible, setVisible] = React.useState(false);
  return (
    <div className="relative">
      <Input ref={ref} type={visible ? "text" : "password"} className={cn("pr-10", className)} {...props} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer rounded p-0.5 text-foreground"
        aria-label={visible ? "Hide password" : "Show password"}
      >
        {visible ? <EyeIcon className="size-5" /> : <EyeSlashIcon className="size-5" />}
      </button>
    </div>
  );
});
PasswordInput.displayName = "PasswordInput";
