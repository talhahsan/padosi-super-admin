"use client"

import { useState, useEffect, useRef, useCallback, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Search, Loader2, Plus, Users, MapPin, Home, LayoutGrid, Rows3, Copy, Check, ShieldCheck, ShieldX } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { useAuth } from "@/lib/auth-context"
import { AUTH_STORAGE_KEY } from "@/lib/auth-constants"
import { fetchCommunityCount, type Community, type CommunityCountData, updateCommunityStatus } from "@/lib/api"
import { getInitials, getMemberOverflow } from "@/lib/community-utils"
import { useLocale } from "@/lib/locale-context"
import { cn } from "@/lib/utils"
import { useCommunities } from "@/hooks/use-communities"

const LIMIT = 12
const COMMUNITY_COUNT_CACHE_KEY = "padosi_community_count"
const COMMUNITY_DETAILS_CACHE_KEY = "padosi_selected_community"
const COMMUNITY_COUNT_POLL_MS = 8000

function readCommunityCountCache(): CommunityCountData | null {
  if (typeof window === "undefined") return null

  try {
    const raw = sessionStorage.getItem(COMMUNITY_COUNT_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<CommunityCountData>
    if (
      typeof parsed.totalCommunities === "number" &&
      typeof parsed.activeCommunities === "number" &&
      typeof parsed.inactiveCommunities === "number"
    ) {
      return {
        totalCommunities: parsed.totalCommunities,
        activeCommunities: parsed.activeCommunities,
        inactiveCommunities: parsed.inactiveCommunities,
      }
    }
  } catch {
    sessionStorage.removeItem(COMMUNITY_COUNT_CACHE_KEY)
  }

  return null
}

function writeCommunityCountCache(value: CommunityCountData) {
  if (typeof window === "undefined") return
  sessionStorage.setItem(COMMUNITY_COUNT_CACHE_KEY, JSON.stringify(value))
}

function isSameCommunityCount(a: CommunityCountData, b: CommunityCountData) {
  return (
    a.totalCommunities === b.totalCommunities &&
    a.activeCommunities === b.activeCommunities &&
    a.inactiveCommunities === b.inactiveCommunities
  )
}

function normalizeCommunityCountData(input: unknown): CommunityCountData {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid community count payload")
  }

  const raw = input as Partial<Record<keyof CommunityCountData, number | string>>
  const totalCommunities = Number(raw.totalCommunities)
  const activeCommunities = Number(raw.activeCommunities)
  const inactiveCommunities = Number(raw.inactiveCommunities)

  if (
    !Number.isFinite(totalCommunities) ||
    !Number.isFinite(activeCommunities) ||
    !Number.isFinite(inactiveCommunities)
  ) {
    throw new Error("Community count payload has invalid values")
  }

  return {
    totalCommunities,
    activeCommunities,
    inactiveCommunities,
  }
}

function resolveAccessToken(preferredToken?: string): string | undefined {
  if (preferredToken) return preferredToken
  if (typeof window === "undefined") return undefined

  try {
    const raw = sessionStorage.getItem(AUTH_STORAGE_KEY)
    if (!raw) return undefined
    const parsed = JSON.parse(raw) as { accessToken?: unknown }
    return typeof parsed.accessToken === "string" && parsed.accessToken.trim()
      ? parsed.accessToken
      : undefined
  } catch {
    return undefined
  }
}

export function CommunityList() {
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null)
  const [communityCount, setCommunityCount] = useState<CommunityCountData | null>(null)
  const [statusOverrides, setStatusOverrides] = useState<Record<string, "ACTIVE" | "INACTIVE">>({})
  const [statusUpdatingMap, setStatusUpdatingMap] = useState<Record<string, boolean>>({})
  const searchInputRef = useRef<HTMLInputElement>(null)

  const { isAuthenticated, tokens } = useAuth()
  const { t, isRTL } = useLocale()
  const router = useRouter()

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login")
    }
  }, [isAuthenticated, router])

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
    }, 400)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    const storedView = localStorage.getItem("padosi_communities_view")

    if (storedView === "grid" || storedView === "list") {
      setViewMode(storedView)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem("padosi_communities_view", viewMode)
  }, [viewMode])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      const isTyping =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      if (isTyping) return

      if (e.key === "/") {
        e.preventDefault()
        searchInputRef.current?.focus()
      } else if (e.key.toLowerCase() === "g") {
        setViewMode("grid")
      } else if (e.key.toLowerCase() === "l") {
        setViewMode("list")
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  useEffect(() => {
    const accessToken = resolveAccessToken(tokens?.accessToken)
    if (!accessToken) return

    let cancelled = false
    let inFlight = false
    const cachedCount = readCommunityCountCache()
    if (cachedCount) {
      setCommunityCount(cachedCount)
    }

    const syncCommunityCount = async (showError: boolean) => {
      if (inFlight || cancelled) return
      inFlight = true
      try {
        const response = await fetchCommunityCount(accessToken)
        if (cancelled) return

        const nextCount = normalizeCommunityCountData(response.data)
        writeCommunityCountCache(nextCount)
        setCommunityCount((previous) => {
          if (previous && isSameCommunityCount(previous, nextCount)) {
            return previous
          }
          return nextCount
        })
      } catch (error) {
        if (!cancelled && showError) {
          const message = error instanceof Error ? error.message : t("communities.fetchFailed")
          toast.error(message)
        }
      } finally {
        inFlight = false
      }
    }

    void syncCommunityCount(true)

    const intervalId = window.setInterval(() => {
      void syncCommunityCount(false)
    }, COMMUNITY_COUNT_POLL_MS)

    const onFocus = () => {
      void syncCommunityCount(false)
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void syncCommunityCount(false)
      }
    }

    window.addEventListener("focus", onFocus)
    document.addEventListener("visibilitychange", onVisibilityChange)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
      window.removeEventListener("focus", onFocus)
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [t, tokens?.accessToken])

  const onCommunitiesError = useCallback(
    (message: string) => {
      toast.error(message || t("communities.fetchFailed"))
    },
    [t],
  )

  const {
    communities,
    nextCursor,
    isLoading,
    isLoadingMore,
    loadMore,
  } = useCommunities({
    enabled: isAuthenticated,
    search: debouncedSearch,
    token: tokens?.accessToken,
    limit: LIMIT,
    onError: onCommunitiesError,
  })

  function getStatusColor(status: string) {
    switch (status?.toUpperCase()) {
      case "ACTIVE":
        return "bg-emerald-100 text-emerald-800 border-emerald-200"
      case "INACTIVE":
        return "bg-red-100 text-red-800 border-red-200"
      default:
        return "bg-muted text-muted-foreground border-border"
    }
  }

  async function handleCopyCode(code: string, id: string) {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedCodeId(id)
      toast.success(t("communities.copiedCode"))
      window.setTimeout(() => setCopiedCodeId((current) => (current === id ? null : current)), 1400)
    } catch {
      toast.error(t("communities.copyFailed"))
    }
  }

  function handleOpenCommunity(community: Community) {
    try {
      sessionStorage.setItem(COMMUNITY_DETAILS_CACHE_KEY, JSON.stringify(community))
    } catch {
      // no-op: still allow navigation even if cache write fails
    }
    router.push(`/communities/${community.id}`)
  }

  function getEffectiveStatus(community: Community): "ACTIVE" | "INACTIVE" {
    const override = statusOverrides[community.id]
    const rawStatus = override || community.status
    return rawStatus?.toUpperCase() === "ACTIVE" ? "ACTIVE" : "INACTIVE"
  }

  function updateCommunityCountForStatusChange(previousStatus: "ACTIVE" | "INACTIVE", nextStatus: "ACTIVE" | "INACTIVE") {
    if (previousStatus === nextStatus) return
    setCommunityCount((previous) => {
      if (!previous) return previous
      return {
        ...previous,
        activeCommunities: previous.activeCommunities + (nextStatus === "ACTIVE" ? 1 : -1),
        inactiveCommunities: previous.inactiveCommunities + (nextStatus === "INACTIVE" ? 1 : -1),
      }
    })
  }

  async function handleToggleCommunityStatus(community: Community, nextStatus: "ACTIVE" | "INACTIVE") {
    const accessToken = resolveAccessToken(tokens?.accessToken)
    if (!accessToken) {
      toast.error("You must be logged in.")
      router.push("/login")
      return
    }

    const currentStatus = getEffectiveStatus(community)
    if (currentStatus === nextStatus) return

    setStatusOverrides((previous) => ({ ...previous, [community.id]: nextStatus }))
    updateCommunityCountForStatusChange(currentStatus, nextStatus)
    setStatusUpdatingMap((previous) => ({ ...previous, [community.id]: true }))
    try {
      const response = await updateCommunityStatus(
        {
          communityId: community.id,
          status: nextStatus,
        },
        accessToken,
      )
      const resolvedStatus = response.data?.status === "ACTIVE" ? "ACTIVE" : "INACTIVE"
      if (resolvedStatus !== nextStatus) {
        setStatusOverrides((previous) => ({ ...previous, [community.id]: resolvedStatus }))
        updateCommunityCountForStatusChange(nextStatus, resolvedStatus)
      }
      toast.success(response.message || "Community status updated successfully.")
    } catch (error) {
      setStatusOverrides((previous) => ({ ...previous, [community.id]: currentStatus }))
      updateCommunityCountForStatusChange(nextStatus, currentStatus)
      const message = error instanceof Error ? error.message : "Failed to update community status."
      toast.error(message)
    } finally {
      setStatusUpdatingMap((previous) => ({ ...previous, [community.id]: false }))
    }
  }

  if (!isAuthenticated) return null

  return (
    <div className="flex flex-col gap-6">
      {/* Header Section */}
      <div className={cn("flex flex-col gap-4 rounded-2xl border border-border/70 bg-card/80 px-4 py-4 shadow-sm backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between sm:px-5 animate-slide-up", isRTL && "sm:flex-row-reverse")}>
        <div className={cn("space-y-1", isRTL && "text-right")}>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-secondary">
            {t("communities.superAdmin")}
          </p>
          <h1 className="text-2xl font-bold text-foreground">{t("communities.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("communities.subtitle")}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Link href="/communities/create-without-admin" className="w-full sm:w-auto">
            <Button variant="outline" className="w-full justify-center rounded-xl border-border/70 font-semibold shadow-sm transition-all duration-200 hover:shadow-md active:scale-[0.97] sm:w-auto">
              <Plus className="h-4 w-4" />
              Create Without Admin
            </Button>
          </Link>
          <Link href="/communities/create" className="w-full sm:w-auto">
            <Button className="w-full justify-center rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 font-semibold shadow-sm transition-all duration-200 hover:shadow-md active:scale-[0.97] sm:w-auto">
              <Plus className="h-4 w-4" />
              {t("communities.newCommunity")}
            </Button>
          </Link>
        </div>
      </div>

      {/* Search */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatsCard
          title={t("communities.totalCommunities")}
          value={communityCount?.totalCommunities}
          icon={<Home className="h-4 w-4" />}
          accentClassName="text-secondary"
        />
        <StatsCard
          title={t("communities.active")}
          value={communityCount?.activeCommunities}
          icon={<ShieldCheck className="h-4 w-4" />}
          accentClassName="text-emerald-600"
        />
        <StatsCard
          title={t("communities.inactive")}
          value={communityCount?.inactiveCommunities}
          icon={<ShieldX className="h-4 w-4" />}
          accentClassName="text-rose-600"
        />
      </div>

      {/* Search */}
      <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", isRTL && "sm:flex-row-reverse")}>
        <div className="relative w-full flex-1 animate-slide-up stagger-1 sm:max-w-lg lg:max-w-xl">
          <Search className={cn("absolute top-1/2 h-4 w-4 -translate-y-1/2 text-secondary", isRTL ? "right-3" : "left-3")} />
          <Input
            ref={searchInputRef}
            placeholder={t("communities.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn("h-11 rounded-xl border-border/80 bg-background/80 shadow-sm", isRTL ? "pr-10 text-right" : "pl-10")}
            aria-label={t("communities.searchAria")}
          />
        </div>
        <div className="inline-flex w-full items-center rounded-xl border border-border/70 bg-background/80 p-1 shadow-sm sm:w-auto">
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            className={cn(
              "inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors sm:flex-none",
              viewMode === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            {t("communities.gridView")}
          </button>
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={cn(
              "inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors sm:flex-none",
              viewMode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Rows3 className="h-3.5 w-3.5" />
            {t("communities.listView")}
          </button>
        </div>
      </div>

      <div className={cn("flex sm:justify-end", isRTL && "sm:justify-start")}>
        <p className={cn("text-xs text-muted-foreground", isRTL && "text-right")}>{t("communities.shortcutsHint")}</p>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:auto-rows-fr xl:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={`h-full animate-fade-in stagger-${Math.min(i + 1, 12)}`}>
              <SkeletonCommunityCard />
            </div>
          ))}
        </div>
      ) : communities.length === 0 ? (
        <Card className="border-0 shadow-md animate-scale-in">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Home className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-foreground">{t("communities.noCommunitiesFound")}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {debouncedSearch
                ? t("communities.tryAdjustingSearch")
                : t("communities.getStartedFirst")}
            </p>
            {!debouncedSearch && (
              <Link href="/communities/create" className="mt-4">
                <Button className="bg-accent text-accent-foreground hover:bg-accent/90 font-semibold">
                  <Plus className="h-4 w-4" />
                  {t("communities.createCommunity")}
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Community Cards */}
          <div className={cn(
            "grid gap-4",
            viewMode === "grid"
              ? "grid-cols-1 sm:grid-cols-2 sm:auto-rows-fr xl:grid-cols-3 2xl:grid-cols-4"
              : "grid-cols-1",
          )}>
            {communities.map((community, index) => (
              <div
                key={community.id}
                className={`h-full animate-slide-up stagger-${Math.min(index + 1, 12)}`}
              >
                <CommunityCard
                  community={community}
                  status={getEffectiveStatus(community)}
                  statusClassName={getStatusColor(getEffectiveStatus(community))}
                  t={t}
                  isRTL={isRTL}
                  compact={viewMode === "list"}
                  copiedCodeId={copiedCodeId}
                  isStatusUpdating={!!statusUpdatingMap[community.id]}
                  onCopyCode={handleCopyCode}
                  onToggleStatus={handleToggleCommunityStatus}
                  onOpenCommunity={handleOpenCommunity}
                />
              </div>
            ))}
          </div>

          {/* Load More */}
          {nextCursor && (
            <div className="flex justify-center pt-4 animate-fade-in">
              <Button
                variant="outline"
                onClick={loadMore}
                disabled={isLoadingMore}
                className="px-8 bg-transparent"
              >
                {isLoadingMore ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("communities.loading")}
                  </>
                ) : (
                  t("communities.loadMore")
                )}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function StatsCard({
  title,
  value,
  icon,
  accentClassName,
}: {
  title: string
  value?: number | null
  icon: ReactNode
  accentClassName: string
}) {
  const [displayValue, setDisplayValue] = useState<number | null>(
    typeof value === "number" ? value : null,
  )
  const displayValueRef = useRef<number | null>(displayValue)
  const timerRef = useRef<number | null>(null)
  const startDelayRef = useRef<number | null>(null)

  useEffect(() => {
    displayValueRef.current = displayValue
  }, [displayValue])

  useEffect(() => {
    if (typeof value !== "number") return

    if (startDelayRef.current) {
      window.clearTimeout(startDelayRef.current)
      startDelayRef.current = null
    }

    if (timerRef.current) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }

    const from = typeof displayValueRef.current === "number" ? displayValueRef.current : value
    if (from === value) {
      setDisplayValue(value)
      return
    }

    const distance = Math.abs(value - from)
    const step = Math.max(1, Math.ceil(distance / 30))
    const direction = value > from ? 1 : -1

    startDelayRef.current = window.setTimeout(() => {
      timerRef.current = window.setInterval(() => {
        const current = displayValueRef.current ?? from
        const next = current + step * direction
        const reachedTarget =
          direction > 0 ? next >= value : next <= value
        const committedValue = reachedTarget ? value : next

        displayValueRef.current = committedValue
        setDisplayValue(committedValue)

        if (reachedTarget && timerRef.current) {
          window.clearInterval(timerRef.current)
          timerRef.current = null
        }
      }, 65)
    }, 140)

    return () => {
      if (startDelayRef.current) {
        window.clearTimeout(startDelayRef.current)
        startDelayRef.current = null
      }
      if (timerRef.current) {
        window.clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [value])

  return (
    <Card className="border border-border/70 bg-card/80 shadow-sm">
      <CardContent className="flex items-center justify-between p-4">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
          <p className="text-2xl font-semibold tabular-nums text-foreground">
            {typeof displayValue === "number" ? displayValue : "—"}
          </p>
        </div>
        <div className={cn("rounded-lg bg-muted p-2.5", accentClassName)}>
          {icon}
        </div>
      </CardContent>
    </Card>
  )
}

function SkeletonCommunityCard() {
  return (
    <Card className="h-full min-h-[280px] border-0 shadow-md sm:min-h-[320px]">
      <CardContent className="flex h-full flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>

        <div className="flex items-center gap-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
        </div>

        <div className="min-h-5">
          <Skeleton className="h-4 w-4/5" />
        </div>

        <div className="mt-auto min-h-[42px] border-t border-border pt-3">
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-7 w-7 rounded-full" />
              ))}
            </div>
            <Skeleton className="h-3 w-16" />
          </div>
        </div>

        <div className="min-h-[30px] border-t border-border pt-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-10" />
            <Skeleton className="h-5 w-20 rounded" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function CommunityCard({
  community,
  status,
  statusClassName,
  t,
  isRTL,
  compact,
  copiedCodeId,
  isStatusUpdating,
  onCopyCode,
  onToggleStatus,
  onOpenCommunity,
}: {
  community: Community
  status: "ACTIVE" | "INACTIVE"
  statusClassName: string
  t: (key: string, params?: Record<string, string | number>) => string
  isRTL: boolean
  compact: boolean
  copiedCodeId: string | null
  isStatusUpdating: boolean
  onCopyCode: (code: string, id: string) => Promise<void>
  onToggleStatus: (community: Community, nextStatus: "ACTIVE" | "INACTIVE") => Promise<void>
  onOpenCommunity: (community: Community) => void
}) {
  if (compact) {
    return (
      <Card
        className="group relative cursor-pointer overflow-hidden border border-border/70 bg-card/95 shadow-[0_16px_34px_-24px_rgba(0,0,0,0.8)] transition-all duration-300 hover:-translate-y-[2px] hover:border-secondary/40 hover:shadow-[0_24px_48px_-24px_rgba(0,0,0,0.75)]"
        onClick={() => onOpenCommunity(community)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            onOpenCommunity(community)
          }
        }}
        role="button"
        tabIndex={0}
      >
        <CardContent className="relative p-0">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_10%_0%,rgba(255,255,255,0.16),rgba(255,255,255,0)_60%)]" />
          <div className="pointer-events-none absolute -right-14 top-0 h-32 w-32 rounded-full bg-secondary/12 blur-3xl transition-opacity duration-300 group-hover:opacity-90" />
          <div
            className={cn(
              "relative grid gap-4 p-4 md:grid-cols-2 xl:min-h-[140px] xl:grid-cols-[minmax(240px,2fr)_minmax(220px,1.1fr)_minmax(240px,1.2fr)] xl:items-center",
              isRTL && "xl:[direction:rtl]",
            )}
          >
            <div className="min-w-0 space-y-2 md:col-span-2 md:flex md:flex-col md:justify-center xl:col-span-1">
              <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse justify-end")}>
                <h3 className="truncate text-base font-semibold text-foreground">{community.name}</h3>
                <Badge variant="outline" className={`shrink-0 text-[11px] ${statusClassName}`}>
                  {status}
                </Badge>
              </div>
              <p className={cn("text-xs text-muted-foreground line-clamp-1", isRTL && "text-right")}>
                {community.description}
              </p>
              {community.address && (
                <div className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", isRTL && "flex-row-reverse justify-end text-right")}>
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span className="line-clamp-1">{community.address}</span>
                </div>
              )}
              <div
                className={cn(
                  "inline-flex w-full max-w-[220px] items-center justify-between gap-2 rounded-xl border px-2.5 py-1.5 shadow-sm",
                  status === "ACTIVE"
                    ? "border-emerald-500/35 bg-emerald-500/10"
                    : "border-rose-500/35 bg-rose-500/10",
                  isRTL ? "ml-auto" : "",
                )}
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                }}
              >
                <div className={cn("inline-flex items-center gap-1.5", isRTL && "flex-row-reverse")}>
                  <span className={cn("h-2 w-2 rounded-full", status === "ACTIVE" ? "bg-emerald-500" : "bg-rose-500")} />
                  <span className={cn("text-[10px] font-semibold uppercase tracking-[0.14em]", status === "ACTIVE" ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300")}>
                    {status === "ACTIVE" ? "Active" : "Inactive"}
                  </span>
                </div>
                {isStatusUpdating && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                <Switch
                  checked={status === "ACTIVE"}
                  disabled={isStatusUpdating}
                  onCheckedChange={(checked) => {
                    void onToggleStatus(community, checked ? "ACTIVE" : "INACTIVE")
                  }}
                  className="h-5 w-9 border border-border/70 bg-muted data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-rose-500"
                  aria-label={`Toggle ${community.name} status`}
                />
              </div>
            </div>

            <div className={cn("grid grid-cols-2 gap-2 md:col-span-1 rounded-xl border border-border/70 bg-background/55 p-2 shadow-inner shadow-black/5 xl:px-2", isRTL && "xl:border-x")}>
              <div className="flex h-[64px] flex-col items-center justify-center rounded-lg border border-border/60 bg-background/85 px-2 text-center">
                <p className="text-lg font-semibold tabular-nums leading-none text-foreground">{community.memberCount}</p>
                <p className="mt-1 text-[11px] leading-none text-muted-foreground">{t("communities.members")}</p>
              </div>

              <div className="flex h-[64px] flex-col items-center justify-center rounded-lg border border-border/60 bg-background/85 px-2 text-center">
                <p className="text-lg font-semibold tabular-nums leading-none text-foreground">{community.totalUnits}</p>
                <p className="mt-1 text-[11px] leading-none text-muted-foreground">{t("communities.units")}</p>
              </div>
            </div>

            <div
              className={cn(
                "grid items-center gap-3 rounded-xl border border-border/70 bg-background/65 p-2.5 shadow-inner shadow-black/5 md:col-span-2 xl:col-span-1",
                isRTL && "xl:[direction:ltr] xl:text-right",
              )}
            >
              <div className={cn("flex flex-wrap items-center justify-between gap-2 sm:flex-nowrap", isRTL && "flex-row-reverse")}>
                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {t("communities.code")}
                </span>
                {community.code ? (
                  <div className={cn("inline-flex w-full items-center justify-end gap-2 sm:w-auto", isRTL && "flex-row-reverse")}>
                    <code className="inline-flex h-7 min-w-[86px] max-w-[140px] items-center justify-center truncate rounded-md border border-border/70 bg-muted/80 px-2 text-[11px] font-mono text-foreground">
                      <span className="truncate" title={community.code}>{community.code}</span>
                    </code>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        void onCopyCode(community.code, community.id)
                      }}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:text-foreground"
                      aria-label={t("communities.copyCode")}
                      title={t("communities.copyCode")}
                    >
                      {copiedCodeId === community.id ? (
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                ) : (
                  <span className="inline-flex h-7 min-w-[86px] items-center justify-center rounded-md bg-muted px-2 text-[11px] text-muted-foreground">-</span>
                )}
              </div>

              <div className={cn("flex items-center justify-between gap-2 border-t border-border/60 pt-2", isRTL && "flex-row-reverse")}>
                <div className="flex -space-x-2">
                  {community.previewMembers?.slice(0, 3).map((member) => (
                    <Avatar key={member.id} className="h-7 w-7 border-2 border-card">
                      <AvatarImage src={member.profilePictureUrl || undefined} alt={member.name} />
                      <AvatarFallback className="bg-secondary text-secondary-foreground text-xs">
                        {getInitials(member.name)}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                </div>
                <span className="min-w-[54px] text-right text-xs tabular-nums text-muted-foreground">
                  {getMemberOverflow(community.memberCount, t)}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
      <Card className={cn(
      "group relative h-full cursor-pointer overflow-hidden border border-border/70 bg-card/95 shadow-[0_20px_42px_-24px_rgba(0,0,0,0.85)] transition-all duration-300 hover:border-secondary/45 hover:shadow-[0_28px_54px_-24px_rgba(0,0,0,0.8)]",
      compact ? "min-h-[220px]" : "min-h-[320px] hover:-translate-y-[4px]",
    )}
      onClick={() => onOpenCommunity(community)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onOpenCommunity(community)
        }
      }}
      role="button"
      tabIndex={0}
    >
      <CardContent className={cn("relative flex h-full flex-col p-5", compact ? "gap-3" : "gap-4")}>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(130%_90%_at_0%_0%,rgba(255,255,255,0.12),rgba(255,255,255,0)_58%)]" />
        <div className="pointer-events-none absolute -right-12 top-0 h-36 w-36 rounded-full bg-accent/15 blur-3xl transition-opacity duration-300 group-hover:opacity-95" />
        <div className="relative mb-1 h-1.5 w-full rounded-full bg-gradient-to-r from-secondary/75 via-accent/70 to-secondary/35 shadow-[0_0_18px_rgba(0,0,0,0.1)]" />
        {/* Header */}
        <div className={cn("relative flex items-start justify-between gap-3", isRTL && "flex-row-reverse")}>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-semibold tracking-[0.01em] text-foreground">
              {community.name}
            </h3>
            <p className={cn("mt-0.5 text-xs text-muted-foreground", compact ? "line-clamp-1" : "line-clamp-2")}>
              {community.description}
            </p>
          </div>
          <Badge
            variant="outline"
            className={`shrink-0 text-xs ${statusClassName}`}
          >
            {status}
          </Badge>
        </div>

        <div
          className={cn("flex", isRTL ? "justify-start" : "justify-end")}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
          }}
        >
          <div
            className={cn(
              "inline-flex items-center gap-2.5 rounded-2xl border px-3 py-2 shadow-sm backdrop-blur-sm transition-colors",
              status === "ACTIVE"
                ? "border-emerald-500/35 bg-emerald-500/10"
                : "border-rose-500/35 bg-rose-500/10",
            )}
          >
            <div className="flex items-center gap-1.5">
              <span className={cn("h-2.5 w-2.5 rounded-full", status === "ACTIVE" ? "bg-emerald-500" : "bg-rose-500")} />
              <span className={cn("text-[10px] font-semibold uppercase tracking-[0.16em]", status === "ACTIVE" ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300")}>
                {status === "ACTIVE" ? "Active" : "Inactive"}
              </span>
            </div>
            {isStatusUpdating && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            <Switch
              checked={status === "ACTIVE"}
              disabled={isStatusUpdating}
              onCheckedChange={(checked) => {
                void onToggleStatus(community, checked ? "ACTIVE" : "INACTIVE")
              }}
              className="border border-border/70 bg-muted data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-rose-500"
              aria-label={`Toggle ${community.name} status`}
            />
          </div>
        </div>

        {/* Stats */}
        <div className={cn("relative flex items-center gap-3 rounded-xl border border-border/60 bg-background/65 p-2.5 text-sm text-muted-foreground shadow-inner shadow-black/5", isRTL && "justify-end", compact && "flex-wrap")}>
          <div className={cn("inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background/75 px-2 py-1", isRTL && "flex-row-reverse")}>
            <Users className="h-3.5 w-3.5" />
            <span>{community.memberCount} {t("communities.members")}</span>
          </div>
          <div className={cn("inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background/75 px-2 py-1", isRTL && "flex-row-reverse")}>
            <Home className="h-3.5 w-3.5" />
            <span>{community.totalUnits} {t("communities.units")}</span>
          </div>
        </div>

        {/* Address */}
        <div className={cn("relative", compact ? "min-h-0" : "min-h-5")}>
          {community.address && (
            <div className={cn("inline-flex items-start gap-1.5 rounded-md border border-border/50 bg-background/55 px-2.5 py-1.5 text-sm text-muted-foreground", isRTL && "flex-row-reverse text-right")}>
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="line-clamp-1">{community.address}</span>
            </div>
          )}
        </div>

        {/* Preview Members */}
        <div className={cn("relative mt-auto border-t border-border/70 pt-3", compact ? "min-h-[38px]" : "min-h-[42px]")}>
          {community.previewMembers && community.previewMembers.length > 0 && (
            <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
              <div className="flex -space-x-2">
                {community.previewMembers.slice(0, 3).map((member) => (
                  <Avatar key={member.id} className="h-7 w-7 border-2 border-card">
                    <AvatarImage src={member.profilePictureUrl || undefined} alt={member.name} />
                    <AvatarFallback className="bg-secondary text-secondary-foreground text-xs">
                      {getInitials(member.name)}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </div>
              <span className="text-xs text-muted-foreground">
                {getMemberOverflow(community.memberCount, t)}
              </span>
            </div>
          )}
        </div>

        {/* Community Code */}
        <div className="relative min-h-[30px] border-t border-border/70 pt-3">
          {community.code && (
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background/65 px-2.5 py-1.5">
              <span className="text-xs text-muted-foreground">{t("communities.code")}</span>
              <div className="inline-flex items-center gap-1.5">
                <code className="rounded border border-border/60 bg-muted/80 px-2 py-0.5 text-xs font-mono text-foreground">
                  {community.code}
                </code>
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    void onCopyCode(community.code, community.id)
                  }}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={t("communities.copyCode")}
                  title={t("communities.copyCode")}
                >
                  {copiedCodeId === community.id ? (
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
