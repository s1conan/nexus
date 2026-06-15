-- 1. Create Purchase Orders Table
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number TEXT UNIQUE NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  po_date DATE NOT NULL DEFAULT CURRENT_DATE,
  delivery_date DATE NOT NULL,
  quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
  unit_price NUMERIC(15,2) NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'Draft' CHECK (status IN ('Draft', 'Sent', 'Approved', 'Rejected')),
  note TEXT,
  is_note_enabled BOOLEAN DEFAULT TRUE,
  terms_conditions TEXT,
  is_terms_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for authenticated users" ON public.purchase_orders FOR ALL TO authenticated USING (true);
DROP TRIGGER IF EXISTS audit_purchase_orders_trigger ON public.purchase_orders;
CREATE TRIGGER audit_purchase_orders_trigger AFTER INSERT OR UPDATE OR DELETE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- 2. Create Delivery Orders Table
CREATE TABLE IF NOT EXISTS public.delivery_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  do_number TEXT UNIQUE NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  do_date DATE NOT NULL DEFAULT CURRENT_DATE,
  shipment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
  driver_name TEXT,
  vehicle_number TEXT,
  status TEXT DEFAULT 'Draft' CHECK (status IN ('Draft', 'Shipped', 'Delivered', 'Cancelled')),
  note TEXT,
  is_note_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);
ALTER TABLE public.delivery_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for authenticated users" ON public.delivery_orders FOR ALL TO authenticated USING (true);
DROP TRIGGER IF EXISTS audit_delivery_orders_trigger ON public.delivery_orders;
CREATE TRIGGER audit_delivery_orders_trigger AFTER INSERT OR UPDATE OR DELETE ON public.delivery_orders FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- 3. Vehicle & Compartment Extension
CREATE TABLE IF NOT EXISTS public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_number TEXT UNIQUE NOT NULL,
  vehicle_type TEXT,
  capacity NUMERIC(12,2),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.vehicle_compartments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE,
  compartment_number INT NOT NULL,
  capacity NUMERIC(12,2) NOT NULL,
  UNIQUE(vehicle_id, compartment_number),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.delivery_orders ADD COLUMN IF NOT EXISTS vehicle_id UUID REFERENCES public.vehicles(id);
CREATE TABLE IF NOT EXISTS public.delivery_order_compartments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_order_id UUID REFERENCES public.delivery_orders(id) ON DELETE CASCADE,
  vehicle_compartment_id UUID REFERENCES public.vehicle_compartments(id),
  seal_number TEXT NOT NULL,
  quantity NUMERIC(12,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_compartments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_order_compartments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for authenticated users" ON public.vehicles FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable all for authenticated users" ON public.vehicle_compartments FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable all for authenticated users" ON public.delivery_order_compartments FOR ALL TO authenticated USING (true);
DROP TRIGGER IF EXISTS audit_vehicles_trigger ON vehicles;
CREATE TRIGGER audit_vehicles_trigger AFTER INSERT OR UPDATE OR DELETE ON vehicles FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- 4. Inventory Management & HPP Calculation Setup
ALTER TABLE public.delivery_orders ADD COLUMN IF NOT EXISTS po_id UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL;
ALTER TABLE public.delivery_orders ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.inventory_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('IN', 'OUT')),
  quantity NUMERIC(12,2) NOT NULL,
  unit_cost NUMERIC(15,2) DEFAULT 0,
  reference_type TEXT NOT NULL,
  reference_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);
ALTER TABLE public.inventory_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for authenticated users" ON public.inventory_ledger FOR ALL TO authenticated USING (true);
DROP TRIGGER IF EXISTS audit_inventory_ledger_trigger ON public.inventory_ledger;
CREATE TRIGGER audit_inventory_ledger_trigger AFTER INSERT OR UPDATE OR DELETE ON public.inventory_ledger FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE OR REPLACE VIEW public.supplier_stock_summary AS
WITH stock_data AS (
  SELECT 
    supplier_id,
    product_id,
    SUM(CASE WHEN transaction_type = 'IN' THEN quantity ELSE -quantity END) as current_stock,
    SUM(CASE WHEN transaction_type = 'IN' THEN quantity * unit_cost ELSE 0 END) as total_in_value,
    SUM(CASE WHEN transaction_type = 'IN' THEN quantity ELSE 0 END) as total_in_qty
  FROM public.inventory_ledger
  GROUP BY supplier_id, product_id
)
SELECT 
  s.supplier_id,
  s.product_id,
  s.current_stock,
  CASE 
    WHEN s.total_in_qty > 0 THEN s.total_in_value / s.total_in_qty 
    ELSE 0 
  END as weighted_average_cost,
  (s.current_stock * (CASE WHEN s.total_in_qty > 0 THEN s.total_in_value / s.total_in_qty ELSE 0 END)) as total_inventory_value
FROM stock_data s;

-- Automation Logic
ALTER TABLE public.deposits ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id);
ALTER TABLE public.deposits ADD COLUMN IF NOT EXISTS unit_price NUMERIC(15,2);

CREATE OR REPLACE FUNCTION public.handle_deposit_inventory_v2() 
RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'Accepted' AND (OLD.status IS NULL OR OLD.status != 'Accepted') THEN
    IF NEW.product_id IS NOT NULL AND NEW.unit_price > 0 THEN
      INSERT INTO public.inventory_ledger (supplier_id, product_id, transaction_type, quantity, unit_cost, reference_type, reference_id, created_by)
      VALUES (NEW.company_id, NEW.product_id, 'IN', (NEW.amount / NEW.unit_price), NEW.unit_price, 'Deposit', NEW.id, NEW.created_by);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_deposit_inventory ON public.deposits;
CREATE TRIGGER trigger_deposit_inventory AFTER UPDATE ON public.deposits FOR EACH ROW EXECUTE FUNCTION handle_deposit_inventory_v2();

CREATE OR REPLACE FUNCTION public.handle_do_inventory() 
RETURNS trigger AS $$
DECLARE
  v_hpp NUMERIC;
BEGIN
  IF NEW.status = 'Shipped' AND (OLD.status IS NULL OR OLD.status != 'Shipped') THEN
    SELECT weighted_average_cost INTO v_hpp
    FROM public.supplier_stock_summary
    WHERE supplier_id = NEW.supplier_id AND product_id = NEW.product_id;

    INSERT INTO public.inventory_ledger (supplier_id, product_id, transaction_type, quantity, unit_cost, reference_type, reference_id, created_by)
    VALUES (NEW.supplier_id, NEW.product_id, 'OUT', NEW.quantity, COALESCE(v_hpp, 0), 'Delivery Order', NEW.id, NEW.created_by);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_do_inventory ON public.delivery_orders;
CREATE TRIGGER trigger_do_inventory AFTER UPDATE ON public.delivery_orders FOR EACH ROW EXECUTE FUNCTION handle_do_inventory();

-- 5. Final Permission Setup
UPDATE public.role_permissions
SET permissions = '{
  "companies": {"view": true, "insert": true, "edit": true, "delete": true, "print": true},
  "products": {"view": true, "insert": true, "edit": true, "delete": true, "print": true},
  "vehicles": {"view": true, "insert": true, "edit": true, "delete": true, "print": true},
  "funders": {"view": true, "insert": true, "edit": true, "delete": true, "print": true},
  "quotation": {"view": true, "insert": true, "edit": true, "delete": true, "print": true},
  "purchase-order": {"view": true, "insert": true, "edit": true, "delete": true, "print": true},
  "delivery-order": {"view": true, "insert": true, "edit": true, "delete": true, "print": true},
  "deposit": {"view": true, "insert": true, "edit": true, "delete": true, "print": true},
  "invoice": {"view": true, "insert": true, "edit": true, "delete": true, "print": true},
  "payments": {"view": true, "insert": true, "edit": true, "delete": true, "print": true},
  "shipments": {"view": true, "insert": true, "edit": true, "delete": true, "print": true},
  "users": {"view": true, "insert": true, "edit": true, "delete": true, "print": true},
  "settings": {"view": true, "insert": true, "edit": true, "delete": true, "print": true},
  "inventory": {"view": true, "insert": true, "edit": true, "delete": true, "print": true},
  "component-test": {"view": true, "insert": true, "edit": true, "delete": true, "print": true}
}'::jsonb
WHERE role IN ('admin', 'boss');

UPDATE public.profiles
SET permissions = NULL
WHERE role IN ('admin', 'boss');
- -   F i n a n c e   M o d u l e :   I n v o i c e s   &   P a y m e n t s   S c h e m a  
  
 - -   D r o p   e x i s t i n g   o l d   t a b l e s   i f   t h e y   e x i s t   ( t h e y   r e f e r e n c e d   t h e   o l d   ' o r d e r s '   t a b l e )  
 D R O P   T A B L E   I F   E X I S T S   p u b l i c . p a y m e n t s   C A S C A D E ;  
 D R O P   T A B L E   I F   E X I S T S   p u b l i c . i n v o i c e s   C A S C A D E ;  
  
 - -   1 .   C r e a t e   I n v o i c e s   T a b l e  
 C R E A T E   T A B L E   I F   N O T   E X I S T S   p u b l i c . i n v o i c e s   (  
     i d   U U I D   P R I M A R Y   K E Y   D E F A U L T   g e n _ r a n d o m _ u u i d ( ) ,  
     i n v o i c e _ n u m b e r   T E X T   U N I Q U E   N O T   N U L L ,  
     c o m p a n y _ i d   U U I D   R E F E R E N C E S   p u b l i c . c o m p a n i e s ( i d )   O N   D E L E T E   C A S C A D E ,  
     p o _ i d   U U I D   R E F E R E N C E S   p u b l i c . p u r c h a s e _ o r d e r s ( i d )   O N   D E L E T E   S E T   N U L L ,   - -   O p t i o n a l   l i n k   t o   P O  
     i s s u e _ d a t e   D A T E   N O T   N U L L   D E F A U L T   C U R R E N T _ D A T E ,  
     d u e _ d a t e   D A T E   N O T   N U L L ,  
     s u b t o t a l   N U M E R I C ( 1 5 , 2 )   N O T   N U L L   D E F A U L T   0 ,  
     t a x _ r a t e   N U M E R I C ( 5 , 2 )   N O T   N U L L   D E F A U L T   1 1 ,   - -   S t a n d a r d   P P N  
     t a x _ a m o u n t   N U M E R I C ( 1 5 , 2 )   N O T   N U L L   D E F A U L T   0 ,  
     t o t a l _ a m o u n t   N U M E R I C ( 1 5 , 2 )   N O T   N U L L   D E F A U L T   0 ,  
     p a i d _ a m o u n t   N U M E R I C ( 1 5 , 2 )   N O T   N U L L   D E F A U L T   0 ,  
     s t a t u s   T E X T   D E F A U L T   ' D r a f t '   C H E C K   ( s t a t u s   I N   ( ' D r a f t ' ,   ' S e n t ' ,   ' P a r t i a l ' ,   ' P a i d ' ,   ' C a n c e l l e d ' ) ) ,  
     n o t e   T E X T ,  
     i s _ n o t e _ e n a b l e d   B O O L E A N   D E F A U L T   T R U E ,  
     c r e a t e d _ a t   T I M E S T A M P T Z   D E F A U L T   N O W ( ) ,  
     u p d a t e d _ a t   T I M E S T A M P T Z   D E F A U L T   N O W ( ) ,  
     c r e a t e d _ b y   U U I D   R E F E R E N C E S   a u t h . u s e r s ( i d )  
 ) ;  
  
 A L T E R   T A B L E   p u b l i c . i n v o i c e s   E N A B L E   R O W   L E V E L   S E C U R I T Y ;  
 C R E A T E   P O L I C Y   " E n a b l e   a l l   f o r   a u t h e n t i c a t e d   u s e r s "   O N   p u b l i c . i n v o i c e s   F O R   A L L   T O   a u t h e n t i c a t e d   U S I N G   ( t r u e ) ;  
 C R E A T E   T R I G G E R   a u d i t _ i n v o i c e s _ t r i g g e r   A F T E R   I N S E R T   O R   U P D A T E   O R   D E L E T E   O N   p u b l i c . i n v o i c e s   F O R   E A C H   R O W   E X E C U T E   F U N C T I O N   a u d i t _ t r i g g e r _ f u n c ( ) ;  
  
 - -   2 .   C r e a t e   P a y m e n t s   T a b l e  
 C R E A T E   T A B L E   I F   N O T   E X I S T S   p u b l i c . p a y m e n t s   (  
     i d   U U I D   P R I M A R Y   K E Y   D E F A U L T   g e n _ r a n d o m _ u u i d ( ) ,  
     p a y m e n t _ n u m b e r   T E X T   U N I Q U E   N O T   N U L L ,  
     i n v o i c e _ i d   U U I D   R E F E R E N C E S   p u b l i c . i n v o i c e s ( i d )   O N   D E L E T E   C A S C A D E ,  
     p a y m e n t _ d a t e   D A T E   N O T   N U L L   D E F A U L T   C U R R E N T _ D A T E ,  
     a m o u n t   N U M E R I C ( 1 5 , 2 )   N O T   N U L L ,  
     p a y m e n t _ m e t h o d   T E X T   N O T   N U L L ,   - -   e . g . ,   ' B a n k   T r a n s f e r ' ,   ' C a s h '  
     r e f e r e n c e _ n u m b e r   T E X T ,   - -   e . g . ,   T r a n s f e r   R e c e i p t   N u m b e r  
     s t a t u s   T E X T   D E F A U L T   ' P e n d i n g '   C H E C K   ( s t a t u s   I N   ( ' P e n d i n g ' ,   ' V e r i f i e d ' ,   ' R e j e c t e d ' ) ) ,  
     n o t e   T E X T ,  
     c r e a t e d _ a t   T I M E S T A M P T Z   D E F A U L T   N O W ( ) ,  
     u p d a t e d _ a t   T I M E S T A M P T Z   D E F A U L T   N O W ( ) ,  
     r e c o r d e d _ b y   U U I D   R E F E R E N C E S   a u t h . u s e r s ( i d )  
 ) ;  
  
 A L T E R   T A B L E   p u b l i c . p a y m e n t s   E N A B L E   R O W   L E V E L   S E C U R I T Y ;  
 C R E A T E   P O L I C Y   " E n a b l e   a l l   f o r   a u t h e n t i c a t e d   u s e r s "   O N   p u b l i c . p a y m e n t s   F O R   A L L   T O   a u t h e n t i c a t e d   U S I N G   ( t r u e ) ;  
 C R E A T E   T R I G G E R   a u d i t _ p a y m e n t s _ t r i g g e r   A F T E R   I N S E R T   O R   U P D A T E   O R   D E L E T E   O N   p u b l i c . p a y m e n t s   F O R   E A C H   R O W   E X E C U T E   F U N C T I O N   a u d i t _ t r i g g e r _ f u n c ( ) ;  
  
 - -   3 .   A u t o m a t i o n :   U p d a t e   I n v o i c e   P a i d   A m o u n t   a n d   S t a t u s   u p o n   P a y m e n t   V e r i f i c a t i o n  
 C R E A T E   O R   R E P L A C E   F U N C T I O N   p u b l i c . h a n d l e _ p a y m e n t _ v e r i f i c a t i o n ( )    
 R E T U R N S   t r i g g e r   A S   $ $  
 D E C L A R E  
     v _ t o t a l _ p a i d   N U M E R I C ;  
     v _ i n v o i c e _ t o t a l   N U M E R I C ;  
 B E G I N  
     - -   W e   o n l y   u p d a t e   i n v o i c e   t o t a l s   w h e n   a   p a y m e n t   b e c o m e s   ' V e r i f i e d '   o r   i s   d e l e t e d / r e j e c t e d   a f t e r   b e i n g   ' V e r i f i e d '  
     I F   ( T G _ O P   =   ' I N S E R T '   A N D   N E W . s t a t u s   =   ' V e r i f i e d ' )   O R    
           ( T G _ O P   =   ' U P D A T E '   A N D   N E W . s t a t u s   =   ' V e r i f i e d '   A N D   O L D . s t a t u s   ! =   ' V e r i f i e d ' )   O R  
           ( T G _ O P   =   ' U P D A T E '   A N D   O L D . s t a t u s   =   ' V e r i f i e d '   A N D   N E W . s t a t u s   ! =   ' V e r i f i e d ' )   O R  
           ( T G _ O P   =   ' D E L E T E '   A N D   O L D . s t a t u s   =   ' V e r i f i e d ' )   T H E N  
            
         - -   C a l c u l a t e   t o t a l   v e r i f i e d   p a y m e n t s   f o r   t h e   i n v o i c e  
         S E L E C T   C O A L E S C E ( S U M ( a m o u n t ) ,   0 )   I N T O   v _ t o t a l _ p a i d  
         F R O M   p u b l i c . p a y m e n t s  
         W H E R E   i n v o i c e _ i d   =   C O A L E S C E ( N E W . i n v o i c e _ i d ,   O L D . i n v o i c e _ i d )   A N D   s t a t u s   =   ' V e r i f i e d ' ;  
  
         - -   G e t   t h e   t o t a l   a m o u n t   o f   t h e   i n v o i c e  
         S E L E C T   t o t a l _ a m o u n t   I N T O   v _ i n v o i c e _ t o t a l  
         F R O M   p u b l i c . i n v o i c e s  
         W H E R E   i d   =   C O A L E S C E ( N E W . i n v o i c e _ i d ,   O L D . i n v o i c e _ i d ) ;  
  
         - -   U p d a t e   t h e   i n v o i c e  
         U P D A T E   p u b l i c . i n v o i c e s  
         S E T    
             p a i d _ a m o u n t   =   v _ t o t a l _ p a i d ,  
             s t a t u s   =   C A S E    
                                   W H E N   v _ t o t a l _ p a i d   > =   v _ i n v o i c e _ t o t a l   T H E N   ' P a i d '  
                                   W H E N   v _ t o t a l _ p a i d   >   0   T H E N   ' P a r t i a l '  
                                   E L S E   ' S e n t '   - -   A s s u m i n g   i f   i t   h a d   p a y m e n t s   i t   w a s   a t   l e a s t   s e n t  
                               E N D  
         W H E R E   i d   =   C O A L E S C E ( N E W . i n v o i c e _ i d ,   O L D . i n v o i c e _ i d )   A N D   s t a t u s   ! =   ' C a n c e l l e d ' ;  
     E N D   I F ;  
  
     R E T U R N   C O A L E S C E ( N E W ,   O L D ) ;  
 E N D ;  
 $ $   L A N G U A G E   p l p g s q l ;  
  
 - -   T r i g g e r   o n   p a y m e n t s   t a b l e  
 D R O P   T R I G G E R   I F   E X I S T S   t r i g g e r _ p a y m e n t _ v e r i f i c a t i o n   O N   p u b l i c . p a y m e n t s ;  
 C R E A T E   T R I G G E R   t r i g g e r _ p a y m e n t _ v e r i f i c a t i o n    
 A F T E R   I N S E R T   O R   U P D A T E   O R   D E L E T E   O N   p u b l i c . p a y m e n t s    
 F O R   E A C H   R O W   E X E C U T E   F U N C T I O N   h a n d l e _ p a y m e n t _ v e r i f i c a t i o n ( ) ;  
 