"use client"

import { useRef, useState } from "react"
import { useDictionary } from "@/components/dictionary-provider"
import { createClient } from "@/lib/supabase"
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
import { FileText, Sparkles, Trash2, Upload, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

export type ExtractedSOData = {
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

export type SOAutoMatch = {
  company: { id: string; name: string; details: unknown } | null
  product: { id: string; sku: string; name: string } | null
}

interface SOAIImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onApply: (data: ExtractedSOData, match: SOAutoMatch) => void
}

const ACCEPTED_TYPES = "application/pdf,image/png,image/jpeg,image/webp"
const MAX_FILE_SIZE = 10 * 1024 * 1024
const MAX_FILES = 4

export function SOAIImportDialog({
  open,
  onOpenChange,
  onApply,
}: SOAIImportDialogProps) {
  const { dict } = useDictionary()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [files, setFiles] = useState<File[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [extracted, setExtracted] = useState<ExtractedSOData | null>(null)
  const [match, setMatch] = useState<SOAutoMatch | null>(null)

  const reset = () => {
    setFiles([])
    setExtracted(null)
    setMatch(null)
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

  // Auto-match extracted names against DB records
  const autoMatch = async (
    data: ExtractedSOData
  ): Promise<SOAutoMatch> => {
    const result: SOAutoMatch = { company: null, product: null }

    if (data.company_name) {
      const { data: companies } = await supabase
        .from("companies")
        .select("id, name, details")
        .contains("type", ["Customer"])
        .ilike("name", `%${data.company_name}%`)
        .limit(5)
      if (companies && companies.length > 0) {
        // Prefer exact (case-insensitive) match, otherwise first partial match
        const exact = companies.find(
          (c: { name: string }) =>
            c.name.toLowerCase() === data.company_name!.toLowerCase()
        )
        result.company = exact || companies[0]
      }
    }

    if (data.product_sku) {
      const { data: products } = await supabase
        .from("products")
        .select("id, sku, name")
        .ilike("sku", data.product_sku)
        .limit(1)
      if (products && products.length > 0) {
        result.product = products[0]
      }
    }
    if (!result.product && data.product_description) {
      const { data: products } = await supabase
        .from("products")
        .select("id, sku, name")
        .ilike("name", `%${data.product_description}%`)
        .limit(5)
      if (products && products.length > 0) {
        result.product = products[0]
      }
    }

    return result
  }

  const handleAnalyze = async () => {
    if (files.length === 0) return
    setIsAnalyzing(true)
    try {
      const formData = new FormData()
      files.forEach((file) => formData.append("files", file))

      const res = await fetch("/api/ai/extract-so", {
        method: "POST",
        body: formData,
      })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || dict.IMPORT_DOC_FAILED_DESC)
      }

      const data = json.data as ExtractedSOData
      const matched = await autoMatch(data)
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
    onApply(extracted, match || { company: null, product: null })
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

  const formatValue = (value: string | number | null | undefined) =>
    value === null || value === undefined || value === "" ? "-" : String(value)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            <Sparkles className="mr-2 inline-block size-5 text-primary" />
            {dict.IMPORT_DOC_TITLE}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {dict.IMPORT_DOC_DESCRIPTION}
          </p>
        </DialogHeader>

        {!extracted ? (
          <div className="space-y-4">
            <div
              className={cn(
                "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors",
                files.length > 0 && "border-primary/50 bg-primary/5"
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
          <div className="max-h-[50vh] space-y-3 overflow-y-auto pr-1">
            {extracted.warnings && extracted.warnings.length > 0 && (
              <div className="space-y-1 rounded border border-amber-500/30 bg-amber-500/10 p-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-amber-600 dark:text-amber-400">
                  <AlertCircle className="size-4" />
                  {dict.IMPORT_DOC_WARNINGS}
                </div>
                <ul className="list-inside list-disc text-xs text-amber-700 dark:text-amber-300">
                  {extracted.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
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
                value:
                  match?.company?.name ||
                  extracted.company_name ||
                  "-",
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
            ].map((row) => (
              <div
                key={row.field}
                className="flex items-start justify-between gap-4 rounded border bg-background p-2 text-sm"
              >
                <span className="shrink-0 font-medium text-muted-foreground">
                  {row.label}
                  {confidenceBadge(row.field)}
                </span>
                <span className="text-right">{formatValue(row.value)}</span>
              </div>
            ))}

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
