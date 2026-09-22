# Task Context: Mobile Menu Width Adjustment

Session ID: 2025-09-22-mobile-menu-width
Created: 2025-09-22T22:02:00Z
Status: in_progress

## Current Request
Reduce the excessive width of the floating mobile dropdown menu in `nids-app/components/mdi-layout.tsx`. The mobile menu uses `w-72` (18rem) which is too wide for the content it displays.

## Context Files (Standards to Follow)
- `A:\Projects\nids\coding-preferences.md` — Surgical edits only, mobile-first, import grouping, UI conventions
- `A:\Projects\nids\AGENTS.md` — Working directory rules, commands, app shape, UI conventions, shadcn/ui patterns
- `A:\Projects\nids\GEMINI.md` — Protected shared components, UI consistency, DOM nesting/hydration safety

## Reference Files (Source Material to Look At)
- `A:\Projects\nids\nids-app\components\mdi-layout.tsx` — Target file; mobile dropdown menu at line 1581-1592 with `w-72`
- `A:\Projects\nids\nids-app\components\ui\dropdown-menu.tsx` — shadcn/ui dropdown menu implementation
- `A:\Projects\nids\nids-app\app\globals.css` — Mobile breakpoint at 767px, Tailwind v4 setup

## External Docs Fetched
None needed — this uses existing project patterns.

## Components
- Mobile dropdown menu (`DropdownMenuContent`) at line 1581-1592 in mdi-layout.tsx
- Desktop dropdown menu (`DropdownMenuContent`) at line 1457-1459 for consistency reference

## Constraints
- **Surgical edits only** — only modify the specific className causing excessive width
- **Mobile-first** — all changes must work on mobile devices (breakpoint 767px)
- **shadcn/ui** — use existing DropdownMenu components, never raw HTML
- **Tailwind v4** — no tailwind.config, uses prettier-plugin-tailwindcss
- **Preserve user modifications** — do not overwrite surrounding styles/classes
- **No hardcoded text** — use site-content.ts for labels (not applicable to this change)

## Exit Criteria
- [ ] Mobile dropdown menu width reduced from `w-72` to appropriate content-fit width
- [ ] Desktop dropdown menu remains unchanged or adjusted for consistency
- [ ] All functionality preserved (scroll, click, close)
- [ ] `npm run lint` and `npm run typecheck` pass
- [ ] No visual regression on desktop
