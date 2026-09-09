# Task Context: DO "Fill SO later" workflow + invoice guard

Session ID: 2026-09-09-do-so-fill-later-workflow
Created: 2026-09-09
Status: completed

## Current Request
Add a "Fill SO later" option to the DO form's SO number field. A DO with empty `so_id` means the SO will be filled later. Such DOs must not be invoiceable until the SO is filled. Surface pending-SO DOs in the DO list (left-most red/green dot like the companies-page activity indicator) and flag them in the invoice DO dropdown. No new DB fields — use `so_id` emptiness as the marker.

User decisions:
- Invoice: BLOCK selection of DOs without SO (not just save).
- DO list: left-most dot indicator — red = empty SO, green = filled SO (companies-page pattern).

## Context Files (Standards to Follow)
- A:\Projects\nids\AGENTS.md (repo root agent standards; no .opencode/context exists)

## Reference Files (Source Material to Look At)
- nids-app/app/delivery-order/page.tsx (SO LiveSearch ~:1204, handleSOSelect ~:1037, list table ~:2146, colSpan={8} at :2166/:2173/:2338)
- nids-app/app/invoice/page.tsx (DO LiveSearch :1414-1522, onSelect :1459-1493, handleSave :695-709)
- nids-app/components/live-search.tsx (add footerOptions prop)
- nids-app/lib/site-content.ts (dict en ~:226 DO module section, id ~:823)
- nids-app/app/companies/page.tsx:1180-1189 (dot indicator pattern: size-2 rounded-full, bg-green-500)

## External Docs Fetched
None needed (no new libraries).

## Components
1. Dictionary keys (en + id): LABEL_FILL_SO_LATER, LABEL_SO_PENDING, MSG_SO_REQUIRED_FOR_INVOICE
2. LiveSearch footerOptions prop
3. DO form fill-later option + handler (keep company/product/qty/address)
4. DO list dot indicator + colSpan 8→9
5. Invoice: SO badge column in DO dropdown, block selection guard, save guard

## Constraints
- Surgical edits only; preserve user-tuned styles/classes.
- All UI text via lib/site-content.ts for en + id (dict typed as typeof SITE_CONTENT.en → keys must exist in BOTH).
- Reuse shadcn/ui components; no raw buttons/dialogs.
- No DB/schema changes (so_id already nullable FK with ON DELETE SET NULL).
- Keep X-clear behavior of LiveSearch distinct from fill-later option.

## Exit Criteria
- [ ] "Fill SO later" option selectable in DO form SO field; keeps manual company/product entries
- [ ] DO list shows left-most dot: red when so_id empty, green when filled
- [ ] Invoice DO dropdown flags DOs without SO; selecting one is blocked with a clear toast
- [ ] handleSave guard prevents invoices with empty so_id
- [ ] `npm run lint` and `npm run typecheck` pass
