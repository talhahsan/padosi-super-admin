"use client"

import { useEffect } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"

import { LoginForm } from "@/components/login-form"
import { useAuth } from "@/lib/auth-context"
import { useLocale } from "@/lib/locale-context"

export default function LoginPage() {
  const { t } = useLocale()
  const { isAuthenticated } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/communities")
    }
  }, [isAuthenticated, router])

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-muted px-4 py-12">
      <div className="pointer-events-none absolute -left-28 top-12 h-64 w-64 rounded-full bg-secondary/20 blur-3xl animate-drift" />
      <div className="pointer-events-none absolute -right-24 bottom-10 h-72 w-72 rounded-full bg-accent/25 blur-3xl animate-float-soft" />

      <div className="relative flex w-full max-w-lg flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border/60 bg-background/70 px-6 py-4 shadow-md backdrop-blur-sm animate-slide-up">
          <Image src="/padosi-logo.svg" alt="Padosi" width={120} height={48} className="h-12 w-auto" priority />
          <p className="text-sm font-medium text-muted-foreground tracking-[0.12em] uppercase">
            {t("loginPage.superAdminPortal")}
          </p>
        </div>

        <div className="w-full animate-scale-in stagger-2">
          <LoginForm />
        </div>
      </div>
    </main>
  )
}
