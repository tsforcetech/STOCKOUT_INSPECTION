import { http } from "@/lib/api/client";
import type { RegisterInvitedUserRequest, RegisterInvitedUserResponse, ValidateInvitationResponse } from "@/api/types/identity";

/** Anonymous identity endpoints behind the invitation email link (identity-access InvitationsController.cs, VerificationController.cs). */
export const invitationAuthService = {
  validate: (invitationToken: string, signal?: AbortSignal) =>
    http.post<ValidateInvitationResponse>("/api/v1/auth/invitations/validate", { invitationToken }, { auth: false, signal }),
  register: (body: RegisterInvitedUserRequest) => http.post<RegisterInvitedUserResponse>("/api/v1/auth/invitations/register", body, { auth: false }),
  /** Re-sends the email verification message (for EXISTING_UNVERIFIED accounts). */
  resendVerification: (email: string) => http.post<{ message?: string }>("/api/v1/auth/verification/email/send", { email }, { auth: false }),
};
