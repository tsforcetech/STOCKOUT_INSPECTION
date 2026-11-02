import { useQuery } from "@tanstack/react-query";
import { isApiError } from "@/lib/api/errors";
import { authService } from "@/services/auth.service";
import { platformService } from "@/services/platform.service";
import type { AccountActivityQuery } from "@/api/types/identity";

/**
 * /api/v1/auth/* is rate limited by the gateway (10 req/min per path), so identity queries use a
 * long staleTime and never retry on 429.
 */
const AUTH_QUERY = {
  staleTime: 5 * 60_000,
  refetchOnWindowFocus: false,
  retry: (count: number, error: unknown) => !(isApiError(error) && (error.kind === "rate_limited" || error.status < 500)) && count < 1,
} as const;

export const accountKeys = {
  profile: ["account", "profile"] as const,
  photo: (assetId: string) => ["account", "photo", assetId] as const,
  sessions: ["account", "sessions"] as const,
  mfa: ["account", "mfa"] as const,
  activity: (q: AccountActivityQuery) => ["account", "activity", q] as const,
};

/** GET /users/me. A 404 means no profile row yet (PUT upserts), so it resolves to null. */
export function useMyProfileQuery() {
  return useQuery({
    queryKey: accountKeys.profile,
    queryFn: async ({ signal }) => {
      try {
        return await platformService.myProfile(signal);
      } catch (error) {
        if (isApiError(error) && error.status === 404) return null;
        throw error;
      }
    },
  });
}

export function useSessionsQuery() {
  return useQuery({ queryKey: accountKeys.sessions, queryFn: ({ signal }) => authService.sessions(signal), ...AUTH_QUERY });
}

export function useMfaStatusQuery() {
  return useQuery({ queryKey: accountKeys.mfa, queryFn: ({ signal }) => authService.mfaStatus(signal), ...AUTH_QUERY });
}

export function useActivityQuery(q: AccountActivityQuery) {
  return useQuery({ queryKey: accountKeys.activity(q), queryFn: ({ signal }) => authService.accountActivity(q, signal), ...AUTH_QUERY, placeholderData: (prev) => prev });
}
