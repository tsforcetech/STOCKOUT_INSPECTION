import { isApiError } from "@/lib/api/errors";
import { authService } from "@/services/auth.service";
import type { CurrentIdentityResponse } from "@/api/types/identity";
import type { UserProfileResponse } from "@/api/types/user-organization";
import { decodeJwtPayload, tokenStore } from "./token-store";

/**
 * The signed-in user's identity. Normally GET /identity/me; when identity-access can't find the user by id
 * (404, backend defect seen 26 Oct 2026 while login itself works) it is rebuilt from GET /users/me (name) and the
 * access token's own claims (email, email_verified, auth_time). A successful login implies an active account.
 * Mobile isn't available on that path, so it shows as not set.
 */
export async function loadCurrentIdentity(loadProfile: () => Promise<UserProfileResponse>): Promise<CurrentIdentityResponse> {
  try {
    return await authService.me();
  } catch (error) {
    if (!(isApiError(error) && error.status === 404)) throw error;
    const token = tokenStore.getAccessToken();
    const claims = (token && decodeJwtPayload(token)) || {};
    const profile = await loadProfile();
    const authTime = Number(claims.auth_time);
    return {
      userId: profile.userId,
      email: typeof claims.email === "string" ? claims.email : "",
      emailVerified: claims.email_verified === true || claims.email_verified === "true",
      mobile: "",
      mobileVerified: false,
      status: "Active",
      authTime: Number.isFinite(authTime) && authTime > 0 ? new Date(authTime * 1000).toISOString() : "",
      amr: "pwd",
      firstName: profile.firstName || null,
      lastName: profile.lastName || null,
      displayName: profile.displayName || null,
    };
  }
}
