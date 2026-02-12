"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { fetchCommunities, type Community } from "@/lib/api"

const CACHE_TTL_MS = 30_000
type CommunitiesPayload = Awaited<ReturnType<typeof fetchCommunities>>

const communitiesCache = new Map<string, { ts: number; payload: CommunitiesPayload }>()
const communitiesInFlight = new Map<string, Promise<CommunitiesPayload>>()

function getCacheKey(params: {
  search?: string
  limit?: number
  cursor?: string
  token?: string
}) {
  return JSON.stringify({
    search: params.search || "",
    limit: params.limit || 12,
    cursor: params.cursor || "",
    token: params.token || "",
  })
}

function dedupeById(previous: Community[], incoming: Community[]) {
  const existing = new Set(previous.map((item) => item.id))
  return [...previous, ...incoming.filter((item) => !existing.has(item.id))]
}

async function fetchWithCache(params: {
  search?: string
  limit?: number
  cursor?: string
  token?: string
}): Promise<CommunitiesPayload> {
  const cacheKey = getCacheKey(params)
  const cached = communitiesCache.get(cacheKey)
  if (cached && Date.now() - cached.ts <= CACHE_TTL_MS) {
    return cached.payload
  }

  let request = communitiesInFlight.get(cacheKey)
  if (!request) {
    request = fetchCommunities(params)
    communitiesInFlight.set(cacheKey, request)
  }

  try {
    const response = await request
    communitiesCache.set(cacheKey, { ts: Date.now(), payload: response })
    return response
  } finally {
    communitiesInFlight.delete(cacheKey)
  }
}

export function useCommunities({
  enabled,
  search,
  token,
  limit = 12,
  onError,
}: {
  enabled: boolean
  search?: string
  token?: string
  limit?: number
  onError: (message: string) => void
}) {
  const [communities, setCommunities] = useState<Community[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const loadSeq = useRef(0)

  useEffect(() => {
    if (!enabled) return

    let cancelled = false
    const currentSeq = ++loadSeq.current

    setIsLoading(true)
    fetchWithCache({
      search: search || undefined,
      limit,
      token,
    })
      .then((response) => {
        if (cancelled || currentSeq !== loadSeq.current) return
        setCommunities(response.data)
        setNextCursor(response.pagination?.nextCursor || null)
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : "Failed to fetch communities"
        onError(message)
      })
      .finally(() => {
        if (!cancelled && currentSeq === loadSeq.current) {
          setIsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [enabled, limit, onError, search, token])

  const loadMore = useCallback(async () => {
    if (!nextCursor) return
    setIsLoadingMore(true)
    try {
      const response = await fetchWithCache({
        search: search || undefined,
        limit,
        cursor: nextCursor,
        token,
      })
      setCommunities((prev) => dedupeById(prev, response.data))
      setNextCursor(response.pagination?.nextCursor || null)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch communities"
      onError(message)
    } finally {
      setIsLoadingMore(false)
    }
  }, [limit, nextCursor, onError, search, token])

  return {
    communities,
    nextCursor,
    isLoading,
    isLoadingMore,
    loadMore,
  }
}
