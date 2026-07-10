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
  Printer,
  Trash2,
  ChevronDown,
  CheckCircle2,
  Calendar,
  Truck,
  AlertCircle,
  ShoppingBag,
  RefreshCw,
} from "lucide-react"
import { Input } from "@/components/ui/input"
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
import { DeleteConfirmationDialog } from "@/components/confirmation-dialog"
import { FundersDialog } from "@/components/funders-dialog"
import { notify } from "@/lib/notifications"
import { RichTextEditor } from "@/components/rich-text-editor"
import { LiveSearch } from "@/components/live-search"
import { format } from "date-fns"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ButtonLoader } from "@/components/button-loader"
import { NumberInput } from "@/components/number-input"
import { generateStandardSalesOrderPDF } from "@/lib/pdf-generator"
import dynamic from "next/dynamic"

const Gallery = dynamic(() => import("@/components/Gallery"), { ssr: false })

const PAGE_SIZE = 50

export default function SalesOrdersPage() {
  const { dict, lang } = useDictionary()
  const { hasPermission, profile, loading: authLoading } = useAuth()
  const supabase = createClient()

  const [orders, setOrders] = useState<any[]>([])
  const [quotations, setQuotations] = useState<any[]>([])
  const [globalTaxes, setGlobalTaxes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [offset, setOffset] = useState(0)
  const [isSaving, setIsSaving] = useState(false)

  // Dialog State
  const [isOpen, setIsOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)
  const [viewOnly, setViewOnly] = useState(false)

  // Filter States
  const [searchQuery, setSearchQuery] = useState("")
  const debouncedSearchQuery = useDebounce(searchQuery, 300)

  const observerTarget = useRef(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Form State
  const [formData, setFormData] = useState(() => ({
    so_number: "", // Backend column is still so_number
    po_number: "",
    company_id: "",
    quotation_id: "",
    product_id: "",
    so_date: format(new Date(), "yyyy-MM-dd"),
    delivery_date: format(
      new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      "yyyy-MM-dd"
    ),
    quantity: 0,
    unit_price: 0,
    term_of_payment: "",
    delivery_address: "",
    discount: 0,
    delivery_price_per_litre: 0,
    status: "Draft",
    note: "",
    is_note_enabled: true,
    tax_details: [] as any[],
    shrinkage_tolerance: 0,
    funders: [] as { funder_id: string; funder_name: string; amount: number }[],
  }))

  const [selectedCompanyInfo, setSelectedCompanyInfo] = useState<any>(null)
  const [selectedProductInfo, setSelectedProductInfo] = useState<any>(null)
  const [selectedQuotationInfo, setSelectedQuotationInfo] = useState<any>(null)
  const [availableDiscounts, setAvailableDiscounts] = useState<any[]>([])
  const [companyInfo, setCompanyInfo] = useState<any>(null)
  const [previewDoc, setPreviewDoc] = useState<any>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: string
    so_number: string
  } | null>(null)
  const [fundersDialogOpen, setFundersDialogOpen] = useState(false)

  const statusStyles: Record<string, string> = {
    Default:
      "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border border-zinc-500/20",
    Draft:
      "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border border-zinc-500/20",
    Sent: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
    Approved:
      "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20",
    Rejected:
      "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20",
    Partial:
      "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20",
    Fulfilled:
      "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
  }

  // Calculation logic
  const totals = useMemo(() => {
    const baseTotal = formData.quantity * formData.unit_price
    const deliveryTotal = formData.quantity * formData.delivery_price_per_litre
    const discountAmount = baseTotal * ((formData.discount || 0) / 100)
    const afterDiscount = baseTotal - discountAmount
    const subtotal = Math.max(0, afterDiscount + deliveryTotal)
    const taxableAmount = subtotal

    let taxTotal = 0
    const appliedTaxes = formData.tax_details.map((t) => {
      if (!t.enabled) return { ...t, amount: 0 }
      const amt = (taxableAmount * Number(t.rate)) / 100
      taxTotal += amt
      return { ...t, amount: amt }
    })

    const grandTotal = taxableAmount + taxTotal
    return {
      subtotal,
      deliveryTotal,
      taxTotal,
      grandTotal,
      appliedTaxes,
      discountAmount,
    }
  }, [formData])

  const companyAddresses = useMemo(() => {
    if (!selectedCompanyInfo?.details?.addresses) return []
    return selectedCompanyInfo.details.addresses as {
      label: string
      address: string
    }[]
  }, [selectedCompanyInfo])

  const handleQuotationSelect = (qId: string, quote?: any) => {
    if (quote) {
      setSelectedQuotationInfo(quote)
      setAvailableDiscounts(quote.discounts || [])

      // Inherit taxes from quotation if available
      const qTaxes = Array.isArray(quote.tax_details) ? quote.tax_details : []
      const mergedTaxes = globalTaxes.map((gt) => {
        const existing = qTaxes.find((st: any) => st.name === gt.name)
        if (existing)
          return { ...gt, rate: existing.rate, enabled: existing.enabled }
        return { ...gt, rate: gt.value, enabled: false }
      })

      setFormData((prev) => ({
        ...prev,
        quotation_id: qId,
        company_id: quote.company_id,
        product_id: quote.product_id,
        quantity: quote.minimum_order || 0,
        unit_price: quote.base_price || 0,
        delivery_price_per_litre: quote.delivery_price || 0,
        tax_details: mergedTaxes,
        // Also take delivery address if available from quotation
        delivery_address: quote.delivery_address || prev.delivery_address,
        // Also take shrinkage tolerance from quotation
        shrinkage_tolerance: quote.shrinkage_tolerance ?? 0,
        discount: 0,
        term_of_payment: "",
        po_number: prev.po_number,
      }))
      // Also update dependent info
      setSelectedCompanyInfo(quote.company)
      setSelectedProductInfo(quote.product)
    } else {
      setSelectedQuotationInfo(null)
      setAvailableDiscounts([])
      setSelectedCompanyInfo(null)
      setSelectedProductInfo(null)
      setFormData((prev) => ({
        ...prev,
        quotation_id: "",
        company_id: "",
        product_id: "",
        quantity: 0,
        unit_price: 0,
        delivery_price_per_litre: 0,
        delivery_address: "",
        shrinkage_tolerance: 0,
        discount: 0,
        term_of_payment: "",
        po_number: "",
      }))
    }
  }

  // Fetch Data
  const fetchData = useCallback(
    async (isInitial = false) => {
      if (isInitial) {
        setLoading(true)
        setOffset(0)
      } else {
        setLoadingMore(true)
      }

      try {
        const currentOffset = isInitial ? 0 : offset

        if (isInitial) {
          const [qRes, tRes, cRes] = await Promise.all([
            supabase
              .from("quotations")
              .select(
                "*, company:companies(id, name, details), product:products(id, sku, name)"
              )
              .eq("status", "Accepted"),
            supabase.from("app_settings").select("*").eq("category", "tax"),
            supabase.from("app_settings").select("*").eq("category", "company"),
          ])
          if (qRes.error) throw qRes.error
          if (tRes.error) throw tRes.error
          setQuotations(qRes.data || [])
          setGlobalTaxes(tRes.data || [])
          if (cRes.data) {
            const info: any = {}
            cRes.data.forEach((r: any) => {
              info[r.name] = r.value
            })
            setCompanyInfo(info)
          }
        }

        let query = supabase
          .from("sales_orders")
          .select(
            "*, company:companies(id, name, details), product:products(id, sku, name), quotation:quotations(id, quotation_number, tax_details, discounts, company:companies!quotations_company_id_fkey(id, name))"
          )
          .order("created_at", { ascending: false })
          .range(currentOffset, currentOffset + PAGE_SIZE - 1)

        if (debouncedSearchQuery) {
          const searchStr = constructMultiWordSearch(debouncedSearchQuery, [
            "so_number",
            "company.name",
            "product.sku",
          ])
          if (searchStr) query = query.or(searchStr)
        }

        const { data, error } = await query
        if (error) throw error

        if (data) {
          if (isInitial) {
            setOrders(data)
          } else {
            setOrders((prev) => {
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
    [supabase, offset, debouncedSearchQuery, dict.MSG_DATA_FETCH_FAILED]
  )

  const handleRefresh = () => {
    fetchData(true)
  }

  useEffect(() => {
    fetchData(true)
  }, [debouncedSearchQuery])

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

  // Permission Checks
  const canView = hasPermission("sales-order", "view")
  const canInsert = hasPermission("sales-order", "insert")
  const canEdit = hasPermission("sales-order", "edit")
  const canDelete = hasPermission("sales-order", "delete")
  const canPrint = hasPermission("sales-order", "print")

  // Form Validation
  const isFormValid =
    !!formData.po_number?.trim() && !!formData.term_of_payment?.trim()

  const handlePrint = async (o: any) => {
    if (!companyInfo) {
      notify.error(
        dict.MSG_SAVE_FAILED.replace("%data%", o ? `[${o.so_number}]` : ""),
        "Company information not loaded yet."
      )
      return
    }
    try {
      const dataUri = await generateStandardSalesOrderPDF(companyInfo, o, {
        save: false,
        output: "datauri",
      })
      const contacts = o.company?.details?.contact_persons?.length
        ? o.company.details.contact_persons
        : [
            {
              name: o.company?.details?.contact_person || "-",
              email: o.company?.details?.email || o.company?.email || "",
            },
          ]
      setPreviewDoc({
        id: o.id,
        title: o.so_number,
        description: ` ${o.company?.name || "-"}`,
        images: [],
        pdf: dataUri,
        customerEmail: contacts[0]?.email || "",
        contacts: contacts,
        raw: o,
      })
    } catch (err: any) {
      notify.error("Failed to generate PDF", err.message)
    }
  }

  const handleDownload = (doc: any) => {
    const link = document.createElement("a")
    link.href = doc.pdf
    link.download = `SO_${doc.title}.pdf`
    link.click()
    notify.success(
      dict.MSG_PRINT_SUCCESS,
      dict.MSG_PRINT_SUCCESS_DESC.replace("%data%", `[${doc.title}]`),
      undefined,
      false
    )
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

  // Open Dialog
  const handleOpenDialog = (item: any = null, isViewOnly = false) => {
    setViewOnly(isViewOnly)
    if (item) {
      setEditingItem(item)
      setSelectedCompanyInfo(item.company)
      setSelectedProductInfo(item.product)
      setSelectedQuotationInfo(item.quotation)
      setAvailableDiscounts(item.quotation?.discounts || [])

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
        so_number: item.so_number,
        po_number: item.po_number || "",
        company_id: item.company_id || "",
        quotation_id: item.quotation_id || "",
        product_id: item.product_id || "",
        so_date: item.so_date,
        delivery_date: item.delivery_date,
        quantity: item.quantity || 0,
        unit_price: item.unit_price || 0,
        term_of_payment: item.term_of_payment || "",
        delivery_address: item.delivery_address || "",
        discount: item.discount || 0,
        delivery_price_per_litre: item.delivery_price_per_litre || 0,
        shrinkage_tolerance: item.shrinkage_tolerance ?? 0,
        status: item.status,
        note: item.note || "",
        is_note_enabled: item.is_note_enabled ?? true,
        tax_details: mergedTaxes,
        funders: item.funders || [],
      })
    } else {
      if (!canInsert) return
      setEditingItem(null)
      setSelectedCompanyInfo(null)
      setSelectedProductInfo(null)
      setSelectedQuotationInfo(null)
      setAvailableDiscounts([])

      setFormData({
        so_number: "", // Will be auto-generated on save if empty
        po_number: "",
        quotation_id: "",
        company_id: "",
        product_id: "",
        so_date: format(new Date(), "yyyy-MM-dd"),
        delivery_date: format(
          new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          "yyyy-MM-dd"
        ),
        quantity: 0,
        unit_price: 0,
        term_of_payment: "",
        delivery_address: "",
        discount: 0,
        delivery_price_per_litre: 0,
        shrinkage_tolerance: 0,
        status: "Draft",
        note: "",
        is_note_enabled: true,
        tax_details: globalTaxes.map((gt) => ({
          ...gt,
          rate: gt.value,
          enabled: false,
        })),
        funders: [],
      })
    }
    setIsOpen(true)
  }

  // Actions
  const handleSave = async () => {
    // Validate required fields
    if (!formData.po_number?.trim()) {
      notify.error("Validation Error", "Customer PO Number is required.")
      return
    }
    if (!formData.term_of_payment?.trim()) {
      notify.error("Validation Error", "Payment Term is required.")
      return
    }

    setIsSaving(true)
    // Convert empty string UUID foreign keys to null
    const payload = {
      ...formData,
      quotation_id: formData.quotation_id || null,
      company_id: formData.company_id || null,
      product_id: formData.product_id || null,
    }
    try {
      if (editingItem) {
        if (
          editingItem.status === "Partial" ||
          editingItem.status === "Fulfilled"
        ) {
          notify.error(
            "Error",
            "Cannot edit sales order with status Partial or Fulfilled."
          )
          setIsSaving(false)
          return
        }

        // Handle Quotation Reversion if changed
        if (
          editingItem.quotation_id &&
          editingItem.quotation_id !== payload.quotation_id
        ) {
          await supabase
            .from("quotations")
            .update({ status: "Accepted" })
            .eq("id", editingItem.quotation_id)
        }

        // If a NEW quotation is being linked
        if (
          payload.quotation_id &&
          editingItem.quotation_id !== payload.quotation_id
        ) {
          await supabase
            .from("quotations")
            .update({ status: "Processed" })
            .eq("id", payload.quotation_id)
        }

        // Check if any data fields have changed compared to original editingItem
        const hasDataChanged =
          payload.so_number !== editingItem.so_number ||
          payload.po_number !== (editingItem.po_number || "") ||
          payload.company_id !== (editingItem.company_id || "") ||
          payload.quotation_id !== (editingItem.quotation_id || "") ||
          payload.product_id !== (editingItem.product_id || "") ||
          payload.so_date !== editingItem.so_date ||
          payload.delivery_date !== editingItem.delivery_date ||
          Number(payload.quantity) !== Number(editingItem.quantity || 0) ||
          Number(payload.unit_price) !== Number(editingItem.unit_price || 0) ||
          payload.term_of_payment !== (editingItem.term_of_payment || "") ||
          payload.delivery_address !== (editingItem.delivery_address || "") ||
          Number(payload.discount) !== Number(editingItem.discount || 0) ||
          Number(payload.delivery_price_per_litre) !==
            Number(editingItem.delivery_price_per_litre || 0) ||
          Number(payload.shrinkage_tolerance) !==
            Number(editingItem.shrinkage_tolerance ?? 0) ||
          payload.note !== (editingItem.note || "") ||
          payload.is_note_enabled !== (editingItem.is_note_enabled ?? true) ||
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
          JSON.stringify(
            payload.funders?.map((f: any) => ({
              funder_id: f.funder_id,
              funder_name: f.funder_name,
              amount: f.amount,
            }))
          ) !==
            JSON.stringify(
              (editingItem.funders || []).map((f: any) => ({
                funder_id: f.funder_id,
                funder_name: f.funder_name,
                amount: f.amount,
              }))
            )

        if (hasDataChanged) {
          payload.status = "Draft"
        }

        const { error } = await supabase
          .from("sales_orders")
          .update(payload)
          .eq("id", editingItem.id)
        if (error) throw error

        // Fetch updated row to keep local state in sync with relations
        const { data: updatedRow, error: fetchError } = await supabase
          .from("sales_orders")
          .select(
            "*, company:companies(id, name, details), product:products(id, sku, name), quotation:quotations(id, quotation_number, tax_details, discounts, company:companies!quotations_company_id_fkey(id, name))"
          )
          .eq("id", editingItem.id)
          .single()

        if (!fetchError && updatedRow) {
          setOrders((prev) =>
            prev.map((o) => (o.id === editingItem.id ? updatedRow : o))
          )
        } else {
          fetchData(true)
        }

        const docLabel = `[${payload.so_number || formData.so_number}]`
        notify.success(
          dict.MSG_UPDATE_SUCCESS.replace("%data%", docLabel),
          dict.MSG_SUCCESS_UPDATE_DESC.replace(
            "%entity%",
            "sales order"
          ).replace("%company%", `[${selectedCompanyInfo?.name || ""}]`),
          undefined,
          true
        )
      } else {
        // Generate document number if empty
        if (!payload.so_number) {
          const { data, error: rpcError } = await supabase.rpc(
            "generate_document_number",
            { p_doc_type: "sales-order" }
          )
          if (rpcError) throw rpcError
          payload.so_number = data
        }

        const { error } = await supabase.from("sales_orders").insert([payload])
        if (error) throw error

        // If from quotation, update quotation status to Processed
        if (payload.quotation_id) {
          await supabase
            .from("quotations")
            .update({ status: "Processed" })
            .eq("id", payload.quotation_id)
        }

        const docLabel = `[${payload.so_number || formData.so_number}]`
        notify.success(
          dict.MSG_SO_SAVED.replace("%data%", docLabel),
          dict.MSG_SUCCESS_SAVE_DESC.replace("%entity%", "sales order").replace(
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
      const docLabel = `[${formData.so_number}]`
      notify.error(
        dict.MSG_SAVE_FAILED.replace("%data%", docLabel),
        err.message
      )
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    const item = orders.find((p) => p.id === id)
    if (item && (item.status === "Partial" || item.status === "Fulfilled")) {
      notify.error("Error", "Cannot delete a Partial or Fulfilled sales order.")
      return
    }
    setDeleteConfirm({ id, so_number: item?.so_number || "" })
  }

  const confirmDelete = async () => {
    if (!deleteConfirm) return
    const id = deleteConfirm.id
    const item = orders.find((p) => p.id === id)
    const docLabel = `[${deleteConfirm.so_number}]`
    const companyName = item?.company?.name || ""
    try {
      // Revert quotation status if linked
      if (item?.quotation_id) {
        await supabase
          .from("quotations")
          .update({ status: "Accepted" })
          .eq("id", item.quotation_id)
      }

      const { error } = await supabase
        .from("sales_orders")
        .delete()
        .eq("id", id)
      if (error) throw error

      setOrders((prev) => prev.filter((o) => o.id !== id))
      notify.deleted(
        dict.MSG_SO_DELETED.replace("%data%", docLabel),
        dict.MSG_SUCCESS_DELETE_DESC.replace("%entity%", "sales order").replace(
          "%company%",
          `[${companyName}]`
        ),
        undefined,
        true
      )
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
    const item = orders.find((o) => o.id === id)
    if (item && (item.status === "Partial" || item.status === "Fulfilled")) {
      notify.error(
        "Error",
        "Cannot change status of a Partial or Fulfilled sales order."
      )
      return
    }
    const docLabel = `[${item.so_number}]`
    const companyName = item.company?.name || ""
    try {
      const { error } = await supabase
        .from("sales_orders")
        .update({ status })
        .eq("id", id)
      if (error) throw error

      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)))
      notify.success(
        dict.MSG_SO_STATUS_UPDATED.replace("%data%", docLabel),
        dict.MSG_SUCCESS_STATUS_DESC.replace("%status%", `[${status}]`).replace(
          "%company%",
          `[${companyName}]`
        ),
        undefined,
        true
      )
    } catch (err: any) {
      notify.error(
        dict.MSG_UPDATE_FAILED.replace("%data%", docLabel),
        err.message
      )
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleSave()
  }

  const isFromQuotation = !!formData.quotation_id

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header shrink-0">
        <h1 className="page-title">
          <ShoppingBag className="mr-2 inline-block size-5 text-primary" />
          {dict.MENU_SALES_ORDER}
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
                {dict.BUTTON_NEW_SO}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-5xl">
              <DialogHeader>
                <DialogTitle>
                  <ShoppingBag className="mr-2 inline-block size-5" />
                  {viewOnly
                    ? formData.so_number
                    : editingItem
                      ? dict.BUTTON_EDIT + " SO"
                      : dict.BUTTON_NEW_SO}
                </DialogTitle>
                <DialogDescription />
              </DialogHeader>

              <form
                onSubmit={handleSubmit}
                className="relative max-h-[70vh] overflow-y-auto"
              >
                <div
                  className={cn(
                    `relative flex w-full flex-col gap-6 p-5 ${viewOnly ? "rounded-b-xl border-2 border-orange-500" : ""}`
                  )}
                >
                  {viewOnly && <div className="absolute inset-0 z-20"></div>}
                  <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                    <div className="space-y-4">
                      <div className="grid gap-2">
                        <Label htmlFor="sonum">{dict.LABEL_SO_NUMBER}</Label>
                        <Input
                          id="sonum"
                          value={formData.so_number}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              so_number: e.target.value,
                            })
                          }
                          disabled={
                            editingItem && !hasPermission("sales-order", "edit")
                          }
                          placeholder={dict.LABEL_AUTO_GENERATED}
                        />
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="ponum">
                          {dict.LABEL_SO_NUMBER?.replace("SO", "PO") ||
                            "PO Number"}
                          <span className="ml-0.5 text-destructive">*</span>
                        </Label>
                        <Input
                          id="ponum"
                          value={formData.po_number}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              po_number: e.target.value,
                            })
                          }
                          disabled={
                            editingItem && !hasPermission("sales-order", "edit")
                          }
                          placeholder="Enter customer PO number"
                        />
                      </div>

                      <div className="grid gap-2">
                        <Label>
                          {dict.LABEL_QUOTATION_NUMBER} ({dict.LABEL_OPTIONAL})
                        </Label>
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <LiveSearch
                              key="quotation-search"
                              data={
                                selectedQuotationInfo
                                  ? [selectedQuotationInfo]
                                  : []
                              }
                              fetchData={async (query) => {
                                let q = supabase
                                  .from("quotations")
                                  .select(
                                    "*, company:companies(id, name), product:products(id, sku, name)"
                                  )
                                  .eq("status", "Accepted")
                                if (query) {
                                  const quotationSearch =
                                    constructMultiWordSearch(query, [
                                      "quotation_number",
                                    ])
                                  const companySearch =
                                    constructMultiWordSearch(query, ["name"])
                                  const { data: companies } = companySearch
                                    ? await supabase
                                        .from("companies")
                                        .select("id")
                                        .contains("type", ["Customer"])
                                        .or(companySearch)
                                    : { data: [] }
                                  const companyIds = (companies || []).map(
                                    (c: any) => c.id
                                  )
                                  const orConditions: string[] = []
                                  if (quotationSearch)
                                    orConditions.push(quotationSearch)
                                  if (companyIds.length > 0)
                                    orConditions.push(
                                      `company_id.in.(${companyIds.join(",")})`
                                    )
                                  if (orConditions.length > 0)
                                    q = q.or(orConditions.join(","))
                                }
                                const { data } = await q
                                return data || []
                              }}
                              value={formData.quotation_id}
                              onSelect={handleQuotationSelect}
                              keyField="id"
                              displayField={(q) =>
                                `${q.quotation_number} - ${q.company?.name || ""}`
                              }
                              defaultDisplay={
                                selectedQuotationInfo
                                  ? `${selectedQuotationInfo.quotation_number} - ${selectedQuotationInfo.company?.name || ""}`
                                  : ""
                              }
                              searchColumns={[
                                "quotation_number",
                                "company.name",
                              ]}
                              visualColumns={[
                                {
                                  key: "quotation_number",
                                  header: dict.LABEL_QUOTATION_NUMBER,
                                  className: "w-2/5",
                                  primary: true,
                                },
                                {
                                  key: "company.name",
                                  header: dict.LABEL_COMPANY_NAME,
                                  className: "w-3/5",
                                },
                              ]}
                              placeholder={dict.PLACEHOLDER_SEARCH}
                              emptyMessage={dict.NO_DATA}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-2">
                        <Label>{dict.LABEL_COMPANY_NAME}</Label>
                        <LiveSearch
                          data={
                            selectedCompanyInfo ? [selectedCompanyInfo] : []
                          }
                          disabled={true}
                          fetchData={async () => []}
                          value={formData.company_id}
                          onSelect={() => {}}
                          keyField="id"
                          displayField="name"
                          defaultDisplay={selectedCompanyInfo?.name || ""}
                          searchColumns={[]}
                          visualColumns={[]}
                          placeholder={dict.PLACEHOLDER_SEARCH}
                          emptyMessage={dict.NO_DATA}
                        />
                      </div>

                      <div className="grid gap-2">
                        <Label>{dict.LABEL_SKU}</Label>
                        <LiveSearch
                          data={
                            selectedProductInfo ? [selectedProductInfo] : []
                          }
                          disabled={isFromQuotation}
                          fetchData={async (query) => {
                            let q = supabase
                              .from("products")
                              .select("id, sku, name")
                              .limit(8)
                            if (query) {
                              const searchStr = constructMultiWordSearch(
                                query,
                                ["sku", "name"]
                              )
                              if (searchStr) q = q.or(searchStr)
                            }
                            const { data } = await q
                            return data || []
                          }}
                          value={formData.product_id}
                          onSelect={(val, item) => {
                            setFormData({ ...formData, product_id: val })
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
                            },
                            {
                              key: "name",
                              header: dict.LABEL_PRODUCT_NAME,
                              className: "w-2/3",
                              primary: true,
                            },
                          ]}
                          placeholder={dict.PLACEHOLDER_SEARCH}
                          emptyMessage={dict.NO_DATA}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label className="flex items-center gap-2">
                            <Calendar className="size-4" /> {dict.LABEL_SO_DATE}
                          </Label>
                          <Input
                            type="date"
                            value={formData.so_date}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                so_date: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label className="flex items-center gap-2">
                            <Truck className="size-4" />{" "}
                            {dict.LABEL_DELIVERY_DATE}
                          </Label>
                          <Input
                            type="date"
                            value={formData.delivery_date}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                delivery_date: e.target.value,
                              })
                            }
                          />
                        </div>
                      </div>

                      <div className="grid w-full gap-2">
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
                            disabled={isFromQuotation}
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
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                delivery_address: e.target.value,
                              })
                            }
                            disabled={isFromQuotation}
                            placeholder={dict.PLACEHOLDER_ENTER_ADDRESS}
                            className="w-full"
                          />
                        )}
                      </div>

                      <div className="flex items-center justify-between">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setFundersDialogOpen(true)}
                        >
                          {dict.LABEL_MANAGE_FUNDERS}
                          {formData.funders.length > 0 && (
                            <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                              {formData.funders.length}
                            </span>
                          )}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="flex h-full flex-col justify-between space-y-4 rounded-lg border bg-primary/5 p-4">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div className="grid gap-2">
                            <Label htmlFor="qty">{dict.LABEL_QUANTITY}</Label>
                            <NumberInput
                              id="qty"
                              value={formData.quantity}
                              onChange={(val) =>
                                setFormData({ ...formData, quantity: val })
                              }
                              rightBadge="L"
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="uprice">
                              {dict.LABEL_UNIT_PRICE}
                            </Label>
                            <NumberInput
                              id="uprice"
                              value={formData.unit_price}
                              onChange={(val) =>
                                setFormData({ ...formData, unit_price: val })
                              }
                              leftBadge={SITE_CONFIG.currencySymbol}
                              disabled={isFromQuotation}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div className="grid gap-2">
                            <Label htmlFor="top">
                              {dict.LABEL_TERM_OF_PAYMENT}
                              <span className="ml-0.5 text-destructive">*</span>
                            </Label>
                            {isFromQuotation &&
                            availableDiscounts.length > 0 ? (
                              <Select
                                value={formData.term_of_payment}
                                onValueChange={(val) => {
                                  const disc = availableDiscounts.find(
                                    (d) => d.label === val
                                  )
                                  setFormData({
                                    ...formData,
                                    term_of_payment: val,
                                    discount: disc ? disc.value : 0,
                                  })
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue
                                    placeholder={dict.PLACEHOLDER_SELECT_TERM}
                                  />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableDiscounts.map((d, idx) => (
                                    <SelectItem key={idx} value={d.label}>
                                      {d.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Input
                                id="top"
                                value={formData.term_of_payment}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    term_of_payment: e.target.value,
                                  })
                                }
                                placeholder={dict.PLACEHOLDER_TOP}
                              />
                            )}
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="discount">
                              {dict.LABEL_DISCOUNTS}
                            </Label>
                            <NumberInput
                              id="discount"
                              value={formData.discount}
                              onChange={(val) =>
                                setFormData({ ...formData, discount: val })
                              }
                              rightBadge="%"
                              disabled={isFromQuotation}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div className="grid gap-2">
                            <Label htmlFor="deliv_price">
                              {dict.LABEL_TRANSPORT_COST}
                            </Label>
                            <NumberInput
                              id="deliv_price"
                              value={formData.delivery_price_per_litre}
                              onChange={(val) =>
                                setFormData({
                                  ...formData,
                                  delivery_price_per_litre: val,
                                })
                              }
                              leftBadge={SITE_CONFIG.currencySymbol}
                              rightBadge="/ L"
                              disabled={isFromQuotation}
                            />
                          </div>
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
                              disabled={isFromQuotation}
                            />
                          </div>
                        </div>

                        <div className="space-y-3 border-t pt-4">
                          <Label className="mb-2 block text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                            {dict.LABEL_TAXES || "Taxes"}
                          </Label>
                          <div className="space-y-2">
                            {formData.tax_details.map((tax, idx) => {
                              const calculatedAmount =
                                totals.appliedTaxes.find(
                                  (t) => t.name === tax.name
                                )?.amount || 0
                              return (
                                <div
                                  key={idx}
                                  className="grid min-h-10 grid-cols-12 items-center gap-2 rounded border bg-background p-2"
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
                                      onCheckedChange={(val) => {
                                        const newTaxes = [
                                          ...formData.tax_details,
                                        ]
                                        newTaxes[idx].enabled = val
                                        setFormData({
                                          ...formData,
                                          tax_details: newTaxes,
                                        })
                                      }}
                                      disabled={isFromQuotation}
                                    />
                                  </div>
                                  <div className="col-span-4">
                                    <div
                                      style={{ opacity: tax.enabled ? 1 : 0.3 }}
                                      className="w-full transition-opacity"
                                    >
                                      <NumberInput
                                        className="text-right font-mono text-xs"
                                        containerClassName="h-7 bg-muted/50"
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
                                      {SITE_CONFIG.currencySymbol}
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

                        <div className="space-y-2 border-t pt-2">
                          <div className="flex justify-between font-mono text-lg font-bold">
                            <span>{dict.LABEL_GRAND_TOTAL}:</span>
                            <span className="text-primary">
                              {SITE_CONFIG.currencySymbol}{" "}
                              {Math.round(totals.grandTotal).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="w-full">
                    <RichTextEditor
                      label={dict.LABEL_NOTE}
                      value={formData.note}
                      onChange={(val) =>
                        setFormData((prev) => ({ ...prev, note: val || "" }))
                      }
                      isEnabled={formData.is_note_enabled}
                      onToggleEnabled={(val) =>
                        setFormData((prev) => ({
                          ...prev,
                          is_note_enabled: val,
                        }))
                      }
                      placeholder={dict.PLACEHOLDER_EDITOR}
                    />
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
                    {dict.BUTTON_CANCEL}
                  </Button>
                  <Button
                    onClick={() => handleSave()}
                    disabled={isSaving || (editingItem ? !canEdit : !canInsert)}
                  >
                    {isSaving ? (
                      <ButtonLoader />
                    ) : (
                      <Save data-icon="inline-start" />
                    )}{" "}
                    {dict.BUTTON_SAVE_SO}
                  </Button>
                </DialogFooter>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Action Bar / Filters */}
      <div className="action-bar shrink-0">
        <div className="max-sm relative w-full flex-1">
          <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder={dict.PLACEHOLDER_SEARCH}
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Data Area */}
      <Card
        ref={containerRef}
        className="data-card custom-scrollbar flex-1 overflow-auto"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="px-7">{dict.LABEL_SO_NUMBER}</TableHead>
              <TableHead>{dict.LABEL_COMPANY_NAME}</TableHead>
              <TableHead>{dict.LABEL_SO_DATE}</TableHead>
              <TableHead>{dict.LABEL_QUANTITY}</TableHead>
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
            ) : orders.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-10 text-center text-muted-foreground"
                >
                  {dict.NO_DATA}
                </TableCell>
              </TableRow>
            ) : (
              orders.map((o) => (
                <TableRow
                  key={o.id}
                  className="group cursor-pointer"
                  onDoubleClick={() => handleOpenDialog(o, true)}
                >
                  <TableCell className="font-medium">{o.so_number}</TableCell>
                  <TableCell>{o.company?.name || "-"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(o.so_date), "dd MMM yyyy")}
                  </TableCell>
                  <TableCell className="text-sm">{o.quantity}</TableCell>
                  <TableCell className="text-center align-middle">
                    <div
                      className={cn(
                        "inline-flex w-20 items-center justify-center rounded-full px-2 py-1 text-[10px] font-bold uppercase",
                        statusStyles[o.status] || statusStyles.Default
                      )}
                    >
                      {o.status}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="table_action"
                        size="sm"
                        onClick={() => handleOpenDialog(o)}
                        disabled={
                          !canEdit ||
                          o.status === "Partial" ||
                          o.status === "Fulfilled"
                        }
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="table_action"
                        size="sm"
                        onClick={() => handlePrint(o)}
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
                              o.status === "Partial" ||
                              o.status === "Fulfilled" ||
                              (!canEdit && !canDelete)
                            }
                          >
                            <ChevronDown className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                              <CheckCircle2 className="mr-2 size-4" />{" "}
                              {dict.LABEL_STATUS}
                            </DropdownMenuSubTrigger>
                            <DropdownMenuPortal>
                              <DropdownMenuSubContent>
                                <DropdownMenuItem
                                  onClick={() => updateStatus(o.id, "Draft")}
                                  className="font-medium text-zinc-600 dark:text-zinc-400"
                                  disabled={!canEdit}
                                >
                                  Draft
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => updateStatus(o.id, "Approved")}
                                  className="font-medium text-emerald-600 dark:text-emerald-400"
                                  disabled={!canEdit}
                                >
                                  Approved
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => updateStatus(o.id, "Rejected")}
                                  className="font-medium text-rose-600 dark:text-rose-400"
                                  disabled={!canEdit}
                                >
                                  Rejected
                                </DropdownMenuItem>
                              </DropdownMenuSubContent>
                            </DropdownMenuPortal>
                          </DropdownMenuSub>
                          {canDelete && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                                onClick={() => handleDelete(o.id)}
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
              <TableCell colSpan={6} className="overflow-hidden border-0 p-0">
                {loadingMore && (
                  <div className="relative h-24 w-full">
                    <SectionLoader />
                  </div>
                )}
                {!hasMore && orders.length > 0 && !loading && (
                  <div className="py-3 text-center text-xs text-danger/70 select-none">
                    — End of data —
                  </div>
                )}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>

      {previewDoc && (
        <Gallery
          docs={[previewDoc]}
          initialIndex={0}
          labels={{
            previewDocument: "Preview Sales Order",
            clickToPreview: "Click to preview",
            previousPage: "Previous",
            nextPage: "Next",
            pageLabel: "Page",
            closePreview: "Close",
            download: "Download PDF",
            sendEmail: "Send to Customer",
            confirmEmail: "Are you sure you want to send this sales order to",
          }}
          onDownload={handleDownload}
          onClose={() => setPreviewDoc(null)}
        />
      )}
      <FundersDialog
        open={fundersDialogOpen}
        onOpenChange={setFundersDialogOpen}
        totalAmount={totals.grandTotal}
        funders={formData.funders}
        onFundersChange={(funders) =>
          setFormData((prev) => ({ ...prev, funders }))
        }
      />
      <DeleteConfirmationDialog
        isOpen={deleteConfirm !== null}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        onConfirm={confirmDelete}
        title={dict.TITLE_DELETE || "Confirm Delete"}
        description={
          dict.MSG_DELETE_CONFIRM?.split("%data%")[0] ||
          "Are you sure you want to delete this item? This action cannot be undone."
        }
        dataName={deleteConfirm?.so_number}
        confirmText={dict.BUTTON_DELETE || "Delete"}
        cancelText={dict.BUTTON_CANCEL || "Cancel"}
        variant="destructive"
      />
    </div>
  )
}
