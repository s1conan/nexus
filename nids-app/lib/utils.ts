import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { SupabaseClient } from "@supabase/supabase-js"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Strips PostgREST reserved characters (, ( ) ") from a raw value before it is
 * interpolated into an or()/and() filter string (e.g. searching "PT Royaltama, Tbk").
 */
export function sanitizePostgrestValue(value: string) {
  return value.replace(/[,()"]/g, "")
}

/**
 * Formats a list of warning strings as bullet lines for toast descriptions
 * (e.g. "• PPN: document states 12%...\n• PBBKB: ...").
 */
export function formatBulletList(items: string[]) {
  return items.map((item) => `• ${item}`).join("\n")
}

/**
 * Constructs a PostgREST filter string for multi-word "AND" search across multiple columns.
 * For each column, it checks if it contains ALL words from the query.
 * Matches if ANY column meets the criteria.
 *
 * Resulting string format:
 * and(col1.ilike.*w1*,col1.ilike.*w2*),and(col2.ilike.*w1*,col2.ilike.*w2*)
 *
 * To be used as: .or(constructMultiWordSearch(query, ['name', 'contact']))
 */
export function constructMultiWordSearch(query: string, columns: string[]) {
  // Strip PostgREST reserved characters (, ( ) ") so they don't break the
  // or()/and() filter syntax (e.g. searching "PT Royaltama, Tbk").
  const words = query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.replace(/[,()"]/g, ""))
    .filter(Boolean)

  if (words.length === 0 || columns.length === 0) {
    return ""
  }

  const columnFilters = columns.map((col) => {
    if (words.length === 1) return `${col}.ilike.*${words[0]}*`
    const wordFilters = words.map((word) => `${col}.ilike.*${word}*`)
    return `and(${wordFilters.join(",")})`
  })

  return columnFilters.join(",")
}

/**
 * Builds a `column.in.(id1,id2,...)` filter for use inside an or() logic tree.
 * PostgREST does not support related-table (dotted) fields such as
 * `company.name` inside or()/and(), so related rows must be resolved to ids
 * first and matched via a foreign-key `in()` filter instead.
 */
export function constructIdInFilter(ids: string[], column: string) {
  return ids.length > 0 ? `${column}.in.(${ids.join(",")})` : ""
}

/**
 * Resolves ids of rows in `table` where ANY of `columns` contains ALL words
 * from `query`. Used together with constructIdInFilter to search across
 * related tables, which or() logic trees do not support directly.
 */
export async function searchRelatedIds(
  supabase: SupabaseClient,
  table: string,
  query: string,
  columns: string[]
): Promise<string[]> {
  const searchStr = constructMultiWordSearch(query, columns)
  if (!searchStr) return []
  const { data } = await supabase.from(table).select("id").or(searchStr)
  return ((data as { id: string }[] | null) || []).map((row) => row.id)
}
