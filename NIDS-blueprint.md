NIDS: Operational Workflow Blueprint
1. Pre-Operational Setup (Configuration)
Before any transactions occur, the system must be initialized to ensure zero hardcoding and full traceability.

Dictionary Initialization: The system loads the dictionary table. All UI elements (labels, buttons, headers) fetch their values from this state.

Audit Hooking: Every UI interaction triggers a Supabase call that includes the auth.uid(). PostgreSQL triggers handle the heavy lifting of recording the "Before" and "After" state of every table row.

Master Data Entry: Admin populates companies (Suppliers, Customers, Transporters) and products (specific oil grades/SKUs).

2. The Sales Pipeline (Quotes to Orders)
This covers the "Customer asks for pricing" and "Agreement" phase.

Drafting the Quote: The Distributor (user) creates a quote.

Input: Selects a customer from companies, adds items from products.

Logic: The system suggests a base_price but allows for manual adjustment.

Quote Negotiation: If the customer asks for a change, the user edits the quote. The audit_logs track every price change made during negotiation.

Acceptance & Conversion: Once the customer agrees, the user clicks "Convert to Order".

Action: The system creates a record in orders (type: outbound) and moves all quote_items into order_items.

Status: Order moves to Pending Fulfillment.

3. Procurement (Stock Replenishment)
When the distributor needs to buy stock from a supplier.

Purchase Order (PO): User creates an order (type: inbound).

Supplier Assignment: Links the order to a specific supplier in the companies table.

Cost Tracking: The unit_price in order_items here represents the Inbound Cost, which is vital for the P&L report later.

4. Fulfillment & Logistics (The Batch System)
Oil is often delivered in multiple trucks/batches, not all at once.

Scheduling Shipments: From an active order, the user creates a shipment.

Transporter Assignment: User selects a transporter and inputs the freight_cost.

Batch Definition: User selects which items from the order are in this specific batch (shipment_items) and defines the qty_loaded.

Status Tracking: The shipment moves from Scheduled → In-Transit → Delivered.

Audit Note: The system logs who dispatched the truck and who confirmed the delivery.

5. The Financial Cycle (Invoicing & Installments)
Handling the money, partial billing, and split payments.

Invoice Generation: Users can generate an invoice for:

The Entire Order.

Or Specific Shipments (Billing only what was delivered).

Installment Management: When a payment arrives:

User creates a payment record linked to the invoice.

The system calculates amount_due - amount_paid.

If the balance hits zero, the invoice status updates to Paid.

Balance Sheet Impact: Every payment and invoice automatically updates the real-time P&L data.

6. Insights & AI Dashboard (Summary Layer)
The final layer for executive decision-making.

P&L Calculation: The system runs a view joining order_items (Revenue), procurement_costs (Expenses), and shipment.freight_cost (Overhead).

AI Insight Generation: A background worker (Supabase Edge Function) sends recent audit_logs and order_statuses to the LLM.

Output: "Customer X has 3 late shipments; suggest switching Transporter Y for the next batch to save 5% on freight."

The Summary View: A dedicated page showing total volume distributed vs. total profit collected.

Summary of Action Flow (for CLI)
Customer Request → quotes (Editable/Audited) → Agreement → orders → Batch Planning → shipments (Transporter assigned) → Delivery → invoices (Partial/Full) → Payment → payments (Installments) → Reporting → AI Dashboard.

Logic Check: How to handle "Changed minds"?
If a user edits a price after an order is completed, the Audit Log will flag this for the Admin. Because we use a details JSONB field on every table, if you need to add a "Reason for Discount" suddenly, the CLI can implement it without a database migration.



