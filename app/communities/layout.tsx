import type { ReactNode } from "react"

import { DashboardHeader } from "@/components/dashboard-header"

export default function CommunitiesLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-muted">
      <div className="pointer-events-none absolute -left-24 top-24 h-56 w-56 rounded-full bg-secondary/15 blur-3xl animate-drift" />
      <div className="pointer-events-none absolute -right-24 top-10 h-64 w-64 rounded-full bg-accent/20 blur-3xl animate-float-soft" />
      <DashboardHeader />
      <section className="relative">{children}</section>
    </div>
  )
}
