import { brandLogoUrl, brandLogoWhiteUrl, brandMarkUrl } from "@/assets/brand";
import { cn } from "@/lib/utils/cn";

/**
 * The official StockOut logo (Brand Guidelines V1.0): wordmark with the folded-arrow "O" and ®. Used exactly as
 * supplied: never redrawn, recoloured, stretched or given effects. Black wordmark on light backgrounds, white on
 * dark ones (`tone="light"`, or automatically in dark theme). `compact` shows the icon alone.
 * Size it by height only (`h-*`), so the proportions stay intact.
 */
export function Logo({ className, compact = false, tone = "default" }: { className?: string; compact?: boolean; tone?: "default" | "light" }) {
  const img = "block w-auto max-w-none select-none";
  if (compact) return <img src={brandMarkUrl} alt="StockOut" draggable={false} className={cn(img, "h-7", className)} />;
  if (tone === "light") return <img src={brandLogoWhiteUrl} alt="StockOut" draggable={false} className={cn(img, "h-7", className)} />;
  return (
    <span role="img" aria-label="StockOut" className="inline-flex shrink-0">
      <img src={brandLogoUrl} alt="" draggable={false} className={cn(img, "h-7 dark:hidden", className)} />
      <img src={brandLogoWhiteUrl} alt="" draggable={false} className={cn(img, "hidden h-7 dark:block", className)} />
    </span>
  );
}
