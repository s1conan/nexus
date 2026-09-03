/**
 * AI provider configuration and extraction logic for Sales Order documents.
 * Uses OpenRouter (OpenAI-compatible chat completions) so any model can be
 * selected via env vars. Server-side only — never expose AI_API_KEY to client.
 */

import { fuzzyScore } from "@/lib/fuzzy-match"

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB per file
const MAX_FILES = 4

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
]

export type ExtractedSO = {
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
  taxes:
    | {
        name: string
        rate: number | null
        /** Rate as stated in the document, preserved when the DB rate overrides it */
        rate_document?: number | null
        amount?: number | null
      }[]
    | null
  confidence: Record<string, string> | null
  flagged_fields?: string[] | null
  warnings: string[] | null
}

export type ExtractedFile = {
  name: string
  mimeType: string
  data: Buffer
}

export function validateFiles(
  files: { name: string; type: string; size: number }[]
): string | null {
  if (files.length === 0) return "No files provided."
  if (files.length > MAX_FILES)
    return `Too many files. Maximum is ${MAX_FILES} files.`
  for (const file of files) {
    if (!ALLOWED_MIME_TYPES.includes(file.type))
      return `Unsupported file type: ${file.type || file.name}. Allowed: PDF, PNG, JPEG, WebP.`
    if (file.size > MAX_FILE_SIZE)
      return `File too large: ${file.name}. Maximum size is 10 MB per file.`
  }
  return null
}

const SYSTEM_PROMPT = `You are a document-extraction assistant for a Sales Order (SO) system.
You will receive one or more attached documents (Purchase Orders, amendments, emails, or scans).
Read ALL documents, merge into one result; on conflict prefer the most recent amendment and add
a warning. Respond with ONLY a valid JSON object — no markdown fences, no explanations.

METHOD — do this before filling any field:
Scan the document from TOP TO BOTTOM in reading order, line by line, block by block. For each
piece of text you encounter, decide what role it plays in this transaction (Who is the
customer? What is being bought, how much, at what price? What extra charges or reductions
apply? When must it be delivered and paid?). Assign each piece of text to the matching field
below based on that ROLE — not by hunting for specific keywords. Layouts, labels, and wordings
differ between companies; a field is defined by its MEANING in the document, not by a fixed
word. Indonesian POs commonly place taxes, discounts, and delivery fees INSIDE the product
table as rows, and summary blocks (subtotal, PPN, PBBKB, delivery, total) at the bottom —
those summary rows are the most reliable source for tax amounts and delivery fees.

Field roles (assign by meaning, whatever the label says):
- ONE ROW = ONE ITEM. Table rows are separated by border lines — each row is an independent
  line item that must be classified on its own. NEVER merge two or more rows into a single
  field, and NEVER concatenate several row descriptions into product_description.
- Product lines: the goods being purchased — usually the row with the LARGEST amount. Its
  description (e.g. "HIGH SPEED DIESEL") alone feeds product_description; its quantity and
  unit price feed quantity/unit_price. If the table has a Part Number / Item Code / Code
  column, that value is the product_sku (e.g. "B-40"). If several goods rows exist, use the
  primary one and add a warning naming the others. Liquid prices are per-litre.
- Tax rows: any row/block that is a government levy (e.g. PPN/VAT, PBBKB, regional taxes —
  they may appear as "NAME | rate | amount" tables or as table rows). amount = the currency
  value shown; rate = the percentage if one is shown, else null. Strip leading item numbers
  from names. A tax row must go to taxes[] EVEN IF it also looks like a table line item
  (e.g. a "PBBKB SOLAR" row with qty and unit price is still a tax — put its amount in
  taxes[], never in product_description). Never let these rows feed
  quantity/unit_price/product fields.
- Discount rows: a reduction in price, often written with the percentage in the name
  (e.g. a row whose name shows "(12%)") — discount_percent from that percentage,
  discount_amount from the row's currency value (parenthesized = negative). Never feed the
  discount row into quantity/unit_price.
- Delivery/transport rows: a shipping/transportation charge (e.g. "JASA PENGIRIMAN") —
  delivery_price_total (a row with unit LOT/LS is ONE FLAT fee, not volume; a row with a
  per-litre or per-unit rate x qty is that row's amount). delivery_price_per_litre only if a
  per-litre rate is explicitly stated. Never divide yourself; never treat its price as
  unit_price, and never put its description in product_description.
- Customer (company_name): the party ISSUING this PO — the buyer. Never the supplier/vendor.
- Payment terms: how long until payment is due, in days.
- Tolerance clauses: a permitted shrinkage/loss allowance for receiving. May be a percentage
  ("Toleransi 0.3%") -> shrinkage_tolerance — or a NOMINAL value ("Toleransi 50 liter",
  "susut Rp 100/liter"), which suppliers may include in the product price. The system field
  only supports a percentage: for a nominal tolerance set shrinkage_tolerance null, describe
  it in note, and add a warning that it is nominal and not captured as a percentage.
- Delivery address: where the goods must be shipped.

Schema (fill ONLY from what you actually found; null when absent — NEVER guess):

{
  "po_number": "customer PO number, or null",
  "company_name": "the CUSTOMER (buyer) the PO is addressed to — NEVER the supplier/vendor/letterhead issuing the document, or null",
  "product_description": "product or service description, or null",
  "product_sku": "product SKU/code, or null",
  "so_date": "issue date YYYY-MM-DD, or null",
  "delivery_date": "delivery date YYYY-MM-DD, or null",
  "quantity": number or null,
  "quantity_raw": "quantity VERBATIM from the document, or null",
  "unit_price": number or null,
  "unit_price_raw": "unit price VERBATIM from the document, or null",
  "currency": "ISO code e.g. IDR, or null",
  "term_of_payment": "normalized duration, see TOP rule, or null",
  "discount_percent": number or null,
  "discount_amount": number or null,
  "discount_amount_raw": "discount value VERBATIM from the document, or null",
  "delivery_address": "delivery/shipping address, or null",
  "delivery_price_total": number or null,
  "delivery_price_total_raw": "delivery total VERBATIM, or null",
  "delivery_price_per_litre": number or null,
  "delivery_taxable": true/false/null,
  "shrinkage_tolerance": number or null,
  "note": "other relevant notes, or null",
  "product_total": "the stated total of the product line(s), as printed on the document, or null",
  "subtotal": "the stated subtotal after discount, as printed on the document, or null",
  "grand_total": "the stated final total amount, as printed on the document, or null",
  "taxes": [{"name": "PPN", "rate": 11, "amount": 12507000}] or null,
  "flagged_fields": ["schema field names above that you could not extract reliably or that appear in your warnings"] or null,
  "confidence": {"field": "high|medium|low"},
  "warnings": ["only meaningful, unresolved issues"]
}

Conventions:
- NUMBERS: numeric fields are plain numbers — no separators, symbols, or units. Indonesian
  style: dots group thousands, commas are decimals ("1.500.000" = 1500000, "0,5" = 0.5).
  EXCEPTION — IDR currency NEVER has decimals, so a comma in a currency value is a thousands
  separator: "18,95" = 18950, "2,500" = 2500 (a fuel price of Rp 18.95 is impossible).
  For *_raw fields copy the text VERBATIM — the system parses them itself.
- DATES: ISO (YYYY-MM-DD). Two-digit years are always the current century ("02-Sep-26" =
  2026) — never warn about that; month-name dates are never ambiguous. Only warn when a
  numeric date could be day/month swapped ("05/03/2026" in Indonesian docs usually means
  5 March, not 3 May).
- TERM OF PAYMENT: normalize to ONLY the duration: "30 hari setelah barang diterima" ->
  "30 hari", "Net 30" -> "30 hari", "seminggu" -> "7 hari", "sebulan" -> "30 hari",
  "setengah bulan" -> "15 hari", COD -> "COD". Null if nothing stated.
- DELIVERY TAXABLE: true only if the document indicates the delivery fee is included in PPN;
  false only if explicitly excluded; null if unstated. The system verifies this from the PPN
  amount, so accurate tax amounts matter more than this flag.
- Extract values as stated — never move a value between discount/tax/delivery because the
  amounts look alike. A mangled or unclassifiable line: add a warning quoting the raw line
  and leave its fields null. The system derives tax rates and discount percentages from
  amounts, so capturing AMOUNTS correctly is more important than interpreting formats.
- Add a confidence entry for every extracted field.
- Warnings: short and meaningful — unresolved ambiguity, conflicts BETWEEN documents, 
  illegible text, or missing required fields.`

function buildFileParts(files: ExtractedFile[]) {
  return files.map((file) => {
    const base64 = file.data.toString("base64")
    if (file.mimeType === "application/pdf") {
      return {
        type: "file",
        file: {
          filename: file.name,
          file_data: `data:application/pdf;base64,${base64}`,
        },
      }
    }
    return {
      type: "image_url",
      image_url: {
        url: `data:${file.mimeType};base64,${base64}`,
      },
    }
  })
}

/**
 * Deterministic parser for Indonesian-formatted numbers (server-side safety
 * net for the AI's numeric interpretation).
 *
 * @param decimalCommaAllowed - true for quantities ("1,5 L" = 1.5 litres,
 *   Indonesian decimal comma), false for IDR currency (never has decimals,
 *   so "18,95" is a thousands shorthand for 18950).
 */
export function parseIdNumber(
  raw: string,
  decimalCommaAllowed = false
): number | null {
  let s = raw.replace(/[^0-9.,-]/g, "")
  if (!s) return null
  const hasDot = s.includes(".")
  const hasComma = s.includes(",")
  if (hasDot && hasComma) {
    // Rightmost separator is the decimal point ("1.500,50" -> 1500.5)
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      s = s.replace(/\./g, "").replace(",", ".")
    } else {
      s = s.replace(/,/g, "")
    }
  } else if (hasComma) {
    const parts = s.split(",")
    if (!decimalCommaAllowed) {
      // Currency: comma is ALWAYS a thousands separator.
      // "18,95" -> "1895" would be wrong when the document drops a trailing
      // zero (shorthand for "18,950"), so re-add the implied zero: 18950.
      if (parts.length === 2 && parts[1].length === 2) {
        s = parts[0] + parts[1] + "0"
      } else {
        s = s.replace(/,/g, "")
      }
    } else if (parts.length === 2 && parts[1].length <= 2) {
      // Quantity: 1-2 digits after a single comma is a genuine decimal
      s = parts[0] + "." + parts[1]
    } else {
      // "1,500" -> thousands
      s = s.replace(/,/g, "")
    }
  } else if (hasDot) {
    // Clean 3-digit groups are thousands separators ("18.950" -> 18950);
    // anything else stays a decimal ("7.5")
    if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) {
      s = s.replace(/\./g, "")
    }
  }
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/**
 * Overrides AI-interpreted numbers with deterministic parses of the raw
 * strings when available. Currency values (IDR) never have decimals.
 */
function normalizeExtractedNumbers(data: ExtractedSO): ExtractedSO {
  if (data.unit_price_raw) {
    const parsed = parseIdNumber(data.unit_price_raw, false)
    if (parsed !== null) data.unit_price = parsed
  }
  if (data.quantity_raw) {
    const parsed = parseIdNumber(data.quantity_raw, true)
    if (parsed !== null) data.quantity = parsed
  }
  if (data.delivery_price_total_raw) {
    const parsed = parseIdNumber(data.delivery_price_total_raw, false)
    if (parsed !== null) data.delivery_price_total = parsed
  }
  if (data.discount_amount_raw) {
    const parsed = parseIdNumber(data.discount_amount_raw, false)
    if (parsed !== null) data.discount_amount = parsed
  }
  return data
}

/**
 * Reconstructs the discount percentage from the discount amount when the AI
 * missed it (e.g. a "Diskon (12%)" line whose % the model ignored). Disc 12%
 * of 189,500,000 = 22,740,000 -> round(22740000 / 189500000 * 100) = 12.
 */
function deriveDiscountPercent(data: ExtractedSO): ExtractedSO {
  if (
    data.discount_percent != null ||
    !data.discount_amount ||
    !data.quantity ||
    !data.unit_price
  ) {
    return data
  }
  const base = data.quantity * data.unit_price
  if (base <= 0 || data.discount_amount > base) return data
  const percent = Math.round((data.discount_amount / base) * 10000) / 100
  if (percent > 0 && percent <= 100) {
    data.discount_percent = percent
  }
  return data
}

/**
 * Overrides extracted tax rates with the rates saved in the database (the
 * system parameter of record). Document tax rates are often wrong or use a
 * different basis (e.g. "PPN 12%" applied as 11%) — the DB value always wins,
 * and mismatches are surfaced as warnings by the client.
 */
function applyKnownTaxRates(
  data: ExtractedSO,
  knownTaxRates?: Record<string, number>
): ExtractedSO {
  if (!data.taxes || !knownTaxRates) return data
  for (const tax of data.taxes) {
    let best: { name: string; rate: number; score: number } | null = null
    for (const [name, rate] of Object.entries(knownTaxRates)) {
      if (rate == null) continue
      const score = Math.max(
        fuzzyScore(name, tax.name),
        fuzzyScore(tax.name, name)
      )
      if (!best || score > best.score) best = { name, rate, score }
    }
    if (best && best.score >= 0.6) {
      const original = tax.rate
      tax.rate = best.rate
      // Preserve the document's original rate so the client can warn about
      // the mismatch (comparing after the override would find nothing)
      if (original != null && original !== best.rate) {
        tax.rate_document = original
      }
    }
  }
  return data
}

/**
 * Derives tax rates that the AI could not determine (tax shown only as a line
 * item amount, e.g. "PBBKB SOLAR ... 38,880,000"). The tax may actually be a
 * per-litre fee quoted in rupiah (1,215/18,950 = 6.41%), so the rate rarely
 * round-trips exactly. Tries plausible bases (pre-discount product,
 * after-discount, incl. delivery) and picks the cleanest rate (closest to a
 * 0.5% step), preferring the product-only base on ties.
 */
function deriveMissingTaxRates(data: ExtractedSO): ExtractedSO {
  if (!data.taxes || !data.quantity || !data.unit_price) return data

  const priceSubtotal = data.quantity * data.unit_price
  const afterDiscount = Math.max(
    0,
    priceSubtotal * (1 - (data.discount_percent ?? 0) / 100)
  )
  const deliveryTotal = data.delivery_price_per_litre
    ? data.delivery_price_per_litre * data.quantity
    : (data.delivery_price_total ?? 0)

  const bases = [priceSubtotal, afterDiscount, afterDiscount + deliveryTotal]

  for (const tax of data.taxes) {
    if (tax.rate != null || tax.amount == null || !tax.amount) continue
    let best: { rate: number; cleanliness: number } | null = null
    for (const base of bases) {
      if (base <= 0) continue
      const rate = Math.round((tax.amount / base) * 10000) / 100
      if (rate <= 0 || rate > 25) continue
      // "Cleaner" rates (3%, 7.5%, 11%) are likelier than 6.4116% — but any
      // valid rate beats leaving it null. Prefer earliest base on ties.
      const cleanliness = Math.abs(rate - Math.round(rate * 2) / 2)
      if (!best || cleanliness < best.cleanliness) {
        best = { rate, cleanliness }
      }
    }
    if (best) tax.rate = best.rate
  }
  return data
}

/**
 * Determines whether the delivery cost is subject to PPN by VERIFYING the
 * document's PPN amount against both candidate tax bases:
 *   with delivery:    PPN = (price - discount + OAT) * rate
 *   without delivery: PPN = (price - discount) * rate
 * The matching formula wins. Falls back to the AI's stated delivery_taxable
 * when the numbers don't match either base (or when inputs are missing).
 * Mirrors the SO form's totals logic (taxable = afterDiscount + delivery if taxable).
 */
function inferDeliveryTaxable(data: ExtractedSO): ExtractedSO {
  const stated = data.delivery_taxable
  // Only the PPN row drives this decision — never PBBKB or combined labels
  const ppn = data.taxes?.find(
    (t) => /ppn/i.test(t.name) && !/pbbkb/i.test(t.name)
  )
  if (
    !ppn ||
    ppn.amount == null ||
    !ppn.rate ||
    !data.quantity ||
    !data.unit_price
  ) {
    data.delivery_taxable = stated ?? null
    return data
  }

  const priceSubtotal = Math.max(
    0,
    data.quantity * data.unit_price * (1 - (data.discount_percent ?? 0) / 100)
  )
  const deliveryTotal = data.delivery_price_per_litre
    ? data.delivery_price_per_litre * data.quantity
    : (data.delivery_price_total ?? 0)

  const withDelivery = Math.round(
    ((priceSubtotal + deliveryTotal) * ppn.rate) / 100
  )
  const withoutDelivery = Math.round((priceSubtotal * ppn.rate) / 100)

  // Tolerance: rupiah rounding differences
  const tol = 1
  const matchesWith = Math.abs(ppn.amount - withDelivery) <= tol
  const matchesWithout = Math.abs(ppn.amount - withoutDelivery) <= tol

  if (matchesWith && !matchesWithout) data.delivery_taxable = true
  else if (matchesWithout && !matchesWith) data.delivery_taxable = false
  else data.delivery_taxable = stated ?? null
  return data
}

/**
 * Tolerant JSON extraction — handles models that wrap JSON in markdown fences
 * or prepend explanation text despite instructions.
 */
function parseModelJson(text: string): ExtractedSO {
  let cleaned = text.trim()
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch) cleaned = fenceMatch[1].trim()

  const start = cleaned.indexOf("{")
  const end = cleaned.lastIndexOf("}")
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("AI response did not contain a JSON object.")
  }
  const parsed = JSON.parse(cleaned.slice(start, end + 1))
  return parsed as ExtractedSO
}

/**
 * Last-resort guard: if the AI returned OUR company (the supplier) as the
 * customer, null it out with a warning. Runs on every extraction, so this
 * bug can never reach the form even if the model ignores the prompt.
 */
function stripSupplierAsCompany(
  data: ExtractedSO,
  supplierName?: string | null
): ExtractedSO {
  if (
    supplierName &&
    data.company_name &&
    Math.max(
      fuzzyScore(supplierName, data.company_name),
      fuzzyScore(data.company_name, supplierName)
    ) >= 0.6
  ) {
    data.warnings = [
      ...(data.warnings || []),
      "The AI returned the supplier name as the customer company — removed automatically. Select the customer manually.",
    ]
    data.company_name = null
    data.confidence = {
      ...(data.confidence || {}),
      company_name: "low",
    }
  }
  return data
}

/**
 * Reasoning models (gpt-5*, o1/o3/o4*) reject `temperature` and consume the
 * token budget with internal reasoning — both requests must account for that.
 */
function isReasoningModel(model: string) {
  return /(^|\/)(o\d|gpt-5)/i.test(model)
}

export async function extractSOFromFiles(
  files: ExtractedFile[],
  supplierName?: string | null,
  knownTaxRates?: Record<string, number>
): Promise<{ data: ExtractedSO; raw: string }> {
  const apiKey = process.env.AI_API_KEY
  const model = process.env.AI_MODEL

  if (process.env.AI_PROVIDER !== "openrouter") {
    throw new Error(
      "AI_PROVIDER must be set to 'openrouter' in environment variables."
    )
  }
  if (!apiKey) throw new Error("AI_API_KEY is not configured.")
  if (!model) throw new Error("AI_MODEL is not configured.")

  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://nids.local",
      "X-Title": "Nexus Integrated Distribution System",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "Extract the Sales Order fields from the attached document(s) and respond with only the JSON object." +
                (supplierName
                  ? ` IMPORTANT: Our company is "${supplierName}" — we are the SUPPLIER receiving this Purchase Order. company_name must be the OTHER party (the customer issuing the PO), NEVER "${supplierName}" and never any name that matches it. The customer may appear in the letterhead, an addressee block ("Kepada"/"Yth"/"To"), or a header field — layouts vary. If the only company you can find is "${supplierName}", return null for company_name and add a warning.`
                  : ""),
            },
            ...buildFileParts(files),
          ],
        },
      ],
      max_tokens: 4000,
      ...(isReasoningModel(model) ? {} : { temperature: 0 }),
    }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => "")
    throw new Error(
      `AI provider error (${response.status}): ${body.slice(0, 500)}`
    )
  }

  const result = await response.json()
  const content: string | undefined = result?.choices?.[0]?.message?.content
  if (!content) {
    throw new Error("AI provider returned an empty response.")
  }

  const parsed = parseModelJson(content)
  console.log("[AI Extract] raw model response:", content)
  const processed = stripSupplierAsCompany(
    inferDeliveryTaxable(
      deriveDiscountPercent(
        applyKnownTaxRates(
          deriveMissingTaxRates(normalizeExtractedNumbers(parsed)),
          knownTaxRates
        )
      )
    ),
    supplierName
  )
  console.log(
    "[AI Extract] after server processing:",
    JSON.stringify(processed, null, 2)
  )
  return { data: processed, raw: content }
}

/**
 * Bilingual message catalog for the deterministic audit. Field names stay in
 * English (they are schema keys); the explanation text is localized.
 */
const AUDIT_MESSAGES = {
  en: {
    productTotal: (stated: string, computed: string, diff: string) =>
      `product_total mismatch: stated ${stated}, computed quantity x unit_price = ${computed} (diff ${diff})`,
    discount: (
      amount: string,
      percent: number,
      total: string,
      computed: string,
      diff: string
    ) =>
      `discount mismatch: amount ${amount} vs ${percent}% x product_total = ${computed} (diff ${diff})`,
    tax: (
      name: string,
      amount: string,
      rate: number,
      candidates: string
    ) =>
      `${name} mismatch: amount ${amount} does not match ${rate}% of any plausible base (expected ${candidates})`,
    taxStatedRate: (
      name: string,
      docRate: number,
      systemRate: number
    ) =>
      `${name}: document states ${docRate}% but the amount corresponds to ${systemRate}% (system rate kept)`,
    grandTotal: (stated: string, computed: string, diff: string) =>
      `grand_total mismatch: stated ${stated}, computed base price - discount (+ tolerance) + taxes + delivery = ${computed} (diff ${diff})`,
    delivery: (stated: string, computed: string) =>
      `delivery_price_total mismatch: stated ${stated}, computed delivery_price_per_litre x quantity = ${computed}`,
    dateOrder: (delivery: string, so: string) =>
      `delivery_date (${delivery}) is earlier than so_date (${so})`,
    outOfRange: (field: string, value: number, min: number, max: number) =>
      `${field} out of range: ${value} (expected ${min}-${max})`,
    notPositive: (field: string, value: number) =>
      `${field} must be greater than 0 (got ${value})`,
  },
  id: {
    productTotal: (stated: string, computed: string, diff: string) =>
      `product_total tidak cocok: tertulis ${stated}, dihitung quantity x unit_price = ${computed} (selisih ${diff})`,
    discount: (
      amount: string,
      percent: number,
      total: string,
      computed: string,
      diff: string
    ) =>
      `discount_amount tidak cocok: tertulis ${amount}, dihitung ${percent}% x product_total = ${computed} (selisih ${diff})`,
    tax: (name: string, amount: string, rate: number, candidates: string) =>
      `${name} tidak cocok: amount ${amount} tidak sesuai ${rate}% dari dasar perhitungan manapun (seharusnya ${candidates})`,
    taxStatedRate: (name: string, docRate: number, systemRate: number) =>
      `${name}: dokumen menyebut ${docRate}% tetapi jumlahnya sesuai ${systemRate}% (rate sistem yang dipakai)`,
    grandTotal: (stated: string, computed: string, diff: string) =>
      `grand_total tidak cocok: tertulis ${stated}, dihitung harga dasar - diskon (+ susut) + pajak + delivery = ${computed} (selisih ${diff})`,
    delivery: (stated: string, computed: string) =>
      `delivery_price_total tidak cocok: tertulis ${stated}, dihitung delivery_price_per_litre x quantity = ${computed}`,
    dateOrder: (delivery: string, so: string) =>
      `delivery_date (${delivery}) lebih awal dari so_date (${so})`,
    outOfRange: (field: string, value: number, min: number, max: number) =>
      `${field} di luar rentang: ${value} (seharusnya ${min}-${max})`,
    notPositive: (field: string, value: number) =>
      `${field} harus lebih dari 0 (ditemukan ${value})`,
  },
}

/**
 * Deterministic audit of EVERY extracted field — the code counterpart of
 * verifyExtraction. Exact math with tolerance (±2 Rp or ±0.5%):
 *   1. product_total vs quantity x unit_price
 *   2. discount_amount vs discount_percent x product_total
 *   3. each tax amount vs its rate (PPN: product-only or +delivery base;
 *      PBBKB: product-only base only)
 *   4. grand_total rebuilt from base price - discount (+ nominal shrinkage
 *      tolerance) + taxes + delivery — NEVER from the extracted subtotal,
 *      since customers define subtotal differently
 *   5. delivery_price_total vs delivery_price_per_litre x quantity
 *   6. sanity ranges: discount/shrinkage percent 0-100, tax rate 0-100,
 *      quantity and unit_price positive, delivery_date not before so_date
 * Messages are localized via the language parameter. Also returns the list of
 * schema field names involved in failed checks (flaggedFields) so the client
 * can mark the corresponding form controls.
 */
export function auditArithmetic(
  data: ExtractedSO,
  language: "en" | "id" = "en"
): { warnings: string[]; flaggedFields: string[] } {
  const warnings: string[] = []
  const flaggedFields: string[] = []
  const flag = (...fields: string[]) => flaggedFields.push(...fields)
  const msg = AUDIT_MESSAGES[language]
  const fmt = (n: number) =>
    n.toLocaleString(language === "id" ? "id-ID" : "en-US")
  const TOL_ABS = 2

  const consistent = (actual: number, expected: number) => {
    if (expected === 0) return Math.abs(actual) <= TOL_ABS
    return (
      Math.abs(actual - expected) <= TOL_ABS ||
      Math.abs(actual - expected) <= Math.abs(expected) * 0.005
    )
  }

  const qty = data.quantity
  const price = data.unit_price
  // EVERY check is computed from PRIMITIVE fields only (quantity, unit_price,
  // discount, tax amounts, delivery) — never from AI-aggregated values like
  // product_total or subtotal, which the model may have filled with the wrong
  // table column (e.g. a "Total Before Discount" that already includes taxes
  // and delivery line items).
  const base = qty != null && price != null ? qty * price : null
  const discountAmount =
    data.discount_amount ??
    (data.discount_percent != null && base != null
      ? Math.round((data.discount_percent / 100) * base)
      : null)
  const afterDiscount =
    base != null && discountAmount != null ? base - discountAmount : null
  const productBase = afterDiscount

  // 1. product_total vs quantity x unit_price
  if (data.product_total != null && qty != null && price != null) {
    const computed = qty * price
    if (!consistent(data.product_total, computed)) {
      flag("product_total", "quantity", "unit_price")
      warnings.push(
        msg.productTotal(
          fmt(data.product_total),
          fmt(computed),
          fmt(data.product_total - computed)
        )
      )
    }
  }

  // 2. discount_amount vs discount_percent x product_total
  if (
    data.discount_amount != null &&
    data.discount_percent != null &&
    data.product_total != null
  ) {
    const computed = Math.round(
      (data.discount_percent / 100) * data.product_total
    )
    if (!consistent(data.discount_amount, computed)) {
      flag("discount_percent", "discount_amount")
      warnings.push(
        msg.discount(
          fmt(data.discount_amount),
          data.discount_percent,
          fmt(data.product_total),
          fmt(computed),
          fmt(data.discount_amount - computed)
        )
      )
    }
  }

  // 3. tax amounts vs rates (base depends on the tax)
  const deliveryTotal =
    data.delivery_price_per_litre != null && qty != null
      ? data.delivery_price_per_litre * qty
      : (data.delivery_price_total ?? null)

  if (data.taxes && productBase != null && productBase > 0) {
    for (const tax of data.taxes) {
      if (tax.rate == null || tax.amount == null) continue
      const isPpn = /ppn/i.test(tax.name) && !/pbbkb/i.test(tax.name)
      const bases = isPpn
        ? [productBase, productBase + (deliveryTotal ?? 0)]
        : [productBase]
      const matches = bases.some((base) =>
        consistent(tax.amount!, Math.round((base * tax.rate!) / 100))
      )
      if (!matches) {
        flag("taxes")
        const candidates = bases
          .map((b) => `${fmt(Math.round((b * tax.rate!) / 100))}`)
          .join(language === "id" ? " atau " : " or ")
        warnings.push(
          msg.tax(tax.name, fmt(tax.amount), tax.rate, candidates)
        )
      }
      // Tax rate sanity range
      if (tax.rate != null && (tax.rate < 0 || tax.rate > 100)) {
        flag("taxes")
        warnings.push(msg.outOfRange(`tax rate (${tax.name})`, tax.rate, 0, 100))
      }
      // Document's own stated rate (preserved as rate_document when the DB
      // rate overrode it): if the amount doesn't match the DOCUMENT's rate on
      // any base, the document itself is internally inconsistent
      if (
        tax.rate_document != null &&
        tax.rate_document !== tax.rate &&
        tax.amount != null
      ) {
        const docBases = isPpn
          ? [productBase, productBase + (deliveryTotal ?? 0)]
          : [productBase]
        const docMatches = docBases.some((b) =>
          consistent(tax.amount!, Math.round((b * tax.rate_document!) / 100))
        )
        if (!docMatches) {
          flag("taxes")
          warnings.push(
            msg.taxStatedRate(tax.name, tax.rate_document, tax.rate!)
          )
        }
      }
    }
  }

  // 4. grand_total — rebuilt from base price - discount (+ nominal shrinkage
  //    tolerance) + taxes + delivery. NEVER from the extracted subtotal,
  //    since customers define subtotal differently.
  if (
    data.grand_total != null &&
    afterDiscount != null &&
    data.taxes &&
    deliveryTotal != null
  ) {
    const taxSum = data.taxes.reduce((sum, t) => sum + (t.amount ?? 0), 0)
    // Nominal shrinkage tolerance added to the price (shrinkage_in_price)
    const shrinkage =
      data.shrinkage_tolerance != null && data.shrinkage_tolerance > 0
        ? (afterDiscount * data.shrinkage_tolerance) / 100
        : 0
    const candidates = [
      afterDiscount + taxSum + deliveryTotal,
      afterDiscount + shrinkage + taxSum + deliveryTotal,
    ]
    if (!candidates.some((c) => consistent(data.grand_total!, c))) {
      flag("grand_total")
      warnings.push(
        msg.grandTotal(
          fmt(data.grand_total),
          fmt(Math.round(candidates[0])),
          fmt(data.grand_total - candidates[0])
        )
      )
    }
  }

  // 5. delivery_price_total vs delivery_price_per_litre x quantity
  if (
    data.delivery_price_total != null &&
    data.delivery_price_per_litre != null &&
    qty != null
  ) {
    const computed = data.delivery_price_per_litre * qty
    if (!consistent(data.delivery_price_total, computed)) {
      flag("delivery_price_total", "delivery_price_per_litre")
      warnings.push(
        msg.delivery(fmt(data.delivery_price_total), fmt(computed))
      )
    }
  }

  // 6. sanity ranges and date order
  if (data.discount_percent != null &&
      (data.discount_percent < 0 || data.discount_percent > 100)) {
    flag("discount_percent")
    warnings.push(
      msg.outOfRange("discount_percent", data.discount_percent, 0, 100)
    )
  }
  if (data.shrinkage_tolerance != null &&
      (data.shrinkage_tolerance < 0 || data.shrinkage_tolerance > 100)) {
    flag("shrinkage_tolerance")
    warnings.push(
      msg.outOfRange("shrinkage_tolerance", data.shrinkage_tolerance, 0, 100)
    )
  }
  if (qty != null && qty <= 0) {
    flag("quantity")
    warnings.push(msg.notPositive("quantity", qty))
  }
  if (price != null && price <= 0) {
    flag("unit_price")
    warnings.push(msg.notPositive("unit_price", price))
  }
  if (data.so_date && data.delivery_date) {
    const so = new Date(data.so_date)
    const delivery = new Date(data.delivery_date)
    if (!isNaN(so.getTime()) && !isNaN(delivery.getTime()) && delivery < so) {
      flag("delivery_date", "so_date")
      warnings.push(msg.dateOrder(data.delivery_date, data.so_date))
    }
  }

  return { warnings, flaggedFields }
}

const VERIFICATION_PROMPT = `You are auditing Purchase Order data that was extracted from a document into JSON.
Your ONLY job is to check the ARITHMETIC CONSISTENCY between the numbers. Do not re-read any
document; work exclusively with the JSON provided.

Checks (compare the STATED numbers against each other — do not recompute from scratch unless
a stated value is missing):
1. product_total vs quantity x unit_price (small rounding differences are acceptable)
2. subtotal vs product_total - discount_amount
3. grand_total vs subtotal + sum of taxes amounts + delivery fee
   (delivery fee = delivery_price_total, or delivery_price_per_litre x quantity when only
   the per-litre rate is given)
4. each tax amount vs its stated rate: which base the rate applies to depends on the tax:
   - PPN may apply to the product-only base OR to product + delivery base — BOTH are
     legitimate. Flag PPN ONLY if its amount matches neither base.
   - PBBKB NEVER includes the delivery fee — its base is product-only. Flag PBBKB if its
     amount can only be explained by a base that includes the delivery fee.
   (allow ±2 rupiah or ±0.5% tolerance)
5. a shrinkage tolerance may be stated as a NOMINAL value (litres or currency) rather than a
   percentage, and suppliers may include such a nominal compensation in the product price.
   Do not flag small differences that this could explain — instead mention it in a warning
   so the user knows a nominal tolerance is involved.

Rules:
- SKIP any check whose required values are null/missing.
- All amounts are IDR: whole numbers, no decimals.
- If everything reconciles, return an EMPTY warnings array. Do NOT invent issues.
- Do NOT warn about missing optional fields, formatting, or interpretation choices — another
  system already handles those.
- Each warning must be simple, just state whats wrong do not include too many numbers or making the message too long.

Respond with ONLY this JSON — no markdown fences, no explanations:
{"warnings": ["..."]}`

/**
 * Second AI pass: audits the extracted data for arithmetic mismatches
 * (subtotals, taxes, grand total). Text-only JSON in / JSON out — much more
 * reliable than checking math while reading a PDF. Warnings are written in
 * the interface language so they can be shown to the user as-is.
 */
export async function verifyExtraction(
  data: ExtractedSO,
  language: "en" | "id" = "en"
): Promise<string[]> {
  const apiKey = process.env.AI_API_KEY
  // Auditing is a small text-only request — a separate smarter model can be
  // configured via AI_VERIFY_MODEL without changing the extraction model
  const model = process.env.AI_VERIFY_MODEL || process.env.AI_MODEL

  if (process.env.AI_PROVIDER !== "openrouter") {
    throw new Error(
      "AI_PROVIDER must be set to 'openrouter' in environment variables."
    )
  }
  if (!apiKey) throw new Error("AI_API_KEY is not configured.")
  if (!model) throw new Error("AI_MODEL is not configured.")

  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://nids.local",
      "X-Title": "Nexus Integrated Distribution System",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: VERIFICATION_PROMPT },
        {
          role: "user",
          content:
            `Audit this extracted Purchase Order data for arithmetic mismatches. ` +
            `Write every warning message in ${
              language === "id" ? "Bahasa Indonesia" : "English"
            }. JSON:\n\n` +
            JSON.stringify(data, null, 2),
        },
      ],
      // Reasoning models spend part of this budget on internal reasoning
      max_tokens: 4000,
      ...(isReasoningModel(model) ? {} : { temperature: 0 }),
    }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => "")
    throw new Error(
      `AI verification error (${response.status}): ${body.slice(0, 500)}`
    )
  }

  const result = await response.json()
  const content: string | undefined = result?.choices?.[0]?.message?.content
  console.log("[AI Verify] raw response:", content ?? "(empty)")
  if (!content) {
    throw new Error(
      "AI verification returned an empty response (reasoning may have exhausted the token budget)."
    )
  }

  // Tolerant parse — same strategy as the extraction response
  let cleaned = content.trim()
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch) cleaned = fenceMatch[1].trim()
  const start = cleaned.indexOf("{")
  const end = cleaned.lastIndexOf("}")
  if (start === -1 || end === -1 || end <= start) return []
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1))
    return Array.isArray(parsed?.warnings) ? parsed.warnings : []
  } catch {
    return []
  }
}
