# NIDS: Operational Workflow Blueprint

## 1. Foundation & System Core
The system is built for zero hardcoding and full traceability, controlled via centralized parameters.

*   **App Settings (Global Config):** All dynamic parameters—Tax rates (PPN, PBBKB, PPh 22), Document Numbering prefixes, and Email CC settings—are managed in `app_settings`.
*   **Document Numbering:** Automated, year-based numbering system for Quotations, Sales Orders, Delivery Orders, Invoices, and Payments.
*   **Dictionary & UI:** All labels, buttons, and headers are fetched from the `dictionary` table to allow instant multi-language or terminology updates.
*   **Audit Engine:** PostgreSQL triggers capture every row change (Before/After) linked to `auth.uid()`, providing a tamper-proof history of all operations.

## 2. Master Data Management
Initialization of the entities that drive the transactions.

*   **Companies:** categorized as Customers, Suppliers, Transporters, or Funders.
*   **Products:** Specific fuel grades or SKUs with suggested base pricing.
*   **Vehicles & Logistics:** Master list of trucks and tankers, including **Compartment Mapping** (defining capacity per compartment) for precise loading.
*   **Profiles & RBAC:** Role-based access control (Admin, Boss, Staff) with specific RLS policies protecting sensitive financial data.

## 3. The Sales Pipeline (Quotes to Orders)
The workflow from initial inquiry to binding agreement.

*   **Quotations (Advanced):**
    *   **Logic:** Suggests `base_price` while allowing manual overrides.
    *   **Price Snapshot:** Captures the price at the moment of quoting to prevent "hidden" changes during negotiation.
    *   **Multi-Tax Engine:** Users toggle specific taxes (PPN, PBBKB, etc.) per quote. Rates are locked once saved.
    *   **Processed Tracking:** Status flow from Draft → Sent → Processed (Converted to Order).
*   **Sales Orders (SO):**
    *   **Outbound:** Customer orders stock from the Distributor.
    *   **Inbound:** Distributor orders stock from a Supplier (formerly PO).
    *   **Inheritance:** Automatically inherits Tax Details and Pricing from the linked Quotation.

## 4. Logistics & Inventory (The Ledger System)
Handling physical movement and stock accounting.

*   **Inventory Ledger (Event-Sourced):**
    *   Every movement is an immutable `IN` or `OUT` event.
    *   **Zero-Reset Logic:** When stock hits 0, historical "price baggage" is cleared (`is_active = false`), ensuring new stock starts with fresh average cost calculations.
*   **Deposits (Inbound):** Recording fuel received into the system, linked to Suppliers.
*   **Delivery Orders (Outbound):**
    *   **Vehicle Integration:** Links to specific Trucks and Drivers.
    *   **Compartment Seals:** Recording specific seal numbers and quantities for each vehicle compartment to prevent tampering and ensure accuracy.

## 5. The Financial Cycle (Revenue & Expenses)
Managing the money, partial billing, and funding.

*   **Funders:** Managing external funding sources for large transactions.
*   **Invoices:**
    *   Generated against Sales Orders or specific Delivery Orders.
    *   Inherits tax configuration through the propagation chain.
*   **Payments & Verification:**
    *   Support for partial payments and installments.
    *   **Verification Workflow:** Payments move from Pending → Verified. Only Verified payments update the Invoice balance and status.
*   **Real-time P&L:** Direct calculation of Revenue (Sales) vs. COGS (Procurement + Freight + Overhead).

## 6. Automation & Distribution
Reducing manual work and increasing transparency.

*   **Email Automation:** Automatic distribution of Quotations and Invoices to clients with configurable CC recipients.
*   **Document Verification (QR):** Every official document includes a QR code linking to `api/verify-document`, allowing third parties to verify the authenticity of a printed NIDS document.

## 7. Reporting & Analytics
The summary layer for executive decision-making.

*   **Comprehensive Reports:** Dedicated modules for Delivery, Deposit, Inventory, Invoice, Payments, P&L, Quotation, and Sales Orders.
*   **Data Structure:** Utilization of the `details` JSONB field on all primary tables allows for future field expansion without breaking the core schema.
