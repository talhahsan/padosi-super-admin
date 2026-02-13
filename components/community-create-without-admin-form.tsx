"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Building2, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ValidationMessage } from "@/components/ui/validation-message"
import { useAuth } from "@/lib/auth-context"
import { createCommunityWithoutAdmin } from "@/lib/api"
import { useLocale } from "@/lib/locale-context"
import { cn } from "@/lib/utils"

interface FormData {
  name: string
  description: string
  totalUnits: string
  address: string
  city: string
}

type FormErrors = Partial<Record<keyof FormData, string>>

export function CommunityCreateWithoutAdminForm() {
  const [formData, setFormData] = useState<FormData>({
    name: "",
    description: "",
    totalUnits: "",
    address: "",
    city: "",
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { tokens, isAuthenticated } = useAuth()
  const { isRTL } = useLocale()
  const router = useRouter()

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

  function validate(): boolean {
    const nextErrors: FormErrors = {}
    const trimmedName = formData.name.trim()
    const trimmedDescription = formData.description.trim()
    const trimmedTotalUnits = formData.totalUnits.trim()
    const trimmedAddress = formData.address.trim()
    const trimmedCity = formData.city.trim()

    if (!trimmedName) {
      nextErrors.name = "Community name is required."
    } else if (trimmedName.length > 100) {
      nextErrors.name = "Community name must be 100 characters or less."
    }

    if (!trimmedDescription) {
      nextErrors.description = "Description is required."
    } else if (trimmedDescription.length > 500) {
      nextErrors.description = "Description must be 500 characters or less."
    }

    if (!trimmedTotalUnits) {
      nextErrors.totalUnits = "Total units is required."
    } else if (!/^\d+$/.test(trimmedTotalUnits) || Number(trimmedTotalUnits) < 1) {
      nextErrors.totalUnits = "Total units must be a positive number."
    }

    if (!trimmedAddress) {
      nextErrors.address = "Address is required."
    }

    if (!trimmedCity) {
      nextErrors.city = "City is required."
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    if (!tokens?.accessToken) {
      toast.error("You must be logged in.")
      router.push("/login")
      return
    }

    setIsSubmitting(true)
    try {
      await createCommunityWithoutAdmin(
        {
          name: formData.name.trim(),
          description: formData.description.trim(),
          totalUnits: Number(formData.totalUnits),
          address: formData.address.trim(),
          city: formData.city.trim(),
        },
        tokens.accessToken,
      )

      toast.success("Community created successfully.")
      router.push("/communities")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create community."
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
            <span className="sr-only">Back to communities</span>
          </Button>
        </Link>
        <div className={cn("space-y-1", isRTL && "text-right")}>
          <p className="inline-flex w-fit items-center rounded-md bg-secondary/15 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-secondary">
            Community Details
          </p>
          <h1 className="text-2xl font-bold text-foreground">Create Community (Without Admin)</h1>
          <p className="text-sm text-muted-foreground">Create a new community with basic details only.</p>
        </div>
      </div>

      <form noValidate onSubmit={handleSubmit}>
        <Card className="gradient-surface border border-border/70 shadow-md animate-slide-up">
          <CardHeader className="pb-3">
            <CardTitle className={cn("flex items-center gap-2 text-lg text-foreground", isRTL && "flex-row-reverse justify-end")}>
              <Building2 className="h-4.5 w-4.5 text-secondary" />
              Community Information
            </CardTitle>
            <CardDescription>Admin details are not required on this screen.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Community Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => updateField("name", e.target.value)}
                maxLength={100}
                className={cn("h-11 rounded-xl border-border/80 bg-background/80 shadow-sm", errors.name && "border-destructive", isRTL && "text-right")}
                aria-invalid={!!errors.name}
              />
              {errors.name && <ValidationMessage message={errors.name} />}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => updateField("description", e.target.value)}
                maxLength={500}
                rows={4}
                className={cn(
                  "flex w-full rounded-xl border border-input bg-background/80 px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-0",
                  errors.description ? "border-destructive" : "border-input",
                  isRTL && "text-right",
                )}
                aria-invalid={!!errors.description}
              />
              {errors.description && <ValidationMessage message={errors.description} />}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="totalUnits">Total Units</Label>
                <Input
                  id="totalUnits"
                  type="text"
                  inputMode="numeric"
                  value={formData.totalUnits}
                  onChange={(e) => updateField("totalUnits", e.target.value)}
                  className={cn("h-11 rounded-xl border-border/80 bg-background/80 shadow-sm", errors.totalUnits && "border-destructive", isRTL && "text-right")}
                  aria-invalid={!!errors.totalUnits}
                />
                {errors.totalUnits && <ValidationMessage message={errors.totalUnits} />}
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => updateField("city", e.target.value)}
                  className={cn("h-11 rounded-xl border-border/80 bg-background/80 shadow-sm", errors.city && "border-destructive", isRTL && "text-right")}
                  aria-invalid={!!errors.city}
                />
                {errors.city && <ValidationMessage message={errors.city} />}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => updateField("address", e.target.value)}
                className={cn("h-11 rounded-xl border-border/80 bg-background/80 shadow-sm", errors.address && "border-destructive", isRTL && "text-right")}
                aria-invalid={!!errors.address}
              />
              {errors.address && <ValidationMessage message={errors.address} />}
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 h-11 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Community"
              )}
            </Button>
          </CardContent>
        </Card>
      </form>
    </div>
  )
}
