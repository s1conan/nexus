# NIDS Inventory & Multi-Tax System Architecture

This document outlines the specialized architectural design for the inventory management and dynamic taxation workflow implemented in the Nexus Integrated Distribution System (NIDS).

## 1. Inventory Ledger System
To ensure long-term scalability (10+ years) and accounting flexibility (future FIFO/LIFO support), NIDS uses an **Event-Sourced Ledger** approach rather than simple balance tracking.

### Core Data Structure: `inventory_ledger`
Every stock movement is recorded as an immutable event.
- **`transaction_type`**: `IN` (Deposits) or `OUT` (Deliveries).
- **`quantity`**: Always a positive absolute value (enforced by `CHECK` constraint).
- **`unit_cost`**: The exact price at the time of the transaction.
- **`is_active`**: A boolean flag used for performance optimization and "empty tank" resets.

### The "Zero Reset" Logic (Price Baggage Removal)
When a warehouse for a specific item reaches a balance of zero:
1. A database trigger fires.
2. All previous ledger entries for that `item + warehouse` are set to `is_active = false`.
3. The next `IN` transaction starts a fresh calculation.
4. **Benefit:** This prevents old, historical prices from "polluting" the average cost of new stock once the old stock is physically gone.

### Strategic Speed: The "BALANCE" Transaction
To maintain high performance over decades:
- We can periodically insert a `BALANCE` record (e.g., once a year).
- All previous records are set to `is_active = false`.
- The system only sums the "Current Balance Row + New Transactions," keeping queries instant.

---

## 2. Dynamic Multi-Tax Workflow
The system replaces hardcoded tax rates with a flexible, parameter-driven engine managed via `app_settings`.

### The Tax Parameter Engine
- **Storage:** Taxes are defined in `app_settings` (category: `tax`) with names like `PPN`, `PBBKB`, `PPh 22`.
- **UI Interaction:**
  - When creating a new document (Deposit, Quotation, PO, Invoice), the system fetches all current active taxes.
  - **Individual Switches:** Users can toggle each tax ON or OFF per transaction.
  - **Read-Only Locked Rates:** Once a document is created, the tax rate percentage is locked to prevent historical data corruption if global rates change later.
- **Layout Standards:**
  - Tabular alignment: `[ Tax Name ] [ Switch ] [ % Rate ] [ Calculated IDR ]`.
  - Monospaced fonts for numerical alignment.
  - Stable layout: Toggling a switch does not resize the container (uses alpha-fade transitions).

### Propagation Chain
To ensure accuracy across the supply chain, tax settings "flow" through documents:
1. **Quotation:** Defines the initial tax profile.
2. **Purchase Order:** Inherits tax settings from the linked Quotation.
3. **Delivery Order:** (No tax/price - logistics only).
4. **Invoice:** Inherits tax settings from the original Purchase Order via the Delivery Order link.

---

## 3. Database Schema Requirements (SQL)

### Inventory & Status Update
```sql
ALTER TABLE public.inventory_ledger ADD COLUMN is_active BOOLEAN DEFAULT true;
-- View: supplier_stock_summary (Only calculates WHERE is_active = true)
```

### Multi-Tax Tables
```sql
ALTER TABLE public.deposits ADD COLUMN tax_details JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.quotations ADD COLUMN tax_details JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.purchase_orders ADD COLUMN tax_details JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.invoices ADD COLUMN tax_details JSONB DEFAULT '[]'::jsonb;
```

## 4. Implementation Roadmap
- [x] Phase 1: Implement Ledger + Zero-Reset Trigger.
- [x] Phase 2: Implement Dynamic Multi-Tax UI in **Deposits** (Reference Implementation).
- [x] Phase 3: Verify workflow stability with user.
- [x] Phase 4: Propagate Multi-Tax UI to Quotations.
- [x] Phase 5: Propagate Multi-Tax UI to Purchase Orders.
- [x] Phase 6: Propagate Multi-Tax UI to Invoices.
