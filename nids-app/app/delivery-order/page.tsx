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
  Truck,
  Calendar,
  User as UserIcon,
  Car,
  Hash,
  Package,
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
import { generateDeliveryOrderPDF } from "@/lib/pdf-generator"
import dynamic from "next/dynamic"

const Gallery = dynamic(() => import("@/components/Gallery"), { ssr: false })

export default function DeliveryOrdersPage() {
  const { dict, lang } = useDictionary()
  const { hasPermission, profile } = useAuth()
  const supabase = createClient()

  const [orders, setOrders] = useState<any[]>([])
  const [companies, setCompanies] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [vehicles, setVehicles] = useState<any[]>([])
  const [companyInfo, setCompanyInfo] = useState<any>(null)
  const [previewDoc, setPreviewDoc] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Dialog State
  const [isOpen, setIsOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)

  // Filter States
  const [searchQuery, setSearchQuery] = useState("")

  // Form State
  const [formData, setFormData] = useState(() => ({
    do_number: "",
    company_id: "",
    product_id: "",
    do_date: format(new Date(), "yyyy-MM-dd"),
    shipment_date: format(new Date(), "yyyy-MM-dd"),
    quantity: 0,
    driver_name: "",
    vehicle_id: "",
    vehicle_number: "",
    status: "Draft",
    note: "",
    is_note_enabled: true,
    compartment_details: [] as { vehicle_compartment_id: string; compartment_number: number; seal_number: string; quantity: number }[]
  }))

  // Fetch Data
  async function fetchData() {
    setLoading(true)
    try {
      const [oRes, cRes, pRes, vRes, sRes] = await Promise.all([
        supabase.from("delivery_orders").select("*, company:companies(name, details->contact_person, details->email), product:products(sku, name), vehicle:vehicles(license_number), compartments:delivery_order_compartments(*, vehicle_compartment:vehicle_compartments(compartment_number))").order("created_at", { ascending: false }),
        supabase.from("companies").select("id, name, details->contact_person, details->email").contains('type', ['Customer']),
        supabase.from("products").select("id, sku, name"),
        supabase.from("vehicles").select("*, compartments:vehicle_compartments(*)"),
        supabase.from("app_settings").select("*").eq("category", "company")
      ])

      if (oRes.error) throw oRes.error
      if (cRes.error) throw cRes.error
      if (pRes.error) throw pRes.error
      if (vRes.error) throw vRes.error

      setOrders(oRes.data || [])
      setCompanies(cRes.data || [])
      setProducts(pRes.data || [])
      setVehicles(vRes.data || [])

      if (sRes.data) {
        const info: any = {}
        sRes.data.forEach((r: any) => { info[r.name] = r.value })
        setCompanyInfo(info)
      }
    } catch (err: any) {
      notify.error(dict.MSG_DATA_FETCH_FAILED, err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // When vehicle changes, auto-fill compartments
  const handleVehicleSelect = (vId: string) => {
    const vehicle = vehicles.find(v => v.id === vId)
    if (vehicle) {
      const compartments = (vehicle.compartments || []).sort((a: any, b: any) => a.compartment_number - b.compartment_number)
      setFormData(prev => ({
        ...prev,
        vehicle_id: vId,
        vehicle_number: vehicle.license_number,
        compartment_details: compartments.map((c: any) => ({
          vehicle_compartment_id: c.id,
          compartment_number: c.compartment_number,
          seal_number: "",
          quantity: 0
        }))
      }))
    } else {
      setFormData(prev => ({ ...prev, vehicle_id: vId, vehicle_number: "", compartment_details: [] }))
    }
  }

  // Permission Checks
  const canEditNum = hasPermission("delivery-order", "edit") || profile?.role === "admin" || profile?.role === "boss"
  const canDelete = hasPermission("delivery-order", "delete") || profile?.role === "admin" || profile?.role === "boss"

  // Open Dialog
  const handleOpenDialog = (item: any = null) => {
    if (item) {
      setEditingItem(item)
      setFormData({
        do_number: item.do_number,
        company_id: item.company_id,
        product_id: item.product_id,
        do_date: item.do_date,
        shipment_date: item.shipment_date,
        quantity: item.quantity,
        driver_name: item.driver_name || "",
        vehicle_id: item.vehicle_id || "",
        vehicle_number: item.vehicle?.license_number || item.vehicle_number || "",
        status: item.status,
        note: item.note || "",
        is_note_enabled: item.is_note_enabled ?? true,
        compartment_details: (item.compartments || []).map((c: any) => ({
          vehicle_compartment_id: c.vehicle_compartment_id,
          compartment_number: c.vehicle_compartment?.compartment_number,
          seal_number: c.seal_number,
          quantity: c.quantity
        }))
      })
    } else {
      setEditingItem(null)
      const nextNum = `DO/${new Date().getFullYear()}/${(orders.length + 1).toString().padStart(3, "0")}`
      setFormData({
        do_number: nextNum,
        company_id: "",
        product_id: "",
        do_date: format(new Date(), "yyyy-MM-dd"),
        shipment_date: format(new Date(), "yyyy-MM-dd"),
        quantity: 0,
        driver_name: "",
        vehicle_id: "",
        vehicle_number: "",
        status: "Draft",
        note: "",
        is_note_enabled: true,
        compartment_details: []
      })
    }
    setIsOpen(true)
  }

  // Actions
  const handleSave = async () => {
    try {
      const { compartment_details, ...payload } = formData
      let doId = editingItem?.id

      if (editingItem) {
        const { error } = await supabase.from("delivery_orders").update(payload).eq("id", editingItem.id)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from("delivery_orders").insert([payload]).select().single()
        if (error) throw error
        doId = data.id
      }

      if (doId) {
        await supabase.from("delivery_order_compartments").delete().eq("delivery_order_id", doId)
        if (compartment_details.length > 0) {
          const compsToInsert = compartment_details.map(c => ({
            delivery_order_id: doId,
            vehicle_compartment_id: c.vehicle_compartment_id,
            seal_number: c.seal_number,
            quantity: c.quantity
          }))
          const { error: cErr } = await supabase.from("delivery_order_compartments").insert(compsToInsert)
          if (cErr) throw cErr
        }
      }

      notify.success(dict.MSG_STATUS_UPDATED, dict.MSG_DO_SAVED)
      setIsOpen(false)
      fetchData()
    } catch (err: any) {
      notify.error(dict.MSG_SAVE_FAILED, err.message)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm(dict.MSG_DELETE_CONFIRM)) return
    try {
      const { error } = await supabase.from("delivery_orders").delete().eq("id", id)
      if (error) throw error
      notify.success(dict.MSG_STATUS_UPDATED, dict.MSG_DO_DELETED)
      fetchData()
    } catch (err: any) {
      notify.error(dict.MSG_SAVE_FAILED, err.message)
    }
  }

  const updateStatus = async (id: string, status: string) => {
    try {
      const { error } = await supabase.from("delivery_orders").update({ status }).eq("id", id)
      if (error) throw error
      notify.success(dict.MSG_STATUS_UPDATED, dict.MSG_DO_STATUS_UPDATED)
      fetchData()
    } catch (err: any) {
      notify.error(dict.MSG_UPDATE_FAILED, err.message)
    }
  }

  const handlePrint = async (o: any) => {
    if (!companyInfo) {
      notify.error(dict.MSG_SAVE_FAILED, "Company information not loaded yet.")
      return
    }

    const dataUri = await generateDeliveryOrderPDF(
      {
        name: companyInfo.name || "PT Anugerah Buana Sriwijaya",
        address: companyInfo.address || "",
        email: companyInfo.email || "",
        logo_url: companyInfo.logo_url || "/images/company-logo.jpg"
      },
      {
        do_number: o.do_number,
        do_date: o.do_date,
        shipment_date: o.shipment_date,
        company_name: o.company?.name || "-",
        product_name: o.product?.name || "-",
        quantity: o.quantity,
        driver_name: o.driver_name || "-",
        vehicle_number: o.vehicle?.license_number || o.vehicle_number || "-",
        compartments: (o.compartments || []).map((c: any) => ({
          compartment_number: c.vehicle_compartment?.compartment_number || 0,
          seal_number: c.seal_number,
          quantity: c.quantity
        })).sort((a: any, b: any) => a.compartment_number - b.compartment_number),
        note: o.is_note_enabled ? o.note : ""
      },
      { save: false, output: "datauri" }
    )

    setPreviewDoc({
      id: o.id,
      title: o.do_number,
      description: `${dict.LABEL_COMPANY_NAME}: ${o.company?.name || "-"}`,
      images: [],
      pdf: dataUri,
      customerEmail: o.company?.email,
      raw: o
    })
  }

  // Search filter
  const filteredOrders = useMemo(() => {
    return orders.filter(o =>
      o.do_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.company?.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.product?.sku || "").toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [orders, searchQuery])

  // Recalculate total quantity from compartments
  useEffect(() => {
    if (formData.compartment_details.length > 0) {
      const total = formData.compartment_details.reduce((sum, c) => sum + (c.quantity || 0), 0)
      if (total !== formData.quantity && total > 0) {
        setFormData(prev => ({ ...prev, quantity: total }))
      }
    }
  }, [formData.compartment_details])

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">
          <Truck className="size-5 mr-2 inline-block text-primary" />
          {dict.MENU_DELIVERY_ORDER}
        </h1>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <Button size="sm" onClick={() => handleOpenDialog()}>
            <Plus data-icon="inline-start" />
            {dict.BUTTON_NEW_DO}
          </Button>
          <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto p-0 gap-0">
            <DialogHeader className="p-5 border-b sticky top-0 bg-background z-10">
              <DialogTitle>
                {editingItem ? dict.BUTTON_EDIT + " DO" : dict.BUTTON_NEW_DO}
              </DialogTitle>
            </DialogHeader>

            <div className="p-6 space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 space-y-6">
                  <div className="space-y-4">
                    <h3 className="font-semibold text-base flex items-center gap-2 border-b pb-2"><Hash className="size-4 text-primary" /> Basic Information</h3>
                    <div className="grid gap-2">
                      <Label htmlFor="donum">{dict.LABEL_DO_NUMBER}</Label>
                      <Input id="donum" value={formData.do_number} onChange={e => setFormData({ ...formData, do_number: e.target.value })} disabled={!canEditNum} className="font-mono font-bold" />
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
                        visualColumns={[{ key: "name", header: dict.LABEL_COMPANY_NAME, className: "w-3/5 font-medium", primary: true }, { key: "contact_person", header: dict.LABEL_CONTACT_PERSON, className: "w-2/5" }]}
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
                        displayField={(p) => `${p.sku} - ${p.name}`}
                        searchColumns={["sku", "name"]}
                        visualColumns={[{ key: "sku", header: dict.LABEL_SKU, className: "w-1/3 font-mono" }, { key: "name", header: dict.LABEL_PRODUCT_NAME, className: "w-2/3", primary: true }]}
                        placeholder={dict.PLACEHOLDER_SEARCH}
                        emptyMessage={dict.NO_DATA}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="qty">{dict.LABEL_QUANTITY}</Label>
                      <Input id="qty" type="number" value={formData.quantity} onChange={e => setFormData({ ...formData, quantity: Number(e.target.value) })} className="text-lg font-bold" />
                    </div>
                  </div>
                </div>
                <div className="lg:col-span-2 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h3 className="font-semibold text-base flex items-center gap-2 border-b pb-2"><Calendar className="size-4 text-primary" /> Dates & Logistics</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label className="text-xs">{dict.LABEL_DO_DATE}</Label>
                          <Input type="date" value={formData.do_date} onChange={e => setFormData({ ...formData, do_date: e.target.value })} />
                        </div>
                        <div className="grid gap-2">
                          <Label className="text-xs">{dict.LABEL_SHIPMENT_DATE}</Label>
                          <Input type="date" value={formData.shipment_date} onChange={e => setFormData({ ...formData, shipment_date: e.target.value })} />
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <Label className="flex items-center gap-2"><UserIcon className="size-4" /> {dict.LABEL_DRIVER_NAME}</Label>
                        <Input value={formData.driver_name} onChange={e => setFormData({ ...formData, driver_name: e.target.value })} placeholder="Enter driver name" />
                      </div>
                      <div className="grid gap-2">
                        <Label className="flex items-center gap-2"><Car className="size-4" /> {dict.LABEL_VEHICLE}</Label>
                        <LiveSearch
                          data={vehicles}
                          value={formData.vehicle_id}
                          onSelect={handleVehicleSelect}
                          keyField="id"
                          displayField="license_number"
                          searchColumns={["license_number", "vehicle_type"]}
                          visualColumns={[{ key: "license_number", header: "License", className: "w-1/2 font-bold", primary: true }, { key: "vehicle_type", header: "Type", className: "w-1/2" }]}
                          placeholder="Select a vehicle..."
                          emptyMessage="No vehicles found."
                        />
                      </div>
                    </div>
                    <div className="space-y-4">
                      <h3 className="font-semibold text-base flex items-center gap-2 border-b pb-2"><Package className="size-4 text-primary" /> {dict.LABEL_COMPARTMENTS}</h3>
                      <div className="space-y-3 max-h-[300px] overflow-auto pr-2">
                        {formData.compartment_details.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">Select a vehicle to see compartments</div>
                        ) : (
                          formData.compartment_details.map((comp, idx) => (
                            <Card key={idx} className="p-3 bg-muted/20">
                              <div className="flex items-center justify-between mb-2"><span className="font-bold text-primary">Komp {comp.compartment_number}</span></div>
                              <div className="grid grid-cols-2 gap-3">
                                <div className="grid gap-1">
                                  <Label className="text-[10px] uppercase">{dict.LABEL_SEAL_NUMBER}</Label>
                                  <Input size={1} className="h-8 text-xs" value={comp.seal_number} onChange={e => {
                                    const newDetails = [...formData.compartment_details]
                                    newDetails[idx].seal_number = e.target.value
                                    setFormData({ ...formData, compartment_details: newDetails })
                                  }} />
                                </div>
                                <div className="grid gap-1">
                                  <Label className="text-[10px] uppercase">{dict.LABEL_QUANTITY}</Label>
                                  <Input type="number" className="h-8 text-xs font-bold" value={comp.quantity} onChange={e => {
                                    const newDetails = [...formData.compartment_details]
                                    newDetails[idx].quantity = Number(e.target.value)
                                    setFormData({ ...formData, compartment_details: newDetails })
                                  }} />
                                </div>
                              </div>
                            </Card>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h3 className="font-semibold text-base border-b pb-2">Additional Notes</h3>
                    <RichTextEditor
                      label={dict.LABEL_NOTE}
                      value={formData.note}
                      onChange={val => setFormData(prev => ({ ...prev, note: val || "" }))}
                      isEnabled={formData.is_note_enabled}
                      onToggleEnabled={val => setFormData(prev => ({ ...prev, is_note_enabled: val }))}
                      placeholder="..."
                    />
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="mt-2 sticky bottom-0 bg-background z-10 border-t pt-4 gap-2 *:w-full *:flex-1 h-22 sm:h-auto">
              <Button variant="outline" onClick={() => setIsOpen(false)} className="px-8">{dict.BUTTON_CANCEL}</Button>
              <Button onClick={handleSave} className="px-10 font-bold"><Save className="size-4 mr-2" />{dict.BUTTON_SAVE_DO}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Action Bar / Filters */}
      <div className="action-bar">
        <div className="relative flex-1 w-full max-w-sm">
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
              <TableHead>{dict.LABEL_DO_DATE}</TableHead>
              <TableHead>{dict.LABEL_VEHICLE}</TableHead>
              <TableHead>{dict.LABEL_QUANTITY}</TableHead>
              <TableHead>{dict.LABEL_STATUS}</TableHead>
              <TableHead className="text-right"> </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="p-0"><SectionLoader /></TableCell>
              </TableRow>
            ) : filteredOrders.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">{dict.NO_DATA}</TableCell></TableRow>
            ) : filteredOrders.map(o => (
              <TableRow key={o.id} className="group">
                <TableCell className="font-medium">{o.do_number}</TableCell>
                <TableCell>{o.company?.name || "-"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{format(new Date(o.do_date), "dd MMM yyyy")}</TableCell>
                <TableCell>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-xs">{o.vehicle?.license_number || o.vehicle_number || "-"}</span>
                    <span className="text-[10px] text-muted-foreground">{o.driver_name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-sm">{o.quantity}</TableCell>
                <TableCell>
                  <div className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase w-fit",
                    o.status === "Delivered" ? "bg-green-100 text-green-700" :
                      o.status === "Cancelled" ? "bg-red-100 text-red-700" :
                        o.status === "Shipped" ? "bg-blue-100 text-blue-700" :
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
                    <Button variant="table_action" size="sm" onClick={() => handlePrint(o)}>
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
                          <DropdownMenuSubTrigger><CheckCircle2 className="size-4 mr-2" /> Status</DropdownMenuSubTrigger>
                          <DropdownMenuPortal>
                            <DropdownMenuSubContent>
                              <DropdownMenuItem onClick={() => updateStatus(o.id, 'Shipped')} className="text-blue-600">Shipped</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateStatus(o.id, 'Delivered')} className="text-green-600">Delivered</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateStatus(o.id, 'Cancelled')} className="text-red-600">Cancelled</DropdownMenuItem>
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

      {previewDoc && (
        <Gallery
          docs={[previewDoc]}
          initialIndex={0}
          labels={{
            previewDocument: "Preview Delivery Order",
            clickToPreview: "Click to preview",
            previousPage: "Previous",
            nextPage: "Next",
            pageLabel: "Page",
            closePreview: "Close",
            download: "Download PDF",
            sendEmail: "Send to Customer",
            confirmEmail: "Are you sure you want to send this DO to"
          }}
          onDownload={(doc) => {
            if (!doc.pdf) return
            const link = document.createElement('a')
            link.href = doc.pdf
            link.download = `DO_${doc.title}.pdf`
            link.click()
          }}
          onClose={() => setPreviewDoc(null)}
        />
      )}
    </div>
  )
}
