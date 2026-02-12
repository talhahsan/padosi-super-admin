"use client"

import { LoginForm } from "@/components/login-form"
import { ThemeToggle } from "@/components/theme-toggle"
import { LanguageToggle } from "@/components/language-toggle"
import { useLocale } from "@/lib/locale-context"
import { cn } from "@/lib/utils"

export default function LoginPage() {
  const { t, isRTL } = useLocale()

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-muted px-4 py-12">
      <div className={cn("absolute top-4 z-20 flex items-center gap-2 sm:top-6", isRTL ? "left-4 sm:left-6" : "right-4 sm:right-6")}>
        <LanguageToggle className="border-border/85 bg-background/95" />
        <ThemeToggle className="rounded-xl border-border/85 bg-background/95 backdrop-blur-sm hover:bg-muted/60" />
      </div>
      <div className="pointer-events-none absolute -left-28 top-12 h-64 w-64 rounded-full bg-secondary/20 blur-3xl animate-drift" />
      <div className="pointer-events-none absolute -right-24 bottom-10 h-72 w-72 rounded-full bg-accent/25 blur-3xl animate-float-soft" />

      <div className="relative flex w-full max-w-lg flex-col items-center gap-8">
        {/* Title image outside the card */}
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border/60 bg-background/70 px-6 py-4 shadow-md backdrop-blur-sm animate-slide-up">
          <img src="/padosi-logo.svg" alt="Padosi" className="h-12 w-auto" />
          <p className="text-sm font-medium text-muted-foreground tracking-[0.12em] uppercase">
            {t("loginPage.superAdminPortal")}
          </p>
        </div>

        {/* Login card */}
        <div className="w-full animate-scale-in stagger-2">
          <LoginForm />
        </div>
      </div>
    </main>
  )
}
