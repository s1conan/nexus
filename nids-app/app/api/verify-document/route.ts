import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

export async function POST(request: Request) {
  try {
    const { uuid, number, type } = await request.json()

    if (!uuid || !number || !type) {
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
        select: `
          id,
          quotation_number,
          quotation_date,
          expiry_date,
          delivery_address,
          base_price,
          delivery_price,
          minimum_order,
          shrinkage_tolerance,
          content,
          discounts,
          note,
          terms_conditions,
          closing_remarks,
          bank_accounts,
          is_content_enabled,
          is_note_enabled,
          is_terms_enabled,
          is_closing_enabled,
          company:companies(name, details),
          product:products(sku, name, base_price)
        `,
      },
      // Placeholders for future types
      invoice: {
        table: "invoices",
        numberField: "invoice_number",
        select: "*",
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

    if (sanitize((document as any)[docConfig.numberField]) === sanitizedInput) {
      // Also fetch company settings since the public client can't access them
      const { data: settings } = await supabaseAdmin
        .from("app_settings")
        .select("*")
        .eq("category", "company")

      const companyInfo: any = {}
      settings?.forEach((r: any) => {
        companyInfo[r.name] = r.value
      })

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
