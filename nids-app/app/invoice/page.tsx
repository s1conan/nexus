/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/set-state-in-effect */
"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { useDictionary } from "@/components/dictionary-provider"
import { SITE_CONFIG } from "@/lib/site-content"
import { useAuth } from "@/components/auth-provider"
import { createClient } from "@/lib/supabase"
import { useDebounce } from "@/hooks/use-debounce"
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
  Trash2,
  ChevronDown,
  Receipt,
  AlertCircle,
  RefreshCw,
  Printer,
  Send,
  FileEdit,
  AlertTriangle,
  ArrowUpAZ,
  ArrowDownZA,
  ArrowUpDown,
  CheckCircle2,
  Info,
  Truck,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { SummaryCard } from "@/components/summary-card"
import { Checkbox } from "@/components/ui/checkbox"
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
  DialogFooter,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { cn, constructMultiWordSearch } from "@/lib/utils"
import { SectionLoader } from "@/components/section-loader"
import { notify } from "@/lib/notifications"
import { LiveSearch } from "@/components/live-search"
import { format } from "date-fns"
import { ButtonLoader } from "@/components/button-loader"
import { RichTextEditor } from "@/components/rich-text-editor"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { NumberInput } from "@/components/number-input"
import { DeleteConfirmationDialog } from "@/components/confirmation-dialog"
import { Switch } from "@/components/ui/switch"
import { usePersistedState } from "@/hooks/use-persisted-state"
import dynamic from "next/dynamic"

const Gallery = dynamic(() => import("@/components/Gallery"), { ssr: false })
import {
  generateStandardInvoicePDF,
  generateStandardDeliveryOrderPDF,
} from "@/lib/pdf-generator"

const PAGE_SIZE = 50

const INITIAL_ISSUE_DATE = format(new Date(), "yyyy-MM-dd")
const INITIAL_DUE_DATE = format(
  new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
  "yyyy-MM-dd"
)

interface SortLevel {
  id: string
  column: string
  direction: "asc" | "desc"
}

function calculateBilledQuantity(doInfo: any): number {
  if (!doInfo) return 0
  const qtySent = Number(doInfo.quantity) || 0
  const qtyReceived =
    doInfo.received_quantity !== null && doInfo.received_quantity !== undefined
      ? Number(doInfo.received_quantity)
      : null

  if (qtyReceived === null) {
    return qtySent
  }

  if (qtyReceived > qtySent) {
    return qtySent
  }

  const shrinkageLimitPercent = Number(doInfo.so?.shrinkage_tolerance) || 0
  const allowedShrinkage = qtySent * (shrinkageLimitPercent / 100)
  const actualShrinkage = qtySent - qtyReceived

  if (actualShrinkage > allowedShrinkage) {
    return qtyReceived
  }

  return qtySent
}

/**
 * Recomputes the invoice amounts from the row's joined DO/SO data using the
 * same quotation workflow as the PDF (base - discount + delivery; only PPN
 * includes the delivery fee in its base). Used so the list table always
 * matches the dialog/PDF even when the saved total_amount is stale.
 */
function calculateInvoiceTotals(inv: any): {
  subtotal: number
  taxTotal: number
  grandTotal: number
} {
  const soInfo = Array.isArray(inv?.po) ? inv.po[0] || {} : inv?.po || {}
  const quantity = Number(inv?.quantity) || 0
  const unitPrice = soInfo?.unit_price || 0
  const deliveryPerLitre = soInfo?.delivery_price_per_litre || 0
  const discountPercent = soInfo?.discount || 0
  const basePrice = quantity * unitPrice
  const afterDiscount = basePrice - basePrice * (discountPercent / 100)
  const deliveryTotal = quantity * deliveryPerLitre
  const subtotal = Math.max(0, Math.round(afterDiscount + deliveryTotal))
  const deliveryTaxable =
    soInfo?.delivery_taxable ?? inv?.delivery_taxable ?? false
  const taxDetails = Array.isArray(inv?.tax_details) ? inv.tax_details : []
  const taxTotal = taxDetails.reduce((sum: number, t: any) => {
    if (!t?.enabled) return sum
    const isPpn = String(t?.name || "")
      .toUpperCase()
      .includes("PPN")
    const taxableBase =
      afterDiscount + (deliveryTaxable && isPpn ? deliveryTotal : 0)
    return (
      sum +
      Math.round((Math.max(0, taxableBase) * (Number(t?.rate) || 0)) / 100)
    )
  }, 0)
  return { subtotal, taxTotal, grandTotal: subtotal + taxTotal }
}

export default function InvoicePage() {
  const { dict } = useDictionary()
  const { hasPermission, loading: authLoading } = useAuth()
  const supabase = createClient()

  const [invoices, setInvoices] = useState<any[]>([])
  const [updatedRowId, setUpdatedRowId] = useState<string | null>(null)
  const [availableBanks, setAvailableBanks] = useState<any[]>([])
  const [companyInfo, setCompanyInfo] = useState<any>(null)
  const [previewDoc, setPreviewDoc] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [offset, setOffset] = useState(0)
  const [isSaving, setIsSaving] = useState(false)

  // Dialog State
  const [isOpen, setIsOpen] = usePersistedState("invoice_dialog_open", false)
  const [isSortOpen, setIsSortOpen] = useState(false)
  const [editingItem, setEditingItem] = usePersistedState<any>(
    "invoice_editing_data",
    null
  )
  const [viewOnly, setViewOnly] = useState(false)

  // Filter States
  const [searchQuery, setSearchQuery] = usePersistedState("invoice_search", "")
  const [statusFilter, setStatusFilter] = usePersistedState(
    "invoice_status_filter",
    "all"
  )
  const debouncedSearchQuery = useDebounce(searchQuery, 300)

  // Stats State
  const [stats, setStats] = useState({
    draft: 0,
    sent: 0,
    overdue: 0,
    paid: 0,
  })

  // Delete Confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: string
    name: string
  } | null>(null)

  // Sorting
  const [sortLevels, setSortLevels] = useState<SortLevel[]>([
    { id: "1", column: "created_at", direction: "desc" },
  ])

  const observerTarget = useRef(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const statusStyles: Record<string, string> = {
    Draft:
      "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border border-zinc-500/20",
    Sent: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
    Partial:
      "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20",
    Paid: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
    Cancelled:
      "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20",
    Overdue:
      "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20",
  }

  // 1-char status badges for the DO/SO pickers — colors mirror the DO/SO pages
  const statusBadge = (
    status: string | undefined,
    map: Record<string, { label: string; className: string }>
  ) => {
    const fallback = {
      label: "?",
      className:
        "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border border-zinc-500/20",
    }
    const s = (status && map[status]) || fallback
    return (
      <span
        title={status || "-"}
        className={`inline-flex size-4 shrink-0 items-center justify-center rounded-full text-[9px] leading-none font-bold ${s.className}`}
      >
        {s.label}
      </span>
    )
  }
  const doStatusBadge = (status: string | undefined) =>
    statusBadge(status, {
      Draft: {
        label: "D",
        className:
          "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border border-zinc-500/20",
      },
      Shipped: {
        label: "S",
        className:
          "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20",
      },
      Delivered: {
        label: "✓",
        className:
          "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
      },
      Invoiced: {
        label: "I",
        className:
          "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20",
      },
      Cancelled: {
        label: "X",
        className:
          "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20",
      },
    })
  const soStatusBadge = (status: string | undefined) =>
    statusBadge(status, {
      Draft: {
        label: "D",
        className:
          "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border border-zinc-500/20",
      },
      Sent: {
        label: "S",
        className:
          "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
      },
      Approved: {
        label: "A",
        className:
          "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20",
      },
      Rejected: {
        label: "R",
        className:
          "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20",
      },
      Partial: {
        label: "P",
        className:
          "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20",
      },
      Fulfilled: {
        label: "✓",
        className:
          "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
      },
    })

  // Form State
  const [formData, setFormData] = usePersistedState("invoice_form_data_v3", {
    invoice_number: "",
    company_id: "",
    do_ids: [] as string[],
    so_id: "",
    address: "",
    issue_date: INITIAL_ISSUE_DATE,
    due_date: INITIAL_DUE_DATE,
    payment_days: 14,
    subtotal: 0,
    quantity: 0,
    status: "Draft",
    note: "",
    is_note_enabled: true,
    tax_details: [] as any[],
    bank_accounts: [] as any[],
    delivery_taxable: false,
  })

  const [selectedCompanyInfo, setSelectedCompanyInfo] = useState<any>(null)
  const [sourceMode, setSourceMode] = useState<"do" | "so">("do")
  const [selectedDOs, setSelectedDOs] = useState<any[]>([])
  const [selectedSOInfo, setSelectedSOInfo] = useState<any>(null)
  const [soDOs, setSoDOs] = useState<any[]>([])
  const [doSearchValue, setDoSearchValue] = useState("")

  const companyAddresses = useMemo(() => {
    if (!selectedCompanyInfo?.details?.addresses) return []
    return selectedCompanyInfo.details.addresses as {
      label: string
      address: string
    }[]
  }, [selectedCompanyInfo])

  // Permission Checks
  const canView = hasPermission("invoice", "view")
  const canInsert = hasPermission("invoice", "insert")
  const canEdit = hasPermission("invoice", "edit")
  const canDelete = hasPermission("invoice", "delete")
  const canPrint =
    hasPermission("invoice", "print") || hasPermission("invoice", "view") // Default print to view/print

  // Helper to resolve overdue status dynamically
  const getInvoiceStatus = useCallback((inv: any) => {
    if (inv.status === "Paid") return "Paid"
    if (inv.status === "Cancelled") return "Cancelled"
    if (inv.status === "Draft") return "Draft"
    const todayStr = format(new Date(), "yyyy-MM-dd")
    if (inv.due_date < todayStr) return "Overdue"
    return inv.status
  }, [])

  // Calculations
  const totals = useMemo(() => {
    const subtotal = formData.subtotal || 0
    const taxTotal = formData.tax_details.reduce(
      (sum: number, t: any) =>
        sum + (t.enabled ? (subtotal * (Number(t.rate) || 0)) / 100 : 0),
      0
    )
    const grandTotal = subtotal + taxTotal
    return { subtotal, taxTotal, grandTotal }
  }, [formData])

  const invoiceCalc = useMemo(() => {
    let soInfo: any = null
    let totalQty = 0

    if (sourceMode === "so") {
      soInfo = selectedSOInfo
      totalQty = Number(selectedSOInfo?.quantity) || 0
    } else {
      if (selectedDOs.length === 0) return null
      soInfo = selectedDOs[0].so
      totalQty = selectedDOs.reduce(
        (sum: number, d: any) => sum + calculateBilledQuantity(d),
        0
      )
    }

    if (!soInfo) return null

    const unitPrice = Number(soInfo.unit_price) || 0
    const discountPercent = Number(soInfo.discount) || 0
    const deliveryRate = Number(soInfo.delivery_price_per_litre) || 0
    const deliveryTaxable = soInfo.delivery_taxable ?? false
    const basePrice = totalQty * unitPrice
    const discountAmount = basePrice * (discountPercent / 100)
    const afterDiscount = basePrice - discountAmount
    const deliveryTotal = totalQty * deliveryRate
    const subtotal = Math.max(0, Math.round(afterDiscount + deliveryTotal))

    const appliedTaxes = (formData.tax_details || []).map((t: any) => {
      const rate = Number(t.rate) || 0
      const isPpn = String(t.name || "")
        .toUpperCase()
        .includes("PPN")
      const taxableBase =
        afterDiscount + (deliveryTaxable && isPpn ? deliveryTotal : 0)
      const amount = t.enabled
        ? Math.round((Math.max(0, taxableBase) * rate) / 100)
        : 0
      return { ...t, amount }
    })
    const taxTotal = appliedTaxes.reduce(
      (sum: number, t: any) => sum + t.amount,
      0
    )
    const grandTotal = subtotal + taxTotal

    return {
      soInfo,
      totalQty,
      unitPrice,
      basePrice,
      discountPercent,
      discountAmount,
      afterDiscount,
      deliveryRate,
      deliveryTotal,
      deliveryTaxable,
      subtotal,
      appliedTaxes,
      taxTotal,
      grandTotal,
    }
  }, [sourceMode, selectedDOs, selectedSOInfo, formData.tax_details])

  // Fetch Stats
  const fetchStats = useCallback(async () => {
    try {
      const todayStr = format(new Date(), "yyyy-MM-dd")
      const [
        { count: draftCount },
        { count: sentCount },
        { count: overdueCount },
        { count: paidCount },
      ] = await Promise.all([
        supabase
          .from("invoices")
          .select("*", { count: "exact", head: true })
          .eq("status", "Draft"),
        supabase
          .from("invoices")
          .select("*", { count: "exact", head: true })
          .in("status", ["Sent", "Partial"])
          .gte("due_date", todayStr),
        supabase
          .from("invoices")
          .select("*", { count: "exact", head: true })
          .in("status", ["Sent", "Partial"])
          .lt("due_date", todayStr),
        supabase
          .from("invoices")
          .select("*", { count: "exact", head: true })
          .eq("status", "Paid"),
      ])

      setStats({
        draft: draftCount || 0,
        sent: sentCount || 0,
        overdue: overdueCount || 0,
        paid: paidCount || 0,
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

        if (isInitial) {
          const [bRes, sRes] = await Promise.all([
            supabase
              .from("app_settings")
              .select("value")
              .eq("category", "company")
              .eq("name", "bank")
              .maybeSingle(),
            supabase.from("app_settings").select("*").eq("category", "company"),
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
        }

        let query = supabase
          .from("invoices")
          .select(
            "*, company:companies(id, name, nickname, details), po:sales_orders(id, so_number, po_number, so_date, unit_price, delivery_price_per_litre, discount, tax_details, shrinkage_tolerance, shrinkage_in_price, delivery_taxable, product:products(id, name, sku))"
          )
          .range(currentOffset, currentOffset + PAGE_SIZE - 1)

        if (statusFilter !== "all") {
          query = query.eq("status", statusFilter)
        }

        if (debouncedSearchQuery) {
          const companySearch = constructMultiWordSearch(debouncedSearchQuery, [
            "name",
          ])
          let companyIds: string[] = []
          if (companySearch) {
            const { data: companies } = await supabase
              .from("companies")
              .select("id")
              .or(companySearch)
            companyIds = (companies || []).map((c: any) => c.id)
          }

          const invoiceSearch = constructMultiWordSearch(debouncedSearchQuery, [
            "invoice_number",
          ])
          const orConditions: string[] = []
          if (invoiceSearch) {
            orConditions.push(invoiceSearch)
          }
          if (companyIds.length > 0) {
            orConditions.push(`company_id.in.(${companyIds.join(",")})`)
          }
          if (orConditions.length > 0) {
            query = query.or(orConditions.join(","))
          }
        }

        // Dynamic sorting
        sortLevels.forEach((level) => {
          const [, col] = level.column.split(".")
          if (col) {
            // Joined sorting
          } else {
            query = query.order(level.column, {
              ascending: level.direction === "asc",
            })
          }
        })

        // Ensure stable secondary sort
        query = query.order("created_at", { ascending: false })

        const { data, error } = await query
        if (error) throw error

        if (data) {
          if (isInitial) {
            setInvoices(data)
          } else {
            setInvoices((prev) => {
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
      statusFilter,
      sortLevels,
      dict.MSG_DATA_FETCH_FAILED,
      fetchStats,
    ]
  )

  const handleRefresh = () => {
    fetchData(true)
  }

  useEffect(() => {
    fetchData(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchQuery, statusFilter, sortLevels])

  // Ordinary Infinite Scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry.isIntersecting && hasMore && !loading && !loadingMore) {
          fetchData(false)
        }
      },
      {
        rootMargin: "400px",
        threshold: 0,
      }
    )

    if (observerTarget.current) {
      observer.observe(observerTarget.current)
    }

    return () => observer.disconnect()
  }, [fetchData, hasMore, loading, loadingMore])

  const fetchSODOs = useCallback(
    (soId: string) => {
      supabase
        .from("delivery_orders")
        .select("id, do_number, quantity, received_quantity, status, so_id")
        .eq("so_id", soId)
        .order("do_number", { ascending: true })
        .then(({ data }: { data: any }) => {
          setSoDOs(data || [])
        })
    },
    [supabase]
  )

  const handleAddDO = (item: any) => {
    if (!item) return
    // DOs without an SO cannot be invoiced — block selection
    if (!item.so) {
      notify.error(dict.MSG_VALIDATION_ERROR, dict.MSG_SO_REQUIRED_FOR_INVOICE)
      return
    }
    if (selectedDOs.some((d: any) => d.id === item.id)) return
    if (selectedDOs.length > 0) {
      const first = selectedDOs[0]
      if ((first.company?.id || "") !== (item.company?.id || "")) {
        notify.error(
          dict.MSG_VALIDATION_ERROR,
          dict.MSG_DO_SAME_COMPANY_REQUIRED
        )
        return
      }
      if (
        (first.so?.id || first.so_id || "") !==
        (item.so?.id || item.so_id || "")
      ) {
        notify.error(dict.MSG_VALIDATION_ERROR, dict.MSG_DO_SAME_SO_REQUIRED)
        return
      }
    } else {
      // First DO locks the company + SO and seeds pricing/tax from its SO
      const soTaxes = Array.isArray(item?.so?.tax_details)
        ? item.so.tax_details
        : []
      setFormData({
        ...formData,
        company_id: item.company?.id || "",
        so_id: item.so?.id || item.so_id || "",
        issue_date: item.do_date || formData.issue_date,
        tax_details: soTaxes,
        delivery_taxable: item?.so?.delivery_taxable ?? false,
        address: "",
      })
      setSelectedCompanyInfo(item.company || null)
    }
    setSelectedDOs((prev) => [...prev, item])
    setDoSearchValue("")
  }

  const handleRemoveDO = (doId: string) => {
    const next = selectedDOs.filter((d: any) => d.id !== doId)
    setSelectedDOs(next)
    if (next.length === 0) {
      setFormData((prev) => ({
        ...prev,
        company_id: "",
        so_id: "",
        tax_details: [],
        delivery_taxable: false,
        address: "",
        quantity: 0,
        subtotal: 0,
      }))
      setSelectedCompanyInfo(null)
    }
  }

  const handleSelectSO = (val: string, item: any) => {
    if (!item) {
      // Clear button — reset the SO selection
      setSelectedSOInfo(null)
      setSoDOs([])
      setFormData((prev) => ({
        ...prev,
        so_id: "",
        company_id: "",
        address: "",
        tax_details: [],
        delivery_taxable: false,
        quantity: 0,
        subtotal: 0,
      }))
      setSelectedCompanyInfo(null)
      return
    }
    setSelectedSOInfo(item)
    setSelectedCompanyInfo(item.company || null)
    const soTaxes = Array.isArray(item?.tax_details) ? item.tax_details : []
    setFormData({
      ...formData,
      company_id: item.company?.id || "",
      so_id: item.id,
      issue_date: item.so_date || formData.issue_date,
      tax_details: soTaxes,
      delivery_taxable: item?.delivery_taxable ?? false,
      address: "",
      quantity: Number(item.quantity) || 0,
    })
    if (item.id) fetchSODOs(item.id)
  }

  const switchSourceMode = (mode: "do" | "so") => {
    if (viewOnly || mode === sourceMode) return
    setSourceMode(mode)
    setSelectedDOs([])
    setSelectedSOInfo(null)
    setSoDOs([])
    setDoSearchValue("")
    setFormData((prev) => ({
      ...prev,
      do_ids: [],
      so_id: "",
      company_id: "",
      address: "",
      tax_details: [],
      delivery_taxable: false,
      quantity: 0,
      subtotal: 0,
    }))
    setSelectedCompanyInfo(null)
  }

  const handleOpenDialog = (item: any = null, isViewOnly = false) => {
    const shouldBeViewOnly =
      isViewOnly ||
      (item && (item.status === "Paid" || item.status === "Partial"))
    setViewOnly(shouldBeViewOnly)
    if (item) {
      setEditingItem(item)
      setSelectedCompanyInfo(item.company)
      setSelectedDOs([])
      setSelectedSOInfo(null)
      setSoDOs([])

      const itemDoIds = Array.isArray(item.do_ids) ? item.do_ids : []
      const mode: "do" | "so" = itemDoIds.length > 0 ? "do" : "so"
      setSourceMode(mode)

      const savedTaxes = Array.isArray(item.tax_details) ? item.tax_details : []
      const itemBankAccounts = Array.isArray(item.bank_accounts)
        ? item.bank_accounts
        : []
      const initialSelectedBanks = availableBanks.filter((availableBank) =>
        itemBankAccounts.some(
          (itemBank: any) =>
            itemBank.account_number === availableBank.account_number
        )
      )

      const pdDiff = Math.round(
        (new Date(item.due_date).getTime() -
          new Date(item.issue_date).getTime()) /
          (1000 * 60 * 60 * 24)
      )

      setFormData({
        invoice_number: item.invoice_number,
        company_id: item.company_id,
        do_ids: itemDoIds,
        so_id: item.so_id || "",
        address: item.address || "",
        issue_date: item.issue_date,
        due_date: item.due_date,
        payment_days: pdDiff > 0 ? pdDiff : 14,
        subtotal: item.subtotal,
        quantity: Number(item.quantity) || 0,
        status: item.status,
        note: item.note || "",
        is_note_enabled: item.is_note_enabled ?? true,
        tax_details: savedTaxes,
        bank_accounts: initialSelectedBanks,
        delivery_taxable: item.delivery_taxable ?? false,
      })

      if (mode === "do" && itemDoIds.length > 0) {
        supabase
          .from("delivery_orders")
          .select(
            "*, company:companies!delivery_orders_company_id_fkey(id, name, nickname, details), product:products(id, name, sku), so:sales_orders(id, so_number, po_number, so_date, unit_price, delivery_price_per_litre, discount, tax_details, shrinkage_tolerance, shrinkage_in_price, delivery_taxable)"
          )
          .in("id", itemDoIds)
          .order("do_number", { ascending: true })
          .then(({ data }: { data: any }) => {
            if (data && data.length > 0) {
              setSelectedDOs(data)
              setSelectedCompanyInfo(data[0].company || item.company)
            }
          })
      } else if (item.so_id) {
        // Preserve the invoice's stored billed quantity when re-opening
        // (falls back to the SO quantity for legacy rows without one)
        const soInfo = item.po
          ? {
              ...item.po,
              quantity: Number(item.quantity) || Number(item.po?.quantity) || 0,
            }
          : null
        setSelectedSOInfo(soInfo)
        fetchSODOs(item.so_id)
      }
    } else {
      if (!canInsert) return
      setEditingItem(null)
      setSelectedCompanyInfo(null)
      setSelectedDOs([])
      setSelectedSOInfo(null)
      setSoDOs([])
      setSourceMode("do")
      setDoSearchValue("")

      setFormData({
        invoice_number: "",
        company_id: "",
        do_ids: [],
        so_id: "",
        address: "",
        issue_date: format(new Date(), "yyyy-MM-dd"),
        due_date: format(
          new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          "yyyy-MM-dd"
        ),
        payment_days: 14,
        subtotal: 0,
        quantity: 0,
        status: "Draft",
        note: "",
        is_note_enabled: true,
        tax_details: [],
        bank_accounts: [],
        delivery_taxable: false,
      })
    }
    setIsOpen(true)
  }

  const handleSave = async () => {
    if (sourceMode === "do" && selectedDOs.length === 0) {
      notify.error(dict.MSG_VALIDATION_ERROR, dict.MSG_SELECT_AT_LEAST_ONE_DO)
      return
    }
    if (sourceMode === "so" && !selectedSOInfo) {
      notify.error(dict.MSG_VALIDATION_ERROR, dict.MSG_SELECT_SO)
      return
    }
    if (!formData.address?.trim()) {
      notify.error(
        "Validation Error",
        "Please select a customer address before saving"
      )
      return
    }
    setIsSaving(true)
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { payment_days, ...cleanFormData } = formData
      const doRefs = selectedDOs.map((d: any) => ({
        do_id: d.id,
        do_number: d.do_number,
        quantity: Number(d.quantity) || 0,
        received_quantity:
          d.received_quantity !== null && d.received_quantity !== undefined
            ? Number(d.received_quantity)
            : null,
      }))
      const doIds = selectedDOs.map((d: any) => d.id)
      const soId =
        sourceMode === "so"
          ? selectedSOInfo?.id
          : selectedDOs[0]?.so?.id || selectedDOs[0]?.so_id || ""

      const payload = {
        ...cleanFormData,
        do_ids: doIds,
        do_refs: doRefs,
        so_id: soId,
        quantity: invoiceCalc ? invoiceCalc.totalQty : formData.quantity,
        subtotal: invoiceCalc ? invoiceCalc.subtotal : formData.subtotal,
        tax_amount: invoiceCalc ? invoiceCalc.taxTotal : totals.taxTotal,
        total_amount: invoiceCalc ? invoiceCalc.grandTotal : totals.grandTotal,
      }

      if (!editingItem && !payload.invoice_number) {
        const { data, error: rpcError } = await supabase.rpc(
          "generate_document_number",
          { p_doc_type: "invoice", p_company_id: payload.company_id || null }
        )
        if (rpcError) throw rpcError
        payload.invoice_number = data
      }

      const updateDOStatus = async (ids: string[], status: string) => {
        if (ids.length > 0) {
          await supabase
            .from("delivery_orders")
            .update({ status })
            .in("id", ids)
        }
      }

      if (editingItem) {
        const oldDoIds = Array.isArray(editingItem.do_ids)
          ? editingItem.do_ids
          : []
        const newStatus = payload.status

        const { error } = await supabase
          .from("invoices")
          .update(payload)
          .eq("id", editingItem.id)
        if (error) throw error

        if (newStatus === "Cancelled") {
          await updateDOStatus(oldDoIds, "Delivered")
        } else {
          const removedDoIds = oldDoIds.filter(
            (id: string) => !doIds.includes(id)
          )
          const addedDoIds = doIds.filter(
            (id: string) => !oldDoIds.includes(id)
          )
          await updateDOStatus(removedDoIds, "Delivered")
          await updateDOStatus(addedDoIds, "Invoiced")
          if (editingItem.status === "Cancelled") {
            await updateDOStatus(doIds, "Invoiced")
          }
        }

        // Fetch updated row to keep local state in sync with relations
        const { data: updatedRow, error: fetchError } = await supabase
          .from("invoices")
          .select(
            "*, company:companies(id, name, nickname, details), po:sales_orders(id, so_number, po_number, so_date, unit_price, delivery_price_per_litre, discount, tax_details, shrinkage_tolerance, shrinkage_in_price, delivery_taxable, product:products(id, name, sku))"
          )
          .eq("id", editingItem.id)
          .single()

        if (!fetchError && updatedRow) {
          setInvoices((prev) =>
            prev.map((i) => (i.id === editingItem.id ? updatedRow : i))
          )
          setUpdatedRowId(editingItem.id)
        } else {
          fetchData(true)
        }
      } else {
        const { error } = await supabase.from("invoices").insert([payload])
        if (error) throw error

        await updateDOStatus(doIds, "Invoiced")
        fetchData(true)
      }

      const docLabel = `[${payload.invoice_number || formData.invoice_number}]`
      if (editingItem) {
        notify.success(
          dict.MSG_UPDATE_SUCCESS.replace("%data%", docLabel),
          dict.MSG_SUCCESS_UPDATE_DESC.replace("%entity%", "invoice").replace(
            "%company%",
            `[${selectedCompanyInfo?.name || ""}]`
          ),
          undefined,
          true
        )
      } else {
        notify.success(
          dict.MSG_SAVE_SUCCESS.replace("%data%", docLabel),
          dict.MSG_SUCCESS_SAVE_DESC.replace("%entity%", "invoice").replace(
            "%company%",
            `[${selectedCompanyInfo?.name || ""}]`
          ),
          undefined,
          true
        )
      }
      fetchStats()
      setIsOpen(false)
    } catch (err: any) {
      const docLabel = `[${formData.invoice_number}]`
      notify.error(
        dict.MSG_SAVE_FAILED.replace("%data%", docLabel),
        err.message
      )
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    const item = invoices.find((i) => i.id === id)
    if (!item) return
    setDeleteConfirm({ id: item.id, name: item.invoice_number })
  }

  const confirmDelete = async () => {
    if (!deleteConfirm) return
    const item = invoices.find((i) => i.id === deleteConfirm.id)
    const companyName = item?.company?.name || ""
    try {
      const { error } = await supabase
        .from("invoices")
        .delete()
        .eq("id", deleteConfirm.id)
      if (error) throw error

      const doIds = Array.isArray(item?.do_ids) ? item.do_ids : []
      if (doIds.length > 0) {
        await supabase
          .from("delivery_orders")
          .update({ status: "Delivered" })
          .in("id", doIds)
      }

      setInvoices((prev) => prev.filter((i) => i.id !== deleteConfirm.id))
      notify.deleted(
        dict.MSG_DELETE_SUCCESS.replace("%data%", `[${deleteConfirm.name}]`),
        dict.MSG_SUCCESS_DELETE_DESC.replace("%entity%", "invoice").replace(
          "%company%",
          `[${companyName}]`
        ),
        undefined,
        true
      )
      fetchStats()
    } catch (err: any) {
      notify.error(
        dict.MSG_SAVE_FAILED.replace("%data%", `[${deleteConfirm.name}]`),
        err.message
      )
    } finally {
      setDeleteConfirm(null)
    }
  }

  const updateStatus = async (id: string, status: string) => {
    const item = invoices.find((i) => i.id === id)
    if (!item) return
    const docLabel = `[${item.invoice_number}]`
    const oldStatus = item.status
    const companyName = item.company?.name || ""
    try {
      const { error } = await supabase
        .from("invoices")
        .update({ status })
        .eq("id", id)
      if (error) throw error

      const doIds = Array.isArray(item?.do_ids) ? item.do_ids : []
      if (doIds.length > 0) {
        if (status === "Cancelled" && oldStatus !== "Cancelled") {
          await supabase
            .from("delivery_orders")
            .update({ status: "Delivered" })
            .in("id", doIds)
        } else if (oldStatus === "Cancelled" && status !== "Cancelled") {
          await supabase
            .from("delivery_orders")
            .update({ status: "Invoiced" })
            .in("id", doIds)
        }
      }

      setInvoices((prev) =>
        prev.map((i) => (i.id === id ? { ...i, status } : i))
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

  // Linked Due Date Logic
  const handleDueDateChange = (dateStr: string) => {
    const iDate = new Date(formData.issue_date)
    const dDate = new Date(dateStr)
    const diffTime = dDate.getTime() - iDate.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    setFormData((prev) => ({
      ...prev,
      due_date: dateStr,
      payment_days: diffDays,
    }))
  }

  const handleDaysChange = (days: number) => {
    const iDate = new Date(formData.issue_date)
    const dDate = new Date(iDate.getTime() + days * 24 * 60 * 60 * 1000)
    setFormData((prev) => ({
      ...prev,
      payment_days: days,
      due_date: format(dDate, "yyyy-MM-dd"),
    }))
  }

  // Sorting handlers
  const addSortLevel = () =>
    setSortLevels([
      ...sortLevels,
      {
        id: Math.random().toString(),
        column: "invoice_number",
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleSave()
  }

  const handlePrint = async (q: any) => {
    if (!companyInfo) {
      notify.error(dict.MSG_SAVE_FAILED, "Company information not loaded yet.")
      return
    }
    try {
      const dataUri = await generateStandardInvoicePDF(companyInfo, q, {
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
        title: q.invoice_number,
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
    const nickname = doc.raw?.company?.nickname || doc.raw?.company?.name || ""
    link.download = `INV - ${nickname} - ${doc.title}.pdf`
    link.click()
    notify.success(
      dict.MSG_PRINT_SUCCESS || "Print Successful",
      (dict.MSG_PRINT_SUCCESS_DESC || "Document %data% downloaded.").replace(
        "%data%",
        `[${doc.title}]`
      ),
      undefined,
      false
    )
  }

  const handleSendEmail = async (doc: any) => {
    try {
      const inv = doc.raw || doc
      const { data: ccData } = await supabase
        .from("app_settings")
        .select("value")
        .eq("category", "email")
        .eq("name", "cc_invoice")
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
        .eq("name", "bcc_invoice")
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
      const pdfDataUri = await generateStandardInvoicePDF(companyInfo, inv, {
        save: false,
        output: "datauri",
      })
      if (!pdfDataUri) throw new Error("Failed to generate PDF for attachment.")
      const attachments = [
        {
          filename: `INV - ${inv.company?.nickname || inv.company?.name || ""} - ${doc.title}.pdf`,
          content: (pdfDataUri as string).split(",")[1],
        },
      ]

      // Attach Delivery Order PDF(s) when requested
      if (doc.includeDOPdfs) {
        const doRefs = Array.isArray(inv.do_refs) ? inv.do_refs : []
        let doIds = doRefs
          .map((r: any) => r.do_id)
          .filter((id: any) => !!id)

        // For SO-direct invoices (no do_refs), resolve DOs via the Sales Order
        if (doIds.length === 0 && inv.so_id) {
          const { data: soDos } = await supabase
            .from("delivery_orders")
            .select("id")
            .eq("so_id", inv.so_id)
          doIds = (soDos || []).map((d: any) => d.id).filter((id: any) => !!id)
        }

        if (doIds.length > 0) {
          const { data: doRecords, error: doError } = await supabase
            .from("delivery_orders")
            .select(
              "*, company:companies!delivery_orders_company_id_fkey(id, name, nickname, details), supplier:companies!delivery_orders_supplier_id_fkey(id, name), transporter:companies!delivery_orders_transporter_id_fkey(id, name), po:sales_orders(id, so_number, po_number, quantity, so_date, delivery_address), product:products(id, sku, name), vehicle:vehicles(id, license_number)"
            )
            .in("id", doIds)
          if (doError) {
            notify.error("Failed to load Delivery Orders", doError.message)
          } else if (doRecords && doRecords.length > 0) {
            for (const doRecord of doRecords) {
              try {
                const doDataUri = await generateStandardDeliveryOrderPDF(
                  companyInfo,
                  doRecord,
                  { save: false, output: "datauri" }
                )
                if (doDataUri) {
                  attachments.push({
                    filename: `DO - ${doRecord.company?.nickname || doRecord.company?.name || ""} - ${doRecord.do_number}.pdf`,
                    content: (doDataUri as string).split(",")[1],
                  })
                }
              } catch (doPdfErr: any) {
                notify.error(
                  `Failed to generate DO ${doRecord.do_number} PDF`,
                  doPdfErr.message
                )
              }
            }
          }
        } else {
          notify.error(
            "No Delivery Order found",
            "No linked Delivery Order could be found for this invoice."
          )
        }
      }

      // Append any user-uploaded extra files (tax invoice, PO, scanned DO, etc.)
      if (Array.isArray(doc.extraFiles) && doc.extraFiles.length > 0) {
        for (const file of doc.extraFiles) {
          if (file?.filename && file?.content) {
            attachments.push({
              filename: file.filename,
              content: file.content,
            })
          }
        }
      }

      // Build email HTML
      // Use the name of the contact person whose email was selected
      const selectedContact = doc.contacts?.find(
        (c: any) => c.email && c.email === doc.customerEmail
      )
      const customerName =
        selectedContact?.name || inv.company?.name || "Valued Customer"
      const issueDateStr = inv.issue_date
        ? new Date(inv.issue_date).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          })
        : "-"
      const dueDateStr = inv.due_date
        ? new Date(inv.due_date).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          })
        : "-"
      const doRefs = Array.isArray(inv.do_refs) ? inv.do_refs : []
      const doNumber = doRefs.map((r: any) => r.do_number).join(", ") || "-"
      const soNumber = inv.po?.so_number || "-"
      const totalAmount = inv.total_amount || 0

      const emailHtml = `<div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 800px; margin: 0 auto; padding: 0; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: #ffffff;">
        <div style="background: #00955c; padding: 32px 40px; text-align: center;">
          <h1 style="color: #ffffff; font-size: 28px; margin: 0 0 4px 0; font-weight: 700; letter-spacing: -0.5px;">PT Anugerah Buana Sriwijaya</h1>
          <p style="color: rgba(255,255,255,0.9); font-size: 14px; margin: 0;">Industrial Fuel Distributor</p>
        </div>
        <div style="background: #f8fafc; padding: 20px 40px; border-bottom: 1px solid #e2e8f0; text-align: center;">
          <span style="display: inline-block; background: #00955c; color: white; padding: 8px 24px; border-radius: 20px; font-size: 14px; font-weight: 600; letter-spacing: 0.5px;">INVOICE</span>
        </div>
        <div style="padding: 40px;">
          <p style="color: #1e293b; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">Dear <strong style="color: #00955c;">${customerName}</strong>,</p>
          <p style="color: #475569; font-size: 15px; line-height: 1.7; margin: 0 0 20px 0;">We hope this email finds you well. Please find below the summary of your invoice for payment.</p>
          <div style="background: #f8fafc; border-radius: 8px; padding: 24px; margin: 24px 0; border-left: 4px solid #00955c;">
            <h3 style="color: #1e293b; font-size: 16px; margin: 0 0 16px 0; font-weight: 600;">Invoice Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px; width: 35%;">Invoice No.</td>
                <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${inv.invoice_number || "-"}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Issue Date</td>
                <td style="padding: 8px 0; color: #1e293b; font-size: 14px;">${issueDateStr}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Due Date</td>
                <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600; color: #ef4444;">${dueDateStr}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">DO Reference</td>
                <td style="padding: 8px 0; color: #1e293b; font-size: 14px;">${doNumber}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">SO Reference</td>
                <td style="padding: 8px 0; color: #1e293b; font-size: 14px;">${soNumber}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px; border-top: 1px solid #e2e8f0; font-weight: 600;">Total Amount</td>
                <td style="padding: 8px 0; color: #00955c; font-size: 16px; font-weight: bold; border-top: 1px solid #e2e8f0;">Rp ${totalAmount.toLocaleString("id-ID")}</td>
              </tr>
            </table>
          </div>
          <p style="color: #475569; font-size: 15px; line-height: 1.7; margin: 24px 0;">The full invoice document is attached as a PDF. Please make the payment to the bank account specified in the attached invoice before the due date.</p>
          <p style="color: #475569; font-size: 15px; line-height: 1.7; margin: 24px 0 32px 0;">Should you have any questions or require further assistance, please contact our finance team.</p>
          <p style="color: #1e293b; font-size: 15px; line-height: 1.6; margin: 0;">Best regards,<br><strong style="font-size: 16px;">PT Anugerah Buana Sriwijaya</strong><br><span style="color: #64748b; font-size: 14px;">Finance Department</span></p>
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
          ...(ccList.length > 0 && { cc: ccList }),
          ...(bccList.length > 0 && { bcc: bccList }),
          subject: `Invoice ${doc.title} - PT Anugerah Buana Sriwijaya`,
          html: emailHtml,
          attachments,
        }),
      })
      const result = await res.json()
      if (result.success) {
        notify.success(
          dict.MSG_EMAIL_SENT_SUCCESS || "Email Sent Successfully",
          (
            dict.MSG_EMAIL_SENT_SUCCESS_DESC ||
            "Email for %data% has been sent."
          ).replace("%data%", `[${doc.title}]`),
          undefined,
          true
        )
        // Automatically set status to Sent
        updateStatus(inv.id, "Sent")
      } else throw new Error(result.error)
    } catch (err: any) {
      notify.error("Failed to send email", err.message)
    }
  }

  // Client side sorting and searching on fetched data
  const sortedAndFilteredData = useMemo(() => {
    const words = searchQuery.toLowerCase().split(/\s+/).filter(Boolean)
    let result = invoices

    if (words.length > 0) {
      result = invoices.filter((inv) => {
        const searchFields = [
          inv.invoice_number,
          inv.company?.name || "",
          (Array.isArray(inv.do_refs)
            ? inv.do_refs.map((r: any) => r.do_number).join(", ")
            : "") || "",
          inv.po?.so_number || "",
        ]
        return searchFields.some((field) => {
          const val = String(field).toLowerCase()
          return words.every((word) => val.includes(word))
        })
      })
    }

    return [...result].sort((a, b) => {
      for (const level of sortLevels) {
        let aVal =
          level.column === "company.name"
            ? a.company?.name || ""
            : a[level.column]
        let bVal =
          level.column === "company.name"
            ? b.company?.name || ""
            : b[level.column]

        // Resolve dynamic display status for sorting if status is sorted
        if (level.column === "status") {
          aVal = getInvoiceStatus(a)
          bVal = getInvoiceStatus(b)
        }

        if (aVal === bVal) continue
        const multiplier = level.direction === "asc" ? 1 : -1
        if (typeof aVal === "number" && typeof bVal === "number")
          return (aVal - bVal) * multiplier
        return String(aVal).localeCompare(String(bVal)) * multiplier
      }
      return 0
    })
  }, [invoices, searchQuery, sortLevels, getInvoiceStatus])

  const sortColumns = [
    {
      label: dict.LABEL_INVOICE_NUMBER || "Invoice Number",
      value: "invoice_number",
    },
    { label: dict.LABEL_COMPANY_NAME || "Company Name", value: "company.name" },
    { label: dict.LABEL_ISSUE_DATE || "Issue Date", value: "issue_date" },
    { label: dict.LABEL_DUE_DATE || "Due Date", value: "due_date" },
    { label: dict.LABEL_GRAND_TOTAL || "Total Amount", value: "total_amount" },
    { label: dict.LABEL_STATUS || "Status", value: "status" },
  ]

  const editorVariables = [
    {
      id: "invoice_number",
      label: dict.LABEL_INVOICE_NUMBER || "Invoice Number",
    },
    { id: "invoice_date", label: dict.LABEL_ISSUE_DATE || "Invoice Date" },
    { id: "due_date", label: dict.LABEL_DUE_DATE || "Due Date" },
    { id: "company_name", label: dict.LABEL_COMPANY_NAME || "Company Name" },
    {
      id: "contact_person",
      label: dict.LABEL_CONTACT_PERSON || "Contact Person",
    },
    { id: "product_name", label: dict.LABEL_PRODUCT_NAME || "Product Name" },
    { id: "do_number", label: dict.LABEL_DO_NUMBER || "DO Number" },
    { id: "shipment_date", label: dict.LABEL_SHIPMENT_DATE || "Shipment Date" },
    { id: "delivered_date", label: "Delivered Date" },
    { id: "quantity", label: "Quantity" },
    { id: "price", label: dict.LABEL_PRICE_PER_L || "Price" },
    { id: "subtotal", label: dict.LABEL_SUBTOTAL || "Subtotal" },
    { id: "grand_total", label: dict.LABEL_GRAND_TOTAL || "Grand Total" },
    { id: "bank_accounts", label: dict.LABEL_BANK_ACCOUNTS || "Bank Accounts" },
  ]

  const variableValues = {
    invoice_number:
      formData.invoice_number || dict.LABEL_AUTO_GENERATED || "Auto-Generated",
    invoice_date: formData.issue_date
      ? format(new Date(formData.issue_date), "dd MMMM yyyy")
      : "",
    due_date: formData.due_date
      ? format(new Date(formData.due_date), "dd MMMM yyyy")
      : "",
    company_name: selectedCompanyInfo?.name || "",
    contact_person:
      selectedCompanyInfo?.contact_person ||
      selectedCompanyInfo?.details?.contact_person ||
      "",
    product_name: invoiceCalc?.soInfo?.product?.name || "",
    do_number: selectedDOs.map((d: any) => d.do_number).join(", "),
    shipment_date: "",
    delivered_date: "",
    quantity: new Intl.NumberFormat().format(
      invoiceCalc ? invoiceCalc.totalQty : formData.quantity
    ),
    price: new Intl.NumberFormat().format(
      invoiceCalc ? invoiceCalc.unitPrice : 0
    ),
    subtotal: new Intl.NumberFormat().format(
      invoiceCalc ? invoiceCalc.subtotal : totals.subtotal
    ),
    grand_total: new Intl.NumberFormat().format(
      invoiceCalc ? invoiceCalc.grandTotal : totals.grandTotal
    ),
    bank_accounts: formData.bank_accounts.map((b: any) => b.name).join(", "),
  }

  // Shared DO/SO source-mode switch — defined outside the mode conditionals
  // so `sourceMode` isn't narrowed and it renders in both modes
  const sourceModeSwitch = (
    <div className="flex-start flex items-center gap-5 rounded-lg bg-muted/10 p-2">
      <span
        className={cn(
          "text-sm font-medium",
          sourceMode !== "do" && "text-muted-foreground"
        )}
      >
        {dict.LABEL_SOURCE_BY_DO}
      </span>
      <div className="flex flex-col items-center gap-0.5">
        <Switch
          checked={sourceMode === "so"}
          onCheckedChange={(checked) => switchSourceMode(checked ? "so" : "do")}
          disabled={viewOnly}
        />
      </div>
      <span
        className={cn(
          "text-sm font-medium",
          sourceMode !== "so" && "text-muted-foreground"
        )}
      >
        {dict.LABEL_SOURCE_BY_SO}
      </span>
    </div>
  )

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
          <Receipt className="size-5 text-primary" />
          {dict.MENU_INVOICE || "Invoices"}
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
                {dict.BUTTON_NEW_INVOICE || "New Invoice"}
              </Button>
            </DialogTrigger>
            <DialogContent className="overflow-hidden sm:max-w-3xl">
              <DialogHeader>
                <DialogTitle>
                  <Receipt className="mr-2 inline-block size-5" />
                  {viewOnly
                    ? formData.invoice_number
                    : editingItem
                      ? `${dict.BUTTON_EDIT || "Edit"} ${dict.MENU_INVOICE || "Invoice"}`
                      : `${dict.BUTTON_ADD || "New"} ${dict.MENU_INVOICE || "Invoice"}`}
                </DialogTitle>
                <DialogDescription />
              </DialogHeader>
              <form
                onSubmit={handleSubmit}
                id="invoice-form"
                className="relative max-h-[70vh] overflow-y-auto"
              >
                <div
                  className={cn(
                    `relative flex w-full flex-col gap-6 p-5 ${viewOnly ? "rounded-b-xl border-2 border-orange-500" : ""}`
                  )}
                >
                  {viewOnly && <div className="absolute inset-0 z-20"></div>}
                  <div className="space-y-6">
                    <div className="space-y-4">
                      {/* Invoice Number */}
                      <div className="grid gap-2">
                        <Label>
                          {dict.LABEL_INVOICE_NUMBER || "Invoice Number"}
                        </Label>
                        <Input
                          value={formData.invoice_number}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              invoice_number: e.target.value,
                            })
                          }
                          disabled={viewOnly || (editingItem && !canEdit)}
                          placeholder={dict.LABEL_AUTO_GENERATED}
                        />
                      </div>

                      {/* DO mode — multi-select picker */}
                      {sourceMode === "do" && (
                        <div className="grid gap-2">
                          <div className="flex items-center justify-between gap-2">
                            <Label className="flex items-center gap-1.5">
                              {dict.LABEL_DO_NUMBER || "Delivery Order"}
                              <span
                                className="text-xs font-bold text-destructive"
                                title="Required"
                              >
                                *
                              </span>
                            </Label>
                            {sourceModeSwitch}
                          </div>
                          <LiveSearch
                            key={`do-picker-${selectedDOs.length}`}
                            data={[]}
                            fetchData={async (query) => {
                              try {
                                let q = supabase
                                  .from("delivery_orders")
                                  .select(
                                    "*, company:companies!delivery_orders_company_id_fkey!inner(id, name, nickname, details), product:products(id, name, sku), so:sales_orders(id, so_number, po_number, so_date, unit_price, delivery_price_per_litre, discount, tax_details, shrinkage_tolerance, shrinkage_in_price, delivery_taxable)"
                                  )
                                  .in("status", ["Shipped", "Delivered"])
                                  .limit(8)
                                // Once a first DO is chosen, only DOs of the
                                // same SO + company may be added
                                if (selectedDOs.length > 0) {
                                  const first = selectedDOs[0]
                                  const lockedSoId = first.so?.id || first.so_id
                                  if (lockedSoId) q = q.eq("so_id", lockedSoId)
                                  if (first.company?.id)
                                    q = q.eq("company_id", first.company.id)
                                  const takenIds = selectedDOs.map(
                                    (d: any) => d.id
                                  )
                                  if (takenIds.length > 0)
                                    q = q.not(
                                      "id",
                                      "in",
                                      `(${takenIds.join(",")})`
                                    )
                                }
                                if (query) {
                                  const doSearch = constructMultiWordSearch(
                                    query,
                                    ["do_number"]
                                  )
                                  const companySearch =
                                    constructMultiWordSearch(query, ["name"])
                                  const { data: companies } = companySearch
                                    ? await supabase
                                        .from("companies")
                                        .select("id")
                                        .or(companySearch)
                                    : { data: [] }
                                  const companyIds = (companies || []).map(
                                    (c: any) => c.id
                                  )
                                  const orConditions: string[] = []
                                  if (doSearch) orConditions.push(doSearch)
                                  if (companyIds.length > 0)
                                    orConditions.push(
                                      `company_id.in.(${companyIds.join(",")})`
                                    )
                                  if (orConditions.length > 0)
                                    q = q.or(orConditions.join(","))
                                }
                                const { data } = await q
                                return data || []
                              } catch {
                                return []
                              }
                            }}
                            value={doSearchValue}
                            onSelect={(_val, item) => handleAddDO(item)}
                            keyField="id"
                            displayField={(d: any) =>
                              `${d.do_number} - ${d.company?.name || ""}`
                            }
                            defaultDisplay=""
                            searchColumns={["do_number", "company.name"]}
                            visualColumns={[
                              {
                                key: "status",
                                header: "",
                                className: "w-8 shrink-0",
                                render: (d) => doStatusBadge(d.status),
                              },
                              {
                                key: "do_number",
                                header: dict.LABEL_DO_NUMBER,
                                className: "w-2/5",
                                primary: true,
                              },
                              {
                                key: "company.name",
                                header: dict.LABEL_COMPANY_NAME,
                                className: "w-2/5",
                              },
                              {
                                key: "so.so_number",
                                header: dict.LABEL_SO_NUMBER,
                                className: "w-1/5",
                                render: (d) =>
                                  d.so?.so_number ? (
                                    <span className="font-mono">
                                      {d.so.so_number}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold whitespace-nowrap text-amber-600 dark:text-amber-400">
                                      {dict.LABEL_SO_PENDING}
                                    </span>
                                  ),
                              },
                            ]}
                            placeholder={dict.LABEL_ADD_DO || "Add DO..."}
                            emptyMessage={dict.NO_DATA}
                            disabled={viewOnly}
                          />
                          {selectedDOs.length > 0 && (
                            <div className="space-y-1.5">
                              {selectedDOs.map((d: any) => (
                                <div
                                  key={d.id}
                                  className="flex items-center justify-between rounded border bg-background px-3 py-2 text-sm"
                                >
                                  <div className="flex min-w-0 items-center gap-2">
                                    <Truck className="size-4 shrink-0 text-muted-foreground" />
                                    <span className="truncate font-mono font-medium">
                                      {d.do_number}
                                    </span>
                                    <span className="shrink-0 font-mono text-xs text-muted-foreground">
                                      {Number(d.quantity || 0).toLocaleString()}{" "}
                                      L
                                    </span>
                                  </div>
                                  {!viewOnly && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="size-6 shrink-0 text-destructive"
                                      onClick={() => handleRemoveDO(d.id)}
                                    >
                                      <X className="size-3.5" />
                                    </Button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* SO mode — direct Sales Order picker */}
                      {sourceMode === "so" && (
                        <div className="grid gap-2">
                          <div className="flex items-center justify-between gap-2">
                            <Label className="flex items-center gap-1.5">
                              {dict.LABEL_SO_REQUIRED || "Sales Order"}
                              <span
                                className="text-xs font-bold text-destructive"
                                title="Required"
                              >
                                *
                              </span>
                            </Label>
                            {sourceModeSwitch}
                          </div>
                          <LiveSearch
                            data={selectedSOInfo ? [selectedSOInfo] : []}
                            fetchData={async (query) => {
                              try {
                                let q = supabase
                                  .from("sales_orders")
                                  .select(
                                    "*, company:companies(id, name, nickname, details), product:products(id, name, sku)"
                                  )
                                  .in("status", [
                                    "Sent",
                                    "Approved",
                                    "Partial",
                                    "Fulfilled",
                                  ])
                                  .limit(8)
                                if (query) {
                                  const soSearch = constructMultiWordSearch(
                                    query,
                                    ["so_number"]
                                  )
                                  const companySearch =
                                    constructMultiWordSearch(query, ["name"])
                                  const { data: companies } = companySearch
                                    ? await supabase
                                        .from("companies")
                                        .select("id")
                                        .or(companySearch)
                                    : { data: [] }
                                  const companyIds = (companies || []).map(
                                    (c: any) => c.id
                                  )
                                  const orConditions: string[] = []
                                  if (soSearch) orConditions.push(soSearch)
                                  if (companyIds.length > 0)
                                    orConditions.push(
                                      `company_id.in.(${companyIds.join(",")})`
                                    )
                                  if (orConditions.length > 0)
                                    q = q.or(orConditions.join(","))
                                }
                                const { data } = await q
                                return data || []
                              } catch {
                                return []
                              }
                            }}
                            value={selectedSOInfo?.id || ""}
                            onSelect={(val, item) => handleSelectSO(val, item)}
                            keyField="id"
                            displayField={(s: any) =>
                              `${s.so_number} - ${s.company?.name || ""}`
                            }
                            defaultDisplay={
                              selectedSOInfo
                                ? `${selectedSOInfo.so_number} - ${selectedSOInfo.company?.name || selectedCompanyInfo?.name || ""}`
                                : ""
                            }
                            searchColumns={["so_number", "company.name"]}
                            visualColumns={[
                              {
                                key: "status",
                                header: "",
                                className: "w-8 shrink-0",
                                render: (s) => soStatusBadge(s.status),
                              },
                              {
                                key: "so_number",
                                header: dict.LABEL_SO_NUMBER,
                                className: "w-2/5",
                                primary: true,
                              },
                              {
                                key: "company.name",
                                header: dict.LABEL_COMPANY_NAME,
                                className: "w-2/5",
                              },
                              {
                                key: "quantity",
                                header: dict.LABEL_QUANTITY,
                                className: "w-1/5",
                                render: (s) => (
                                  <span className="font-mono">
                                    {Number(s.quantity || 0).toLocaleString()} L
                                  </span>
                                ),
                              },
                            ]}
                            placeholder={
                              dict.PLACEHOLDER_SELECT_SO_INVOICE ||
                              "Search SO number..."
                            }
                            emptyMessage={dict.NO_DATA}
                            disabled={viewOnly}
                          />
                        </div>
                      )}

                      {/* Customer Address — required */}
                      <div className="grid gap-2">
                        <Label className="flex items-center gap-1.5">
                          {dict.LABEL_ADDRESS || "Address"}
                          <span
                            className="text-xs font-bold text-destructive"
                            title="Required"
                          >
                            *
                          </span>
                        </Label>
                        {companyAddresses.length > 0 ? (
                          <Select
                            value={formData.address}
                            onValueChange={(val) =>
                              setFormData({ ...formData, address: val })
                            }
                            disabled={viewOnly}
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
                            value={formData.address || ""}
                            className="h-13"
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                address: e.target.value,
                              })
                            }
                            placeholder={dict.PLACEHOLDER_ENTER_ADDRESS}
                            disabled={viewOnly}
                          />
                        )}
                      </div>

                      {/* Dates & Status panel */}
                      <div className="grid grid-cols-1 gap-4 rounded-lg border bg-muted/10 p-4 md:grid-cols-3">
                        <div className="grid gap-2">
                          <Label className="flex items-center gap-2">
                            <Receipt className="size-4" />{" "}
                            {dict.LABEL_ISSUE_DATE || "Issue Date"}
                          </Label>
                          <Input
                            type="date"
                            value={formData.issue_date}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                issue_date: e.target.value,
                              })
                            }
                            disabled={viewOnly}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label className="flex items-center gap-2">
                            <RefreshCw className="size-4" /> Payment Days
                          </Label>
                          <NumberInput
                            value={formData.payment_days}
                            onChange={(val) => handleDaysChange(val)}
                            rightBadge="Hari"
                            disabled={viewOnly}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label className="flex items-center gap-2">
                            <AlertCircle className="size-4" />{" "}
                            {dict.LABEL_DUE_DATE || "Due Date"}
                          </Label>
                          <Input
                            type="date"
                            value={formData.due_date}
                            onChange={(e) =>
                              handleDueDateChange(e.target.value)
                            }
                            disabled={viewOnly}
                          />
                        </div>
                      </div>

                      {/* Invoice Summary Panel — visible after DO(s)/SO selected */}
                      {invoiceCalc && (
                        <div className="overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm">
                          {/* Header banner showing summary + SO link */}
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-4 py-3">
                            <div className="flex items-center gap-2 text-xs font-semibold text-primary md:text-sm">
                              <Info className="size-4" />
                              <span>
                                {dict.LABEL_REVIEW_SUMMARY || "Review Summary"}
                              </span>
                            </div>
                            <div className="text-xs font-medium text-muted-foreground md:text-sm">
                              {dict.MENU_SALES_ORDER || "Sales Order"}:{" "}
                              <span className="font-mono font-semibold">
                                {invoiceCalc.soInfo?.so_number || "-"}
                              </span>
                            </div>
                          </div>

                          <div className="space-y-4 p-4 text-sm">
                            {/* DO List — DO mode */}
                            {sourceMode === "do" && selectedDOs.length > 0 && (
                              <div className="space-y-1.5 border-b pb-3">
                                <div className="text-xs font-bold tracking-wider text-muted-foreground uppercase md:text-sm">
                                  {dict.LABEL_DO_LIST || "DO List"}
                                </div>
                                {selectedDOs.map((d: any) => (
                                  <div
                                    key={d.id}
                                    className="flex items-center justify-between text-xs md:text-sm"
                                  >
                                    <span className="font-mono">
                                      {d.do_number}
                                    </span>
                                    <span className="font-mono">
                                      {Number(
                                        calculateBilledQuantity(d)
                                      ).toLocaleString()}{" "}
                                      L
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Delivery Progress — SO mode */}
                            {sourceMode === "so" && (
                              <div className="space-y-1.5 border-b pb-3">
                                <div className="text-xs font-bold tracking-wider text-muted-foreground uppercase md:text-sm">
                                  {dict.LABEL_DELIVERY_PROGRESS ||
                                    "Delivery Progress"}
                                </div>
                                {soDOs.length === 0 ? (
                                  <div className="text-xs text-muted-foreground">
                                    {dict.NO_DATA}
                                  </div>
                                ) : (
                                  <>
                                    {soDOs.map((d: any) => (
                                      <div
                                        key={d.id}
                                        className="flex items-center justify-between text-xs md:text-sm"
                                      >
                                        <span className="font-mono">
                                          {d.do_number}
                                        </span>
                                        <span className="flex items-center gap-2">
                                          <span className="font-mono">
                                            {Number(
                                              d.quantity || 0
                                            ).toLocaleString()}{" "}
                                            L
                                          </span>
                                          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground uppercase">
                                            {d.status}
                                          </span>
                                        </span>
                                      </div>
                                    ))}
                                    {(() => {
                                      const receivedTotal = soDOs.reduce(
                                        (sum: number, d: any) =>
                                          sum +
                                          (d.received_quantity != null
                                            ? Number(d.received_quantity)
                                            : 0),
                                        0
                                      )
                                      const soQty =
                                        Number(invoiceCalc.soInfo?.quantity) ||
                                        0
                                      if (soQty <= 0 || receivedTotal >= soQty)
                                        return null
                                      return (
                                        <div className="flex items-start gap-2 rounded border border-amber-500/20 bg-amber-500/10 px-2.5 py-1.5 text-[11px] leading-snug text-amber-600 dark:text-amber-400">
                                          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                                          <span>
                                            {dict.MSG_INCOMPLETE_DELIVERY.replace(
                                              "%delivered%",
                                              receivedTotal.toLocaleString()
                                            ).replace(
                                              "%total%",
                                              soQty.toLocaleString()
                                            )}
                                          </span>
                                        </div>
                                      )
                                    })()}
                                  </>
                                )}
                              </div>
                            )}

                            {/* Calculation Section */}
                            <div className="space-y-2.5">
                              <div className="text-xs font-bold tracking-wider text-muted-foreground uppercase md:text-sm">
                                {dict.LABEL_CALCULATION_DETAILS ||
                                  "Calculation Details"}
                              </div>
                              <div className="space-y-2">
                                {/* Base Price */}
                                <div className="flex items-center justify-between text-xs md:text-sm">
                                  <div className="flex flex-col">
                                    <span className="font-medium text-foreground">
                                      {dict.LABEL_BASE_PRICE || "Base Price"}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground md:text-xs">
                                      {Number(
                                        invoiceCalc.totalQty
                                      ).toLocaleString()}{" "}
                                      L × {SITE_CONFIG.currencySymbol}{" "}
                                      {Number(
                                        invoiceCalc.unitPrice
                                      ).toLocaleString()}
                                    </span>
                                  </div>
                                  <span className="font-mono font-medium">
                                    {SITE_CONFIG.currencySymbol}{" "}
                                    {Math.round(
                                      invoiceCalc.basePrice
                                    ).toLocaleString()}
                                  </span>
                                </div>

                                {/* Discount */}
                                {invoiceCalc.discountAmount > 0 && (
                                  <div className="flex items-center justify-between text-xs md:text-sm">
                                    <div className="flex flex-col">
                                      <span className="font-medium text-red-600 dark:text-red-400">
                                        {dict.LABEL_PRICE_DISCOUNT ||
                                          "Price Discount"}
                                      </span>
                                      <span className="text-[10px] text-muted-foreground md:text-xs">
                                        {invoiceCalc.discountPercent}%
                                      </span>
                                    </div>
                                    <span className="font-mono font-medium text-red-600 dark:text-red-400">
                                      - {SITE_CONFIG.currencySymbol}{" "}
                                      {Math.round(
                                        invoiceCalc.discountAmount
                                      ).toLocaleString()}
                                    </span>
                                  </div>
                                )}

                                {/* Delivery Fee */}
                                {invoiceCalc.deliveryTotal > 0 && (
                                  <div className="flex items-center justify-between text-xs md:text-sm">
                                    <div className="flex flex-col">
                                      <span className="font-medium text-emerald-600 dark:text-emerald-400">
                                        {dict.LABEL_DELIVERY_FEE ||
                                          "Delivery Fee"}
                                      </span>
                                      <span className="text-[10px] text-muted-foreground md:text-xs">
                                        {Number(
                                          invoiceCalc.totalQty
                                        ).toLocaleString()}{" "}
                                        L × {SITE_CONFIG.currencySymbol}{" "}
                                        {Number(
                                          invoiceCalc.deliveryRate
                                        ).toLocaleString()}
                                        /L
                                      </span>
                                    </div>
                                    <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">
                                      + {SITE_CONFIG.currencySymbol}{" "}
                                      {Math.round(
                                        invoiceCalc.deliveryTotal
                                      ).toLocaleString()}
                                    </span>
                                  </div>
                                )}

                                {/* Subtotal Divider */}
                                <div className="flex items-center justify-between border-t pt-2 text-xs font-bold md:text-sm">
                                  <span>
                                    {dict.LABEL_SUBTOTAL || "Subtotal"}
                                  </span>
                                  <span className="font-mono">
                                    {SITE_CONFIG.currencySymbol}{" "}
                                    {Math.round(
                                      invoiceCalc.subtotal
                                    ).toLocaleString()}
                                  </span>
                                </div>

                                {/* Taxes */}
                                {invoiceCalc.appliedTaxes.map(
                                  (tax: any, idx: number) => {
                                    if (!tax.enabled) return null
                                    return (
                                      <div
                                        key={idx}
                                        className="flex items-center justify-between text-xs md:text-sm"
                                      >
                                        <span className="font-medium text-muted-foreground">
                                          {tax.name} ({tax.rate}%)
                                        </span>
                                        <span className="font-mono font-medium text-muted-foreground">
                                          + {SITE_CONFIG.currencySymbol}{" "}
                                          {Math.round(
                                            tax.amount
                                          ).toLocaleString()}
                                        </span>
                                      </div>
                                    )
                                  }
                                )}

                                {/* Grand Total */}
                                <div className="flex items-center justify-between border-t pt-2 text-sm font-bold md:text-base">
                                  <span>
                                    {dict.LABEL_GRAND_TOTAL || "Grand Total"}
                                  </span>
                                  <span className="font-mono text-base text-primary md:text-lg">
                                    {SITE_CONFIG.currencySymbol}{" "}
                                    {Math.round(
                                      invoiceCalc.grandTotal
                                    ).toLocaleString()}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Notes Rich Text Editor */}
                  <div className="space-y-6 border-t pt-4">
                    <RichTextEditor
                      label={dict.LABEL_NOTE}
                      value={formData.note}
                      onChange={(val) =>
                        setFormData({ ...formData, note: val || "" })
                      }
                      placeholder={dict.PLACEHOLDER_EDITOR}
                      isEnabled={formData.is_note_enabled}
                      readOnly={viewOnly}
                      onToggleEnabled={(val) =>
                        setFormData({ ...formData, is_note_enabled: val })
                      }
                      variables={editorVariables}
                      variableValues={variableValues}
                    />
                  </div>

                  {/* Selected Bank Accounts - exact copy style of Quotation page */}
                  <div className="grid grid-cols-1 border-t pt-4">
                    <div className="h-fit space-y-4 rounded-lg border bg-muted/10 p-4">
                      <Label className="text-base font-semibold">
                        {dict.LABEL_BANK_ACCOUNTS || "Bank Accounts"}
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
                                disabled={viewOnly}
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
                    form="invoice-form"
                    disabled={isSaving || !canEdit}
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

      {/* Action bar and Sort Settings - exact copy style of Quotation page */}
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
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-full sm:w-[180px]">
            <SelectValue placeholder={dict.LABEL_STATUS} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{dict.LABEL_ALL || "All"}</SelectItem>
            <SelectItem value="Draft">Draft</SelectItem>
            <SelectItem value="Sent">Sent</SelectItem>
            <SelectItem value="Partial">Partial</SelectItem>
            <SelectItem value="Paid">Paid</SelectItem>
            <SelectItem value="Cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>

        <Dialog open={isSortOpen} onOpenChange={setIsSortOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="h-9">
              <ArrowUpDown className="mr-2 size-4" />
              Sort
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>
                {dict.TITLE_SORT_SETTINGS || "Sort Settings"}
              </DialogTitle>
              <DialogDescription />
            </DialogHeader>
            <div className="flex flex-col gap-4 p-5">
              {sortLevels.map((level, index) => (
                <div key={level.id} className="flex items-center gap-3">
                  <div className="w-17 shrink-0 text-sm font-semibold text-muted-foreground">
                    {index === 0
                      ? dict.LABEL_SORT_BY || "Sort by"
                      : dict.LABEL_THEN_BY || "Then by"}
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
                {dict.BUTTON_ADD_LEVEL || "Add Level"}
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

      {/* Data Table */}
      <Card
        ref={containerRef}
        className="data-card custom-scrollbar flex-1 overflow-auto"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{dict.LABEL_INVOICE_NUMBER || "Invoice No"}</TableHead>
              <TableHead>{dict.LABEL_COMPANY_NAME || "Company"}</TableHead>
              <TableHead className="text-center">
                {dict.LABEL_DATES || "Dates"}
              </TableHead>
              <TableHead className="text-right">
                {dict.LABEL_AMOUNTS || "Amounts"}
              </TableHead>
              <TableHead className="text-center">{dict.LABEL_STATUS}</TableHead>
              <TableHead className="text-right"> </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="p-0">
                  <SectionLoader />
                </TableCell>
              </TableRow>
            ) : sortedAndFilteredData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-10 text-center text-muted-foreground"
                >
                  {dict.NO_DATA}
                </TableCell>
              </TableRow>
            ) : (
              sortedAndFilteredData.map((i) => {
                const displayStatus = getInvoiceStatus(i)
                const amounts = calculateInvoiceTotals(i)
                return (
                  <TableRow
                    key={i.id}
                    className={cn(
                      "group cursor-pointer",
                      updatedRowId === i.id && "animate-row-highlight"
                    )}
                    onDoubleClick={() => handleOpenDialog(i, true)}
                    onAnimationEnd={() => {
                      if (updatedRowId === i.id) setUpdatedRowId(null)
                    }}
                  >
                    <TableCell className="font-medium">
                      <div className="font-mono text-sm font-bold">
                        {i.invoice_number}
                      </div>
                      {Array.isArray(i.do_refs) && i.do_refs.length > 0 && (
                        <div
                          className="max-w-[220px] truncate font-mono text-[11px] text-muted-foreground"
                          title={i.do_refs
                            .map((r: any) => r.do_number)
                            .join(", ")}
                        >
                          DO:{" "}
                          {i.do_refs.map((r: any) => r.do_number).join(", ")}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div>{i.company?.name || "-"}</div>
                      {i.po?.product && (
                        <div
                          className="max-w-[220px] truncate text-[11px] text-muted-foreground"
                          title={i.po.product.name}
                        >
                          {i.po.product.sku
                            ? `${i.po.product.sku} - ${i.po.product.name}`
                            : i.po.product.name}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="text-xs">
                        {dict.LABEL_ISSUE_DATE?.split(" ")[0] || "Issue"}:{" "}
                        {format(new Date(i.issue_date), "dd MMM yyyy")}
                      </div>
                      <div className="text-xs font-medium text-destructive">
                        {dict.LABEL_DUE_DATE?.split(" ")[0] || "Due"}:{" "}
                        {format(new Date(i.due_date), "dd MMM yyyy")}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="font-mono font-bold">
                        {SITE_CONFIG.currencySymbol}{" "}
                        {amounts.grandTotal.toLocaleString()}
                      </div>
                      <div className="font-mono text-xs text-green-600">
                        {dict.LABEL_PAID || "Paid"}:{" "}
                        {SITE_CONFIG.currencySymbol}{" "}
                        {Number(i.paid_amount).toLocaleString()}
                      </div>
                      <div className="font-mono text-[11px] text-muted-foreground">
                        Qty: {Number(i.quantity || 0).toLocaleString()} L
                      </div>
                    </TableCell>
                    <TableCell className="text-center align-middle">
                      <span
                        className={cn(
                          "inline-flex w-20 items-center justify-center rounded-full px-2 py-1 text-[10px] font-bold uppercase",
                          statusStyles[displayStatus] || statusStyles.Draft
                        )}
                      >
                        {displayStatus}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="table_action"
                          size="sm"
                          onClick={() => handleOpenDialog(i)}
                          disabled={
                            !canEdit ||
                            i.status === "Paid" ||
                            i.status === "Partial"
                          }
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="table_action"
                          size="sm"
                          onClick={() => handlePrint(i)}
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
                                i.status === "Paid" ||
                                i.status === "Partial" ||
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
                                    onClick={() => updateStatus(i.id, "Draft")}
                                    disabled={!canEdit}
                                    className="font-medium text-zinc-600 dark:text-zinc-400"
                                  >
                                    Draft
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => updateStatus(i.id, "Sent")}
                                    disabled={!canEdit}
                                    className="font-medium text-amber-600 dark:text-amber-400"
                                  >
                                    Sent
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => updateStatus(i.id, "Paid")}
                                    disabled={!canEdit}
                                    className="font-medium text-emerald-600 dark:text-emerald-400"
                                  >
                                    Paid
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      updateStatus(i.id, "Cancelled")
                                    }
                                    disabled={!canEdit}
                                    className="font-medium text-rose-600 dark:text-rose-400"
                                  >
                                    Cancelled
                                  </DropdownMenuItem>
                                </DropdownMenuSubContent>
                              </DropdownMenuPortal>
                            </DropdownMenuSub>
                            {canDelete && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleDelete(i.id)}
                                  disabled={!canDelete}
                                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                >
                                  <Trash2 className="mr-2 size-4" />{" "}
                                  {dict.BUTTON_DELETE || "Delete"}
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}

            {/* Infinite Scroll Sentinel */}
            <TableRow ref={observerTarget} className="border-0">
              <TableCell colSpan={6} className="overflow-hidden border-0 p-0">
                {loadingMore && (
                  <div className="relative h-24 w-full">
                    <SectionLoader />
                  </div>
                )}
                {!hasMore && invoices.length > 0 && !loading && (
                  <div className="py-3 text-center text-xs text-danger/70 select-none">
                    — End of data —
                  </div>
                )}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>

      {/* Summary Cards section - customized as per request for simple statuses */}
      <div className="grid shrink-0 grid-cols-4 gap-2 md:gap-4">
        <SummaryCard
          label={dict.LABEL_STATUS_DRAFT || "Draft"}
          value={stats.draft}
          icon={FileEdit}
          color="blue"
        />
        <SummaryCard
          label={dict.LABEL_STATUS_SENT || "Sent"}
          value={stats.sent}
          icon={Send}
          color="amber"
        />
        <SummaryCard
          label={dict.LABEL_STATUS_OVERDUE || "Overdue"}
          value={stats.overdue}
          icon={AlertTriangle}
          color="red"
        />
        <SummaryCard
          label={dict.LABEL_STATUS_PAID || "Paid"}
          value={stats.paid}
          icon={CheckCircle2}
          color="green"
        />
      </div>

      <DeleteConfirmationDialog
        isOpen={deleteConfirm !== null}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        onConfirm={confirmDelete}
        title={dict.TITLE_DELETE || "Confirm Delete"}
        description={
          dict.MSG_DELETE_CONFIRM?.split("%data%")[0] ||
          "Are you sure you want to delete this invoice? This action cannot be undone."
        }
        dataName={deleteConfirm?.name}
        confirmText={dict.BUTTON_DELETE || "Delete"}
        cancelText={dict.BUTTON_CANCEL || "Cancel"}
        variant="destructive"
      />

      {previewDoc && (
        <Gallery
          docs={[previewDoc]}
          initialIndex={0}
          labels={{
            previewDocument: "Preview Invoice",
            clickToPreview: "Click to preview",
            previousPage: "Previous",
            nextPage: "Next",
            pageLabel: "Page",
            closePreview: "Close",
            download: "Download PDF",
            sendEmail: "Send to Customer",
            confirmEmail: "Are you sure you want to send this invoice to",
          }}
          attachmentOptions={{
            enabled: true,
            doRefs: Array.isArray(previewDoc.raw?.do_refs)
              ? previewDoc.raw.do_refs
              : [],
          }}
          onDownload={handleDownload}
          onSendEmail={handleSendEmail}
          onClose={() => setPreviewDoc(null)}
        />
      )}
    </div>
  )
}
