import { bestFuzzyMatch, fuzzyScore } from "@/lib/fuzzy-match"
import type { SupabaseClient } from "@supabase/supabase-js"

export type ExtractedSOData = {
  po_number: string | null
  company_name: string | null
  product_description: string | null
  product_sku: string | null
  so_date: string | null
  delivery_date: string | null
  quantity: number | null
  quantity_raw?: string | null
  unit_price: number | null
  unit_price_raw?: string | null
  currency: string | null
  term_of_payment: string | null
  discount_percent: number | null
  discount_amount?: number | null
  discount_amount_raw?: string | null
  delivery_address: string | null
  delivery_taxable?: boolean | null
  delivery_price_total?: number | null
  delivery_price_total_raw?: string | null
  delivery_price_per_litre?: number | null
  shrinkage_tolerance?: number | null
  note: string | null
  product_total?: number | null
  subtotal?: number | null
  grand_total?: number | null
  taxes: {
    name: string
    rate: number | null
    rate_document?: number | null
    amount?: number | null
  }[] | null
  confidence: Record<string, string> | null
  flagged_fields?: string[] | null
  warnings: string[] | null
}

export type SOAutoMatch = {
  company: { id: string; name: string; details: unknown } | null
  product: { id: string; sku: string; name: string } | null
}

/**
 * Auto-match AI-extracted company/product names against DB records using
 * fuzzy matching. Shared by the import dialog and the drag-and-drop shortcut.
 */
export async function autoMatchSO(
  supabase: SupabaseClient,
  data: ExtractedSOData
): Promise<SOAutoMatch> {
  const result: SOAutoMatch = { company: null, product: null }

  const [companiesRes, productsRes] = await Promise.all([
    supabase
      .from("companies")
      .select("id, name, nickname, details")
      .contains("type", ["Customer"]),
    supabase.from("products").select("id, sku, name"),
  ])

  if (data.company_name && companiesRes.data) {
    // Compare against both name and nickname, keep the best fuzzy match
    type CompanyCandidate = {
      id: string
      name: string
      details: unknown
      label: string
    }
    const candidates: CompanyCandidate[] = companiesRes.data.flatMap(
      (c: { id: string; name: string; nickname: string | null; details: unknown }) => {
        const items: CompanyCandidate[] = [
          { id: c.id, name: c.name, details: c.details, label: c.name },
        ]
        if (c.nickname)
          items.push({
            id: c.id,
            name: c.name,
            details: c.details,
            label: c.nickname,
          })
        return items
      }
    )
    const best = bestFuzzyMatch(data.company_name, candidates)
    if (best) {
      result.company = {
        id: best.item.id,
        name: best.item.name,
        details: best.item.details,
      }
    }
  }

  if (productsRes.data) {
    type ProductCandidate = {
      id: string
      sku: string
      name: string
      label: string
    }
    // SKU match first (highest precision, strict threshold), then description
    const skuCandidates: ProductCandidate[] = data.product_sku
      ? productsRes.data.map(
          (p: { id: string; sku: string; name: string }) => ({
            id: p.id,
            sku: p.sku,
            name: p.name,
            label: p.sku,
          })
        )
      : []
    const descCandidates: ProductCandidate[] = data.product_description
      ? productsRes.data.flatMap(
          (p: { id: string; sku: string; name: string }) => [
            { id: p.id, sku: p.sku, name: p.name, label: p.name },
            { id: p.id, sku: p.sku, name: p.name, label: p.sku },
          ]
        )
      : []

    const skuBest = bestFuzzyMatch(data.product_sku, skuCandidates, 0.9)
    if (skuBest) {
      result.product = {
        id: skuBest.item.id,
        sku: skuBest.item.sku,
        name: skuBest.item.name,
      }
    } else {
      const descBest = bestFuzzyMatch(
        data.product_description,
        descCandidates,
        0.75
      )
      if (descBest) {
        result.product = {
          id: descBest.item.id,
          sku: descBest.item.sku,
          name: descBest.item.name,
        }
      }
    }
  }

  return result
}

/**
 * Compares document tax rates against the DB parameters (which always win in
 * the form). Returns human-readable warnings, e.g. "PPN: document states 12%,
 * system uses 11% (kept from settings)". Shared by the import dialog and the
 * drag-and-drop shortcut so both paths warn identically.
 */
export function computeTaxRateWarnings(
  data: ExtractedSOData,
  globalTaxes: { name: string; value: number }[]
): string[] {
  const warnings: string[] = []
  if (!data.taxes) return warnings
  for (const et of data.taxes) {
    // rate_document preserves what the document stated before the server
    // applied the DB rate — comparing the overridden rate would find nothing
    const docRate = et.rate_document ?? et.rate
    if (docRate == null) continue
    let best: { name: string; value: number; score: number } | null = null
    for (const gt of globalTaxes) {
      if (gt?.value == null) continue
      const score = Math.max(
        fuzzyScore(gt.name, et.name),
        fuzzyScore(et.name, gt.name)
      )
      if (!best || score > best.score) best = { name: gt.name, value: gt.value, score }
    }
    if (
      best &&
      best.score >= 0.6 &&
      Math.abs(Number(best.value) - Number(docRate)) > 0.01
    ) {
      warnings.push(
        `${et.name}: document states ${docRate}%, system uses ${best.value}% (kept from settings)`
      )
    }
  }
  return warnings
}
