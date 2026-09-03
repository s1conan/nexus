"use client"

import { useRef, useState } from "react"
import { useDictionary } from "@/components/dictionary-provider"
import { SITE_CONFIG } from "@/lib/site-content"
import { createClient } from "@/lib/supabase"
import {
  autoMatchSO,
  type ExtractedSOData,
  type SOAutoMatch,
} from "@/lib/so-auto-match"
import { notify } from "@/lib/notifications"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ButtonLoader } from "@/components/button-loader"
import {
  FileText,
  Sparkles,
  Trash2,
  Upload,
  AlertCircle,
  Info,
} from "lucide-react"
import { cn } from "@/lib/utils"

export type { ExtractedSOData, SOAutoMatch }

export type SOImportMeta = {
  warnings: string[]
  timings: {
    upload_parse_ms: number
    code_ms: number
    total_ms: number
  } | null
}

interface SOAIImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onApply: (
    data: ExtractedSOData,
    match: SOAutoMatch,
    meta?: SOImportMeta
  ) => void
  supplierName?: string
  globalTaxes?: { name: string; value: number }[]
}

const ACCEPTED_TYPES = "application/pdf,image/png,image/jpeg,image/webp"
const MAX_FILE_SIZE = 10 * 1024 * 1024
const MAX_FILES = 4

export function SOAIImportDialog({
  open,
  onOpenChange,
  onApply,
  supplierName,
  globalTaxes = [],
}: SOAIImportDialogProps) {
  const { dict, lang } = useDictionary()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [files, setFiles] = useState<File[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [extracted, setExtracted] = useState<ExtractedSOData | null>(null)
  const [match, setMatch] = useState<SOAutoMatch | null>(null)
  const [verificationWarnings, setVerificationWarnings] = useState<string[]>([])
  const [verificationFailed, setVerificationFailed] = useState(false)
  const [timings, setTimings] = useState<{
    upload_parse_ms: number
    code_ms: number
    total_ms: number
  } | null>(null)

  const reset = () => {
    setFiles([])
    setExtracted(null)
    setMatch(null)
    setVerificationWarnings([])
    setVerificationFailed(false)
    setTimings(null)
    setIsAnalyzing(false)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) reset()
    onOpenChange(nextOpen)
  }

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return
    const valid: File[] = []
    for (const file of Array.from(incoming)) {
      if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
        notify.error(
          dict.IMPORT_DOC_INVALID_TYPE_TITLE,
          `${file.name}: ${dict.IMPORT_DOC_INVALID_TYPE_DESC}`
        )
        continue
      }
      if (file.size > MAX_FILE_SIZE) {
        notify.error(
          dict.IMPORT_DOC_TOO_LARGE_TITLE,
          `${file.name}: ${dict.IMPORT_DOC_TOO_LARGE_DESC}`
        )
        continue
      }
      valid.push(file)
    }
    setFiles((prev) => [...prev, ...valid].slice(0, MAX_FILES))
  }

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleAnalyze = async () => {
    if (files.length === 0) return
    setIsAnalyzing(true)
    try {
      const formData = new FormData()
      files.forEach((file) => formData.append("files", file))
      if (supplierName) formData.append("supplier_name", supplierName)
      formData.append("language", lang)
      // DB tax rates — the server applies them so the audit verifies against
      // the system parameters (same as the drag-drop path)
      if (globalTaxes.length > 0) {
        formData.append(
          "tax_rates",
          JSON.stringify(
            Object.fromEntries(globalTaxes.map((gt) => [gt.name, gt.value]))
          )
        )
      }

      const res = await fetch("/api/ai/extract-so", {
        method: "POST",
        body: formData,
      })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || dict.IMPORT_DOC_FAILED_DESC)
      }

      const data = json.data as ExtractedSOData
      // Code-audit flagged fields ride along on the data so handleAIApply
      // can mark the corresponding form controls
      data.flagged_fields = [
        ...(data.flagged_fields ?? []),
        ...(Array.isArray(json.code_flagged_fields)
          ? json.code_flagged_fields
          : []),
      ]
      const matched = await autoMatchSO(supabase, data)

      // // Document tax rates vs DB parameters (which win) — warn on mismatch
      // // Superseded by the AI arithmetic verifier (verification_warnings)
      // setRateWarnings(computeTaxRateWarnings(data, globalTaxes))

      // Second AI pass: arithmetic audit of the extracted data
      setVerificationWarnings([
        ...(Array.isArray(json.code_warnings) ? json.code_warnings : []),
        ...(Array.isArray(json.verification_warnings)
          ? json.verification_warnings
          : []),
      ])
      setVerificationFailed(Boolean(json.verification_error))
      setTimings(json.timings ?? null)
      setMatch(matched)
      setExtracted(data)
    } catch (err) {
      notify.error(
        dict.IMPORT_DOC_FAILED_TITLE,
        err instanceof Error ? err.message : dict.IMPORT_DOC_FAILED_DESC
      )
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleApply = () => {
    if (!extracted) return
    // Carry the warnings + timings shown in this panel through to the page,
    // so the user still sees them as toasts after the dialog closes
    onApply(extracted, match || { company: null, product: null }, {
      warnings: [
        ...(extracted.warnings ?? []),
        ...verificationWarnings,
      ],
      timings,
    })
    reset()
  }

  const confidenceBadge = (field: string) => {
    const level = extracted?.confidence?.[field]
    if (!level) return null
    const styles: Record<string, string> = {
      high: "text-emerald-600 dark:text-emerald-400",
      medium: "text-amber-600 dark:text-amber-400",
      low: "text-red-600 dark:text-red-400",
    }
    return (
      <span
        className={cn(
          "ml-2 text-[10px] font-semibold uppercase",
          styles[level]
        )}
      >
        {level}
      </span>
    )
  }

  const formatValue = (value: string | number | null | undefined) =>
    value === null || value === undefined || value === "" ? "-" : String(value)

  const formatDuration = (ms: number) =>
    ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`

  const timingsDetail = timings
    ? dict
        .IMPORT_DOC_TIMINGS_DETAIL.replace(
          "%upload%",
          formatDuration(timings.upload_parse_ms)
        )
        .replace(
          "%ai%",
          formatDuration(
            Math.max(
              0,
              timings.total_ms - timings.upload_parse_ms - timings.code_ms
            )
          )
        )
        .replace("%verify%", formatDuration(timings.code_ms))
        .replace("%total%", formatDuration(timings.total_ms))
    : null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            <Sparkles className="mr-2 inline-block size-5" />
            {dict.IMPORT_DOC_TITLE}
          </DialogTitle>
          <p className="text-xs">{dict.IMPORT_DOC_DESCRIPTION}</p>
        </DialogHeader>

        {!extracted ? (
          <div className="space-y-4 p-6">
            <div
              className={cn(
                "flex flex-col items-center justify-center gap-2 border-3 border-dotted bg-secondary/10 p-6 text-center transition-colors"
              )}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                addFiles(e.dataTransfer.files)
              }}
            >
              <Upload className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {dict.IMPORT_DOC_DROP_HINT}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_TYPES}
                multiple
                className="hidden"
                onChange={(e) => {
                  addFiles(e.target.files)
                  e.target.value = ""
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                {dict.IMPORT_DOC_SELECT_FILES}
              </Button>
              <p className="text-xs text-muted-foreground">
                {dict.IMPORT_DOC_LIMITS}
              </p>
            </div>

            {files.length > 0 && (
              <div className="space-y-2">
                {files.map((file, idx) => (
                  <div
                    key={`${file.name}-${idx}`}
                    className="flex items-center justify-between rounded border bg-background p-2"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <FileText className="size-4 shrink-0 text-muted-foreground" />
                      <span className="truncate text-sm">{file.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {Math.round(file.size / 1024)} KB
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => removeFile(idx)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="max-h-[50vh] space-y-3 overflow-y-auto p-4">
            {((extracted.warnings && extracted.warnings.length > 0) ||
              verificationWarnings.length > 0 ||
              verificationFailed) && (
              <div className="space-y-1 rounded border border-amber-500/30 bg-amber-500/10 p-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-amber-600 dark:text-amber-400">
                  <AlertCircle className="size-4" />
                  {dict.IMPORT_DOC_WARNINGS}
                </div>
                <ul className="list-inside list-disc text-xs text-amber-700 dark:text-amber-300">
                  {(extracted.warnings || []).map((w, i) => (
                    <li key={`ai-${i}`}>{w}</li>
                  ))}
                  {verificationWarnings.map((w, i) => (
                    <li key={`verify-${i}`}>{w}</li>
                  ))}
                  {verificationFailed && (
                    <li key="verify-failed">{dict.IMPORT_DOC_VERIFY_FAILED}</li>
                  )}
                </ul>
              </div>
            )}

            {timingsDetail && (
              <div className="flex items-center gap-2 rounded border border-blue-500/30 bg-blue-500/10 p-2.5 text-xs text-blue-700 dark:text-blue-300">
                <Info className="size-4 shrink-0" />
                <span>
                  <span className="font-semibold">
                    {dict.IMPORT_DOC_TIMINGS}:
                  </span>{" "}
                  {timingsDetail}
                </span>
              </div>
            )}

            {[
              {
                label: dict.LABEL_SO_NUMBER?.replace("SO", "PO") || "PO Number",
                value: extracted.po_number,
                field: "po_number",
              },
              {
                label: dict.LABEL_COMPANY_NAME,
                value: match?.company?.name || extracted.company_name || "-",
                field: "company_name",
              },
              {
                label: dict.LABEL_SKU,
                value: match?.product
                  ? `${match.product.sku} - ${match.product.name}`
                  : extracted.product_description || "-",
                field: "product_description",
              },
              {
                label: dict.LABEL_SO_DATE,
                value: extracted.so_date,
                field: "so_date",
              },
              {
                label: dict.LABEL_DELIVERY_DATE,
                value: extracted.delivery_date,
                field: "delivery_date",
              },
              {
                label: dict.LABEL_QUANTITY,
                value: extracted.quantity,
                field: "quantity",
              },
              {
                label: dict.LABEL_UNIT_PRICE,
                value: extracted.unit_price,
                field: "unit_price",
              },
              {
                label: dict.LABEL_TERM_OF_PAYMENT,
                value: extracted.term_of_payment,
                field: "term_of_payment",
              },
              {
                label: dict.LABEL_DISCOUNTS,
                value:
                  extracted.discount_percent !== null
                    ? `${extracted.discount_percent}%`
                    : null,
                field: "discount_percent",
              },
              {
                label: dict.LABEL_DELIVERY_ADDRESS,
                value: extracted.delivery_address,
                field: "delivery_address",
              },
              {
                label: dict.LABEL_TRANSPORT_COST,
                value:
                  extracted.delivery_price_total !== null &&
                  extracted.delivery_price_total !== undefined
                    ? `${SITE_CONFIG.currencySymbol} ${extracted.delivery_price_total.toLocaleString()} (flat)`
                    : extracted.delivery_price_per_litre !== null &&
                        extracted.delivery_price_per_litre !== undefined
                      ? `${SITE_CONFIG.currencySymbol} ${extracted.delivery_price_per_litre.toLocaleString()} / L`
                      : null,
                field: "delivery_price_total",
              },
              {
                label: dict.LABEL_SHRINKAGE_TOLERANCE,
                value:
                  extracted.shrinkage_tolerance !== null &&
                  extracted.shrinkage_tolerance !== undefined
                    ? `${extracted.shrinkage_tolerance}%`
                    : null,
                field: "shrinkage_tolerance",
              },
              {
                label: dict.IMPORT_DOC_TAXES,
                value:
                  extracted.taxes && extracted.taxes.length > 0
                    ? extracted.taxes
                        .map(
                          (t) =>
                            `${t.name}${t.rate != null ? ` ${t.rate}%` : ""}${
                              t.amount != null
                                ? ` = ${SITE_CONFIG.currencySymbol} ${t.amount.toLocaleString()}`
                                : ""
                            }`
                        )
                        .join("; ")
                    : null,
                field: "taxes",
              },
              {
                label: dict.LABEL_DELIVERY_TAXABLE,
                value:
                  extracted.delivery_taxable === true
                    ? dict.IMPORT_DOC_TAXABLE_YES
                    : extracted.delivery_taxable === false
                      ? dict.IMPORT_DOC_TAXABLE_NO
                      : dict.IMPORT_DOC_TAXABLE_UNKNOWN,
                field: "delivery_taxable",
              },
            ].map((row) => {
              // Tint rows the AI was unsure about (amber) or that failed a
              // consistency check / were explicitly flagged (red)
              const isFlagged = (extracted.flagged_fields ?? []).includes(
                row.field
              )
              const isLow = extracted.confidence?.[row.field] === "low"
              return (
                <div
                  key={row.field}
                  className={cn(
                    "flex items-start justify-between gap-4 rounded border bg-background p-2 text-sm",
                    isFlagged &&
                      "border-red-500/40 bg-red-500/5 text-red-700 dark:text-red-300",
                    !isFlagged &&
                      isLow &&
                      "border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-300"
                  )}
                >
                  <span className="shrink-0 font-medium text-muted-foreground">
                    {row.label}
                    {confidenceBadge(row.field)}
                  </span>
                  <span className="text-right">{formatValue(row.value)}</span>
                </div>
              )
            })}

            {(match?.company || match?.product) && (
              <p className="text-xs text-muted-foreground">
                {dict.IMPORT_DOC_MATCHED_HINT}
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          {extracted ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setExtracted(null)}
              >
                {dict.BUTTON_BACK}
              </Button>
              <Button type="button" onClick={handleApply}>
                <Sparkles data-icon="inline-start" />
                {dict.IMPORT_DOC_USE_DATA}
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                {dict.BUTTON_CANCEL}
              </Button>
              <Button
                type="button"
                onClick={handleAnalyze}
                disabled={files.length === 0 || isAnalyzing}
              >
                {isAnalyzing ? (
                  <ButtonLoader />
                ) : (
                  <Sparkles data-icon="inline-start" />
                )}
                {isAnalyzing
                  ? dict.IMPORT_DOC_ANALYZING
                  : dict.IMPORT_DOC_ANALYZE}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
