-- Add default email BCC parameters
INSERT INTO public.app_settings (category, name, value, description)
VALUES 
  ('email', 'bcc_quotation', '', 'Comma-separated list of emails to BCC for Quotation emails.'),
  ('email', 'bcc_po', '', 'Comma-separated list of emails to BCC for Sales Order emails.'),
  ('email', 'bcc_do', '', 'Comma-separated list of emails to BCC for Delivery Order emails.'),
  ('email', 'bcc_invoice', '', 'Comma-separated list of emails to BCC for Invoice emails.'),
  ('email', 'bcc_payment', '', 'Comma-separated list of emails to BCC for Payment emails.')
ON CONFLICT (category, name) DO NOTHING;
