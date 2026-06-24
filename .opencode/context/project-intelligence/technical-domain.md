<!-- Context: project-intelligence/technical | Priority: critical | Version: 1.1 | Updated: 2026-06-19 -->

# Technical Domain

**Purpose**: Compact technical patterns for agents working in NIDS.
**Audience**: OpenCode agents editing app code, Supabase SQL, UI modules, or document/email flows.

## Quick Reference

This repo is a nested Next.js App Router app. Work in `nids-app`, preserve local UI conventions, and treat root SQL files as manual Supabase scripts rather than generated migrations.

- App root: `nids-app`; root `package.json` is not the app manifest.
- Stack: Next.js 16, React 19, TypeScript strict, Tailwind v4, shadcn/radix-vega, Supabase, Resend.
- Verification order: `npm run lint`, `npm run typecheck`, then `npm run build` when relevant.
- No test runner is configured; do not invent `npm test`.
- Path alias `@/*` resolves from `nids-app`.

## Primary Stack

| Layer | Technology | Version | Notes |
| --- | --- | --- | --- |
| App | Next.js App Router | 16.1.7 | Dev server uses port `3003`. |
| UI | React + shadcn + Tailwind | React 19.2.4, Tailwind 4.2.1 | Tailwind config is `app/globals.css`, not `tailwind.config.*`. |
| Data | Supabase/Postgres | `@supabase/ssr`, `supabase-js` | Browser, server-cookie, and admin clients are separate. |
| Email | Resend | 6.12.3 | API route wraps shared `lib/email.ts`. |
| PDFs | react-pdf + jsPDF | mixed | Quotations use react-pdf; delivery orders use jsPDF. |

## API Pattern

Routes are App Router handlers returning `NextResponse.json`. Use explicit required-field checks, `try/catch`, and route-specific Supabase client choice.

- Service-role operations use `supabaseAdmin` only inside server routes.
- Public document verification intentionally bypasses RLS via admin client.
- Background email/auth cleanup is fire-and-forget in approval flows.

```ts
export async function POST(request: Request) {
  try {
    const { to, subject, html } = await request.json()
    if (!to || !subject || !html) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }
    return NextResponse.json(await sendEmail({ to, subject, html }))
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed" }, { status: 500 })
  }
}
```

## Component Pattern

Most module pages are client-side CRUD screens with local state, permission gates, dialogs, table actions, and shared dictionary labels. Follow existing pages before inventing new layout patterns.

- Use `useDictionary()` for labels/messages and add both `en` and `id` entries in `lib/site-content.ts`.
- Use `useAuth().hasPermission(module, action)` for view/insert/edit/delete/print controls.
- Use `ButtonLoader` and disable save/submit buttons while submitting.
- Use `Switch` for boolean/active state, not checkbox.
- Use `NumberInput` for currency, quantity, percent, and locale-formatted numbers.

```tsx
<Button disabled={isSubmitting || !canEdit} onClick={handleSave}>
  {isSubmitting ? <ButtonLoader /> : <Save data-icon="inline-start" />}
  {dict.BUTTON_SAVE}
</Button>
<Switch checked={formData.is_active} onCheckedChange={checked => setFormData({ ...formData, is_active: checked })} />
<NumberInput value={formData.base_price} onChange={value => setFormData({ ...formData, base_price: value })} leftBadge={SITE_CONFIG.currencySymbol} />
```

## App Shell Pattern

Authenticated pages render inside the MDI shell instead of normal route children. Adding an authenticated module requires both the `app/.../page.tsx` file and `components/mdi-layout.tsx` registry/navigation updates.

- Public children render only for `/`, `/signup`, `/reset-password`, `/auth/*`, and `/verify/*`.
- MDI tabs persist to `nids_mdi_tabs` and `nids_mdi_active_tab` in `localStorage`.
- Restored tabs only work if their IDs exist in `TAB_REGISTRY`.

```tsx
const TAB_REGISTRY = {
  products: { title: dict.MENU_PRODUCTS, content: <ProductsPage /> },
  users: { title: dict.MENU_USERS, content: <UsersPage /> },
}
const handleOpenProducts = () => openTab("products", dict.MENU_PRODUCTS, <ProductsPage />)
```

## Naming Conventions

| Type | Convention | Example |
| --- | --- | --- |
| App files/routes | kebab-case route folders | `app/delivery-order/page.tsx` |
| Components | PascalCase exports, kebab-case files | `NumberInput` in `number-input.tsx` |
| Functions/hooks | camelCase | `createServerSideClient`, `useDictionary` |
| Database | snake_case tables/columns | `role_permissions`, `preferred_language` |
| Storage keys | `nids_` prefix | `nids_pref_lang`, `nids_mdi_tabs` |

## Code Standards

Standards are project-specific and should override generic defaults when editing this repo.

- Use npm from `nids-app`; focused lint is `npx eslint app/path/file.tsx`.
- Keep edits surgical; do not wipe user-tuned classes or customized shadcn files.
- Assume the user may have manually adjusted nearby code or styling; preserve those edits and ask before replacing full blocks/components or normalizing unrelated classes.
- Preserve import grouping used nearby, especially icon/UI/component groupings.
- Avoid invalid DOM nesting that can cause React hydration errors.
- Format with Prettier only when needed; it sorts Tailwind classes through `app/globals.css`.

## Security Requirements

Security depends on Supabase client boundaries, role permissions, and avoiding leaked service-role behavior.

- Browser code must use `lib/supabase.ts`; service-role admin client belongs in server-only routes/utilities.
- Required env for full behavior: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`.
- Permission UI should use profile permissions from `profiles` joined to `role_permissions`.
- Public verification is constrained to `/api/verify-document` and sanitizes document numbers before comparison.
- Do not hardcode user-facing strings; centralized text reduces missed bilingual/security messages.

## Database And Documents

Database changes are manual Supabase scripts, not framework migrations. Update or add the relevant SQL file and keep schema-oriented docs/scripts consistent.

- Root SQL files define current manual schema changes; some SQL helpers also live in `nids-app`.
- There is no `supabase/migrations` directory.
- PDFs use `lib/pdf-generator-react.tsx` with QR verification links.

```ts
const pdfUri = await generateStandardQuotationPDF(companyInfo, quotation, {
  save: false,
  output: "datauri",
})
```

## 📂 Codebase References

- `nids-app/package.json` - executable commands, versions, npm scripts.
- `nids-app/app/layout.tsx` - root providers, server-side Supabase profile bootstrap.
- `nids-app/components/layout-wrapper.tsx` - public-route bypass vs MDI shell.
- `nids-app/components/mdi-layout.tsx` - tab registry, navigation, permission-aware module launch.
- `nids-app/components/auth-provider.tsx` - profile loading and `hasPermission` behavior.
- `nids-app/lib/supabase.ts`, `lib/supabase-server.ts`, `lib/supabase-admin.ts` - Supabase client boundaries.
- `nids-app/app/api/approve/route.ts`, `app/api/verify-document/route.ts`, `app/api/send-email/route.ts` - API patterns.
- `nids-app/components/ui/button.tsx`, `components/number-input.tsx`, `components/button-loader.tsx` - customized UI primitives.
- `nids-app/app/products/page.tsx`, `app/companies/page.tsx` - CRUD module style references.
- `nids-app/lib/site-content.ts` - bilingual labels/messages and site config.
- `GEMINI.md`, `coding-preferences.md`, `AGENTS.md` - local agent guidance worth preserving.

## Related

- Navigation: `navigation.md`
- Agent quickstart: `../../../AGENTS.md`
