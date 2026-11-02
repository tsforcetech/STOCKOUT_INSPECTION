import { Link } from "react-router";
import { CompassIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-lg bg-action-soft ring-1 ring-action-border/30">
        <CompassIcon className="size-7 text-foreground" />
      </div>
      <p className="text-eyebrow text-muted-foreground">Error 404</p>
      <h1 className="mt-1 font-heading text-[32px] font-bold leading-10">Page not found</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">The page you're looking for doesn't exist or may have moved.</p>
      <Button asChild className="mt-6">
        <Link to="/">Back to dashboard</Link>
      </Button>
    </div>
  );
}
