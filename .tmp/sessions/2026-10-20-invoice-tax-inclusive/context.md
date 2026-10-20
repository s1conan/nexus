# Task Context: Invoice — Tax-Inclusive Pricing

Session ID: 2026-10-20-invoice-tax-inclusive
Created: 2026-10-20
Status: implemented

## Current Request
Add a "Tax Included (PPN)" switch to the invoice dialog. When the switch and a
tax switch are on, the stated price is treated as GROSS: the tax is backed out
so that re-adding it lands exactly on the stated price (23,850 → DPP 21,486 +
PPN 2,364 = 23,850).

## Decisions (user-approved)
1. **Unit price only** — the product line (unit price × qty) is gross. The
   delivery fee is never netted; it is added on top and taxed only when
   `delivery_taxable` is on.
2. **All enabled taxes combined** — divisor `1 + Σ enabled rates`; the embedded
   tax is split across taxes by rate, with the rounding residual absorbed by the
   last enabled tax.
3. **Invoice only for now** — quotations/SOs keep tax-exclusive pricing.
4. **PDF**: print the **NET unit price** so `qty × price + tax rows = total`.
   One row per tax — no "included" deduction rows and no `Subtotal (DPP)` row.
   Display values are whole rupiah and chain exactly:
   `base − discount + shrinkage === product`.
5. **Rounding**: `tax = gross − net` so the grand total reconciles exactly.
6. **Storage**: new `invoices.tax_inclusive BOOLEAN DEFAULT false` column.

## Formula (lib/invoice-calc.ts)
```
netProduct  = round(afterDiscount / (1 + Σrates/100))
embeddedTax = round(afterDiscount) − netProduct
tax_i       = embeddedTax × rate_i / Σrates   (residual on the last enabled tax)
              + (delivery_taxable && PPN ? round(delivery × rate/100) : 0)
subtotal    = round(netProduct + delivery)
grandTotal  = subtotal + taxTotal              (== stated price + delivery [+ delivery PPN])
```
Exclusive mode is byte-for-byte the previous behaviour (verified numerically:
23,850 + 11% = 26,474).

## Files
- `nids-app/lib/invoice-calc.ts` — NEW shared pure calculator (dialog, list, PDF)
- `nids-app/app/invoice/page.tsx` — state, seeding/resets, `invoiceCalc`,
  `calculateInvoiceTotals`, Switch, summary deduction line + read-only branch
- `nids-app/lib/pdf-generator.tsx` — `InvoiceData.tax_inclusive`, inclusive rows,
  mapping
- `nids-app/add_tax_inclusive.sql` — NEW migration (run manually)
- `nids-schema-20260930.sql` — invoices column added
- `nids-app/lib/site-content.ts` — `LABEL_TAX_INCLUDED` is now generic, without a
  hardcoded tax name: en "Tax Included", id "Termasuk Pajak". The summary sub-label
  lists the actual enabled taxes at runtime (e.g. "PPN 11% + PBBKB 7.5%").

## Verification
- `npm run typecheck` — clean
- `eslint app/invoice/page.tsx lib/invoice-calc.ts lib/site-content.ts` — clean
- `pdf-generator.tsx` — identical 28 pre-existing problems to HEAD
- Numeric harness over 6 cases (compiled helper) — all pass; exclusive matches
  the old totals exactly

## Performance fix (invoice open latency)
- `handleOpenDialog` DO mode no longer clears `selectedDOs` first. It seeds
  `selectedDOs` synchronously from `item.do_refs` + the already-joined `item.po`
  so the calculation panel paints on the first frame; the fetch then only fills
  in `status`.
- The DO fetch payload was narrowed from `select("*")` + 3 joins to six columns
  plus a lean SO join. `company` is merged from the invoice row instead of being
  re-joined; unused `product`, `so.tax_details`, `so.po_number`, `so.so_date` and
  `so.delivery_taxable` were dropped.
- The DO-list status badge is guarded so seeded rows (status not yet loaded)
  render no empty pill.
- Legacy invoices with an empty `do_refs` still fall back to clear + fetch.
- Not done: a per-`do_id` cache (repeat opens still re-fetch).

## Loading pills + SO-mode parity
- The invoice list query now embeds the SO's DOs
  (`po:sales_orders(..., delivery_orders:delivery_orders(id, do_number,
  quantity, received_quantity, status))`), so both modes read live DO data
  from the row:
  - SO mode uses the whole embedded list.
  - DO mode filters it by the invoice's `do_ids` (`buildDosFromSo`), attaching
    `so` + `company` so the calculation and validation work unchanged.
  Either mode therefore skips the per-open fetch and the skeleton pills in the
  normal case. `do_refs` + `fetchSODOs` remain the fallback when `po` is
  missing or the embed is incomplete. The embed was validated against
  PostgREST (parsed OK; anon RLS returned 0 rows).
- `do_refs` remains the fallback when `po` is missing; then `fetchSODOs` runs
  with a request-id guard so a stale response cannot overwrite a newer open.
- Added `Skeleton` pills for any DO row whose status has not arrived yet, in
  both the DO List and Delivery Progress sections. Pill skeleton is 20px tall
  (`h-5`) and 68/72px wide; the real pills now carry
  `min-w-[68px] md:min-w-[72px] justify-center` so statuses of different
  lengths do not shift the layout.
- Skeleton rows mirror the real row structure (same flex-col / `md:flex-row`,
  `py-1`, `gap-0.5`, `divide-y`), so there is no height jump.

## SO-backed invoices now update DO statuses
- Save (create/edit): resolves the SO's DOs, snapshots them into `do_refs`
  (keeps `do_ids` empty so the invoice still reopens in SO mode), then marks
  every covered DO that is `Shipped`/`Delivered` as `Invoiced`.
- Manual status change, cancel, and delete reconcile the same way:
  `Invoiced -> Delivered` for DOs this invoice no longer covers.
- Reversal guard: a DO is only released when no other live (non-cancelled)
  invoice covers it; an SO-mode invoice (`do_ids = []`) counts as covering the
  whole SO.
- Mode switches reconcile fully (SO -> DO releases unselected DOs; DO -> SO
  marks the rest of the SO's DOs).
- Marking is status-driven, so saving a legacy SO-mode invoice (empty
  `do_refs`) repairs its previously-unmarked DOs.
- Creating an SO invoice whose DOs are all already invoiced emits a warning
  toast but is allowed. DO update failures also surface a warning toast.
- Legacy invoices with an empty `do_refs` still fall back to clear + fetch.

## Deployment note
`invoices.tax_inclusive` was verified present in the live project (PostgREST
select succeeded; the earlier missing-column warning is obsolete). No further
step is needed for that column.

## Delivery-fee override + "price includes delivery fee"
- The invoice dialog has an editable per-litre delivery fee, shown only to
  users with edit permission (`canEdit && !viewOnly`).
- It is stored in `invoices.details.delivery_price_per_litre` (JSONB) because
  `invoices.delivery_price_per_litre` does not exist and there is no DDL access
  from the agent. This avoids a deploy-order hazard; no migration is required.
- Read order everywhere: invoice `details` override -> SO rate -> 0
  (`calculateInvoiceTotals`, the dialog seed, and the invoice PDF mapping).
- `invoiceCalc` takes the rate from `formData`, so changing it recalculates the
  subtotal, the PPN/delivery tax (when `delivery_taxable` is on) and the grand
  total live.
- The save path strips `delivery_price_per_litre` from the column payload and
  merges it into `details`, preserving other `details` keys.

## Two independent "inclusive" switches (final model)
`lib/invoice-calc.ts` now models both switches over ONE gross price:
- `taxInclusive` — the price contains the tax. The enabled taxes are backed out
  of the product amount (`net = gross / (1 + totalRate)`, `tax = gross − net`).
- `deliveryInclusive` — the price contains the delivery fee. The fee is carved
  OUT of the price (product = price − delivery) instead of being charged on
  top of it. Stored in `details.delivery_inclusive`.
- Combined: the delivery fee is carved out first, then the tax is backed out of
  what remains. When the fee is taxable and inside the price, its PPN is
  embedded as well. The discount/shrinkage apply to the product part.
- Example (price 23,850, delivery 150, PPN 11% + PBBKB 7.5%):
  both off -> product 23,850 + delivery 150; tax inclusive -> product 21,486;
  delivery inclusive -> product 23,700 + delivery 150; both on -> product
  20,000 + delivery 135 and total = 23,850 = the stated price.
- Verified numerically over 7 switch combinations; rows always add up to the
  grand total, and the PDF prints the net product/delivery rows so the printed
  table stays additive.

## PDF prints the deliveries only for DO-backed invoices
- The invoice PDF's "Delivery Order:" block is now gated on `do_ids` being
  non-empty (DO-backed). An SO-backed invoice is billed from the Sales Order
  and must not print the SO's deliveries.
- Needed because SO-mode saves now snapshot the SO's DOs into `do_refs` (for
  the dialog's delivery-progress panel), which the PDF was rendering.
- Verified on live data: 156/INV/ABS-RMKO (SO-backed, 3 refs), 162 (2 refs),
  124 and 127 (1 ref each) no longer print DOs; all 21 DO-backed invoices
  still print theirs.
- The dialog's delivery-progress panel and the email's optional DO PDF
  attachments are unaffected (the attachments already fell back to the SO's
  DOs before this change).

## PDF + dialog presentation (final)
- The invoice PDF follows the tax-invoice convention: a tax-inclusive invoice
  prints the NET price (the tax-exclusive price) and states the tax as its own
  row, so the column adds up to the total. There is **no "Pajak Termasuk"
  deduction row** — the user rejected it and asked for the layout in their
  invoice screenshot.
- The Qty column now uses the same 2-decimal Indonesian format as the
  Price/Litre column (e.g. 2.000,00 instead of 2,000).
- A delivery fee that is inside the price is listed with the product rows; a fee
  added on top keeps the existing rule (before the tax rows when
  delivery_taxable, after them otherwise).
- The dialog keeps the gross working view (gross base price + a single
  combined "Harga Termasuk Pajak" deduction line + tax rows). The separate
  "Tax Included in Delivery Fee" line was removed because it double-counted the
  delivery's embedded tax; the orphaned dictionary key
  LABEL_INVOICE_DELIVERY_TAX_INCLUDED was deleted.
- Verified: 12 switch/discount combinations, every printed row chain reconciles
  to the TOTAL, and invoice 161 reproduces the user's screenshot exactly
  (2.000,00 × 20.000,00 = 40.000.000,00; PBBKB 3.000.000,00; PPN 4.400.000,00;
  OAT 300.000,00; TOTAL 47.700.000,00).

## Invoice-scoped labels + merged delivery panel
- The invoice-only dictionary keys were renamed so no other module can pick up
  invoice wording by accident: `LABEL_TAX_INCLUDED` ->
  `LABEL_INVOICE_TAX_INCLUDED`, `LABEL_DELIVERY_FEE` ->
  `LABEL_INVOICE_DELIVERY_FEE`, `LABEL_DELIVERY_INCLUDED` ->
  `LABEL_INVOICE_DELIVERY_TAX_INCLUDED`, `LABEL_PRICE_INCLUDES_DELIVERY` ->
  `LABEL_INVOICE_PRICE_INCLUDES_DELIVERY`. The old keys were unused outside
  the invoice page, so nothing else changed. `LABEL_DELIVERY_TAXABLE` stays
  shared (quotations, sales order, deposit, invoice all mean the same by it).
- The delivery fee input, "Price Includes Delivery Fee" and "Include Delivery
  Fee in Tax" now live in ONE panel (single bordered container, rows separated
  by `border-t pt-2`) instead of three separate gray boxes. The "Tax Included"
  switch stays separate because it applies to the product price.
- Both delivery switches are disabled unless the delivery fee is usable
  (`hasValidDeliveryFee`: finite and > 0). `NumberInput` emits 0 when the field
  is cleared and can emit a negative value, both of which would make the
  switches meaningless no-ops. The labels are muted while disabled. The stored
  flag is intentionally NOT auto-reset, so clearing the field while typing
  does not discard the user's choice.

## Known limitation
Invoice-only, per decision 3: the linked SO/quotation still show tax-exclusive
pricing, so their totals can differ from a tax-inclusive invoice.
