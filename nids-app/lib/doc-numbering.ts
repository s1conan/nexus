// Document numbering format preview.
// Mirrors the placeholder handling of the DB function behind
// generate_document_number (see setup_document_numbering.sql).

export function previewNumberFormat(template: string): string {
  if (!template) return ""
  const now = new Date()
  let res = template
  res = res.replace("{YYYY}", now.getFullYear().toString())
  res = res.replace("{YY}", now.getFullYear().toString().slice(-2))
  res = res.replace("{MM}", (now.getMonth() + 1).toString().padStart(2, "0"))
  res = res.replace(
    "{MMM}",
    now.toLocaleString("default", { month: "short" }).toUpperCase()
  )
  res = res.replace("{DD}", now.getDate().toString().padStart(2, "0"))

  // Sample placeholders for company/supplier codes
  res = res.replace("{CUS}", "XXX")
  res = res.replace("{SUP}", "XXX")

  // {SEQ:N} or {SEQ:N,Y|M|D} — N = zero padding
  const seqMatch = res.match(/\{SEQ:([0-9]+)(?:,([YMD]))?\}/)
  if (seqMatch) {
    const padding = parseInt(seqMatch[1])
    res = res.replace(seqMatch[0], "1".padStart(padding, "0"))
  }
  return res
}
