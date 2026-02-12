"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface FloatingInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: boolean
}

const FloatingInput = React.forwardRef<HTMLInputElement, FloatingInputProps>(
  ({ label, error, className, id, value, ...props }, ref) => {
    const [focused, setFocused] = React.useState(false)
    const hasValue = typeof value === "string" ? value.length > 0 : false
    const isActive = focused || hasValue

    return (
      <div className="relative">
        <input
          ref={ref}
          id={id}
          value={value}
          onFocus={(e) => {
            setFocused(true)
            props.onFocus?.(e)
          }}
          onBlur={(e) => {
            setFocused(false)
            props.onBlur?.(e)
          }}
          className={cn(
            "peer flex h-14 w-full rounded-md border bg-background px-4 pt-5 pb-2 text-base font-normal text-foreground outline-none transition-all duration-200",
            "placeholder:text-transparent",
            "focus:border-secondary focus:ring-2 focus:ring-secondary/20",
            error
              ? "border-destructive focus:border-destructive focus:ring-destructive/20"
              : "border-input",
            className,
          )}
          placeholder={label}
          {...props}
        />
        <label
          htmlFor={id}
          className={cn(
            "pointer-events-none absolute left-4 transition-all duration-200 font-normal",
            isActive
              ? "top-1.5 text-xs text-muted-foreground"
              : "top-1/2 -translate-y-1/2 text-base text-muted-foreground",
            focused && !error && "text-secondary",
            error && "text-destructive",
          )}
        >
          {label}
        </label>
      </div>
    )
  },
)
FloatingInput.displayName = "FloatingInput"

export { FloatingInput }
