import { Component, type ErrorInfo, type ReactNode } from "react";
import { WarningIcon, ArrowClockwiseIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  /** Changing this key resets the boundary (e.g. on route change). */
  resetKey?: unknown;
  fullScreen?: boolean;
}

interface State {
  error: Error | null;
}

/** Catches render errors so a JS exception never leaves an unexplained blank page. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (import.meta.env.DEV) console.error("Unhandled UI error", error, info.componentStack);
  }

  componentDidUpdate(prev: Props): void {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className={this.props.fullScreen ? "flex min-h-dvh items-center justify-center p-6" : "flex items-center justify-center py-16"} role="alert">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-danger-soft text-danger-soft-foreground">
            <WarningIcon className="size-6" />
          </div>
          <h2 className="font-heading text-xl font-bold">Something went wrong on this page</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            An unexpected error occurred while displaying this screen. Your data has not been changed.
          </p>
          {import.meta.env.DEV && <pre className="mt-4 max-h-40 overflow-auto rounded-md bg-surface-muted p-3 text-left text-xs">{error.message}</pre>}
          <div className="mt-5 flex justify-center gap-2">
            <Button variant="secondary" className="rounded-full" onClick={() => this.setState({ error: null })}>
              <ArrowClockwiseIcon /> Try again
            </Button>
            <Button onClick={() => window.location.assign(import.meta.env.BASE_URL)}>Go to dashboard</Button>
          </div>
        </div>
      </div>
    );
  }
}
