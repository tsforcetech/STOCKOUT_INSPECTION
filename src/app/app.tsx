import * as React from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/misc";
import { ErrorBoundary } from "@/components/feedback/error-boundary";
import { AuthProvider } from "@/lib/auth/auth-context";
import { ThemeProvider, useTheme } from "./providers/theme";
import { createQueryClient } from "./providers/query-client";
import { createAppRouter } from "./router/router";

function ThemedToaster() {
  const { resolved } = useTheme();
  return <Toaster theme={resolved} position="top-right" richColors closeButton toastOptions={{ className: "font-sans" }} />;
}

export function App() {
  const [queryClient] = React.useState(createQueryClient);
  const [router] = React.useState(createAppRouter);
  return (
    <ErrorBoundary fullScreen>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider delayDuration={250}>
            <AuthProvider>
              <RouterProvider router={router} />
            </AuthProvider>
            <ThemedToaster />
          </TooltipProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
