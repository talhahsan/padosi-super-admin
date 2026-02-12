"use client"

import { AlertCircle } from "lucide-react"

import { cn } from "@/lib/utils"

export function ValidationMessage({
  message,
  id,
  className,
}: {
  message: string
  id?: string
  className?: string
}) {
  return (
    <div
      id={id}
      className={cn(
        "animate-fade-in inline-flex w-full items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2 text-sm text-destructive",
        className,
      )}
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  )
}
