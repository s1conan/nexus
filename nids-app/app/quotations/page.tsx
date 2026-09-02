"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { useDictionary } from "@/components/dictionary-provider"
import { SITE_CONFIG } from "@/lib/site-content"
import { useAuth } from "@/components/auth-provider"
import { createClient } from "@/lib/supabase"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Plus,
  Search,
  Pencil,
  Save,
  X,
  Printer,
  Trash2,
  ChevronDown,
  CheckCircle2,
  ClipboardList,
  Calendar,
  Clock,
  MinusCircle,
  AlertCircle,
  ArrowUpAZ,
  ArrowDownZA,
  ArrowUpDown,
  RefreshCw,
  Send,
  FileText,
  FileEdit,
  AlertTriangle,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { SummaryCard } from "@/components/summary-card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { cn, constructMultiWordSearch } from "@/lib/utils"
import { SectionLoader } from "@/components/section-loader"
import { Checkbox } from "@/components/ui/checkbox"
import { notify } from "@/lib/notifications"
import { RichTextEditor } from "@/components/rich-text-editor"
import { LiveSearch } from "@/components/live-search"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { format } from "date-fns"
import { generateStandardQuotationPDF } from "@/lib/pdf-generator"
import { ButtonLoader } from "@/components/button-loader"
import { NumberInput } from "@/components/number-input"
import { useDebounce } from "@/hooks/use-debounce"
import { Switch } from "@/components/ui/switch"
import dynamic from "next/dynamic"
import { DeleteConfirmationDialog } from "@/components/confirmation-dialog"

const Gallery = dynamic(() => import("@/components/Gallery"), { ssr: false })

const PAGE_SIZE = 50
const ALMOST_EXPIRED_DAYS_THRESHOLD = 7 // Configurable variable for X days

interface SortLevel {
  id: string
  column: string
  direction: "asc" | "desc"
}

export default function QuotationsPage() {
  const { dict, lang } = useDictionary()
  const { hasPermission, loading: authLoading } = useAuth()
  const supabase = createClient()

  const [quotations, setQuotations] = useState<any[]>([])
  const [availableBanks, setAvailableBanks] = useState<any[]>([])
  const [globalTaxes, setGlobalTaxes] = useState<any[]>([])
  const [companyInfo, setCompanyInfo] = useState<any>(null)
  const [previewDoc, setPreviewDoc] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [offset, setOffset] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  const [updatedRowId, setUpdatedRowId] = useState<string | null>(null)

  const [stats, setStats] = useState({
    totalQuotations: 0,
    draftQuotations: 0,
    sentQuotations: 0,
    almostExpired: 0,
  })

  // Dialog State
  const [isOpen, setIsOpen] = useState(false)
  const [isSortOpen, setIsSortOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)
  const [viewOnly, setViewOnly] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: string
    quotation_number: string
    company_name: string
  } | null>(null)

  // Filter States
  const [searchQuery, setSearchQuery] = useState("")
  const debouncedSearchQuery = useDebounce(searchQuery, 300)
  const [sortLevels, setSortLevels] = useState<SortLevel[]>([
    { id: "1", column: "created_at", direction: "desc" },
  ])

  const observerTarget = useRef(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const statusStyles: Record<string, string> = {
    Draft:
      "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border border-zinc-500/20",
    Sent: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
    Accepted:
      "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20",
    Rejected:
      "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20",
    Processed:
      "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
  }

  // Form State
  const [formData, setFormData] = useState(() => ({
    quotation_number: "",
    company_id: "",
    delivery_address: "",
    product_id: "",
    base_price: 0,
    delivery_price: 0,
    quotation_date: format(new Date(), "yyyy-MM-dd"),
    expiry_date: format(
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      "yyyy-MM-dd"
    ),
    expiry_days: 30,
    minimum_order: 0,
    shrinkage_tolerance: 0,
    status: "Draft",
    content: "",
    is_content_enabled: true,
    note: "",
    is_note_enabled: true,
    terms_conditions: "",
    is_terms_enabled: true,
    closing_remarks: "",
    is_closing_enabled: true,
    discounts: [] as {
      label: string
      value: number
      delivery_address: string
      delivery_cost: number
    }[],
    bank_accounts: [] as any[],
    tax_details: [] as any[],
    delivery_taxable: false,
  }))

  const [selectedCompanyInfo, setSelectedCompanyInfo] = useState<any>(null)
  const [selectedProductInfo, setSelectedProductInfo] = useState<any>(null)

  const companyAddresses = useMemo(() => {
    if (!selectedCompanyInfo?.details?.addresses) return []
    return selectedCompanyInfo.details.addresses as {
      label: string
      address: string
    }[]
  }, [selectedCompanyInfo])

  // Permission Checks
  const canView = hasPermission("quotation", "view")
  const canInsert = hasPermission("quotation", "insert")
  const canEdit = hasPermission("quotation", "edit")
  const canDelete = hasPermission("quotation", "delete")
  const canPrint = hasPermission("quotation", "print")

  const fetchStats = useCallback(async () => {
    try {
      const now = new Date()
      const futureDate = new Date(
        now.getTime() + ALMOST_EXPIRED_DAYS_THRESHOLD * 24 * 60 * 60 * 1000
      )

      const [
        { count: totalCount },
        { count: draftCount },
        { count: sentCount },
        { count: almostExpiredCount },
      ] = await Promise.all([
        supabase.from("quotations").select("*", { count: "exact", head: true }),
        supabase
          .from("quotations")
          .select("*", { count: "exact", head: true })
          .eq("status", "Draft"),
        supabase
          .from("quotations")
          .select("*", { count: "exact", head: true })
          .eq("status", "Sent"),
        supabase
          .from("quotations")
          .select("*", { count: "exact", head: true })
          .gte("expiry_date", format(now, "yyyy-MM-dd"))
          .lte("expiry_date", format(futureDate, "yyyy-MM-dd"))
          .neq("status", "Accepted")
          .neq("status", "Rejected"),
      ])

      setStats({
        totalQuotations: totalCount || 0,
        draftQuotations: draftCount || 0,
        sentQuotations: sentCount || 0,
        almostExpired: almostExpiredCount || 0,
      })
    } catch (err) {
      console.error("Fetch Stats Error:", err)
    }
  }, [supabase])

  // Fetch Data
  const fetchData = useCallback(
    async (isInitial = false) => {
      if (isInitial) {
        setLoading(true)
        setOffset(0)
        fetchStats()
      } else {
        setLoadingMore(true)
      }

      try {
        const currentOffset = isInitial ? 0 : offset

        // We still need banks and company settings (only once)
        if (isInitial) {
          const [bRes, sRes, tRes] = await Promise.all([
            supabase
              .from("app_settings")
              .select("value")
              .eq("category", "company")
              .eq("name", "bank")
              .maybeSingle(),
            supabase.from("app_settings").select("*").eq("category", "company"),
            supabase.from("app_settings").select("*").eq("category", "tax"),
          ])

          if (bRes.data?.value) setAvailableBanks(bRes.data.value as any[])
          else setAvailableBanks([])

          if (sRes.data) {
            const info: any = {}
            sRes.data.forEach((r: any) => {
              info[r.name] = r.value
            })
            setCompanyInfo(info)
          }

          if (tRes.data) {
            setGlobalTaxes(tRes.data)
          }
        }

        let query = supabase
          .from("quotations")
          .select(
            "*, company:companies(id, name, details), product:products(id, sku, name, base_price)"
          )
          .range(currentOffset, currentOffset + PAGE_SIZE - 1)

        // Dynamic sorting
        sortLevels.forEach((level) => {
          const [, col] = level.column.split(".")
          if (col) {
            // Relation sorting not supported natively via range easily for joined tables in simple .order
            // For now we sort by top level cols primarily
          } else {
            query = query.order(level.column, {
              ascending: level.direction === "asc",
            })
          }
        })

        // Ensure stable secondary sort
        query = query.order("created_at", { ascending: false })

        if (debouncedSearchQuery) {
          query = query.or(`quotation_number.ilike.%${debouncedSearchQuery}%`)
        }

        const { data, error } = await query
        if (error) throw error

        if (data) {
          if (isInitial) {
            setQuotations(data)
          } else {
            setQuotations((prev) => {
              const newItems = data.filter(
                (item: any) => !prev.some((p) => p.id === item.id)
              )
              return [...prev, ...newItems]
            })
          }
          setHasMore(data.length === PAGE_SIZE)
          setOffset(currentOffset + data.length)
        }
      } catch (err: any) {
        notify.error(dict.MSG_DATA_FETCH_FAILED, err.message)
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [
      supabase,
      offset,
      debouncedSearchQuery,
      sortLevels,
      dict.MSG_DATA_FETCH_FAILED,
      // eslint-disable-next-line react-hooks/exhaustive-deps
    ]
  )

  useEffect(() => {
    fetchData(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchQuery, sortLevels])

  // Ordinary Infinite Scroll
  useEffect(() => {
    const rootElement = containerRef.current
    if (!rootElement) return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry.isIntersecting && hasMore && !loading && !loadingMore) {
          fetchData(false)
        }
      },
      {
        root: rootElement,
        rootMargin: "400px",
        threshold: 0,
      }
    )

    if (observerTarget.current) {
      observer.observe(observerTarget.current)
    }

    return () => observer.disconnect()
  }, [fetchData, hasMore, loading, loadingMore])

  const handleRefresh = () => {
    fetchData(true)
  }

  // Linked Expiry Logic
  const handleQuotationDateChange = (dateStr: string) => {
    const newQDate = new Date(dateStr)
    const eDate = new Date(formData.expiry_date)
    const diffTime = eDate.getTime() - newQDate.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    setFormData((prev) => ({
      ...prev,
      quotation_date: dateStr,
      expiry_days: diffDays,
    }))
  }

  const handleDateChange = (dateStr: string) => {
    const qDate = new Date(formData.quotation_date)
    const eDate = new Date(dateStr)
    const diffTime = eDate.getTime() - qDate.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    setFormData((prev) => ({
      ...prev,
      expiry_date: dateStr,
      expiry_days: diffDays,
    }))
  }

  const handleDaysChange = (days: number) => {
    const qDate = new Date(formData.quotation_date)
    const eDate = new Date(qDate.getTime() + days * 24 * 60 * 60 * 1000)
    setFormData((prev) => ({
      ...prev,
      expiry_days: days,
      expiry_date: format(eDate, "yyyy-MM-dd"),
    }))
  }

  const handleOpenDialog = async (item: any = null, isViewOnly = false) => {
    setViewOnly(isViewOnly)
    if (item) {
      setEditingItem(item)
      const company = item.company
        ? {
            ...item.company,
            contact_person: item.company.details?.contact_person || "",
          }
        : null

      setSelectedCompanyInfo(company)
      setSelectedProductInfo(item.product)

      const itemBankAccounts = Array.isArray(item.bank_accounts)
        ? item.bank_accounts
        : []
      const initialSelectedBanks = availableBanks.filter((availableBank) =>
        itemBankAccounts.some(
          (itemBank: any) =>
            itemBank.account_number === availableBank.account_number
        )
      )

      // Merge saved taxes with current global taxes
      const savedTaxes = Array.isArray(item.tax_details) ? item.tax_details : []
      const mergedTaxes = globalTaxes.map((gt) => {
        const existing = savedTaxes.find((st: any) => st.name === gt.name)
        if (existing)
          return { ...gt, rate: existing.rate, enabled: existing.enabled }
        return { ...gt, rate: gt.value, enabled: false }
      })

      // Preserve custom taxes no longer in global settings
      savedTaxes.forEach((st: any) => {
        if (!mergedTaxes.find((mt: any) => mt.name === st.name)) {
          mergedTaxes.push({ ...st })
        }
      })

      setFormData({
        quotation_number: item.quotation_number,
        company_id: item.company_id,
        delivery_address: item.delivery_address || "",
        product_id: item.product_id,
        base_price: item.base_price || 0,
        delivery_price: item.delivery_price || 0,
        quotation_date: item.quotation_date,
        expiry_date: item.expiry_date,
        expiry_days: item.expiry_days,
        minimum_order: item.minimum_order,
        shrinkage_tolerance: item.shrinkage_tolerance ?? 0,
        status: item.status,
        content: item.content || "",
        is_content_enabled: item.is_content_enabled ?? true,
        note: item.note || "",
        is_note_enabled: item.is_note_enabled ?? true,
        terms_conditions: item.terms_conditions || "",
        is_terms_enabled: item.is_terms_enabled ?? true,
        closing_remarks: item.closing_remarks || "",
        is_closing_enabled: item.is_closing_enabled ?? true,
        discounts: (item.discounts || []).map((d: any) => ({
          label: d.label || "",
          value: d.value || 0,
          delivery_address: d.delivery_address || "",
          delivery_cost: d.delivery_cost || 0,
        })),
        bank_accounts: initialSelectedBanks,
        tax_details: mergedTaxes,
        delivery_taxable: item.delivery_taxable ?? false,
      })
    } else {
      if (!canInsert) return
      setEditingItem(null)
      setSelectedCompanyInfo(null)
      setSelectedProductInfo(null)

      // Fetch the last created quotation to pre-fill rich text fields
      let lastContent = ""
      let lastNote = ""
      let lastTerms = ""
      let lastClosing = ""
      let lastIsContentEnabled = true
      let lastIsNoteEnabled = true
      let lastIsTermsEnabled = true
      let lastIsClosingEnabled = true

      try {
        const { data: lastQuotation } = await supabase
          .from("quotations")
          .select(
            "content, note, terms_conditions, closing_remarks, is_content_enabled, is_note_enabled, is_terms_enabled, is_closing_enabled"
          )
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()

        if (lastQuotation) {
          lastContent = lastQuotation.content || ""
          lastNote = lastQuotation.note || ""
          lastTerms = lastQuotation.terms_conditions || ""
          lastClosing = lastQuotation.closing_remarks || ""
          lastIsContentEnabled = lastQuotation.is_content_enabled ?? true
          lastIsNoteEnabled = lastQuotation.is_note_enabled ?? true
          lastIsTermsEnabled = lastQuotation.is_terms_enabled ?? true
          lastIsClosingEnabled = lastQuotation.is_closing_enabled ?? true
        }
      } catch {
        // Silently fail — fields stay empty
      }

      setFormData({
        quotation_number: "", // Will be auto-generated on save if empty
        company_id: "",
        delivery_address: "",
        product_id: "",
        base_price: 0,
        delivery_price: 0,
        quotation_date: format(new Date(), "yyyy-MM-dd"),
        expiry_date: format(
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          "yyyy-MM-dd"
        ),
        expiry_days: 30,
        minimum_order: 0,
        shrinkage_tolerance: 0,
        status: "Draft",
        content: lastContent,
        is_content_enabled: lastIsContentEnabled,
        note: lastNote,
        is_note_enabled: lastIsNoteEnabled,
        terms_conditions: lastTerms,
        is_terms_enabled: lastIsTermsEnabled,
        closing_remarks: lastClosing,
        is_closing_enabled: lastIsClosingEnabled,
        discounts: [],
        bank_accounts: [],
        tax_details: globalTaxes.map((gt) => ({
          ...gt,
          rate: gt.value,
          enabled: false,
        })),
        delivery_taxable: false,
      })
    }
    setIsOpen(true)
  }

  const handleSave = async () => {
    // Field validation
    const errors: string[] = []
    if (!formData.company_id) errors.push(dict.MSG_COMPANY_REQUIRED)
    if (!formData.product_id) errors.push(dict.MSG_PRODUCT_REQUIRED)

    if (errors.length > 0) {
      notify.error(dict.MSG_VALIDATION_ERROR, errors.join("\n"))
      return
    }

    setIsSaving(true)
    try {
      const payload = { ...formData }
      if (editingItem) {
        if (editingItem.status === "Processed") {
          notify.error("Error", "Cannot edit quotation with status Processed.")
          setIsSaving(false)
          return
        }

        // Check if any data fields have changed compared to original editingItem
        const hasDataChanged =
          payload.quotation_number !== editingItem.quotation_number ||
          payload.company_id !== (editingItem.company_id || "") ||
          payload.delivery_address !== (editingItem.delivery_address || "") ||
          payload.product_id !== (editingItem.product_id || "") ||
          Number(payload.base_price) !== Number(editingItem.base_price || 0) ||
          Number(payload.delivery_price) !==
            Number(editingItem.delivery_price || 0) ||
          payload.quotation_date !== editingItem.quotation_date ||
          payload.expiry_date !== editingItem.expiry_date ||
          Number(payload.expiry_days) !==
            Number(editingItem.expiry_days || 0) ||
          Number(payload.minimum_order) !==
            Number(editingItem.minimum_order || 0) ||
          Number(payload.shrinkage_tolerance) !==
            Number(editingItem.shrinkage_tolerance ?? 0) ||
          payload.content !== (editingItem.content || "") ||
          payload.is_content_enabled !==
            (editingItem.is_content_enabled ?? true) ||
          payload.note !== (editingItem.note || "") ||
          payload.is_note_enabled !== (editingItem.is_note_enabled ?? true) ||
          payload.terms_conditions !== (editingItem.terms_conditions || "") ||
          payload.is_terms_enabled !== (editingItem.is_terms_enabled ?? true) ||
          payload.closing_remarks !== (editingItem.closing_remarks || "") ||
          payload.is_closing_enabled !==
            (editingItem.is_closing_enabled ?? true) ||
          JSON.stringify(payload.discounts) !==
            JSON.stringify(editingItem.discounts || []) ||
          JSON.stringify(
            payload.bank_accounts?.map((b: any) => b.account_number)
          ) !==
            JSON.stringify(
              (editingItem.bank_accounts || []).map(
                (b: any) => b.account_number
              )
            ) ||
          JSON.stringify(
            payload.tax_details?.map((t: any) => ({
              name: t.name,
              rate: t.rate,
              enabled: t.enabled,
            }))
          ) !==
            JSON.stringify(
              (editingItem.tax_details || []).map((t: any) => ({
                name: t.name,
                rate: t.rate,
                enabled: t.enabled,
              }))
            ) ||
          (payload.delivery_taxable ?? false) !==
            (editingItem.delivery_taxable ?? false)

        if (hasDataChanged) {
          payload.status = "Draft"
        }

        await supabase
          .from("quotations")
          .update({ bank_accounts: null, discounts: null })
          .eq("id", editingItem.id)
        const { error } = await supabase
          .from("quotations")
          .update(payload)
          .eq("id", editingItem.id)
        if (error) throw error

        // Fetch updated row to keep local state in sync with relations
        const { data: updatedRow, error: fetchError } = await supabase
          .from("quotations")
          .select(
            "*, company:companies(id, name, details), product:products(id, sku, name, base_price)"
          )
          .eq("id", editingItem.id)
          .single()

        if (!fetchError && updatedRow) {
          setQuotations((prev) =>
            prev.map((q) => (q.id === editingItem.id ? updatedRow : q))
          )
          setUpdatedRowId(editingItem.id)
        } else {
          // Fallback if fetch fails
          fetchData(true)
        }

        const docLabel = `[${payload.quotation_number || formData.quotation_number}]`
        notify.success(
          dict.MSG_UPDATE_SUCCESS.replace("%data%", docLabel),
          dict.MSG_SUCCESS_UPDATE_DESC.replace("%entity%", "quotation").replace(
            "%company%",
            `[${selectedCompanyInfo?.name || ""}]`
          ),
          undefined,
          true
        )
        fetchStats()
      } else {
        // Generate document number if empty
        if (!payload.quotation_number) {
          const { data, error: rpcError } = await supabase.rpc(
            "generate_document_number",
            {
              p_doc_type: "quotation",
              p_company_id: payload.company_id || null,
            }
          )
          if (rpcError) throw rpcError
          payload.quotation_number = data
        }

        // Convert empty UUID foreign keys to null
        const insertPayload = {
          ...payload,
          company_id: payload.company_id || null,
          product_id: payload.product_id || null,
        }

        const { error } = await supabase
          .from("quotations")
          .insert([insertPayload])
        if (error) throw error
        const docLabel = `[${insertPayload.quotation_number || formData.quotation_number}]`
        notify.success(
          dict.MSG_QUOTATION_SAVED.replace("%data%", docLabel),
          dict.MSG_SUCCESS_SAVE_DESC.replace("%entity%", "quotation").replace(
            "%company%",
            `[${selectedCompanyInfo?.name || ""}]`
          ),
          undefined,
          true
        )
        fetchData(true)
      }
      setIsOpen(false)
    } catch (err: any) {
      const docLabel = `[${formData.quotation_number}]`
      notify.error(
        dict.MSG_SAVE_FAILED.replace("%data%", docLabel),
        err.message
      )
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    const item = quotations.find((q) => q.id === id)
    if (item && item.status === "Processed") {
      notify.error("Error", "Cannot delete a Processed quotation.")
      return
    }
    if (!item) return
    setDeleteConfirm({
      id: item.id,
      quotation_number: item.quotation_number,
      company_name: item.company?.name || "",
    })
  }

  const confirmDelete = async () => {
    if (!deleteConfirm) return
    const docLabel = `[${deleteConfirm.quotation_number}]`
    const companyName = deleteConfirm.company_name
    try {
      const { error } = await supabase
        .from("quotations")
        .delete()
        .eq("id", deleteConfirm.id)
      if (error) throw error

      setQuotations((prev) => prev.filter((q) => q.id !== deleteConfirm.id))
      notify.deleted(
        dict.MSG_QUOTATION_DELETED.replace("%data%", docLabel),
        dict.MSG_SUCCESS_DELETE_DESC.replace("%entity%", "quotation").replace(
          "%company%",
          `[${companyName}]`
        ),
        undefined,
        true
      )
      fetchStats()
    } catch (err: any) {
      notify.error(
        dict.MSG_SAVE_FAILED.replace("%data%", docLabel),
        err.message
      )
    } finally {
      setDeleteConfirm(null)
    }
  }

  const updateStatus = async (id: string, status: string) => {
    const item = quotations.find((q) => q.id === id)
    if (item && item.status === "Processed") {
      notify.error("Error", "Cannot change status of a Processed quotation.")
      return
    }
    if (!item) return
    const docLabel = `[${item.quotation_number}]`
    const companyName = item.company?.name || ""
    try {
      const { error } = await supabase
        .from("quotations")
        .update({ status })
        .eq("id", id)
      if (error) throw error

      setQuotations((prev) =>
        prev.map((q) => (q.id === id ? { ...q, status } : q))
      )
      setUpdatedRowId(id)
      notify.success(
        dict.MSG_QUOTATION_STATUS_UPDATED.replace("%data%", docLabel),
        dict.MSG_SUCCESS_STATUS_DESC.replace("%status%", `[${status}]`).replace(
          "%company%",
          `[${companyName}]`
        ),
        undefined,
        true
      )
      fetchStats()
    } catch (err: any) {
      notify.error(
        dict.MSG_UPDATE_FAILED.replace("%data%", docLabel),
        err.message
      )
    }
  }

  const handlePrint = async (q: any) => {
    if (!companyInfo) {
      notify.error(dict.MSG_SAVE_FAILED, "Company information not loaded yet.")
      return
    }
    try {
      const dataUri = await generateStandardQuotationPDF(companyInfo, q, {
        save: false,
        output: "datauri",
      })
      const contacts = q.company?.details?.contact_persons?.length
        ? q.company.details.contact_persons
        : [
            {
              name: q.company?.details?.contact_person || "-",
              email: q.company?.details?.email || q.company?.email || "",
            },
          ]
      setPreviewDoc({
        id: q.id,
        title: q.quotation_number,
        description: ` ${q.company?.name || "-"}`,
        images: [],
        pdf: dataUri,
        customerEmail: contacts[0]?.email || "",
        contacts: contacts,
        ccEmails: q.company?.details?.cc_emails || "",
        bccEmails: q.company?.details?.bcc_emails || "",
        raw: q,
      })
    } catch (err: any) {
      notify.error("Failed to generate PDF", err.message)
    }
  }

  const handleDownload = (doc: any) => {
    const link = document.createElement("a")
    link.href = doc.pdf
    link.download = `Quotation_${doc.title}.pdf`
    link.click()
    notify.success(
      dict.MSG_PRINT_SUCCESS,
      dict.MSG_PRINT_SUCCESS_DESC.replace("%data%", `[${doc.title}]`),
      undefined,
      false
    )
  }

  const handleSendEmail = async (doc: any) => {
    try {
      const q = doc.raw || doc
      const { data: ccData } = await supabase
        .from("app_settings")
        .select("value")
        .eq("category", "email")
        .eq("name", "cc_quotation")
        .single()
      const globalCcList = ccData?.value
        ? ccData.value
            .split(",")
            .map((email: string) => email.trim())
            .filter((e: string) => e !== "")
        : []
      const companyCcList = doc.ccEmails
        ? doc.ccEmails
            .split(",")
            .map((email: string) => email.trim())
            .filter((e: string) => e !== "")
        : []
      const ccList = [...new Set([...globalCcList, ...companyCcList])]

      const { data: bccData } = await supabase
        .from("app_settings")
        .select("value")
        .eq("category", "email")
        .eq("name", "bcc_quotation")
        .single()
      const globalBccList = bccData?.value
        ? bccData.value
            .split(",")
            .map((email: string) => email.trim())
            .filter((e: string) => e !== "")
        : []
      const companyBccList = doc.bccEmails
        ? doc.bccEmails
            .split(",")
            .map((email: string) => email.trim())
            .filter((e: string) => e !== "")
        : []
      const bccList = [...new Set([...globalBccList, ...companyBccList])]
      const pdfDataUri = await generateStandardQuotationPDF(companyInfo, q, {
        save: false,
        output: "datauri",
      })
      if (!pdfDataUri) throw new Error("Failed to generate PDF for attachment.")
      const attachments = [
        {
          filename: `Quotation_${doc.title}.pdf`,
          content: (pdfDataUri as string).split(",")[1],
        },
      ]

      // Build email HTML
      const customerName =
        q.contact_person || q.company?.name || "Valued Customer"
      const quoteDate = q.quotation_date
        ? new Date(q.quotation_date).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          })
        : "-"
      const expiryDate = q.expiry_date
        ? new Date(q.expiry_date).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          })
        : "-"
      const productName = q.product?.name || q.product_name || "-"
      const minOrder = q.minimum_order || q.min_order || 0

      // Replace variables in note
      const processedNote = q.note
        ? q.note
            .replace(/\{quotation_date\}/g, quoteDate)
            .replace(/\{expiry_date\}/g, expiryDate)
            .replace(/\{delivery_address\}/g, q.delivery_address || "-")
            .replace(/\{contact_person\}/g, customerName)
        : ""

      const emailHtml = `<div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 800px; margin: 0 auto; padding: 0; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: #ffffff;">
        <div style="background: #00955c; padding: 32px 40px; text-align: center;">
          <h1 style="color: #ffffff; font-size: 28px; margin: 0 0 4px 0; font-weight: 700; letter-spacing: -0.5px;">PT Anugerah Buana Sriwijaya</h1>
          <p style="color: rgba(255,255,255,0.9); font-size: 14px; margin: 0;">Industrial Fuel Distributor</p>
        </div>
        <div style="background: #f8fafc; padding: 20px 40px; border-bottom: 1px solid #e2e8f0; text-align: center;">
          <span style="display: inline-block; background: #00955c; color: white; padding: 8px 24px; border-radius: 20px; font-size: 14px; font-weight: 600; letter-spacing: 0.5px;">QUOTATION</span>
        </div>
        <div style="padding: 40px;">
          <p style="color: #1e293b; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">Dear <strong style="color: #00955c;">${customerName}</strong>,</p>
          <p style="color: #475569; font-size: 15px; line-height: 1.7; margin: 0 0 20px 0;">Thank you for your interest in our products and services. Please find below the details of our quotation for your consideration.</p>
          <div style="background: #f8fafc; border-radius: 8px; padding: 24px; margin: 24px 0; border-left: 4px solid #00955c;">
            <h3 style="color: #1e293b; font-size: 16px; margin: 0 0 16px 0; font-weight: 600;">Quotation Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px; width: 35%;">Quotation No.</td>
                <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${q.quotation_number || "-"}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Date</td>
                <td style="padding: 8px 0; color: #1e293b; font-size: 14px;">${quoteDate}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Valid Until</td>
                <td style="padding: 8px 0; color: #1e293b; font-size: 14px;">${expiryDate}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Product</td>
                <td style="padding: 8px 0; color: #1e293b; font-size: 14px;">${productName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Min. Order</td>
                <td style="padding: 8px 0; color: #1e293b; font-size: 14px;">${minOrder.toLocaleString("id-ID")} L</td>
              </tr>
            </table>
          </div>
          ${processedNote ? `<div style="background: #fef9c3; border-radius: 8px; padding: 16px; margin: 24px 0;"><p style="color: #854d0e; font-size: 14px; margin: 0; white-space: pre-wrap;">${processedNote}</p></div>` : ""}
          <p style="color: #475569; font-size: 15px; line-height: 1.7; margin: 24px 0;">For full details including terms & conditions and payment information, please refer to the attached quotation document.</p>
          <p style="color: #475569; font-size: 15px; line-height: 1.7; margin: 24px 0 32px 0;">Should you have any questions or require further clarification, please do not hesitate to contact us. We look forward to the opportunity of serving you.</p>
          <p style="color: #1e293b; font-size: 15px; line-height: 1.6; margin: 0;">Best regards,<br><strong style="font-size: 16px;">PT Anugerah Buana Sriwijaya</strong><br><span style="color: #64748b; font-size: 14px;">Sales Team</span></p>
        </div>
        <div style="background: #f8fafc; padding: 24px 40px; border-top: 1px solid #e2e8f0;">
          <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0; line-height: 1.6;">This is an automated message from PT Anugerah Buana Sriwijaya.<br>Please do not reply directly to this email.<br><br>&copy; ${new Date().getFullYear()} PT Anugerah Buana Sriwijaya. All rights reserved.</p>
        </div>
      </div>`

      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: doc.customerEmail,
          cc: ccList,
          bcc: bccList,
          subject: `Quotation ${doc.title} - PT Anugerah Buana Sriwijaya`,
          html: emailHtml,
          attachments,
        }),
      })
      const result = await res.json()
      if (result.success) {
        notify.success(
          dict.MSG_EMAIL_SENT_SUCCESS,
          dict.MSG_EMAIL_SENT_SUCCESS_DESC.replace("%data%", `[${doc.title}]`),
          undefined,
          true
        )
        // Automatically set status to Sent
        updateStatus(q.id, "Sent")
      } else throw new Error(result.error)
    } catch (err: any) {
      notify.error("Failed to send email", err.message)
    }
  }

  const sortedAndFilteredData = useMemo(() => {
    const words = searchQuery.toLowerCase().split(/\s+/).filter(Boolean)
    let result = quotations

    if (words.length > 0) {
      result = quotations.filter((q) => {
        const searchFields = [
          q.quotation_number,
          q.company?.name || "",
          q.product?.sku || "",
        ]
        return searchFields.some((field) => {
          const val = String(field).toLowerCase()
          return words.every((word) => val.includes(word))
        })
      })
    }
    return [...result].sort((a, b) => {
      for (const level of sortLevels) {
        const aVal =
          level.column === "company.name"
            ? a.company?.name || ""
            : level.column === "product.sku"
              ? a.product?.sku || ""
              : a[level.column]
        const bVal =
          level.column === "company.name"
            ? b.company?.name || ""
            : level.column === "product.sku"
              ? b.product?.sku || ""
              : b[level.column]
        if (aVal === bVal) continue
        const multiplier = level.direction === "asc" ? 1 : -1
        if (typeof aVal === "number" && typeof bVal === "number")
          return (aVal - bVal) * multiplier
        return String(aVal).localeCompare(String(bVal)) * multiplier
      }
      return 0
    })
  }, [quotations, searchQuery, sortLevels])

  const addSortLevel = () =>
    setSortLevels([
      ...sortLevels,
      {
        id: Math.random().toString(),
        column: "quotation_number",
        direction: "asc",
      },
    ])
  const removeSortLevel = (id: string) => {
    if (sortLevels.length > 1)
      setSortLevels(sortLevels.filter((l) => l.id !== id))
  }
  const updateSortLevel = (id: string, field: keyof SortLevel, value: any) =>
    setSortLevels(
      sortLevels.map((l) => (l.id === id ? { ...l, [field]: value } : l))
    )

  const sortColumns = [
    { label: dict.LABEL_QUOTATION_NUMBER, value: "quotation_number" },
    { label: dict.LABEL_COMPANY_NAME, value: "company_id" },
    { label: dict.LABEL_SKU, value: "product_id" },
    { label: dict.LABEL_QUOTATION_DATE, value: "quotation_date" },
    { label: dict.LABEL_EXPIRY_DATE, value: "expiry_date" },
    { label: dict.LABEL_MIN_ORDER, value: "minimum_order" },
    { label: dict.LABEL_STATUS, value: "status" },
  ]

  const editorVariables = [
    { id: "quotation_number", label: dict.LABEL_QUOTATION_NUMBER },
    { id: "quotation_date", label: dict.LABEL_QUOTATION_DATE },
    { id: "expiry_date", label: dict.LABEL_EXPIRY_DATE },
    { id: "company_name", label: dict.LABEL_COMPANY_NAME },
    { id: "contact_person", label: dict.LABEL_CONTACT_PERSON },
    { id: "product_name", label: dict.LABEL_PRODUCT_NAME },
    { id: "delivery_address", label: dict.LABEL_DELIVERY_ADDRESS },
    { id: "price", label: dict.LABEL_PRICE_PER_L },
    { id: "delivery_price", label: dict.LABEL_DELIVERY_PER_L },
    { id: "min_order", label: dict.LABEL_MIN_ORDER },
    { id: "shrinkage", label: dict.LABEL_SHRINKAGE_TOLERANCE },
    { id: "bank_accounts", label: dict.LABEL_BANK_ACCOUNTS },
  ]

  const variableValues = {
    quotation_number: formData.quotation_number,
    quotation_date: formData.quotation_date
      ? format(new Date(formData.quotation_date), "dd MMMM yyyy")
      : "",
    expiry_date: formData.expiry_date
      ? format(new Date(formData.expiry_date), "dd MMMM yyyy")
      : "",
    company_name: selectedCompanyInfo?.name || "",
    contact_person:
      selectedCompanyInfo?.contact_person ||
      selectedCompanyInfo?.details?.contact_person ||
      "",
    product_name:
      selectedProductInfo?.name ||
      (selectedProductInfo?.sku
        ? `${selectedProductInfo.sku} - ${selectedProductInfo.name}`
        : ""),
    delivery_address: formData.delivery_address || "",
    price: new Intl.NumberFormat().format(formData.base_price),
    delivery_price: new Intl.NumberFormat().format(formData.delivery_price),
    min_order: new Intl.NumberFormat().format(formData.minimum_order),
    shrinkage: formData.shrinkage_tolerance.toString(),
    bank_accounts: formData.bank_accounts.map((b) => b.name).join(", "),
  }

  // Calculation logic for Quotation Unit Price
  const totals = useMemo(() => {
    const subtotal = formData.base_price
    const taxableAmount = subtotal + (formData.delivery_taxable ? formData.delivery_price : 0)
    const appliedTaxes = formData.tax_details.map((t) => {
      if (!t.enabled) return { ...t, amount: 0 }
      const amt = (taxableAmount * Number(t.rate)) / 100
      return { ...t, amount: amt }
    })
    const taxTotal = appliedTaxes.reduce((sum, t) => sum + t.amount, 0)
    const grandTotal = subtotal + taxTotal + formData.delivery_price
    return { subtotal, taxTotal, grandTotal, appliedTaxes }
  }, [formData.base_price, formData.delivery_price, formData.delivery_taxable, formData.tax_details])

  if (!canView && !loading && !authLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="space-y-2 text-center">
          <AlertCircle className="mx-auto size-8 text-destructive" />
          <h2 className="text-lg font-semibold">
            {dict.MSG_ACCESS_DENIED || "Access Denied"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {dict.MSG_NO_PERMISSION ||
              "You do not have permission to view this page."}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <div className="page-header shrink-0">
        <h1 className="page-title flex items-center gap-2">
          <ClipboardList className="size-5 text-primary" />
          {dict.MENU_QUOTATION}
        </h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={loading || loadingMore}
            title="Refresh Data"
          >
            <RefreshCw
              className={cn(
                "size-4",
                (loading || loadingMore) && "animate-spin"
              )}
            />
          </Button>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                onClick={() => handleOpenDialog()}
                disabled={!canInsert}
              >
                <Plus data-icon="inline-start" />
                {dict.BUTTON_NEW_QUOTATION}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-3xl">
              <DialogHeader>
                <DialogTitle>
                  <ClipboardList className="mr-2 inline-block size-5" />
                  {viewOnly
                    ? formData.quotation_number
                    : editingItem
                      ? dict.BUTTON_EDIT_QUOTATION
                      : dict.BUTTON_NEW_QUOTATION}
                </DialogTitle>
                <DialogDescription />
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  handleSave()
                }}
                id="quotation-form"
                className="relative max-h-[70vh] overflow-y-auto"
              >
                <div
                  className={cn(
                    `relative flex w-full flex-col gap-6 p-5 ${viewOnly ? "rounded-b-xl border-2 border-orange-500" : ""}`
                  )}
                >
                  {viewOnly && <div className="absolute inset-0 z-20"></div>}
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                    <div className="space-y-4 md:col-span-2">
                      <div className="grid gap-2">
                        <Label htmlFor="qnum">
                          {dict.LABEL_QUOTATION_NUMBER}
                        </Label>
                        <Input
                          id="qnum"
                          value={formData.quotation_number}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              quotation_number: e.target.value,
                            })
                          }
                          disabled={editingItem && !canEdit}
                          placeholder={dict.LABEL_AUTO_GENERATED}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>{dict.LABEL_COMPANY_NAME}</Label>
                        <LiveSearch
                          data={
                            selectedCompanyInfo ? [selectedCompanyInfo] : []
                          }
                          fetchData={async (query) => {
                            let q = supabase
                              .from("companies")
                              .select("id, name, type, details")
                              .contains("type", ["Customer"])
                              .limit(8)
                            if (query) {
                              const searchStr = constructMultiWordSearch(
                                query,
                                ["name", "details->>contact_person"]
                              )
                              if (searchStr) q = q.or(searchStr)
                            }
                            const { data } = await q
                            return (data || []).map((c: any) => ({
                              ...c,
                              contact_person: c.details?.contact_person || "",
                            }))
                          }}
                          value={formData.company_id}
                          onSelect={(val, item) => {
                            setFormData({ ...formData, company_id: val })
                            setSelectedCompanyInfo(item)
                          }}
                          keyField="id"
                          displayField="name"
                          defaultDisplay={selectedCompanyInfo?.name || ""}
                          searchColumns={["name", "contact_person"]}
                          visualColumns={[
                            {
                              key: "name",
                              header: dict.LABEL_COMPANY_NAME,
                              className: "w-50",
                              primary: true,
                            },
                            {
                              key: "contact_person",
                              header: dict.LABEL_CONTACT_PERSON,
                              className: "w-30",
                            },
                          ]}
                          placeholder={dict.PLACEHOLDER_SEARCH}
                          emptyMessage={dict.NO_DATA}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>{dict.LABEL_DELIVERY_ADDRESS}</Label>
                        {companyAddresses.length > 0 ? (
                          <Select
                            value={formData.delivery_address}
                            onValueChange={(val) =>
                              setFormData({
                                ...formData,
                                delivery_address: val,
                              })
                            }
                          >
                            <SelectTrigger className="h-13 w-full">
                              <SelectValue
                                placeholder={dict.PLACEHOLDER_SELECT_ADDRESS}
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {companyAddresses.map((addr, idx) => (
                                <SelectItem key={idx} value={addr.address}>
                                  <div className="flex flex-col items-start text-sm">
                                    <span className="font-semibold">
                                      {addr.label}
                                    </span>
                                    <span className="line-clamp-1 text-xs text-muted-foreground">
                                      {addr.address}
                                    </span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            value={formData.delivery_address}
                            className="h-13"
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                delivery_address: e.target.value,
                              })
                            }
                            placeholder={dict.PLACEHOLDER_ENTER_ADDRESS}
                          />
                        )}
                      </div>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="grid gap-2">
                          <Label>{dict.LABEL_SKU}</Label>
                          <LiveSearch
                            data={
                              selectedProductInfo ? [selectedProductInfo] : []
                            }
                            fetchData={async (query) => {
                              let q = supabase
                                .from("products")
                                .select("id, sku, name, base_price")
                                .limit(8)
                              if (query) {
                                const searchStr = constructMultiWordSearch(
                                  query,
                                  ["sku", "name"]
                                )
                                if (searchStr) q = q.or(searchStr)
                              }
                              // q = q.or(
                              //   `sku.ilike.%${query}%,name.ilike.%${query}%`
                              // )
                              const { data } = await q
                              return data || []
                            }}
                            value={formData.product_id}
                            onSelect={(val, item) => {
                              setFormData({
                                ...formData,
                                product_id: val,
                                base_price: (item as any)?.base_price || 0,
                              })
                              setSelectedProductInfo(item)
                            }}
                            keyField="id"
                            displayField={(p) => `${p.sku} - ${p.name}`}
                            defaultDisplay={
                              selectedProductInfo
                                ? selectedProductInfo.sku &&
                                  selectedProductInfo.name
                                  ? `${selectedProductInfo.sku} - ${selectedProductInfo.name}`
                                  : selectedProductInfo.name ||
                                    selectedProductInfo.sku ||
                                    ""
                                : ""
                            }
                            searchColumns={["sku", "name"]}
                            visualColumns={[
                              {
                                key: "sku",
                                header: dict.LABEL_SKU,
                                className: "w-1/3 font-mono",
                                primary: true,
                              },
                              {
                                key: "name",
                                header: dict.LABEL_PRODUCT_NAME,
                                className: "w-2/3 text-left",
                              },
                            ]}
                            placeholder={dict.PLACEHOLDER_SEARCH}
                            emptyMessage={dict.NO_DATA}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>{dict.LABEL_BASE_PRICE}</Label>
                          <NumberInput
                            value={formData.base_price}
                            onChange={(val) =>
                              setFormData({ ...formData, base_price: val })
                            }
                            rightBadge="/ L"
                            leftBadge={SITE_CONFIG.currencySymbol}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="h-fit space-y-10.5 rounded-lg border bg-muted/10 p-4">
                      <div className="grid gap-2">
                        <Label className="flex items-center gap-2">
                          <Calendar className="size-4" />{" "}
                          {dict.LABEL_QUOTATION_DATE}
                        </Label>
                        <Input
                          type="date"
                          value={formData.quotation_date}
                          onChange={(e) =>
                            handleQuotationDateChange(e.target.value)
                          }
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label className="flex items-center gap-2">
                          <Clock className="size-4" /> {dict.LABEL_EXPIRY_DATE}
                        </Label>
                        <Input
                          type="date"
                          value={formData.expiry_date}
                          onChange={(e) => handleDateChange(e.target.value)}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>{dict.LABEL_VALIDITY_DAYS}</Label>
                        <NumberInput
                          value={formData.expiry_days}
                          onChange={(val) => handleDaysChange(val)}
                          rightBadge="Hari"
                        />
                      </div>
                    </div>
                    <div className="space-y-4 md:col-span-3">
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <div className="grid gap-2">
                          <Label htmlFor="minorder">
                            {dict.LABEL_MIN_ORDER}
                          </Label>
                          <NumberInput
                            id="minorder"
                            value={formData.minimum_order}
                            onChange={(val) =>
                              setFormData({ ...formData, minimum_order: val })
                            }
                            rightBadge="L"
                          />
                        </div>
                        {/* <div className="grid gap-2">
                          <Label htmlFor="deliv_price">
                            {dict.LABEL_TRANSPORT_COST}
                          </Label>
                          <NumberInput
                            id="deliv_price"
                            value={formData.delivery_price}
                            onChange={(val) =>
                              setFormData({ ...formData, delivery_price: val })
                            }
                            leftBadge={SITE_CONFIG.currencySymbol}
                            rightBadge="/ L"
                          />
                        </div> */}
                        <div className="grid gap-2">
                          <Label htmlFor="shrinkage">
                            {dict.LABEL_SHRINKAGE_TOLERANCE}
                          </Label>
                          <NumberInput
                            id="shrinkage"
                            value={formData.shrinkage_tolerance}
                            onChange={(val) =>
                              setFormData({
                                ...formData,
                                shrinkage_tolerance: val,
                              })
                            }
                            rightBadge="%"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>
                            {dict.LABEL_PRICE_PER_L} ({dict.LABEL_SUBTOTAL})
                          </Label>
                          <NumberInput
                            id="subtotal"
                            value={Math.round(totals.subtotal)}
                            disabled
                            leftBadge={SITE_CONFIG.currencySymbol}
                            rightBadge="/L"
                          />
                        </div>
                      </div>
                      <div className="h-fit space-y-4 rounded-lg border bg-muted/10 p-4">
                        <div className="flex items-center justify-between">
                          <Label className="text-base font-semibold">
                            {dict.LABEL_DISCOUNT_TERMS}
                          </Label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setFormData({
                                ...formData,
                                discounts: [
                                  ...formData.discounts,
                                  {
                                    label: "",
                                    value: 0,
                                    delivery_address: "",
                                    delivery_cost: 0,
                                  },
                                ],
                              })
                            }
                          >
                            <Plus className="size-4" />
                          </Button>
                        </div>
                        <div className="space-y-3">
                          {formData.discounts.map((d, i) => (
                            <div
                              key={i}
                              className="space-y-2 border-b pb-3 last:border-0"
                            >
                              <div className="flex items-center gap-2">
                                <Input
                                  className="h-9 w-6/20"
                                  placeholder={dict.LABEL_DISCOUNT_TERM1}
                                  value={d.label}
                                  onChange={(e) => {
                                    const newD = [...formData.discounts]
                                    newD[i].label = e.target.value
                                    setFormData({
                                      ...formData,
                                      discounts: newD,
                                    })
                                  }}
                                />
                                <Input
                                  className="h-9 w-6/20"
                                  placeholder={dict.LABEL_DISCOUNT_TERM2}
                                  value={d.delivery_address}
                                  onChange={(e) => {
                                    const newD = [...formData.discounts]
                                    newD[i].delivery_address = e.target.value
                                    setFormData({
                                      ...formData,
                                      discounts: newD,
                                    })
                                  }}
                                />
                                <div className="w-3/20 shrink-0">
                                  <NumberInput
                                    value={d.value}
                                    onChange={(val) => {
                                      const newD = [...formData.discounts]
                                      newD[i].value = val
                                      setFormData({
                                        ...formData,
                                        discounts: newD,
                                      })
                                    }}
                                    rightBadge="%"
                                    className="h-9"
                                  />
                                </div>
                                <div className="w-5/20 shrink-0">
                                  <NumberInput
                                    value={d.delivery_cost}
                                    onChange={(val) => {
                                      const newD = [...formData.discounts]
                                      newD[i].delivery_cost = val
                                      setFormData({
                                        ...formData,
                                        discounts: newD,
                                      })
                                    }}
                                    leftBadge={SITE_CONFIG.currencySymbol}
                                    rightBadge="/ L"
                                    className="h-9"
                                  />
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="shrink-0 text-destructive"
                                  onClick={() =>
                                    setFormData({
                                      ...formData,
                                      discounts: formData.discounts.filter(
                                        (_, idx) => idx !== i
                                      ),
                                    })
                                  }
                                >
                                  <MinusCircle className="size-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      {/* Aligned Tax Section */}
                      <div className="space-y-4 rounded-lg border bg-muted/10 p-4">
                        <Label className="block border-b pb-2 text-xs font-bold tracking-wider text-muted-foreground uppercase">
                          {dict.LABEL_TAXES || "Taxes"}
                        </Label>
                        {/* Delivery Taxable Toggle */}
                        <div className="flex items-center justify-between rounded border bg-background p-3">
                          <Label
                            htmlFor="delivery-taxable"
                            className="cursor-pointer text-xs font-medium"
                          >
                            {dict.LABEL_DELIVERY_TAXABLE || "Include Delivery Fee in Tax (PPN)"}
                          </Label>
                          <Switch
                            id="delivery-taxable"
                            checked={formData.delivery_taxable}
                            onCheckedChange={(val) =>
                              setFormData({ ...formData, delivery_taxable: val })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          {formData.tax_details.map((tax, idx) => {
                            const calculatedAmount =
                              totals.appliedTaxes.find(
                                (t) => t.name === tax.name
                              )?.amount || 0
                            return (
                              <div
                                key={idx}
                                className="grid min-h-12 grid-cols-12 items-center gap-2 rounded border bg-background p-2"
                              >
                                <div className="col-span-3 truncate font-medium">
                                  <Label
                                    htmlFor={`tax-${idx}`}
                                    className="block cursor-pointer truncate text-xs"
                                  >
                                    {tax.name}
                                  </Label>
                                </div>

                                <div className="col-span-2 flex items-center justify-center">
                                  <Switch
                                    id={`tax-${idx}`}
                                    checked={tax.enabled}
                                    onCheckedChange={async (val) => {
                                      const newTaxes = [...formData.tax_details]
                                      if (val) {
                                        const { data: taxSettings } =
                                          await supabase
                                            .from("app_settings")
                                            .select("*")
                                            .eq("category", "tax")
                                            .eq("name", tax.name)
                                            .single()
                                        if (taxSettings) {
                                          newTaxes[idx].rate = taxSettings.value
                                          setGlobalTaxes((prev) =>
                                            prev.map((gt) =>
                                              gt.name === tax.name
                                                ? {
                                                    ...gt,
                                                    value: taxSettings.value,
                                                  }
                                                : gt
                                            )
                                          )
                                        }
                                      }
                                      newTaxes[idx].enabled = val
                                      setFormData({
                                        ...formData,
                                        tax_details: newTaxes,
                                      })
                                    }}
                                  />
                                </div>

                                <div className="col-span-4">
                                  <div
                                    style={{ opacity: tax.enabled ? 1 : 0.3 }}
                                    className="w-full transition-opacity"
                                  >
                                    <NumberInput
                                      className="text-right font-mono text-xs"
                                      containerClassName="h-8 bg-muted/50"
                                      disabled
                                      value={tax.rate}
                                      onChange={() => {}}
                                      rightBadge="%"
                                    />
                                  </div>
                                </div>

                                <div className="col-span-3 flex justify-end">
                                  <span
                                    className={cn(
                                      "truncate text-right font-mono text-xs font-medium transition-opacity",
                                      tax.enabled
                                        ? "text-foreground opacity-100"
                                        : "text-muted-foreground opacity-30"
                                    )}
                                  >
                                    {SITE_CONFIG.currencySymbol}{" "}
                                    {Math.round(
                                      calculatedAmount
                                    ).toLocaleString()}
                                  </span>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4 border-t pt-4">
                    <RichTextEditor
                      label={dict.LABEL_CONTENT}
                      value={formData.content}
                      onChange={(val) =>
                        setFormData({ ...formData, content: val || "" })
                      }
                      isEnabled={formData.is_content_enabled}
                      readOnly={viewOnly}
                      onToggleEnabled={(val) =>
                        setFormData({ ...formData, is_content_enabled: val })
                      }
                      placeholder={dict.PLACEHOLDER_EDITOR}
                      variables={editorVariables}
                      variableValues={variableValues}
                    />
                    <RichTextEditor
                      label={dict.LABEL_NOTE}
                      value={formData.note}
                      onChange={(val) =>
                        setFormData({ ...formData, note: val || "" })
                      }
                      isEnabled={formData.is_note_enabled}
                      readOnly={viewOnly}
                      onToggleEnabled={(val) =>
                        setFormData({ ...formData, is_note_enabled: val })
                      }
                      placeholder={dict.PLACEHOLDER_EDITOR}
                      variables={editorVariables}
                      variableValues={variableValues}
                    />
                    <RichTextEditor
                      label={dict.LABEL_TERMS}
                      value={formData.terms_conditions}
                      onChange={(val) =>
                        setFormData({
                          ...formData,
                          terms_conditions: val || "",
                        })
                      }
                      isEnabled={formData.is_terms_enabled}
                      readOnly={viewOnly}
                      onToggleEnabled={(val) =>
                        setFormData({ ...formData, is_terms_enabled: val })
                      }
                      placeholder={dict.PLACEHOLDER_EDITOR}
                      variables={editorVariables}
                      variableValues={variableValues}
                    />
                    <RichTextEditor
                      label={dict.LABEL_CLOSING}
                      value={formData.closing_remarks}
                      onChange={(val) =>
                        setFormData({ ...formData, closing_remarks: val || "" })
                      }
                      isEnabled={formData.is_closing_enabled}
                      readOnly={viewOnly}
                      onToggleEnabled={(val) =>
                        setFormData({ ...formData, is_closing_enabled: val })
                      }
                      placeholder={dict.PLACEHOLDER_EDITOR}
                      variables={editorVariables}
                      variableValues={variableValues}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-6 border-t pt-4">
                    <div className="h-fit space-y-4 rounded-lg border bg-muted/10 p-4">
                      <Label className="text-base font-semibold">
                        {dict.LABEL_BANK_ACCOUNTS}
                      </Label>
                      <div className="flex flex-col gap-3">
                        {availableBanks.map((bank: any, idx) => {
                          const isSelected = formData.bank_accounts.some(
                            (b: any) => b.account_number === bank.account_number
                          )
                          return (
                            <div
                              key={idx}
                              className="flex items-start space-x-3 rounded border bg-background p-3"
                            >
                              <Checkbox
                                id={`bank-${idx}`}
                                checked={isSelected}
                                onCheckedChange={(checked) => {
                                  setFormData((prev) => ({
                                    ...prev,
                                    bank_accounts: checked
                                      ? [...prev.bank_accounts, bank]
                                      : prev.bank_accounts.filter(
                                          (b: any) =>
                                            b.account_number !==
                                            bank.account_number
                                        ),
                                  }))
                                }}
                              />
                              <Label
                                htmlFor={`bank-${idx}`}
                                className="flex w-full cursor-pointer flex-col gap-1 text-sm leading-tight font-normal"
                              >
                                <span className="font-semibold">
                                  {bank.name} - {bank.branch}
                                </span>
                                <span className="text-muted-foreground">
                                  {bank.account_number} a/n {bank.account_name}
                                </span>
                              </Label>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </form>
              {!viewOnly && (
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsOpen(false)}
                  >
                    <X data-icon="inline-start" />
                    {dict.BUTTON_CANCEL}
                  </Button>
                  <Button
                    type="submit"
                    form="quotation-form"
                    disabled={isSaving || (editingItem ? !canEdit : !canInsert)}
                  >
                    {isSaving ? (
                      <ButtonLoader />
                    ) : (
                      <Save data-icon="inline-start" />
                    )}{" "}
                    {dict.BUTTON_SAVE}
                  </Button>
                </DialogFooter>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="action-bar flex shrink-0 flex-col items-start gap-4 sm:flex-row sm:items-center">
        <div className="relative w-full max-w-sm flex-1">
          <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder={dict.PLACEHOLDER_SEARCH}
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Dialog open={isSortOpen} onOpenChange={setIsSortOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="h-9">
              <ArrowUpDown className="mr-2 size-4" />
              Sort
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{dict.TITLE_SORT_SETTINGS}</DialogTitle>
              <DialogDescription />
            </DialogHeader>
            <div className="flex flex-col gap-4 p-5">
              {sortLevels.map((level, index) => (
                <div key={level.id} className="flex items-center gap-3">
                  <div className="w-17 shrink-0 text-sm font-semibold text-muted-foreground">
                    {index === 0 ? dict.LABEL_SORT_BY : dict.LABEL_THEN_BY}
                  </div>
                  <Select
                    value={level.column}
                    onValueChange={(val) =>
                      updateSortLevel(level.id, "column", val)
                    }
                  >
                    <SelectTrigger className="h-9 flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {sortColumns.map((col) => (
                        <SelectItem key={col.value} value={col.value}>
                          {col.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9"
                    onClick={() =>
                      updateSortLevel(
                        level.id,
                        "direction",
                        level.direction === "asc" ? "desc" : "asc"
                      )
                    }
                  >
                    {level.direction === "asc" ? (
                      <ArrowUpAZ className="size-4" />
                    ) : (
                      <ArrowDownZA className="size-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-9 text-destructive"
                    disabled={sortLevels.length <= 1}
                    onClick={() => removeSortLevel(level.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="mt-2 w-fit"
                onClick={addSortLevel}
              >
                <Plus className="mr-2 size-4" />
                {dict.BUTTON_ADD_LEVEL}
              </Button>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsSortOpen(false)}>
                {dict.BUTTON_CANCEL}
              </Button>
              <Button onClick={() => setIsSortOpen(false)}>Apply</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card
        ref={containerRef}
        className="data-card custom-scrollbar flex-1 overflow-auto"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{dict.LABEL_QUOTATION_NUMBER}</TableHead>
              <TableHead>{dict.LABEL_COMPANY_NAME}</TableHead>
              <TableHead>{dict.LABEL_SKU}</TableHead>
              <TableHead className="text-center">
                {dict.LABEL_QUOTATION_DATE}
              </TableHead>
              <TableHead className="text-center">
                {dict.LABEL_EXPIRY_DATE}
              </TableHead>
              <TableHead className="text-right">
                {dict.LABEL_MIN_ORDER}
              </TableHead>
              <TableHead className="text-center">{dict.LABEL_STATUS}</TableHead>
              <TableHead className="text-right"> </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="p-0">
                  <SectionLoader />
                </TableCell>
              </TableRow>
            ) : sortedAndFilteredData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="py-10 text-center text-muted-foreground"
                >
                  {dict.NO_DATA}
                </TableCell>
              </TableRow>
            ) : (
              sortedAndFilteredData.map((q) => (
                <TableRow
                  key={q.id}
                  className={cn(
                    "group cursor-pointer",
                    updatedRowId === q.id && "animate-row-highlight"
                  )}
                  onDoubleClick={() => handleOpenDialog(q, true)}
                  onAnimationEnd={() => {
                    if (updatedRowId === q.id) setUpdatedRowId(null)
                  }}
                >
                  <TableCell className="font-medium">
                    {q.quotation_number}
                  </TableCell>
                  <TableCell>{q.company?.name || "-"}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {q.product?.sku || "-"}
                  </TableCell>
                  <TableCell className="text-center">
                    {format(new Date(q.quotation_date), "dd MMM yyyy")}
                  </TableCell>
                  <TableCell className="text-center">
                    <div>{format(new Date(q.expiry_date), "dd MMM yyyy")}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {q.expiry_days} days left
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {new Intl.NumberFormat(
                      lang === "id" ? "id-ID" : "en-US"
                    ).format(q.minimum_order)}
                  </TableCell>
                  <TableCell className="text-center align-middle">
                    <div
                      className={cn(
                        "inline-flex w-20 items-center justify-center rounded-full px-2 py-1 text-[10px] font-bold uppercase",
                        statusStyles[q.status]
                      )}
                    >
                      {q.status}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="table_action"
                        size="sm"
                        onClick={() => handleOpenDialog(q)}
                        disabled={!canEdit || q.status === "Processed"}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="table_action"
                        size="sm"
                        onClick={() => handlePrint(q)}
                        disabled={!canPrint}
                      >
                        <Printer className="size-4" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="secondary"
                            size="icon"
                            className="size-8"
                            disabled={
                              q.status === "Processed" ||
                              (!canEdit && !canDelete)
                            }
                          >
                            <ChevronDown className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                              <CheckCircle2 className="mr-2 size-4" /> Status
                            </DropdownMenuSubTrigger>
                            <DropdownMenuPortal>
                              <DropdownMenuSubContent>
                                <DropdownMenuItem
                                  onClick={() => updateStatus(q.id, "Draft")}
                                  disabled={!canEdit || !canDelete}
                                  className="font-medium text-zinc-600 dark:text-zinc-400"
                                >
                                  Draft
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => updateStatus(q.id, "Sent")}
                                  disabled={!canEdit || !canDelete}
                                  className="font-medium text-amber-600 dark:text-amber-400"
                                >
                                  Sent
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => updateStatus(q.id, "Accepted")}
                                  disabled={!canEdit}
                                  className="font-medium text-emerald-600 dark:text-emerald-400"
                                >
                                  Accepted
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => updateStatus(q.id, "Rejected")}
                                  disabled={!canEdit}
                                  className="font-medium text-rose-600 dark:text-rose-400"
                                >
                                  Rejected
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    updateStatus(q.id, "Processed")
                                  }
                                  disabled={!canEdit || !canDelete}
                                  className="font-medium text-blue-600 dark:text-blue-400"
                                >
                                  Processed
                                </DropdownMenuItem>
                              </DropdownMenuSubContent>
                            </DropdownMenuPortal>
                          </DropdownMenuSub>
                          {canDelete && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => handleDelete(q.id)}
                              >
                                <Trash2 className="mr-2 size-4" />{" "}
                                {dict.BUTTON_DELETE}
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}

            {/* Infinite Scroll Sentinel & Loader */}
            <TableRow ref={observerTarget} className="border-0">
              <TableCell colSpan={8} className="overflow-hidden border-0 p-0">
                {loadingMore && (
                  <div className="relative h-24 w-full">
                    <SectionLoader />
                  </div>
                )}
                {!hasMore && quotations.length > 0 && !loading && (
                  <div className="py-3 text-center text-xs text-danger/70 select-none">
                    — End of data —
                  </div>
                )}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>

      <div className="grid shrink-0 grid-cols-4 gap-2 md:gap-4">
        <SummaryCard
          label={dict.LABEL_TOTAL_QUOTATIONS || "Total Quotation"}
          value={stats.totalQuotations}
          icon={FileText}
          color="slate"
        />
        <SummaryCard
          label={dict.LABEL_DRAFT_QUOTATIONS || "Draft"}
          value={stats.draftQuotations}
          icon={FileEdit}
          color="blue"
        />
        <SummaryCard
          label={dict.LABEL_SENT_QUOTATIONS || "Sent"}
          value={stats.sentQuotations}
          icon={Send}
          color="amber"
        />
        <SummaryCard
          label={
            dict.LABEL_ALMOST_EXPIRED ||
            `Exp. < ${ALMOST_EXPIRED_DAYS_THRESHOLD} days`
          }
          value={stats.almostExpired}
          icon={AlertTriangle}
          color="red"
        />
      </div>

      {previewDoc && (
        <Gallery
          docs={[previewDoc]}
          initialIndex={0}
          labels={{
            previewDocument: "Preview Quotation",
            clickToPreview: "Click to preview",
            previousPage: "Previous",
            nextPage: "Next",
            pageLabel: "Page",
            closePreview: "Close",
            download: "Download PDF",
            sendEmail: "Send to Customer",
            confirmEmail: "Are you sure you want to send this quotation to",
          }}
          onDownload={handleDownload}
          onSendEmail={handleSendEmail}
          onClose={() => setPreviewDoc(null)}
        />
      )}

      <DeleteConfirmationDialog
        isOpen={deleteConfirm !== null}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        onConfirm={confirmDelete}
        title={dict.TITLE_DELETE || "Confirm Delete"}
        description={
          dict.MSG_DELETE_CONFIRM?.split("%data%")[0] ||
          "Are you sure you want to delete this quotation? This action cannot be undone."
        }
        dataName={
          deleteConfirm
            ? `${deleteConfirm.quotation_number} - ${deleteConfirm.company_name}`
            : ""
        }
        confirmText={dict.BUTTON_DELETE || "Delete"}
        cancelText={dict.BUTTON_CANCEL || "Cancel"}
        variant="destructive"
      />
    </div>
  )
}
