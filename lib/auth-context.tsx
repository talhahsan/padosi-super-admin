"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import { useRouter } from "next/navigation"

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

const STORAGE_KEY = "padosi_auth_tokens"

export function AuthProvider({ children }: { children: ReactNode }) {
  const [tokens, setTokens] = useState<AuthTokens | null>(null)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [mounted, setMounted] = useState(false)
  const router = useRouter()

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY)
      if (stored) {
        setTokens(JSON.parse(stored))
      }
    } catch {
      sessionStorage.removeItem(STORAGE_KEY)
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
      sessionStorage.removeItem(STORAGE_KEY)
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
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(newTokens))
  }, [])

  const logout = useCallback(async () => {
    setIsLoggingOut(true)
    // Clear local auth state and route to login.
    await new Promise((r) => setTimeout(r, 300))
    setTokens(null)
    sessionStorage.removeItem(STORAGE_KEY)
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
