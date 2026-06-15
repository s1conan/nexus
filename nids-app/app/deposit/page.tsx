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
import { Switch } from "@/components/ui/switch"
import {
  Plus,
  Search,
  Pencil,
  Save,
  X,
  Trash2,
  ChevronDown,
  CheckCircle2,
  Banknote,
  Calendar,
  CirclePile,
  Wallet,
  Printer,
  AlertCircle
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { NumberInput } from "@/components/number-input"
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
import { ButtonLoader } from "@/components/button-loader"

export default function DepositsPage() {
  const { dict, lang } = useDictionary()
  const { hasPermission, profile, loading: authLoading } = useAuth()
  const supabase = createClient()

  const [deposits, setDeposits] = useState<any[]>([])
  const [appBanks, setAppBanks] = useState<any[]>([])
  const [globalTaxes, setGlobalTaxes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Dialog State
  const [isOpen, setIsOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)

  // Filter States
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCompanyInfo, setSelectedCompanyInfo] = useState<any>(null)
  const [selectedProductInfo, setSelectedProductInfo] = useState<any>(null)

  // Form State
  const [formData, setFormData] = useState(() => ({
    deposit_number: "",
    company_id: "",
    product_id: "",
    deposit_date: format(new Date(), "yyyy-MM-dd"),
    qty_liter: 0,
    price_per_liter: 0,
    total_amount: 0,
    payment_method: "Transfer",
    payment_bank_account: null as any,
    status: "Pending",
    note: "",
    is_note_enabled: true,
    tax_details: [] as any[]
  }))

  // Permission Checks
  const canView = hasPermission("deposit", "view")
  const canInsert = hasPermission("deposit", "insert")
  const canEdit = hasPermission("deposit", "edit")
  const canDelete = hasPermission("deposit", "delete")
  const canPrint = hasPermission("deposit", "print")

  // Fetch Data
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [dRes, bRes, tRes] = await Promise.all([
        supabase.from("deposits").select("*, company:companies(id, name, details->contact_person)").order("created_at", { ascending: false }),
        supabase.from("app_settings").select("value").eq("category", "company").eq("name", "bank").maybeSingle(),
        supabase.from("app_settings").select("*").eq("category", "tax")
      ])

      if (dRes.error) throw dRes.error
      if (bRes.error) throw bRes.error
      if (tRes.error) throw tRes.error

      setDeposits(dRes.data || [])
      setAppBanks(bRes.data?.value || [])
      setGlobalTaxes(tRes.data || [])
    } catch (err: any) {
      notify.error(dict.MSG_DATA_FETCH_FAILED, err.message)
    } finally {
      setLoading(false)
    }
  }, [supabase, dict.MSG_DATA_FETCH_FAILED])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Calculation logic
  const totals = useMemo(() => {
    const subtotal = formData.qty_liter * formData.price_per_liter;
    let taxTotal = 0;
    const appliedTaxes = formData.tax_details.map(t => {
      if (!t.enabled) return { ...t, amount: 0 };
      const amt = (subtotal * Number(t.rate)) / 100;
      taxTotal += amt;
      return { ...t, amount: amt };
    });
    const grandTotal = subtotal + taxTotal;
    return { subtotal, taxTotal, grandTotal, appliedTaxes };
  }, [formData.qty_liter, formData.price_per_liter, formData.tax_details])

  // Update total amount whenever grandTotal changes
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      total_amount: totals.grandTotal
    }))
  }, [totals.grandTotal])

  const handlePrint = (d: any) => {
    notify.info("Print function is not implemented yet")
  }

  // Open Dialog
  const handleOpenDialog = (item: any = null) => {
    if (item) {
      setEditingItem(item)
      setSelectedCompanyInfo(item.company)
      setSelectedProductInfo(item.product)

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
        deposit_number: item.deposit_number,
        company_id: item.company_id,
        deposit_date: item.deposit_date,
        qty_liter: item.qty_liter || 0,
        price_per_liter: item.price_per_liter || 0,
        total_amount: item.total_amount || 0,
        payment_method: item.payment_method || "Transfer",
        payment_bank_account: item.payment_bank_account || null,
        status: item.status,
        note: item.note || "",
        is_note_enabled: item.is_note_enabled ?? true,
        tax_details: mergedTaxes
      })
    } else {
      if (!canInsert) return
      setEditingItem(null)
      setSelectedCompanyInfo(null)

      setFormData({
        deposit_number: "", // Will be auto-generated on save if empty
        company_id: "",
        deposit_date: format(new Date(), "yyyy-MM-dd"),
        qty_liter: 0,
        price_per_liter: 0,
        total_amount: 0,
        payment_method: "Transfer",
        payment_bank_account: null,
        status: "Pending",
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
      const payload = { 
        ...formData,
        total_amount: totals.grandTotal // Ensure we use the latest calculation
      }
      if (editingItem) {
        const { error } = await supabase.from("deposits").update(payload).eq("id", editingItem.id)
        if (error) throw error
        notify.success(dict.MSG_STATUS_UPDATED, dict.MSG_DEPOSIT_SAVED)
      } else {
        // Generate document number if empty
        if (!payload.deposit_number) {
          const { data, error: rpcError } = await supabase.rpc('generate_document_number', { p_doc_type: 'deposit' })
          if (rpcError) throw rpcError
          payload.deposit_number = data
        }

        const { error } = await supabase.from("deposits").insert([payload])
        if (error) throw error
        notify.success(dict.MSG_STATUS_UPDATED, dict.MSG_DEPOSIT_SAVED)
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
      const { error } = await supabase.from("deposits").delete().eq("id", id)
      if (error) throw error
      notify.success(dict.MSG_STATUS_UPDATED, dict.MSG_DEPOSIT_DELETED)
      fetchData()
    } catch (err: any) {
      notify.error(dict.MSG_SAVE_FAILED, err.message)
    }
  }

  const updateStatus = async (id: string, status: string) => {
    try {
      const { error } = await supabase.from("deposits").update({ status }).eq("id", id)
      if (error) throw error
      notify.success(dict.MSG_STATUS_UPDATED, dict.MSG_DEPOSIT_STATUS_UPDATED)
      fetchData()
    } catch (err: any) {
      notify.error(dict.MSG_UPDATE_FAILED, err.message)
    }
  }

  // Search filter
  const filteredDeposits = useMemo(() => {
    const words = searchQuery.toLowerCase().split(/\s+/).filter(Boolean)
    if (words.length === 0) return deposits

    return deposits.filter(d => {
      const searchFields = [
        d.deposit_number,
        d.company?.name || "",
        d.company?.contact_person || ""
      ]
      return searchFields.some(field => {
        const val = String(field).toLowerCase()
        return words.every(word => val.includes(word))
      })
    })
  }, [deposits, searchQuery])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleSave()
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

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">
          <CirclePile className="size-5 mr-2 inline-block text-primary" />
          {dict.MENU_DEPOSIT}
        </h1>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={() => handleOpenDialog()} disabled={!canInsert}>
              <Plus data-icon="inline-start" />
              {dict.BUTTON_NEW_DEPOSIT}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                <CirclePile className="size-5 mr-2 inline-block" />{editingItem ? dict.BUTTON_EDIT + " Setoran" : dict.BUTTON_NEW_DEPOSIT}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="flex flex-col gap-6 p-5 overflow-y-auto max-h-[70vh]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="dnum">{dict.LABEL_DEPOSIT_NUMBER}</Label>
                  <Input id="dnum" value={formData.deposit_number} onChange={e => setFormData({ ...formData, deposit_number: e.target.value })} disabled={editingItem && !hasPermission("deposit", "edit")} placeholder={dict.LABEL_AUTO_GENERATED} />
                </div>

                <div className="grid gap-2">
                  <Label>{dict.LABEL_COMPANY_NAME}</Label>
                  <LiveSearch
                    data={selectedCompanyInfo ? [selectedCompanyInfo] : []}
                    fetchData={async (query) => {
                      let q = supabase.from("companies").select("id, name, contact_person:details->contact_person").contains('type', ['Supplier']).limit(8)
                      if (query) {
                        const searchStr = constructMultiWordSearch(query, ['name', 'details->>contact_person'])
                        if (searchStr) q = q.or(searchStr)
                      }
                      const { data } = await q
                      return data || []
                    }}
                    value={formData.company_id}
                    onSelect={(val, item) => {
                      setFormData({ ...formData, company_id: val })
                      setSelectedCompanyInfo(item)
                    }}
                    keyField="id"
                    displayField="name"
                    defaultDisplay={editingItem?.company_id === formData.company_id ? editingItem?.company?.name : ""}
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
                  <Label>{dict.LABEL_PRODUCT_NAME}</Label>
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
                    displayField="name"
                    defaultDisplay={editingItem?.product_id === formData.product_id ? editingItem?.product?.name : ""}
                    searchColumns={["sku", "name"]}
                    visualColumns={[
                      { key: "sku", header: "SKU", className: "w-1/3 font-mono", primary: true },
                      { key: "name", header: dict.LABEL_PRODUCT_NAME, className: "w-2/3" }
                    ]}
                    placeholder={dict.PLACEHOLDER_SEARCH}
                    emptyMessage={dict.NO_DATA}
                  />
                </div>

                <div className="grid gap-2">
                  <Label className="flex items-center gap-2">{dict.LABEL_QUANTITY}</Label>
                  <NumberInput value={formData.qty_liter} onChange={val => setFormData({ ...formData, qty_liter: val })} rightBadge="L" />
                </div>

                <div className="grid gap-2">
                  <Label className="flex items-center gap-2 text-muted-foreground">{dict.LABEL_UNIT_PRICE}</Label>
                  <NumberInput value={formData.price_per_liter} onChange={val => setFormData({ ...formData, price_per_liter: val })} leftBadge="Rp" rightBadge="/ L" />
                </div>

                <div className="col-span-1 md:col-span-2 space-y-4 border rounded-lg p-4 bg-muted/10 h-fit">
                  <div className="flex justify-between text-sm font-mono text-foreground font-semibold mb-2 mr-2">
                    <span>{dict.LABEL_SUBTOTAL || "Subtotal"}:</span>
                    <span>Rp {totals.subtotal.toLocaleString()}</span>
                  </div>

                  <div className="space-y-2 pt-2 border-t">
                    <Label className="text-xs uppercase font-bold text-muted-foreground tracking-wider mb-2 block">{dict.LABEL_TAXES || "Taxes"}</Label>
                    <div className="space-y-2">
                      {formData.tax_details.map((tax, idx) => {
                        const calculatedAmount = totals.appliedTaxes.find(t => t.name === tax.name)?.amount || 0;
                        return (
                          <div key={idx} className="flex items-center p-2 border rounded bg-background h-10 gap-4">
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

                            <div className="w-24 shrink-0 flex items-center gap-2">
                              <div style={{ opacity: tax.enabled ? 1 : 0.3 }} className="transition-opacity w-full">
                                <NumberInput
                                  className="text-right font-mono text-xs"
                                  containerClassName="h-6 bg-muted/50"
                                  disabled
                                  value={tax.rate}
                                  onChange={() => { }}
                                  rightBadge="%"
                                />
                              </div>
                            </div>

                            <div className="flex-1 flex justify-end">
                              <span className={cn(
                                "font-mono text-sm transition-opacity",
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

                  <div className="flex justify-between text-sm font-bold border-t pt-4 font-mono mr-2">
                    <span>{dict.LABEL_GRAND_TOTAL || "Grand Total"}:</span>
                    <span className="text-primary">Rp {totals.grandTotal.toLocaleString()}</span>
                  </div>
                </div>

                <div className="grid gap-2 md:col-span-2">
                  <Label>{dict.LABEL_PAYMENT_METHOD}</Label>
                  <div className="flex gap-2">
                    <Input className="w-1/3" value={formData.payment_method} onChange={e => setFormData({ ...formData, payment_method: e.target.value })} placeholder="e.g. Transfer" />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="flex-1 justify-between">
                          {formData.payment_bank_account ? `${formData.payment_bank_account.bank_name} - ${formData.payment_bank_account.account_number}` : "Select Bank (Optional)"}
                          <ChevronDown className="size-4 opacity-50" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-80">
                        <DropdownMenuItem onClick={() => setFormData({ ...formData, payment_bank_account: null })}>
                          None / Manual
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {appBanks.map((bank, idx) => (
                          <DropdownMenuItem key={idx} onClick={() => setFormData({ ...formData, payment_bank_account: bank })}>
                            <div className="flex flex-col">
                              <span className="font-medium">{bank.bank_name}</span>
                              <span className="text-xs text-muted-foreground">{bank.account_number} ({bank.account_name})</span>
                            </div>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <RichTextEditor
                  label={dict.LABEL_NOTE}
                  value={formData.note}
                  onChange={val => setFormData({ ...formData, note: val || "" })}
                  isEnabled={formData.is_note_enabled}
                  onToggleEnabled={val => setFormData({ ...formData, is_note_enabled: val })}
                  placeholder="..."
                />
              </div>
            </form>
            <DialogFooter className="px-5 pb-5">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                {dict.BUTTON_CANCEL}
              </Button>
              <Button onClick={() => handleSave()} disabled={isSaving || (editingItem ? !canEdit : !canInsert)}>
                {isSaving ? <ButtonLoader /> : <Save data-icon="inline-start" />} {dict.BUTTON_SAVE_DEPOSIT}
              </Button>
            </DialogFooter>

          </DialogContent>
        </Dialog>
      </div>

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

      <Card className="data-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="px-7">{dict.LABEL_DEPOSIT_NUMBER}</TableHead>
              <TableHead>{dict.LABEL_COMPANY_NAME}</TableHead>
              <TableHead>{dict.LABEL_DEPOSIT_DATE}</TableHead>
              <TableHead>Qty (L)</TableHead>
              <TableHead>{dict.LABEL_TOTAL_PRICE}</TableHead>
              <TableHead>{dict.LABEL_STATUS}</TableHead>
              <TableHead className="text-right"> </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="p-0"><SectionLoader /></TableCell>
              </TableRow>
            ) : filteredDeposits.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">{dict.NO_DATA}</TableCell></TableRow>
            ) : filteredDeposits.map(d => (
              <TableRow key={d.id} className="group">
                <TableCell className="font-medium">{d.deposit_number}</TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{d.company?.name || "-"}</span>
                    {d.company?.contact_person && <span className="text-[10px] text-muted-foreground">{d.company.contact_person}</span>}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{format(new Date(d.deposit_date), "dd MMM yyyy")}</TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-bold">{new Intl.NumberFormat(lang === 'id' ? 'id-ID' : 'en-US').format(d.qty_liter)} L</span>
                    <span className="text-[10px] text-muted-foreground">Rem: {new Intl.NumberFormat(lang === 'id' ? 'id-ID' : 'en-US').format(d.remaining_qty_liter)} L</span>
                  </div>
                </TableCell>
                <TableCell className="font-semibold text-primary">
                  {new Intl.NumberFormat(lang === 'id' ? 'id-ID' : 'en-US', { style: 'currency', currency: 'IDR' }).format(d.total_amount)}
                </TableCell>
                <TableCell>
                  <div className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase w-fit",
                    d.status === "Accepted" ? "bg-green-100 text-green-700" :
                      d.status === "Rejected" ? "bg-red-100 text-red-700" :
                        "bg-amber-100 text-amber-700"
                  )}>
                    {d.status}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="table_action" size="sm" onClick={() => handleOpenDialog(d)} disabled={!canEdit}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button variant="table_action" size="sm" onClick={() => handlePrint(d)} disabled={!canPrint}>
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
                              <DropdownMenuItem onClick={() => updateStatus(d.id, 'Accepted')} className="text-green-600" disabled={!canEdit}>Accepted</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateStatus(d.id, 'Rejected')} className="text-red-600" disabled={!canEdit}>Rejected</DropdownMenuItem>
                            </DropdownMenuSubContent>
                          </DropdownMenuPortal>
                        </DropdownMenuSub>
                        {canDelete && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive focus:bg-destructive/10 focus:text-destructive" onClick={() => handleDelete(d.id)}>
                              <Trash2 className="size-4 mr-2" />
                              {dict.BUTTON_DELETE}
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
