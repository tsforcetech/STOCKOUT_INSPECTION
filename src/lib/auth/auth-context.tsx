import * as React from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { configureAuthHandlers, refreshSession } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import { authService } from "@/services/auth.service";
import { platformService } from "@/services/platform.service";
import type {
  CurrentIdentityResponse,
  LoginResponse,
} from "@/api/types/identity";
import {
  buildAccessContext,
  type AccessContext,
} from "@/lib/permissions/permissions";
import { decodeJwtPayload, REFRESH_KEY, tokenStore } from "./token-store";
import { loadCurrentIdentity } from "./current-identity";

export type AuthStatus = "initializing" | "authenticated" | "anonymous";

export interface MfaChallenge {
  userId: string;
  challengeToken: string;
  emailOrMobile: string;
  /** Only for signing in to accept a platform invitation (the account has no admin role until it accepts). */
  allowWithoutAdminAccess?: boolean;
}

/**
 * The inspection portal is for StockOut inspectors only. An account without an inspection permission (every
 * marketplace buyer and seller, and staff without inspection access) is refused at sign-in and its new session is
 * revoked on the server.
 */
export class AdminAccessDeniedError extends Error {
  readonly code = "ADMIN_ACCESS_REQUIRED";
  constructor() {
    super("This account doesn't have access to StockOut Inspection.");
    this.name = "AdminAccessDeniedError";
  }
}

/** Inspector = any inspection permission from /platform/me/permissions (same rule as the portal's INSPECTOR_ACCESS). */
const INSPECTION_PERMISSIONS = ["inspections.view", "inspections.perform", "inspections.assign", "inspections.override"];
export const isPlatformStaff = (a: AccessContext) => INSPECTION_PERMISSIONS.some((p) => a.permissions.has(p));

export type SignInResult =
  | { kind: "signed-in" }
  | { kind: "mfa-required"; challenge: MfaChallenge };

interface AuthContextValue {
  status: AuthStatus;
  user: CurrentIdentityResponse | null;
  access: AccessContext;
  /** Why the last session ended, shown on the login screen. */
  endReason: "expired" | "signed-out" | "access-denied" | null;
  /** Permission/role load failure (user is signed in but access could not be resolved). */
  accessError: unknown;
  signIn: (emailOrMobile: string, password: string, options?: { allowWithoutAdminAccess?: boolean }) => Promise<SignInResult>;
  verifyMfa: (challenge: MfaChallenge, code: string) => Promise<void>;
  resendMfa: (challenge: MfaChallenge) => Promise<MfaChallenge>;
  signOut: () => Promise<void>;
  /** Clears local session state without calling the API (e.g. after password change). */
  endSessionLocally: (reason: "expired" | "signed-out" | "access-denied") => void;
  /** Revokes the session on the server and signs out because the account isn't platform staff. */
  denyAccess: () => Promise<void>;
  reloadAccess: () => Promise<void>;
  /** Starts a session from tokens issued outside the login form (e.g. invitation sign-up). */
  startSession: (tokens: { accessToken: string; refreshToken: string; expiresIn: number }) => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

const EMPTY_ACCESS = buildAccessContext([], []);

/**
 * Rotating refresh tokens + reuse detection: if two tabs sent the same refresh token, the server would
 * revoke the whole session. A Web Lock serialises refreshes across tabs, and the token is re-read
 * inside the lock so a tab picks up the one another tab just rotated.
 */
async function exchangeRefreshToken(): Promise<boolean> {
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  if (locks?.request) return locks.request("stockout.inspection.refresh", () => doExchangeRefreshToken());
  return doExchangeRefreshToken();
}

async function doExchangeRefreshToken(): Promise<boolean> {
  for (let attempt = 0; ; attempt++) {
    const refreshToken = tokenStore.getPersistedRefreshToken();
    if (!refreshToken) return false;
    try {
      const res = await authService.refresh(refreshToken);
      tokenStore.set(res.accessToken, res.refreshToken, res.expiresIn);
      return true;
    } catch (error) {
      // Gateway limits token refresh to 10/min per IP (shared by everyone behind one office IP). A 429 is
      // temporary: wait as told and retry instead of treating the user as signed out.
      if (isApiError(error) && error.status === 429 && attempt < 2) {
        await new Promise((r) =>
          setTimeout(r, Math.min(30, error.retryAfterSeconds ?? 10) * 1000),
        );
        continue;
      }
      // 401 = invalid/expired/reused refresh token. Network errors keep the token for a later retry.
      if (isApiError(error) && (error.status === 401 || error.status === 400))
        tokenStore.clear();
      return false;
    }
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = React.useState<AuthStatus>("initializing");
  const [user, setUser] = React.useState<CurrentIdentityResponse | null>(null);
  const [access, setAccess] = React.useState<AccessContext>(EMPTY_ACCESS);
  const [accessError, setAccessError] = React.useState<unknown>(null);
  const [endReason, setEndReason] = React.useState<
    "expired" | "signed-out" | "access-denied" | null
  >(null);

  const endSessionLocally = React.useCallback(
    (reason: "expired" | "signed-out" | "access-denied") => {
      tokenStore.clear();
      queryClient.clear();
      setUser(null);
      setAccess(EMPTY_ACCESS);
      setAccessError(null);
      setEndReason(reason);
      setStatus("anonymous");
    },
    [queryClient],
  );

  const loadAccess = React.useCallback(async () => {
    // Identity profile and platform permissions come from different services; load in parallel.
    const [me, perms, roles] = await Promise.allSettled([
      loadCurrentIdentity(() => platformService.myProfile()),
      platformService.myPermissions(),
      platformService.myRoles(),
    ]);
    if (me.status === "rejected") throw me.reason;
    // Fail closed: without a confirmed permission list nobody gets into the console.
    if (perms.status === "rejected") throw perms.reason;
    const next = buildAccessContext(perms.value.permissions, roles.status === "fulfilled" ? roles.value.roles.map((r) => r.code) : []);
    setUser(me.value);
    setAccess(next);
    setAccessError(null);
    return next;
  }, []);

  /** Best-effort server-side revocation of the current session, then local sign-out. */
  const revokeAndEnd = React.useCallback(
    async (reason: "access-denied" | "signed-out") => {
      const refreshToken = tokenStore.get()?.refreshToken ?? tokenStore.getPersistedRefreshToken();
      if (refreshToken) await authService.logout(refreshToken).catch(() => undefined);
      endSessionLocally(reason);
    },
    [endSessionLocally],
  );

  const completeSignIn = React.useCallback(
    async (res: LoginResponse, allowWithoutAdminAccess = false) => {
      tokenStore.set(res.accessToken, res.refreshToken, res.expiresIn);
      try {
        const next = await loadAccess();
        if (!isPlatformStaff(next) && !allowWithoutAdminAccess) throw new AdminAccessDeniedError();
      } catch (error) {
        // Never leave a usable session behind for an account that may not use the console.
        await revokeAndEnd(error instanceof AdminAccessDeniedError ? "access-denied" : "signed-out");
        throw error;
      }
      setEndReason(null);
      setStatus("authenticated");
    },
    [loadAccess, revokeAndEnd],
  );

  // Wire the HTTP client to this provider.
  React.useEffect(() => {
    configureAuthHandlers({
      refresh: exchangeRefreshToken,
      onSessionExpired: () => endSessionLocally("expired"),
    });
    return () => configureAuthHandlers(null);
  }, [endSessionLocally]);

  // Another tab signed out (shared refresh token removed): end this tab's session too.
  React.useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === REFRESH_KEY && e.newValue === null && tokenStore.get()) endSessionLocally("signed-out");
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [endSessionLocally]);

  // Restore the session on first load.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!tokenStore.getPersistedRefreshToken()) {
        setStatus("anonymous");
        return;
      }
      const ok = await refreshSession();
      if (cancelled) return;
      if (!ok) {
        setStatus("anonymous");
        return;
      }
      try {
        await loadAccess();
        // Non-staff accounts are signed out by RequireAuth as soon as they reach any console page; only the public
        // invitation page can be used without an admin role.
        if (!cancelled) setStatus("authenticated");
      } catch (error) {
        if (cancelled || (isApiError(error) && error.kind === "aborted"))
          return;
        // Only an explicit auth rejection ends the session. Network/server failures keep the refresh
        // token so the next load can restore it (e.g. a reload while this request was in flight).
        if (
          isApiError(error) &&
          (error.kind === "unauthorized" || error.kind === "forbidden")
        )
          endSessionLocally("expired");
        else setStatus("anonymous");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadAccess, endSessionLocally]);

  const signIn = React.useCallback(
    async (emailOrMobile: string, password: string, options?: { allowWithoutAdminAccess?: boolean }): Promise<SignInResult> => {
      const res = await authService.login({ emailOrMobile, password });
      if (res.mfaRequired) {
        if (!res.userId || !res.mfaChallengeToken)
          throw new Error(
            "The server requested verification but did not return a challenge.",
          );
        return {
          kind: "mfa-required",
          challenge: {
            userId: res.userId,
            challengeToken: res.mfaChallengeToken,
            emailOrMobile,
            allowWithoutAdminAccess: options?.allowWithoutAdminAccess,
          },
        };
      }
      await completeSignIn(res, options?.allowWithoutAdminAccess);
      return { kind: "signed-in" };
    },
    [completeSignIn],
  );

  const verifyMfa = React.useCallback(
    async (challenge: MfaChallenge, code: string) => {
      const res = await authService.verifyMfa({
        userId: challenge.userId,
        challengeToken: challenge.challengeToken,
        code,
        recoveryCode: null,
      });
      await completeSignIn(res, challenge.allowWithoutAdminAccess);
    },
    [completeSignIn],
  );

  const resendMfa = React.useCallback(
    async (challenge: MfaChallenge): Promise<MfaChallenge> => {
      const res = await authService.resendMfa(
        challenge.userId,
        challenge.challengeToken,
      );
      // The old challenge is cancelled; verification must use the new id.
      if (!res.challengeId)
        throw new Error(
          "A new code could not be issued. Please sign in again.",
        );
      return { ...challenge, challengeToken: res.challengeId };
    },
    [],
  );

  const signOut = React.useCallback(async () => {
    // Server-side logout first (POST /auth/logout with the refresh token), then the session id (JWT `sid`) as a
    // fallback. Local state is cleared either way, but we only claim the session ended when the server confirmed it.
    const token = tokenStore.getAccessToken();
    const refreshToken = tokenStore.get()?.refreshToken ?? tokenStore.getPersistedRefreshToken();
    const sid = token ? decodeJwtPayload(token)?.sid : undefined;
    let revoked = false;
    if (refreshToken) {
      try {
        await authService.logout(refreshToken);
        revoked = true;
      } catch {
        /* fall back to revoking the session */
      }
    }
    if (!revoked && typeof sid === "string" && sid) {
      try {
        await authService.revokeSession(sid);
        revoked = true;
      } catch {
        /* session may already be gone */
      }
    }
    endSessionLocally("signed-out");
    if (!revoked) toast.warning("Signed out on this device. The server couldn't confirm the session was ended — sign out of other devices from Security if needed.");
  }, [endSessionLocally]);

  const reloadAccess = React.useCallback(async () => {
    await loadAccess();
  }, [loadAccess]);

  const denyAccess = React.useCallback(() => revokeAndEnd("access-denied"), [revokeAndEnd]);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      access,
      endReason,
      accessError,
      signIn,
      verifyMfa,
      resendMfa,
      signOut,
      endSessionLocally,
      reloadAccess,
      denyAccess,
      // Invitation sign-up: the role arrives with the accepted invitation; the console guard re-checks staff access.
      startSession: (tokens: { accessToken: string; refreshToken: string; expiresIn: number }) => completeSignIn(tokens as LoginResponse, true),
    }),
    [
      status,
      user,
      access,
      endReason,
      accessError,
      signIn,
      verifyMfa,
      resendMfa,
      signOut,
      endSessionLocally,
      reloadAccess,
      denyAccess,
      completeSignIn,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
