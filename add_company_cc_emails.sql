-- Add cc_emails field to companies.details JSONB
-- This field stores a list of email addresses that will be CC'd on all company-related documents
-- (quotations, invoices, delivery orders, sales orders, etc.)
--
-- No schema change required — details is JSONB, so the field is added at the application level.
-- This script documents the new field and can be used to backfill if needed.

-- Optional: backfill existing companies with empty cc_emails array
UPDATE companies
SET details = jsonb_set(
  COALESCE(details, '{}'::jsonb),
  '{cc_emails}',
  '[]'::jsonb
)
WHERE details->>'cc_emails' IS NULL;

-- Optional: add a GIN index on details for faster JSONB queries (if not already present)
-- CREATE INDEX IF NOT EXISTS idx_companies_details_gin ON companies USING GIN (details);
