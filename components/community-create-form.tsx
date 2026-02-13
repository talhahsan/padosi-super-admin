"use client"

import React from "react"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Upload, X, ArrowLeft, Building2, ShieldCheck, CheckCircle2, CircleDashed } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ValidationMessage } from "@/components/ui/validation-message"
import { useAuth } from "@/lib/auth-context"
import { createCommunity, deleteFileByName, getPreSignUrl, uploadFileToPresignUrl } from "@/lib/api"
import { useLocale } from "@/lib/locale-context"
import { cn } from "@/lib/utils"

const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"]
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

function isValidEmail(email: string): boolean {
  return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email)
}

interface FormData {
  name: string
  description: string
  totalUnits: string
  address: string
  city: string
  adminName: string
  adminEmail: string
  adminHousePlot: string
  adminPhoneNumber: string
}

type FormErrors = Partial<Record<keyof FormData | "adminPicture", string>>

export function CommunityCreateForm() {
  const [formData, setFormData] = useState<FormData>({
    name: "",
    description: "",
    totalUnits: "",
    address: "",
    city: "",
    adminName: "",
    adminEmail: "",
    adminHousePlot: "",
    adminPhoneNumber: "",
  })
  const [adminPicture, setAdminPicture] = useState<File | null>(null)
  const [adminPictureKey, setAdminPictureKey] = useState("")
  const [picturePreview, setPicturePreview] = useState<string | null>(null)
  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUploadingPicture, setIsUploadingPicture] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { tokens, isAuthenticated } = useAuth()
  const { t, isRTL } = useLocale()
  const router = useRouter()
  const fieldBaseClass = cn(
    "h-11 rounded-xl border-border/80 bg-background/80 shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring/60",
    isRTL && "text-right",
  )
  const textAreaBaseClass = cn(
    "flex w-full rounded-xl border border-input bg-background/80 px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50",
    isRTL && "text-right",
  )
  const completionChecks = [
    formData.name.trim().length > 0 && /^[A-Za-z -]+$/.test(formData.name.trim()) && formData.name.trim().length <= 100,
    formData.description.trim().length > 0 && formData.description.trim().length <= 500,
    /^\d+$/.test(formData.totalUnits.trim()) && Number(formData.totalUnits.trim()) > 0,
    formData.address.trim().length > 0,
    formData.city.trim().length > 0,
    formData.adminName.trim().length > 0,
    isValidEmail(formData.adminEmail.trim()),
    formData.adminHousePlot.trim().length > 0,
    /^03\d{9}$/.test(formData.adminPhoneNumber.trim()),
  ]
  const completedRequiredFields = completionChecks.filter(Boolean).length
  const totalRequiredFields = completionChecks.length
  const completionPercent = Math.round((completedRequiredFields / totalRequiredFields) * 100)

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login")
    }
  }, [isAuthenticated, router])

  function updateField(field: keyof FormData, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setErrors((prev) => ({
        ...prev,
        adminPicture: t("createCommunity.pictureInvalidType"),
      }))
      if (fileInputRef.current) fileInputRef.current.value = ""
      return
    }

    if (file.size > MAX_FILE_SIZE) {
      setErrors((prev) => ({
        ...prev,
        adminPicture: t("createCommunity.pictureMaxSize"),
      }))
      if (fileInputRef.current) fileInputRef.current.value = ""
      return
    }

    if (!tokens?.accessToken) {
      setErrors((prev) => ({
        ...prev,
        adminPicture: t("createCommunity.pictureLoginRequired"),
      }))
      if (fileInputRef.current) fileInputRef.current.value = ""
      return
    }

    setErrors((prev) => ({ ...prev, adminPicture: undefined }))
    const reader = new FileReader()
    reader.onloadend = () => setPicturePreview(reader.result as string)
    reader.readAsDataURL(file)

    setIsUploadingPicture(true)
    setAdminPicture(file)
    setAdminPictureKey("")

    try {
      const preSign = await getPreSignUrl(file.name, tokens.accessToken)
      await uploadFileToPresignUrl(preSign.data.url, file)
      setAdminPictureKey(preSign.data.key)
      toast.success(t("createCommunity.pictureUploaded"))
    } catch (err) {
      setAdminPicture(null)
      setAdminPictureKey("")
      setPicturePreview(null)
      if (fileInputRef.current) fileInputRef.current.value = ""
      const message = err instanceof Error ? err.message : t("createCommunity.pictureUploadFailed")
      setErrors((prev) => ({ ...prev, adminPicture: message }))
      toast.error(message)
    } finally {
      setIsUploadingPicture(false)
    }
  }

  async function removePicture() {
    if (adminPictureKey && tokens?.accessToken) {
      try {
        await deleteFileByName(adminPictureKey, tokens.accessToken)
      } catch (error) {
        const message = error instanceof Error ? error.message : t("createCommunity.pictureUploadFailed")
        toast.error(message)
      }
    }
    setAdminPicture(null)
    setAdminPictureKey("")
    setPicturePreview(null)
    setErrors((prev) => ({ ...prev, adminPicture: undefined }))
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  function validate(): boolean {
    const newErrors: FormErrors = {}
    const trimmedName = formData.name.trim()
    const trimmedDescription = formData.description.trim()
    const trimmedTotalUnits = formData.totalUnits.trim()

    if (!trimmedName) {
      newErrors.name = t("createCommunity.validationCommunityName")
    } else if (trimmedName.length > 100) {
      newErrors.name = t("createCommunity.validationCommunityNameMax")
    } else if (!/^[A-Za-z -]+$/.test(trimmedName)) {
      newErrors.name = t("createCommunity.validationCommunityNameFormat")
    }

    if (!trimmedDescription) {
      newErrors.description = t("createCommunity.validationDescription")
    } else if (trimmedDescription.length > 500) {
      newErrors.description = t("createCommunity.validationDescriptionMax")
    }

    if (!trimmedTotalUnits) {
      newErrors.totalUnits = t("createCommunity.validationTotalUnitsRequired")
    } else if (!/^\d+$/.test(trimmedTotalUnits)) {
      newErrors.totalUnits = t("createCommunity.validationTotalUnitsDigits")
    } else if (Number(trimmedTotalUnits) < 1) {
      newErrors.totalUnits = t("createCommunity.validationTotalUnitsInvalid")
    }
    if (!formData.address.trim()) newErrors.address = t("createCommunity.validationAddress")
    if (!formData.city.trim()) newErrors.city = t("createCommunity.validationCity")
    if (!formData.adminName.trim()) newErrors.adminName = t("createCommunity.validationAdminName")
    if (!formData.adminEmail.trim()) {
      newErrors.adminEmail = t("createCommunity.validationAdminEmailRequired")
    } else if (!isValidEmail(formData.adminEmail)) {
      newErrors.adminEmail = t("createCommunity.validationAdminEmailInvalid")
    }
    if (!formData.adminHousePlot.trim()) newErrors.adminHousePlot = t("createCommunity.validationHousePlot")
    if (!formData.adminPhoneNumber.trim()) {
      newErrors.adminPhoneNumber = t("createCommunity.validationPhone")
    } else if (!/^03\d{9}$/.test(formData.adminPhoneNumber.trim())) {
      newErrors.adminPhoneNumber = t("createCommunity.validationPhoneInvalid")
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    if (!tokens?.accessToken) {
      toast.error(t("createCommunity.mustBeLoggedInCreate"))
      router.push("/login")
      return
    }
    if (adminPicture && !adminPictureKey) {
      toast.error(t("createCommunity.waitForUpload"))
      return
    }

    setIsSubmitting(true)
    try {
      await createCommunity(
        {
          name: formData.name.trim(),
          description: formData.description.trim(),
          totalUnits: Number(formData.totalUnits),
          address: formData.address.trim(),
          city: formData.city.trim(),
          adminName: formData.adminName.trim(),
          adminEmail: formData.adminEmail.trim(),
          adminHousePlot: formData.adminHousePlot.trim(),
          adminPhoneNumber: formData.adminPhoneNumber.trim(),
          adminPicture: adminPictureKey,
        },
        tokens.accessToken,
      )

      toast.success(t("createCommunity.communityCreated"))
      router.push("/communities")
    } catch (err) {
      const message = err instanceof Error ? err.message : t("createCommunity.createFailed")
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isAuthenticated) return null

  return (
    <div className="flex flex-col gap-7">
      <div className={cn("gradient-surface flex items-center gap-3 rounded-2xl border border-border/70 p-4 shadow-sm animate-slide-up", isRTL && "flex-row-reverse")}>
        <Link href="/communities">
          <Button variant="ghost" size="icon" className="rounded-xl text-foreground hover:bg-background/80">
            <ArrowLeft className={cn("h-5 w-5", isRTL && "rotate-180")} />
            <span className="sr-only">{t("createCommunity.backToCommunities")}</span>
          </Button>
        </Link>
        <div className={cn("space-y-1", isRTL && "text-right")}>
          <p className="inline-flex w-fit items-center rounded-md bg-secondary/15 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-secondary">
            {t("createCommunity.communityDetails")}
          </p>
          <h1 className="text-2xl font-bold text-foreground">{t("createCommunity.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("createCommunity.subtitle")}</p>
        </div>
      </div>

      <form noValidate onSubmit={handleSubmit} className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-6">
          <Card className="gradient-surface border border-border/70 shadow-md animate-slide-up stagger-1">
            <CardHeader className="pb-3">
              <CardTitle className={cn("flex items-center gap-2 text-lg text-foreground", isRTL && "flex-row-reverse justify-end")}>
                <Building2 className="h-4.5 w-4.5 text-secondary" />
                {t("createCommunity.communityDetails")}
              </CardTitle>
              <CardDescription>{t("createCommunity.basicInfo")}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="name">{t("createCommunity.communityName")}</Label>
                <Input
                  id="name"
                  placeholder={t("createCommunity.communityNamePlaceholder")}
                  value={formData.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  maxLength={100}
                  className={cn(fieldBaseClass, errors.name && "border-destructive")}
                  aria-invalid={!!errors.name}
                />
                {errors.name && <ValidationMessage message={errors.name} />}
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="description">{t("createCommunity.description")}</Label>
                <textarea
                  id="description"
                  placeholder={t("createCommunity.descriptionPlaceholder")}
                  value={formData.description}
                  onChange={(e) => updateField("description", e.target.value)}
                  maxLength={500}
                  rows={4}
                  className={cn(textAreaBaseClass, errors.description ? "border-destructive" : "border-input")}
                  aria-invalid={!!errors.description}
                />
                {errors.description && (
                  <ValidationMessage message={errors.description} />
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className={cn("flex flex-col gap-2", isRTL && "text-right")}>
                  <Label htmlFor="totalUnits">{t("createCommunity.totalUnits")}</Label>
                  <Input
                    id="totalUnits"
                    type="text"
                    inputMode="numeric"
                    placeholder={t("createCommunity.totalUnitsPlaceholder")}
                    value={formData.totalUnits}
                    onChange={(e) => updateField("totalUnits", e.target.value)}
                    className={cn(fieldBaseClass, errors.totalUnits && "border-destructive")}
                    aria-invalid={!!errors.totalUnits}
                  />
                  {errors.totalUnits && (
                    <ValidationMessage message={errors.totalUnits} />
                  )}
                </div>

                <div className={cn("flex flex-col gap-2", isRTL && "text-right")}>
                  <Label htmlFor="city">{t("createCommunity.city")}</Label>
                  <Input
                    id="city"
                    placeholder={t("createCommunity.cityPlaceholder")}
                    value={formData.city}
                    onChange={(e) => updateField("city", e.target.value)}
                    className={cn(fieldBaseClass, errors.city && "border-destructive")}
                    aria-invalid={!!errors.city}
                  />
                  {errors.city && <ValidationMessage message={errors.city} />}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="address">{t("createCommunity.address")}</Label>
                <Input
                  id="address"
                  placeholder={t("createCommunity.addressPlaceholder")}
                  value={formData.address}
                  onChange={(e) => updateField("address", e.target.value)}
                  className={cn(fieldBaseClass, errors.address && "border-destructive")}
                  aria-invalid={!!errors.address}
                />
                {errors.address && <ValidationMessage message={errors.address} />}
              </div>
            </CardContent>
          </Card>

          <Card className="gradient-surface border border-border/70 shadow-md animate-slide-up stagger-3">
            <CardHeader className="pb-3">
              <CardTitle className={cn("flex items-center gap-2 text-lg text-foreground", isRTL && "flex-row-reverse justify-end")}>
                <ShieldCheck className="h-4.5 w-4.5 text-secondary" />
                {t("createCommunity.adminDetails")}
              </CardTitle>
              <CardDescription>{t("createCommunity.assignAdmin")}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="adminName">{t("createCommunity.adminName")}</Label>
                  <Input
                    id="adminName"
                    placeholder={t("createCommunity.adminNamePlaceholder")}
                    value={formData.adminName}
                    onChange={(e) => updateField("adminName", e.target.value)}
                    className={cn(fieldBaseClass, errors.adminName && "border-destructive")}
                    aria-invalid={!!errors.adminName}
                  />
                  {errors.adminName && (
                    <ValidationMessage message={errors.adminName} />
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="adminEmail">{t("createCommunity.adminEmail")}</Label>
                  <Input
                    id="adminEmail"
                    type="email"
                    placeholder={t("createCommunity.adminEmailPlaceholder")}
                    value={formData.adminEmail}
                    onChange={(e) => updateField("adminEmail", e.target.value)}
                    className={cn(fieldBaseClass, errors.adminEmail && "border-destructive")}
                    aria-invalid={!!errors.adminEmail}
                  />
                  {errors.adminEmail && (
                    <ValidationMessage message={errors.adminEmail} />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="adminHousePlot">{t("createCommunity.adminHousePlot")}</Label>
                  <Input
                    id="adminHousePlot"
                    placeholder={t("createCommunity.adminHousePlotPlaceholder")}
                    value={formData.adminHousePlot}
                    onChange={(e) => updateField("adminHousePlot", e.target.value)}
                    className={cn(fieldBaseClass, errors.adminHousePlot && "border-destructive")}
                    aria-invalid={!!errors.adminHousePlot}
                  />
                  {errors.adminHousePlot && (
                    <ValidationMessage message={errors.adminHousePlot} />
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="adminPhoneNumber">{t("createCommunity.adminPhoneNumber")}</Label>
                  <Input
                    id="adminPhoneNumber"
                    type="tel"
                    placeholder={t("createCommunity.adminPhonePlaceholder")}
                    value={formData.adminPhoneNumber}
                    onChange={(e) => updateField("adminPhoneNumber", e.target.value)}
                    className={cn(fieldBaseClass, errors.adminPhoneNumber && "border-destructive")}
                    aria-invalid={!!errors.adminPhoneNumber}
                  />
                  {errors.adminPhoneNumber && (
                    <ValidationMessage message={errors.adminPhoneNumber} />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="sticky bottom-4 z-20 animate-slide-up stagger-5">
            <div className={cn("gradient-surface rounded-2xl border border-border/70 px-4 py-3 shadow-lg backdrop-blur-sm", isRTL && "text-right")}>
              <div className={cn("mx-auto grid w-full grid-cols-1 gap-3 sm:grid-cols-2", isRTL && "sm:[direction:rtl]")}>
                <Link href="/communities" className="w-full">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 w-full rounded-xl border-border/80 bg-background/75 px-6 font-semibold text-foreground/85 hover:bg-background"
                  >
                    {t("createCommunity.cancel")}
                  </Button>
                </Link>
                <Button
                  type="submit"
                  disabled={isSubmitting || isUploadingPicture}
                  className="h-11 w-full rounded-xl bg-accent px-8 text-accent-foreground font-semibold shadow-md transition-all duration-200 hover:bg-accent/90 hover:shadow-lg active:scale-[0.98]"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t("createCommunity.creating")}
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      {t("createCommunity.createCommunity")}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <aside className="animate-slide-up stagger-2 xl:sticky xl:top-24 xl:h-fit">
          <div className="space-y-6">
            <Card className="gradient-surface border border-border/70 shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className={cn("text-lg text-foreground", isRTL && "text-right")}>
                  {t("createCommunity.progressTitle")}
                </CardTitle>
                <CardDescription className={cn(isRTL && "text-right")}>
                  {t("createCommunity.progressSubtitle")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-secondary via-accent to-secondary transition-all duration-300"
                    style={{ width: `${completionPercent}%` }}
                  />
                </div>
                <div className={cn("flex items-center justify-between text-sm", isRTL && "flex-row-reverse")}>
                  <p className="text-muted-foreground">
                    {t("createCommunity.fieldsCompleted", {
                      count: completedRequiredFields,
                      total: totalRequiredFields,
                    })}
                  </p>
                  <span className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
                    completionPercent === 100
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                      : "bg-secondary/15 text-secondary",
                  )}>
                    {completionPercent === 100 ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      <CircleDashed className="h-3.5 w-3.5" />
                    )}
                    {completionPercent === 100 ? t("createCommunity.readyToSubmit") : t("createCommunity.keepGoing")}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="gradient-surface border border-border/70 shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className={cn("text-lg text-foreground", isRTL && "text-right")}>
                  {t("createCommunity.adminPicture")}
                </CardTitle>
                <CardDescription className={cn(isRTL && "text-right")}>
                  {t("createCommunity.adminPictureHint")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="gradient-surface rounded-2xl border border-border/70 p-3 shadow-sm">
                  {picturePreview ? (
                    <div className="relative h-64 overflow-hidden rounded-xl border border-border/70 bg-muted/40">
                      <div className="flex h-full w-full items-center justify-center p-2">
                        <img
                          src={picturePreview || "/placeholder.svg"}
                          alt={t("createCommunity.adminPicturePreviewAlt")}
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-4 py-3">
                        <p className="text-xs font-medium text-white/90">{t("createCommunity.uploadedSuccessfully")}</p>
                      </div>
                      <div className={cn("absolute top-3 flex items-center gap-2", isRTL ? "left-3 flex-row-reverse" : "right-3")}>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="rounded-md border border-white/35 bg-black/40 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/55"
                        >
                          {t("createCommunity.uploadPicture")}
                        </button>
                        <button
                          type="button"
                          onClick={() => void removePicture()}
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-white/35 bg-black/40 text-white shadow-sm backdrop-blur-sm transition-colors hover:bg-destructive"
                          aria-label={t("createCommunity.removePicture")}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className={cn(
                        "group flex h-64 w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border/80 bg-background/70 text-muted-foreground transition-all duration-200 hover:border-secondary hover:bg-background hover:text-secondary hover:shadow-sm",
                        isUploadingPicture && "cursor-not-allowed opacity-80",
                      )}
                      disabled={isUploadingPicture}
                    >
                      {isUploadingPicture ? (
                        <>
                          <Loader2 className="h-8 w-8 animate-spin" />
                          <span className="text-sm font-medium">{t("createCommunity.uploading")}</span>
                        </>
                      ) : (
                        <>
                          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary/12 text-secondary">
                            <Upload className="h-7 w-7" />
                          </div>
                          <span className="text-sm font-semibold">{t("createCommunity.uploadPicture")}</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".png,.jpeg,.jpg,.webp"
                  className="hidden"
                  onChange={handleFileChange}
                  aria-label={t("createCommunity.uploadAria")}
                />
                {errors.adminPicture && (
                  <ValidationMessage message={errors.adminPicture} />
                )}
              </CardContent>
            </Card>
          </div>
        </aside>
      </form>
    </div>
  )
}
