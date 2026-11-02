import { QueryClient } from "@tanstack/react-query";
import { isApiError } from "@/lib/api/errors";

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        // Retry only transient failures of safe (GET) requests.
        retry: (failureCount, error) => {
          if (!isApiError(error)) return failureCount < 1;
          if (["network", "timeout", "unavailable"].includes(error.kind)) return failureCount < 2;
          return false;
        },
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      },
      mutations: { retry: false },
    },
  });
}
