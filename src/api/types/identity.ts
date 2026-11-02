/**
 * Identity & Access API types (services/identity-access) + shared gateway/ASP.NET error shapes.
 * JSON is System.Text.Json web defaults: camelCase, nulls are serialized, DateTime = ISO-8601 string.
 * See docs/contracts/identity-access.md and docs/contracts/gateway.md.
 */

/** ISO-8601 date-time string (C# DateTime / DateTimeOffset). */
export type IsoDateTime = string;

// ---------------------------------------------------------------------------
// Shared error shapes
// ---------------------------------------------------------------------------

/** Machine codes written by gateways/Emcore.ApiGateway/Middleware/GatewayErrorHandlingMiddleware.cs */
export type GatewayErrorCode =
  | 'authentication_required'
  | 'forbidden_access'
  | 'unmatched_gateway_route'
  | 'rate_limit_exceeded'
  | 'proxy_error'
  | 'destination_unavailable'
  | 'downstream_timeout'
  | 'gateway_internal_error'
  | 'gateway_error';

/** Gateway anonymous problem object (GatewayErrorHandlingMiddleware.WriteProblemDetailsAsync). traceId omitted when null. */
export interface GatewayProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  code: GatewayErrorCode;
  requestId: string;
  correlationId: string;
  traceId?: string;
  instance: string;
}

/** ASP.NET Core ProblemDetails from ControllerBase.Problem() in BaseApiController.MapResult. No machine-readable code. */
export interface IdentityProblemDetails {
  type: string; // "https://emcore.platform/errors/{status}"
  title: string;
  status: number;
  detail: string;
  traceId?: string;
}

/** Anonymous problem object from Api/Middleware/ExceptionHandlingMiddleware.cs (unhandled exceptions). */
export interface IdentityExceptionProblem {
  type: string;
  title: 'Invalid Request' | 'Unauthorized' | 'An unexpected server error occurred.';
  status: 400 | 401 | 500;
  detail: string;
  instance: string;
  traceId: string;
}

/** ASP.NET Core ValidationProblemDetails ([ApiController] automatic 400). Error keys are not stable. */
export interface AspNetValidationProblemDetails {
  type: string;
  title: string;
  status: 400;
  errors: Record<string, string[]>;
  traceId?: string;
}

// ---------------------------------------------------------------------------
// Enums (string unions)
// ---------------------------------------------------------------------------

/** C# Domain.Enums.AccountStatus (serialized via ToString()). */
export type AccountStatus = 'PendingVerification' | 'Active' | 'Locked' | 'Suspended' | 'Closed';

/** C# Domain.Enums.SessionStatus. /auth/sessions only returns 'Active'. */
export type SessionStatus = 'Active' | 'Revoked' | 'Expired' | 'Compromised';

/** C# Domain.Enums.MfaMethodTypes. */
export type MfaMethodType = 'EMAIL_OTP';

/** C# Application.Constants.StepUpActions (input is case-insensitive; these are canonical). */
export type StepUpTargetAction = 'MFA_DISABLE' | 'ChangeEmail' | 'DeleteAccount' | 'RotateServiceCredential';

/** Verification channel for registration confirm (case-insensitive input). */
export type VerificationChannel = 'Email' | 'Mobile';

/** C# Domain.Enums.AccountActivityEventTypes + 'USER_STATUS_CHANGE' (written by PR_IDENTITY_UPDATE_USER_STATUS). */
export type KnownAccountActivityEventType =
  | 'REGISTRATION_SUCCEEDED'
  | 'EMAIL_VERIFICATION_SUCCEEDED'
  | 'MOBILE_VERIFICATION_SUCCEEDED'
  | 'LOGIN_SUCCEEDED'
  | 'LOGIN_FAILED'
  | 'MFA_LOGIN_SUCCEEDED'
  | 'MFA_LOGIN_FAILED'
  | 'MFA_ENABLED'
  | 'MFA_DISABLED'
  | 'MFA_RESEND_REQUESTED'
  | 'PASSWORD_CHANGED'
  | 'PASSWORD_RESET'
  | 'SESSION_REVOKED'
  | 'ALL_SESSIONS_REVOKED'
  | 'LOGOUT'
  | 'STEP_UP_SUCCEEDED'
  | 'STEP_UP_FAILED'
  | 'ACCOUNT_LOCKED'
  | 'ACCOUNT_UNLOCKED'
  | 'ACCOUNT_STATUS_CHANGED'
  | 'USER_STATUS_CHANGE';

/** DB column is free text; keep unknown values representable while preserving autocomplete. */
export type AccountActivityEventType = KnownAccountActivityEventType | (string & Record<never, never>);

// ---------------------------------------------------------------------------
// JWT
// ---------------------------------------------------------------------------

/** Access-token payload from Infrastructure/Security/SecurityServices.cs JwtTokenGenerator.GenerateAccessToken. No roles/permissions. */
export interface AccessTokenClaims {
  sub: string;
  jti: string;
  sid: string;
  email: string;
  email_verified: boolean;
  iat: number;
  nbf: number;
  exp: number;
  iss: string;
  aud: string;
  amr: ['pwd' | 'mfa' | 'ref' | 's2s'];
  auth_time: number;
  sec_ver: 1;
}

// ---------------------------------------------------------------------------
// Common
// ---------------------------------------------------------------------------

/** C# StandardSuccessResponse. */
export interface StandardSuccessResponse {
  message: string;
}

// ---------------------------------------------------------------------------
// Login / MFA login / refresh / logout
// ---------------------------------------------------------------------------

/** C# LoginRequest. */
export interface LoginRequest {
  emailOrMobile: string;
  password: string;
}

/**
 * C# LoginResponse (login and mfa/verify).
 * mfaRequired=true => accessToken="" , refreshToken="", expiresIn=0, mfaChallengeToken+userId set, names null.
 * mfa/verify success => userId/firstName/lastName/displayName are null.
 */
export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
  mfaRequired: boolean;
  mfaChallengeToken: string | null;
  userId: string | null;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
}

/** C# MfaLoginVerifyRequest. challengeToken = LoginResponse.mfaChallengeToken (or ResendMfaResponse.challengeId). recoveryCode unsupported (must be null). */
export interface MfaLoginVerifyRequest {
  userId: string;
  challengeToken: string;
  code: string;
  recoveryCode: string | null;
}

/** C# ResendMfaRequest. */
export interface ResendMfaRequest {
  userId: string;
  challengeId: string;
}

/** C# ResendMfaResponse. The previous challenge is cancelled; use the new challengeId. */
export interface ResendMfaResponse {
  message: string;
  challengeId: string | null;
}

/** C# RefreshRequest. */
export interface RefreshRequest {
  refreshToken: string;
}

/** C# RefreshResponse. Refresh token is rotated on every call. */
export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

/** C# LogoutRequest (body optional). NOTE: supplying refreshToken currently yields 400 (server bug). */
export interface LogoutRequest {
  refreshToken: string | null;
}

// ---------------------------------------------------------------------------
// Sessions / account
// ---------------------------------------------------------------------------

/** C# SessionDto. */
export interface SessionDto {
  sessionId: string;
  status: SessionStatus;
  createdAtUtc: IsoDateTime;
  revokedAtUtc: IsoDateTime | null;
  isCurrentSession: boolean;
  deviceLabel: string | null;
  ipAddress: string | null;
}

/** C# AccountStatusResponse. */
export interface AccountStatusResponse {
  userId: string;
  email: string;
  emailVerified: boolean;
  mobile: string;
  mobileVerified: boolean;
  status: AccountStatus;
  failedLoginAttempts: number;
  lockoutEndUtc: IsoDateTime | null;
}

/** Query for GET /api/v1/auth/account/activity (AccountController.GetAccountActivityAsync). */
export interface AccountActivityQuery {
  page?: number; // default 1
  pageSize?: number; // default 50, server clamps to 1..100 but echoes the raw value
  eventType?: AccountActivityEventType;
  fromUtc?: IsoDateTime;
  toUtc?: IsoDateTime;
}

/** C# AccountActivityItem. details is free text (sometimes a JSON string). */
export interface AccountActivityItem {
  id: string;
  eventType: AccountActivityEventType;
  occurredAtUtc: IsoDateTime;
  success: boolean;
  ipAddress: string | null;
  userAgent: string | null;
  sessionId: string | null;
  details: string | null;
}

/** C# AccountActivityResponse. */
export interface AccountActivityResponse {
  items: AccountActivityItem[];
  page: number;
  pageSize: number;
  totalCount: number;
}

/** C# CurrentIdentityResponse (GET /api/v1/identity/me). authTime = server "now"; amr always "pwd". */
export interface CurrentIdentityResponse {
  userId: string;
  email: string;
  emailVerified: boolean;
  mobile: string;
  mobileVerified: boolean;
  status: AccountStatus;
  authTime: IsoDateTime;
  amr: 'pwd';
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
}

// ---------------------------------------------------------------------------
// Password
// ---------------------------------------------------------------------------

/** C# ForgotPasswordRequest. */
export interface ForgotPasswordRequest {
  emailOrMobile: string;
}

/** C# ForgotPasswordResponse (always 200). */
export interface ForgotPasswordResponse {
  message: string;
}

/** C# ResetPasswordRequest. stepUpToken is accepted but ignored by the server. */
export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
  emailOrMobile: string | null;
  stepUpToken: string | null;
}

/** C# ResetPasswordResponse. */
export interface ResetPasswordResponse {
  message: string;
}

/** C# ChangePasswordRequest. stepUpToken is accepted but ignored. All sessions (incl. current) are revoked on success. */
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  stepUpToken: string | null;
}

/** C# ChangePasswordResponse. */
export interface ChangePasswordResponse {
  message: string;
}

// ---------------------------------------------------------------------------
// MFA management
// ---------------------------------------------------------------------------

/** C# MfaStatusResponse. */
export interface MfaStatusResponse {
  enabled: boolean;
  type: MfaMethodType | null;
}

/** C# RegisterMfaRequest (type ignored; always EMAIL_OTP). */
export interface RegisterMfaRequest {
  type: MfaMethodType;
}

/** C# RegisterMfaResponse. secret/qrCodeUri are always "" and recoveryCodes always []. */
export interface RegisterMfaResponse {
  secret: string;
  qrCodeUri: string;
  recoveryCodes: string[];
  message: string;
  challengeId: string | null;
}

/** C# ConfirmMfaRequest. code must be 6 chars; challengeId required. */
export interface ConfirmMfaRequest {
  type: MfaMethodType;
  code: string;
  challengeId: string | null;
}

/** C# DisableMfaRequest. stepUpToken = VerifyStepUpResponse.verificationToken for MFA_DISABLE (server bug: currently always 422). */
export interface DisableMfaRequest {
  type: MfaMethodType;
  stepUpToken: string;
}

// ---------------------------------------------------------------------------
// Step-up
// ---------------------------------------------------------------------------

/** C# InitiateStepUpRequest. */
export interface InitiateStepUpRequest {
  targetAction: StepUpTargetAction;
}

/** C# InitiateStepUpResponse. */
export interface InitiateStepUpResponse {
  stepUpId: string;
  expiresInSeconds: number;
  message: string;
}

/** C# VerifyStepUpRequest. */
export interface VerifyStepUpRequest {
  stepUpId: string;
  code: string;
}

/** C# VerifyStepUpResponse. verificationToken: single-use, 5 min, standard base64; sent in request BODY (no header is read). */
export interface VerifyStepUpResponse {
  verificationToken: string;
  message: string;
}

// ---------------------------------------------------------------------------
// Admin user status
// ---------------------------------------------------------------------------

/**
 * C# AdminUpdateUserStatusRequest (POST /api/v1/identity/admin/users/status and PUT .../{id}/status).
 * For PUT the route id overrides userId, but userId must still be present (non-nullable) — send "" or the id.
 * status is parsed case-insensitively; send canonical names only.
 */
export interface AdminUpdateUserStatusRequest {
  userId: string;
  status: AccountStatus;
  reason: string;
}

// ---------------------------------------------------------------------------
// Registration / verification / invitations (anonymous flows)
// ---------------------------------------------------------------------------

/** C# RegisterRequest. */
export interface RegisterRequest {
  email: string;
  mobile: string;
  password: string;
  firstName: string;
  lastName: string;
  displayName: string;
}

/** C# RegisterResponse (201). */
export interface RegisterResponse {
  userId: string;
  email: string;
  mobile: string;
  status: 'PendingVerification';
  message: string;
}

/** C# VerifyRegistrationRequest. */
export interface VerifyRegistrationRequest {
  userId: string;
  channel: VerificationChannel;
  token: string;
}

/** C# VerifyRegistrationResponse. */
export interface VerifyRegistrationResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
  userId: string | null;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
}

/** C# SendEmailVerificationRequest. */
export interface SendEmailVerificationRequest {
  email: string;
}

/** C# ConfirmEmailVerificationRequest. */
export interface ConfirmEmailVerificationRequest {
  email: string;
  token: string;
}

/** C# SendMobileVerificationRequest. */
export interface SendMobileVerificationRequest {
  mobile: string;
}

/** C# ConfirmMobileVerificationRequest. */
export interface ConfirmMobileVerificationRequest {
  mobile: string;
  token: string;
}

/** C# ValidateInvitationRequest. */
export interface ValidateInvitationRequest {
  invitationToken: string;
}

/** C# ValidateInvitationResponse. */
export interface ValidateInvitationResponse {
  invitedEmail: string;
  expiresAtUtc: IsoDateTime;
  accountState: 'NEW' | 'EXISTING_VERIFIED' | 'EXISTING_UNVERIFIED';
}

/** C# RegisterInvitedUserRequest. password 8..100 chars. */
export interface RegisterInvitedUserRequest {
  invitationToken: string;
  firstName: string;
  lastName: string;
  displayName: string;
  password: string;
  mobile: string | null;
}

/** C# RegisterInvitedUserResponse (201). */
export interface RegisterInvitedUserResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
  userId: string;
  firstName: string;
  lastName: string;
  displayName: string;
  invitationAccepted: boolean;
}

/** C# ServiceTokenRequest (POST /api/v1/auth/token). */
export interface ServiceTokenRequest {
  clientId: string;
  clientSecret: string;
  scope: string | null;
}

/** C# ServiceTokenResponse. */
export interface ServiceTokenResponse {
  accessToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

/** JWKS document (JwksController / JwtTokenGenerator.GetJwksJson). */
export interface JsonWebKeySet {
  keys: Array<{ kty: 'RSA'; use: 'sig'; alg: 'RS256'; kid: string; n: string; e: string }>;
}


/** accountState of ValidateInvitationResponse: log in (EXISTING_VERIFIED), verify first (EXISTING_UNVERIFIED) or create an account (NEW). */
export type InvitationAccountState = ValidateInvitationResponse["accountState"];
