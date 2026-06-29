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
import { usePersistedState } from "@/hooks/use-persisted-state"
import dynamic from "next/dynamic"

const Gallery = dynamic(() => import("@/components/Gallery"), { ssr: false })
import { generateStandardInvoicePDF } from "@/lib/pdf-generator"

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

export default function InvoicePage() {
  const { dict } = useDictionary()
  const { hasPermission, loading: authLoading } = useAuth()
  const supabase = createClient()

  const [invoices, setInvoices] = useState<any[]>([])
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

  // Form State
  const [formData, setFormData] = usePersistedState("invoice_form_data", {
    invoice_number: "",
    company_id: "",
    do_id: "",
    so_id: "",
    issue_date: INITIAL_ISSUE_DATE,
    due_date: INITIAL_DUE_DATE,
    payment_days: 14,
    subtotal: 0,
    status: "Draft",
    note: "",
    is_note_enabled: true,
    tax_details: [] as any[],
    bank_accounts: [] as any[],
  })

  const [selectedCompanyInfo, setSelectedCompanyInfo] = useState<any>(null)
  const [selectedDOInfo, setSelectedDOInfo] = useState<any>(null)

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
    const appliedTaxes = formData.tax_details.map((t) => {
      const rate = Number(t.rate) || 0
      const amount = t.enabled ? (subtotal * rate) / 100 : 0
      return { ...t, amount }
    })
    const taxTotal = appliedTaxes.reduce((sum, t) => sum + t.amount, 0)
    const grandTotal = subtotal + taxTotal
    return { subtotal, taxTotal, grandTotal, appliedTaxes }
  }, [formData])

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
            "*, company:companies!inner(id, name), do:delivery_orders(id, do_number, do_date, shipment_date, delivered_date, quantity, product:products(id, name, sku), so:sales_orders(id, so_number, unit_price, delivery_price_per_litre, discount, tax_details)), po:sales_orders(id, so_number, tax_details)"
          )
          .range(currentOffset, currentOffset + PAGE_SIZE - 1)

        if (statusFilter !== "all") {
          query = query.eq("status", statusFilter)
        }

        if (debouncedSearchQuery) {
          const companySearch = constructMultiWordSearch(debouncedSearchQuery, ["name"])
          let companyIds: string[] = []
          if (companySearch) {
            const { data: companies } = await supabase
              .from("companies")
              .select("id")
              .or(companySearch)
            companyIds = (companies || []).map((c: any) => c.id)
          }

          const invoiceSearch = constructMultiWordSearch(debouncedSearchQuery, ["invoice_number"])
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
  }, [debouncedSearchQuery, statusFilter, sortLevels, fetchData])

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

  const handleOpenDialog = (item: any = null, isViewOnly = false) => {
    setViewOnly(isViewOnly)
    if (item) {
      setEditingItem(item)
      setSelectedCompanyInfo(item.company)
      setSelectedDOInfo(item.do)

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

      // Calculate payment_days from existing due_date/issue_date diff
      const pdDiff = Math.round(
        (new Date(item.due_date).getTime() -
          new Date(item.issue_date).getTime()) /
        (1000 * 60 * 60 * 24)
      )

      setFormData({
        invoice_number: item.invoice_number,
        company_id: item.company_id,
        do_id: item.do_id || "",
        so_id: item.so_id || "",
        issue_date: item.issue_date,
        due_date: item.due_date,
        payment_days: pdDiff > 0 ? pdDiff : 14,
        subtotal: item.subtotal,
        status: item.status,
        note: item.note || "",
        is_note_enabled: item.is_note_enabled ?? true,
        tax_details: savedTaxes,
        bank_accounts: initialSelectedBanks,
      })
    } else {
      if (!canInsert) return
      setEditingItem(null)
      setSelectedCompanyInfo(null)
      setSelectedDOInfo(null)

      setFormData({
        invoice_number: "",
        company_id: "",
        do_id: "",
        so_id: "",
        issue_date: format(new Date(), "yyyy-MM-dd"),
        due_date: format(
          new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          "yyyy-MM-dd"
        ),
        payment_days: 14,
        subtotal: 0,
        status: "Draft",
        note: "",
        is_note_enabled: true,
        tax_details: [],
        bank_accounts: [],
      })
    }
    setIsOpen(true)
  }

  const handleSave = async () => {
    if (!formData.do_id) {
      notify.error(
        "Validation Error",
        "Please select a Delivery Order before saving"
      )
      return
    }
    setIsSaving(true)
    try {
      const payload = {
        ...formData,
        tax_amount: totals.taxTotal,
        total_amount: totals.grandTotal,
      }

      if (!editingItem && !payload.invoice_number) {
        const { data, error: rpcError } = await supabase.rpc(
          "generate_document_number",
          { p_doc_type: "invoice" }
        )
        if (rpcError) throw rpcError
        payload.invoice_number = data
      }

      if (editingItem) {
        const { error } = await supabase
          .from("invoices")
          .update(payload)
          .eq("id", editingItem.id)
        if (error) throw error

        // Fetch updated row to keep local state in sync with relations
        const { data: updatedRow, error: fetchError } = await supabase
          .from("invoices")
          .select(
            "*, company:companies!inner(id, name), do:delivery_orders(id, do_number, do_date, shipment_date, delivered_date, quantity, product:products(id, name, sku), so:sales_orders(id, so_number, unit_price, delivery_price_per_litre, discount, tax_details)), po:sales_orders(id, so_number, tax_details)"
          )
          .eq("id", editingItem.id)
          .single()

        if (!fetchError && updatedRow) {
          setInvoices((prev) =>
            prev.map((i) => (i.id === editingItem.id ? updatedRow : i))
          )
        } else {
          fetchData(true)
        }
      } else {
        const { error } = await supabase.from("invoices").insert([payload])
        if (error) throw error
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
    const companyName = item.company?.name || ""
    try {
      const { error } = await supabase
        .from("invoices")
        .update({ status })
        .eq("id", id)
      if (error) throw error

      setInvoices((prev) =>
        prev.map((i) => (i.id === id ? { ...i, status } : i))
      )
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
        raw: q,
      })
    } catch (err: any) {
      notify.error("Failed to generate PDF", err.message)
    }
  }

  const handleDownload = (doc: any) => {
    const link = document.createElement("a")
    link.href = doc.pdf
    link.download = `Invoice_${doc.title}.pdf`
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
      const ccList = ccData?.value
        ? ccData.value
          .split(",")
          .map((email: string) => email.trim())
          .filter((e: string) => e !== "")
        : []
      const pdfDataUri = await generateStandardInvoicePDF(companyInfo, inv, {
        save: false,
        output: "datauri",
      })
      if (!pdfDataUri) throw new Error("Failed to generate PDF for attachment.")
      const attachments = [
        {
          filename: `Invoice_${doc.title}.pdf`,
          content: (pdfDataUri as string).split(",")[1],
        },
      ]

      // Build email HTML
      const customerName =
        inv.company?.details?.contact_person ||
        inv.company?.name ||
        "Valued Customer"
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
      const doNumber = inv.do?.do_number || "-"
      const soNumber = inv.do?.so?.so_number || inv.po?.so_number || "-"
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
          cc: ccList,
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
          inv.do?.do_number || "",
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
    product_name:
      selectedDOInfo?.product?.name ||
      (selectedDOInfo?.product?.sku
        ? `${selectedDOInfo.product.sku} - ${selectedDOInfo.product.name}`
        : ""),
    do_number: selectedDOInfo?.do_number || "",
    shipment_date: selectedDOInfo?.shipment_date
      ? format(new Date(selectedDOInfo.shipment_date), "dd MMMM yyyy")
      : "",
    delivered_date: selectedDOInfo?.delivered_date
      ? format(new Date(selectedDOInfo.delivered_date), "dd MMMM yyyy")
      : "",
    quantity: selectedDOInfo?.quantity
      ? new Intl.NumberFormat().format(selectedDOInfo.quantity)
      : "0",
    price: selectedDOInfo?.so?.unit_price
      ? new Intl.NumberFormat().format(selectedDOInfo.so.unit_price)
      : "0",
    subtotal: new Intl.NumberFormat().format(totals.subtotal),
    grand_total: new Intl.NumberFormat().format(totals.grandTotal),
    bank_accounts: formData.bank_accounts.map((b: any) => b.name).join(", "),
  }

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
                className="max-h-[70vh] overflow-y-auto relative"
              >
                <div className={cn(`flex flex-col p-5 gap-6 relative w-full ${viewOnly ? "rounded-bl-xl border-2 border-orange-500" : ""}`)}>
                  {viewOnly && (
                    <div className="absolute inset-0 z-20"></div>
                  )}
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                    <div className="space-y-4 md:col-span-2">
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
                          className="font-mono font-bold"
                        />
                      </div>
                      {/* DO LiveSearch — Mandatory */}
                      <div className="grid gap-2">
                        <Label className="flex items-center gap-1.5">
                          {dict.LABEL_DO_NUMBER || "Delivery Order"}
                          <span
                            className="text-xs font-bold text-destructive"
                            title="Required"
                          >
                            *
                          </span>
                        </Label>
                        <LiveSearch
                          data={selectedDOInfo ? [selectedDOInfo] : []}
                          fetchData={async (query) => {
                            try {
                              let q = supabase
                                .from("delivery_orders")
                                .select(
                                  "*, company:companies!delivery_orders_company_id_fkey!inner(id, name), product:products(id, name, sku), so:sales_orders(id, so_number, unit_price, delivery_price_per_litre, discount, tax_details)"
                                )
                                .in("status", ["Shipped", "Delivered"])
                                .limit(8)
                              if (query) {
                                const doSearch = constructMultiWordSearch(query, [
                                  "do_number",
                                ])
                                const companySearch = constructMultiWordSearch(query, [
                                  "name",
                                ])
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
                          value={formData.do_id}
                          onSelect={(val, item) => {
                            if (!item) return
                            setSelectedCompanyInfo(item.company || null)
                            const soTaxes = Array.isArray(item?.so?.tax_details)
                              ? item.so.tax_details
                              : []
                            const qty = item?.quantity || 0
                            const uPrice = item?.so?.unit_price || 0
                            const dPrice = item?.so?.delivery_price_per_litre || 0
                            const discountPercent = item?.so?.discount || 0
                            const baseTotal = qty * uPrice
                            const discountAmount =
                              baseTotal * (discountPercent / 100)
                            const afterDiscount = baseTotal - discountAmount
                            const calcSubtotal = Math.max(
                              0,
                              Math.round(afterDiscount + qty * dPrice)
                            )

                            setFormData({
                              ...formData,
                              company_id: item.company?.id || "",
                              do_id: val,
                              so_id: item.so?.id || item.so_id || "",
                              issue_date: item.do_date || formData.issue_date,
                              subtotal: calcSubtotal,
                              tax_details: soTaxes,
                            })
                            setSelectedDOInfo(item)
                          }}
                          keyField="id"
                          displayField={(d: any) =>
                            `${d.do_number} - ${d.company?.name || ""}`
                          }
                          defaultDisplay={
                            selectedDOInfo
                              ? `${selectedDOInfo.do_number} - ${selectedDOInfo.company?.name || ""}`
                              : ""
                          }
                          searchColumns={["do_number", "company.name"]}
                          visualColumns={[
                            {
                              key: "do_number",
                              header: dict.LABEL_DO_NUMBER,
                              className: "w-2/5",
                              primary: true,
                            },
                            {
                              key: "company.name",
                              header: dict.LABEL_COMPANY_NAME,
                              className: "w-3/5",
                            },
                          ]}
                          placeholder={
                            dict.PLACEHOLDER_SELECT_DO || "Search DO number..."
                          }
                          emptyMessage={dict.NO_DATA}
                          disabled={viewOnly}
                        />
                      </div>

                      {/* Grouped DO Data Card — visible after DO selected */}
                      {selectedDOInfo && (
                        <div className="space-y-3 rounded-lg border bg-muted/10 p-4 text-sm">
                          <div className="mb-1 flex items-center gap-2 border-b pb-2 text-xs font-semibold text-primary">
                            <Receipt className="size-4" />
                            <span>
                              {dict.MENU_DELIVERY_ORDER || "Delivery Order"}:{" "}
                              {selectedDOInfo.do_number}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <span className="block text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                                DO Date
                              </span>
                              <span className="text-sm font-medium">
                                {selectedDOInfo.do_date
                                  ? format(
                                    new Date(selectedDOInfo.do_date),
                                    "dd MMM yyyy"
                                  )
                                  : "-"}
                              </span>
                            </div>
                            <div className="space-y-1">
                              <span className="block text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                                SO Number
                              </span>
                              <span className="font-mono text-sm font-semibold">
                                {selectedDOInfo.so?.so_number || "-"}
                              </span>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 gap-4 border-t pt-2.5">
                            <div className="space-y-1">
                              <span className="block text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                                Product
                              </span>
                              <span
                                className="block truncate text-sm font-semibold"
                                title={selectedDOInfo.product?.name}
                              >
                                {selectedDOInfo.product
                                  ? `${selectedDOInfo.product.name}`
                                  : "-"}
                              </span>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4 border-t pt-2.5">
                            <div className="space-y-1">
                              <span className="block text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                                Date Sent
                              </span>
                              <span className="text-sm font-medium">
                                {selectedDOInfo.shipment_date
                                  ? format(
                                    new Date(selectedDOInfo.shipment_date),
                                    "dd MMM yyyy"
                                  )
                                  : "-"}
                              </span>
                            </div>
                            <div className="space-y-1">
                              <span className="block text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                                Date Delivered
                              </span>
                              <span className="text-sm font-medium">
                                {selectedDOInfo.delivered_date
                                  ? format(
                                    new Date(selectedDOInfo.delivered_date),
                                    "dd MMM yyyy"
                                  )
                                  : "-"}
                              </span>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4 border-t pt-2.5">
                            <div className="space-y-1">
                              <span className="block text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                                Qty Delivered
                              </span>
                              <span className="font-mono text-sm font-bold">
                                {Number(
                                  selectedDOInfo.quantity || 0
                                ).toLocaleString()}{" "}
                                L
                              </span>
                            </div>
                            <div className="space-y-1">
                              <span className="block text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                                Price per Litre
                              </span>
                              <span className="font-mono text-sm font-semibold">
                                {SITE_CONFIG.currencySymbol}{" "}
                                {Number(
                                  selectedDOInfo.so?.unit_price || 0
                                ).toLocaleString()}
                              </span>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4 border-t pt-2.5">
                            <div className="space-y-1">
                              <span className="block text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                                Discount
                              </span>
                              <span className="font-mono text-sm">
                                {SITE_CONFIG.currencySymbol}{" "}
                                {Number(
                                  selectedDOInfo.so?.discount || 0
                                ).toLocaleString()}
                              </span>
                            </div>
                            <div className="space-y-1">
                              <span className="block text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                                Delivery Cost
                              </span>
                              <span className="font-mono text-sm">
                                {SITE_CONFIG.currencySymbol}{" "}
                                {Number(
                                  selectedDOInfo.so?.delivery_price_per_litre || 0
                                ).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Dates & Status side card */}
                    <div className="h-fit space-y-6 rounded-lg border bg-muted/10 p-4">
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
                          onChange={(e) => handleDueDateChange(e.target.value)}
                          disabled={viewOnly}
                        />
                      </div>
                    </div>

                    {/* Financials & Tax block */}
                    <div className="space-y-4 md:col-span-3">
                      <div className="grid gap-2">
                        <Label>{dict.LABEL_SUBTOTAL}</Label>
                        <NumberInput
                          value={formData.subtotal}
                          disabled
                          leftBadge={SITE_CONFIG.currencySymbol}
                          className="bg-muted/30 text-right text-lg font-bold"
                        />
                      </div>

                      {/* Aligned Tax Section */}
                      <div className="space-y-4 rounded-lg border bg-muted/10 p-4">
                        <Label className="block border-b pb-2 text-xs font-bold tracking-wider text-muted-foreground uppercase">
                          {dict.LABEL_TAXES || "Taxes"}
                        </Label>
                        <div className="space-y-2">
                          {formData.tax_details
                            .filter((t) => t.enabled)
                            .map((tax, idx) => {
                              const calculatedAmount =
                                totals.appliedTaxes.find(
                                  (t) => t.name === tax.name
                                )?.amount || 0
                              return (
                                <div
                                  key={idx}
                                  className="flex min-h-10 items-center justify-between rounded border bg-background p-2.5 text-sm"
                                >
                                  <span className="text-xs font-semibold text-muted-foreground">
                                    {tax.name} ({tax.rate}%)
                                  </span>
                                  <span className="font-mono text-xs font-semibold">
                                    {SITE_CONFIG.currencySymbol}{" "}
                                    {Math.round(
                                      calculatedAmount
                                    ).toLocaleString()}
                                  </span>
                                </div>
                              )
                            })}
                          {formData.tax_details.filter((t) => t.enabled)
                            .length === 0 && (
                              <div className="py-2 text-center text-xs text-muted-foreground italic">
                                No taxes applied
                              </div>
                            )}
                        </div>

                        <div className="flex items-center justify-between border-t pt-2 font-mono text-lg font-bold">
                          <span>{dict.LABEL_GRAND_TOTAL || "Grand Total"}:</span>
                          <span className="text-primary">
                            {SITE_CONFIG.currencySymbol}{" "}
                            {Math.round(totals.grandTotal).toLocaleString()}
                          </span>
                        </div>
                      </div>
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
                    onClick={() => handleSave()}
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
                return (
                  <TableRow
                    key={i.id}
                    className="group cursor-pointer"
                    onDoubleClick={() => handleOpenDialog(i, true)}
                  >
                    <TableCell className="font-medium">
                      <div className="font-mono text-sm font-bold">
                        {i.invoice_number}
                      </div>
                      {i.do && (
                        <div className="font-mono text-[11px] text-muted-foreground">
                          DO: {i.do.do_number}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div>{i.company?.name || "-"}</div>
                      {i.do?.product && (
                        <div
                          className="max-w-[220px] truncate text-[11px] text-muted-foreground"
                          title={i.do.product.name}
                        >
                          {i.do.product.sku
                            ? `${i.do.product.sku} - ${i.do.product.name}`
                            : i.do.product.name}
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
                      {i.do && (
                        <div className="mt-0.5 border-t pt-0.5 text-[10px] text-muted-foreground">
                          Sent:{" "}
                          {format(new Date(i.do.shipment_date), "dd MMM yyyy")}
                          {i.do.delivered_date &&
                            ` | Deliv: ${format(new Date(i.do.delivered_date), "dd MMM yyyy")}`}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="font-mono font-bold">
                        {SITE_CONFIG.currencySymbol}{" "}
                        {Number(i.total_amount).toLocaleString()}
                      </div>
                      <div className="font-mono text-xs text-green-600">
                        {dict.LABEL_PAID || "Paid"}:{" "}
                        {SITE_CONFIG.currencySymbol}{" "}
                        {Number(i.paid_amount).toLocaleString()}
                      </div>
                      {i.do && (
                        <div className="font-mono text-[11px] text-muted-foreground">
                          Qty: {Number(i.do.quantity || 0).toLocaleString()} L
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="align-middle text-center">
                      <span
                        className={cn(
                          "inline-flex items-center justify-center w-20 rounded-full px-2 py-1 text-[10px] font-bold uppercase",
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
                          disabled={!canEdit || i.status === "Paid"}
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
                                i.status === "Paid" || (!canEdit && !canDelete)
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
          onDownload={handleDownload}
          onSendEmail={handleSendEmail}
          onClose={() => setPreviewDoc(null)}
        />
      )}
    </div>
  )
}
