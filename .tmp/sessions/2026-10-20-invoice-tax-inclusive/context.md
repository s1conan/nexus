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

## Deployment note
Run `nids-app/add_tax_inclusive.sql` in Supabase BEFORE deploying this code.
The save payload now includes `tax_inclusive`; without the column every invoice
insert/update fails with a missing-column error.

## Known limitation
Invoice-only, per decision 3: the linked SO/quotation still show tax-exclusive
pricing, so their totals can differ from a tax-inclusive invoice.
