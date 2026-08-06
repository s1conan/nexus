import crypto from "crypto"

/**
 * Recursively canonicalizes a value for deterministic JSON serialization.
 * - Object keys are sorted alphabetically at every nesting level
 * - null/undefined values are omitted from objects
 * - Arrays are recursively processed
 * - Primitive values (including 0, false, "") are kept as-is
 */
function canonicalize(value: unknown): unknown {
  if (value === null || value === undefined) {
    return undefined
  }

  if (Array.isArray(value)) {
    return value
      .map(canonicalize)
      .filter((v): v is unknown => v !== undefined)
  }

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>
    const keys = Object.keys(obj).sort()
    const result: Record<string, unknown> = {}
    for (const key of keys) {
      const processed = canonicalize(obj[key])
      if (processed !== undefined) {
        result[key] = processed
      }
    }
    return result
  }

  return value
}

/**
 * Returns a deterministic JSON string of the given data.
 * Keys are sorted alphabetically at all nesting levels (deep sort).
 * null and undefined values are omitted from all objects.
 */
export function canonicalSerialize<T>(data: T): string {
  const canonical = canonicalize(data)
  return JSON.stringify(canonical)
}

/**
 * Computes a SHA-256 hash of the given data using the Web Crypto API (browser).
 * Returns the hash as a lowercase hexadecimal string.
 */
export async function computeHash(data: string): Promise<string> {
  const encoder = new TextEncoder()
  const encoded = encoder.encode(data)
  const hashBuffer = await globalThis.crypto.subtle.digest("SHA-256", encoded)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
}

/**
 * Computes a SHA-256 hash of the given data using the Node.js crypto module (server).
 * Returns the hash as a lowercase hexadecimal string.
 * Only call this on the server side (API routes, server components, etc.).
 */
export function computeHashServer(data: string): string {
  return crypto.createHash("sha256").update(data).digest("hex")
}

/**
 * Fields to exclude from canonical data for all document types.
 * These are metadata/system fields, not content-bearing data.
 * `content_hash` is excluded to avoid a circular dependency — saving the
 * hash into the row would otherwise change the hash itself.
 */
const EXCLUDED_FIELDS = new Set([
  "id",
  "created_at",
  "updated_at",
  "created_by",
  "content_hash",
])

/**
 * Extracts the canonical document data from a row by taking EVERY database
 * column except metadata/system fields. This guarantees that any column a
 * user can edit — including fields added in the future — is covered by the
 * document hash, with no manual whitelist to keep in sync.
 *
 * Related tables fetched via joins (company, product, do, so, po) are
 * included as well, because their data is displayed inside the document.
 * Sorted alphabetically for deterministic output.
 */
export function getQuotationCanonicalData(
  row: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const key of Object.keys(row).sort()) {
    if (!EXCLUDED_FIELDS.has(key)) {
      result[key] = row[key]
    }
  }
  return result
}

/**
 * Extracts the canonical document data from a row by taking EVERY database
 * column except metadata/system fields. This guarantees that any column a
 * user can edit — including fields added in the future — is covered by the
 * document hash, with no manual whitelist to keep in sync.
 *
 * Related tables fetched via joins (company, product, do, so, po) are
 * included as well, because their data is displayed inside the document.
 * Sorted alphabetically for deterministic output.
 */
export function getInvoiceCanonicalData(
  row: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const key of Object.keys(row).sort()) {
    if (!EXCLUDED_FIELDS.has(key)) {
      result[key] = row[key]
    }
  }
  return result
}
