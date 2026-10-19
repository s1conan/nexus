# Task Context: Unified sRGB Status Badge Colors

Session ID: 2026-10-06-status-badge-colors
Created: 2026-10-06
Status: completed

## Current Request
Status badge colors are inconsistent across the "Transaction" menu pages (and their
Report counterparts). Example: a DO with status "Invoiced" renders as gray (Draft
fallback) on `app/delivery-order/page.tsx` / `reports/delivery/page.tsx`, while
`app/invoice/page.tsx` renders "Invoiced" as blue. The user wants one shared color
theme across all Transaction pages, using simple sRGB-compliant colors (no
out-of-gamut/OKLCH colors that render inconsistently on most monitors).

Approved decisions:
- Option A: shared sRGB tokens in `globals.css` + a shared StatusBadge/helper.
- Reports adopt the same bordered translucent badge style as Transaction pages.
- Scope: all 6 Transaction pages + all 6 Report pages.

## Context Files (Standards to Follow)
- C:\Users\Conan\.config\opencode\context\core\standards\code-quality.md
- A:\Projects\nids\.opencode\context\project-intelligence\technical-domain.md
  (Code Standards #1 shadcn, #7 surgical edits preserve user-tuned styles)

## Reference Files (Source Material to Look At)
- nids-app/app/globals.css (theme tokens, @theme inline)
- nids-app/app/deposit/page.tsx
- nids-app/app/quotations/page.tsx
- nids-app/app/sales-order/page.tsx
- nids-app/app/delivery-order/page.tsx
- nids-app/app/invoice/page.tsx
- nids-app/app/payments/page.tsx
- nids-app/app/reports/{deposit,quotation,sales-order,invoice,payments,delivery}/page.tsx

## Unified Status -> Role Mapping
- neutral:  Draft, Default
- pending:  Pending, Sent
- info:     Approved, Accepted, Invoiced
- progress: Partial, Shipped
- success:  Processed, Fulfilled, Delivered, Paid, Verified
- danger:   Rejected, Cancelled
- overdue:  Overdue

## sRGB Palette (light text / dark text; fill & border identical both modes)
| Role | Light | Dark | Fill | Border |
|---|---|---|---|---|
| neutral | #52525b | #a1a1aa | rgb(113 113 122 / .10) | rgb(113 113 122 / .20) |
| pending | #b45309 | #fbbf24 | rgb(217 119 6 / .10) | rgb(217 119 6 / .20) |
| info | #1d4ed8 | #60a5fa | rgb(37 99 235 / .10) | rgb(37 99 235 / .20) |
| progress | #6d28d9 | #a78bfa | rgb(124 58 237 / .10) | rgb(124 58 237 / .20) |
| success | #047857 | #34d399 | rgb(5 150 105 / .10) | rgb(5 150 105 / .20) |
| danger | #b91c1c | #f87171 | rgb(220 38 38 / .10) | rgb(220 38 38 / .20) |
| overdue | #be123c | #fb7185 | rgb(225 29 72 / .10) | rgb(225 29 72 / .20) |

## Components
- globals.css tokens: `--status-*` (text), `--status-*-fill`, `--status-*-border`
- lib/status-styles.ts: role map + getStatusRole + getStatusBadgeClass
- components/status-badge.tsx: shared <StatusBadge />

## Constraints
- Surgical edits; preserve surrounding markup/mobile classes.
- No hardcoded user-facing text (status words already come from data).
- Tailwind v4, no tailwind.config.
- Must run lint + typecheck after.

## Exit Criteria
- [ ] Single source of truth for status colors
- [ ] "Invoiced" distinct from "Draft" on every page
- [ ] Report pages visually match Transaction pages
- [ ] lint + typecheck pass
