"use client"

import { useState, useEffect, useMemo } from "react"
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
  Truck
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
  DialogFooter
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
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

export default function PurchaseOrdersPage() {
  const { dict, lang } = useDictionary()
  const { hasPermission, profile } = useAuth()
  const supabase = createClient()

  const [orders, setOrders] = useState<any[]>([])
  const [companies, setCompanies] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

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
    is_tax_enabled: false,
    tax_rate: 11,
    status: "Draft",
    note: "",
    is_note_enabled: true,
    terms_conditions: "",
    is_terms_enabled: true
  }))

  const [quotations, setQuotations] = useState<any[]>([])

  // Calculation logic
  const totals = useMemo(() => {
    const subtotal = formData.quantity * formData.unit_price
    const deliveryTotal = formData.quantity * formData.delivery_price_per_litre
    const afterDiscount = subtotal - formData.discount
    const taxableAmount = Math.max(0, afterDiscount + deliveryTotal)
    const tax = formData.is_tax_enabled ? (taxableAmount * formData.tax_rate) / 100 : 0
    const grandTotal = taxableAmount + tax
    return { subtotal, deliveryTotal, tax, grandTotal }
  }, [formData])

  const selectedCompany = useMemo(() => {
    return companies.find(c => c.id === formData.company_id)
  }, [formData.company_id, companies])

  const companyAddresses = useMemo(() => {
    if (!selectedCompany?.details?.addresses) return []
    return selectedCompany.details.addresses as { label: string, address: string }[]
  }, [selectedCompany])

  const handleQuotationSelect = (qId: string) => {
    const q = quotations.find(item => item.id === qId)
    if (q) {
      setFormData(prev => ({
        ...prev,
        quotation_id: qId,
        company_id: q.company_id,
        product_id: q.product_id,
        unit_price: q.base_price || 0,
        delivery_price_per_litre: q.delivery_price || 0
      }))
    } else {
      setFormData(prev => ({ ...prev, quotation_id: qId }))
    }
  }

  // Fetch Data
  async function fetchData() {
    setLoading(true)
    try {
      const [oRes, cRes, pRes, qRes] = await Promise.all([
        supabase.from("purchase_orders").select("*, company:companies(name, details), product:products(sku, name), quotation:quotations(quotation_number)").order("created_at", { ascending: false }),
        supabase.from("companies").select("id, name, type, details").or('type.cs.{Supplier},type.cs.{Customer}'),
        supabase.from("products").select("id, sku, name"),
        supabase.from("quotations").select("*, company:companies(name), product:products(sku, name)")
      ])

      if (oRes.error) throw oRes.error
      if (cRes.error) throw cRes.error
      if (pRes.error) throw pRes.error
      if (qRes.error) throw qRes.error

      setOrders(oRes.data || [])

      // Map contact_person to the top level for LiveSearch
      const mappedCompanies = (cRes.data || []).map((c: any) => ({
        ...c,
        contact_person: c.details?.contact_person || ""
      }))
      setCompanies(mappedCompanies)

      setProducts(pRes.data || [])
      setQuotations(qRes.data || [])
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
  const canEditNum = hasPermission("purchase-order", "edit") || profile?.role === "admin" || profile?.role === "boss"
  const canDelete = hasPermission("purchase-order", "delete") || profile?.role === "admin" || profile?.role === "boss"

  // Open Dialog
  const handleOpenDialog = (item: any = null) => {
    if (item) {
      setEditingItem(item)
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
        is_tax_enabled: item.is_tax_enabled ?? false,
        tax_rate: item.tax_rate || 11,
        status: item.status,
        note: item.note || "",
        is_note_enabled: item.is_note_enabled ?? true,
        terms_conditions: item.terms_conditions || "",
        is_terms_enabled: item.is_terms_enabled ?? true
      })
    } else {
      setEditingItem(null)
      const nextNum = `PO/${new Date().getFullYear()}/${(orders.length + 1).toString().padStart(3, "0")}`
      setFormData({
        po_number: nextNum,
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
        is_tax_enabled: false,
        tax_rate: 11,
        status: "Draft",
        note: "",
        is_note_enabled: true,
        terms_conditions: "",
        is_terms_enabled: true
      })
    }
    setIsOpen(true)
  }

  // Actions
  const handleSave = async () => {
    try {
      const payload = { ...formData }
      if (editingItem) {
        const { error } = await supabase.from("purchase_orders").update(payload).eq("id", editingItem.id)
        if (error) throw error
        notify.success(dict.MSG_STATUS_UPDATED, dict.MSG_PO_SAVED)
      } else {
        const { error } = await supabase.from("purchase_orders").insert([payload])
        if (error) throw error
        notify.success(dict.MSG_STATUS_UPDATED, dict.MSG_PO_SAVED)
      }
      setIsOpen(false)
      fetchData()
    } catch (err: any) {
      notify.error(dict.MSG_SAVE_FAILED, err.message)
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
    return orders.filter(o =>
      o.po_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.company?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.product?.sku || "").toLowerCase().includes(searchQuery.toLowerCase())
    )
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
          <Button size="sm" onClick={() => handleOpenDialog()}>
            <Plus data-icon="inline-start" />
            {dict.BUTTON_NEW_PO}
          </Button>
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
                    <Input id="ponum" value={formData.po_number} onChange={e => setFormData({ ...formData, po_number: e.target.value })} disabled={!canEditNum} />
                  </div>

                  <div className="grid gap-2">
                    <Label>{dict.LABEL_QUOTATION_NUMBER} ({dict.LABEL_OPTIONAL})</Label>
                    <LiveSearch
                      data={quotations}
                      value={formData.quotation_id}
                      onSelect={handleQuotationSelect}
                      keyField="id"
                      displayField="quotation_number"
                      searchColumns={["quotation_number", "company.name"]}
                      visualColumns={[
                        { key: "quotation_number", header: dict.LABEL_QUOTATION_NUMBER, className: "w-2/5 font-medium", primary: true },
                        { key: "company.name", header: dict.LABEL_COMPANY_NAME, className: "w-3/5" }
                      ]}
                      placeholder={dict.PLACEHOLDER_SELECT_QUOTATION}
                      emptyMessage={dict.NO_DATA}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label>{dict.LABEL_COMPANY_NAME}</Label>
                    <LiveSearch
                      data={companies}
                      value={formData.company_id}
                      onSelect={val => setFormData({ ...formData, company_id: val })}
                      keyField="id"
                      displayField="name"
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
                      data={products}
                      value={formData.product_id}
                      onSelect={val => setFormData({ ...formData, product_id: val })}
                      keyField="id"
                      displayField={p => `${p.sku} - ${p.name}`}
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
                        <Input id="discount" type="number" value={formData.discount} onChange={e => setFormData({ ...formData, discount: Number(e.target.value) })} />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="deliv_price">{dict.LABEL_TRANSPORT_COST}</Label>
                        <Input id="deliv_price" type="number" value={formData.delivery_price_per_litre} onChange={e => setFormData({ ...formData, delivery_price_per_litre: Number(e.target.value) })} />
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-2 border rounded bg-background">
                      <div className="flex items-center gap-4">
                        <Label htmlFor="tax-switch" className="cursor-pointer">{dict.LABEL_TAX_VAT}</Label>
                        <Switch id="tax-switch" checked={formData.is_tax_enabled} onCheckedChange={val => setFormData({ ...formData, is_tax_enabled: val })} />
                      </div>
                      {formData.is_tax_enabled && (
                        <div className="flex items-center gap-2">
                          <Input className="w-16 h-8 text-right" type="number" value={formData.tax_rate} onChange={e => setFormData({ ...formData, tax_rate: Number(e.target.value) })} />
                          <span className="text-sm font-bold">%</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2 border-t pt-4">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{dict.LABEL_SUBTOTAL}:</span>
                        <span>{new Intl.NumberFormat(lang === 'id' ? 'id-ID' : 'en-US', { style: 'currency', currency: 'IDR' }).format(totals.subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{dict.LABEL_DISCOUNTS}:</span>
                        <span className="text-destructive">-{new Intl.NumberFormat(lang === 'id' ? 'id-ID' : 'en-US', { style: 'currency', currency: 'IDR' }).format(formData.discount)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{dict.LABEL_DELIVERY_TOTAL}:</span>
                        <span>{new Intl.NumberFormat(lang === 'id' ? 'id-ID' : 'en-US', { style: 'currency', currency: 'IDR' }).format(totals.deliveryTotal)}</span>
                      </div>
                      {formData.is_tax_enabled && (
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{dict.LABEL_TAX_VAT.replace(/:$/, '')} ({formData.tax_rate}%):</span>
                          <span>{new Intl.NumberFormat(lang === 'id' ? 'id-ID' : 'en-US', { style: 'currency', currency: 'IDR' }).format(totals.tax)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-lg font-bold border-t pt-2">
                        <span>{dict.LABEL_GRAND_TOTAL}:</span>
                        <span className="text-primary">{new Intl.NumberFormat(lang === 'id' ? 'id-ID' : 'en-US', { style: 'currency', currency: 'IDR' }).format(totals.grandTotal)}</span>
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
                <Button type="submit">
                  <Save data-icon="inline-start" /> {dict.BUTTON_SAVE_PO}
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
                    <Button variant="table_action" size="sm" onClick={() => handleOpenDialog(o)}>
                      <Pencil className="size-4" />
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
                              <DropdownMenuItem onClick={() => updateStatus(o.id, 'Approved')} className="text-green-600">Approved</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateStatus(o.id, 'Rejected')} className="text-red-700">Rejected</DropdownMenuItem>
                            </DropdownMenuSubContent>
                          </DropdownMenuPortal>
                        </DropdownMenuSub>
                        {canDelete && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(o.id)}>
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
