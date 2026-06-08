# Coding Preferences
1. Sometimes user will change the theme, class or some code, so if you found something that are different from your previous code, do not change it.
2. Be strictly surgical: only modify the specific lines or elements directly related to user request. DO NOT overwrite the entire className or styles that the user already change.
3. Preserve your edits: use smaller code blocks in the replace tool don't touch surrounding logic, styling, or manual changes you've made.
4. When making codes, always remember that this will be run on mobile devices too
5. When importing, they should be grouped, if its icon declaration should be in 1 line. if its importing component, they should be group with other components.
6. **UI Conventions (Crucial)**: 
   - ALWAYS use the `<Switch>` component for boolean/active toggles instead of standard checkboxes.
   - Accompany `<Switch>` with a small text indicator (e.g., `text-[10px] uppercase font-bold text-muted-foreground`) to show its status.
   - ALWAYS use `<ButtonLoader />` inside the Save/Submit button and manage an `isSubmitting` state to prevent double-submissions.
   - Use the inline IIFE filtering pattern `(() => { const filtered = ... return filtered.map(...) })()` inside `<TableBody>` instead of `useMemo` for search filtering.
   - Use dialog component on every popup
   - Number input should use component number-input component
   - Use same UI styling (font size, font boldness, icon size, background color) to be the same. ** use products.tsx and companies.tsx page as the standard.
   - No text should be hardcoded, use site-content.ts with 2 language registered.