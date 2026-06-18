-- Migration: Add 'Processed' status to quotations
-- This allows quotations to be marked as processed when converted to a Sales Order (Sales Order)

ALTER TABLE public.quotations DROP CONSTRAINT IF EXISTS quotations_status_check;
ALTER TABLE public.quotations ADD CONSTRAINT quotations_status_check CHECK (status IN ('Draft', 'Sent', 'Accepted', 'Rejected', 'Processed'));
