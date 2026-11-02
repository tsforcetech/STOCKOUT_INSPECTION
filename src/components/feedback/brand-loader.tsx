import { brandMarkUrl } from "@/assets/brand";
import { cn } from "@/lib/utils/cn";

/**
 * Loading state with the brand icon (Brand Guidelines V1.0): the folded-arrow "O" turns a quarter at a time,
 * echoing its recycle-flow idea. Reduced-motion users get a gentle pulse instead.
 */
export function BrandLoader({ label = "Loading…", className, fullScreen = false }: { label?: string; className?: string; fullScreen?: boolean }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("flex flex-col items-center justify-center gap-4", fullScreen ? "min-h-dvh bg-background" : "min-h-[60vh]", className)}
    >
      <img src={brandMarkUrl} alt="" className="brand-loader size-12 select-none" draggable={false} />
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );
}
