-- Setup Script for Customizable Document Numbering System
-- This script creates the sequence tracker and the atomic generator function.

-- 1. Create Document Sequences Table
-- This table tracks the current sequence number for each document type/period.
CREATE TABLE IF NOT EXISTS public.document_sequences (
    name TEXT PRIMARY KEY, -- Unique key, e.g., 'quotation_2026' or 'invoice_2026_06'
    last_value BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Seed Default Numbering Formats
-- These templates can be modified by the user in the Settings UI.
-- Note: value is JSONB, so strings must be quoted as JSON strings.
INSERT INTO public.app_settings (category, name, value, description)
VALUES 
('numbering', 'quotation', '"QTN/{YYYY}/{SEQ:3}"', 'Format for Quotation numbers'),
('numbering', 'purchase-order', '"PO/{YYYY}/{SEQ:3}"', 'Format for Sales Order numbers'),
('numbering', 'delivery-order', '"DO/{YYYY}/{SEQ:3}"', 'Format for Delivery Order numbers'),
('numbering', 'deposit', '"DEP/{YYYY}/{SEQ:3}"', 'Format for Deposit numbers'),
('numbering', 'invoice', '"INV/{YYYY}/{SEQ:3}"', 'Format for Invoice numbers'),
('numbering', 'payment', '"PAY/{YYYY}/{SEQ:3}"', 'Format for Payment numbers')
ON CONFLICT (category, name) 
DO UPDATE SET 
    value = EXCLUDED.value,
    description = EXCLUDED.description;

-- 3. Sequence Generator Function (Atomic & Concurrency-Safe)
-- Usage: SELECT public.generate_document_number('quotation');
CREATE OR REPLACE FUNCTION public.generate_document_number(p_doc_type TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_template TEXT;
    v_year TEXT := to_char(CURRENT_DATE, 'YYYY');
    v_year_short TEXT := to_char(CURRENT_DATE, 'YY');
    v_month TEXT := to_char(CURRENT_DATE, 'MM');
    v_month_name TEXT := UPPER(to_char(CURRENT_DATE, 'MON'));
    v_day TEXT := to_char(CURRENT_DATE, 'DD');
    v_seq_key TEXT;
    v_current_seq BIGINT;
    v_result TEXT;
    v_seq_placeholder TEXT;
    v_padding INT;
BEGIN
    -- A. Retrieve Template from app_settings
    -- Use ->> operator to get the text value from the JSONB column
    SELECT value->>0 INTO v_template 
    FROM public.app_settings 
    WHERE category = 'numbering' AND name = p_doc_type;

    -- If the above fails (e.g. if it's not an array-style json but a raw string json), try direct text cast
    IF v_template IS NULL THEN
        SELECT value#>>'{}' INTO v_template 
        FROM public.app_settings 
        WHERE category = 'numbering' AND name = p_doc_type;
    END IF;

    -- Fallback template if none exists
    IF v_template IS NULL THEN
        v_template := UPPER(p_doc_type) || '/{YYYY}/{SEQ:3}';
    END IF;

    -- B. Determine Sequence Key (Resets based on template)
    -- If template contains month placeholders, sequence resets monthly.
    IF v_template LIKE '%{MM}%' OR v_template LIKE '%{MMM}%' THEN
        v_seq_key := p_doc_type || '_' || v_year || '_' || v_month;
    ELSE
        -- Default: Yearly reset
        v_seq_key := p_doc_type || '_' || v_year;
    END IF;

    -- C. Atomically Increment Sequence
    -- UPSERT logic handles the creation of new sequence keys (e.g., when a new year starts).
    INSERT INTO public.document_sequences (name, last_value)
    VALUES (v_seq_key, 1)
    ON CONFLICT (name) DO UPDATE 
    SET last_value = document_sequences.last_value + 1,
        updated_at = NOW()
    RETURNING last_value INTO v_current_seq;

    -- D. Parse Template Placeholders
    v_result := v_template;
    v_result := REPLACE(v_result, '{YYYY}', v_year);
    v_result := REPLACE(v_result, '{YY}', v_year_short);
    v_result := REPLACE(v_result, '{MM}', v_month);
    v_result := REPLACE(v_result, '{MMM}', v_month_name);
    v_result := REPLACE(v_result, '{DD}', v_day);

    -- E. Handle Padded Sequence {SEQ:N}
    -- Matches pattern like {SEQ:3}, {SEQ:4}, etc.
    v_seq_placeholder := substring(v_result FROM '\{SEQ:[0-9]+\}');
    IF v_seq_placeholder IS NOT NULL THEN
        -- Extract padding length from the placeholder
        v_padding := (substring(v_seq_placeholder FROM '[0-9]+'))::INT;
        v_result := REPLACE(v_result, v_seq_placeholder, lpad(v_current_seq::text, v_padding, '0'));
    ELSE
        -- Fallback: Just append the raw sequence number
        v_result := v_result || v_current_seq::text;
    END IF;

    RETURN v_result;
END;
$$;
