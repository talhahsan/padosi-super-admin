"use client"

import { cn } from "@/lib/utils"
import { useLocale } from "@/lib/locale-context"

export function LanguageToggle({
  className,
  activeClassName,
  inactiveClassName,
}: {
  className?: string
  activeClassName?: string
  inactiveClassName?: string
}) {
  const { locale, setLocale, t } = useLocale()

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-lg border border-border/80 bg-background/90 p-1 text-foreground shadow-sm ring-1 ring-black/5 backdrop-blur-sm dark:ring-white/10",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setLocale("en")}
        className={cn(
          "rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
          locale === "en"
            ? cn("bg-primary text-primary-foreground shadow-sm", activeClassName)
            : cn("text-foreground/75 hover:bg-muted/70 hover:text-foreground", inactiveClassName),
        )}
      >
        {t("common.english")}
      </button>
      <button
        type="button"
        onClick={() => setLocale("ur")}
        className={cn(
          "rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
          locale === "ur"
            ? cn("bg-primary text-primary-foreground shadow-sm", activeClassName)
            : cn("text-foreground/75 hover:bg-muted/70 hover:text-foreground", inactiveClassName),
        )}
      >
        {t("common.urdu")}
      </button>
    </div>
  )
}
