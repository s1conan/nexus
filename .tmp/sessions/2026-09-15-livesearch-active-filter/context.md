# Task Context: Filter deactivated entities from LiveSearch pickers

Session ID: 2026-09-15-livesearch-active-filter
Created: 2026-09-15
Status: in_progress

## Current Request
"deactivated products still shown on livesearch across pages" — expanded on approval to all
entities (companies, products, vehicles) and AI auto-match libs. User approved: all 11
livesearch edits + automatch.

## Context Files (Standards to Follow)
- .opencode/context/project-intelligence/technical-domain.md (esp. standard #7 surgical edits)

## Reference Files (Source Material to Look At)
- nids-app/components/live-search.tsx (generic combobox; filtering lives in fetchData props)
- nids-app/app/deposit/page.tsx (~651 companies Supplier, ~704 products)
- nids-app/app/quotations/page.tsx (~1290 companies Customer, ~1388 products)
- nids-app/app/sales-order/page.tsx (~1363 companies Customer, ~1428 products)
- nids-app/app/delivery-order/page.tsx (~1661 companies Customer, ~1723 products,
  ~1990 companies Transporter, ~2198 companies Supplier, ~2287 vehicles)
- nids-app/lib/so-auto-match.ts (~56-62 companies + products lookups)
- nids-app/lib/do-auto-match.ts (~58-61 companies + products + vehicles lookups)
- schema.sql (products/companies is_active), update_vehicles_schema.sql (vehicles is_active)

## External Docs Fetched
None needed.

## Components
- LiveSearch entity pickers: add `.eq("is_active", true)` to 11 fetchData queries
- Auto-match libs: add same filter to company/product/vehicle catalog lookups

## Constraints
- Do NOT filter company-name sub-searches inside transaction pickers (delivery-order ~1585,
  sales-order ~1283, invoice ~1761/~1903) — historical transactions must stay findable
- Do NOT touch driver suggestions (delivery-order ~2050), mdi-layout.tsx company lookup,
  master-data CRUD pages (intentionally list all)
- funders-dialog.tsx already filtered — leave as is
- Existing records keep displaying via data/defaultDisplay props; only dropdown list filtered
- PostgREST ANDs top-level .eq() with .or() param — chaining is safe (pattern: funders-dialog)

## Exit Criteria
- [ ] 11 livesearch queries filter is_active = true
- [ ] so-auto-match.ts + do-auto-match.ts catalog lookups filter is_active = true
- [ ] npm run lint passes
- [ ] npm run typecheck passes
