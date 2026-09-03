/**
 * Lightweight fuzzy matching for company/product names extracted by AI.
 * Handles punctuation, casing, spacing, and token differences, e.g.:
 *   "PT. Bara Utama" vs "PT.BARA UTAMA"  -> match
 *   "B.50" vs "BBM Industri B50"         -> match (token containment)
 */

export type FuzzyCandidate = { label: string }

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function alnum(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "")
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const curr = [i]
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      )
    }
    prev = curr
  }
  return prev[b.length]
}

/** 0..1 similarity based on edit distance relative to the longer string. */
function levenshteinRatio(a: string, b: string): number {
  if (a === b) return 1
  const max = Math.max(a.length, b.length)
  if (max === 0) return 1
  return 1 - levenshtein(a, b) / max
}

/**
 * Score similarity between a query and a candidate string (0..1).
 * - 1.0    normalized exact match
 * - 0.95   alphanumeric-only match ("B.50" vs "B50")
 * - 0.6-0.9 token containment / partial overlap ("B.50" vs "BBM Industri B50")
 * - fallback: Levenshtein ratio for typos
 */
export function fuzzyScore(query: string, candidate: string): number {
  const q = normalize(query)
  const c = normalize(candidate)
  if (!q || !c) return 0
  if (q === c) return 1

  const qa = alnum(query)
  const ca = alnum(candidate)
  if (qa === ca) return 0.95

  // Token containment: every query token appears in the candidate
  const qTokens = q.split(" ")
  const cTokens = c.split(" ")
  const cTokenSet = new Set(cTokens)
  const cAlnumTokens = cTokens.map(alnum)
  const matched = qTokens.filter(
    (t) =>
      cTokenSet.has(t) || cAlnumTokens.some((ct) => ct.includes(alnum(t)))
  ).length
  if (matched === qTokens.length && qTokens.length > 0) {
    // Full query contained in candidate — stronger when candidate isn't much longer
    return Math.max(0.75, 0.9 - (cTokens.length - qTokens.length) * 0.03)
  }
  if (matched > 0) {
    return matched / qTokens.length * 0.7
  }

  return levenshteinRatio(q, c)
}

/**
 * Find the best candidate for a query. Returns null if the best score is
 * below the threshold (default 0.6).
 */
export function bestFuzzyMatch<T extends FuzzyCandidate>(
  query: string | null | undefined,
  candidates: T[],
  threshold = 0.6
): { item: T; score: number } | null {
  if (!query) return null
  let best: { item: T; score: number } | null = null
  for (const item of candidates) {
    const score = fuzzyScore(query, item.label)
    if (!best || score > best.score) {
      best = { item, score }
    }
  }
  return best && best.score >= threshold ? best : null
}
