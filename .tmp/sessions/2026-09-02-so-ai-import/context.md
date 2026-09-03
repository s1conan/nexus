# Task Context: SO AI Import (extract SO fields from PDF/image via OpenRouter)

Session ID: 2026-09-02-so-ai-import
Created: 2026-09-02T22:35:12+07:00
Status: in_progress

## Current Request
Add an "Import from Document" button on the sales-order page. User uploads PDF/image files (multiple allowed), files are sent to an AI provider (OpenRouter, env-configured: AI_PROVIDER, AI_API_KEY, AI_MODEL) which extracts SO fields; extracted data prefills the New SO form with auto-matched company/product records; user confirms and saves via the existing dialog.

## Context Files (Standards to Follow)
- AGENTS.md (repo root) — UI conventions, Supabase/env conventions, verification commands
- GEMINI.md / coding-preferences.md — surgical edits, preserve user-tuned styles

## Reference Files (Source Material to Look At)
- nids-app/app/sales-order/page.tsx — target page; handleOpenDialog blank branch is the fill mapping
- nids-app/lib/site-content.ts — dictionary en/id
- nids-app/app/api/send-email/route.ts — API route pattern
- nids-app/lib/email.ts — env usage pattern
- nids-app/.env.local — env vars

## External Docs Fetched
- None (OpenRouter is OpenAI-compatible chat completions; known API shape)

## Components
- lib/ai-provider.ts — env config + system prompt + OpenRouter fetch adapter
- app/api/ai/extract-so/route.ts — multipart POST, validation, returns JSON
- components/so-ai-import-dialog.tsx — file picker + analyze + review
- app/sales-order/page.tsx — header button, auto-match, form prefill
- lib/site-content.ts — new dict keys (en + id)

## Constraints
- Server-side only env (no NEXT_PUBLIC_ for keys)
- Plain fetch, no new npm deps
- shadcn/ui components only; ButtonLoader on submit; notify for errors
- Preserve existing page structure; surgical edits only

## Exit Criteria
- [ ] lint, typecheck, build pass in nids-app
- [ ] Env vars documented in .env.local
- [ ] Extraction flow prefills form with auto-matched company/product
