# AGENTS.md

## Working Directory
- The real app is `nids-app`; run app commands from there. The root `package.json` only has dependencies and no scripts.
- Use npm for this repo: `nids-app/package-lock.json` is the app lockfile.

## Commands
- Install app deps: `cd nids-app && npm ci`.
- Dev server: `cd nids-app && npm run dev` starts Next on port `3003`.
- Verification: `cd nids-app && npm run lint`, `npm run typecheck`, then `npm run build` when relevant.
- Focused lint: `cd nids-app && npx eslint app/path/file.tsx` or another specific file path.
- Format TS/TSX: `cd nids-app && npm run format`; Prettier uses `prettier-plugin-tailwindcss` and `app/globals.css` for Tailwind class sorting.
- There is no configured test runner or `test` script; do not invent test commands.

## App Shape
- This is a Next.js App Router app (`next@16`, React 19) with path alias `@/*` rooted at `nids-app`.
- `app/layout.tsx` initializes theme, dictionary, auth, tooltips, MDI layout, and server-side Supabase user/profile data.
- Public routes render their page children directly: `/`, `/signup`, `/reset-password`, `/auth/*`, and `/verify/*`.
- Authenticated routes are displayed through the MDI shell, not normal route children. To add an authenticated module, update `components/mdi-layout.tsx` tab imports/registry/navigation as well as any `app/.../page.tsx` file.
- MDI tab state is persisted in `localStorage` keys `nids_mdi_tabs` and `nids_mdi_active_tab`; restored tabs depend on the registry in `components/mdi-layout.tsx`.

## Supabase And Env
- Browser Supabase client: `lib/supabase.ts`; server cookie client: `lib/supabase-server.ts`; service-role admin client: `lib/supabase-admin.ts`.
- Required runtime env for full behavior: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`; `RESEND_FROM_EMAIL` and `NEXT_PUBLIC_APP_URL` are optional fallbacks in code.
- Auth/profile permissions come from `profiles` joined to `role_permissions`; UI permission checks use `useAuth().hasPermission(module, action)`.
- SQL files are manual Supabase scripts at the repo root and a few under `nids-app`; there is no `supabase/migrations` directory. For DB changes, add/update the relevant SQL script and keep schema docs/scripts consistent.

## UI Conventions
- **Always use shadcn/ui or premade components** (`Button`, `Dialog`, `Input`, `Select`, `Table`, `Card`, `DropdownMenu`, etc.) from `components/ui/*` or `components*` — never write raw `<button>`, `<dialog>`, or structure interactive UI with raw `<div>` elements.
- shadcn components are customized. Never overwrite `components/ui/*` blindly; `Button` has repo-specific variants such as `danger`, `close`, and `table_action`.
- Follow existing module pages like `app/products/page.tsx` and `app/companies/page.tsx` for CRUD layout, table action buttons, loading states, and responsive behavior.
- Use `components/number-input.tsx` for numeric/currency/percent inputs; it formats using `SITE_CONFIG.numberLocale` (`id-ID`).
- Use `Switch` for boolean/active toggles, not checkbox, and preserve the small status text pattern used in existing pages.
- Save/submit buttons should disable while submitting and show `ButtonLoader` to prevent double submissions.
- User-facing labels/messages should go through `lib/site-content.ts` for both `en` and `id`; avoid new hardcoded UI text.
- Global theme tokens and Tailwind v4 setup live in `app/globals.css`; there is no `tailwind.config.*`.

## Documents And Email
- Quotation PDFs use `lib/pdf-generator-react.tsx` with `@react-pdf/renderer`, QR codes, and public verification via `/api/verify-document`.
- Delivery order PDFs still use `lib/pdf-generator.ts` with `jspdf`/`jspdf-autotable`.
- Email sending goes through `lib/email.ts` and `app/api/send-email/route.ts` using Resend.

## Existing Local Guidance
- Preserve the useful constraints from `GEMINI.md` and `coding-preferences.md`: make surgical edits, do not wipe user-tuned styles/classes, keep mobile behavior in mind, preserve `ButtonLoader`, avoid invalid DOM nesting that can cause hydration errors, and group imports consistently with nearby files.
- The user often edits code and styling by hand between agent runs. If a requested change touches code/classes that may include user modifications, preserve the existing structure and change only the necessary lines; ask before replacing a whole block/component or reformatting unrelated styling.
