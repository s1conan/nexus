-- Add number_of_seals to vehicles
-- Seal count is defined per vehicle (not derived from compartments).
-- Delivery orders generate one seal row per vehicle seal.

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS number_of_seals INT;

-- Backfill existing vehicles: default to current compartment count
UPDATE public.vehicles
SET number_of_seals = GREATEST(
  CASE
    WHEN jsonb_typeof(compartments) = 'array' THEN jsonb_array_length(compartments)
    ELSE 0
  END,
  1
)
WHERE number_of_seals IS NULL;

-- Ensure a sane default for future rows
ALTER TABLE public.vehicles
  ALTER COLUMN number_of_seals SET DEFAULT 1;

ALTER TABLE public.vehicles
  ALTER COLUMN number_of_seals SET NOT NULL;

-- Idempotent constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vehicles_number_of_seals_positive'
  ) THEN
    ALTER TABLE public.vehicles
      ADD CONSTRAINT vehicles_number_of_seals_positive CHECK (number_of_seals >= 1);
  END IF;
END $$;
