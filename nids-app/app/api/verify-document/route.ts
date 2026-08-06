import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import {
  getQuotationCanonicalData,
  getInvoiceCanonicalData,
  computeHashServer,
  canonicalSerialize,
} from "@/lib/document-hash"

export async function POST(request: Request) {
  try {
    const { uuid, number, type, hash } = await request.json()

    if (!uuid || (!number && !hash) || !type) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    const sanitize = (str: string) =>
      str.replace(/[^a-zA-Z0-9]/g, "").toLowerCase()
    const sanitizedInput = sanitize(number)

    // Configuration for different document types
    const config: Record<
      string,
      { table: string; select: string; numberField: string }
    > = {
      quotation: {
        table: "quotations",
        numberField: "quotation_number",
        // Must match the shape passed to the PDF generator at generation time
        // (see app/quotations/page.tsx) so the computed hash matches the QR hash.
        select: `
          *,
          company:companies(id, name, details),
          product:products(id, sku, name, base_price)
        `,
      },
      invoice: {
        table: "invoices",
        numberField: "invoice_number",
        // Must match the shape passed to the PDF generator at generation time
        // (see app/invoice/page.tsx) so the computed hash matches the QR hash.
        select: `
          *,
          company:companies(id, name),
          do:delivery_orders(id, do_number, do_date, shipment_date, delivered_date, quantity, received_quantity, product:products(id, name, sku), so:sales_orders(id, so_number, unit_price, delivery_price_per_litre, discount, tax_details, shrinkage_tolerance, delivery_taxable)),
          po:sales_orders(id, so_number, tax_details)
        `,
      },
      "delivery-order": {
        table: "delivery_orders",
        numberField: "do_number",
        select: "*",
      },
      payment: {
        table: "payments",
        numberField: "payment_number",
        select: `
          id,
          payment_number,
          payment_date,
          amount,
          payment_method,
          reference_number,
          note,
          invoice:invoices(id, invoice_number, bank_accounts, company:companies(name, details))
        `,
      },
    }

    const docConfig = config[type]
    if (!docConfig) {
      return NextResponse.json(
        { error: "Invalid document type" },
        { status: 400 }
      )
    }

    // Use admin client to bypass RLS for this specific public verification task
    const { data: document, error } = await supabaseAdmin
      .from(docConfig.table)
      .select(docConfig.select)
      .eq("id", uuid)
      .single()

    if (error || !document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    const numberMatches =
      sanitize((document as any)[docConfig.numberField]) === sanitizedInput
    const skipNumberCheck = !!hash && !number

    if (numberMatches || skipNumberCheck) {
      // Also fetch company settings since the public client can't access them
      const { data: settings } = await supabaseAdmin
        .from("app_settings")
        .select("*")
        .eq("category", "company")

      const companyInfo: any = {}
      settings?.forEach((r: any) => {
        companyInfo[r.name] = r.value
      })

      // Hash verification for supported document types (additive — only when hash provided)
      if (hash && (type === "quotation" || type === "invoice")) {
        try {
          const canonicalData =
            type === "quotation"
              ? getQuotationCanonicalData(document as unknown as Record<string, unknown>)
              : getInvoiceCanonicalData(document as unknown as Record<string, unknown>)
          const hashComputed = computeHashServer(
            canonicalSerialize(canonicalData)
          )
          const hashMatch = hashComputed === hash

          const response: Record<string, unknown> = {
            success: true,
            hashMatch,
            document,
            companyInfo,
            hashProvided: hash,
            hashComputed,
          }
          if (!hashMatch) {
            response.hashWarning =
              "Document data may have been modified since this QR code was generated."
          }
          return NextResponse.json(response)
        } catch (err: unknown) {
          return NextResponse.json({
            success: true,
            hashMatch: false,
            document,
            companyInfo,
            hashError:
              err instanceof Error ? err.message : "Hash computation failed",
          })
        }
      }

      return NextResponse.json({ success: true, document, companyInfo })
    } else {
      return NextResponse.json(
        { error: "Invalid document number" },
        { status: 401 }
      )
    }
  } catch (err: any) {
    console.error("API Verify Document Error:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
