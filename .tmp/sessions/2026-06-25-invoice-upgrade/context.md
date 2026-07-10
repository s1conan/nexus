# Task Context: Invoice Upgrade — delivered_date + Dialog Restructure

Session ID: 2026-06-25-invoice-upgrade
Created: 2026-06-25T22:04
Status: in_progress

## Current Request
1. Add `delivered_date` column to `delivery_orders` table (DB migration + schema.sql update)
2. Restructure invoice dialog: DO on top, mandatory, auto-fill/disable fields, read-only taxes, due-date-from-days

## Context Files (Standards to Follow)
- A:\Projects\nids\.agents\skills\shadcn\SKILL.md — component composition rules
- A:\Projects\nids\.agents\skills\shadcn\rules\composition.md — Dialog/Form composition
- A:\Projects\nids\.agents\skills\shadcn\rules\forms.md — Form patterns
- A:\Projects\nids\.agents\skills\shadcn\rules\styling.md — Styling conventions
- C:\Users\Conan\.config\opencode\context\core\standards\code-quality.md — code quality
- C:\Users\Conan\.config\opencode\context\core\workflows\feature-breakdown.md — DB-first pattern
- C:\Users\Conan\.config\opencode\context\ui\web\ui-styling-standards.md — responsive patterns

## Reference Files (Source Material to Look At)
- A:\Projects\nids\nids-app\app\invoice\page.tsx — current invoice page (753 lines)
- A:\Projects\nids\delivery_orders_schema.sql — DO table DDL (needs delivered_date)
- A:\Projects\nids\finance_schema.sql — invoices table schema
- A:\Projects\nids\nids-app\app\quotations\page.tsx — reference for days-to-expiry pattern
- A:\Projects\nids\nids-app\app\delivery-order\page.tsx — DO page with DO/SO data flow
- A:\Projects\nids\nids-app\lib\pdf-generator.tsx — PDF generation (for later)

## Components

### Component 1: DB Migration — delivered_date
- Add `delivered_date DATE` column to `delivery_orders` table
- Create migration SQL script: `nids-app\add_delivered_date_to_do.sql`
- Update `delivery_orders_schema.sql` to include the new column
- Run migration against Supabase

### Component 2: Invoice Dialog Restructure
- Move DO field to top, before company (mandatory — remove "(Optional)" label)
- Make DO search show 2 columns: DO number + company name
- When DO selected: auto-fill company name (disabled), subtotal (disabled), issue_date, delivery dates
- Add days-input for due_date calculation (like quotation's expiry days)
- Replace tax Switches with read-only text display (taxes are derived from DO→SO)
- Keep note RTE, save/cancel footer

## Constraints
- Preserve existing styling/classes (surgical edits)
- Keep all permission checks (`canEdit`, `canInsert`, `canDelete`)
- Don't break existing infinite scroll or filter behavior
- DO is NOW mandatory — invoice must always link to a DO
- Use existing shadcn components (Button, Dialog, Input, Select, Table, Card)
- Follow existing module pages for CRUD layout and patterns

## Exit Criteria
- [ ] `delivered_date` column added to `delivery_orders` (migration applied + schema.sql updated)
- [ ] DO selection mandatory, on top of dialog, 2-column search
- [ ] Auto-fill company, subtotal, issue_date from DO (disabled)
- [ ] Due date calculated from days input (like quotation expiry)
- [ ] Tax section is read-only (no switches)
- [ ] Note RTE still works
- [ ] Typecheck + lint pass
