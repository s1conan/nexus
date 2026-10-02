"use client"

/* eslint-disable @typescript-eslint/no-explicit-any --
 * Supabase's PostgREST builder chain is heavily generic; a dynamic
 * table/select hook cannot express it without `any` at the seams. Page-level
 * `applyFilters` callbacks stay ergonomic because of this. */

import * as React from "react"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase"
import {
  constructIdInFilter,
  constructMultiWordSearch,
  searchRelatedIds,
} from "@/lib/utils"
import { useDebounce } from "@/hooks/use-debounce"
import { usePersistedState } from "@/hooks/use-persisted-state"

export interface SortLevel {
  id: string
  column: string
  direction: "asc" | "desc"
}

export interface SortColumnOption {
  label: string
  value: string
  /** Direction used when this column is first added as a sort level. */
  defaultDirection?: "asc" | "desc"
}

export interface RelatedSearch {
  table: string
  columns: string[]
  matchColumn: string
}

interface UseTableDataOptions<TStats> {
  table: string
  /** Explicit column list — never "*" for list views. */
  select: string
  /** Columns searched server-side with multi-word AND matching. */
  searchColumns?: string[]
  /** Related tables whose matching rows resolve to ids and match `matchColumn`. */
  relatedSearches?: RelatedSearch[]
  /** Dependency value (prefer a primitive). Changing it refetches page 0. */
  filters?: unknown
  /** Extra filter applied to the query builder (page wraps in useCallback if desired). */
  applyFilters?: (query: any) => any
  /** Sortable columns shown in <SortDialog />. */
  sortColumns?: SortColumnOption[]
  /** Default sort when nothing persisted yet. */
  defaultSort?: SortLevel[]
  /** When set, sort levels persist in `nids_pref_<key>` and survive logout. */
  sortPersistKey?: string
  /** Stable final `.order()` so pagination doesn't reshuffle. Set null to disable. */
  tieBreaker?: { column: string; ascending: boolean } | null
  /** Fired on mount + refresh() only — never on search/sort/filter change. */
  statsFetcher?: () => Promise<TStats>
  /** When set, the search query persists in `nids_persisted_<key>` (cleared on logout). */
  persistKey?: string
  pageSize?: number
  /** Search debounce in ms. Lower = snappier but more requests. Default 150. */
  searchDebounceMs?: number
  enabled?: boolean
}

interface UseTableDataResult<TRow, TStats> {
  rows: TRow[]
  /** True only for the first load while no rows exist → show SectionLoader. */
  isLoading: boolean
  /** Any in-flight request → show a small spinner, keep rows visible. */
  isFetching: boolean
  /** In-flight append (infinite scroll) → footer spinner. */
  isLoadingMore: boolean
  hasMore: boolean
  loadMore: () => void
  /** Refetch all currently-loaded rows + stats. Call after save/delete. */
  refresh: () => void
  searchQuery: string
  setSearchQuery: (value: string) => void
  sortLevels: SortLevel[]
  setSortLevels: (levels: SortLevel[]) => void
  sortColumns: SortColumnOption[]
  stats: TStats | null
  containerRef: React.RefObject<HTMLDivElement | null>
  sentinelRef: React.RefObject<HTMLTableRowElement | null>
}

type FetchMode = "reset" | "append" | "reload"

const DEFAULT_TIE_BREAKER = { column: "created_at", ascending: false }

export function useTableData<
  TRow extends Record<string, any> = Record<string, any>,
  TStats = unknown,
>(options: UseTableDataOptions<TStats>): UseTableDataResult<TRow, TStats> {
  const {
    table,
    select,
    searchColumns = [],
    relatedSearches = [],
    filters,
    applyFilters,
    sortColumns = [],
    defaultSort = [],
    sortPersistKey,
    tieBreaker = DEFAULT_TIE_BREAKER,
    statsFetcher,
    persistKey,
    pageSize = 50,
    searchDebounceMs = 150,
    enabled = true,
  } = options

  const supabase = createClient()

  const [rows, setRows] = React.useState<TRow[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isFetching, setIsFetching] = React.useState(false)
  const [isLoadingMore, setIsLoadingMore] = React.useState(false)
  const [hasMore, setHasMore] = React.useState(true)
  const [stats, setStats] = React.useState<TStats | null>(null)

  const [searchQuery, setSearchQuery, searchHydrated] = usePersistedState(
    persistKey ?? "__noop_search__",
    "",
    { scope: "session", enabled: !!persistKey }
  )
  const [sortLevels, setSortLevels, sortHydrated] = usePersistedState<
    SortLevel[]
  >(sortPersistKey ?? "__noop_sort__", defaultSort, {
    scope: "preference",
    enabled: !!sortPersistKey,
  })
  const debouncedQuery = useDebounce(searchQuery, searchDebounceMs)
  // True from the moment the search box changes until the debounced value
  // settles. Surfaced through `isFetching` so the spinner appears immediately
  // while typing, instead of only during the (very short) network round-trip.
  const searchSettling = searchQuery !== debouncedQuery

  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const sentinelRef = React.useRef<HTMLTableRowElement | null>(null)

  const requestIdRef = React.useRef(0)
  const offsetRef = React.useRef(0)
  const rowsLengthRef = React.useRef(0)
  const hasMoreRef = React.useRef(hasMore)
  const isFetchingRef = React.useRef(isFetching)
  const initializedRef = React.useRef(false)
  const statsFetcherRef = React.useRef(statsFetcher)

  // Latest render values, read by the stable fetch callback at call time.
  const configRef = React.useRef({
    supabase,
    table,
    select,
    searchColumns,
    relatedSearches,
    applyFilters,
    tieBreaker,
    pageSize,
    sortLevels,
    debouncedQuery,
    enabled,
  })

  // Sync the "latest values" refs after render (never during render).
  React.useEffect(() => {
    rowsLengthRef.current = rows.length
    hasMoreRef.current = hasMore
    isFetchingRef.current = isFetching || searchSettling
  }, [rows.length, hasMore, isFetching, searchSettling])

  React.useEffect(() => {
    statsFetcherRef.current = statsFetcher
  }, [statsFetcher])

  React.useEffect(() => {
    configRef.current = {
      supabase,
      table,
      select,
      searchColumns,
      relatedSearches,
      applyFilters,
      tieBreaker,
      pageSize,
      sortLevels,
      debouncedQuery,
      enabled,
    }
  })

  const fetchPage = React.useCallback(async (mode: FetchMode) => {
    const cfg = configRef.current
    if (!cfg.enabled) return

    const requestId = ++requestIdRef.current

    if (mode === "reset") {
      initializedRef.current = true
      if (rowsLengthRef.current === 0) setIsLoading(true)
      setIsFetching(true)
    } else if (mode === "append") {
      setIsLoadingMore(true)
      setIsFetching(true)
    } else {
      setIsFetching(true)
    }

    try {
      const startOffset = mode === "append" ? offsetRef.current : 0
      const requestedCount =
        mode === "reload"
          ? Math.max(rowsLengthRef.current, cfg.pageSize)
          : cfg.pageSize

      let query: any = cfg.supabase.from(cfg.table).select(cfg.select)

      // Server-side sorting (relation columns are skipped — not orderable here)
      cfg.sortLevels.forEach((level) => {
        if (level.column && !level.column.includes(".")) {
          query = query.order(level.column, {
            ascending: level.direction === "asc",
          })
        }
      })
      if (cfg.tieBreaker?.column) {
        query = query.order(cfg.tieBreaker.column, {
          ascending: cfg.tieBreaker.ascending,
        })
      }

      // Search: multi-word local columns + related-table id matching
      if (cfg.debouncedQuery) {
        const conditions: string[] = []
        const localSearch = constructMultiWordSearch(
          cfg.debouncedQuery,
          cfg.searchColumns
        )
        if (localSearch) conditions.push(localSearch)

        if (cfg.relatedSearches.length > 0) {
          const relatedIdLists = await Promise.all(
            cfg.relatedSearches.map((rel) =>
              searchRelatedIds(
                cfg.supabase as SupabaseClient,
                rel.table,
                cfg.debouncedQuery,
                rel.columns
              )
            )
          )
          cfg.relatedSearches.forEach((rel, index) => {
            const filter = constructIdInFilter(
              relatedIdLists[index],
              rel.matchColumn
            )
            if (filter) conditions.push(filter)
          })
        }

        if (conditions.length > 0) {
          query = query.or(conditions.join(","))
        }
      }

      if (cfg.applyFilters) {
        query = cfg.applyFilters(query)
      }

      query = query.range(startOffset, startOffset + requestedCount - 1)

      const { data, error } = await query
      if (error) throw error

      // Stale-guard: a newer request superseded this one — discard the response
      if (requestId !== requestIdRef.current) return

      const incoming = (data as TRow[] | null) ?? []

      if (mode === "append") {
        setRows((prev) => {
          const existing = new Set(
            prev.map((row) => String((row as Record<string, unknown>).id))
          )
          const fresh = incoming.filter(
            (row) =>
              !existing.has(String((row as Record<string, unknown>).id))
          )
          return [...prev, ...fresh]
        })
        offsetRef.current = startOffset + incoming.length
      } else {
        setRows(incoming)
        offsetRef.current = incoming.length
      }

      setHasMore(incoming.length === requestedCount)
    } catch (err) {
      if (requestId === requestIdRef.current) {
        console.error(`useTableData[${cfg.table}] fetch error:`, err)
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false)
        setIsFetching(false)
        setIsLoadingMore(false)
      }
    }
  }, [])

  // Reset to page 0 whenever search/sort/filters change (rows stay visible).
  React.useEffect(() => {
    if (!enabled) return
    if (!searchHydrated || !sortHydrated) return
    // Wait for the debounce to settle so a restored query triggers one fetch.
    if (debouncedQuery !== searchQuery) return
    // Data fetching on query/filter change is the intended synchronization.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPage("reset")
  }, [
    enabled,
    searchHydrated,
    sortHydrated,
    debouncedQuery,
    searchQuery,
    sortLevels,
    filters,
    fetchPage,
  ])

  const loadMore = React.useCallback(() => {
    if (!initializedRef.current) return
    if (!hasMoreRef.current || isFetchingRef.current) return
    fetchPage("append")
  }, [fetchPage])

  // Infinite scroll
  React.useEffect(() => {
    if (!enabled) return
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore()
      },
      { root: containerRef.current, rootMargin: "400px", threshold: 0 }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [enabled, loadMore])

  // Stats: mount + refresh only
  React.useEffect(() => {
    if (!enabled) return
    const fetcher = statsFetcherRef.current
    if (!fetcher) return
    let cancelled = false
    fetcher()
      .then((result) => {
        if (!cancelled) setStats(result)
      })
      .catch((err) => console.error(`useTableData[${table}] stats error:`, err))
    return () => {
      cancelled = true
    }
  }, [enabled, table])

  const refresh = React.useCallback(() => {
    fetchPage("reload")
    const fetcher = statsFetcherRef.current
    if (fetcher) {
      fetcher()
        .then(setStats)
        .catch((err) =>
          console.error(`useTableData[${table}] stats error:`, err)
        )
    }
  }, [fetchPage, table])

  return {
    rows,
    isLoading,
    isFetching: isFetching || searchSettling,
    isLoadingMore,
    hasMore,
    loadMore,
    refresh,
    searchQuery,
    setSearchQuery,
    sortLevels,
    setSortLevels,
    sortColumns,
    stats,
    containerRef,
    sentinelRef,
  }
}
