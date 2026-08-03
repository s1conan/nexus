<!-- Context: project-intelligence/technical | Priority: critical | Version: 1.0 | Updated: 2026-07-21 -->

# Technical Domain

**Purpose**: Tech stack, architecture, and development patterns for the NIDS application.
**Last Updated**: 2026-07-21

## Quick Reference
**Update Triggers**: Tech stack changes | New patterns | Architecture decisions
**Audience**: Developers, AI agents

## Primary Stack
| Layer | Technology | Version | Rationale |
|-------|-----------|---------|-----------|
| Framework | Next.js (App Router) | 16 | Server components, MDI layout shell |
| Language | TypeScript | 5.x | Type safety, path alias `@/*` → `nids-app` |
| Database | Supabase (PostgreSQL) | — | RLS, realtime, auth, `generate_document_number` RPC |
| Styling | Tailwind CSS | v4 | `app/globals.css`, no `tailwind.config.*`, `prettier-plugin-tailwindcss` |
| UI Kit | shadcn/ui (customized) | — | `components/ui/*`, extra variants (danger, close, table_action) |
| Auth | Supabase Auth + profiles | — | `useAuth().hasPermission(module, action)` |
| Forms | Local state + manual validation | — | `LiveSearch`, `NumberInput`, `Switch`, `notify.error()` |
| Icons | lucide-react | — | Static imports, `<Icon data-icon="inline-start" />` |
| PDF | @react-pdf/renderer + jspdf | — | Quotations use react-pdf; DOs use jspdf-autotable |
| Email | Resend | — | `lib/email.ts`, `app/api/send-email/route.ts` |
| Package Manager | npm | — | `nids-app/package-lock.json` is the app lockfile |

## Code Patterns

### Data Access (Direct Supabase — Client Components)
```typescript
// Pattern: createClient() + .from().select().eq().range()
// Found in: app/delivery-order/page.tsx, app/sales-order/page.tsx, app/invoice/page.tsx
const supabase = createClient()

// Read with joins
const { data, error } = await supabase
  .from("delivery_orders")
  .select("*, company:companies!fk(id, name), po:sales_orders(id, so_number)")
  .range(offset, offset + PAGE_SIZE - 1)
  .order("created_at", { ascending: false })

// Write
const { error } = await supabase.from("delivery_orders").insert([payload])
const { error } = await supabase.from("delivery_orders").update(payload).eq("id", id)

// RPC (document numbering)
const { data } = await supabase.rpc("generate_document_number", { p_doc_type: "delivery-order" })
```

### Page Component (CRUD Pattern)
```tsx
// Pattern: "use client" + state + fetchData + handleSave + Dialog + Table
// Found in: app/delivery-order/page.tsx, app/products/page.tsx, app/companies/page.tsx
"use client"
import { useState, useEffect, useCallback, useRef } from "react"

export default function DeliveryOrdersPage() {
  const { dict, lang } = useDictionary()
  const { hasPermission } = useAuth()
  const supabase = createClient()

  // States
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [formData, setFormData] = useState({ ... })

  // Data fetching (useCallback with deps)
  const fetchData = useCallback(async (isInitial = false) => { ... }, [supabase, offset, debouncedSearchQuery, sortLevels])

  // Save handler (validate → save → refresh)
  const handleSave = async () => {
    const errors: string[] = []
    if (!formData.field) errors.push("Message")
    if (errors.length > 0) { notify.error("Title", errors.join("\n")); return }
    setIsSaving(true)
    // ... supabase insert/update ...
    fetchData(true)
    setIsOpen(false)
  }

  // JSX: page-container → page-header → action-bar → Card > Table → Dialog
  return (
    <div className="page-container">
      <div className="page-header">...</div>
      <div className="action-bar">...</div>
      <Card><Table>...</Table></Card>
      <Dialog open={isOpen}>
        <DialogContent className="sm:max-w-5xl">
          <form onSubmit={(e) => { e.preventDefault(); handleSave() }}>
            {/* LiveSearch, NumberInput, Select, Input */}
          </form>
          <DialogFooter>
            <Button type="submit" disabled={isSaving || !canInsert}>
              {isSaving ? <ButtonLoader /> : <Save data-icon="inline-start" />}
              {dict.BUTTON_SAVE}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

## Naming Conventions
| Type | Convention | Example |
|------|-----------|---------|
| Files | kebab-case | `delivery-order/page.tsx`, `site-content.ts` |
| Components | PascalCase | `DeliveryOrdersPage`, `LiveSearch`, `NumberInput` |
| Functions/handlers | camelCase | `handleSave`, `fetchData`, `handleSOSelect` |
| Hooks/variables | camelCase | `isSaving`, `selectedPOInfo`, `formData` |
| DB tables | snake_case | `delivery_orders`, `sales_orders`, `app_settings` |
| DB columns | snake_case | `so_id`, `company_id`, `do_number` |
| CSS classes | kebab-case | `page-container`, `action-bar`, `custom-scrollbar` |
| SQL files | snake_case | `delivery_orders_schema.sql`, `update_tax_system.sql` |
| Path alias | `@/*` → `nids-app` | `import { cn } from "@/lib/utils"` |

## Code Standards
1. **Always use shadcn/ui** — never raw `<button>`, `<dialog>`, or raw `<div>` for interactive UI
2. **Save/submit buttons** disable while submitting, show `<ButtonLoader />` to prevent double-submit
3. **User-facing labels** go through `lib/site-content.ts` (`dict.LABEL_*`, `dict.PLACEHOLDER_*`) for `en`/`id`; no hardcoded text
4. **Follow existing module pages** (`products`, `companies`, `delivery-order`) for CRUD layout, table actions, loading states, responsive behavior
5. **Use `<NumberInput />`** for numeric/currency/percent; formats with `SITE_CONFIG.numberLocale` (`id-ID`)
6. **Use `<Switch />`** for boolean/active toggles, never checkbox; preserve small status text pattern
7. **Surgical edits** — change only necessary lines; preserve user-tuned styles/classes; ask before replacing whole blocks
8. **Mobile-responsive** — avoid invalid DOM nesting that causes hydration errors
9. **Import grouping** — follow nearby files for consistent grouping style
10. **npm + nids-app/** — all commands from `nids-app/` directory; `package-lock.json` there is the app lockfile
11. **No hardcoded validation messages** — use dictionary keys or keep messages consistent with existing patterns

## Security Requirements
- **RLS enabled** on all data tables — `ALTER TABLE public.delivery_orders ENABLE ROW LEVEL SECURITY`
- **Permission gating** — `useAuth().hasPermission(module, action)` guards UI and actions (`canInsert`, `canEdit`, `canDelete`)
- **Supabase client separation** — browser anon key (`lib/supabase.ts`), server cookie (`lib/supabase-server.ts`), service-role admin (`lib/supabase-admin.ts`) — never expose admin key to client
- **Input validation** — manual validation arrays before save, `notify.error()` for failures
- **Parameterized queries** — Supabase SDK `.eq()`, `.is()` provide parameterization; no raw SQL from user input
- **Auth required** for authenticated routes — MDI layout wraps all authenticated modules

## 📂 Codebase References
**Implementation**: `nids-app/app/delivery-order/page.tsx` — canonical CRUD + LiveSearch + dialog pattern
**Config**: `nids-app/package.json`, `nids-app/tsconfig.json`, `nids-app/components.json`
**Auth**: `nids-app/components/auth-provider.tsx`, `nids-app/lib/supabase.ts`
**UI**: `nids-app/components/ui/`, `nids-app/app/globals.css`
**Dictionary**: `nids-app/lib/site-content.ts`
**DB Schemas**: `*.sql` files at repo root (manual Supabase scripts, no migrations dir)

## Related Files
- Business Domain (example: business-domain.md)
- Decisions Log (example: decisions-log.md)
