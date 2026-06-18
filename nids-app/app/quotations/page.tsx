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
  TableRow
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
  Check,
  ClipboardList,
  Calendar,
  Clock,
  MinusCircle,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  ArrowUpAZ,
  ArrowDownZA,
  ArrowUpDown,
  RefreshCw,
  Send,
  FileText,
  FileEdit,
  AlertTriangle
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
  DialogFooter
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
  SelectValue
} from "@/components/ui/select"
import { format } from "date-fns"
import { generateStandardQuotationPDF } from "@/lib/pdf-generator-react"
import { ButtonLoader } from "@/components/button-loader"
import { NumberInput } from "@/components/number-input"
import { useDebounce } from "@/hooks/use-debounce"
import { Switch } from "@/components/ui/switch"
import dynamic from "next/dynamic"

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
  const { hasPermission, profile, loading: authLoading } = useAuth()
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

  const [stats, setStats] = useState({
    totalQuotations: 0,
    draftQuotations: 0,
    sentQuotations: 0,
    almostExpired: 0
  })

  // Dialog State
  const [isOpen, setIsOpen] = useState(false)
  const [isSortOpen, setIsSortOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)

  // Filter States
  const [searchQuery, setSearchQuery] = useState("")
  const debouncedSearchQuery = useDebounce(searchQuery, 300)
  const [sortLevels, setSortLevels] = useState<SortLevel[]>([
    { id: "1", column: "created_at", direction: "desc" }
  ])

  const observerTarget = useRef(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const statusStyles: Record<string, string> = {
    Draft: "bg-blue-100 text-blue-700",
    Sent: "bg-amber-100 text-amber-700",
    Accepted: "bg-green-100 text-green-700",
    Rejected: "bg-red-100 text-red-700",
  };

  // Form State
  const [formData, setFormData] = useState(() => ({
    quotation_number: "",
    company_id: "",
    delivery_address: "",
    product_id: "",
    base_price: 0,
    delivery_price: 0,
    quotation_date: format(new Date(), "yyyy-MM-dd"),
    expiry_date: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"),
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
    discounts: [] as { label: string; value: number }[],
    bank_accounts: [] as any[],
    tax_details: [] as any[]
  }))

  const [selectedCompanyInfo, setSelectedCompanyInfo] = useState<any>(null)
  const [selectedProductInfo, setSelectedProductInfo] = useState<any>(null)

  const companyAddresses = useMemo(() => {
    if (!selectedCompanyInfo?.details?.addresses) return []
    return selectedCompanyInfo.details.addresses as { label: string, address: string }[]
  }, [selectedCompanyInfo])

  // Permission Checks
  const canView = hasPermission("quotation", "view")
  const canInsert = hasPermission("quotation", "insert")
  const canEdit = hasPermission("quotation", "edit")
  const canDelete = hasPermission("quotation", "delete")
  const canPrint = hasPermission("quotation", "print")

  const fetchStats = useCallback(async () => {
    try {
      const now = new Date();
      const futureDate = new Date(now.getTime() + ALMOST_EXPIRED_DAYS_THRESHOLD * 24 * 60 * 60 * 1000);

      const [
        { count: totalCount },
        { count: draftCount },
        { count: sentCount },
        { count: almostExpiredCount }
      ] = await Promise.all([
        supabase.from('quotations').select('*', { count: 'exact', head: true }),
        supabase.from('quotations').select('*', { count: 'exact', head: true }).eq('status', 'Draft'),
        supabase.from('quotations').select('*', { count: 'exact', head: true }).eq('status', 'Sent'),
        supabase.from('quotations').select('*', { count: 'exact', head: true })
          .gte('expiry_date', format(now, 'yyyy-MM-dd'))
          .lte('expiry_date', format(futureDate, 'yyyy-MM-dd'))
          .neq('status', 'Accepted')
          .neq('status', 'Rejected')
      ])

      setStats({
        totalQuotations: totalCount || 0,
        draftQuotations: draftCount || 0,
        sentQuotations: sentCount || 0,
        almostExpired: almostExpiredCount || 0
      })
    } catch (err) {
      console.error("Fetch Stats Error:", err)
    }
  }, [supabase])

  // Fetch Data
  const fetchData = useCallback(async (isInitial = false) => {
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
          supabase.from("app_settings").select("value").eq("category", "company").eq("name", "bank").maybeSingle(),
          supabase.from("app_settings").select("*").eq("category", "company"),
          supabase.from("app_settings").select("*").eq("category", "tax")
        ])

        if (bRes.data?.value) setAvailableBanks(bRes.data.value as any[])
        else setAvailableBanks([])

        if (sRes.data) {
          const info: any = {}
          sRes.data.forEach((r: any) => { info[r.name] = r.value })
          setCompanyInfo(info)
        }

        if (tRes.data) {
          setGlobalTaxes(tRes.data)
        }
      }

      let query = supabase
        .from("quotations")
        .select("*, company:companies(id, name, details), product:products(id, sku, name, base_price)")
        .range(currentOffset, currentOffset + PAGE_SIZE - 1)

      // Dynamic sorting
      sortLevels.forEach(level => {
        const [relation, col] = level.column.split('.')
        if (col) {
          // Relation sorting not supported natively via range easily for joined tables in simple .order
          // For now we sort by top level cols primarily
        } else {
          query = query.order(level.column, { ascending: level.direction === 'asc' })
        }
      })

      // Ensure stable secondary sort
      query = query.order('created_at', { ascending: false })

      if (debouncedSearchQuery) {
        query = query.or(`quotation_number.ilike.%${debouncedSearchQuery}%`)
      }

      const { data, error } = await query
      if (error) throw error

      if (data) {
        if (isInitial) {
          setQuotations(data)
        } else {
          setQuotations(prev => {
            const newItems = data.filter((item: any) => !prev.some(p => p.id === item.id))
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
  }, [supabase, offset, debouncedSearchQuery, sortLevels, dict.MSG_DATA_FETCH_FAILED])

  useEffect(() => {
    fetchData(true)
  }, [debouncedSearchQuery, sortLevels])

  // Ordinary Infinite Scroll
  useEffect(() => {
    const rootElement = containerRef.current;
    if (!rootElement) return;

    const observer = new IntersectionObserver(
      entries => {
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
  const handleDateChange = (dateStr: string) => {
    const qDate = new Date(formData.quotation_date)
    const eDate = new Date(dateStr)
    const diffTime = eDate.getTime() - qDate.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    setFormData(prev => ({ ...prev, expiry_date: dateStr, expiry_days: diffDays }))
  }

  const handleDaysChange = (days: number) => {
    const qDate = new Date(formData.quotation_date)
    const eDate = new Date(qDate.getTime() + days * 24 * 60 * 60 * 1000)
    setFormData(prev => ({ ...prev, expiry_days: days, expiry_date: format(eDate, "yyyy-MM-dd") }))
  }

  const handleOpenDialog = (item: any = null) => {
    if (item) {
      setEditingItem(item)
      const company = item.company ? {
        ...item.company,
        contact_person: item.company.details?.contact_person || ""
      } : null

      setSelectedCompanyInfo(company)
      setSelectedProductInfo(item.product)

      const itemBankAccounts = Array.isArray(item.bank_accounts) ? item.bank_accounts : []
      const initialSelectedBanks = availableBanks.filter(availableBank =>
        itemBankAccounts.some((itemBank: any) => itemBank.account_number === availableBank.account_number)
      )

      // Merge saved taxes with current global taxes
      const savedTaxes = Array.isArray(item.tax_details) ? item.tax_details : []
      const mergedTaxes = globalTaxes.map(gt => {
        const existing = savedTaxes.find((st: any) => st.name === gt.name)
        if (existing) return { ...gt, rate: existing.rate, enabled: existing.enabled }
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
        discounts: item.discounts || [],
        bank_accounts: initialSelectedBanks,
        tax_details: mergedTaxes
      });
    } else {
      if (!canInsert) return
      setEditingItem(null)
      setSelectedCompanyInfo(null)
      setSelectedProductInfo(null)

      setFormData({
        quotation_number: "", // Will be auto-generated on save if empty
        company_id: "",
        delivery_address: "",
        product_id: "",
        base_price: 0,
        delivery_price: 0,
        quotation_date: format(new Date(), "yyyy-MM-dd"),
        expiry_date: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"),
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
        discounts: [],
        bank_accounts: [],
        tax_details: globalTaxes.map(gt => ({ ...gt, rate: gt.value, enabled: false }))
      })
    }
    setIsOpen(true)
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const payload = { ...formData }
      if (editingItem) {
        // If edited, revert status to Draft
        payload.status = "Draft";

        await supabase.from("quotations").update({ bank_accounts: null, discounts: null }).eq("id", editingItem.id);
        const { error } = await supabase.from("quotations").update(payload).eq("id", editingItem.id)
        if (error) throw error;

        // Fetch updated row to keep local state in sync with relations
        const { data: updatedRow, error: fetchError } = await supabase
          .from("quotations")
          .select("*, company:companies(id, name, details), product:products(id, sku, name, base_price)")
          .eq("id", editingItem.id)
          .single();

        if (!fetchError && updatedRow) {
          setQuotations(prev => prev.map(q => q.id === editingItem.id ? updatedRow : q));
        } else {
          // Fallback if fetch fails
          fetchData(true);
        }

        notify.success(dict.MSG_STATUS_UPDATED.replace("%data%", ""), dict.MSG_QUOTATION_SAVED.replace("%data%", `[${formData.quotation_number}]`))
        fetchStats()
      } else {
        // Generate document number if empty
        if (!payload.quotation_number) {
          const { data, error: rpcError } = await supabase.rpc('generate_document_number', { p_doc_type: 'quotation' })
          if (rpcError) throw rpcError
          payload.quotation_number = data
        }

        const { error } = await supabase.from("quotations").insert([payload])
        if (error) throw error;
        notify.success(dict.MSG_STATUS_UPDATED.replace("%data%", ""), dict.MSG_QUOTATION_SAVED.replace("%data%", `[${payload.quotation_number}]`))
        fetchData(true)
      }
      setIsOpen(false)
    } catch (err: any) {
      notify.error(dict.MSG_SAVE_FAILED, err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    const item = quotations.find(q => q.id === id)
    const label = item ? `[${item.quotation_number}]` : ""
    if (!confirm(dict.MSG_DELETE_CONFIRM)) return
    try {
      const { error } = await supabase.from("quotations").delete().eq("id", id)
      if (error) throw error

      setQuotations(prev => prev.filter(q => q.id !== id))
      notify.deleted(dict.MSG_DELETE_SUCCESS.replace("%data%", label))
      fetchStats()
    } catch (err: any) {
      notify.error(dict.MSG_SAVE_FAILED, err.message)
    }
  }

  const updateStatus = async (id: string, status: string) => {
    try {
      const { error } = await supabase.from("quotations").update({ status }).eq("id", id)
      if (error) throw error

      setQuotations(prev => prev.map(q => q.id === id ? { ...q, status } : q))
      notify.success(dict.MSG_STATUS_UPDATED, dict.MSG_QUOTATION_STATUS_UPDATED)
      fetchStats()
    } catch (err: any) {
      notify.error(dict.MSG_UPDATE_FAILED, err.message)
    }
  }

  const handlePrint = async (q: any) => {
    if (!companyInfo) {
      notify.error(dict.MSG_SAVE_FAILED, "Company information not loaded yet.")
      return
    }
    try {
      const dataUri = await generateStandardQuotationPDF(companyInfo, q, { save: false, output: "datauri" })
      const contacts = q.company?.details?.contact_persons?.length
        ? q.company.details.contact_persons
        : [{ name: q.company?.details?.contact_person || "-", email: q.company?.details?.email || q.company?.email || "" }]
      setPreviewDoc({
        id: q.id,
        title: q.quotation_number,
        description: ` ${q.company?.name || "-"}`,
        images: [],
        pdf: dataUri,
        customerEmail: contacts[0]?.email || "",
        contacts: contacts,
        raw: q
      })
    } catch (err: any) {
      notify.error("Failed to generate PDF", err.message)
    }
  }

  const handleDownload = (doc: any) => {
    const link = document.createElement('a')
    link.href = doc.pdf
    link.download = `Quotation_${doc.title}.pdf`
    link.click()
  }

  const handleSendEmail = async (doc: any) => {
    try {
      const q = doc.raw || doc;
      const { data: ccData } = await supabase.from('app_settings').select('value').eq('category', 'email').eq('name', 'cc_quotation').single()
      const ccList = ccData?.value ? ccData.value.split(',').map((email: string) => email.trim()).filter((e: string) => e !== "") : []
      const pdfDataUri = await generateStandardQuotationPDF(companyInfo, q, { save: false, output: "datauri" })
      if (!pdfDataUri) throw new Error("Failed to generate PDF for attachment.");
      const attachments = [{ filename: `Quotation_${doc.title}.pdf`, content: (pdfDataUri as string).split(',')[1] }];
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: doc.customerEmail,
          cc: ccList,
          subject: `Quotation ${doc.title} - PT Anugerah Buana Sriwijaya`,
          html: `<div>Quotation ${doc.title} attached.</div>`,
          attachments,
        })
      })
      const result = await res.json()
      if (result.success) {
        notify.success(dict.MSG_STATUS_UPDATED.replace("%data%", ""), "Email sent successfully.")
        // Automatically set status to Sent
        updateStatus(q.id, 'Sent')
      } else throw new Error(result.error)
    } catch (err: any) {
      notify.error("Failed to send email", err.message)
    }
  }

  const sortedAndFilteredData = useMemo(() => {
    const words = searchQuery.toLowerCase().split(/\s+/).filter(Boolean)
    let result = quotations

    if (words.length > 0) {
      result = quotations.filter(q => {
        const searchFields = [
          q.quotation_number,
          q.company?.name || "",
          q.product?.sku || ""
        ]
        return searchFields.some(field => {
          const val = String(field).toLowerCase()
          return words.every(word => val.includes(word))
        })
      })
    }
    return [...result].sort((a, b) => {
      for (const level of sortLevels) {
        const aVal = level.column === 'company.name' ? a.company?.name || "" : level.column === 'product.sku' ? a.product?.sku || "" : a[level.column];
        const bVal = level.column === 'company.name' ? b.company?.name || "" : level.column === 'product.sku' ? b.product?.sku || "" : b[level.column];
        if (aVal === bVal) continue
        const multiplier = level.direction === "asc" ? 1 : -1
        if (typeof aVal === 'number' && typeof bVal === 'number') return (aVal - bVal) * multiplier
        return String(aVal).localeCompare(String(bVal)) * multiplier
      }
      return 0
    })
  }, [quotations, searchQuery, sortLevels])

  const addSortLevel = () => setSortLevels([...sortLevels, { id: Math.random().toString(), column: "quotation_number", direction: "asc" }])
  const removeSortLevel = (id: string) => { if (sortLevels.length > 1) setSortLevels(sortLevels.filter(l => l.id !== id)) }
  const updateSortLevel = (id: string, field: keyof SortLevel, value: any) => setSortLevels(sortLevels.map(l => l.id === id ? { ...l, [field]: value } : l))

  const sortColumns = [
    { label: dict.LABEL_QUOTATION_NUMBER, value: "quotation_number" },
    { label: dict.LABEL_COMPANY_NAME, value: "company_id" },
    { label: dict.LABEL_SKU, value: "product_id" },
    { label: dict.LABEL_QUOTATION_DATE, value: "quotation_date" },
    { label: dict.LABEL_EXPIRY_DATE, value: "expiry_date" },
    { label: dict.LABEL_MIN_ORDER, value: "minimum_order" },
    { label: dict.LABEL_STATUS, value: "status" }
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
    { id: "bank_accounts", label: dict.LABEL_BANK_ACCOUNTS }
  ]

  const variableValues = {
    quotation_number: formData.quotation_number,
    quotation_date: formData.quotation_date ? format(new Date(formData.quotation_date), "dd MMMM yyyy") : "",
    expiry_date: formData.expiry_date ? format(new Date(formData.expiry_date), "dd MMMM yyyy") : "",
    company_name: selectedCompanyInfo?.name || "",
    contact_person: selectedCompanyInfo?.contact_person || selectedCompanyInfo?.details?.contact_person || "",
    product_name: selectedProductInfo?.name || (selectedProductInfo?.sku ? `${selectedProductInfo.sku} - ${selectedProductInfo.name}` : ""),
    delivery_address: formData.delivery_address || "",
    price: new Intl.NumberFormat().format(formData.base_price),
    delivery_price: new Intl.NumberFormat().format(formData.delivery_price),
    min_order: new Intl.NumberFormat().format(formData.minimum_order),
    shrinkage: formData.shrinkage_tolerance.toString(),
    bank_accounts: formData.bank_accounts.map(b => b.name).join(", ")
  }

  // Calculation logic for Quotation Unit Price
  const totals = useMemo(() => {
    const subtotal = formData.base_price + formData.delivery_price;
    let taxTotal = 0;
    const appliedTaxes = formData.tax_details.map(t => {
      if (!t.enabled) return { ...t, amount: 0 };
      const amt = (subtotal * Number(t.rate)) / 100;
      taxTotal += amt;
      return { ...t, amount: amt };
    });
    const grandTotal = subtotal + taxTotal;
    return { subtotal, taxTotal, grandTotal, appliedTaxes };
  }, [formData.base_price, formData.delivery_price, formData.tax_details])

  if (!canView && !loading && !authLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="text-center space-y-2">
          <AlertCircle className="size-8 text-destructive mx-auto" />
          <h2 className="text-lg font-semibold">{dict.MSG_ACCESS_DENIED || "Access Denied"}</h2>
          <p className="text-sm text-muted-foreground">{dict.MSG_NO_PERMISSION || "You do not have permission to view this page."}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container overflow-hidden">
      <div className="page-header shrink-0">
        <h1 className="page-title flex items-center gap-2">
          <ClipboardList className="size-5 text-primary" />
          {dict.MENU_QUOTATION}
        </h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handleRefresh} disabled={loading || loadingMore} title="Refresh Data">
            <RefreshCw className={cn("size-4", (loading || loadingMore) && "animate-spin")} />
          </Button>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={() => handleOpenDialog()} className="h-9" disabled={!canInsert}>
                <Plus data-icon="inline-start" />
                {dict.BUTTON_NEW_QUOTATION}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-3xl">
              <DialogHeader>
                <DialogTitle>
                  <ClipboardList className="size-5 mr-2 inline-block" />{editingItem ? dict.BUTTON_EDIT_QUOTATION : dict.BUTTON_NEW_QUOTATION}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} id="quotation-form" className="p-6 flex-1 overflow-y-auto custom-scrollbar space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-4 md:col-span-2">
                    <div className="grid gap-2">
                      <Label htmlFor="qnum">{dict.LABEL_QUOTATION_NUMBER}</Label>
                      <Input id="qnum" value={formData.quotation_number} onChange={e => setFormData({ ...formData, quotation_number: e.target.value })} disabled={editingItem && !canEdit} placeholder={dict.LABEL_AUTO_GENERATED} />
                    </div>
                    <div className="grid gap-2">
                      <Label>{dict.LABEL_COMPANY_NAME}</Label>
                      <LiveSearch
                        data={selectedCompanyInfo ? [selectedCompanyInfo] : []}
                        fetchData={async (query) => {
                          let q = supabase.from("companies").select("id, name, type, details").contains('type', ['Customer']).limit(8)
                          if (query) {
                            const searchStr = constructMultiWordSearch(query, ['name', 'details->>contact_person'])
                            if (searchStr) q = q.or(searchStr)
                          }
                          const { data } = await q
                          return (data || []).map((c: any) => ({ ...c, contact_person: c.details?.contact_person || "" }))
                        }}
                        value={formData.company_id}
                        onSelect={(val, item) => { setFormData({ ...formData, company_id: val }); setSelectedCompanyInfo(item); }}
                        keyField="id"
                        displayField="name"
                        defaultDisplay={selectedCompanyInfo?.name || ""}
                        searchColumns={["name", "contact_person"]}
                        visualColumns={[
                          { key: "name", header: dict.LABEL_COMPANY_NAME, className: "w-50", primary: true },
                          { key: "contact_person", header: dict.LABEL_CONTACT_PERSON, className: "w-30" }
                        ]}
                        placeholder={dict.PLACEHOLDER_SEARCH}
                        emptyMessage={dict.NO_DATA}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>{dict.LABEL_DELIVERY_ADDRESS}</Label>
                      {companyAddresses.length > 0 ? (
                        <Select value={formData.delivery_address} onValueChange={val => setFormData({ ...formData, delivery_address: val })}>
                          <SelectTrigger className="w-full h-13"><SelectValue placeholder={dict.PLACEHOLDER_SELECT_ADDRESS} /></SelectTrigger>
                          <SelectContent>
                            {companyAddresses.map((addr, idx) => (
                              <SelectItem key={idx} value={addr.address}>
                                <div className="flex flex-col items-start text-sm">
                                  <span className="font-semibold">{addr.label}</span>
                                  <span className="text-muted-foreground line-clamp-1">{addr.address}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input value={formData.delivery_address} onChange={e => setFormData({ ...formData, delivery_address: e.target.value })} placeholder={dict.PLACEHOLDER_ENTER_ADDRESS} />
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>{dict.LABEL_SKU}</Label>
                        <LiveSearch
                          data={selectedProductInfo ? [selectedProductInfo] : []}
                          fetchData={async (query) => {
                            let q = supabase.from("products").select("id, sku, name, base_price").limit(8)
                            if (query) q = q.or(`sku.ilike.%${query}%,name.ilike.%${query}%`)
                            const { data } = await q
                            return data || []
                          }}
                          value={formData.product_id}
                          onSelect={(val, item) => { setFormData({ ...formData, product_id: val, base_price: (item as any)?.base_price || 0 }); setSelectedProductInfo(item); }}
                          keyField="id"
                          displayField={(p) => `${p.sku} - ${p.name}`}
                          defaultDisplay={selectedProductInfo ? (selectedProductInfo.sku && selectedProductInfo.name ? `${selectedProductInfo.sku} - ${selectedProductInfo.name}` : selectedProductInfo.name || selectedProductInfo.sku || "") : ""}
                          searchColumns={["sku", "name"]}
                          visualColumns={[
                            { key: "sku", header: dict.LABEL_SKU, className: "w-15 font-mono", primary: true },
                            { key: "name", header: dict.LABEL_PRODUCT_NAME, className: "text-left" }
                          ]}
                          placeholder={dict.PLACEHOLDER_SEARCH}
                          emptyMessage={dict.NO_DATA}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>{dict.LABEL_BASE_PRICE}</Label>
                        <NumberInput value={formData.base_price} onChange={val => setFormData({ ...formData, base_price: val })} rightBadge="/ L" leftBadge={SITE_CONFIG.currencySymbol} />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-6 border rounded-lg p-4 bg-muted/10 h-fit">
                    <div className="grid gap-2">
                      <Label className="flex items-center gap-2"><Calendar className="size-4" /> {dict.LABEL_QUOTATION_DATE}</Label>
                      <Input type="date" value={formData.quotation_date} onChange={e => setFormData({ ...formData, quotation_date: e.target.value })} />
                    </div>
                    <div className="grid gap-2">
                      <Label className="flex items-center gap-2"><Clock className="size-4" /> {dict.LABEL_EXPIRY_DATE}</Label>
                      <Input type="date" value={formData.expiry_date} onChange={e => handleDateChange(e.target.value)} />
                    </div>
                    <div className="grid gap-2">
                      <Label>{dict.LABEL_VALIDITY_DAYS}</Label>
                      <NumberInput value={formData.expiry_days} onChange={val => handleDaysChange(val)} rightBadge="Hari" />
                    </div>
                  </div>
                  <div className="space-y-4 md:col-span-3">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="minorder">{dict.LABEL_MIN_ORDER}</Label>
                        <NumberInput id="minorder" value={formData.minimum_order} onChange={val => setFormData({ ...formData, minimum_order: val })} rightBadge="L" />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="deliv_price">{dict.LABEL_TRANSPORT_COST}</Label>
                        <NumberInput id="deliv_price" value={formData.delivery_price} onChange={val => setFormData({ ...formData, delivery_price: val })} leftBadge={SITE_CONFIG.currencySymbol} rightBadge="/ L" />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="shrinkage">{dict.LABEL_SHRINKAGE_TOLERANCE}</Label>
                        <NumberInput id="shrinkage" value={formData.shrinkage_tolerance} onChange={val => setFormData({ ...formData, shrinkage_tolerance: val })} rightBadge="%" />
                      </div>
                      <div className="grid gap-2">
                        <Label>{dict.LABEL_PRICE_PER_L} ({dict.LABEL_SUBTOTAL})</Label>
                        <div className="h-10 flex items-center px-3 border rounded bg-muted/50 font-mono font-bold text-primary">
                          {SITE_CONFIG.currencySymbol} {totals.subtotal.toLocaleString()}
                        </div>
                      </div>
                    </div>

                    {/* Aligned Tax Section */}
                    <div className="space-y-4 border rounded-lg p-4 bg-muted/10">
                      <Label className="text-xs uppercase font-bold text-muted-foreground tracking-wider block border-b pb-2">{dict.LABEL_TAXES || "Taxes"}</Label>
                      <div className="space-y-2">
                        {formData.tax_details.map((tax, idx) => {
                          const calculatedAmount = totals.appliedTaxes.find(t => t.name === tax.name)?.amount || 0;
                          return (
                            <div key={idx} className="flex items-center p-2 border rounded bg-background h-12 gap-4">
                              <div className="w-24 shrink-0 font-medium">
                                <Label htmlFor={`tax-${idx}`} className="cursor-pointer">{tax.name}</Label>
                              </div>

                              <div className="shrink-0 flex items-center justify-center w-12">
                                <Switch id={`tax-${idx}`} checked={tax.enabled} onCheckedChange={(val) => {
                                  const newTaxes = [...formData.tax_details];
                                  newTaxes[idx].enabled = val;
                                  setFormData({ ...formData, tax_details: newTaxes })
                                }} />
                              </div>

                              <div className="w-28 shrink-0">
                                <div style={{ opacity: tax.enabled ? 1 : 0.3 }} className="transition-opacity w-full">
                                  <NumberInput
                                    className="text-right font-mono text-xs"
                                    containerClassName="h-8 bg-muted/50"
                                    disabled
                                    value={tax.rate}
                                    onChange={() => { }}
                                    rightBadge="%"
                                  />
                                </div>
                              </div>

                              <div className="flex-1 flex justify-end">
                                <span className={cn(
                                  "font-mono font-medium text-sm transition-opacity",
                                  tax.enabled ? "opacity-100 text-foreground" : "opacity-30 text-muted-foreground"
                                )}>
                                  {SITE_CONFIG.currencySymbol} {calculatedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      <div className="flex justify-between items-center text-lg font-bold border-t pt-4 font-mono">
                        <span>{dict.LABEL_GRAND_TOTAL || "Grand Total"} ({dict.LABEL_PRICE_PER_L}):</span>
                        <span className="text-primary text-xl">{SITE_CONFIG.currencySymbol} {totals.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="space-y-6 pt-4 border-t">
                  <RichTextEditor label={dict.LABEL_CONTENT} value={formData.content} onChange={val => setFormData({ ...formData, content: val || "" })} isEnabled={formData.is_content_enabled} onToggleEnabled={val => setFormData({ ...formData, is_content_enabled: val })} placeholder={dict.PLACEHOLDER_EDITOR} variables={editorVariables} variableValues={variableValues} />
                  <RichTextEditor label={dict.LABEL_NOTE} value={formData.note} onChange={val => setFormData({ ...formData, note: val || "" })} isEnabled={formData.is_note_enabled} onToggleEnabled={val => setFormData({ ...formData, is_note_enabled: val })} placeholder={dict.PLACEHOLDER_EDITOR} variables={editorVariables} variableValues={variableValues} />
                  <RichTextEditor label={dict.LABEL_TERMS} value={formData.terms_conditions} onChange={val => setFormData({ ...formData, terms_conditions: val || "" })} isEnabled={formData.is_terms_enabled} onToggleEnabled={val => setFormData({ ...formData, is_terms_enabled: val })} placeholder={dict.PLACEHOLDER_EDITOR} variables={editorVariables} variableValues={variableValues} />
                  <RichTextEditor label={dict.LABEL_CLOSING} value={formData.closing_remarks} onChange={val => setFormData({ ...formData, closing_remarks: val || "" })} isEnabled={formData.is_closing_enabled} onToggleEnabled={val => setFormData({ ...formData, is_closing_enabled: val })} placeholder={dict.PLACEHOLDER_EDITOR} variables={editorVariables} variableValues={variableValues} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
                  <div className="space-y-4 border rounded-lg p-4 bg-muted/10 h-fit">
                    <Label className="text-base font-semibold">{dict.LABEL_BANK_ACCOUNTS}</Label>
                    <div className="flex flex-col gap-3">
                      {availableBanks.map((bank: any, idx) => {
                        const isSelected = formData.bank_accounts.some((b: any) => b.account_number === bank.account_number)
                        return (
                          <div key={idx} className="flex items-start space-x-3 bg-background p-3 rounded border">
                            <Checkbox id={`bank-${idx}`} checked={isSelected} onCheckedChange={(checked) => { setFormData(prev => ({ ...prev, bank_accounts: checked ? [...prev.bank_accounts, bank] : prev.bank_accounts.filter((b: any) => b.account_number !== bank.account_number) })); }} />
                            <Label htmlFor={`bank-${idx}`} className="text-sm font-normal cursor-pointer leading-tight flex flex-col gap-1 w-full"><span className="font-semibold">{bank.name} - {bank.branch}</span><span className="text-muted-foreground">{bank.account_number} a/n {bank.account_name}</span></Label>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  <div className="space-y-4 border rounded-lg p-4 bg-muted/10 h-fit">
                    <div className="flex items-center justify-between"><Label className="text-base font-semibold">{dict.LABEL_DISCOUNT_TERMS}</Label><Button type="button" variant="outline" size="sm" onClick={() => setFormData({ ...formData, discounts: [...formData.discounts, { label: "", value: 0 }] })}><Plus className="size-4" /></Button></div>
                    <div className="space-y-3">
                      {formData.discounts.map((d, i) => (
                        <div key={i} className="flex gap-2 items-center border-b pb-3 last:border-0">
                          <Input className="flex-1 h-9" placeholder={dict.LABEL_DISCOUNT_NAME} value={d.label} onChange={e => { const newD = [...formData.discounts]; newD[i].label = e.target.value; setFormData({ ...formData, discounts: newD }) }} />
                          <div className="w-24 shrink-0"><NumberInput value={d.value} onChange={val => { const newD = [...formData.discounts]; newD[i].value = val; setFormData({ ...formData, discounts: newD }) }} rightBadge="%" className="h-9" /></div>
                          <Button variant="ghost" size="icon" className="text-destructive shrink-0" onClick={() => setFormData({ ...formData, discounts: formData.discounts.filter((_, idx) => idx !== i) })}><MinusCircle className="size-4" /></Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </form>
              <DialogFooter className="p-5 border-t bg-muted/5 shrink-0">
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>{dict.BUTTON_CANCEL}</Button>
                <Button onClick={() => handleSave()} disabled={isSaving || (editingItem ? !canEdit : !canInsert)}>{isSaving ? <ButtonLoader /> : <Save data-icon="inline-start" />} {dict.BUTTON_SAVE}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="action-bar shrink-0 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="relative flex-1 w-full max-w-sm"><Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" /><Input placeholder={dict.PLACEHOLDER_SEARCH} className="pl-9" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} /></div>
        <Dialog open={isSortOpen} onOpenChange={setIsSortOpen}>
          <DialogTrigger asChild><Button variant="outline" size="sm" className="h-9"><ArrowUpDown className="size-4 mr-2" />Sort</Button></DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader><DialogTitle>{dict.TITLE_SORT_SETTINGS}</DialogTitle></DialogHeader>
            <div className="flex flex-col gap-4 p-5">
              {sortLevels.map((level, index) => (
                <div key={level.id} className="flex items-center gap-3">
                  <div className="w-17 shrink-0 font-semibold text-sm text-muted-foreground">{index === 0 ? dict.LABEL_SORT_BY : dict.LABEL_THEN_BY}</div>
                  <Select value={level.column} onValueChange={(val) => updateSortLevel(level.id, "column", val)}><SelectTrigger className="flex-1 h-9"><SelectValue /></SelectTrigger><SelectContent>{sortColumns.map(col => (<SelectItem key={col.value} value={col.value}>{col.label}</SelectItem>))}</SelectContent></Select>
                  <Button variant="outline" size="sm" className="h-9" onClick={() => updateSortLevel(level.id, "direction", level.direction === "asc" ? "desc" : "asc")}>{level.direction === "asc" ? <ArrowUpAZ className="size-4" /> : <ArrowDownZA className="size-4" />}</Button>
                  <Button variant="ghost" size="icon" className="size-9 text-destructive" disabled={sortLevels.length <= 1} onClick={() => removeSortLevel(level.id)}><Trash2 className="size-4" /></Button>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-fit mt-2" onClick={addSortLevel}><Plus className="size-4 mr-2" />{dict.BUTTON_ADD_LEVEL}</Button>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setIsSortOpen(false)}>{dict.BUTTON_CANCEL}</Button><Button onClick={() => setIsSortOpen(false)}>Apply</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card ref={containerRef} className="data-card flex-1 overflow-auto custom-scrollbar">
        <Table>
          <TableHeader className="sticky top-0 z-10">
            <TableRow>
              <TableHead>{dict.LABEL_QUOTATION_NUMBER}</TableHead>
              <TableHead>{dict.LABEL_COMPANY_NAME}</TableHead>
              <TableHead>{dict.LABEL_SKU}</TableHead>
              <TableHead className="text-center">{dict.LABEL_QUOTATION_DATE}</TableHead>
              <TableHead className="text-center">{dict.LABEL_EXPIRY_DATE}</TableHead>
              <TableHead className="text-right">{dict.LABEL_MIN_ORDER}</TableHead>
              <TableHead className="text-center">{dict.LABEL_STATUS}</TableHead>
              <TableHead className="text-right"> </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} className="p-0"><SectionLoader /></TableCell></TableRow>
            ) : sortedAndFilteredData.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">{dict.NO_DATA}</TableCell></TableRow>
            ) : sortedAndFilteredData.map(q => (
              <TableRow key={q.id} className="group">
                <TableCell className="font-medium">{q.quotation_number}</TableCell>
                <TableCell>{q.company?.name || "-"}</TableCell>
                <TableCell className="text-xs font-mono">{q.product?.sku || "-"}</TableCell>
                <TableCell className="text-center">{format(new Date(q.quotation_date), "dd MMM yyyy")}</TableCell>
                <TableCell className="text-center"><div>{format(new Date(q.expiry_date), "dd MMM yyyy")}</div><div className="text-[10px] text-muted-foreground">{q.expiry_days} days left</div></TableCell>
                <TableCell className="text-right font-mono">{new Intl.NumberFormat(lang === 'id' ? 'id-ID' : 'en-US').format(q.minimum_order)}</TableCell>
                <TableCell>
                  <div className={cn("px-2 py-1 rounded-full text-[10px] text-center font-bold uppercase", statusStyles[q.status])}>{q.status}</div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="table_action" size="sm" onClick={() => handleOpenDialog(q)} disabled={!canEdit}><Pencil className="size-4" /></Button>
                    <Button variant="table_action" size="sm" onClick={() => handlePrint(q)} disabled={!canPrint}><Printer className="size-4" /></Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="secondary" size="icon" className="size-8"><ChevronDown className="size-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger><CheckCircle2 className="size-4 mr-2" /> Status</DropdownMenuSubTrigger>
                          <DropdownMenuPortal>
                            <DropdownMenuSubContent>
                              <DropdownMenuItem onClick={() => updateStatus(q.id, 'Draft')} className="text-blue-600 font-medium">Draft</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateStatus(q.id, 'Sent')} className="text-amber-600 font-medium">Sent</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateStatus(q.id, 'Accepted')} className="text-green-600 font-medium">Accepted</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateStatus(q.id, 'Rejected')} className="text-red-600 font-medium">Rejected</DropdownMenuItem>
                            </DropdownMenuSubContent>
                          </DropdownMenuPortal>
                        </DropdownMenuSub>
                        {canDelete && <><DropdownMenuSeparator /><DropdownMenuItem className="text-destructive" onClick={() => handleDelete(q.id)}><Trash2 className="size-4 mr-2" /> {dict.BUTTON_DELETE}</DropdownMenuItem></>}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))}

            {/* Infinite Scroll Sentinel & Loader */}
            <TableRow ref={observerTarget} className="border-0">
              <TableCell colSpan={8} className="p-0 border-0 overflow-hidden">
                {loadingMore && (
                  <div className="relative h-24 w-full">
                    <SectionLoader />
                  </div>
                )}
                {!hasMore && quotations.length > 0 && !loading && (
                  <div className="text-center py-3 text-xs text-danger/70 select-none">
                    — End of data —
                  </div>
                )}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>

      <div className="grid grid-cols-4 gap-2 md:gap-4 shrink-0">
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
          label={dict.LABEL_ALMOST_EXPIRED || `Exp. < ${ALMOST_EXPIRED_DAYS_THRESHOLD} days`}
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
            confirmEmail: "Are you sure you want to send this quotation to"
          }}
          onDownload={handleDownload}
          onSendEmail={handleSendEmail}
          onClose={() => setPreviewDoc(null)}
        />
      )}
    </div>
  )
}
