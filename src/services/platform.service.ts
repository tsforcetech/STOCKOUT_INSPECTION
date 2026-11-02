import { http } from "@/lib/api/client";
import { unwrapData, type Envelope } from "@/lib/api/envelope";
import type {
  AssignPlatformRoleRequest,
  BatchInvitePlatformUsersRequest,
  BatchInvitePlatformUsersResponse,
  CreatePlatformRoleRequest,
  CurrentPlatformPermissionsResponse,
  CurrentPlatformRolesResponse,
  DisablePlatformUserRequest,
  InvitePlatformUserRequest,
  ListPlatformInvitationsQuery,
  PlatformAdminResponse,
  PlatformFeatureFlagResponse,
  PlatformInvitationResponse,
  PlatformPermissionResponse,
  PlatformRoleAssignmentResponse,
  PlatformRoleDetailResponse,
  PlatformRoleListResponse,
  PlatformSettingResponse,
  PlatformUserDetailResponse,
  PlatformUserListResponse,
  EligibleInspectorsQuery,
  PagedEligibleInspectorsResponse,
  UpdatePlatformFeatureFlagRequest,
  UpdatePlatformRolePermissionsRequest,
  UpdatePlatformRoleRequest,
  UpdatePlatformSettingRequest,
  UpdatePlatformUserRolesRequest,
  UpdateUserProfileRequest,
  UserProfileResponse,
} from "@/api/types/user-organization";

/**
 * user-organization: /api/v1/platform/*, /api/v1/users/*.
 * Every success body is { success, data }. No endpoint paginates — lists are complete arrays.
 * Contract: docs/contracts/user-organization.md
 */
const get = async <T>(path: string, signal?: AbortSignal, query?: Record<string, string | undefined>) =>
  unwrapData<T>(await http.get<Envelope<T>>(path, { signal, query }));
const post = async <T>(path: string, body?: unknown) => unwrapData<T>(await http.post<Envelope<T>>(path, body));
const put = async <T>(path: string, body?: unknown) => unwrapData<T>(await http.put<Envelope<T>>(path, body));
const del = async <T>(path: string) => unwrapData<T>(await http.delete<Envelope<T>>(path));
const seg = encodeURIComponent;

export const platformService = {
  // Current user
  myPermissions: (signal?: AbortSignal) => get<CurrentPlatformPermissionsResponse>("/api/v1/platform/me/permissions", signal),
  myRoles: (signal?: AbortSignal) => get<CurrentPlatformRolesResponse>("/api/v1/platform/me/roles", signal),
  myProfile: (signal?: AbortSignal) => get<UserProfileResponse>("/api/v1/users/me", signal),
  updateMyProfile: (body: UpdateUserProfileRequest) => put<UserProfileResponse>("/api/v1/users/me", body),

  // Platform users
  users: (signal?: AbortSignal) => get<PlatformUserListResponse[]>("/api/v1/platform/users", signal),
  /** F2-H: users who may be assigned inspections (inspections.perform or PlatformSuperAdmin), sorted by name. */
  eligibleInspectors: (query: EligibleInspectorsQuery, signal?: AbortSignal) =>
    get<PagedEligibleInspectorsResponse>("/api/v1/platform/inspectors/eligible", signal, {
      search: query.search || undefined,
      page: query.page?.toString(),
      pageSize: query.pageSize?.toString(),
      includeUserId: query.includeUserId,
    }),
  user: (userId: string, signal?: AbortSignal) => get<PlatformUserDetailResponse>(`/api/v1/platform/users/${seg(userId)}`, signal),
  setUserRoles: (userId: string, body: UpdatePlatformUserRolesRequest) => put<unknown>(`/api/v1/platform/users/${seg(userId)}/roles`, body),
  disableUser: (userId: string, body: DisablePlatformUserRequest) => post<unknown>(`/api/v1/platform/users/${seg(userId)}/disable`, body),
  enableUser: (userId: string) => post<unknown>(`/api/v1/platform/users/${seg(userId)}/enable`),

  // Invitations
  invitations: (query: ListPlatformInvitationsQuery, signal?: AbortSignal) =>
    get<PlatformInvitationResponse[]>("/api/v1/platform/users/invitations", signal, { status: query.status ?? undefined, email: query.email ?? undefined }),
  invitation: (id: string, signal?: AbortSignal) => get<PlatformInvitationResponse>(`/api/v1/platform/users/invitations/${seg(id)}`, signal),
  invite: (body: InvitePlatformUserRequest) => post<PlatformInvitationResponse>("/api/v1/platform/users/invitations", body),
  /** Returned raw by the backend but already shaped { success, data }. Per-item failures are in data.results. */
  inviteBatch: async (body: BatchInvitePlatformUsersRequest) =>
    unwrapData<BatchInvitePlatformUsersResponse["data"]>(await http.post<BatchInvitePlatformUsersResponse>("/api/v1/platform/users/invitations/batch", body)),
  resendInvitation: (id: string) => post<unknown>(`/api/v1/platform/users/invitations/${seg(id)}/resend`),
  revokeInvitation: (id: string) => post<unknown>(`/api/v1/platform/users/invitations/${seg(id)}/revoke`),
  /**
   * POST /api/v1/platform/invitations/accept { token } (PlatformInvitationsController.cs:124). The caller must be signed in
   * with a verified email equal to the invited one. Errors: 400 INVALID_INVITATION_TOKEN / EMAIL_NOT_VERIFIED / INVALID_EMAIL /
   * INVALID_USER, 404 INVITATION_NOT_FOUND, 409 INVITATION_ALREADY_ACCEPTED / INVITATION_REVOKED / INVITATION_EXPIRED /
   * INVITATION_EMAIL_MISMATCH.
   */
  acceptInvitation: (token: string) => post<unknown>("/api/v1/platform/invitations/accept", { token }),

  // Roles & permissions
  permissions: (signal?: AbortSignal) => get<PlatformPermissionResponse[]>("/api/v1/platform/permissions", signal),
  roles: (signal?: AbortSignal) => get<PlatformRoleListResponse[]>("/api/v1/platform/roles", signal),
  assignableRoles: (signal?: AbortSignal) => get<PlatformRoleListResponse[]>("/api/v1/platform/roles/assignable", signal),
  role: (roleId: string, signal?: AbortSignal) => get<PlatformRoleDetailResponse>(`/api/v1/platform/roles/${seg(roleId)}`, signal),
  createRole: (body: CreatePlatformRoleRequest) => post<PlatformRoleDetailResponse>("/api/v1/platform/roles", body),
  updateRole: (roleId: string, body: UpdatePlatformRoleRequest) => put<PlatformRoleDetailResponse>(`/api/v1/platform/roles/${seg(roleId)}`, body),
  deactivateRole: (roleId: string) => del<unknown>(`/api/v1/platform/roles/${seg(roleId)}`),
  /** L14: roles.activate or roles.update. 404 ROLE_NOT_FOUND, 409 SYSTEM_ROLE_PROTECTED. Returns the role detail. */
  reactivateRole: (roleId: string) => post<PlatformRoleDetailResponse>(`/api/v1/platform/roles/${seg(roleId)}/reactivate`),
  setRolePermissions: (roleId: string, body: UpdatePlatformRolePermissionsRequest) => put<unknown>(`/api/v1/platform/roles/${seg(roleId)}/permissions`, body),

  // Platform admins (PlatformSuperAdmin role only)
  admins: (signal?: AbortSignal) => get<PlatformAdminResponse[]>("/api/v1/platform/admins", signal),
  adminRoles: (userId: string, signal?: AbortSignal) => get<CurrentPlatformRolesResponse>(`/api/v1/platform/admins/${seg(userId)}/roles`, signal),
  assignAdminRole: (userId: string, body: AssignPlatformRoleRequest) => post<PlatformRoleAssignmentResponse>(`/api/v1/platform/admins/${seg(userId)}/roles`, body),
  revokeAdminRole: (userId: string, roleCode: string) => del<boolean>(`/api/v1/platform/admins/${seg(userId)}/roles/${seg(roleCode)}`),

  // Settings & feature flags (optimistic concurrency via expectedVersion)
  settings: (signal?: AbortSignal) => get<PlatformSettingResponse[]>("/api/v1/platform/settings", signal),
  updateSetting: (key: string, body: UpdatePlatformSettingRequest) => put<PlatformSettingResponse>(`/api/v1/platform/settings/${seg(key)}`, body),
  resetSetting: (key: string, expectedVersion: number) => post<PlatformSettingResponse>(`/api/v1/platform/settings/${seg(key)}/reset`, { expectedVersion }),
  featureFlags: (signal?: AbortSignal) => get<PlatformFeatureFlagResponse[]>("/api/v1/platform/feature-flags", signal),
  updateFeatureFlag: (key: string, body: UpdatePlatformFeatureFlagRequest) => put<PlatformFeatureFlagResponse>(`/api/v1/platform/feature-flags/${seg(key)}`, body),
  resetFeatureFlag: (key: string, expectedVersion: number) => post<PlatformFeatureFlagResponse>(`/api/v1/platform/feature-flags/${seg(key)}/reset`, { expectedVersion }),
};
