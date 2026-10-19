# Task Context: Quotation Period Card

Session ID: 2026-10-06-quotation-period-card
Created: 2026-10-06T00:00:00Z
Status: in_progress

## Current Request
On `nids-app/app/dashboard/page.tsx`, the "New Quotations" card should represent "quotation this period", where a period is 1st–15th or 16th–end of month. The muted date period should be shown on the card. User confirmed: only the New Quotations card changes; sublabel shows the date range only (e.g. `01/10 – 15/10`).

## Context Files (Standards to Follow)
- C:\Users\Conan\.config\opencode\context\core\standards\code-quality.md
- C:\Users\Conan\.config\opencode\context\ui\web\ui-styling-standards.md

## Reference Files (Source Material to Look At)
- nids-app/app/dashboard/page.tsx (change site)
- nids-app/lib/site-content.ts (dict labels)
- nids-app/lib/formatters.ts (formatNumber / date formatting)
- nids-app/components/dictionary-provider.tsx (dict typing)
- nids-app/app/reports/profit-loss/page.tsx (existing date-fns month-boundary precedent)

## External Docs Fetched
None — date-fns v4 month-boundary APIs are stable and already used in repo.

## Components
- Dashboard "New Quotations" stat card only.

## Constraints
- Surgical edits; preserve user-tuned styling/classes.
- Do not modify other cards' "this week" sublabels.
- Client component; avoid hydration mismatch by computing period inside useEffect and storing in state.
- Follow existing muted sublabel pattern (`text-xs text-muted-foreground`).

## Exit Criteria
- [ ] New Quotations count uses 1–15 / 16–end-of-month period window.
- [ ] New Quotations sublabel shows muted date range only (`dd/MM – dd/MM`).
- [ ] Other dashboard cards unchanged.
- [ ] `npm run lint` and `npm run typecheck` pass.
