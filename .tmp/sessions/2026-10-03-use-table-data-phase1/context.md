# Task Context: useTableData — Phase 1 (foundation + products proof)

Session ID: 2026-10-03-use-table-data-phase1
Created: 2026-10-03
Status: in_progress

## Current Request
Implement Phase 1 of the `useTableData` plan (`A:\Projects\nids\use-table-data-plan.md`):
build the shared hook + shared SortDialog + persistence scope, then migrate `products` as the proof page.

## Context Files (Standards to Follow)
- `.opencode/context/project-intelligence/technical-domain.md` (only context file; shadcn-only, ButtonLoader, site-content dictionary for user-facing text, surgical edits, kebab-case files, camelCase handlers)

## Reference Files (Source Material)
- `nids-app/app/products/page.tsx` — page to migrate (608 lines)
- `nids-app/app/quotations/page.tsx:2010-2105` — SortDialog source to extract; `1069-1108` sortedAndFilteredData (later phases)
- `nids-app/hooks/use-persisted-state.ts` — add scope + enabled + isHydrated
- `nids-app/hooks/use-debounce.ts` — reuse as-is
- `nids-app/lib/utils.ts` — constructMultiWordSearch, constructIdInFilter, searchRelatedIds
- `nids-app/components/auth-provider.tsx:99-103, 336-340` — BOTH logout cleanups must whitelist `nids_pref_`
- `nids-app/lib/site-content.ts:445-451, 1070-1076` — sort dict keys; `LABEL_THEN_BY` is empty (bug) → fill it; add `BUTTON_APPLY`
- `nids-app/components/section-loader.tsx` — loader API
- `nids-app/lib/supabase.ts` — createClient

## External Docs Fetched
None (internal patterns only).

## Components
1. `hooks/use-persisted-state.ts` — add `{ scope: "session"|"preference", enabled }` + return `isHydrated`
2. `components/auth-provider.tsx` — whitelist `nids_pref_` in BOTH cleanups
3. `lib/site-content.ts` — fill `LABEL_THEN_BY`, add `BUTTON_APPLY` (en + id)
4. `components/sort-dialog.tsx` — extracted multi-level sort dialog (stateless)
5. `hooks/use-table-data.ts` — shared data hook
6. `app/products/page.tsx` — migrate to the hook

## Constraints
- No new dependencies. Keep shadcn/ui components; preserve ButtonLoader/site-content patterns.
- Sorting persists in `nids_pref_*` (survives logout); search persists in `nids_persisted_*` (cleared on logout) — same key `products_search`.
- Page open = one 50-row `.range()` fetch (infinite scroll unchanged).
- `refresh()` reloads all currently-loaded rows (range 0..loaded-1) + stats so save/delete doesn't lose scroll depth.
- No test runner: verify with `npm run lint` + `npm run typecheck` from `nids-app`.

## Exit Criteria
- [ ] `use-persisted-state.ts` supports session/preference scope + enabled, returns hydration flag; existing call sites still compile
- [ ] Both logout cleanups preserve `nids_pref_*`
- [ ] `LABEL_THEN_BY` filled + `BUTTON_APPLY` added (en + id)
- [ ] `components/sort-dialog.tsx` created, shadcn-only, dict-driven
- [ ] `hooks/use-table-data.ts` created with search (multi-word), sort (server-side + persisted), stats on mount/refresh only, stale-guard, keep-rows loading, infinite scroll, refresh
- [ ] `products/page.tsx` migrated; multi-word search + sort dialog + no skeleton flash on search
- [ ] `npm run lint` + `npm run typecheck` pass
