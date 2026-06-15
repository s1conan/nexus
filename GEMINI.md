# Foundation Mandates

## Core Principles
- **Protected Shared Components:** NEVER use `--overwrite` when adding shadcn/ui components unless specifically instructed. ALWAYS use `--diff` first to check for project-specific custom variants (like `table_action`, `danger`, `close` in `button.tsx`) or logic. Overwriting shared components often breaks project-wide styling and functionality.
- **UI Consistency & Integrity:** ALWAYS preserve existing UI patterns. This includes keeping `ButtonLoader` in action buttons during submission/loading states and adhering to established icon usage and button variants.
- **DOM Nesting & Hydration:** Be extremely careful with HTML nesting (e.g., never put a `div` inside a `p` or an `AlertDialogDescription`). Such errors cause React hydration failures and runtime warnings.
