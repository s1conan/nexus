import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

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
  const words = query.trim().split(/\s+/).filter(Boolean)
  console.log(
    `[DEBUG UTILS] Query: "${query}", Words:`,
    words,
    "Columns:",
    columns
  )

  if (words.length === 0 || columns.length === 0) {
    console.log("[DEBUG UTILS] Returning empty string")
    return ""
  }

  const columnFilters = columns.map((col) => {
    if (words.length === 1) return `${col}.ilike.*${words[0]}*`
    const wordFilters = words.map((word) => `${col}.ilike.*${word}*`)
    return `and(${wordFilters.join(",")})`
  })

  return columnFilters.join(",")
}
