"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Building2, Loader2, Mail, MapPin, PencilLine, Phone, Search, Trash2, Upload, User, UserCircle2, X } from "lucide-react"
import { toast } from "sonner"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/lib/auth-context"
import { AUTH_STORAGE_KEY } from "@/lib/auth-constants"
import {
  assignCommunityAdmin,
  type Community,
  deleteCommunityUser,
  fetchCommunityAdminDetails,
  fetchCommunityUsers,
  getPreSignUrl,
  inviteCommunityAdmin,
  removeCommunityAdmin,
  resendCommunityAdminInvite,
  deleteFileByName,
  deleteCommunity,
  updateCommunity,
  updateCommunityStatus,
  uploadFileToPresignUrl,
  type CommunityAdminDetails,
  type CommunityUser,
  toggleCommunityUserStatus,
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

function normalizeCommunityAdmins(payload: unknown): CommunityAdminDetails[] {
  if (!payload) return []

  if (Array.isArray(payload)) {
    return payload.filter((item): item is CommunityAdminDetails => typeof item === "object" && item !== null)
  }

  if (typeof payload === "object") {
    const candidate = payload as {
      admins?: unknown
      admin?: unknown
    }

    if (Array.isArray(candidate.admins)) {
      return candidate.admins.filter((item): item is CommunityAdminDetails => typeof item === "object" && item !== null)
    }

    if (candidate.admin && typeof candidate.admin === "object") {
      return [candidate.admin as CommunityAdminDetails]
    }

    return [payload as CommunityAdminDetails]
  }

  return []
}

function isMissingAdminMessage(message: string) {
  const normalized = message.toLowerCase()
  return (
    normalized.includes("no admin") ||
    normalized.includes("admin not found") ||
    normalized.includes("not assigned") ||
    normalized.includes("no admin found for the selected community") ||
    normalized === "no admin found for the selected community."
  )
}

export function CommunityDetailsView({ communityId }: { communityId: string }) {
  const { isAuthenticated, tokens } = useAuth()
  const { t, isRTL } = useLocale()
  const router = useRouter()

  const [community, setCommunity] = useState<Community | null>(null)
  const [admins, setAdmins] = useState<CommunityAdminDetails[]>([])
  const [isLoadingAdmin, setIsLoadingAdmin] = useState(true)
  const [isResendingInvite, setIsResendingInvite] = useState(false)
  const [assigningUserId, setAssigningUserId] = useState<string | null>(null)
  const [removingAdminId, setRemovingAdminId] = useState<string | null>(null)
  const [statusChangingUserId, setStatusChangingUserId] = useState<string | null>(null)
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null)
  const [inviteForm, setInviteForm] = useState({
    fullName: "",
    email: "",
    mobileNumber: "",
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
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isUpdatingCommunity, setIsUpdatingCommunity] = useState(false)
  const [isDeletingCommunity, setIsDeletingCommunity] = useState(false)
  const [mediaViewer, setMediaViewer] = useState<{
    open: boolean
    src: string | null
    title: string
    initials: string
  }>({
    open: false,
    src: null,
    title: t("communityDetails.mediaViewer"),
    initials: t("communityDetails.na"),
  })
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    address: "",
    totalUnits: "",
  })

  async function refreshAdmins(accessToken: string, isCancelled?: () => boolean) {
    const adminResponse = await fetchCommunityAdminDetails(communityId, accessToken)
    if (isCancelled?.()) return
    setAdmins(normalizeCommunityAdmins(adminResponse.data))
  }

  async function refreshUsers(accessToken: string, isCancelled?: () => boolean) {
    const response = await fetchCommunityUsers({
      communityId,
      token: accessToken,
      limit: USERS_LIMIT,
    })
    if (isCancelled?.()) return
    setUsers(response.data ?? [])
    setUsersNextCursor(response.pagination?.nextCursor || null)
  }

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

    refreshAdmins(accessToken, () => cancelled)
      .catch((error) => {
        const message = error instanceof Error ? error.message : t("communityDetails.fetchAdminFailed")
        if (!cancelled) {
          if (isMissingAdminMessage(message)) {
            setAdmins([])
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

    refreshUsers(accessToken, () => cancelled)
      .catch((error) => {
        const message = error instanceof Error ? error.message : t("communityDetails.fetchUsersFailed")
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
  }, [communityId, tokens?.accessToken])

  useEffect(() => {
    if (!community) return
    setEditForm({
      name: community.name || "",
      description: community.description || "",
      address: community.address || "",
      totalUnits: String(community.totalUnits ?? ""),
    })
  }, [community?.address, community?.description, community?.id, community?.name, community?.totalUnits])

  const hasAssignedAdmin = admins.length > 0

  const filteredUsers = useMemo(() => {
    const query = debouncedUsernameSearch.trim().toLowerCase()
    if (!query) return users

    return users.filter((member) => {
      const haystacks = [
        member.fullName,
        member.name,
        member.username,
        member.email,
        member.phoneNumber,
        member.housePlot,
      ]

      return haystacks.some((value) => value?.toLowerCase().includes(query))
    })
  }, [debouncedUsernameSearch, users])

  const communityMeta = useMemo(() => {
    if (!community) return []
    return [
      { icon: <Building2 className="h-4 w-4" />, label: t("communityDetails.totalUnitsStat"), value: String(community.totalUnits) },
      { icon: <UserCircle2 className="h-4 w-4" />, label: t("communityDetails.membersStat"), value: String(community.memberCount) },
      { icon: <MapPin className="h-4 w-4" />, label: t("communityDetails.address"), value: community.address || "-" },
      { icon: <User className="h-4 w-4" />, label: t("communityDetails.communityCode"), value: community.code || "-" },
    ]
  }, [community, t])

  function getInitials(value?: string | null) {
    if (!value) return t("communityDetails.na")
    const parts = value.trim().split(/\s+/).filter(Boolean)
    if (parts.length === 0) return t("communityDetails.na")
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase()
  }

  function openMediaViewer(src: string | null, title: string, initials?: string) {
    setMediaViewer({
      open: true,
      src,
      title,
      initials: initials || t("communityDetails.na"),
    })
  }

  async function handleResendInvite(email: string) {
    const accessToken = resolveAccessToken(tokens?.accessToken)
    if (!accessToken) {
      toast.error(t("communityDetails.mustBeLoggedIn"))
      return
    }
    if (!email) {
      toast.error(t("communityDetails.adminEmailMissing"))
      return
    }

    setIsResendingInvite(true)
    try {
      const response = await resendCommunityAdminInvite(
        { communityId, email },
        accessToken,
      )
      toast.success(response.message || t("communityDetails.resendInviteSuccess"))
    } catch (error) {
      const message = error instanceof Error ? error.message : t("communityDetails.resendInviteFailed")
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
      })

      setUsers((previous) => {
        const existingIds = new Set(previous.map((item) => item.id))
        const incoming = response.data.filter((item) => !existingIds.has(item.id))
        return [...previous, ...incoming]
      })
      setUsersNextCursor(response.pagination?.nextCursor || null)
    } catch (error) {
      const message = error instanceof Error ? error.message : t("communityDetails.fetchMoreUsersFailed")
      toast.error(message)
    } finally {
      setIsLoadingMoreUsers(false)
    }
  }

  async function handleAssignAdmin(userId: string) {
    const accessToken = resolveAccessToken(tokens?.accessToken)
    if (!accessToken) {
      toast.error(t("communityDetails.mustBeLoggedIn"))
      return
    }

    setAssigningUserId(userId)
    try {
      const response = await assignCommunityAdmin({ communityId, userId }, accessToken)
      toast.success(response.message || t("communityDetails.assignAdminSuccess"))

      await Promise.all([refreshAdmins(accessToken), refreshUsers(accessToken)])
    } catch (error) {
      const message = error instanceof Error ? error.message : t("communityDetails.assignAdminFailed")
      toast.error(message)
    } finally {
      setAssigningUserId(null)
    }
  }

  async function handleRemoveAdmin(userId: string) {
    const accessToken = resolveAccessToken(tokens?.accessToken)
    if (!accessToken) {
      toast.error(t("communityDetails.mustBeLoggedIn"))
      return
    }

    setRemovingAdminId(userId)
    try {
      const response = await removeCommunityAdmin({ communityId, userId }, accessToken)
      toast.success(response.message || t("communityDetails.removeAdminSuccess"))

      try {
        await refreshAdmins(accessToken)
      } catch (refreshError) {
        const refreshMessage = refreshError instanceof Error ? refreshError.message : t("communityDetails.fetchAdminFailed")
        if (isMissingAdminMessage(refreshMessage)) {
          setAdmins([])
        } else {
          throw refreshError
        }
      }

      await refreshUsers(accessToken)
    } catch (error) {
      const message = error instanceof Error ? error.message : t("communityDetails.removeAdminFailed")
      toast.error(message)
    } finally {
      setRemovingAdminId(null)
    }
  }

  async function handleToggleUserStatus(userId: string) {
    const accessToken = resolveAccessToken(tokens?.accessToken)
    if (!accessToken) {
      toast.error(t("communityDetails.mustBeLoggedIn"))
      return
    }

    setStatusChangingUserId(userId)
    try {
      const response = await toggleCommunityUserStatus(userId, accessToken)
      toast.success(response.message || t("communityDetails.userStatusUpdateSuccess"))
      await refreshUsers(accessToken)
    } catch (error) {
      const message = error instanceof Error ? error.message : t("communityDetails.userStatusUpdateFailed")
      toast.error(message)
    } finally {
      setStatusChangingUserId(null)
    }
  }

  async function handleDeleteUser(userId: string) {
    const accessToken = resolveAccessToken(tokens?.accessToken)
    if (!accessToken) {
      toast.error(t("communityDetails.mustBeLoggedIn"))
      return
    }

    setDeletingUserId(userId)
    try {
      const response = await deleteCommunityUser(userId, accessToken)
      toast.success(response.message || t("communityDetails.userDeleteSuccess"))
      await refreshUsers(accessToken)
    } catch (error) {
      const message = error instanceof Error ? error.message : t("communityDetails.userDeleteFailed")
      toast.error(message)
    } finally {
      setDeletingUserId(null)
    }
  }

  async function handleInvitePictureUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      toast.error(t("communityDetails.imageTypesOnly"))
      event.target.value = ""
      return
    }

    if (file.size > MAX_FILE_SIZE) {
      toast.error(t("communityDetails.imageMaxSize"))
      event.target.value = ""
      return
    }

    const accessToken = resolveAccessToken(tokens?.accessToken)
    if (!accessToken) {
      toast.error(t("communityDetails.uploadLoginRequired"))
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
      toast.success(t("communityDetails.uploadSuccess"))
    } catch (error) {
      const message = error instanceof Error ? error.message : t("communityDetails.uploadFailed")
      toast.error(message)
      setInvitePicturePreview(null)
      setInvitePictureKey("")
    } finally {
      setIsUploadingInvitePicture(false)
    }
  }

  async function removeInvitePicture() {
    const accessToken = resolveAccessToken(tokens?.accessToken)
    if (invitePictureKey && accessToken) {
      try {
        await deleteFileByName(invitePictureKey, accessToken)
      } catch (error) {
        const message = error instanceof Error ? error.message : t("communityDetails.deleteImageFailed")
        toast.error(message)
      }
    }
    setInvitePicturePreview(null)
    setInvitePictureKey("")
  }

  async function handleInviteAdmin() {
    const accessToken = resolveAccessToken(tokens?.accessToken)
    if (!accessToken) {
      toast.error(t("communityDetails.mustBeLoggedIn"))
      return
    }
    const mobileNumber = inviteForm.mobileNumber.trim()
    if (!inviteForm.fullName.trim() || !inviteForm.email.trim() || !mobileNumber || !inviteForm.housePlot.trim()) {
      toast.error(t("communityDetails.inviteRequiredFields"))
      return
    }
    if (!/^03\d{9}$/.test(mobileNumber)) {
      toast.error(t("communityDetails.mobileFormatInvalid"))
      return
    }

    setIsInvitingAdmin(true)
    try {
      const response = await inviteCommunityAdmin({
        communityId,
        fullName: inviteForm.fullName.trim(),
        email: inviteForm.email.trim(),
        mobileNumber,
        housePlot: inviteForm.housePlot.trim(),
        profilePicture: invitePictureKey,
      }, accessToken)

      toast.success(response.message || t("communityDetails.inviteAdminSuccess"))
      setInviteForm({ fullName: "", email: "", mobileNumber: "", housePlot: "" })
      setInvitePictureKey("")
      setInvitePicturePreview(null)

      await refreshAdmins(accessToken)
    } catch (error) {
      const message = error instanceof Error ? error.message : t("communityDetails.inviteAdminFailed")
      toast.error(message)
    } finally {
      setIsInvitingAdmin(false)
    }
  }

  async function handleCommunityStatusToggle(checked: boolean) {
    const accessToken = resolveAccessToken(tokens?.accessToken)
    if (!accessToken) {
      toast.error(t("communityDetails.mustBeLoggedIn"))
      return
    }
    if (!community) {
      toast.error(t("communityDetails.notLoaded"))
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
      toast.success(response.message || t("communityDetails.statusUpdateSuccess"))
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
      const message = error instanceof Error ? error.message : t("communityDetails.statusUpdateFailed")
      toast.error(message)
    } finally {
      setIsStatusUpdating(false)
    }
  }

  async function handleUpdateCommunity() {
    const accessToken = resolveAccessToken(tokens?.accessToken)
    if (!accessToken) {
      toast.error(t("communityDetails.mustBeLoggedIn"))
      return
    }
    if (!community) {
      toast.error(t("communityDetails.notLoaded"))
      return
    }

    const name = editForm.name.trim()
    const description = editForm.description.trim()
    const address = editForm.address.trim()
    const totalUnits = editForm.totalUnits.trim()

    if (!name) {
      toast.error(t("communityDetails.communityNameRequired"))
      return
    }
    if (!description) {
      toast.error(t("communityDetails.descriptionRequired"))
      return
    }
    if (!address) {
      toast.error(t("communityDetails.addressRequired"))
      return
    }
    if (!/^\d+$/.test(totalUnits) || Number(totalUnits) < 1) {
      toast.error(t("communityDetails.totalUnitsPositive"))
      return
    }

    setIsUpdatingCommunity(true)
    try {
      const response = await updateCommunity(
        {
          communityId,
          name,
          description,
          address,
          totalUnits: Number(totalUnits),
        },
        accessToken,
      )

      setCommunity((previous) => {
        if (!previous) return previous
        const updated: Community = {
          ...previous,
          name,
          description,
          address,
          totalUnits: Number(totalUnits),
        }
        try {
          sessionStorage.setItem(COMMUNITY_DETAILS_CACHE_KEY, JSON.stringify(updated))
        } catch {
          // no-op
        }
        return updated
      })

      toast.success(response.message || t("communityDetails.communityUpdateSuccess"))
      setIsEditDialogOpen(false)
    } catch (error) {
      const message = error instanceof Error ? error.message : t("communityDetails.communityUpdateFailed")
      toast.error(message)
    } finally {
      setIsUpdatingCommunity(false)
    }
  }

  async function handleDeleteCommunity() {
    const accessToken = resolveAccessToken(tokens?.accessToken)
    if (!accessToken) {
      toast.error(t("communityDetails.mustBeLoggedIn"))
      return
    }

    setIsDeletingCommunity(true)
    try {
      const response = await deleteCommunity(communityId, accessToken)
      try {
        sessionStorage.removeItem(COMMUNITY_DETAILS_CACHE_KEY)
      } catch {
        // no-op
      }
      toast.success(response.message || t("communityDetails.communityDeleteSuccess"))
      router.push("/communities")
    } catch (error) {
      const message = error instanceof Error ? error.message : t("communityDetails.communityDeleteFailed")
      toast.error(message)
    } finally {
      setIsDeletingCommunity(false)
    }
  }

  if (!isAuthenticated) return null

  return (
    <div className="relative flex flex-col gap-7 pb-4">
      <div className="pointer-events-none absolute -left-28 top-8 h-64 w-64 rounded-full bg-secondary/14 blur-3xl animate-drift" />
      <div className="pointer-events-none absolute -right-28 top-20 h-72 w-72 rounded-full bg-accent/14 blur-3xl animate-float-soft" />
      <div className="pointer-events-none absolute left-1/3 top-[28rem] h-56 w-56 rounded-full bg-primary/8 blur-3xl" />

      <div className={cn("relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between animate-slide-up", isRTL && "sm:flex-row-reverse")}>
        <Link href="/communities" className="w-full sm:w-auto">
          <Button variant="outline" className="w-full rounded-xl border-border/70 bg-background/75 shadow-sm transition-all hover:-translate-y-[1px] hover:bg-background hover:shadow-md sm:w-auto">
            <ArrowLeft className="h-4 w-4" />
            {t("communityDetails.backToCommunities")}
          </Button>
        </Link>
      </div>

      <div className="relative grid gap-5 lg:grid-cols-2">
        <Card className="group relative h-full overflow-hidden rounded-3xl border border-border/75 bg-card/95 shadow-[0_24px_54px_-32px_rgba(0,0,0,0.78)] transition-all duration-300 hover:border-secondary/35 hover:shadow-[0_30px_64px_-32px_rgba(0,0,0,0.75)] animate-slide-up stagger-1">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_95%_at_0%_0%,rgba(255,255,255,0.12),rgba(255,255,255,0)_58%)]" />
          <div className="pointer-events-none absolute -right-12 top-0 h-32 w-32 rounded-full bg-secondary/10 blur-3xl" />
          <CardContent className="p-5 sm:p-6">
            <div className={cn("relative flex items-start justify-between gap-4", isRTL && "flex-row-reverse")}>
              <div className={cn("space-y-1", isRTL && "text-right")}>
                <p className="inline-flex w-fit items-center rounded-full border border-secondary/30 bg-secondary/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-secondary">
                  {t("communityDetails.badgeCommunity")}
                </p>
                <h1 className="mt-2 text-3xl font-semibold leading-tight tracking-tight text-foreground">
                  {community?.name ?? t("communityDetails.titleFallback")}
                </h1>
                <p className="max-w-2xl pt-1 text-base leading-relaxed text-muted-foreground/90">
                  {community?.description ?? t("communityDetails.subtitleFallback")}
                </p>
              </div>
              {community?.status && (
                <Badge variant="outline" className={cn("shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold shadow-sm", getStatusColor(community.status))}>
                  {community.status}
                </Badge>
              )}
            </div>

            {community && (
              <div className="mt-6 rounded-2xl border border-border/70 bg-background/55 p-4 shadow-inner shadow-black/5">
                <div className={cn("grid gap-2.5 md:grid-cols-3 md:items-center", isRTL && "md:[direction:rtl]")}>
                  <div
                    className={cn(
                      "inline-flex h-12 w-full items-center justify-between gap-2 rounded-xl border px-4 shadow-sm transition-colors md:col-span-1",
                      community.status?.toUpperCase() === "ACTIVE"
                        ? "border-emerald-500/35 bg-emerald-500/12"
                        : "border-rose-500/35 bg-rose-500/12",
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
                        {community.status?.toUpperCase() === "ACTIVE" ? t("communityDetails.statusActive") : t("communityDetails.statusInactive")}
                      </span>
                    </div>
                    <div className="inline-flex items-center gap-2">
                      {isStatusUpdating && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                      <Switch
                        checked={community.status?.toUpperCase() === "ACTIVE"}
                        disabled={isStatusUpdating}
                        onCheckedChange={handleCommunityStatusToggle}
                        className="border border-border/70 bg-muted data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-rose-500"
                        aria-label={t("communityDetails.toggleStatusAria")}
                      />
                    </div>
                  </div>

                  <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                    <DialogTrigger asChild>
                      <Button
                        className="h-12 w-full rounded-xl border border-secondary/35 bg-gradient-to-r from-secondary/90 to-accent/85 px-3 text-sm font-semibold text-secondary-foreground shadow-[0_12px_26px_-14px_rgba(0,0,0,0.65)] transition-all duration-200 hover:-translate-y-[1px] hover:from-secondary hover:to-accent hover:shadow-[0_16px_30px_-14px_rgba(0,0,0,0.75)] active:translate-y-0 md:col-span-1"
                      >
                        <PencilLine className="h-4 w-4" />
                        {t("communityDetails.editCommunity")}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-lg">
                      <DialogHeader>
                        <DialogTitle>{t("communityDetails.editTitle")}</DialogTitle>
                        <DialogDescription>
                          {t("communityDetails.editDescription")}
                        </DialogDescription>
                      </DialogHeader>

                      <div className="grid gap-4 py-2">
                        <div className="grid gap-2">
                          <label htmlFor="community-name" className="text-sm font-medium text-foreground">{t("communityDetails.name")}</label>
                          <Input
                            id="community-name"
                            value={editForm.name}
                            onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
                            maxLength={100}
                          />
                        </div>

                        <div className="grid gap-2">
                          <label htmlFor="community-description" className="text-sm font-medium text-foreground">{t("communityDetails.description")}</label>
                          <Textarea
                            id="community-description"
                            value={editForm.description}
                            onChange={(event) => setEditForm((prev) => ({ ...prev, description: event.target.value }))}
                            maxLength={500}
                            rows={4}
                          />
                        </div>

                        <div className="grid gap-2">
                          <label htmlFor="community-address" className="text-sm font-medium text-foreground">{t("communityDetails.address")}</label>
                          <Input
                            id="community-address"
                            value={editForm.address}
                            onChange={(event) => setEditForm((prev) => ({ ...prev, address: event.target.value }))}
                          />
                        </div>

                        <div className="grid gap-2">
                          <label htmlFor="community-units" className="text-sm font-medium text-foreground">{t("communityDetails.totalUnits")}</label>
                          <Input
                            id="community-units"
                            type="text"
                            inputMode="numeric"
                            value={editForm.totalUnits}
                            onChange={(event) => setEditForm((prev) => ({ ...prev, totalUnits: event.target.value }))}
                          />
                        </div>
                      </div>

                      <DialogFooter>
                        <Button
                          type="button"
                          onClick={handleUpdateCommunity}
                          disabled={isUpdatingCommunity}
                          className="bg-accent text-accent-foreground hover:bg-accent/90"
                        >
                          {isUpdatingCommunity ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              {t("communityDetails.saving")}
                            </>
                          ) : (
                            t("communityDetails.saveChanges")
                          )}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        className="h-12 w-full rounded-xl border-rose-500/40 bg-rose-500/10 px-3 text-sm font-semibold text-rose-700 shadow-sm transition-colors hover:bg-rose-500/20 dark:text-rose-300 md:col-span-1"
                      >
                        <Trash2 className="h-4 w-4" />
                        {t("communityDetails.deleteCommunity")}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t("communityDetails.deleteDialogTitle")}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {t("communityDetails.deleteDialogDescription")}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeletingCommunity}>{t("communityDetails.cancel")}</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={(event) => {
                            event.preventDefault()
                            void handleDeleteCommunity()
                          }}
                          disabled={isDeletingCommunity}
                          className="bg-rose-600 text-white hover:bg-rose-700"
                        >
                          {isDeletingCommunity ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              {t("communityDetails.deleting")}
                            </>
                          ) : (
                            t("communityDetails.delete")
                          )}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
              </div>
              </div>
            )}

            {community ? (
              <div className="mt-6 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                {communityMeta.map((item) => (
                  <div key={item.label} className={cn("rounded-2xl border border-border/70 bg-background/70 p-4 shadow-sm transition-all duration-200 hover:-translate-y-[1px] hover:bg-background hover:shadow-md", isRTL && "text-right")}>
                    <div className={cn("mb-2.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground", isRTL && "flex-row-reverse justify-end")}>
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-secondary/25 bg-secondary/12 text-secondary">
                        {item.icon}
                      </span>
                      <span>{item.label}</span>
                    </div>
                    <p className="text-xl font-semibold tracking-tight text-foreground">{item.value}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-6 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                {t("communityDetails.communityDetailsHint")}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="group relative h-full overflow-hidden rounded-3xl border border-border/75 bg-card/95 shadow-[0_18px_40px_-24px_rgba(0,0,0,0.66)] transition-all duration-300 hover:border-secondary/35 hover:shadow-[0_24px_50px_-24px_rgba(0,0,0,0.7)] animate-slide-up stagger-2">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_95%_at_100%_0%,rgba(255,255,255,0.10),rgba(255,255,255,0)_62%)]" />
          <CardContent className="p-5 sm:p-6">
            <div className={cn("mb-3 flex items-center justify-between", isRTL && "flex-row-reverse")}>
              <p className="inline-flex w-fit items-center rounded-md border border-secondary/25 bg-secondary/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-secondary">
                {t("communityDetails.adminDetails")}
              </p>
            </div>

            {isLoadingAdmin ? (
              <div className="mt-4 space-y-3">
                <Skeleton className="h-14 w-full rounded-xl" />
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-16 w-full rounded-xl" />
              </div>
            ) : admins.length > 0 ? (
              <div className="mt-4 space-y-4">
                <div className={cn("flex items-center justify-between rounded-2xl border border-border/70 bg-background/60 px-3.5 py-2.5", isRTL && "flex-row-reverse")}>
                  <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{t("communityDetails.adminDetails")}</p>
                    <Badge variant="outline" className="rounded-full border-secondary/35 bg-secondary/10 px-2.5 py-0.5 text-xs font-semibold text-secondary">
                      {admins.length}
                    </Badge>
                  </div>
                  <div className={cn("hidden items-center -space-x-2 sm:flex", isRTL && "space-x-reverse")}>
                    {admins.slice(0, 4).map((admin) => (
                      <Avatar key={`stack-${admin.id || admin.email}`} className="h-7 w-7 border-2 border-background">
                        <AvatarImage src={admin.profilePictureUrl || undefined} alt={admin.fullName} />
                        <AvatarFallback>{getInitials(admin.fullName || admin.username || "Admin")}</AvatarFallback>
                      </Avatar>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  {admins.map((admin, index) => (
                    <div
                      key={admin.id || admin.email || index}
                      className="space-y-3 rounded-2xl border border-secondary/35 bg-gradient-to-br from-secondary/10 via-background/95 to-background p-4"
                    >
                      <div className={cn("flex items-center gap-3", isRTL && "flex-row-reverse")}>
                        <button
                          type="button"
                          onClick={() =>
                            openMediaViewer(
                              admin.profilePictureUrl || null,
                              admin.fullName || t("communityDetails.adminPhoto"),
                              getInitials(admin.fullName || admin.username || "Admin"),
                            )
                          }
                          className="rounded-full transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/60"
                          aria-label={t("communityDetails.viewAdminProfilePicture")}
                        >
                          <Avatar className="h-12 w-12 border border-border/70 ring-2 ring-background">
                            <AvatarImage src={admin.profilePictureUrl || undefined} alt={admin.fullName} />
                            <AvatarFallback>{getInitials(admin.fullName || admin.username || "Admin")}</AvatarFallback>
                          </Avatar>
                        </button>
                        <div className={cn("min-w-0 flex-1", isRTL && "text-right")}>
                          <p className="truncate text-sm font-semibold text-foreground">{admin.fullName || t("communityDetails.na")}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {admin.username ? `@${admin.username}` : t("communityDetails.noUsername")}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                            admin.isJoined === false
                              ? "border-amber-200 bg-amber-100 text-amber-800"
                              : "border-emerald-200 bg-emerald-100 text-emerald-800",
                          )}
                        >
                          {admin.isJoined === false ? t("communityDetails.invitePending") : t("communityDetails.joined")}
                        </Badge>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <InfoRow icon={<Mail className="h-4 w-4" />} label={t("communityDetails.email")} value={admin.email} isRTL={isRTL} />
                        <InfoRow icon={<Phone className="h-4 w-4" />} label={t("communityDetails.phone")} value={admin.mobileNumber} isRTL={isRTL} />
                        <InfoRow icon={<MapPin className="h-4 w-4" />} label={t("communityDetails.housePlot")} value={admin.housePlot} isRTL={isRTL} />
                        <InfoRow icon={<User className="h-4 w-4" />} label={t("communityDetails.bio")} value={admin.bio} isRTL={isRTL} />
                      </div>
                      <div className={cn("flex items-center justify-end", isRTL && "justify-start")}>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={removingAdminId === admin.id}
                              className="h-9 rounded-xl px-3.5 text-xs font-semibold shadow-[0_14px_28px_-18px_rgba(220,38,38,0.6)] transition-all hover:-translate-y-[1px]"
                            >
                              {removingAdminId === admin.id ? t("communityDetails.removingAdmin") : t("communityDetails.removeAdmin")}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t("communityDetails.removeAdminDialogTitle")}</AlertDialogTitle>
                              <AlertDialogDescription>{t("communityDetails.removeAdminDialogDescription")}</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t("communityDetails.cancel")}</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleRemoveAdmin(admin.id)}>
                                {t("communityDetails.removeAdmin")}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                {t("communityDetails.noAdminAssigned")}
              </div>
            )}

          </CardContent>
        </Card>
      </div>

      {!hasAssignedAdmin && (
      <Card className="group relative overflow-hidden rounded-3xl border border-border/75 bg-card/95 shadow-[0_18px_42px_-24px_rgba(0,0,0,0.62)] transition-all duration-300 hover:border-secondary/35 hover:shadow-[0_24px_52px_-24px_rgba(0,0,0,0.7)] animate-slide-up stagger-3">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(110%_90%_at_0%_0%,rgba(255,255,255,0.10),rgba(255,255,255,0)_60%)]" />
          <CardContent className="p-5 sm:p-6">
            <div className={cn("mb-5 flex items-start justify-between gap-3", isRTL && "flex-row-reverse")}>
              <div className={cn("space-y-2", isRTL && "text-right")}>
                <p className="inline-flex w-fit items-center rounded-md border border-secondary/25 bg-secondary/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-secondary">
                  {t("communityDetails.inviteAdminBadge")}
                </p>
                <h3 className="text-xl font-semibold tracking-tight text-foreground">{t("communityDetails.assignCommunityAdmin")}</h3>
                <p className="text-sm text-muted-foreground">{t("communityDetails.inviteAdminSubtitle")}</p>
              </div>
              <span className="inline-flex h-7 items-center rounded-full border border-amber-500/35 bg-amber-500/10 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-700 dark:text-amber-300">
                {t("communityDetails.pending")}
              </span>
            </div>

            <div className="grid gap-4 lg:grid-cols-12">
              <div className="space-y-3 lg:col-span-8">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{t("communityDetails.fullName")}</label>
                    <Input
                      placeholder={t("communityDetails.fullNamePlaceholder")}
                      value={inviteForm.fullName}
                      onChange={(event) => setInviteForm((prev) => ({ ...prev, fullName: event.target.value }))}
                      className="h-11 rounded-xl border-border/70 bg-background/80"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{t("communityDetails.email")}</label>
                    <Input
                      placeholder={t("communityDetails.emailPlaceholder")}
                      type="email"
                      value={inviteForm.email}
                      onChange={(event) => setInviteForm((prev) => ({ ...prev, email: event.target.value }))}
                      className="h-11 rounded-xl border-border/70 bg-background/80"
                    />
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{t("communityDetails.mobileNumber")}</label>
                    <Input
                      placeholder="03XXXXXXXXX"
                      value={inviteForm.mobileNumber}
                      onChange={(event) => setInviteForm((prev) => ({ ...prev, mobileNumber: event.target.value }))}
                      className="h-11 rounded-xl border-border/70 bg-background/80"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{t("communityDetails.housePlot")}</label>
                    <Input
                      placeholder={t("communityDetails.housePlotPlaceholder")}
                      value={inviteForm.housePlot}
                      onChange={(event) => setInviteForm((prev) => ({ ...prev, housePlot: event.target.value }))}
                      className="h-11 rounded-xl border-border/70 bg-background/80"
                    />
                  </div>
                </div>

                <div className={cn("mt-1 border-t border-border/55 pt-3 flex", isRTL ? "justify-end" : "justify-start")}>
                  <Button
                    onClick={handleInviteAdmin}
                    disabled={isInvitingAdmin || isUploadingInvitePicture}
                    className={cn(
                      "group relative h-12 w-full md:w-[260px] overflow-hidden rounded-2xl border border-amber-300/55 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 px-6 text-base font-semibold text-amber-950 shadow-[0_18px_34px_-18px_rgba(245,158,11,0.85)] transition-all duration-300 hover:-translate-y-[1px] hover:from-amber-300 hover:via-yellow-200 hover:to-amber-300 hover:shadow-[0_22px_40px_-18px_rgba(245,158,11,0.95)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70",
                      isRTL && "lg:[direction:rtl]",
                    )}
                  >
                    <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.0)_18%,rgba(255,255,255,0.45)_48%,rgba(255,255,255,0.0)_78%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                    <span className="relative inline-flex w-full items-center justify-center gap-2">
                      {isInvitingAdmin ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {t("communityDetails.sendingInvite")}
                        </>
                      ) : (
                        t("communityDetails.inviteAdminBadge")
                      )}
                    </span>
                  </Button>
                </div>
              </div>

              <div className="lg:col-span-4">
                <div className="rounded-xl border border-border/70 bg-background/70 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{t("communityDetails.profilePicture")}</p>
                  {invitePicturePreview ? (
                    <div className="relative h-[164px] overflow-hidden rounded-lg">
                      <div
                        className="flex h-full w-full cursor-zoom-in items-center justify-center bg-muted/35 p-2"
                        onClick={() =>
                          invitePicturePreview
                            ? openMediaViewer(invitePicturePreview, t("communityDetails.inviteProfilePicture"))
                            : undefined
                        }
                      >
                        <img src={invitePicturePreview} alt={t("communityDetails.inviteProfilePicture")} className="max-h-full max-w-full object-contain" />
                      </div>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                          void removeInvitePicture()
                        }}
                        className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/50 bg-black/50 text-white"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex h-[164px] cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:bg-background">
                      {isUploadingInvitePicture ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {t("communityDetails.loading")}
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4" />
                          {t("communityDetails.uploadProfilePicture")}
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
              </div>
            </div>

          </CardContent>
      </Card>
      )}

      <Card className="group relative overflow-hidden rounded-3xl border border-border/75 bg-card/95 shadow-[0_18px_42px_-24px_rgba(0,0,0,0.62)] transition-all duration-300 hover:border-secondary/35 hover:shadow-[0_24px_52px_-24px_rgba(0,0,0,0.7)] animate-slide-up stagger-4">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(110%_90%_at_0%_0%,rgba(255,255,255,0.10),rgba(255,255,255,0)_60%)]" />
        <CardContent className="p-5 sm:p-6">
          <div className={cn("mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", isRTL && "sm:flex-row-reverse")}>
            <div className={cn("space-y-1", isRTL && "text-right")}>
              <p className="inline-flex w-fit items-center rounded-md border border-secondary/25 bg-secondary/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-secondary">
                {t("communityDetails.communityUsers")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("communityDetails.communityUsersAdminNote")}
              </p>
            </div>
            <div className="relative w-full sm:max-w-sm">
              <Search className={cn("absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground", isRTL ? "right-3" : "left-3")} />
              <Input
                value={usernameSearch}
                onChange={(event) => setUsernameSearch(event.target.value)}
                placeholder={t("communityDetails.searchByUsername")}
                className={cn("h-10 rounded-xl border-border/70 bg-background/80 shadow-sm focus-visible:ring-secondary/40", isRTL ? "pr-10 text-right" : "pl-10")}
              />
            </div>
          </div>

          {isLoadingUsers ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              {t("communityDetails.noUsersFound")}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredUsers.map((member) => {
                const memberProfilePicture = member.profilePictureUrl

                return (
                  <div
                    key={member.id}
                    className="group relative overflow-hidden rounded-[1.65rem] border border-border/70 bg-[linear-gradient(145deg,hsl(var(--background))_0%,hsl(var(--card))_45%,hsl(var(--muted)/0.45)_100%)] p-4 shadow-[0_18px_44px_-28px_rgba(0,0,0,0.7)] transition-all duration-300 hover:-translate-y-[2px] hover:border-accent/35 hover:shadow-[0_24px_54px_-28px_rgba(0,0,0,0.8)]"
                  >
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_100%_at_0%_0%,rgba(255,206,84,0.14),rgba(255,255,255,0)_55%)] opacity-70" />
                    <div className={cn("relative flex items-start gap-3", isRTL && "flex-row-reverse")}>
                      {memberProfilePicture ? (
                        <button
                          type="button"
                          onClick={() =>
                            openMediaViewer(
                              memberProfilePicture,
                              member.fullName || member.username || t("communityDetails.userPhoto"),
                            )
                          }
                          className="rounded-full transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/60"
                          aria-label={t("communityDetails.viewUserProfilePicture")}
                        >
                          <Avatar className="h-12 w-12 border border-white/60 ring-4 ring-background shadow-[0_10px_24px_-12px_rgba(0,0,0,0.8)]">
                            <AvatarImage src={memberProfilePicture} alt={member.fullName || member.username || t("communityDetails.user")} />
                            <AvatarFallback>
                              {(member.fullName || member.username || "U").slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        </button>
                      ) : (
                        <Avatar className="h-12 w-12 border border-white/60 ring-4 ring-background shadow-[0_10px_24px_-12px_rgba(0,0,0,0.8)]">
                          <AvatarImage src={undefined} alt={member.fullName || member.username || t("communityDetails.user")} />
                          <AvatarFallback>
                            {(member.fullName || member.username || "U").slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <div className={cn("min-w-0 flex-1 space-y-1", isRTL && "text-right")}>
                        <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
                          <p className="truncate text-sm font-semibold tracking-[0.01em] text-foreground">
                            {member.fullName || t("communityDetails.unnamedUser")}
                          </p>
                          <span className="inline-flex h-6 items-center rounded-full border border-accent/30 bg-accent/10 px-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-accent-foreground">
                            {t("communityDetails.memberBadge")}
                          </span>
                        </div>
                        <p className="truncate text-xs text-muted-foreground">{member.username ? `@${member.username}` : t("communityDetails.noUsername")}</p>
                      </div>
                      <div className={cn("flex max-w-[360px] flex-wrap items-center justify-end gap-2", isRTL && "justify-start")}>
                        {!hasAssignedAdmin && (
                          <Button
                            size="sm"
                            disabled={assigningUserId === member.id}
                            onClick={() => handleAssignAdmin(member.id)}
                            className="h-9 rounded-xl border border-secondary/35 bg-gradient-to-r from-secondary via-secondary to-accent/80 px-3.5 text-xs font-semibold text-secondary-foreground shadow-[0_14px_28px_-18px_rgba(0,0,0,0.85)] transition-all hover:-translate-y-[1px] hover:shadow-[0_18px_32px_-18px_rgba(0,0,0,0.95)]"
                          >
                            {assigningUserId === member.id ? t("communityDetails.assigning") : t("communityDetails.assignAsAdmin")}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={statusChangingUserId === member.id}
                          onClick={() => handleToggleUserStatus(member.id)}
                          className="h-9 rounded-xl border-border/70 bg-background/80 px-3.5 text-xs font-semibold shadow-sm transition-all hover:-translate-y-[1px] hover:border-secondary/35 hover:bg-secondary/5"
                        >
                          {statusChangingUserId === member.id ? t("communityDetails.loading") : t("communityDetails.toggleUserStatus")}
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={deletingUserId === member.id}
                              className="h-9 rounded-xl px-3.5 text-xs font-semibold shadow-[0_14px_28px_-18px_rgba(220,38,38,0.6)] transition-all hover:-translate-y-[1px]"
                            >
                              {deletingUserId === member.id ? t("communityDetails.deletingUser") : t("communityDetails.deleteUser")}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t("communityDetails.deleteUserDialogTitle")}</AlertDialogTitle>
                              <AlertDialogDescription>{t("communityDetails.deleteUserDialogDescription")}</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t("communityDetails.cancel")}</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteUser(member.id)}>
                                {t("communityDetails.delete")}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>

                    <div className="relative mt-4 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
                      <InfoRow icon={<MapPin className="h-4 w-4" />} label={t("communityDetails.housePlot")} value={member.housePlot || "-"} isRTL={isRTL} />
                      <InfoRow icon={<Mail className="h-4 w-4" />} label={t("communityDetails.email")} value={member.email || "-"} isRTL={isRTL} />
                      <InfoRow icon={<Phone className="h-4 w-4" />} label={t("communityDetails.phone")} value={member.phoneNumber || "-"} isRTL={isRTL} />
                      <InfoRow icon={<UserCircle2 className="h-4 w-4" />} label={t("communityDetails.familyMembers")} value={String(member.noOfFamilyMember ?? "-")} isRTL={isRTL} />
                    </div>
                  </div>
                )
              })}

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
                        {t("communityDetails.loading")}
                      </>
                    ) : (
                      t("communityDetails.loadMoreUsers")
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={mediaViewer.open}
        onOpenChange={(open) => setMediaViewer((previous) => ({ ...previous, open }))}
      >
        <DialogContent className="max-w-5xl border-border/60 bg-background/95 p-3 sm:p-4">
          <DialogHeader className="pb-1">
            <DialogTitle>{mediaViewer.title || t("communityDetails.mediaViewer")}</DialogTitle>
            <DialogDescription>{t("communityDetails.previewUploadedImage")}</DialogDescription>
          </DialogHeader>
          <div className="flex max-h-[78vh] min-h-[260px] w-full items-center justify-center rounded-xl border border-border/60 bg-muted/35 p-3">
            {mediaViewer.src ? (
              <img
                src={mediaViewer.src}
                alt={mediaViewer.title || t("communityDetails.mediaPreviewAlt")}
                className="max-h-[72vh] w-auto max-w-full rounded-lg object-contain"
              />
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="flex h-28 w-28 items-center justify-center rounded-full border border-border/70 bg-background text-3xl font-semibold tracking-wide text-foreground shadow-sm">
                  {mediaViewer.initials}
                </div>
                <p className="text-sm text-muted-foreground">{t("communityDetails.noPhotoUploaded")}</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
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
