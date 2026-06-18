-- Add default email CC parameters
INSERT INTO public.app_settings (category, name, value, description)
VALUES 
  ('email', 'cc_quotation', '', 'Comma-separated list of emails to CC for Quotation emails.'),
  ('email', 'cc_po', '', 'Comma-separated list of emails to CC for Sales Order emails.'),
  ('email', 'cc_do', '', 'Comma-separated list of emails to CC for Delivery Order emails.'),
  ('email', 'cc_invoice', '', 'Comma-separated list of emails to CC for Invoice emails.'),
  ('email', 'cc_payment', '', 'Comma-separated list of emails to CC for Payment emails.')
ON CONFLICT (category, name) DO NOTHING;