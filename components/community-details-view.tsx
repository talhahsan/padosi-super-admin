"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Building2, Loader2, Mail, MapPin, Phone, Search, Upload, User, UserCircle2, X } from "lucide-react"
import { toast } from "sonner"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { useAuth } from "@/lib/auth-context"
import { AUTH_STORAGE_KEY } from "@/lib/auth-constants"
import {
  assignCommunityAdmin,
  type Community,
  fetchCommunityAdminDetails,
  fetchCommunityUsers,
  getPreSignUrl,
  inviteCommunityAdmin,
  resendCommunityAdminInvite,
  updateCommunityStatus,
  uploadFileToPresignUrl,
  type CommunityAdminDetails,
  type CommunityUser,
} from "@/lib/api"
import { useLocale } from "@/lib/locale-context"
import { cn } from "@/lib/utils"

const COMMUNITY_DETAILS_CACHE_KEY = "padosi_selected_community"
const USERS_LIMIT = 10
const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"]
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

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

function readCachedCommunity(communityId: string): Community | null {
  if (typeof window === "undefined") return null

  try {
    const raw = sessionStorage.getItem(COMMUNITY_DETAILS_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Community>
    if (parsed?.id === communityId) {
      return parsed as Community
    }
  } catch {
    sessionStorage.removeItem(COMMUNITY_DETAILS_CACHE_KEY)
  }

  return null
}

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

export function CommunityDetailsView({ communityId }: { communityId: string }) {
  const { isAuthenticated, tokens } = useAuth()
  const { isRTL } = useLocale()
  const router = useRouter()

  const [community, setCommunity] = useState<Community | null>(null)
  const [admin, setAdmin] = useState<CommunityAdminDetails | null>(null)
  const [isLoadingAdmin, setIsLoadingAdmin] = useState(true)
  const [isResendingInvite, setIsResendingInvite] = useState(false)
  const [isAdminMissing, setIsAdminMissing] = useState(false)
  const [assigningUserId, setAssigningUserId] = useState<string | null>(null)
  const [inviteForm, setInviteForm] = useState({
    fullName: "",
    email: "",
    housePlot: "",
  })
  const [invitePictureKey, setInvitePictureKey] = useState("")
  const [invitePicturePreview, setInvitePicturePreview] = useState<string | null>(null)
  const [isUploadingInvitePicture, setIsUploadingInvitePicture] = useState(false)
  const [isInvitingAdmin, setIsInvitingAdmin] = useState(false)
  const [users, setUsers] = useState<CommunityUser[]>([])
  const [usersNextCursor, setUsersNextCursor] = useState<string | null>(null)
  const [isLoadingUsers, setIsLoadingUsers] = useState(true)
  const [isLoadingMoreUsers, setIsLoadingMoreUsers] = useState(false)
  const [usernameSearch, setUsernameSearch] = useState("")
  const [debouncedUsernameSearch, setDebouncedUsernameSearch] = useState("")
  const [isStatusUpdating, setIsStatusUpdating] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login")
      return
    }
    setCommunity(readCachedCommunity(communityId))
  }, [communityId, isAuthenticated, router])

  useEffect(() => {
    const accessToken = resolveAccessToken(tokens?.accessToken)
    if (!accessToken) return

    let cancelled = false
    setIsLoadingAdmin(true)
    setIsAdminMissing(false)

    fetchCommunityAdminDetails(communityId, accessToken)
      .then((response) => {
        if (cancelled) return
        const nextAdmin = response.data ?? null
        setAdmin(nextAdmin)
        setIsAdminMissing(!nextAdmin)
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : "Failed to fetch admin details"
        if (!cancelled) {
          const normalized = message.toLowerCase()
          const adminMissing =
            normalized.includes("no admin") ||
            normalized.includes("admin not found") ||
            normalized.includes("not assigned")

          if (adminMissing) {
            setAdmin(null)
            setIsAdminMissing(true)
          } else {
            toast.error(message)
          }
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingAdmin(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [communityId, tokens?.accessToken])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedUsernameSearch(usernameSearch.trim())
    }, 350)
    return () => window.clearTimeout(timer)
  }, [usernameSearch])

  useEffect(() => {
    const accessToken = resolveAccessToken(tokens?.accessToken)
    if (!accessToken) return

    let cancelled = false
    setIsLoadingUsers(true)

    fetchCommunityUsers({
      communityId,
      token: accessToken,
      limit: USERS_LIMIT,
      username: debouncedUsernameSearch || undefined,
    })
      .then((response) => {
        if (cancelled) return
        setUsers(response.data ?? [])
        setUsersNextCursor(response.pagination?.nextCursor || null)
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : "Failed to fetch users"
        if (!cancelled) {
          toast.error(message)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingUsers(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [communityId, debouncedUsernameSearch, tokens?.accessToken])

  const communityMeta = useMemo(() => {
    if (!community) return []
    return [
      { icon: <Building2 className="h-4 w-4" />, label: "Total Units", value: String(community.totalUnits) },
      { icon: <UserCircle2 className="h-4 w-4" />, label: "Members", value: String(community.memberCount) },
      { icon: <MapPin className="h-4 w-4" />, label: "Address", value: community.address || "-" },
      { icon: <User className="h-4 w-4" />, label: "Community Code", value: community.code || "-" },
    ]
  }, [community])

  async function handleResendInvite() {
    const accessToken = resolveAccessToken(tokens?.accessToken)
    if (!accessToken) {
      toast.error("You must be logged in.")
      return
    }
    if (!admin?.email) {
      toast.error("Admin email is missing.")
      return
    }

    setIsResendingInvite(true)
    try {
      const response = await resendCommunityAdminInvite(
        { communityId, email: admin.email },
        accessToken,
      )
      toast.success(response.message || "Invite resent successfully.")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to resend invite."
      toast.error(message)
    } finally {
      setIsResendingInvite(false)
    }
  }

  async function handleLoadMoreUsers() {
    const accessToken = resolveAccessToken(tokens?.accessToken)
    if (!accessToken || !usersNextCursor) return

    setIsLoadingMoreUsers(true)
    try {
      const response = await fetchCommunityUsers({
        communityId,
        token: accessToken,
        limit: USERS_LIMIT,
        cursor: usersNextCursor,
        username: debouncedUsernameSearch || undefined,
      })

      setUsers((previous) => {
        const existingIds = new Set(previous.map((item) => item.id))
        const incoming = response.data.filter((item) => !existingIds.has(item.id))
        return [...previous, ...incoming]
      })
      setUsersNextCursor(response.pagination?.nextCursor || null)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch more users"
      toast.error(message)
    } finally {
      setIsLoadingMoreUsers(false)
    }
  }

  async function handleAssignAdmin(userId: string) {
    const accessToken = resolveAccessToken(tokens?.accessToken)
    if (!accessToken) {
      toast.error("You must be logged in.")
      return
    }

    setAssigningUserId(userId)
    try {
      const response = await assignCommunityAdmin({ communityId, userId }, accessToken)
      toast.success(response.message || "Admin assigned successfully.")
      setIsAdminMissing(false)

      const adminResponse = await fetchCommunityAdminDetails(communityId, accessToken)
      setAdmin(adminResponse.data ?? null)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to assign admin."
      toast.error(message)
    } finally {
      setAssigningUserId(null)
    }
  }

  async function handleInvitePictureUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      toast.error("Only PNG, JPG, JPEG, and WEBP images are allowed.")
      event.target.value = ""
      return
    }

    if (file.size > MAX_FILE_SIZE) {
      toast.error("Image must be 5MB or smaller.")
      event.target.value = ""
      return
    }

    const accessToken = resolveAccessToken(tokens?.accessToken)
    if (!accessToken) {
      toast.error("You must be logged in.")
      event.target.value = ""
      return
    }

    const reader = new FileReader()
    reader.onloadend = () => setInvitePicturePreview(reader.result as string)
    reader.readAsDataURL(file)

    setIsUploadingInvitePicture(true)
    setInvitePictureKey("")
    try {
      const preSign = await getPreSignUrl(file.name, accessToken)
      await uploadFileToPresignUrl(preSign.data.url, file)
      setInvitePictureKey(preSign.data.key)
      toast.success("Profile picture uploaded.")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to upload picture."
      toast.error(message)
      setInvitePicturePreview(null)
      setInvitePictureKey("")
    } finally {
      setIsUploadingInvitePicture(false)
    }
  }

  function removeInvitePicture() {
    setInvitePicturePreview(null)
    setInvitePictureKey("")
  }

  async function handleInviteAdmin() {
    const accessToken = resolveAccessToken(tokens?.accessToken)
    if (!accessToken) {
      toast.error("You must be logged in.")
      return
    }
    if (!inviteForm.fullName.trim() || !inviteForm.email.trim() || !inviteForm.housePlot.trim()) {
      toast.error("Full name, email, and house/plot are required.")
      return
    }

    setIsInvitingAdmin(true)
    try {
      const response = await inviteCommunityAdmin({
        communityId,
        fullName: inviteForm.fullName.trim(),
        email: inviteForm.email.trim(),
        housePlot: inviteForm.housePlot.trim(),
        profilePicture: invitePictureKey,
      }, accessToken)

      toast.success(response.message || "Community admin invite sent successfully.")
      setInviteForm({ fullName: "", email: "", housePlot: "" })
      setInvitePictureKey("")
      setInvitePicturePreview(null)

      const adminResponse = await fetchCommunityAdminDetails(communityId, accessToken)
      setAdmin(adminResponse.data ?? null)
      setIsAdminMissing(!adminResponse.data)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to invite admin."
      toast.error(message)
    } finally {
      setIsInvitingAdmin(false)
    }
  }

  async function handleCommunityStatusToggle(checked: boolean) {
    const accessToken = resolveAccessToken(tokens?.accessToken)
    if (!accessToken) {
      toast.error("You must be logged in.")
      return
    }
    if (!community) {
      toast.error("Community details are not loaded.")
      return
    }

    const nextStatus = checked ? "ACTIVE" : "INACTIVE"
    const currentStatus = community.status?.toUpperCase() === "ACTIVE" ? "ACTIVE" : "INACTIVE"
    if (currentStatus === nextStatus) return

    setCommunity((previous) => {
      if (!previous) return previous
      const updated = { ...previous, status: nextStatus }
      try {
        sessionStorage.setItem(COMMUNITY_DETAILS_CACHE_KEY, JSON.stringify(updated))
      } catch {
        // no-op
      }
      return updated
    })
    setIsStatusUpdating(true)
    try {
      const response = await updateCommunityStatus(
        {
          communityId,
          status: nextStatus,
        },
        accessToken,
      )
      const resolvedStatus = response.data?.status === "ACTIVE" ? "ACTIVE" : "INACTIVE"
      if (resolvedStatus !== nextStatus) {
        setCommunity((previous) => {
          if (!previous) return previous
          const updated = { ...previous, status: resolvedStatus }
          try {
            sessionStorage.setItem(COMMUNITY_DETAILS_CACHE_KEY, JSON.stringify(updated))
          } catch {
            // no-op
          }
          return updated
        })
      }
      toast.success(response.message || "Community status updated successfully.")
    } catch (error) {
      setCommunity((previous) => {
        if (!previous) return previous
        const updated = { ...previous, status: currentStatus }
        try {
          sessionStorage.setItem(COMMUNITY_DETAILS_CACHE_KEY, JSON.stringify(updated))
        } catch {
          // no-op
        }
        return updated
      })
      const message = error instanceof Error ? error.message : "Failed to update community status."
      toast.error(message)
    } finally {
      setIsStatusUpdating(false)
    }
  }

  if (!isAuthenticated) return null

  return (
    <div className="flex flex-col gap-6">
      <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", isRTL && "sm:flex-row-reverse")}>
        <Link href="/communities" className="w-full sm:w-auto">
          <Button variant="outline" className="w-full border-border/70 bg-background/70 shadow-sm hover:bg-background sm:w-auto">
            <ArrowLeft className="h-4 w-4" />
            Back to communities
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Card className="relative overflow-hidden border border-border/70 bg-card/95 shadow-[0_14px_30px_-18px_rgba(0,0,0,0.5)]">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-secondary/8 via-transparent to-accent/10" />
          <CardContent className="p-5 sm:p-6">
            <div className={cn("flex items-start justify-between gap-3", isRTL && "flex-row-reverse")}>
              <div className={cn("space-y-1", isRTL && "text-right")}>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary">Community</p>
                <h1 className="text-2xl font-semibold text-foreground">
                  {community?.name ?? "Community Details"}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {community?.description ?? "Community summary from selected card."}
                </p>
              </div>
              {community?.status && (
                <Badge variant="outline" className={getStatusColor(community.status)}>
                  {community.status}
                </Badge>
              )}
            </div>

            {community && (
              <div
                className={cn(
                  "mt-4 inline-flex w-full max-w-[250px] items-center justify-between gap-2 rounded-xl border px-3 py-2 shadow-sm",
                  community.status?.toUpperCase() === "ACTIVE"
                    ? "border-emerald-500/35 bg-emerald-500/10"
                    : "border-rose-500/35 bg-rose-500/10",
                  isRTL && "ml-auto",
                )}
              >
                <div className={cn("inline-flex items-center gap-1.5", isRTL && "flex-row-reverse")}>
                  <span
                    className={cn(
                      "h-2.5 w-2.5 rounded-full",
                      community.status?.toUpperCase() === "ACTIVE" ? "bg-emerald-500" : "bg-rose-500",
                    )}
                  />
                  <span
                    className={cn(
                      "text-[10px] font-semibold uppercase tracking-[0.14em]",
                      community.status?.toUpperCase() === "ACTIVE"
                        ? "text-emerald-700 dark:text-emerald-300"
                        : "text-rose-700 dark:text-rose-300",
                    )}
                  >
                    {community.status?.toUpperCase() === "ACTIVE" ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="inline-flex items-center gap-2">
                  {isStatusUpdating && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                  <Switch
                    checked={community.status?.toUpperCase() === "ACTIVE"}
                    disabled={isStatusUpdating}
                    onCheckedChange={handleCommunityStatusToggle}
                    className="border border-border/70 bg-muted data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-rose-500"
                    aria-label="Toggle community status"
                  />
                </div>
              </div>
            )}

            {community ? (
              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {communityMeta.map((item) => (
                  <div key={item.label} className={cn("rounded-xl border border-border/70 bg-background/75 p-3.5 shadow-sm transition-colors hover:bg-background", isRTL && "text-right")}>
                    <div className={cn("mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground", isRTL && "flex-row-reverse justify-end")}>
                      {item.icon}
                      <span>{item.label}</span>
                    </div>
                    <p className="text-sm font-semibold text-foreground">{item.value}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-6 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                Community details are shown when opening this page from the communities list.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border border-border/70 bg-card/95 shadow-[0_14px_30px_-18px_rgba(0,0,0,0.5)]">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-accent/8 via-transparent to-secondary/8" />
          <CardContent className="p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary">Admin Details</p>

            {isLoadingAdmin ? (
              <div className="mt-4 space-y-3">
                <Skeleton className="h-14 w-full rounded-xl" />
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-16 w-full rounded-xl" />
              </div>
            ) : admin ? (
              <div className="mt-4 space-y-3">
                <div className={cn("flex items-center gap-3 rounded-xl border border-border/70 bg-background/75 p-3.5 shadow-sm", isRTL && "flex-row-reverse")}>
                  <Avatar className="h-12 w-12 border border-border/70 ring-2 ring-background">
                    <AvatarImage src={admin.profilePictureUrl || undefined} alt={admin.fullName} />
                    <AvatarFallback>{admin.fullName?.slice(0, 2).toUpperCase() || "AD"}</AvatarFallback>
                  </Avatar>
                  <div className={cn("min-w-0", isRTL && "text-right")}>
                    <p className="truncate text-sm font-semibold text-foreground">{admin.fullName}</p>
                    <p className="truncate text-xs text-muted-foreground">@{admin.username}</p>
                  </div>
                  <div className="ml-auto">
                    <Badge
                      variant="outline"
                      className={admin.isJoined === false
                        ? "border-amber-200 bg-amber-100 text-amber-800"
                        : "border-emerald-200 bg-emerald-100 text-emerald-800"}
                    >
                      {admin.isJoined === false ? "Invite Pending" : "Joined"}
                    </Badge>
                  </div>
                </div>

                <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value={admin.email} isRTL={isRTL} />
                <InfoRow icon={<Phone className="h-4 w-4" />} label="Phone" value={admin.mobileNumber} isRTL={isRTL} />
                <InfoRow icon={<MapPin className="h-4 w-4" />} label="House/Plot" value={admin.housePlot} isRTL={isRTL} />
                <div className={cn("rounded-xl border border-border/70 bg-background/75 p-3.5 shadow-sm", isRTL && "text-right")}>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Bio</p>
                  <p className="text-sm text-foreground">{admin.bio || "-"}</p>
                </div>
                {admin.isJoined === false && (
                  <Button
                    disabled={isResendingInvite}
                    className="h-11 w-full rounded-xl bg-accent text-accent-foreground hover:bg-accent/90"
                    onClick={handleResendInvite}
                  >
                    {isResendingInvite ? "Resending Invite..." : "Resend Invite"}
                  </Button>
                )}
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                {isAdminMissing
                  ? "No admin is assigned to this community. You can assign one user as admin from the users list below."
                  : "Admin details could not be loaded."}
              </div>
            )}

            {isAdminMissing && (
              <div className="mt-4 space-y-3 rounded-xl border border-border/70 bg-background/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary">Invite Admin</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    placeholder="Full Name"
                    value={inviteForm.fullName}
                    onChange={(event) => setInviteForm((prev) => ({ ...prev, fullName: event.target.value }))}
                  />
                  <Input
                    placeholder="Email"
                    type="email"
                    value={inviteForm.email}
                    onChange={(event) => setInviteForm((prev) => ({ ...prev, email: event.target.value }))}
                  />
                </div>
                <Input
                  placeholder="House/Plot"
                  value={inviteForm.housePlot}
                  onChange={(event) => setInviteForm((prev) => ({ ...prev, housePlot: event.target.value }))}
                />

                <div className="rounded-lg border border-border/70 bg-background/70 p-3">
                  {invitePicturePreview ? (
                    <div className="relative h-36 overflow-hidden rounded-lg">
                      <img src={invitePicturePreview} alt="Invite profile preview" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={removeInvitePicture}
                        className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/50 bg-black/50 text-white"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex h-24 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:bg-background">
                      {isUploadingInvitePicture ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4" />
                          Upload Profile Picture
                        </>
                      )}
                      <input
                        type="file"
                        accept=".png,.jpeg,.jpg,.webp"
                        className="hidden"
                        onChange={handleInvitePictureUpload}
                        disabled={isUploadingInvitePicture}
                      />
                    </label>
                  )}
                </div>

                <Button
                  onClick={handleInviteAdmin}
                  disabled={isInvitingAdmin || isUploadingInvitePicture}
                  className="h-10 w-full rounded-lg bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  {isInvitingAdmin ? "Sending Invite..." : "Invite Admin"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="relative overflow-hidden border border-border/70 bg-card/95 shadow-[0_16px_36px_-22px_rgba(0,0,0,0.55)]">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-secondary/10 via-transparent to-accent/8" />
        <CardContent className="p-5 sm:p-6">
          <div className={cn("mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", isRTL && "sm:flex-row-reverse")}>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary">Community Users</p>
            <div className="relative w-full sm:max-w-sm">
              <Search className={cn("absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground", isRTL ? "right-3" : "left-3")} />
              <Input
                value={usernameSearch}
                onChange={(event) => setUsernameSearch(event.target.value)}
                placeholder="Search by username..."
                className={cn("h-10 border-border/70 bg-background/80 shadow-sm focus-visible:ring-secondary/40", isRTL ? "pr-10 text-right" : "pl-10")}
              />
            </div>
          </div>

          {isLoadingUsers ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              No users found for this community.
            </div>
          ) : (
            <div className="space-y-2.5">
              {users.map((member) => (
                <div key={member.id} className={cn("group flex items-center gap-3 rounded-xl border border-border/70 bg-background/75 p-3.5 shadow-sm transition-all hover:-translate-y-[1px] hover:bg-background hover:shadow-md", isRTL && "flex-row-reverse")}>
                  <Avatar className="h-10 w-10 border border-border/70 ring-2 ring-background">
                    <AvatarImage src={member.profilePictureUrl || undefined} alt={member.fullName || member.username || "User"} />
                    <AvatarFallback>
                      {(member.fullName || member.username || "U").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className={cn("min-w-0 flex-1", isRTL && "text-right")}>
                    <p className="truncate text-sm font-semibold text-foreground">{member.fullName || "Unnamed User"}</p>
                    <p className="truncate text-xs text-muted-foreground">{member.username ? `@${member.username}` : "No username"}</p>
                  </div>
                  <div className={cn("text-right", isRTL && "text-left")}>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Plot</p>
                    <p className="text-xs font-medium text-foreground/80">{member.housePlot || "-"}</p>
                  </div>
                  {isAdminMissing && (
                    <Button
                      size="sm"
                      disabled={assigningUserId === member.id}
                      onClick={() => handleAssignAdmin(member.id)}
                      className="h-8 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                    >
                      {assigningUserId === member.id ? "Assigning..." : "Assign as Admin"}
                    </Button>
                  )}
                </div>
              ))}

              {usersNextCursor && (
                <div className="pt-2">
                  <Button
                    variant="outline"
                    onClick={handleLoadMoreUsers}
                    disabled={isLoadingMoreUsers}
                    className="w-full border-border/70 bg-background/80 shadow-sm hover:bg-background sm:w-auto"
                  >
                    {isLoadingMoreUsers ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      "Load More Users"
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function InfoRow({
  icon,
  label,
  value,
  isRTL,
}: {
  icon: ReactNode
  label: string
  value: string
  isRTL: boolean
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/75 p-3.5 shadow-sm transition-colors hover:bg-background", isRTL && "flex-row-reverse")}>
      <div className={cn("flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground", isRTL && "flex-row-reverse")}>
        {icon}
        <span>{label}</span>
      </div>
      <p className={cn("truncate text-sm font-semibold text-foreground", isRTL && "text-right")}>{value || "-"}</p>
    </div>
  )
}
