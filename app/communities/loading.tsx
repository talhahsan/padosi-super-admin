import { Skeleton } from "@/components/ui/skeleton"

function SkeletonCard() {
  return (
    <div className="rounded-xl bg-card p-5 shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 flex flex-col gap-2">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>

      <div className="mt-4 flex items-center gap-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-20" />
      </div>

      <div className="mt-3">
        <Skeleton className="h-4 w-4/5" />
      </div>

      <div className="mt-4 flex items-center gap-2 border-t border-border pt-3">
        <div className="flex -space-x-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-7 rounded-full" />
          ))}
        </div>
        <Skeleton className="h-3 w-16" />
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
        <Skeleton className="h-3 w-10" />
        <Skeleton className="h-5 w-20 rounded" />
      </div>
    </div>
  )
}

export default function CommunitiesLoading() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card/80 px-5 py-4 shadow-sm backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-44" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-40 rounded-xl" />
        </div>

        <Skeleton className="h-11 w-full max-w-md rounded-xl" />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className={`animate-fade-in stagger-${i + 1}`}
            >
              <SkeletonCard />
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
