# Task Context: Invoice — Re-open Editable Tax Parameters

Session ID: 2026-10-19-invoice-tax-toggle
Created: 2026-10-19
Status: in_progress

## Current Request
Allow users with edit permission to change tax parameters on/off in the Invoice
dialog (`nids-app/app/invoice/page.tsx`). Today the invoice dialog has NO tax
controls: `tax_details` are seeded from the linked Sales Order and shown only as
read-only lines inside the "Review Summary" card.

## Decisions (user-approved)
1. **Reversal approved** — a prior session (`.tmp/sessions/2026-06-25-invoice-upgrade/context.md`)
   deliberately made invoice taxes read-only ("taxes are derived from DO→SO").
   The user has explicitly reversed that decision.
2. **On/off only, rate locked** — per `inventory-tax-blueprint.md`: "Read-Only
   Locked Rates". Rates render in a `disabled` NumberInput, exactly like
   `app/quotations/page.tsx`.
3. **Placement** — when the logged-in user has edit permission, the toggles
   REPLACE the existing read-only tax lines inside the Review Summary card.
   Users without edit permission keep the current read-only display.
4. **Fix all 3 `delivery_taxable` read sites** — currently the Sales Order value
   overrides the invoice's saved value in the dialog calc, the list table calc
   and the PDF, so a delivery-taxable toggle would be a no-op.
5. **Any editable invoice** — toggles enabled whenever the dialog is editable
   (`canEdit && !viewOnly`), i.e. Draft and Sent. `viewOnly` already covers
   Paid/Partial and read-only opens.

## Context Files (Standards to Follow)
- A:\Projects\nids\inventory-tax-blueprint.md — feature spec + Layout Standard
  `[ Tax Name ] [ Switch ] [ % Rate ] [ Calculated IDR ]`, locked rates
- A:\Projects\nids\coding-preferences.md — `<Switch>` for booleans, `<NumberInput>`
  for numerics, dictionary text, surgical edits
- A:\Projects\nids\GEMINI.md — never overwrite `components/ui/*`; hydration-safe DOM
- A:\Projects\nids\.opencode\context\project-intelligence\technical-domain.md + navigation.md
- C:\Users\Conan\.config\opencode\context\core\standards\code-quality.md
- A:\Projects\nids\.agents\skills\shadcn\SKILL.md + rules/composition.md, forms.md, styling.md

## Reference Files (Source Material to Look At)
- A:\Projects\nids\nids-app\app\invoice\page.tsx — target file
- A:\Projects\nids\nids-app\app\quotations\page.tsx — reference toggle implementation
  (globalTaxes state, mount fetch `category='tax'`, merge helper, `tax_details.map` block)
- A:\Projects\nids\nids-app\app\deposit\page.tsx — blueprint's named reference implementation
- A:\Projects\nids\nids-app\lib\pdf-generator.tsx — line ~2863 delivery_taxable mapping

## Components
1. `globalTaxes` state + mount fetch of `app_settings` where `category = 'tax'`.
2. `buildTaxList(sourceTaxes)` helper — merge SO/saved taxes with global taxes
   (existing keeps saved rate+enabled; global-only entries added `enabled: false`;
   saved custom taxes not in globals preserved). Fallback: globals empty → keep saved.
3. Seed via `buildTaxList` in `handleAddDO`, `handleSelectSO`, `handleOpenDialog`.
4. `invoiceCalc`: read `formData.delivery_taxable` (was `soInfo.delivery_taxable`).
5. Summary card "Taxes" block: interactive rows when `canToggleTaxes`, otherwise
   the existing read-only rows unchanged.
6. `calculateInvoiceTotals` + `pdf-generator.tsx`: prefer `inv.delivery_taxable`
   over `soInfo.delivery_taxable`.

## Constraints
- Surgical edits only; preserve existing classes/structure the user hand-tunes.
- No DB change needed: `invoices.tax_details` (JSONB) and `invoices.delivery_taxable`
  already exist and `payload` already persists both.
- No new site-content strings: `dict.LABEL_TAXES` and `dict.LABEL_DELIVERY_TAXABLE`
  already exist (en + id), used by quotations.
- Do NOT re-fetch the global rate when a tax is switched ON (quotations does) —
  that would unlock a rate on an existing invoice, contradicting decision 2.

## Exit Criteria
- [x] Edit-permitted users can toggle each tax on/off in the invoice dialog
- [x] Users without edit permission still see the read-only tax display
- [x] `delivery_taxable` toggle affects dialog, list table and PDF consistently
- [x] Toggling persists to `invoices.tax_details` / `invoices.delivery_taxable`
      (`payload = {...cleanFormData, ...}` already carries both fields)
- [x] `npm run typecheck` passes
- [x] Focused `eslint app/invoice/page.tsx` clean; pdf-generator.tsx error count
      identical to HEAD (28 problems — pre-existing, not from this change)
- [ ] NOT RUN: `npm run lint` repo-wide fails at baseline (pre-existing `any` /
      `require()` errors across many files)

## Post-implementation notes
- The interactive tax rows render ALL `formData.tax_details` entries (including
  disabled ones) so users can switch a tax back ON; the read-only branch still
  renders only enabled taxes, unchanged.
- Deliberately did NOT copy the quotation's rate re-fetch on switch-ON (which
  pulls the current global rate) — that would unlock a rate on an already-issued
  invoice, contradicting the locked-rate decision.
- `buildTaxList` appends currently-configured global taxes (switched OFF) to an
  existing invoice's saved list on open, so saving rewrites `tax_details` with
  those extra disabled rows. Amounts are unaffected (PDF/table filter on
  `enabled`). Same behaviour as quotations. No `supabase/migrations` exists; no
  DB change was needed since `invoices.tax_details` and `invoices.delivery_taxable`
  already exist.
