"use client"

import { useRef, useState } from "react"
import { useDictionary } from "@/components/dictionary-provider"
import { createClient } from "@/lib/supabase"
import { autoMatchDO, type DOMatch } from "@/lib/do-auto-match"
import type { ExtractedDO } from "@/lib/ai-provider"
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

export type DOImportMeta = {
  warnings: string[]
  timings: {
    upload_parse_ms: number
    code_ms: number
    total_ms: number
  } | null
}

interface DOAIImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onApply: (data: ExtractedDO, match: DOMatch, meta?: DOImportMeta) => void
  supplierName?: string
}

const ACCEPTED_TYPES = "application/pdf,image/png,image/jpeg,image/webp"
const MAX_FILE_SIZE = 10 * 1024 * 1024
const MAX_FILES = 4

export function DOAIImportDialog({
  open,
  onOpenChange,
  onApply,
  supplierName,
}: DOAIImportDialogProps) {
  const { dict, lang } = useDictionary()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [files, setFiles] = useState<File[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [extracted, setExtracted] = useState<ExtractedDO | null>(null)
  const [match, setMatch] = useState<DOMatch | null>(null)
  const [auditWarnings, setAuditWarnings] = useState<string[]>([])
  const [timings, setTimings] = useState<{
    upload_parse_ms: number
    code_ms: number
    total_ms: number
  } | null>(null)

  const reset = () => {
    setFiles([])
    setExtracted(null)
    setMatch(null)
    setAuditWarnings([])
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
      formData.append("doc_type", "do")

      const res = await fetch("/api/ai/extract-so", {
        method: "POST",
        body: formData,
      })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || dict.IMPORT_DOC_FAILED_DESC)
      }

      const data = json.data as ExtractedDO
      const matched = await autoMatchDO(supabase, data)
      setAuditWarnings(
        Array.isArray(json.code_warnings) ? json.code_warnings : []
      )
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
    onApply(extracted, match || {
      company: null,
      product: null,
      transporter: null,
      supplier: null,
      vehicle: null,
      so: null,
    }, {
      warnings: [...(extracted.warnings ?? []), ...auditWarnings],
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
        className={cn("ml-2 text-[10px] font-semibold uppercase", styles[level])}
      >
        {level}
      </span>
    )
  }

  const formatValue = (value: string | number | string[] | null | undefined) =>
    value === null || value === undefined || value === ""
      ? "-"
      : Array.isArray(value)
        ? value.join(", ")
        : String(value)

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
            <Sparkles className="mr-2 inline-block size-5 text-primary" />
            {dict.IMPORT_DOC_TITLE}
          </DialogTitle>
          <p className="text-xs">{dict.IMPORT_DOC_DESCRIPTION}</p>
        </DialogHeader>

        {!extracted ? (
          <div className="space-y-4 p-6">
            <div
              className={cn(
                "flex flex-col items-center justify-center gap-2 border-3 border-dotted bg-secondary/10 p-6 text-center transition-colors",
                files.length > 0 && "border-solid border-primary/50 bg-primary/20"
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
                      variant="table_action"
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
              auditWarnings.length > 0) && (
              <div className="space-y-1 rounded border border-amber-500/30 bg-amber-500/10 p-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-amber-600 dark:text-amber-400">
                  <AlertCircle className="size-4" />
                  {dict.IMPORT_DOC_WARNINGS}
                </div>
                <ul className="list-inside list-disc text-xs text-amber-700 dark:text-amber-300">
                  {(extracted.warnings || []).map((w, i) => (
                    <li key={`ai-${i}`}>{w}</li>
                  ))}
                  {auditWarnings.map((w, i) => (
                    <li key={`audit-${i}`}>{w}</li>
                  ))}
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
                label: dict.IMPORT_DOC_SJ_NUMBER,
                value: extracted.sj_number,
                field: "sj_number",
              },
              {
                label: dict.LABEL_SO_NUMBER?.replace("SO", "PO") || "PO Number",
                value: match?.so?.so_number || extracted.po_number || "-",
                field: "po_number",
              },
              {
                label: dict.LABEL_COMPANY_NAME,
                value: match?.company?.name || extracted.company_name || "-",
                field: "company_name",
              },
              {
                label: dict.LABEL_PRODUCT_NAME,
                value: match?.product
                  ? `${match.product.sku} - ${match.product.name}`
                  : extracted.product_description || "-",
                field: "product_description",
              },
              {
                label: dict.LABEL_QUANTITY,
                value:
                  extracted.quantity !== null && extracted.quantity !== undefined
                    ? `${extracted.quantity.toLocaleString()} ${extracted.quantity_unit || ""}`.trim()
                    : null,
                field: "quantity",
              },
              {
                label: dict.LABEL_TRANSPORTER,
                value: match?.transporter?.name || extracted.transporter_name,
                field: "transporter_name",
              },
              {
                label: dict.LABEL_VEHICLE,
                value: match?.vehicle?.license_number || extracted.vehicle_number,
                field: "vehicle_number",
              },
              {
                label: dict.LABEL_DRIVER_NAME,
                value: extracted.driver_name,
                field: "driver_name",
              },
              {
                label: dict.LABEL_SEAL_NUMBER,
                value: extracted.seal_numbers,
                field: "seal_numbers",
              },
              {
                label: dict.LABEL_DELIVERY_ADDRESS,
                value: extracted.delivery_address,
                field: "delivery_address",
              },
              {
                label: dict.LABEL_DO_DATE,
                value: extracted.sj_date,
                field: "sj_date",
              },
            ].map((row) => {
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
