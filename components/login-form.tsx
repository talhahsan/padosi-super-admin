"use client"

import React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Loader2, LogIn } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ValidationMessage } from "@/components/ui/validation-message"
import { useAuth } from "@/lib/auth-context"
import { loginAdmin } from "@/lib/api"
import { useLocale } from "@/lib/locale-context"
import { cn } from "@/lib/utils"

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function LoginForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})

  const { login } = useAuth()
  const { t, isRTL } = useLocale()
  const router = useRouter()

  function validate(): boolean {
    const newErrors: { email?: string; password?: string } = {}
    if (!email.trim()) {
      newErrors.email = t("login.emailRequired")
    } else if (!isValidEmail(email)) {
      newErrors.email = t("login.emailInvalid")
    }
    if (!password) {
      newErrors.password = t("login.passwordRequired")
    } else if (password.length > 15) {
      newErrors.password = t("login.passwordMax")
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setIsLoading(true)
    try {
      const response = await loginAdmin(email, password)
      login(response.data)
      toast.success(t("login.loginSuccess"))
      router.push("/communities")
    } catch (err) {
      const message = err instanceof Error ? err.message : t("login.loginFailed")
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="gradient-surface w-full border border-border/70 shadow-xl">
      <CardHeader className="items-center gap-2 px-8 pt-8 pb-2">
        <img
          src="/padosi-logo.svg"
          alt="Padosi logo"
          className="h-14 w-auto animate-slide-up"
        />
        <CardTitle className="sr-only">Padosi Super Admin</CardTitle>
        <CardDescription className="text-center text-sm text-muted-foreground animate-fade-in stagger-1">
          {t("login.signInToAccount")}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-8 pb-8 pt-2">
        <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="flex flex-col gap-2 animate-slide-up stagger-3">
            <Label htmlFor="email" className="text-foreground text-sm font-medium">
              {t("login.emailAddress")}
            </Label>
            <Input
              id="email"
              type="email"
              placeholder={t("login.emailPlaceholder")}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }))
              }}
              className={`h-12 text-base ${errors.email ? "border-destructive" : ""}`}
              autoComplete="email"
              aria-describedby={errors.email ? "email-error" : undefined}
              aria-invalid={!!errors.email}
            />
            {errors.email && (
              <ValidationMessage id="email-error" message={errors.email} />
            )}
          </div>

          <div className="flex flex-col gap-2 animate-slide-up stagger-4">
            <Label htmlFor="password" className="text-foreground text-sm font-medium">
              {t("login.password")}
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder={t("login.passwordPlaceholder")}
                value={password}
                maxLength={15}
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }))
                }}
                className={cn("h-12 text-base", isRTL ? "pl-12" : "pr-12", errors.password ? "border-destructive" : "")}
                autoComplete="current-password"
                aria-describedby={errors.password ? "password-error" : undefined}
                aria-invalid={!!errors.password}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className={cn("absolute top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors", isRTL ? "left-4" : "right-4")}
                aria-label={showPassword ? t("login.hidePassword") : t("login.showPassword")}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            {errors.password && (
              <ValidationMessage id="password-error" message={errors.password} />
            )}
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full bg-accent text-accent-foreground hover:bg-accent/90 h-12 text-base font-semibold animate-slide-up stagger-5 transition-transform active:scale-[0.98] mt-1"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                {t("login.signingIn")}
              </>
            ) : (
              <>
                <LogIn className="h-5 w-5" />
                {t("login.signIn")}
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
