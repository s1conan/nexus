-- Refined Vehicles Schema
-- Using JSONB for compartments for flexibility, as requested.
-- Note: While normalized tables (separate table) are better for complex relational queries, 
-- JSONB allows for faster document-style updates if that is preferred.

CREATE TABLE IF NOT EXISTS public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_number TEXT UNIQUE NOT NULL,
  vehicle_type TEXT, 
  capacity NUMERIC(12,2),
  compartments JSONB DEFAULT '[]'::jsonb, -- Using JSONB for indexing support
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Populating table with sample data
INSERT INTO public.vehicles (license_number, vehicle_type, capacity, compartments)
VALUES 
(
  'B 1234 XYZ', 
  'Tanker', 
  16000, 
  '[{"number": 1, "capacity": 8000}, {"number": 2, "capacity": 8000}]'::jsonb
),
(
  'BG 5678 KLM', 
  'Truck', 
  10000, 
  '[{"number": 1, "capacity": 10000}]'::jsonb
),
(
  'T 9999 ABC', 
  'Tanker', 
  24000, 
  '[{"number": 1, "capacity": 8000}, {"number": 2, "capacity": 8000}, {"number": 3, "capacity": 8000}]'::jsonb
)
ON CONFLICT (license_number) DO NOTHING;

-- Enable RLS
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

-- Add basic policy
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.vehicles;
CREATE POLICY "Enable all for authenticated users" ON public.vehicles FOR ALL TO authenticated USING (true);
