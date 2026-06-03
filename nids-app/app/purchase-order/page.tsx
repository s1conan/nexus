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
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { SectionLoader } from "@/components/section-loader"
import { notify } from "@/lib/notifications"
import { RichTextEditor } from "@/components/rich-text-editor"
import { LiveSearch } from "@/components/live-search"
import { format } from "date-fns"

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
    product_id: "",
    po_date: format(new Date(), "yyyy-MM-dd"),
    delivery_date: format(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"),
    quantity: 0,
    unit_price: 0,
    status: "Draft",
    
    note: "",
    is_note_enabled: true,
    
    terms_conditions: "",
    is_terms_enabled: true
  }))

  // Fetch Data
  async function fetchData() {
    setLoading(true)
    try {
      const [oRes, cRes, pRes] = await Promise.all([
        supabase.from("purchase_orders").select("*, company:companies(name, details->contact_person), product:products(sku, name)").order("created_at", { ascending: false }),
        supabase.from("companies").select("id, name, contact_person:details->contact_person").contains('type', ['Supplier']),
        supabase.from("products").select("id, sku, name")
      ])

      if (oRes.error) throw oRes.error
      if (cRes.error) throw cRes.error
      if (pRes.error) throw pRes.error

      setOrders(oRes.data || [])
      setCompanies(cRes.data || [])
      setProducts(pRes.data || [])
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
        company_id: item.company_id,
        product_id: item.product_id,
        po_date: item.po_date,
        delivery_date: item.delivery_date,
        quantity: item.quantity,
        unit_price: item.unit_price,
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
        product_id: "",
        po_date: format(new Date(), "yyyy-MM-dd"),
        delivery_date: format(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"),
        quantity: 0,
        unit_price: 0,
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
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2">
          <ShoppingCart className="size-5 text-primary" />
          {dict.MENU_PURCHASE_ORDER}
        </h1>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Basic Fields */}
                <div className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="ponum">{dict.LABEL_PO_NUMBER}</Label>
                    <Input
                      id="ponum"
                      value={formData.po_number}
                      onChange={e => setFormData({ ...formData, po_number: e.target.value })}
                      disabled={!canEditNum}
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
                      placeholder={dict.SEARCH_PLACEHOLDER}
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
                      displayField={(p) => `${p.sku} - ${p.name}`}
                      searchColumns={["sku", "name"]}
                      visualColumns={[
                        { key: "sku", header: dict.LABEL_SKU, className: "w-1/3 font-mono" },
                        { key: "name", header: dict.LABEL_PRODUCT_NAME, className: "w-2/3", primary: true }      
                      ]}
                      placeholder={dict.SEARCH_PLACEHOLDER}
                      emptyMessage={dict.NO_DATA}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="qty">{dict.LABEL_QUANTITY}</Label>
                      <Input
                        id="qty"
                        type="number"
                        value={formData.quantity}
                        onChange={e => setFormData({ ...formData, quantity: Number(e.target.value) })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="uprice">{dict.LABEL_UNIT_PRICE}</Label>
                      <Input
                        id="uprice"
                        type="number"
                        value={formData.unit_price}
                        onChange={e => setFormData({ ...formData, unit_price: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                </div>

                {/* Date Section */}
                <div className="space-y-4 border rounded-lg p-4 bg-muted/10 h-fit">
                  <div className="grid gap-2">
                    <Label className="flex items-center gap-2"><Calendar className="size-4" /> {dict.LABEL_PO_DATE}</Label>
                    <Input
                      type="date"
                      value={formData.po_date}
                      onChange={e => setFormData({ ...formData, po_date: e.target.value })}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label className="flex items-center gap-2"><Truck className="size-4" /> {dict.LABEL_DELIVERY_DATE}</Label>
                    <Input
                      type="date"
                      value={formData.delivery_date}
                      onChange={e => setFormData({ ...formData, delivery_date: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <DropdownMenuSeparator className="my-2" />

              {/* Rich Text Sections */}
              <div className="space-y-6">
                <RichTextEditor
                  label={dict.LABEL_NOTE}
                  value={formData.note}
                  onChange={val => setFormData({ ...formData, note: val || "" })}
                  isEnabled={formData.is_note_enabled}
                  onToggleEnabled={val => setFormData({ ...formData, is_note_enabled: val })}
                  placeholder="..."
                />

                <RichTextEditor
                  label={dict.LABEL_TERMS}
                  value={formData.terms_conditions}
                  onChange={val => setFormData({ ...formData, terms_conditions: val || "" })}
                  isEnabled={formData.is_terms_enabled}
                  onToggleEnabled={val => setFormData({ ...formData, is_terms_enabled: val })}
                  placeholder="..."
                />
              </div>

              <DialogFooter className="mt-2 sticky bottom-0 bg-background z-10 border-t pt-4 gap-2 *:w-full *:flex-1 h-22 sm:h-auto">
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                  {dict.BUTTON_CANCEL}
                </Button>
                <Button type="submit">
                  <Save data-icon="inline-start" />
                  {dict.BUTTON_SAVE_PO}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="action-bar flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="relative flex-1 w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input 
            placeholder={dict.SEARCH_PLACEHOLDER} 
            className="pl-9" 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <Card className="data-card">
        <Table>
          <TableHeader className="bg-muted/30 sticky top-0 z-10">
            <TableRow>
              <TableHead>{dict.LABEL_NAME} (No.)</TableHead>
              <TableHead>{dict.LABEL_COMPANY_NAME}</TableHead>
              <TableHead>{dict.LABEL_SKU}</TableHead>
              <TableHead>{dict.LABEL_PO_DATE}</TableHead>
              <TableHead>{dict.LABEL_DELIVERY_DATE}</TableHead>
              <TableHead>{dict.LABEL_QUANTITY}</TableHead>
              <TableHead>{dict.LABEL_STATUS}</TableHead>
              <TableHead className="text-right">{dict.LABEL_ACTIONS}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="p-0"><SectionLoader /></TableCell>
              </TableRow>
            ) : filteredOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">{dict.NO_DATA}</TableCell>
              </TableRow>
            ) : filteredOrders.map(o => (
              <TableRow key={o.id}>
                <TableCell className="font-medium">{o.po_number}</TableCell>
                <TableCell>{o.company?.name || "-"}</TableCell>
                <TableCell className="text-xs font-mono">{o.product?.sku || "-"}</TableCell>
                <TableCell>{format(new Date(o.po_date), "dd MMM yyyy")}</TableCell>
                <TableCell>{format(new Date(o.delivery_date), "dd MMM yyyy")}</TableCell>
                <TableCell>{o.quantity}</TableCell>
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
                    <Button variant="ghost" size="icon" className="size-8" onClick={() => handleOpenDialog(o)}>
                      <Pencil className="size-4" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <ChevronDown className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => window.print()}>
                          <Printer className="size-4 mr-2" /> {lang === 'id' ? 'Cetak' : 'Print'}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>
                            <CheckCircle2 className="size-4 mr-2" /> {dict.MSG_STATUS_UPDATED}
                          </DropdownMenuSubTrigger>
                          <DropdownMenuPortal>
                            <DropdownMenuSubContent>
                              <DropdownMenuItem onClick={() => updateStatus(o.id, 'Approved')} className="text-green-600">
                                Approved
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateStatus(o.id, 'Rejected')} className="text-red-600">
                                Rejected
                              </DropdownMenuItem>
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
