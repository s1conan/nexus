/**
 * AI provider configuration and extraction logic for Sales Order documents.
 * Uses OpenRouter (OpenAI-compatible chat completions) so any model can be
 * selected via env vars. Server-side only — never expose AI_API_KEY to client.
 */

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
  unit_price: number | null
  currency: string | null
  term_of_payment: string | null
  discount_percent: number | null
  delivery_address: string | null
  note: string | null
  taxes: { name: string; rate: number }[] | null
  confidence: Record<string, string> | null
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
Read ALL attached documents and merge their information into a single result. If documents
conflict, prefer the most recent amendment and add a warning.

Extract the following fields and respond with ONLY a valid JSON object — no markdown fences,
no explanations, no extra text:

{
  "po_number": "customer PO number, or null",
  "company_name": "customer/company name issuing the PO, or null",
  "product_description": "product or service description, or null",
  "product_sku": "product SKU/code if present, or null",
  "so_date": "SO/PO issue date as YYYY-MM-DD, or null",
  "delivery_date": "requested delivery date as YYYY-MM-DD, or null",
  "quantity": "numeric quantity, or null",
  "unit_price": "numeric price per unit/litre, or null",
  "currency": "ISO currency code e.g. IDR, or null",
  "term_of_payment": "payment terms e.g. 'COD', 'Net 30', or null",
  "discount_percent": "numeric discount percentage, or null",
  "delivery_address": "full delivery/shipping address, or null",
  "note": "any additional relevant notes or special instructions, or null",
  "taxes": [{"name": "tax name e.g. PPN", "rate": 11}] or null,
  "confidence": {"field_name": "high|medium|low", "...": "..."},
  "warnings": ["list anything ambiguous, missing, or conflicting"]
}

Rules:
- Dates MUST be ISO format (YYYY-MM-DD). Convert formats like "05/03/2026" carefully and add a
  warning if day/month order is ambiguous.
- Numbers MUST be plain numbers: no thousand separators, no currency symbols, no units.
  "1.500.000" means 1500000. "Rp 2.500/liter" means unit_price 2500.
- If a field is not found in any document, use null. NEVER guess or invent values.
- Prices are per-litre where the product is liquid (fuel, chemicals) unless stated otherwise.
- For every field you extract, include a confidence entry ("high", "medium", or "low").
- Add a warning for anything ambiguous, illegible, or conflicting between documents.`

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

export async function extractSOFromFiles(
  files: ExtractedFile[]
): Promise<ExtractedSO> {
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
      "HTTP-Referer":
        process.env.NEXT_PUBLIC_APP_URL || "https://nids.local",
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
              text: "Extract the Sales Order fields from the attached document(s) and respond with only the JSON object.",
            },
            ...buildFileParts(files),
          ],
        },
      ],
      max_tokens: 2000,
      temperature: 0,
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

  return parseModelJson(content)
}
