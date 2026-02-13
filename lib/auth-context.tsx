"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { AUTH_STATE_COOKIE, AUTH_STORAGE_KEY } from "@/lib/auth-constants"
import { setRefreshToken } from "@/lib/api"

interface AuthTokens {
  accessToken: string
  refreshToken: string
  accessTokenExpiresAt: string
  refreshTokenExpiresAt: string
}

interface AuthContextType {
  tokens: AuthTokens | null
  isAuthenticated: boolean
  login: (tokens: AuthTokens) => void
  logout: () => Promise<void>
  isLoggingOut: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface StoredAuthSession {
  accessToken: string
  accessTokenExpiresAt: string
  refreshTokenExpiresAt: string
}

function writeAuthStateCookie() {
  if (typeof document === "undefined") return
  document.cookie = `${AUTH_STATE_COOKIE}=1; Path=/; SameSite=Lax`
}

function clearAuthStateCookie() {
  if (typeof document === "undefined") return
  document.cookie = `${AUTH_STATE_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [tokens, setTokens] = useState<AuthTokens | null>(null)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [mounted, setMounted] = useState(false)
  const router = useRouter()

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(AUTH_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<StoredAuthSession>
        if (typeof parsed.accessToken === "string" && parsed.accessToken.trim()) {
          setTokens({
            accessToken: parsed.accessToken,
            accessTokenExpiresAt: typeof parsed.accessTokenExpiresAt === "string" ? parsed.accessTokenExpiresAt : "",
            refreshTokenExpiresAt: typeof parsed.refreshTokenExpiresAt === "string" ? parsed.refreshTokenExpiresAt : "",
            // Refresh token is intentionally not persisted.
            refreshToken: "",
          })
          writeAuthStateCookie()
        }
      }
    } catch {
      sessionStorage.removeItem(AUTH_STORAGE_KEY)
    }
    setMounted(true)

    const onAuthUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<AuthTokens>
      if (customEvent.detail?.accessToken) {
        setTokens(customEvent.detail)
      }
    }

    const onForceLogout = () => {
      setTokens(null)
      setRefreshToken(null)
      clearAuthStateCookie()
      sessionStorage.removeItem(AUTH_STORAGE_KEY)
      setIsLoggingOut(false)
      router.push("/login")
    }

    window.addEventListener("padosi-auth-updated", onAuthUpdated as EventListener)
    window.addEventListener("padosi-force-logout", onForceLogout)
    return () => {
      window.removeEventListener("padosi-auth-updated", onAuthUpdated as EventListener)
      window.removeEventListener("padosi-force-logout", onForceLogout)
    }
  }, [router])

  const login = useCallback((newTokens: AuthTokens) => {
    setTokens(newTokens)
    setRefreshToken(newTokens.refreshToken)
    sessionStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        accessToken: newTokens.accessToken,
        accessTokenExpiresAt: newTokens.accessTokenExpiresAt,
        refreshTokenExpiresAt: newTokens.refreshTokenExpiresAt,
      } satisfies StoredAuthSession),
    )
    writeAuthStateCookie()
  }, [])

  const logout = useCallback(async () => {
    setIsLoggingOut(true)
    // Clear local auth state and route to login.
    await new Promise((r) => setTimeout(r, 300))
    setTokens(null)
    setRefreshToken(null)
    clearAuthStateCookie()
    sessionStorage.removeItem(AUTH_STORAGE_KEY)
    setIsLoggingOut(false)
    router.push("/login")
  }, [router])

  if (!mounted) {
    return null
  }

  return (
    <AuthContext.Provider
      value={{
        tokens,
        isAuthenticated: !!tokens?.accessToken,
        login,
        logout,
        isLoggingOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
