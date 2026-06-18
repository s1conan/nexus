# NIDS: Database & Technical Architecture Flow

This document outlines the technical schema and data flow for the Nexus Integrated Distribution System (NIDS).

## 1. System Infrastructure
Core tables that provide the foundation for all other modules.

| Table | Purpose | Key Columns |
| :--- | :--- | :--- |
| `app_settings` | Global Configuration | `category` (tax, numbering, email), `key`, `value`, `is_active` |
| `dictionary` | UI Localization | `key_name` (Unique), `display_value` |
| `audit_logs` | Traceability | `table_name`, `record_id`, `action`, `old_data` (JSONB), `new_data` (JSONB), `changed_by` |

## 2. Master Data
Entities that serve as the building blocks for transactions.

| Table | Purpose | Key Columns |
| :--- | :--- | :--- |
| `companies` | Parties involved | `type` (Supplier/Customer/Transporter/Funder), `name`, `details` (JSONB) |
| `products` | Inventory Items | `sku`, `name`, `base_price`, `details` (JSONB) |
| `vehicles` | Logistics Assets | `license_number`, `vehicle_type`, `capacity` |
| `vehicle_compartments` | Tanker Sub-divisions | `vehicle_id`, `compartment_number`, `capacity` |
| `profiles` | User Management | `id` (references auth.users), `full_name`, `role` (Admin/Boss/Staff) |

## 3. Transaction Pipeline
The flow of data from Quote to Payment.

### A. Sales & Procurement
| Table | Purpose | Key Columns |
| :--- | :--- | :--- |
| `quotations` | Pricing Offers | `company_id`, `status`, `total_amount`, `tax_details` (JSONB), `price_snapshot` |
| `sales_orders` | Binding Contracts | `quote_id`, `company_id`, `type` (Inbound/Outbound), `status` |
| `sales_order_items` | Itemized Lines | `so_id`, `product_id`, `qty`, `unit_price` |

### B. Inventory & Logistics
| Table | Purpose | Key Columns |
| :--- | :--- | :--- |
| `inventory_ledger` | Stock Accounting | `transaction_type` (IN/OUT), `qty`, `unit_cost`, `is_active` |
| `deposits` | Stock Inbound | `company_id` (Supplier), `amount`, `status`, `details` (JSONB) |
| `delivery_orders` | Stock Outbound | `so_id`, `vehicle_id`, `driver_name`, `status` |
| `do_items` | Delivered Quantities | `do_id`, `so_item_id`, `qty_delivered` |
| `do_compartments` | Loading Details | `do_id`, `compartment_id`, `seal_number`, `quantity` |

### C. Finance
| Table | Purpose | Key Columns |
| :--- | :--- | :--- |
| `invoices` | Billing | `so_id`, `total_amount`, `paid_amount`, `status`, `tax_details` (JSONB) |
| `payments` | Settlement | `invoice_id`, `amount`, `status` (Pending/Verified), `payment_method` |
| `funders` | External Capital | `name`, `details` (JSONB) |

## 4. Technical Logic & Automation

### R1: Audit Trigger
All tables must have the `audit_trigger_func()` attached to capture row-level changes.
```sql
CREATE TRIGGER audit_table_trigger 
AFTER INSERT OR UPDATE OR DELETE ON <table_name> 
FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
```

### R2: Inventory Zero-Reset
When stock for a specific item hits zero, the ledger entries are optimized:
```sql
-- Trigger sets is_active = false for historical records when balance = 0
```

### R3: Payment Verification
Invoice balances are only updated when a payment status is set to `Verified`.

### R4: Tax Propagation Chain
`Quotations` (Defined) → `Sales Orders` (Inherited) → `Invoices` (Locked).

## 5. Development Roadmap (Updated)
1. **Core Infrastructure:** Supabase, Auth, RLS, Dictionary, Audit. (Done)
2. **Master Data:** Companies, Products, Vehicles, Compartments. (Done)
3. **The Pipeline:** Quotations to Sales Orders with Multi-Tax logic. (Done)
4. **Logistics:** Delivery Orders with Compartment/Seal tracking. (Done)
5. **Inventory:** Event-sourced Ledger with Zero-Reset triggers. (Done)
6. **Finance:** Invoices, Verified Payments, and Funder integration. (In-Progress/Verification)
7. **Reports:** Real-time P&L and comprehensive module reporting. (Active)
