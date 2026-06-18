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
  Calendar,
  Truck,
  AlertCircle,
  ShoppingBag
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
  DialogTrigger
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { cn, constructMultiWordSearch } from "@/lib/utils"
import { SectionLoader } from "@/components/section-loader"
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
  SelectValue
} from "@/components/ui/select"
import { ButtonLoader } from "@/components/button-loader"
import { NumberInput } from "@/components/number-input"

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

  // Filter States
  const [searchQuery, setSearchQuery] = useState("")
  const debouncedSearchQuery = useDebounce(searchQuery, 300)

  const observerTarget = useRef(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Form State
  const [formData, setFormData] = useState(() => ({
    so_number: "", // Backend column is still so_number
    company_id: "",
    quotation_id: "",
    product_id: "",
    so_date: format(new Date(), "yyyy-MM-dd"),
    delivery_date: format(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"),
    quantity: 0,
    unit_price: 0,
    term_of_payment: "",
    delivery_address: "",
    discount: 0,
    delivery_price_per_litre: 0,
    status: "Draft",
    note: "",
    is_note_enabled: true,
    tax_details: [] as any[]
  }))

  const [selectedCompanyInfo, setSelectedCompanyInfo] = useState<any>(null)
  const [selectedProductInfo, setSelectedProductInfo] = useState<any>(null)
  const [selectedQuotationInfo, setSelectedQuotationInfo] = useState<any>(null)
  const [availableDiscounts, setAvailableDiscounts] = useState<any[]>([])

  // Calculation logic
  const totals = useMemo(() => {
    const subtotal = formData.quantity * formData.unit_price
    const deliveryTotal = formData.quantity * formData.delivery_price_per_litre
    const discountAmount = subtotal * ((formData.discount || 0) / 100)
    const afterDiscount = subtotal - discountAmount
    const taxableAmount = Math.max(0, afterDiscount + deliveryTotal)

    let taxTotal = 0;
    const appliedTaxes = formData.tax_details.map(t => {
      if (!t.enabled) return { ...t, amount: 0 };
      const amt = (taxableAmount * Number(t.rate)) / 100;
      taxTotal += amt;
      return { ...t, amount: amt };
    });

    const grandTotal = taxableAmount + taxTotal
    return { subtotal, deliveryTotal, taxTotal, grandTotal, appliedTaxes, discountAmount }
  }, [formData])

  const companyAddresses = useMemo(() => {
    if (!selectedCompanyInfo?.details?.addresses) return []
    return selectedCompanyInfo.details.addresses as { label: string, address: string }[]
  }, [selectedCompanyInfo])

  const handleQuotationSelect = (qId: string, quote?: any) => {
    if (quote) {
      setSelectedQuotationInfo(quote)
      setAvailableDiscounts(quote.discounts || [])

      // Inherit taxes from quotation if available
      const qTaxes = Array.isArray(quote.tax_details) ? quote.tax_details : []
      const mergedTaxes = globalTaxes.map(gt => {
        const existing = qTaxes.find((st: any) => st.name === gt.name)
        if (existing) return { ...gt, rate: existing.rate, enabled: existing.enabled }
        return { ...gt, rate: gt.value, enabled: false }
      })

      setFormData(prev => ({
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
        discount: 0,
        term_of_payment: ""
      }))
      // Also update dependent info
      setSelectedCompanyInfo(quote.company)
      setSelectedProductInfo(quote.product)
    } else {
      setSelectedQuotationInfo(null)
      setAvailableDiscounts([])
      setFormData(prev => ({ ...prev, quotation_id: "" }))
    }
  }

  // Fetch Data
  const fetchData = useCallback(async (isInitial = false) => {
    if (isInitial) {
      setLoading(true)
      setOffset(0)
    } else {
      setLoadingMore(true)
    }

    try {
      const currentOffset = isInitial ? 0 : offset

      if (isInitial) {
        const [qRes, tRes] = await Promise.all([
          supabase.from("quotations").select("*, company:companies(id, name, details), product:products(id, sku, name)").eq("status", "Accepted"),
          supabase.from("app_settings").select("*").eq("category", "tax")
        ])
        if (qRes.error) throw qRes.error
        if (tRes.error) throw tRes.error
        setQuotations(qRes.data || [])
        setGlobalTaxes(tRes.data || [])
      }

      let query = supabase
        .from("sales_orders")
        .select("*, company:companies(id, name, details), product:products(id, sku, name), quotation:quotations(id, quotation_number, tax_details, discounts)")
        .order("created_at", { ascending: false })
        .range(currentOffset, currentOffset + PAGE_SIZE - 1)

      if (debouncedSearchQuery) {
        const searchStr = constructMultiWordSearch(debouncedSearchQuery, ['so_number', 'company.name', 'product.sku'])
        if (searchStr) query = query.or(searchStr)
      }

      const { data, error } = await query
      if (error) throw error

      if (data) {
        if (isInitial) {
          setOrders(data)
        } else {
          setOrders(prev => {
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
  }, [supabase, offset, debouncedSearchQuery, dict.MSG_DATA_FETCH_FAILED])

  useEffect(() => {
    fetchData(true)
  }, [debouncedSearchQuery])

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

  // Permission Checks
  const canView = hasPermission("sales-order", "view")
  const canInsert = hasPermission("sales-order", "insert")
  const canEdit = hasPermission("sales-order", "edit")
  const canDelete = hasPermission("sales-order", "delete")
  const canPrint = hasPermission("sales-order", "print")

  const handlePrint = (o: any) => {
    notify.info("Print function is not implemented yet")
  }

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

  // Open Dialog
  const handleOpenDialog = (item: any = null) => {
    if (item) {
      setEditingItem(item)
      setSelectedCompanyInfo(item.company)
      setSelectedProductInfo(item.product)
      setSelectedQuotationInfo(item.quotation)
      setAvailableDiscounts(item.quotation?.discounts || [])

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
        so_number: item.so_number,
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
        status: item.status,
        note: item.note || "",
        is_note_enabled: item.is_note_enabled ?? true,
        tax_details: mergedTaxes
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
        company_id: "",
        quotation_id: "",
        product_id: "",
        so_date: format(new Date(), "yyyy-MM-dd"),
        delivery_date: format(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"),
        quantity: 0,
        unit_price: 0,
        term_of_payment: "",
        delivery_address: "",
        discount: 0,
        delivery_price_per_litre: 0,
        status: "Draft",
        note: "",
        is_note_enabled: true,
        tax_details: globalTaxes.map(gt => ({ ...gt, rate: gt.value, enabled: false }))
      })
    }
    setIsOpen(true)
  }

  // Actions
  const handleSave = async () => {
    setIsSaving(true)
    try {
      const payload = { ...formData }
      if (editingItem) {
        // Handle Quotation Reversion if changed
        if (editingItem.quotation_id && editingItem.quotation_id !== payload.quotation_id) {
          await supabase.from("quotations").update({ status: 'Accepted' }).eq("id", editingItem.quotation_id)
        }

        // If a NEW quotation is being linked
        if (payload.quotation_id && editingItem.quotation_id !== payload.quotation_id) {
          await supabase.from("quotations").update({ status: 'Processed' }).eq("id", payload.quotation_id)
        }

        const { error } = await supabase.from("sales_orders").update(payload).eq("id", editingItem.id)
        if (error) throw error

        // Fetch updated row to keep local state in sync with relations
        const { data: updatedRow, error: fetchError } = await supabase
          .from("sales_orders")
          .select("*, company:companies(id, name, details), product:products(id, sku, name), quotation:quotations(id, quotation_number, tax_details, discounts)")
          .eq("id", editingItem.id)
          .single();

        if (!fetchError && updatedRow) {
          setOrders(prev => prev.map(o => o.id === editingItem.id ? updatedRow : o));
        } else {
          fetchData(true);
        }

        notify.success(dict.MSG_STATUS_UPDATED, dict.MSG_SO_SAVED)
      } else {
        // Generate document number if empty
        if (!payload.so_number) {
          const { data, error: rpcError } = await supabase.rpc('generate_document_number', { p_doc_type: 'sales-order' })
          if (rpcError) throw rpcError
          payload.so_number = data
        }

        const { error } = await supabase.from("sales_orders").insert([payload])
        if (error) throw error

        // If from quotation, update quotation status to Processed
        if (payload.quotation_id) {
          await supabase.from("quotations").update({ status: 'Processed' }).eq("id", payload.quotation_id)
        }

        notify.success(dict.MSG_STATUS_UPDATED, dict.MSG_SO_SAVED)
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
    const item = orders.find(p => p.id === id)
    const label = item ? `[${item.so_number}]` : ""
    if (!confirm(dict.MSG_DELETE_CONFIRM || "Are you sure?")) return
    try {
      // Revert quotation status if linked
      if (item?.quotation_id) {
        await supabase.from("quotations").update({ status: 'Accepted' }).eq("id", item.quotation_id)
      }

      const { error } = await supabase.from("sales_orders").delete().eq("id", id)
      if (error) throw error

      setOrders(prev => prev.filter(o => o.id !== id))
      notify.deleted(dict.MSG_SO_DELETED.replace("%data%", label))
    } catch (err: any) {
      notify.error(dict.MSG_SAVE_FAILED, err.message)
    }
  }

  const updateStatus = async (id: string, status: string) => {
    try {
      const { error } = await supabase.from("sales_orders").update({ status }).eq("id", id)
      if (error) throw error

      setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o))
      notify.success(dict.MSG_STATUS_UPDATED, dict.MSG_SO_STATUS_UPDATED)
    } catch (err: any) {
      notify.error(dict.MSG_UPDATE_FAILED, err.message)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleSave()
  }

  const isFromQuotation = !!formData.quotation_id

  return (
    <div className="page-container h-full flex flex-col overflow-hidden">
      {/* Page Header */}
      <div className="page-header shrink-0">
        <h1 className="page-title">
          <ShoppingBag className="size-5 mr-2 inline-block text-primary" />
          {dict.MENU_SALES_ORDER}
        </h1>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={() => handleOpenDialog()} disabled={!canInsert}>
              <Plus data-icon="inline-start" />
              {dict.BUTTON_NEW_SO}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto p-0 gap-0">
            <DialogHeader className="p-5 border-b sticky top-0 bg-background z-10">
              <DialogTitle>
                <ShoppingBag className="size-5 mr-2 inline-block" />{editingItem ? dict.BUTTON_EDIT + " SO" : dict.BUTTON_NEW_SO}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="flex flex-col gap-6 p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="sonum">{dict.LABEL_SO_NUMBER}</Label>
                    <Input id="sonum" value={formData.so_number} onChange={e => setFormData({ ...formData, so_number: e.target.value })} disabled={editingItem && !hasPermission("sales-order", "edit")} placeholder={dict.LABEL_AUTO_GENERATED} />
                  </div>

                  <div className="grid gap-2">
                    <Label>{dict.LABEL_QUOTATION_NUMBER} ({dict.LABEL_OPTIONAL})</Label>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <LiveSearch
                          key={`quotation-search-${formData.company_id}`}
                          data={selectedQuotationInfo ? [selectedQuotationInfo] : []}
                          fetchData={async (query) => {
                            let q = supabase.from("quotations").select("*, company:companies(id, name, details), product:products(id, sku, name)").eq("status", "Accepted")

                            if (formData.company_id) {
                              q = q.eq("company_id", formData.company_id)
                            }

                            if (query) {
                              const searchStr = constructMultiWordSearch(query, ['quotation_number'])
                              if (searchStr) q = q.or(searchStr)
                            }
                            const { data } = await q
                            return data || []
                          }}
                          value={formData.quotation_id}
                          onSelect={handleQuotationSelect}
                          keyField="id"
                          displayField="quotation_number"
                          defaultDisplay={selectedQuotationInfo?.quotation_number || ""}
                          searchColumns={["quotation_number"]}
                          visualColumns={[
                            { key: "quotation_number", header: dict.LABEL_QUOTATION_NUMBER, className: "w-2/5 font-medium", primary: true }
                          ]}
                          placeholder={dict.PLACEHOLDER_SELECT_QUOTATION}
                          emptyMessage={dict.NO_DATA}
                        />
                      </div>
                      {isFromQuotation && (
                        <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={() => handleQuotationSelect("")}>
                          <X className="size-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label>{dict.LABEL_COMPANY_NAME}</Label>
                    <LiveSearch
                      data={selectedCompanyInfo ? [selectedCompanyInfo] : []}
                      disabled={isFromQuotation}
                      fetchData={async (query) => {
                        let q = supabase.from("companies").select("id, name, type, details").or('type.cs.{Supplier},type.cs.{Customer}').limit(8)
                        if (query) {
                          const searchStr = constructMultiWordSearch(query, ['name', 'details->>contact_person'])
                          if (searchStr) q = q.or(searchStr)
                        }
                        const { data } = await q
                        return (data || []).map((c: any) => ({
                          ...c,
                          contact_person: c.details?.contact_person || ""
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
                        { key: "name", header: dict.LABEL_COMPANY_NAME, className: "w-3/5 font-medium", primary: true },
                        { key: "contact_person", header: dict.LABEL_CONTACT_PERSON, className: "w-2/5" }
                      ]}
                      placeholder={dict.PLACEHOLDER_SEARCH}
                      emptyMessage={dict.NO_DATA}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label>{dict.LABEL_SKU}</Label>
                    <LiveSearch
                      data={selectedProductInfo ? [selectedProductInfo] : []}
                      disabled={isFromQuotation}
                      fetchData={async (query) => {
                        let q = supabase.from("products").select("id, sku, name").limit(8)
                        if (query) {
                          const searchStr = constructMultiWordSearch(query, ['sku', 'name'])
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
                      displayField={p => `${p.sku} - ${p.name}`}
                      defaultDisplay={selectedProductInfo ? (selectedProductInfo.sku && selectedProductInfo.name ? `${selectedProductInfo.sku} - ${selectedProductInfo.name}` : selectedProductInfo.name || selectedProductInfo.sku || "") : ""}
                      searchColumns={["sku", "name"]}
                      visualColumns={[
                        { key: "sku", header: dict.LABEL_SKU, className: "w-1/3 font-mono" },
                        { key: "name", header: dict.LABEL_PRODUCT_NAME, className: "w-2/3", primary: true }
                      ]}
                      placeholder={dict.PLACEHOLDER_SEARCH}
                      emptyMessage={dict.NO_DATA}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label className="flex items-center gap-2"><Calendar className="size-4" /> {dict.LABEL_SO_DATE}</Label>
                      <Input type="date" value={formData.so_date} onChange={e => setFormData({ ...formData, so_date: e.target.value })} />
                    </div>
                    <div className="grid gap-2">
                      <Label className="flex items-center gap-2"><Truck className="size-4" /> {dict.LABEL_DELIVERY_DATE}</Label>
                      <Input type="date" value={formData.delivery_date} onChange={e => setFormData({ ...formData, delivery_date: e.target.value })} />
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="space-y-4 border rounded-lg p-4 bg-primary/5 h-full flex flex-col justify-between">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="qty">{dict.LABEL_QUANTITY}</Label>
                        <NumberInput id="qty" value={formData.quantity} onChange={val => setFormData({ ...formData, quantity: val })} />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="uprice">{dict.LABEL_UNIT_PRICE}</Label>
                        <NumberInput id="uprice" value={formData.unit_price} onChange={val => setFormData({ ...formData, unit_price: val })} leftBadge={SITE_CONFIG.currencySymbol} disabled={isFromQuotation} />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="top">{dict.LABEL_TERM_OF_PAYMENT}</Label>
                        {isFromQuotation && availableDiscounts.length > 0 ? (
                          <Select
                            value={formData.term_of_payment}
                            onValueChange={val => {
                              const disc = availableDiscounts.find(d => d.label === val)
                              setFormData({ ...formData, term_of_payment: val, discount: disc ? disc.value : 0 })
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={dict.PLACEHOLDER_SELECT_TERM} />
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
                          <Input id="top" value={formData.term_of_payment} onChange={e => setFormData({ ...formData, term_of_payment: e.target.value })} placeholder={dict.PLACEHOLDER_TOP} />
                        )}
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="discount">{dict.LABEL_DISCOUNTS}</Label>
                        <NumberInput id="discount" value={formData.discount} onChange={val => setFormData({ ...formData, discount: val })} rightBadge="%" disabled={isFromQuotation} />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="deliv_price">{dict.LABEL_TRANSPORT_COST}</Label>
                        <NumberInput id="deliv_price" value={formData.delivery_price_per_litre} onChange={val => setFormData({ ...formData, delivery_price_per_litre: val })} leftBadge={SITE_CONFIG.currencySymbol} rightBadge="/ L" disabled={isFromQuotation} />
                      </div>
                      <div className="flex flex-col justify-end">
                        <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">{dict.LABEL_SUBTOTAL}</div>
                        <div className="font-mono font-bold text-sm">{SITE_CONFIG.currencySymbol} {totals.subtotal.toLocaleString()}</div>
                      </div>
                    </div>

                    <div className="space-y-3 pt-4 border-t">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-2 block">{dict.LABEL_TAXES || "Taxes"}</Label>
                      <div className="space-y-2">
                        {formData.tax_details.map((tax, idx) => {
                          const calculatedAmount = totals.appliedTaxes.find(t => t.name === tax.name)?.amount || 0;
                          return (
                            <div key={idx} className="flex items-center p-2 border rounded bg-background h-10 gap-3">
                              <div className="w-20 shrink-0 font-medium truncate">
                                <Label htmlFor={`tax-${idx}`} className="cursor-pointer text-[10px]">{tax.name}</Label>
                              </div>
                              <div className="shrink-0 flex items-center justify-center w-8">
                                <Switch id={`tax-${idx}`} checked={tax.enabled} onCheckedChange={(val) => {
                                  const newTaxes = [...formData.tax_details];
                                  newTaxes[idx].enabled = val;
                                  setFormData({ ...formData, tax_details: newTaxes })
                                }} disabled={isFromQuotation} />
                              </div>
                              <div className="w-20 shrink-0">
                                <div style={{ opacity: tax.enabled ? 1 : 0.3 }} className="transition-opacity w-full">
                                  <NumberInput className="text-right font-mono text-[10px]" containerClassName="h-7 bg-muted/50" disabled value={tax.rate} onChange={() => { }} rightBadge="%" />
                                </div>
                              </div>
                              <div className="flex-1 flex justify-end">
                                <span className={cn("font-mono font-medium text-[10px] transition-opacity", tax.enabled ? "opacity-100 text-foreground" : "opacity-30 text-muted-foreground")}>
                                  {SITE_CONFIG.currencySymbol}{calculatedAmount.toLocaleString()}
                                </span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    <div className="space-y-2 border-t pt-4">
                      <div className="flex justify-between text-lg font-bold font-mono">
                        <span>{dict.LABEL_GRAND_TOTAL}:</span>
                        <span className="text-primary">{SITE_CONFIG.currencySymbol} {totals.grandTotal.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-2 w-full">
                <Label>{dict.LABEL_DELIVERY_ADDRESS}</Label>
                {companyAddresses.length > 0 ? (
                  <Select value={formData.delivery_address} onValueChange={val => setFormData({ ...formData, delivery_address: val })} disabled={isFromQuotation}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={dict.PLACEHOLDER_SELECT_ADDRESS} />
                    </SelectTrigger>
                    <SelectContent>
                      {companyAddresses.map((addr, idx) => (
                        <SelectItem key={idx} value={addr.address}>
                          <div className="flex flex-col items-start">
                            <span className="font-medium text-xs">{addr.label}</span>
                            <span className="text-[10px] text-muted-foreground line-clamp-1">{addr.address}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={formData.delivery_address} onChange={e => setFormData({ ...formData, delivery_address: e.target.value })} disabled={isFromQuotation} placeholder={dict.PLACEHOLDER_ENTER_ADDRESS} className="w-full" />
                )}
              </div>

              <div className="w-full">
                <RichTextEditor
                  label={dict.LABEL_NOTE}
                  value={formData.note}
                  onChange={val => setFormData(prev => ({ ...prev, note: val || "" }))}
                  isEnabled={formData.is_note_enabled}
                  onToggleEnabled={val => setFormData(prev => ({ ...prev, is_note_enabled: val }))}
                  placeholder={dict.PLACEHOLDER_EDITOR}
                />
              </div>
            </form>
            <DialogFooter className="p-5 border-t shrink-0 sticky bottom-0 bg-background">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>{dict.BUTTON_CANCEL}</Button>
              <Button onClick={() => handleSave()} disabled={isSaving || (editingItem ? !canEdit : !canInsert)}>
                {isSaving ? <ButtonLoader /> : <Save data-icon="inline-start" />} {dict.BUTTON_SAVE_SO}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Action Bar / Filters */}
      <div className="action-bar shrink-0">
        <div className="relative flex-1 w-full max-sm">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder={dict.PLACEHOLDER_SEARCH}
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Data Area */}
      <Card ref={containerRef} className="data-card flex-1 overflow-auto custom-scrollbar">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm">
            <TableRow>
              <TableHead className="px-7">{dict.LABEL_NAME} (No.)</TableHead>
              <TableHead>{dict.LABEL_COMPANY_NAME}</TableHead>
              <TableHead>{dict.LABEL_SO_DATE}</TableHead>
              <TableHead>{dict.LABEL_QUANTITY}</TableHead>
              <TableHead>{dict.LABEL_STATUS}</TableHead>
              <TableHead className="text-right"> </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="p-0"><SectionLoader /></TableCell>
              </TableRow>
            ) : orders.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">{dict.NO_DATA}</TableCell></TableRow>
            ) : orders.map(o => (
              <TableRow key={o.id} className="group">
                <TableCell className="font-medium">{o.so_number}</TableCell>
                <TableCell>{o.company?.name || "-"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{format(new Date(o.so_date), "dd MMM yyyy")}</TableCell>
                <TableCell className="text-sm">{o.quantity}</TableCell>
                <TableCell>
                  <div className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase w-fit",
                    o.status === "Approved" ? "bg-green-100 text-green-700" :
                      o.status === "Rejected" ? "bg-red-100 text-red-700" :
                        o.status === "Sent" ? "bg-blue-100 text-blue-700" :
                          "bg-amber-100 text-amber-700"
                  )}>
                    {o.status}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="table_action" size="sm" onClick={() => handleOpenDialog(o)} disabled={!canEdit}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button variant="table_action" size="sm" onClick={() => handlePrint(o)} disabled={!canPrint}>
                      <Printer className="size-4" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="secondary" size="icon" className="size-8">
                          <ChevronDown className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>
                            <CheckCircle2 className="size-4 mr-2" /> {dict.LABEL_STATUS}
                          </DropdownMenuSubTrigger>
                          <DropdownMenuPortal>
                            <DropdownMenuSubContent>
                              <DropdownMenuItem onClick={() => updateStatus(o.id, 'Approved')} className="text-green-600" disabled={!canEdit}>Approved</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateStatus(o.id, 'Rejected')} className="text-red-700" disabled={!canEdit}>Rejected</DropdownMenuItem>
                            </DropdownMenuSubContent>
                          </DropdownMenuPortal>
                        </DropdownMenuSub>
                        {canDelete && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive focus:bg-destructive/10 focus:text-destructive" onClick={() => handleDelete(o.id)}>
                              <Trash2 className="size-4 mr-2" /> {dict.BUTTON_DELETE}
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))}

            {/* Infinite Scroll Sentinel & Loader */}
            <TableRow ref={observerTarget} className="border-0">
              <TableCell colSpan={6} className="p-0 border-0 overflow-hidden">
                {loadingMore && (
                  <div className="relative h-24 w-full">
                    <SectionLoader />
                  </div>
                )}
                {!hasMore && orders.length > 0 && !loading && (
                  <div className="text-center py-3 text-xs text-danger/70 select-none">
                    — End of data —
                  </div>
                )}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
