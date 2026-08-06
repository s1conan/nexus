# Task Context: Document Hash Verification via QR Code

Session ID: 2026-08-06-document-hash-verification
Created: 2026-08-06T02:18:00+07:00
Status: in_progress

## Current Request
Replace the current QR-based document verification system with cryptographic hash verification. Instead of encoding just a document ID in the QR code, encode a SHA-256 hash of the document's canonical source data. When scanned, the server re-computes the hash from the live database data and compares. Matching hashes prove data integrity (no tampering). Non-matching hashes indicate data was modified.

## Context Files (Standards to Follow)
- `.opencode/context/project-intelligence/technical-domain.md` — Tech stack (Next.js 16, Supabase, @react-pdf/renderer, shadcn/ui), code patterns, naming conventions, security requirements
- `coding-preferences.md` — Surgical edits only, Switch for toggles, ButtonLoader, NumberInput, site-content.ts for labels, no hardcoded text
- `AGENTS.md` — Working directory (nids-app/), commands (dev, lint, typecheck, build), UI conventions, PDF system docs
- `NIDS-blueprint.md` — Document verification system overview, sales pipeline

## Reference Files (Source Material to Look At)
- `nids-app/lib/pdf-generator.tsx` — PDF generation for quotations and invoices (both use @react-pdf/renderer + qrcode)
- `nids-app/app/api/verify-document/route.ts` — Current verification API (POST, checks document number match)
- `nids-app/app/verify/[type]/[id]/page.tsx` — Public verification page UI
- `nids-app/lib/site-content.ts` — Dictionary with en/id labels
- `quotations_schema.sql` — Quotations table DDL
- `schema.sql` — Core DB schema

## Database Tables (Live Supabase)
- `quotations` (8 rows, 27 columns) — id, quotation_number, company_id, product_id, quotation_date, expiry_date, expiry_days, minimum_order, status, content, is_content_enabled, note, is_note_enabled, terms_conditions, is_terms_enabled, closing_remarks, is_closing_enabled, discounts, created_at, updated_at, created_by, shrinkage_tolerance, bank_accounts, base_price, delivery_address, delivery_price, tax_details
- `invoices` (0 rows, 21 columns) — id, invoice_number, company_id, so_id, issue_date, due_date, subtotal, tax_rate, tax_amount, total_amount, paid_amount, status, note, is_note_enabled, created_at, updated_at, created_by, tax_details, do_id, bank_accounts, details

## Architecture Decision
**Hash the canonical JSON data, NOT the PDF binary.**
- PDF output is non-deterministic (@react-pdf/renderer may produce different bytes for the same data)
- QR code embedded in PDF creates circular dependency if hashing PDF
- Hashing canonical data is deterministic and verifiable

## Components
1. **Hash utility** (`lib/document-hash.ts`) — Canonical JSON serialization + SHA-256 hashing
2. **DB migration** (SQL file) — Add `content_hash` column to `quotations` and `invoices`
3. **Modified PDF generator** (`lib/pdf-generator.tsx`) — Compute hash, encode in QR as `?h={hash}`, optionally store in DB
4. **Updated verify API** (`app/api/verify-document/route.ts`) — Accept hash from QR, compare with computed hash
5. **Updated verify page** (`app/verify/[type]/[id]/page.tsx`) — Show hash match/mismatch status, no manual number entry needed

## Key Implementation Details
- QR URL format: `/verify/{type}/{id}?h={sha256_hex}` — backward compatible (no `?h=` → old flow)
- Hash algorithm: SHA-256 via Web Crypto API (browser for QR generation) and Node.js crypto (server for verification)
- Canonical serialization: `JSON.stringify(data, sortedKeys)` — keys sorted alphabetically for determinism
- Field whitelist per document type: exclude `id`, `created_at`, `updated_at`, `created_by` (non-data fields)
- Store hash in DB at generation time for defense-in-depth

## Constraints
- Must be backward compatible — existing QR codes (without hash) should still work with old manual-entry flow
- No hardcoded text — use site-content.ts dictionary with en/id
- Follow shadcn/ui component patterns, ButtonLoader for save/submit
- npm + nids-app/ directory for all commands
- Surgical edits only — don't rewrite entire files

## Exit Criteria
- [ ] `lib/document-hash.ts` — canonical serialization + hash functions for quotation and invoice data
- [ ] SQL migration file — `content_hash` column on `quotations` and `invoices`
- [ ] PDF generator updated — hash embedded in QR code URL, hash stored in DB
- [ ] Verify API updated — hash comparison logic, backward compatible
- [ ] Verify page updated — shows hash verification status, auto-verifies from QR
- [ ] TypeScript check passes (`npx tsc --noEmit`)
- [ ] Lint passes (`npx eslint`)
- [ ] Build passes (`npm run build`)
