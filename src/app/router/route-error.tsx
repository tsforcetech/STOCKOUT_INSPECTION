import { isRouteErrorResponse, Link, useRouteError } from "react-router";
import { WarningIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import NotFoundPage from "@/features/errors/not-found-page";

/** Route-level fallback for loader/lazy-import failures (e.g. a chunk failed to download after a deploy). */
export function RouteError() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />;
  const chunkFailed = error instanceof Error && /dynamically imported module|Loading chunk|Importing a module script failed/i.test(error.message);
  if (import.meta.env.DEV) console.error(error);
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6" role="alert">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-lg bg-danger-soft text-danger-soft-foreground">
          <WarningIcon className="size-7" />
        </div>
        <h1 className="font-heading text-2xl font-bold">{chunkFailed ? "A new version is available" : "This page couldn't be displayed"}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {chunkFailed ? "The portal was updated while you were using it. Reload to get the latest version." : "An unexpected error occurred. Reloading usually fixes it."}
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button onClick={() => window.location.reload()}>Reload</Button>
          <Button variant="secondary" asChild>
            <Link to="/">Go to dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
