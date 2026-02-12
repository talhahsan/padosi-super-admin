"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LogOut, Loader2, Menu } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth-context"
import { cn } from "@/lib/utils"
import { ThemeToggle } from "@/components/theme-toggle"
import { LanguageToggle } from "@/components/language-toggle"
import { useLocale } from "@/lib/locale-context"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"

export function DashboardHeader() {
  const { logout, isLoggingOut } = useAuth()
  const pathname = usePathname()
  const { t, isRTL } = useLocale()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const navLinks = [
    { href: "/communities", label: t("header.communities") },
    { href: "/communities/create", label: t("header.createCommunity") },
  ]

  function isLinkActive(href: string) {
    if (href === "/communities/create") return pathname === href
    if (href === "/communities") {
      return pathname === href || pathname.startsWith("/communities/")
    }
    return pathname === href
  }

  return (
    <header className="sticky top-0 z-50 animate-slide-down">
      <div className="mx-auto max-w-7xl px-4 pb-2 pt-3 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-[26px] border border-primary-foreground/20 bg-primary/80 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.8)] backdrop-blur-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/80 via-primary/70 to-primary/85" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary-foreground/45 to-transparent" />
          <div className="absolute -left-24 top-0 h-44 w-44 rounded-full bg-secondary/30 blur-3xl" />
          <div className="absolute -right-20 bottom-0 h-40 w-40 rounded-full bg-accent/25 blur-3xl" />

          <div className="relative p-3 sm:p-4">
            <div className={cn("flex items-center justify-between gap-3", isRTL && "flex-row-reverse")}>
              <Link href="/communities" className="group flex min-w-0 items-center gap-2.5 rounded-xl border border-primary-foreground/20 bg-primary-foreground/10 px-2.5 py-2 shadow-inner shadow-black/10 ring-1 ring-primary-foreground/15 transition-all duration-300 hover:bg-primary-foreground/15">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-foreground/15 ring-1 ring-primary-foreground/25 transition-all duration-300 group-hover:scale-105 group-hover:bg-primary-foreground/20">
                  <img
                    src="/padosi-logo.svg"
                    alt="Padosi logo"
                    className="h-6 w-auto transition-transform duration-300 group-hover:scale-110"
                  />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold tracking-wide text-primary-foreground">Padosi</p>
                  <p className="truncate text-[10px] font-semibold uppercase tracking-[0.2em] text-primary-foreground/70">
                    {t("header.adminPortal")}
                  </p>
                </div>
              </Link>

              <nav className="hidden items-center gap-1 rounded-xl border border-primary-foreground/20 bg-primary-foreground/10 p-1.5 shadow-inner shadow-black/10 lg:flex">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-semibold transition-all duration-200",
                      isLinkActive(link.href)
                        ? "bg-primary-foreground text-primary shadow-[0_6px_20px_-8px_rgba(0,0,0,0.6)]"
                        : "text-primary-foreground/85 hover:bg-primary-foreground/15 hover:text-primary-foreground",
                    )}
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>

              <div className={cn("hidden shrink-0 items-center gap-2 lg:flex", isRTL && "flex-row-reverse")}>
                <LanguageToggle
                  className="border-primary-foreground/35 bg-primary-foreground/10 text-primary-foreground ring-primary-foreground/25"
                  activeClassName="bg-primary-foreground text-primary"
                  inactiveClassName="text-primary-foreground/85 hover:bg-primary-foreground/15 hover:text-primary-foreground"
                />
                <ThemeToggle
                  iconOnly
                  className="rounded-lg border-primary-foreground/35 bg-primary-foreground/10 text-primary-foreground ring-primary-foreground/25 hover:bg-primary-foreground/20 hover:text-primary-foreground"
                />
                <Button
                  variant="ghost"
                  onClick={logout}
                  disabled={isLoggingOut}
                  className="h-10 rounded-lg border border-primary-foreground/25 bg-primary-foreground/10 px-3 text-primary-foreground/90 shadow-inner shadow-black/10 hover:bg-primary-foreground/20 hover:text-primary-foreground"
                >
                  {isLoggingOut ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <LogOut className="h-4 w-4" />
                  )}
                  <span>{t("header.logout")}</span>
                </Button>
              </div>

              <div className={cn("flex shrink-0 items-center gap-2 lg:hidden", isRTL && "flex-row-reverse")}>
                <ThemeToggle
                  iconOnly
                  className="rounded-lg border-primary-foreground/35 bg-primary-foreground/10 text-primary-foreground ring-primary-foreground/25 hover:bg-primary-foreground/20 hover:text-primary-foreground"
                />
                <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                  <SheetTrigger asChild>
                    <Button
                      variant="ghost"
                      className="h-10 w-10 rounded-lg border border-primary-foreground/30 bg-primary-foreground/10 p-0 text-primary-foreground/90 hover:bg-primary-foreground/20 hover:text-primary-foreground"
                      aria-label="Open menu"
                    >
                      <Menu className="h-4 w-4" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent
                    side="top"
                    className="max-h-[88vh] overflow-y-auto rounded-b-3xl border-border/70 bg-background/85 p-5 shadow-2xl backdrop-blur-2xl"
                  >
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-secondary/10 via-transparent to-accent/10" />
                    <div className="pr-8">
                      <SheetTitle className={cn("text-base font-semibold", isRTL && "text-right")}>
                        {t("header.adminPortal")}
                      </SheetTitle>
                    </div>
                    <div className="relative mt-5 space-y-4">
                      <nav className="space-y-1.5">
                        {navLinks.map((link) => (
                          <Link
                            key={link.href}
                            href={link.href}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className={cn(
                              "flex items-center rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
                              isLinkActive(link.href)
                                ? "bg-primary text-primary-foreground shadow-sm"
                                : "border border-transparent bg-card/65 text-foreground/85 hover:border-border/60 hover:bg-card hover:text-foreground",
                              isRTL && "justify-end text-right",
                            )}
                          >
                            {link.label}
                          </Link>
                        ))}
                      </nav>

                      <div className="rounded-xl border border-border/70 bg-card/70 p-2 shadow-inner shadow-black/5">
                        <LanguageToggle className="w-full justify-center" />
                      </div>

                      <Button
                        variant="ghost"
                        onClick={async () => {
                          setIsMobileMenuOpen(false)
                          await logout()
                        }}
                        disabled={isLoggingOut}
                        className="h-11 w-full justify-center rounded-xl border border-border/70 bg-card/85 text-foreground shadow-inner shadow-black/5 hover:bg-muted"
                      >
                        {isLoggingOut ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <LogOut className="h-4 w-4" />
                        )}
                        <span>{t("header.logout")}</span>
                      </Button>
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
