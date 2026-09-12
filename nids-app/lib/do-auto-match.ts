import { bestFuzzyMatch, fuzzyScore } from "@/lib/fuzzy-match"
import type { ExtractedDO } from "@/lib/ai-provider"
import type { SupabaseClient } from "@supabase/supabase-js"

export type DOMatch = {
  company: { id: string; name: string; details: unknown } | null
  product: { id: string; sku: string; name: string } | null
  transporter: { id: string; name: string } | null
  supplier: { id: string; name: string } | null
  vehicle: {
    id: string
    license_number: string
    number_of_seals?: number | null
    compartments?: unknown
  } | null
  so: {
    id: string
    so_number: string
    quantity: number | null
    so_date: string | null
    delivery_address: string | null
    company_id: string
    product_id: string
    company: { id: string; name: string } | null
    product: { id: string; sku: string; name: string } | null
  } | null
}

/** Alphanumeric-only comparison for license plates ("B 9581 SFA" vs "B9581SFA"). */
function plateScore(query: string, candidate: string): number {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "")
  const q = norm(query)
  const c = norm(candidate)
  if (!q || !c) return 0
  if (q === c) return 1
  if (c.includes(q) || q.includes(c)) return 0.9
  return 0
}

/**
 * Auto-match Surat Jalan extraction results against DB records:
 * company (Customer), product, transporter (Transporter), supplier (Supplier),
 * vehicle (by license plate), and the linked Sales Order (by PO number).
 */
export async function autoMatchDO(
  supabase: SupabaseClient,
  data: ExtractedDO
): Promise<DOMatch> {
  const result: DOMatch = {
    company: null,
    product: null,
    transporter: null,
    supplier: null,
    vehicle: null,
    so: null,
  }

  const [companiesRes, productsRes, vehiclesRes, soRes] = await Promise.all([
    supabase.from("companies").select("id, name, details").contains("type", ["Customer"]),
    supabase.from("products").select("id, sku, name"),
    supabase.from("vehicles").select("id, license_number, number_of_seals, compartments"),
    data.po_number
      ? supabase
          .from("sales_orders")
          .select(
            "id, so_number, po_number, quantity, so_date, delivery_address, company_id, product_id, company:companies(id, name), product:products(id, sku, name)"
          )
          .in("status", ["Approved", "Partial"])
          .limit(50)
      : Promise.resolve({ data: [] }),
  ])

  if (data.company_name && companiesRes.data) {
    const best = bestFuzzyMatch(
      data.company_name,
      companiesRes.data.map((c: any) => ({
        id: c.id,
        name: c.name,
        details: c.details,
        label: c.name,
      }))
    )
    if (best) {
      result.company = {
        id: best.item.id,
        name: best.item.name,
        details: best.item.details,
      }
    }
  }

  if (data.product_description && productsRes.data) {
    const best = bestFuzzyMatch(
      data.product_description,
      productsRes.data.flatMap((p: any) => [
        { id: p.id, sku: p.sku, name: p.name, label: p.name },
        { id: p.id, sku: p.sku, name: p.name, label: p.sku },
      ]),
      0.75
    )
    if (best) {
      result.product = {
        id: best.item.id,
        sku: best.item.sku,
        name: best.item.name,
      }
    }
  }

  if (data.transporter_name && companiesRes.data) {
    // Transporter companies live in the same table — query separately by type
    const { data: transporters } = await supabase
      .from("companies")
      .select("id, name")
      .contains("type", ["Transporter"])
    if (transporters) {
      const best = bestFuzzyMatch(
        data.transporter_name,
        transporters.map((c: any) => ({ id: c.id, name: c.name, label: c.name }))
      )
      if (best) result.transporter = { id: best.item.id, name: best.item.name }
    }
  }

  if (data.supplier_name) {
    const { data: suppliers } = await supabase
      .from("companies")
      .select("id, name")
      .contains("type", ["Supplier"])
    if (suppliers) {
      const best = bestFuzzyMatch(
        data.supplier_name,
        suppliers.map((c: any) => ({ id: c.id, name: c.name, label: c.name }))
      )
      if (best) result.supplier = { id: best.item.id, name: best.item.name }
    }
  }

  if (data.vehicle_number && vehiclesRes.data) {
    let best: { score: number; item: any } | null = null
    for (const v of vehiclesRes.data as any[]) {
      const score = Math.max(
        plateScore(data.vehicle_number, v.license_number || ""),
        fuzzyScore(data.vehicle_number, v.license_number || "")
      )
      if (!best || score > best.score) best = { score, item: v }
    }
    if (best && best.score >= 0.85) {
      result.vehicle = {
        id: best.item.id,
        license_number: best.item.license_number,
        number_of_seals: best.item.number_of_seals,
        compartments: best.item.compartments,
      }
    }
  }

  // SO link by PO number (fuzzy, case/punctuation tolerant)
  if (data.po_number && soRes.data && soRes.data.length > 0) {
    let best: { score: number; item: any } | null = null
    for (const so of soRes.data as any[]) {
      const score = Math.max(
        fuzzyScore(data.po_number, so.po_number || ""),
        fuzzyScore(so.po_number || "", data.po_number)
      )
      if (!best || score > best.score) best = { score, item: so }
    }
    if (best && best.score >= 0.75) {
      result.so = {
        id: best.item.id,
        so_number: best.item.so_number,
        quantity: best.item.quantity,
        so_date: best.item.so_date,
        delivery_address: best.item.delivery_address,
        company_id: best.item.company_id,
        product_id: best.item.product_id,
        company: best.item.company,
        product: best.item.product,
      }
    }
  }

  return result
}
