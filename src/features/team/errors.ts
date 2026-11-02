import { getErrorMessage, isApiError } from "@/lib/api/errors";
import type { BatchInviteItemError, UserOrganizationErrorCode } from "@/api/types/user-organization";

/**
 * user-organization E1 errors carry a machine code in `error` and often `message: null`, so the
 * generic message would be vague. These are the user-facing texts for each documented code.
 */
const MESSAGES: Partial<Record<UserOrganizationErrorCode, string>> = {
  ROLE_NOT_FOUND: "This role no longer exists. Refresh the list.",
  DUPLICATE_ROLE_CODE: "A role with this code already exists. Choose a different code.",
  SYSTEM_ROLE_PROTECTED: "System roles are protected and cannot be deactivated or reactivated.",
  SYSTEM_ROLE_PERMISSIONS_PROTECTED: "The PlatformSuperAdmin role's permissions are managed by the platform and cannot be edited.",
  INVALID_PERMISSION: "One or more selected permissions are unknown or inactive. Refresh and try again.",
  USER_NOT_FOUND: "This user no longer exists.",
  INVALID_ROLE: "One or more selected roles are unknown or inactive. Refresh the role list and try again.",
  LAST_SUPER_ADMIN_REQUIRED: "At least one PlatformSuperAdmin must remain. Assign the role to another user first.",
  INVITATION_ALREADY_PENDING: "There is already a pending invitation for this email address.",
  ROLE_ASSIGNMENT_FORBIDDEN: "You are not allowed to assign one or more of the selected roles (system roles can only be granted by a PlatformSuperAdmin).",
  INVITATION_NOT_FOUND: "This invitation no longer exists.",
  INVITATION_ALREADY_ACCEPTED: "This invitation has already been accepted.",
  INVITATION_REVOKED: "This invitation was revoked and cannot be resent.",
  INVITATION_EXPIRED: "This invitation has expired.",
  SETTING_NOT_FOUND: "This setting no longer exists.",
  SETTING_VALUE_INVALID: "The value is not valid for this setting's type.",
  SETTING_NOT_EDITABLE: "This setting is read-only and cannot be changed.",
  FEATURE_FLAG_NOT_FOUND: "This feature flag no longer exists.",
  VERSION_CONFLICT: "Someone else changed this since you loaded it. The latest value has been reloaded — review it and try again.",
};

export function userOrgErrorCode(error: unknown): string | undefined {
  return isApiError(error) ? error.code : undefined;
}

export function userOrgErrorMessage(error: unknown): string {
  const code = userOrgErrorCode(error);
  if (code && code in MESSAGES) return MESSAGES[code as UserOrganizationErrorCode] ?? getErrorMessage(error);
  if (isApiError(error) && error.status === 409 && /PlatformSuperAdmin must remain/i.test(error.message)) return MESSAGES.LAST_SUPER_ADMIN_REQUIRED ?? error.message;
  return getErrorMessage(error);
}

export const BATCH_ITEM_ERRORS: Record<BatchInviteItemError, string> = {
  DUPLICATE_EMAIL_IN_BATCH: "Duplicate email in this batch",
  INVITATION_ALREADY_PENDING: "Already has a pending invitation",
  INVALID_ROLE: "Unknown or inactive role",
  ROLE_ASSIGNMENT_FORBIDDEN: "Not allowed to assign these roles",
  INTERNAL_SERVER_ERROR: "Server error — try again",
};
