-- Master Data: Vehicles
CREATE TABLE IF NOT EXISTS public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_number TEXT UNIQUE NOT NULL,
  vehicle_type TEXT, -- e.g., 'Truck', 'Tanker'
  capacity NUMERIC(12,2), -- Total capacity if applicable
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vehicle Compartments (Master Data)
CREATE TABLE IF NOT EXISTS public.vehicle_compartments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE,
  compartment_number INT NOT NULL,
  capacity NUMERIC(12,2) NOT NULL,
  UNIQUE(vehicle_id, compartment_number),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Update Delivery Orders to link to vehicles and store driver info
ALTER TABLE public.delivery_orders ADD COLUMN IF NOT EXISTS vehicle_id UUID REFERENCES public.vehicles(id);
-- driver_name is already there, but we might want a master table for drivers too? 
-- The user didn't explicitly ask for a driver table, but it's common. 
-- For now I'll stick to what was asked: remember the car and its compartments.

-- Delivery Order Compartment Details (Specific to each delivery)
CREATE TABLE IF NOT EXISTS public.delivery_order_compartments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_order_id UUID REFERENCES public.delivery_orders(id) ON DELETE CASCADE,
  vehicle_compartment_id UUID REFERENCES public.vehicle_compartments(id),
  seal_number TEXT NOT NULL,
  quantity NUMERIC(12,2), -- Quantity in this compartment for this DO
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_compartments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_order_compartments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Enable all for authenticated users" ON public.vehicles FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable all for authenticated users" ON public.vehicle_compartments FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable all for authenticated users" ON public.delivery_order_compartments FOR ALL TO authenticated USING (true);

-- Audit Triggers
CREATE TRIGGER audit_vehicles_trigger AFTER INSERT OR UPDATE OR DELETE ON vehicles FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE TRIGGER audit_vehicle_compartments_trigger AFTER INSERT OR UPDATE OR DELETE ON vehicle_compartments FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE TRIGGER audit_delivery_order_compartments_trigger AFTER INSERT OR UPDATE OR DELETE ON delivery_order_compartments FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
