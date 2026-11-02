import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { CircleNotchIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils/cn";

/**
 * Figma button styles:
 *  primary   — near-black pill with lime label ("Continue")
 *  action    — lime fill with olive border (active sidebar item / highlight actions)
 *  secondary — white with #c9c9c6 border ("View all", "View Report", "Monthly")
 */
export const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-[18px] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "rounded-full bg-primary text-primary-foreground hover:bg-primary-hover disabled:not-aria-busy:bg-border-strong disabled:not-aria-busy:text-muted-foreground disabled:not-aria-busy:opacity-100",
        action: "rounded-md border border-transparent bg-ink text-ink-foreground hover:bg-ink-hover disabled:not-aria-busy:bg-border-strong disabled:not-aria-busy:text-muted-foreground disabled:not-aria-busy:opacity-100",
        secondary: "rounded-md border border-secondary-border bg-surface text-foreground hover:bg-surface-muted",
        ghost: "rounded-md text-foreground hover:bg-surface-muted",
        danger: "rounded-full bg-danger text-white hover:bg-danger-hover",
        "danger-ghost": "rounded-md text-danger-soft-foreground hover:bg-danger-soft",
        link: "h-auto px-0 text-foreground underline underline-offset-4 hover:text-muted-foreground",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-4",
        lg: "h-12 px-6 text-base",
        icon: "size-10 rounded-md",
        "icon-sm": "size-8 rounded-md",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, disabled, children, type, ...props }, ref) => {
    if (asChild) {
      return (
        <Slot.Root ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props}>
          {children}
        </Slot.Root>
      );
    }
    return (
      <button
        ref={ref}
        type={type ?? "button"}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && <CircleNotchIcon className="animate-spin" aria-hidden />}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";
