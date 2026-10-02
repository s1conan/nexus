# Plan: `useTableData` — Unified Table Search / Loading / Sorting

> Status: DESIGN (not yet implemented)
> Created: 2026-10-03
> Scope: `nids-app` module pages (`products`, `companies`, `vehicles`, `funders`, `payments`, `deposit`, `invoice`, `sales-order`, `quotations`, `delivery-order`)
> Out of scope: `users` (no server search/pagination), `dashboard` (mount-only stats, already correct)

---

## 1. Goals

1. **One shared hook** — all pages get the same search, loading, and sorting behavior; future improvements land everywhere at once.
2. Fix verified per-generation problems:
   - Multi-word search broken on `products`, `vehicles`, `funders`, `quotations` (single-word `.or(ilike)` only)
   - Stats re-fired on every search keystroke on 7 pages (`companies` 4, `quotations` 4, `invoice` 4, `funders` 2, `vehicles` 2, `users` 3; `payments` fetches the whole table for stats)
   - Table blanks to `SectionLoader` skeleton on every search/sort change (all pages)
   - No stale-response guard anywhere (race while typing)
   - `select("*")` everywhere (heavy JSONB `details` fetched for list rows)
   - Related-table search = 2 sequential network hops (`sales-order`, `delivery-order`, `deposit`, `invoice`)
   - Quotations re-filters AND re-sorts server results client-side (double work)
3. **Sorting as a first-class shared feature** — quotations-style multi-level sort dialog available on every page.
4. **Sorting survives logout** (user preference); search/filter state keeps current behavior (cleared on logout with the session).
5. No new dependencies. Built on existing helpers: `constructMultiWordSearch`, `constructIdInFilter`, `searchRelatedIds` (`lib/utils.ts`).
6. Infinite scroll and page-open payload stay exactly as today: **one 50-row page per fetch, server-side `.range()` pagination**.

---

## 2. Deliverables

| # | File | What |
|---|------|------|
| 1 | `nids-app/hooks/use-table-data.ts` | The shared data hook (search, sort, pagination, stats timing, stale-guard, loading UX) |
| 2 | `nids-app/components/sort-dialog.tsx` | Shared multi-level sort dialog (extracted from `quotations/page.tsx:2017-2105`) |
| 3 | `nids-app/hooks/use-persisted-state.ts` | Extended: `scope` option (`"session"` \| `"preference"`) |
| 4 | `nids-app/components/auth-provider.tsx` | One-line edit: whitelist the whole `nids_pref_` namespace on logout |
| 5 | `nids-app/lib/site-content.ts` | New dict keys for sort UI (`en` + `id`) |
| 6 | 10 module pages | Migrated to the hook (phased, see §8) |

---

## 3. Persistence design (the "survive logout" rule)

Current behavior (verified):

- `usePersistedState` writes `nids_persisted_<key>` localStorage keys.
- `auth-provider.tsx` `expireSession` (lines 99-103) removes **every** `nids_*` key except `nids_pref_lang`:
  ```js
  if (key.startsWith("nids_") && key !== "nids_pref_lang") localStorage.removeItem(key)
  ```

Design — two namespaces:

| Namespace | Scope | Cleared on logout? | Used for |
|---|---|---|---|
| `nids_persisted_*` | session | ✅ yes (unchanged) | search query, filters, dialog/form state (current behavior preserved) |
| `nids_pref_*` | user preference | ❌ no (survives) | **sort levels**, language (existing `nids_pref_lang`) |

Changes:

1. **`use-persisted-state.ts`** — add options param:
   ```ts
   usePersistedState(key, initialState, { scope: "session" | "preference" })
   // session (default) → nids_persisted_<key>   (unchanged)
   // preference       → nids_pref_<key>          (survives logout)
   ```
   Backwards compatible: no options = current behavior.
2. **`auth-provider.tsx`** — surgical edit to the logout whitelist:
   ```js
   // before
   if (key.startsWith("nids_") && key !== "nids_pref_lang")
   // after
   if (key.startsWith("nids_") && !key.startsWith("nids_pref_"))
   ```
   Keeps `nids_pref_lang` working and adds the whole preference namespace.

---

## 4. The Hook — `use-table-data.ts`

### API contract

```tsx
export interface SortLevel {
  id: string
  column: string
  direction: "asc" | "desc"
}

interface UseTableDataOptions<TRow, TStats> {
  table: string
  select: string                     // explicit columns — never "*"
  searchColumns?: string[]          // multi-word ilike search (all pages get generation B)
  relatedSearches?: {               // related-table search, centralized
    table: string
    columns: string[]
    matchColumn: string             // e.g. "company_id"
  }[]
  filters?: unknown                 // dep value — change triggers refetch
  applyFilters?: (q: PostgrestFilterBuilder) => PostgrestFilterBuilder  // useCallback-wrapped

  // Sorting
  sortColumns: { label: string; value: string }[]  // sortable columns (dict labels)
  defaultSort: SortLevel[]          // e.g. [{ id: "1", column: "created_at", direction: "desc" }]
  sortPersistKey?: string           // e.g. "products_sort" → nids_pref_products_sort (survives logout)
  tieBreaker?: { column: string; ascending: boolean }  // default { column: "created_at", ascending: false }

  statsFetcher?: () => Promise<TStats>   // fired on MOUNT + refresh() ONLY — never on search/sort/filter change
  persistKey?: string               // search query persistence → nids_persisted_<key> (cleared on logout, current behavior)
  pageSize?: number                 // default 50
}

interface UseTableDataReturn<TRow, TStats> {
  rows: TRow[]
  isLoading: boolean        // true ONLY on first load && rows empty → SectionLoader
  isFetching: boolean       // any in-flight fetch → small spinner, rows stay visible
  hasMore: boolean
  loadMore: () => void
  sentinelRef: RefObject<HTMLDivElement>   // hook owns the IntersectionObserver
  searchQuery: string
  setSearchQuery: (v: string) => void
  sortLevels: SortLevel[]
  setSortLevels: (levels: SortLevel[]) => void
  stats: TStats | null
  refresh: () => void       // refetch page-0 view + stats — call after save/delete
}
```

### Internal behavior spec

| # | Rule | Implementation |
|---|------|----------------|
| 1 | Debounce | Hook owns it — 300ms on search query (same as today) |
| 2 | Search | `constructMultiWordSearch(query, searchColumns)` → `.or()` — multi-word works everywhere |
| 3 | Related search | `Promise.all(relatedSearches.map(searchRelatedIds))` → `constructIdInFilter` → merged into one `.or()` with local columns |
| 4 | Stats timing | `statsFetcher` on mount + inside `refresh()` only. Never on search/sort/filter change |
| 5 | Stale-guard | `requestId` ref incremented per fetch; ignore responses whose id ≠ latest (guards search-vs-loadMore overlap too). Optional stronger version: `AbortController` + `.abortSignal()` |
| 6 | Loading UX | `isLoading` = first load && `rows.length === 0` → existing `SectionLoader`. Otherwise rows stay rendered; page shows small `Loader2` spinner near the search input when `isFetching` |
| 7 | Pagination | `.range(offset, offset + pageSize - 1)`; `hasMore = data.length === pageSize`; dedupe-by-id on append. **Page open = exactly one 50-row fetch — unchanged** |
| 8 | Infinite scroll | IntersectionObserver on `sentinelRef`; auto-`loadMore()` when visible && `hasMore && !isFetching` |
| 9 | Sorting (server) | `sortLevels.forEach(level => query = query.order(level.column, { ascending: level.direction === "asc" }))`; skip dotted/relation columns server-side (quotations' current rule); always append `tieBreaker` as final `.order()` for stable pagination |
| 10 | Sort persistence | `sortLevels` stored via `usePersistedState(sortPersistKey, defaultSort, { scope: "preference" })` → `nids_pref_*` → **survives logout**; sort change triggers refetch of page 0 (same as search change) |

---

## 5. The Sort Dialog — `components/sort-dialog.tsx`

Extracted from `quotations/page.tsx:2017-2105` so every page gets the identical sorting UI:

- **Trigger**: outline Button with sort icon + "Sort" label (hidden text on mobile, like quotations) — placed next to the search input in the page's action bar
- **Dialog**: multi-level rows — column `Select` (from `sortColumns` props, dict labels) + direction `Select` (Ascending/Descending) + remove `Button` (disabled when only 1 level) + "Add level" `Button` + Apply/Close
- **Props**: `open, onOpenChange, sortLevels, sortColumns, onChange(levels: SortLevel[])` — stateless; the hook owns state
- **Dictionary fix**: quotations currently hardcodes "Sort" and "Apply" (and direction labels) — the shared component must use new `site-content.ts` keys for `en` + `id` (Code Standard #3: no hardcoded UI text)
- **Column values**: top-level, server-sortable columns only. Quotations' `company_id`/`product_id` proxy pattern (sort by FK id, labeled "Company Name"/"SKU") is acceptable where the joined column can't sort server-side. PostgREST embedded-resource ordering (`company(name)`) is a future verification item, not v1

---

## 6. Per-page migration configs

> `select` per page = exactly the columns its TableRow cells render — audit each table's cells during migration (that's the `select("*")` fix). ⚠️ = audit needed. `sortColumns` = start from the page's table headers.

| Phase | Page | searchColumns | relatedSearches | sortColumns (draft) | defaultSort | statsFetcher | Notes |
|---|---|---|---|---|---|---|---|
| 1 | `products` | `name, sku` | — | name, sku, base_price, is_active ⚠️ | `is_active desc, name asc` | — | Proof page; simplest |
| 2 | `vehicles` | `license_number, vehicle_type` | — | license_number, vehicle_type, capacity, is_active ⚠️ | `is_active desc, vehicle_type asc` | **2 counts (total, active)** — no aggregate | **Remove the "Total Capacity" SummaryCard** + its fleet `select("capacity")` query — it was display-only with zero consumers. Per-vehicle `capacity` column in the table stays (uses the stored field directly; never reads `compartments` JSON at stats time) |
| 2 | `funders` | `name, id_number, phone` | — | name, id_number, phone ⚠️ | `is_active desc, name asc` ⚠️ | 2 counts | Gains multi-word search |
| 2 | `companies` | `name, nickname, details->>email, details->>phone, details->>contact_person` | — | name, nickname, is_active ⚠️ | `is_active desc, name asc` | 4 counts | `filters: typeFilter` + `applyFilters` → `.contains("type", [typeFilter])` |
| 3 | `sales-order` | `so_number` | companies(name)→`company_id`, products(sku)→`product_id` | so_number, company_id, product_id, status ⚠️ | `created_at desc` | — | Keep its explicit join `select` |
| 3 | `delivery-order` | `do_number` ⚠️ | companies, products | do_number, company_id, status ⚠️ | `created_at desc` | — | Same shape as sales-order |
| 3 | `deposit` | `deposit_number` ⚠️ | companies→`company_id` | deposit_number, company_id, amount ⚠️ | `created_at desc` | — | |
| 3 | `invoice` | `invoice_number` + local cols ⚠️ | companies→`company_id` | invoice_number, company_id, status ⚠️ | `created_at desc` | 4 counts | |
| 4 | `payments` | `payment_number, reference_number` ⚠️ | — | payment_number, amount, status, payment_date ⚠️ | `created_at desc` ⚠️ | Replace full-table fetch: counts + `select("amount,status")` aggregate, mount-only | totalAmount can't be a count query |
| 4 | `quotations` | `quotation_number` + **fold client-side filter columns in** ⚠️ | — | quotation_number, company_id, product_id, quotation_date, expiry_date, minimum_order, status (existing list, lines 1128-1135) | `created_at desc` | 4 counts | Delete `sortedAndFilteredData` block (~1069-1108) after folding; delete local sort dialog (2017-2105) in favor of shared `SortDialog` |

---

## 7. What gets deleted from each page after migration

- `fetchData`/`fetchProducts`/etc. useCallback (whole body)
- `loading / loadingMore / hasMore / offset` state + `setLoading` flash logic
- `debouncedSearchQuery` + `useDebounce` import
- `observerTarget` ref + IntersectionObserver effect
- `fetchStats` useCallback (moves into `statsFetcher`)
- `searchQuery` state (hook owns it; same `persistKey` → saved searches keep working, still cleared on logout)
- `sortLevels` state + `addSortLevel`/`removeSortLevel`/`updateSortLevel` + local sort dialog JSX (quotations)
- `sortedAndFilteredData` client re-filter/re-sort memo (quotations)

Page keeps: layout, stats cards (read `stats`), dialogs, permissions, `handleSave`/`handleDelete` (ending with `refresh()`), render swap `{isLoading ? <SectionLoader/> : <Table>}` + `{isFetching && <Loader2 className="animate-spin ..." />}` near the search input + `<SortDialog />` + Sort trigger button.

---

## 8. Migration phases (one page verified per step)

1. **Phase 1 — foundation + proof**: `use-table-data.ts` + `sort-dialog.tsx` + `use-persisted-state.ts` scope option + `auth-provider.tsx` whitelist edit + dict keys → migrate `products` (simplest: no stats, no related)
2. **Phase 2 — simple family**: `vehicles`, `funders`, `companies` (adds typeFilter + JSONB search columns + stats)
3. **Phase 3 — related-search family**: `sales-order`, `delivery-order`, `deposit`, `invoice`
4. **Phase 4 — special cases**: `payments` (stats via counts + mount-only aggregate), `quotations` (fold client filter into searchColumns; swap local sort dialog for shared one)

Per phase: `cd nids-app && npm run lint` + `npm run typecheck`; `npm run build` at phase end.

---

## 9. Verification checklist (per page)

- [ ] Initial load: exactly ONE 50-row list query (+ stats once) — check Network tab
- [ ] Single-word search works
- [ ] **Multi-word search works** (e.g. two words from one name)
- [ ] Search change: stats do NOT refire (Network tab); table stays visible with spinner
- [ ] Sort dialog: add/remove levels, apply → refetch page 0 in new order
- [ ] Multi-level sort + tiebreaker stable across pages (scroll: no duplicated/reordered rows)
- [ ] Sort + search + infinite scroll combined
- [ ] Save/delete → `refresh()` refetches view + stats
- [ ] Page reload → persisted search restores (unchanged); sort restores
- [ ] **Logout → login: sort preference survives; search/filter cleared** (current behavior kept)
- [ ] `nids_pref_lang` still survives logout (whitelist edit regression check)
- [ ] (vehicles only) "Total Capacity" SummaryCard removed; the fleet `select("capacity")` query no longer fires (stats = total + active counts only); per-vehicle capacity still shows in the table

---

## 10. Gotchas

- **RLS/permissions unchanged** — same browser client; pages still gate with `hasPermission`
- **Persisted keys preserved** — same `nids_persisted_*` keys via `persistKey`; no user-visible change
- **`applyFilters` must be `useCallback`-wrapped** or it refetches every render
- **Quotations**: verify folded server `searchColumns` cover the old client-side filter before deleting the block
- **payments sums**: count queries can't sum `amount` — keep a small mount-only aggregate fetch (still a huge win vs per-keystroke) or an SQL RPC later. Vehicles no longer needs an aggregate (Total Capacity stat removed)
- **Vehicles capacity is display-only** — do NOT re-introduce a fleet capacity aggregate; `compartments` JSON is never summed for stats, and delivery orders/auto-match/PDFs use only seal numbers + compartment count
- **Spinner is icon-only** (`Loader2`) — no new text; aria-label via dict if desired
- **Sort column values must be server-sortable** (top-level columns / FK ids) — dotted relation columns are skipped server-side by rule 9
- **auth-provider edit is load-bearing** — without the `nids_pref_` whitelist, sorting would be cleared on logout like everything else

---

## 11. Future upgrades (zero page changes after migration)

- Swap related-search 2-hop → single Postgres RPC inside the hook
- `pg_trgm` GIN index SQL script for all `searchColumns` (+ JSONB expression indexes for `details->>email` etc.)
- PostgREST embedded-resource ordering (`company(name)`) — verify, then allow relation columns in `sortColumns`
- TanStack Query swap inside the hook (cross-tab caching) if ever needed
- Client-side filter mode for tiny tables (opt-in per page, never default)
