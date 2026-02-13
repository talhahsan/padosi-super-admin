import { AUTH_STORAGE_KEY } from "@/lib/auth-constants"

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing ${name} environment variable`)
  }
  return value
}

const API_BASE_URL = requireEnv("NEXT_PUBLIC_API_BASE_URL")
const ADMIN_LOGIN_PATH = process.env.NEXT_PUBLIC_ADMIN_LOGIN_PATH || "/auth/login-admin"
const REFRESH_TOKEN_PATH = process.env.NEXT_PUBLIC_ADMIN_REFRESH_PATH || "/auth/refresh-token"

interface ApiResponse<T> {
  success: boolean
  message: string
  code: number
  data: T
}

interface LoginData {
  accessToken: string
  refreshToken: string
  accessTokenExpiresAt: string
  refreshTokenExpiresAt: string
}

interface PreSignData {
  key: string
  url: string
}

export interface CommunityMember {
  id: string
  name: string
  profilePicture: string
  profilePictureUrl: string
  housePlot: string
}

export interface Community {
  id: string
  name: string
  description: string
  totalUnits: number
  status: string
  memberCount: number
  code: string
  address: string
  createdAt: string
  updatedAt: string
  previewMembers: CommunityMember[]
}

interface CommunitiesResponse {
  success: boolean
  message: string
  code: number
  data: Community[]
  pagination: {
    nextCursor: string | null
  }
}

interface CursorPagination {
  nextCursor: string | null
}

export interface CommunityCountData {
  totalCommunities: number
  activeCommunities: number
  inactiveCommunities: number
}

export interface CommunityAdminDetails {
  id: string
  username: string
  fullName: string
  email: string
  mobileNumber: string
  housePlot: string
  profilePicture: string
  profilePictureUrl: string
  bio: string
  isJoined?: boolean
}

export interface CommunityUser {
  id: string
  username: string | null
  email: string | null
  fullName: string | null
  housePlot: string | null
  dateOfBirth: string | null
  gender: string | null
  bio: string | null
  interests: string[]
  profilePicture: string | null
  profilePictureUrl: string | null
}

interface CommunityUsersResponse {
  success: boolean
  message: string
  code: number
  data: CommunityUser[]
  pagination: CursorPagination
}

export interface CreateCommunityPayload {
  name: string
  description: string
  totalUnits: number
  address: string
  city: string
  adminName: string
  adminEmail: string
  adminHousePlot: string
  adminPhoneNumber: string
  adminPicture: string
}

export interface InviteCommunityAdminPayload {
  communityId: string
  fullName: string
  email: string
  housePlot: string
  profilePicture: string
}

interface RequestOptions extends RequestInit {
  token?: string
  _retryOn419?: boolean
}

let volatileRefreshToken: string | null = null

interface StoredAuthSession {
  accessToken: string
  accessTokenExpiresAt: string
  refreshTokenExpiresAt: string
}

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/$/, "")}/${path.replace(/^\//, "")}`
}

function getErrorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object") {
    const maybeMessage = (payload as { message?: unknown }).message
    if (typeof maybeMessage === "string" && maybeMessage.trim()) {
      return maybeMessage
    }
  }
  return fallback
}

function getPayloadCode(payload: unknown): number | null {
  if (!payload || typeof payload !== "object") return null
  const code = (payload as { code?: unknown }).code
  return typeof code === "number" ? code : null
}

function readStoredRefreshToken(): string | null {
  return volatileRefreshToken
}

function persistAuthSession(tokens: LoginData) {
  if (typeof window === "undefined") return
  const session: StoredAuthSession = {
    accessToken: tokens.accessToken,
    accessTokenExpiresAt: tokens.accessTokenExpiresAt,
    refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
  }
  sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session))
}

export function setRefreshToken(refreshToken: string | null | undefined) {
  volatileRefreshToken = typeof refreshToken === "string" && refreshToken.trim()
    ? refreshToken
    : null
}

function storeAuthTokens(tokens: LoginData) {
  if (typeof window === "undefined") return
  setRefreshToken(tokens.refreshToken)
  persistAuthSession(tokens)
  window.dispatchEvent(new CustomEvent("padosi-auth-updated", { detail: tokens }))
}

function forceLogoutFromApi() {
  if (typeof window === "undefined") return
  setRefreshToken(null)
  sessionStorage.removeItem(AUTH_STORAGE_KEY)
  window.dispatchEvent(new CustomEvent("padosi-force-logout"))
}

let refreshInFlight: Promise<LoginData> | null = null

async function refreshTokensWithLock(refreshToken: string): Promise<LoginData> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const response = await fetch(joinUrl(API_BASE_URL, REFRESH_TOKEN_PATH), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refreshToken }),
        cache: "no-store",
      })

      let payload: unknown = null
      const contentType = response.headers.get("content-type")
      if (contentType?.includes("application/json")) {
        payload = await response.json()
      } else {
        const textPayload = await response.text()
        payload = textPayload ? { message: textPayload } : null
      }

      const payloadCode = getPayloadCode(payload)
      if (payloadCode === 498) {
        forceLogoutFromApi()
        throw new Error(getErrorMessage(payload, "Invalid or expired refresh token"))
      }

      if (!response.ok) {
        throw new Error(getErrorMessage(payload, `Refresh token failed with status ${response.status}`))
      }

      const tokenData = normalizeLoginData(payload)
      storeAuthTokens(tokenData)
      return tokenData
    })().finally(() => {
      refreshInFlight = null
    })
  }

  return refreshInFlight
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { token, headers, _retryOn419 = true, ...rest } = options

  const response = await fetch(joinUrl(API_BASE_URL, path), {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  })

  let payload: unknown = null
  const contentType = response.headers.get("content-type")
  if (contentType?.includes("application/json")) {
    payload = await response.json()
  } else {
    const textPayload = await response.text()
    payload = textPayload ? { message: textPayload } : null
  }

  const payloadCode = getPayloadCode(payload)
  if (payloadCode === 498) {
    forceLogoutFromApi()
    throw new Error(getErrorMessage(payload, "Session invalid. Please log in again."))
  }

  if (_retryOn419 && payloadCode === 419) {
    const storedRefreshToken = readStoredRefreshToken()
    if (!storedRefreshToken) {
      throw new Error(getErrorMessage(payload, "Session expired. Please log in again."))
    }

    const refreshedTokens = await refreshTokensWithLock(storedRefreshToken)
    return request<T>(path, {
      ...options,
      token: refreshedTokens.accessToken,
      _retryOn419: false,
    })
  }

  if (!response.ok) {
    throw new Error(getErrorMessage(payload, `Request failed with status ${response.status}`))
  }

  return payload as T
}

function normalizeLoginData(payload: unknown): LoginData {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid login response")
  }

  const root = payload as { data?: unknown; message?: unknown; success?: unknown; code?: unknown }
  const dataSource =
    root.data && typeof root.data === "object" ? root.data : root

  const raw = dataSource as {
    accessToken?: string
    refreshToken?: string
    accessTokenExpiresAt?: string | number
    refreshTokenExpiresAt?: string | number
    access_token?: string
    refresh_token?: string
    access_token_expires_at?: string | number
    refresh_token_expires_at?: string | number
  }

  const accessToken = raw.accessToken ?? raw.access_token
  const refreshToken = raw.refreshToken ?? raw.refresh_token
  const accessTokenExpiresAt = raw.accessTokenExpiresAt ?? raw.access_token_expires_at
  const refreshTokenExpiresAt = raw.refreshTokenExpiresAt ?? raw.refresh_token_expires_at

  if (!accessToken || !refreshToken) {
    throw new Error("Login response does not include tokens")
  }

  return {
    accessToken,
    refreshToken,
    accessTokenExpiresAt: accessTokenExpiresAt != null ? String(accessTokenExpiresAt) : "",
    refreshTokenExpiresAt: refreshTokenExpiresAt != null ? String(refreshTokenExpiresAt) : "",
  }
}

export async function loginAdmin(email: string, password: string): Promise<ApiResponse<LoginData>> {
  const response = await request<unknown>(ADMIN_LOGIN_PATH, {
    method: "POST",
    body: JSON.stringify({ email, password }),
  })

  const loginData = normalizeLoginData(response)
  const wrapped = (response && typeof response === "object"
    ? (response as { success?: unknown; message?: unknown; code?: unknown })
    : {}) as { success?: unknown; message?: unknown; code?: unknown }

  return {
    success: typeof wrapped.success === "boolean" ? wrapped.success : true,
    message: typeof wrapped.message === "string" ? wrapped.message : "Login successful",
    code: typeof wrapped.code === "number" ? wrapped.code : 200,
    data: loginData,
  }
}

export async function refreshAuthToken(refreshToken: string): Promise<ApiResponse<LoginData>> {
  const response = await request<unknown>(REFRESH_TOKEN_PATH, {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
  })

  const tokenData = normalizeLoginData(response)
  setRefreshToken(tokenData.refreshToken)
  persistAuthSession(tokenData)
  const wrapped = (response && typeof response === "object"
    ? (response as { success?: unknown; message?: unknown; code?: unknown })
    : {}) as { success?: unknown; message?: unknown; code?: unknown }

  return {
    success: typeof wrapped.success === "boolean" ? wrapped.success : true,
    message: typeof wrapped.message === "string" ? wrapped.message : "Token refreshed successfully",
    code: typeof wrapped.code === "number" ? wrapped.code : 200,
    data: tokenData,
  }
}

export async function getPreSignUrl(filename: string, token: string): Promise<ApiResponse<PreSignData>> {
  const query = new URLSearchParams({ file: filename })
  const response = await request<ApiResponse<PreSignData>>(`/file/presign?${query.toString()}`, {
    method: "GET",
    token,
  })

  return response
}

export async function uploadFileToPresignUrl(url: string, file: File): Promise<void> {
  const response = await fetch(url, {
    method: "PUT",
    body: file,
    headers: {
      "Content-Type": file.type || "application/octet-stream",
    },
  })

  if (!response.ok) {
    throw new Error(`Upload failed with status ${response.status}`)
  }
}

export async function createCommunity(
  payload: CreateCommunityPayload,
  token: string,
): Promise<ApiResponse<unknown>> {
  return request<ApiResponse<unknown>>("/community/create", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  })
}

export async function fetchCommunities(params?: {
  search?: string
  limit?: number
  cursor?: string
  token?: string
}): Promise<CommunitiesResponse> {
  const query = new URLSearchParams()
  if (params?.search) query.set("search", params.search)
  if (params?.limit) query.set("limit", String(params.limit))
  if (params?.cursor) query.set("cursor", params.cursor)

  const path = `/auth/fetch-communities${query.toString() ? `?${query.toString()}` : ""}`
  return request<CommunitiesResponse>(path, { method: "GET", token: params?.token })
}

export async function fetchCommunityCount(token: string): Promise<ApiResponse<CommunityCountData>> {
  const query = new URLSearchParams({ _: String(Date.now()) })
  return request<ApiResponse<CommunityCountData>>(`/community/count?${query.toString()}`, {
    method: "GET",
    token,
    cache: "no-store",
  })
}

export async function fetchCommunityAdminDetails(
  communityId: string,
  token: string,
): Promise<ApiResponse<CommunityAdminDetails>> {
  const query = new URLSearchParams({ communityId })
  return request<ApiResponse<CommunityAdminDetails>>(`/community/admin-detail?${query.toString()}`, {
    method: "GET",
    token,
    cache: "no-store",
  })
}

export async function resendCommunityAdminInvite(
  payload: { communityId: string; email: string },
  token: string,
): Promise<ApiResponse<unknown>> {
  return request<ApiResponse<unknown>>("/community/resend-admin-invite", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  })
}

export async function assignCommunityAdmin(
  payload: { communityId: string; userId: string },
  token: string,
): Promise<ApiResponse<unknown>> {
  return request<ApiResponse<unknown>>("/community/assign-admin", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  })
}

export async function inviteCommunityAdmin(
  payload: InviteCommunityAdminPayload,
  token: string,
): Promise<ApiResponse<{
  inviteId: string
  communityId: string
  email: string
  expiresAt: string
}>> {
  return request<ApiResponse<{
    inviteId: string
    communityId: string
    email: string
    expiresAt: string
  }>>("/community/invite-admin", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  })
}

export async function fetchCommunityUsers(params: {
  communityId: string
  token: string
  limit?: number
  cursor?: string
  username?: string
}): Promise<CommunityUsersResponse> {
  const query = new URLSearchParams()
  query.set("communityId", params.communityId)
  if (params.limit) query.set("limit", String(params.limit))
  if (params.cursor) query.set("cursor", params.cursor)
  if (params.username) query.set("username", params.username)

  return request<CommunityUsersResponse>(`/user/all-users/?${query.toString()}`, {
    method: "GET",
    token: params.token,
    cache: "no-store",
  })
}
