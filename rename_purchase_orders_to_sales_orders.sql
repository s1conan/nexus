-- Rename table
ALTER TABLE public.purchase_orders RENAME TO sales_orders;

-- Rename primary columns
ALTER TABLE public.sales_orders RENAME COLUMN po_number TO so_number;
ALTER TABLE public.sales_orders RENAME COLUMN po_date TO so_date;

-- Rename constraint if it exists (usually unique constraint on po_number)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_orders_po_number_key') THEN
        ALTER TABLE public.sales_orders RENAME CONSTRAINT purchase_orders_po_number_key TO sales_orders_so_number_key;
    END IF;
END $$;

-- Update invoices table reference
ALTER TABLE public.invoices RENAME COLUMN po_id TO so_id;
-- Note: Foreign key constraint name might still have 'po_id' in it, but standard supabase doesn't strictly require renaming the constraint for it to work.
-- However, for cleanliness:
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_po_id_fkey') THEN
        ALTER TABLE public.invoices RENAME CONSTRAINT invoices_po_id_fkey TO invoices_so_id_fkey;
    END IF;
END $$;

-- Update delivery_orders table reference
ALTER TABLE public.delivery_orders RENAME COLUMN po_id TO so_id;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'delivery_orders_po_id_fkey') THEN
        ALTER TABLE public.delivery_orders RENAME CONSTRAINT delivery_orders_po_id_fkey TO delivery_orders_so_id_fkey;
    END IF;
END $$;
