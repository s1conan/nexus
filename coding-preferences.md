# Coding Preferences
1. Sometimes user will change the theme, class or some code, so if you found something that are different from your previous code, do not change it.
2. Be strictly surgical: only modify the specific lines or elements directly related to user request. DO NOT overwrite the entire className or styles that the user already change.
3. Preserve your edits: use smaller code blocks in the replace tool don't touch surrounding logic, styling, or manual changes you've made.
4. When making codes, always remember that this will be run on mobile devices too
5. When importing, they should be grouped, if its icon declaration should be in 1 line. if its importing component, they should be group with other components. if its UI components, then they should be imported close to the other UI components.
6. If database changes needed, write the sql to change the database and tell the user the file name so he can paste it in query editor of supabase. The database changes should be reflected in the dbschema.sql (if its table changes, instead inserting the "alter table" line, you should change the "create table" line where that table created)
7. **UI Conventions (Crucial)**: 
   - ALWAYS use the `<Switch>` component for boolean/active toggles instead of standard checkboxes. Accompany `<Switch>` with a small text indicator (e.g., `text-[10px] uppercase font-bold text-muted-foreground`) to show its status.
   - ALWAYS use `<ButtonLoader />` inside the Save/Submit button and manage an `isSubmitting` state to prevent double-submissions.
   - Use the inline IIFE filtering pattern `(() => { const filtered = ... return filtered.map(...) })()` inside `<TableBody>` instead of `useMemo` for search filtering.
   - Use Dialog component on every popup
   - Number input should use component NumberInput component
   - Use same UI styling (font size, font boldness, icon size, background color) to be the same. Always use companies.tsx page as the standard.
   - No text should be hardcoded, use site-content.ts with 2 language registered.