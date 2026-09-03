import { NextResponse } from "next/server"
import {
  auditArithmetic,
  extractSOFromFiles,
  validateFiles,
  // verifyExtraction, // LLM verifier — kept for future use if code checks
  //                   // become insufficient; see commented block below
  type ExtractedFile,
} from "@/lib/ai-provider"

export async function POST(request: Request) {
  const handlerStart = performance.now()
  try {
    const uploadStart = performance.now()
    const formData = await request.formData()
    const uploadMs = Math.round(performance.now() - uploadStart)

    // Interface language — used for audit warning messages
    const language =
      formData.get("language") === "id"
        ? "id"
        : formData.get("language") === "en"
          ? "en"
          : "en"

    const files = formData.getAll("files").filter((f): f is File => f instanceof File)

    const validationError = validateFiles(
      files.map((f) => ({ name: f.name, type: f.type, size: f.size }))
    )
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    const extractedFiles: ExtractedFile[] = await Promise.all(
      files.map(async (f) => ({
        name: f.name,
        mimeType: f.type,
        data: Buffer.from(await f.arrayBuffer()),
      }))
    )

    let knownTaxRates: Record<string, number> | undefined
    const rawTaxRates = formData.get("tax_rates")
    if (typeof rawTaxRates === "string" && rawTaxRates) {
      try {
        knownTaxRates = JSON.parse(rawTaxRates)
      } catch {
        // ignore malformed payload; extraction proceeds without known rates
      }
    }

    const { data, raw } = await extractSOFromFiles(
      extractedFiles,
      (formData.get("supplier_name") as string | null) || null,
      knownTaxRates
    )

    // Deterministic code audit — instant, exact math, bilingual messages
    const codeStart = performance.now()
    const { warnings: codeWarnings, flaggedFields: codeFlaggedFields } =
      auditArithmetic(data, language)
    const codeMs = Math.round(performance.now() - codeStart)

    // // LLM verifier — disabled for now (code audit covers the arithmetic
    // // checks; re-enable if verification needs semantic reasoning).
    // let verificationWarnings: string[] = []
    // let verificationError: string | null = null
    // const llmStart = performance.now()
    // try {
    //   verificationWarnings = await verifyExtraction(data, language)
    // } catch (err) {
    //   // Verification is best-effort — extraction result still stands, but the
    //   // failure must be visible to the user, never silent
    //   console.error("API AI Verify Error:", err)
    //   verificationError =
    //     err instanceof Error ? err.message : "Arithmetic verification failed."
    // }
    // const llmMs = Math.round(performance.now() - llmStart)
    const totalMs = Math.round(performance.now() - handlerStart)
    console.log(
      `[AI Extract] timings: upload+parse ${uploadMs}ms | AI extraction ~${totalMs - uploadMs - codeMs}ms | code verifier ${codeMs}ms | total ${totalMs}ms (${codeWarnings.length} warnings)`
    )

    return NextResponse.json({
      data,
      debug: { raw },
      code_warnings: codeWarnings,
      code_flagged_fields: codeFlaggedFields,
      // verification_warnings: verificationWarnings,
      // verification_error: verificationError,
      timings: {
        upload_parse_ms: uploadMs,
        code_ms: codeMs,
        total_ms: totalMs,
      },
    })
  } catch (err) {
    console.error("API AI Extract SO Error:", err)
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to extract data from documents.",
      },
      { status: 500 }
    )
  }
}
