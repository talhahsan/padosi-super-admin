"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { useLocale } from "@/lib/locale-context"

export function ThemeToggle({
  className,
  iconOnly = false,
}: {
  className?: string
  iconOnly?: boolean
}) {
  const { theme, resolvedTheme, setTheme } = useTheme()
  const { t } = useLocale()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  function toggleTheme() {
    const nextTheme = (resolvedTheme || theme || "light") === "dark" ? "light" : "dark"
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const canUseViewTransition =
      typeof document !== "undefined" &&
      "startViewTransition" in document &&
      !prefersReducedMotion

    if (canUseViewTransition) {
      ;(
        document as Document & {
          startViewTransition: (cb: () => void) => { finished: Promise<void> }
        }
      ).startViewTransition(() => {
        setTheme(nextTheme)
      })
      return
    }

    if (typeof document !== "undefined") {
      document.documentElement.classList.add("theme-switching")
      window.setTimeout(() => {
        document.documentElement.classList.remove("theme-switching")
      }, 520)
    }
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        setTheme(nextTheme)
      })
    })
  }

  const current = mounted ? (resolvedTheme || theme || "light") : "light"
  const isDark = current === "dark"

  if (iconOnly) {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className={cn(
          "group relative inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border border-border/80 bg-background/90 text-foreground shadow-sm ring-1 ring-black/5 transition-all duration-300 hover:scale-105 hover:bg-muted/70 hover:text-foreground dark:ring-white/10",
          className,
        )}
        aria-label={isDark ? t("header.switchToLight") : t("header.switchToDark")}
        title={isDark ? t("header.switchToLight") : t("header.switchToDark")}
      >
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/0 via-accent/10 to-secondary/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        <Sun
          className={cn(
            "absolute h-4 w-4 text-accent transition-all duration-300",
            isDark ? "rotate-0 scale-100 opacity-100" : "rotate-90 scale-0 opacity-0",
          )}
        />
        <Moon
          className={cn(
            "absolute h-4 w-4 transition-all duration-300",
            isDark ? "-rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100",
          )}
        />
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn(
        "inline-flex h-10 items-center gap-2 rounded-xl border border-border/80 bg-background/90 px-3 text-sm font-medium text-foreground shadow-sm ring-1 ring-black/5 backdrop-blur-sm transition-all duration-300 hover:scale-[1.02] hover:bg-muted/60 dark:ring-white/10",
        className,
      )}
      aria-label={isDark ? t("header.switchToLight") : t("header.switchToDark")}
      title={isDark ? t("header.switchToLight") : t("header.switchToDark")}
    >
      <span className="relative inline-flex h-6 w-11 items-center rounded-full bg-muted p-0.5 transition-colors duration-300">
        <span
          className={cn(
            "absolute h-5 w-5 rounded-full bg-background shadow-sm transition-transform duration-300",
            isDark ? "translate-x-5" : "translate-x-0",
          )}
        />
        <Sun className="relative z-10 ml-0.5 h-3 w-3 text-accent" />
        <Moon className="relative z-10 ml-auto mr-0.5 h-3 w-3 text-secondary" />
      </span>
      <span className="min-w-10 text-left">{isDark ? t("common.light") : t("common.dark")}</span>
    </button>
  )
}
