NIDS MVP: Development Blueprint		
		
Nexus Integrated Distribution System		
		
This plan is optimized for AI consumption and direct implementation.		
		
		
		
1. Core Technical Stack		
		
Framework: Next.js (App Router) + TypeScript		
		
Database/Auth: Supabase (PostgreSQL)		
		
Styling: Tailwind CSS + Shadcn/ui		
		
State/Labels: React Context for Dynamic Dictionary		
		
		
		
2. Database Schema (PostgreSQL)		
		
A. Infrastructure & Audit		
		
Table	Purpose	Key Columns
dictionary	Soft-coded UI	key_name (Unique), display_value
audit_logs	Traceability	table_name, record_id, action, old_data (JSONB), new_data (JSONB), changed_by
B. Master Data		
		
Table	Purpose	Key Columns
companies	Entities	type (Supplier/Customer/Transporter), name, details (JSONB)
products	Inventory	sku, name, base_cost, base_price, details (JSONB)
C. The Transaction Pipeline		
		
Table	Purpose	Key Columns
quotes	Pricing Offers	company_id, status, total_value, details (JSONB)
orders	Binding Contracts	quote_id, company_id, type (Inbound/Outbound), status, details (JSONB)
order_items	Itemized Lines	order_id, product_id, qty, unit_price
shipments	Logistics (Batches)	order_id, transporter_id, freight_cost, status, details (JSONB)
shipment_items	Loaded Quantity	shipment_id, order_item_id, qty_loaded
invoices	Billing	order_id, amount_due, status, details (JSONB)
payments	Installments	invoice_id, amount_paid, payment_date, recorded_by
		
		
3. The Functional Workflow		
		
1. Quoting: Distributor creates an offer in quotes.		
		
2. Conversion: Upon acceptance, quotes data migrates to orders.		
		
3. Fulfillment: Create one or more shipments against an order. Each shipment records a specific batch and transporter.		
		
4. Invoicing: Generate invoices based on total order or delivered batches.		
		
5. Settlement: Record multiple payments against a single invoice until amount_due is zero.		
		
		
		
4. Implementation Rules for CLI		
		
R1: The Dictionary Rule (No Hardcoding)		
		
All UI labels must be fetched from the dictionary table.		
		
Fetch: SELECT * FROM dictionary on App init.		
		
Usage: <span>{dict['LABEL_PO']}</span>		
		
R2: The Audit Trigger (Automated History)		
		
Use a PostgreSQL Function to populate audit_logs.		
		
SQL		
-- Logic for CLI Implementation		
CREATE OR REPLACE FUNCTION audit_trigger_func() RETURNS trigger AS $$		
BEGIN		
  INSERT INTO audit_logs (table_name, record_id, action, old_data, new_data, changed_by)		
  VALUES (TG_TABLE_NAME, OLD.id, TG_OP, to_jsonb(OLD), to_jsonb(NEW), auth.uid());		
  RETURN NEW;		
END;		
$$ LANGUAGE plpgsql;		
		
R3: JSONB Extensibility		
		
Every table includes a details JSONB column. Use this for specific phone numbers, driver licenses, or extra notes to avoid schema bloat.		
		
		
		
5. MVP Milestone Roadmap		
		
1. Milestone 1: Setup Supabase Auth + companies & products CRUD.		
		
2. Milestone 2: Implement quotes to orders conversion logic.		
		
3. Milestone 3: Build the Batching system (shipments and shipment_items).		
		
4. Milestone 4: Finance module for invoices and partial payments.		
		
5. Milestone 5: Global Audit Log Viewer and Dictionary Management page.		
