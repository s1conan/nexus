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
  Trash2,
  ChevronDown,
  Receipt,
  AlertCircle
} from "lucide-react"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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
import { LiveSearch } from "@/components/live-search"
import { format } from "date-fns"
import { ButtonLoader } from "@/components/button-loader"
import { RichTextEditor } from "@/components/rich-text-editor"
import { Switch } from "@/components/ui/switch"
import { NumberInput } from "@/components/number-input"

const PAGE_SIZE = 50

export default function InvoicePage() {
  const { dict } = useDictionary()
  const { hasPermission, loading: authLoading } = useAuth()
  const supabase = createClient()

  const [invoices, setInvoices] = useState<any[]>([])
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
    invoice_number: "",
    company_id: "",
    so_id: "",
    issue_date: format(new Date(), "yyyy-MM-dd"),
    due_date: format(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"),
    subtotal: 0,
    status: "Draft",
    note: "",
    is_note_enabled: true,
    tax_details: [] as any[]
  }))

  const [selectedCompanyInfo, setSelectedCompanyInfo] = useState<any>(null)
  const [selectedPOInfo, setSelectedPOInfo] = useState<any>(null)

  // Calculations
  const totals = useMemo(() => {
    const subtotal = formData.subtotal || 0
    let taxTotal = 0;
    const appliedTaxes = formData.tax_details.map(t => {
      if (!t.enabled) return { ...t, amount: 0 };
      const amt = (subtotal * Number(t.rate)) / 100;
      taxTotal += amt;
      return { ...t, amount: amt };
    });
    const grandTotal = subtotal + taxTotal;
    return { subtotal, taxTotal, grandTotal, appliedTaxes };
  }, [formData])

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
        const { data: tRes } = await supabase.from("app_settings").select("*").eq("category", "tax")
        setGlobalTaxes(tRes || [])
      }

      let query = supabase
        .from("invoices")
        .select("*, company:companies(id, name), po:sales_orders(id, so_number, tax_details)")
        .order("created_at", { ascending: false })
        .range(currentOffset, currentOffset + PAGE_SIZE - 1)

      if (debouncedSearchQuery) {
        const searchStr = constructMultiWordSearch(debouncedSearchQuery, ['invoice_number', 'company.name'])
        if (searchStr) query = query.or(searchStr)
      }

      const { data, error } = await query
      if (error) throw error

      if (data) {
        if (isInitial) {
          setInvoices(data)
        } else {
          setInvoices(prev => {
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

  const canView = hasPermission("invoice", "view")
  const canInsert = hasPermission("invoice", "insert")
  const canEdit = hasPermission("invoice", "edit")
  const canDelete = hasPermission("invoice", "delete")

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

  const handleOpenDialog = (item: any = null) => {
    if (item) {
      setEditingItem(item)
      setSelectedCompanyInfo(item.company)
      setSelectedPOInfo(item.po)

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
        invoice_number: item.invoice_number,
        company_id: item.company_id,
        so_id: item.so_id || "",
        issue_date: item.issue_date,
        due_date: item.due_date,
        subtotal: item.subtotal,
        status: item.status,
        note: item.note || "",
        is_note_enabled: item.is_note_enabled ?? true,
        tax_details: mergedTaxes
      })
    } else {
      if (!canInsert) return
      setEditingItem(null)
      setSelectedCompanyInfo(null)
      setSelectedPOInfo(null)

      setFormData({
        invoice_number: "",
        company_id: "",
        so_id: "",
        issue_date: format(new Date(), "yyyy-MM-dd"),
        due_date: format(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"),
        subtotal: 0,
        status: "Draft",
        note: "",
        is_note_enabled: true,
        tax_details: globalTaxes.map(gt => ({ ...gt, rate: gt.value, enabled: false }))
      })
    }
    setIsOpen(true)
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const payload = {
        ...formData,
        tax_amount: totals.taxTotal,
        total_amount: totals.grandTotal
      }

      if (!editingItem && !payload.invoice_number) {
        const { data, error: rpcError } = await supabase.rpc('generate_document_number', { p_doc_type: 'invoice' })
        if (rpcError) throw rpcError
        payload.invoice_number = data
      }

      if (editingItem) {
        const { error } = await supabase.from("invoices").update(payload).eq("id", editingItem.id)
        if (error) throw error

        // Fetch updated row to keep local state in sync with relations
        const { data: updatedRow, error: fetchError } = await supabase
          .from("invoices")
          .select("*, company:companies(id, name), po:sales_orders(id, so_number, tax_details)")
          .eq("id", editingItem.id)
          .single();
        
        if (!fetchError && updatedRow) {
          setInvoices(prev => prev.map(i => i.id === editingItem.id ? updatedRow : i));
        } else {
          fetchData(true);
        }
      } else {
        const { error } = await supabase.from("invoices").insert([payload])
        if (error) throw error
        fetchData(true)
      }

      notify.success(dict.MSG_STATUS_UPDATED, dict.MSG_SAVE_SUCCESS?.replace("%data%", dict.MENU_INVOICE) || "Invoice saved successfully.")
      setIsOpen(false)
    } catch (err: any) {
      notify.error(dict.MSG_SAVE_FAILED, err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    const item = invoices.find(i => i.id === id)
    const label = item ? `[${item.invoice_number}]` : ""
    if (!confirm(dict.MSG_DELETE_CONFIRM || "Are you sure?")) return
    try {
      const { error } = await supabase.from("invoices").delete().eq("id", id)
      if (error) throw error
      
      setInvoices(prev => prev.filter(i => i.id !== id))
      notify.deleted(dict.MSG_DELETE_SUCCESS.replace("%data%", label))
    } catch (err: any) {
      notify.error(dict.MSG_SAVE_FAILED, err.message)
    }
  }

  const updateStatus = async (id: string, status: string) => {
    try {
      const { error } = await supabase.from("invoices").update({ status }).eq("id", id)
      if (error) throw error
      
      setInvoices(prev => prev.map(i => i.id === id ? { ...i, status } : i))
      notify.success(dict.MSG_STATUS_UPDATED, dict.MSG_QUOTATION_STATUS_UPDATED || "Invoice status updated.")
    } catch (err: any) {
      notify.error(dict.MSG_UPDATE_FAILED, err.message)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleSave()
  }

  return (
    <div className="page-container h-full flex flex-col overflow-hidden">
      <div className="page-header shrink-0">
        <h1 className="page-title">
          <Receipt className="size-5 mr-2 inline-block text-primary" />
          {dict.MENU_INVOICE || "Invoices"}
        </h1>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={() => handleOpenDialog()} disabled={!canInsert}>
              <Plus data-icon="inline-start" />
              {dict.BUTTON_NEW_INVOICE || "New Invoice"}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto p-0 gap-0">
            <DialogHeader className="p-5 border-b sticky top-0 bg-background z-10">
              <DialogTitle>
                {editingItem ? `${dict.BUTTON_EDIT} ${dict.MENU_INVOICE}` : `${dict.BUTTON_ADD} ${dict.MENU_INVOICE}`}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="grid gap-2">
                    <Label>{dict.LABEL_INVOICE_NUMBER || "Invoice Number"}</Label>
                    <Input value={formData.invoice_number} onChange={e => setFormData({ ...formData, invoice_number: e.target.value })} disabled={editingItem && !hasPermission("invoice", "edit")} placeholder={dict.LABEL_AUTO_GENERATED} className="font-mono font-bold" />
                  </div>
                  <div className="grid gap-2">
                    <Label>{dict.LABEL_COMPANY_NAME} ({dict.LABEL_TYPE_CUSTOMER})</Label>
                    <LiveSearch
                      data={selectedCompanyInfo ? [selectedCompanyInfo] : []}
                      fetchData={async (query) => {
                        let q = supabase.from("companies").select("id, name").contains('type', ['Customer']).limit(8)
                        if (query) {
                          const searchStr = constructMultiWordSearch(query, ['name'])
                          if (searchStr) q = q.or(searchStr)
                        }
                        const { data } = await q
                        return data || []
                      }}
                      value={formData.company_id}
                      onSelect={(val, item) => {
                        setFormData({ ...formData, company_id: val, so_id: "" })
                        setSelectedCompanyInfo(item)
                        setSelectedPOInfo(null)
                      }}
                      keyField="id"
                      displayField="name"
                      defaultDisplay={selectedCompanyInfo?.name || ""}
                      searchColumns={["name"]}
                      visualColumns={[{ key: "name", header: dict.LABEL_COMPANY_NAME, className: "w-full font-medium", primary: true }]}
                      placeholder={dict.PLACEHOLDER_SEARCH}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>{dict.LABEL_LINK_TO_PO || "Link to PO"} ({dict.LABEL_OPTIONAL})</Label>
                    <LiveSearch
                      data={selectedPOInfo ? [selectedPOInfo] : []}
                      fetchData={async (query) => {
                        if (!formData.company_id) return []
                        let q = supabase.from("sales_orders").select("id, so_number, total_amount, tax_details").eq("company_id", formData.company_id).limit(8)
                        if (query) {
                          const searchStr = constructMultiWordSearch(query, ['so_number'])
                          if (searchStr) q = q.or(searchStr)
                        }
                        const { data } = await q
                        return data || []
                      }}
                      value={formData.so_id}
                      onSelect={(val, item) => {
                        const poTaxes = Array.isArray(item?.tax_details) ? item.tax_details : []
                        const mergedTaxes = globalTaxes.map(gt => {
                          const existing = poTaxes.find((st: any) => st.name === gt.name)
                          if (existing) return { ...gt, rate: existing.rate, enabled: existing.enabled }
                          return { ...gt, rate: gt.value, enabled: false }
                        })

                        setFormData({ 
                          ...formData, 
                          so_id: val,
                          tax_details: mergedTaxes
                        })
                        setSelectedPOInfo(item)
                      }}
                      keyField="id"
                      displayField="so_number"
                      defaultDisplay={selectedPOInfo?.so_number || ""}
                      searchColumns={["so_number"]}
                      visualColumns={[{ key: "so_number", header: dict.LABEL_SO_NUMBER, className: "w-full font-medium", primary: true }]}
                      placeholder={dict.PLACEHOLDER_SELECT_QUOTATION?.replace(dict.MENU_QUOTATION, "SO")}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>{dict.LABEL_ISSUE_DATE || "Issue Date"}</Label>
                      <Input type="date" value={formData.issue_date} onChange={e => setFormData({ ...formData, issue_date: e.target.value })} />
                    </div>
                    <div className="grid gap-2">
                      <Label>{dict.LABEL_DUE_DATE || "Due Date"}</Label>
                      <Input type="date" value={formData.due_date} onChange={e => setFormData({ ...formData, due_date: e.target.value })} />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid gap-2">
                    <Label>{dict.LABEL_SUBTOTAL}</Label>
                    <NumberInput value={formData.subtotal} onChange={val => setFormData({ ...formData, subtotal: val })} className="text-right font-bold text-lg" leftBadge={SITE_CONFIG.currencySymbol} />
                  </div>

                  {/* Aligned Tax Section */}
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
                                {SITE_CONFIG.currencySymbol} {calculatedAmount.toLocaleString()}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div className="mt-6 p-4 rounded-lg bg-primary/10 space-y-2 border border-primary/20 font-mono">
                    <div className="flex justify-between text-sm">
                      <span>{dict.LABEL_SUBTOTAL}</span>
                      <span className="font-semibold">{SITE_CONFIG.currencySymbol} {totals.subtotal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>{dict.LABEL_TAXES || "Taxes"}</span>
                      <span className="font-semibold">+{SITE_CONFIG.currencySymbol} {totals.taxTotal.toLocaleString()}</span>
                    </div>
                    <div className="border-t border-primary/20 pt-2 flex justify-between font-bold text-lg text-primary">
                      <span>{dict.LABEL_GRAND_TOTAL}</span>
                      <span>{SITE_CONFIG.currencySymbol} {totals.grandTotal.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <Switch checked={formData.is_note_enabled} onCheckedChange={(c) => setFormData({ ...formData, is_note_enabled: c })} />
                  <Label>{dict.LABEL_ENABLE_NOTE || "Enable Note"}</Label>
                </div>
                {formData.is_note_enabled && (
                  <RichTextEditor value={formData.note} onChange={val => setFormData({ ...formData, note: val || "" })} placeholder={dict.PLACEHOLDER_EDITOR} />
                )}
              </div>
              <DialogFooter className="pt-5 border-t">
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}><X className="mr-2 size-4" />{dict.BUTTON_CANCEL}</Button>
                <Button onClick={handleSave} disabled={isSaving || !canEdit}>
                  {isSaving ? <ButtonLoader /> : <Save className="mr-2 size-4" />}
                  {dict.BUTTON_SAVE}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="action-bar shrink-0">
        <div className="relative flex-1 w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input placeholder={dict.PLACEHOLDER_SEARCH} className="pl-8" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
      </div>

      <Card ref={containerRef} className="data-card flex-1 overflow-auto custom-scrollbar">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm">
            <TableRow>
              <TableHead className="px-7">{dict.LABEL_INVOICE_NUMBER || "Invoice No"}</TableHead>
              <TableHead>{dict.MENU_INVOICE} & {dict.LABEL_TYPE_CUSTOMER}</TableHead>
              <TableHead>{dict.LABEL_DATES || "Dates"}</TableHead>
              <TableHead className="text-right">{dict.LABEL_AMOUNTS || "Amounts"}</TableHead>
              <TableHead>{dict.LABEL_STATUS}</TableHead>
              <TableHead className="text-right px-7">{dict.LABEL_ACTIONS}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="p-0"><SectionLoader /></TableCell></TableRow>
            ) : invoices.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">{dict.NO_DATA}</TableCell></TableRow>
            ) : invoices.map((i) => (
              <TableRow key={i.id}>
                <TableCell className="px-7">
                  <div className="font-mono font-bold text-sm">{i.invoice_number}</div>
                  {i.po && <div className="text-xs text-muted-foreground">PO: {i.po.so_number}</div>}
                </TableCell>
                <TableCell className="font-medium">{i.company?.name}</TableCell>
                <TableCell>
                  <div className="text-xs">{dict.LABEL_ISSUE_DATE?.split(' ')[0]}: {format(new Date(i.issue_date), "dd MMM yyyy")}</div>
                  <div className="text-xs text-destructive font-medium">{dict.LABEL_DUE_DATE?.split(' ')[0]}: {format(new Date(i.due_date), "dd MMM yyyy")}</div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="font-bold">{SITE_CONFIG.currencySymbol} {Number(i.total_amount).toLocaleString()}</div>
                  <div className="text-xs text-green-600">{dict.LABEL_PAID || "Paid"}: {SITE_CONFIG.currencySymbol} {Number(i.paid_amount).toLocaleString()}</div>
                </TableCell>
                <TableCell>
                  <span className={cn("px-2 py-0.5 rounded text-xs font-bold uppercase", 
                    i.status === 'Paid' ? "bg-green-100 text-green-700" :
                    i.status === 'Partial' ? "bg-blue-100 text-blue-700" :
                    i.status === 'Sent' ? "bg-amber-100 text-amber-700" :
                    i.status === 'Draft' ? "bg-slate-100 text-slate-700" : "bg-red-100 text-red-700"
                  )}>
                    {i.status}
                  </span>
                </TableCell>
                <TableCell className="text-right px-7">
                  <div className="flex justify-end gap-1">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="table_action" size="sm" disabled={!canEdit}>
                          <span className="sr-only">{dict.LABEL_STATUS}</span>
                          <ChevronDown className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => updateStatus(i.id, 'Draft')}>Draft</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => updateStatus(i.id, 'Sent')}>Sent</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => updateStatus(i.id, 'Cancelled')} className="text-destructive">Cancelled</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button variant="table_action" size="sm" onClick={() => handleOpenDialog(i)} disabled={!canEdit}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button variant="table_action" size="sm" onClick={() => handleDelete(i.id)} disabled={!canDelete} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                      <Trash2 className="size-4" />
                    </Button>
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
                {!hasMore && invoices.length > 0 && !loading && (
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
