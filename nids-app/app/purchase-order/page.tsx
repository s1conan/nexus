"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useDictionary } from "@/components/dictionary-provider"
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
  ShoppingCart,
  Calendar,
  Truck,
  AlertCircle
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

export default function PurchaseOrdersPage() {
  const { dict, lang } = useDictionary()
  const { hasPermission, profile, loading: authLoading } = useAuth()
  const supabase = createClient()

  const [orders, setOrders] = useState<any[]>([])
  const [globalTaxes, setGlobalTaxes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Dialog State
  const [isOpen, setIsOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)

  // Filter States
  const [searchQuery, setSearchQuery] = useState("")

  // Form State
  const [formData, setFormData] = useState(() => ({
    po_number: "",
    company_id: "",
    quotation_id: "",
    product_id: "",
    po_date: format(new Date(), "yyyy-MM-dd"),
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
    terms_conditions: "",
    is_terms_enabled: true,
    tax_details: [] as any[]
  }))

  const [selectedCompanyInfo, setSelectedCompanyInfo] = useState<any>(null)
  const [selectedProductInfo, setSelectedProductInfo] = useState<any>(null)
  const [selectedQuotationInfo, setSelectedQuotationInfo] = useState<any>(null)

  // Calculation logic
  const totals = useMemo(() => {
    const subtotal = formData.quantity * formData.unit_price
    const deliveryTotal = formData.quantity * formData.delivery_price_per_litre
    const afterDiscount = subtotal - formData.discount
    const taxableAmount = Math.max(0, afterDiscount + deliveryTotal)
    
    let taxTotal = 0;
    const appliedTaxes = formData.tax_details.map(t => {
      if (!t.enabled) return { ...t, amount: 0 };
      const amt = (taxableAmount * Number(t.rate)) / 100;
      taxTotal += amt;
      return { ...t, amount: amt };
    });

    const grandTotal = taxableAmount + taxTotal
    return { subtotal, deliveryTotal, taxTotal, grandTotal, appliedTaxes }
  }, [formData])

  const companyAddresses = useMemo(() => {
    if (!selectedCompanyInfo?.details?.addresses) return []
    return selectedCompanyInfo.details.addresses as { label: string, address: string }[]
  }, [selectedCompanyInfo])

  const handleQuotationSelect = (qId: string, quote?: any) => {
    if (quote) {
      setSelectedQuotationInfo(quote)
      
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
        unit_price: quote.base_price || 0,
        delivery_price_per_litre: quote.delivery_price || 0,
        tax_details: mergedTaxes
      }))
      // Also update dependent info
      setSelectedCompanyInfo(quote.company)
      setSelectedProductInfo(quote.product)
    } else {
      setFormData(prev => ({ ...prev, quotation_id: qId }))
    }
  }

  // Fetch Data
  async function fetchData() {
    setLoading(true)
    try {
      const [oRes, qRes, tRes] = await Promise.all([
        supabase.from("purchase_orders").select("*, company:companies(id, name, details), product:products(id, sku, name), quotation:quotations(id, quotation_number, tax_details)").order("created_at", { ascending: false }),
        supabase.from("quotations").select("id, quotation_number, company_id, product_id, base_price, delivery_price, tax_details, company:companies(id, name, details), product:products(id, sku, name)").eq("status", "Accepted"),
        supabase.from("app_settings").select("*").eq("category", "tax")
      ])

      if (oRes.error) throw oRes.error
      if (qRes.error) throw qRes.error
      if (tRes.error) throw tRes.error

      setOrders(oRes.data || [])
      setQuotations(qRes.data || [])
      setGlobalTaxes(tRes.data || [])
    } catch (err: any) {
      notify.error(dict.MSG_DATA_FETCH_FAILED, err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Permission Checks
  const canView = hasPermission("purchase-order", "view")
  const canInsert = hasPermission("purchase-order", "insert")
  const canEdit = hasPermission("purchase-order", "edit")
  const canDelete = hasPermission("purchase-order", "delete")
  const canPrint = hasPermission("purchase-order", "print")

  const handlePrint = (o: any) => {
    notify.info("Print function is not implemented yet")
  }

  if (!canView && !loading) {
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
        po_number: item.po_number,
        company_id: item.company_id || "",
        quotation_id: item.quotation_id || "",
        product_id: item.product_id || "",
        po_date: item.po_date,
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
        terms_conditions: item.terms_conditions || "",
        is_terms_enabled: item.is_terms_enabled ?? true,
        tax_details: mergedTaxes
      })
    } else {
      if (!canInsert) return
      setEditingItem(null)
      setSelectedCompanyInfo(null)
      setSelectedProductInfo(null)
      setSelectedQuotationInfo(null)

      setFormData({
        po_number: "", // Will be auto-generated on save if empty
        company_id: "",
        quotation_id: "",
        product_id: "",
        po_date: format(new Date(), "yyyy-MM-dd"),
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
        terms_conditions: "",
        is_terms_enabled: true,
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
        const { error } = await supabase.from("purchase_orders").update(payload).eq("id", editingItem.id)
        if (error) throw error
        notify.success(dict.MSG_STATUS_UPDATED, dict.MSG_PO_SAVED)
      } else {
        // Generate document number if empty
        if (!payload.po_number) {
          const { data, error: rpcError } = await supabase.rpc('generate_document_number', { p_doc_type: 'purchase-order' })
          if (rpcError) throw rpcError
          payload.po_number = data
        }

        const { error } = await supabase.from("purchase_orders").insert([payload])
        if (error) throw error
        notify.success(dict.MSG_STATUS_UPDATED, dict.MSG_PO_SAVED)
      }
      setIsOpen(false)
      fetchData()
    } catch (err: any) {
      notify.error(dict.MSG_SAVE_FAILED, err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm(dict.MSG_DELETE_CONFIRM)) return
    try {
      const { error } = await supabase.from("purchase_orders").delete().eq("id", id)
      if (error) throw error
      notify.success(dict.MSG_STATUS_UPDATED, dict.MSG_PO_DELETED)
      fetchData()
    } catch (err: any) {
      notify.error(dict.MSG_SAVE_FAILED, err.message)
    }
  }

  const updateStatus = async (id: string, status: string) => {
    try {
      const { error } = await supabase.from("purchase_orders").update({ status }).eq("id", id)
      if (error) throw error
      notify.success(dict.MSG_STATUS_UPDATED, dict.MSG_PO_STATUS_UPDATED)
      fetchData()
    } catch (err: any) {
      notify.error(dict.MSG_UPDATE_FAILED, err.message)
    }
  }

  // Search filter
  const filteredOrders = useMemo(() => {
    const words = searchQuery.toLowerCase().split(/\s+/).filter(Boolean)
    if (words.length === 0) return orders

    return orders.filter(o => {
      const searchFields = [
        o.po_number,
        o.company?.name || "",
        o.product?.sku || ""
      ]
      return searchFields.some(field => {
        const val = String(field).toLowerCase()
        return words.every(word => val.includes(word))
      })
    })
  }, [orders, searchQuery])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleSave()
  }

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">
          <ShoppingCart className="size-5 mr-2 inline-block text-primary" />
          {dict.MENU_PURCHASE_ORDER}
        </h1>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={() => handleOpenDialog()} disabled={!canInsert}>
              <Plus data-icon="inline-start" />
              {dict.BUTTON_NEW_PO}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto p-0 gap-0">
            <DialogHeader className="p-5 border-b sticky top-0 bg-background z-10">
              <DialogTitle>
                {editingItem ? dict.BUTTON_EDIT + " PO" : dict.BUTTON_NEW_PO}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="flex flex-col gap-6 p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="ponum">{dict.LABEL_PO_NUMBER}</Label>
                    <Input id="ponum" value={formData.po_number} onChange={e => setFormData({ ...formData, po_number: e.target.value })} disabled={editingItem && !hasPermission("purchase-order", "edit")} placeholder={dict.LABEL_AUTO_GENERATED} />
                  </div>

                  <div className="grid gap-2">
                    <Label>{dict.LABEL_QUOTATION_NUMBER} ({dict.LABEL_OPTIONAL})</Label>
                    <LiveSearch
                      data={selectedQuotationInfo ? [selectedQuotationInfo] : []}
                      fetchData={async (query) => {
                        let q = supabase.from("quotations").select("*, company:companies(id, name, details), product:products(id, sku, name)").limit(8)
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

                  <div className="grid gap-2">
                    <Label>{dict.LABEL_COMPANY_NAME}</Label>
                    <LiveSearch
                      data={selectedCompanyInfo ? [selectedCompanyInfo] : []}
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
                      <Label htmlFor="qty">{dict.LABEL_QUANTITY}</Label>
                      <Input id="qty" type="number" value={formData.quantity} onChange={e => setFormData({ ...formData, quantity: Number(e.target.value) })} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="uprice">{dict.LABEL_UNIT_PRICE}</Label>
                      <Input id="uprice" type="number" value={formData.unit_price} onChange={e => setFormData({ ...formData, unit_price: Number(e.target.value) })} />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="top">{dict.LABEL_TERM_OF_PAYMENT}</Label>
                    <Input id="top" value={formData.term_of_payment} onChange={e => setFormData({ ...formData, term_of_payment: e.target.value })} placeholder={dict.PLACEHOLDER_TOP} />
                  </div>

                  <div className="grid gap-2">
                    <Label>{dict.LABEL_DELIVERY_ADDRESS}</Label>
                    {companyAddresses.length > 0 ? (
                      <Select value={formData.delivery_address} onValueChange={val => setFormData({ ...formData, delivery_address: val })}>
                        <SelectTrigger>
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
                      <Input value={formData.delivery_address} onChange={e => setFormData({ ...formData, delivery_address: e.target.value })} placeholder={dict.PLACEHOLDER_ENTER_ADDRESS} />
                    )}
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="space-y-4 border rounded-lg p-4 bg-muted/10 h-fit">
                    <div className="grid gap-2">
                      <Label className="flex items-center gap-2"><Calendar className="size-4" /> {dict.LABEL_PO_DATE}</Label>
                      <Input type="date" value={formData.po_date} onChange={e => setFormData({ ...formData, po_date: e.target.value })} />
                    </div>
                    <div className="grid gap-2">
                      <Label className="flex items-center gap-2"><Truck className="size-4" /> {dict.LABEL_DELIVERY_DATE}</Label>
                      <Input type="date" value={formData.delivery_date} onChange={e => setFormData({ ...formData, delivery_date: e.target.value })} />
                    </div>
                  </div>

                  <div className="space-y-4 border rounded-lg p-4 bg-primary/5 h-fit">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="discount">{dict.LABEL_DISCOUNTS}</Label>
                        <NumberInput id="discount" value={formData.discount} onChange={val => setFormData({ ...formData, discount: val })} leftBadge="Rp" />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="deliv_price">{dict.LABEL_TRANSPORT_COST}</Label>
                        <NumberInput id="deliv_price" value={formData.delivery_price_per_litre} onChange={val => setFormData({ ...formData, delivery_price_per_litre: val })} leftBadge="Rp" rightBadge="/ L" />
                      </div>
                    </div>

                    <div className="space-y-3 pt-2 border-t">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-2 block">{dict.LABEL_TAXES || "Taxes"}</Label>
                      <div className="space-y-2">
                        {formData.tax_details.map((tax, idx) => {
                          const calculatedAmount = totals.appliedTaxes.find(t => t.name === tax.name)?.amount || 0;
                          return (
                            <div key={idx} className="flex items-center p-2 border rounded bg-background h-12 gap-4">
                              <div className="w-20 shrink-0 font-medium">
                                <Label htmlFor={`tax-${idx}`} className="cursor-pointer text-xs">{tax.name}</Label>
                              </div>

                              <div className="shrink-0 flex items-center justify-center w-10">
                                <Switch id={`tax-${idx}`} checked={tax.enabled} onCheckedChange={(val) => {
                                  const newTaxes = [...formData.tax_details];
                                  newTaxes[idx].enabled = val;
                                  setFormData({ ...formData, tax_details: newTaxes })
                                }} />
                              </div>

                              <div className="w-24 shrink-0">
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
                                  "font-mono font-medium text-xs transition-opacity",
                                  tax.enabled ? "opacity-100 text-foreground" : "opacity-30 text-muted-foreground"
                                )}>
                                  Rp {calculatedAmount.toLocaleString()}
                                </span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    <div className="space-y-2 border-t pt-4">
                      <div className="flex justify-between text-xs text-muted-foreground font-mono">
                        <span>{dict.LABEL_SUBTOTAL}:</span>
                        <span>Rp {totals.subtotal.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground font-mono">
                        <span>{dict.LABEL_DISCOUNTS}:</span>
                        <span className="text-destructive">-Rp {formData.discount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground font-mono">
                        <span>{dict.LABEL_DELIVERY_TOTAL}:</span>
                        <span>Rp {totals.deliveryTotal.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground font-mono">
                        <span>{dict.LABEL_TAXES || "Taxes"}:</span>
                        <span>+Rp {totals.taxTotal.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-lg font-bold border-t pt-2 font-mono">
                        <span>{dict.LABEL_GRAND_TOTAL}:</span>
                        <span className="text-primary">Rp {totals.grandTotal.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-6">
                <RichTextEditor
                  label={dict.LABEL_NOTE}
                  value={formData.note}
                  onChange={val => setFormData(prev => ({ ...prev, note: val || "" }))}
                  isEnabled={formData.is_note_enabled}
                  onToggleEnabled={val => setFormData(prev => ({ ...prev, is_note_enabled: val }))}
                  placeholder={dict.PLACEHOLDER_EDITOR}
                />
                <RichTextEditor
                  label={dict.LABEL_TERMS}
                  value={formData.terms_conditions}
                  onChange={val => setFormData(prev => ({ ...prev, terms_conditions: val || "" }))}
                  isEnabled={formData.is_terms_enabled}
                  onToggleEnabled={val => setFormData(prev => ({ ...prev, is_terms_enabled: val }))}
                  placeholder={dict.PLACEHOLDER_EDITOR}
                />
              </div>
              <DialogFooter className="mt-2 sticky bottom-0 bg-background z-10 border-t pt-4 gap-2 *:w-full *:flex-1 h-22 sm:h-auto">
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>{dict.BUTTON_CANCEL}</Button>
                <Button onClick={() => handleSave()} disabled={isSaving || (editingItem ? !canEdit : !canInsert)}>
                  {isSaving ? <ButtonLoader /> : <Save data-icon="inline-start" />} {dict.BUTTON_SAVE_PO}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Action Bar / Filters */}
      <div className="action-bar">
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
      <Card className="data-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="px-7">{dict.LABEL_NAME} (No.)</TableHead>
              <TableHead>{dict.LABEL_COMPANY_NAME}</TableHead>
              <TableHead>{dict.LABEL_PO_DATE}</TableHead>
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
            ) : filteredOrders.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">{dict.NO_DATA}</TableCell></TableRow>
            ) : filteredOrders.map(o => (
              <TableRow key={o.id} className="group">
                <TableCell className="font-medium">{o.po_number}</TableCell>
                <TableCell>{o.company?.name || "-"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{format(new Date(o.po_date), "dd MMM yyyy")}</TableCell>
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
                            <CheckCircle2 className="size-4 mr-2" /> {dict.MSG_STATUS_UPDATED}
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
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
