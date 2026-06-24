# Unification of Status Colors and Theme Visibility

This plan addresses unifying transaction status badge colors across all pages (Quotations, Sales Orders, Delivery Orders, Deposits, Invoices, Payments) to use a premium, dark-theme compatible, and consistent visual system.

## Database Audit (Typo Check)
We verified the database constraints and records:
- The check constraint on `sales_orders.status` is correctly defined as `CHECK (status IN ('Draft', 'Sent', 'Approved', 'Rejected', 'Partial', 'Fulfilled', 'Accepted'))`.
- No database records contain the typo `Fullfilled` (0 records found).
- Therefore, no database migration is required. We will clean up the typo references entirely in the frontend code.

## Proposed Changes

We will refactor status display badges on remaining pages to map to a standardized `statusStyles` dictionary. We use a 10% transparent background, appropriate borders, and dark-theme optimized text classes.

### Color Mapping Philosophy
- **Zinc (gray)**: Draft -> `bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border border-zinc-500/20`
- **Amber (yellow)**: Sent, Pending -> `bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20`
- **Emerald (green)**: Approved, Accepted, Delivered, Paid, Verified, Fulfilled -> `bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20`
- **Rose (red)**: Rejected, Cancelled -> `bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20`
- **Blue (blue)**: Shipped, Processed -> `bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20`
- **Indigo (indigo)**: Partial -> `bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20`

---

### 1. Quotations

#### [MODIFY] [quotations/page.tsx](file:///A:/Projects/nids/nids-app/app/quotations/page.tsx)
- Verify `statusStyles` matches the unified mapping:
  - `Draft` -> Zinc
  - `Sent` -> Amber
  - `Accepted` -> Emerald
  - `Rejected` -> Rose
  - `Processed` -> Blue

---

### 2. Sales Orders

#### [MODIFY] [sales-order/page.tsx](file:///A:/Projects/nids/nids-app/app/sales-order/page.tsx)
- Update `statusStyles` to match the unified mapping:
  - `Draft` -> Zinc
  - `Sent` -> Amber (changed from Blue for consistency with Quotations/Invoices)
  - `Approved` -> Emerald
  - `Rejected` -> Rose
  - `Partial` -> Indigo
  - `Fulfilled` -> Emerald (changed from Teal for consistency with completed actions)
- Remove all code references, conditions, and mappings to the typo `'Fullfilled'`.

---

### 3. Delivery Orders

#### [MODIFY] [delivery-order/page.tsx](file:///A:/Projects/nids/nids-app/app/delivery-order/page.tsx)
- Define `statusStyles` mapping:
  - `Draft` -> Zinc
  - `Shipped` -> Blue
  - `Delivered` -> Emerald
  - `Cancelled` -> Rose
- Update table cell status badge classes to map to `statusStyles[o.status]`.
- Add `Draft` option back in the status update submenu list.

---

### 4. Deposits

#### [MODIFY] [deposit/page.tsx](file:///A:/Projects/nids/nids-app/app/deposit/page.tsx)
- Define `statusStyles` mapping:
  - `Pending` -> Amber
  - `Accepted` -> Emerald
  - `Rejected` -> Rose
- Update table cell status badge classes to map to `statusStyles[d.status]`.
- Add `Pending` option in the status update submenu list.

---

### 5. Invoices

#### [MODIFY] [invoice/page.tsx](file:///A:/Projects/nids/nids-app/app/invoice/page.tsx)
- Define `statusStyles` mapping:
  - `Draft` -> Zinc
  - `Sent` -> Amber
  - `Paid` -> Emerald
  - `Partial` -> Indigo
  - `Cancelled` -> Rose
- Update table cell status badge classes to map to `statusStyles[i.status]`.

---

### 6. Payments

#### [MODIFY] [payments/page.tsx](file:///A:/Projects/nids/nids-app/app/payments/page.tsx)
- Define `statusStyles` mapping:
  - `Pending` -> Amber
  - `Verified` -> Emerald
  - `Rejected` -> Rose
- Update table cell status badge classes to map to `statusStyles[p.status]`.

---

## Verification Plan

### Automated Tests
- Run TypeScript compilation checks to verify type safety:
  ```bash
  npx tsc --noEmit
  ```
