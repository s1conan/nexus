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
  Wallet,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

const PAGE_SIZE = 50

export default function PaymentsPage() {
  const { dict, lang } = useDictionary()
  const { hasPermission, loading: authLoading } = useAuth()
  const supabase = createClient()

  const [payments, setPayments] = useState<any[]>([])
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
    payment_number: "",
    invoice_id: "",
    payment_date: format(new Date(), "yyyy-MM-dd"),
    amount: 0,
    payment_method: "Bank Transfer",
    reference_number: "",
    status: "Pending",
    note: ""
  }))

  const [selectedInvoiceInfo, setSelectedInvoiceInfo] = useState<any>(null)

  const fetchData = useCallback(async (isInitial = false) => {
    if (isInitial) {
      setLoading(true)
      setOffset(0)
    } else {
      setLoadingMore(true)
    }

    try {
      const currentOffset = isInitial ? 0 : offset

      let query = supabase
        .from("payments")
        .select("*, invoice:invoices(id, invoice_number, total_amount, paid_amount, company:companies(name))")
        .order("created_at", { ascending: false })
        .range(currentOffset, currentOffset + PAGE_SIZE - 1)

      if (debouncedSearchQuery) {
        const searchStr = constructMultiWordSearch(debouncedSearchQuery, ['payment_number', 'reference_number'])
        if (searchStr) query = query.or(searchStr)
      }

      const { data, error } = await query
      if (error) throw error

      if (data) {
        if (isInitial) {
          setPayments(data)
        } else {
          setPayments(prev => {
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

  const canView = hasPermission("payments", "view")
  const canInsert = hasPermission("payments", "insert")
  const canEdit = hasPermission("payments", "edit")
  const canDelete = hasPermission("payments", "delete")

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
      setSelectedInvoiceInfo(item.invoice)

      setFormData({
        payment_number: item.payment_number,
        invoice_id: item.invoice_id,
        payment_date: item.payment_date,
        amount: item.amount,
        payment_method: item.payment_method,
        reference_number: item.reference_number || "",
        status: item.status,
        note: item.note || ""
      })
    } else {
      if (!canInsert) return
      setEditingItem(null)
      setSelectedInvoiceInfo(null)

      setFormData({
        payment_number: "",
        invoice_id: "",
        payment_date: format(new Date(), "yyyy-MM-dd"),
        amount: 0,
        payment_method: "Bank Transfer",
        reference_number: "",
        status: "Pending",
        note: ""
      })
    }
    setIsOpen(true)
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const payload = { ...formData }

      if (!editingItem && !payload.payment_number) {
        const { data, error: rpcError } = await supabase.rpc('generate_document_number', { p_doc_type: 'payment' })
        if (rpcError) throw rpcError
        payload.payment_number = data
      }

      if (editingItem) {
        const { error } = await supabase.from("payments").update(payload).eq("id", editingItem.id)
        if (error) throw error

        // Fetch updated row to keep local state in sync with relations
        const { data: updatedRow, error: fetchError } = await supabase
          .from("payments")
          .select("*, invoice:invoices(id, invoice_number, total_amount, paid_amount, company:companies(name))")
          .eq("id", editingItem.id)
          .single();
        
        if (!fetchError && updatedRow) {
          setPayments(prev => prev.map(p => p.id === editingItem.id ? updatedRow : p));
        } else {
          fetchData(true);
        }
      } else {
        const { error } = await supabase.from("payments").insert([payload])
        if (error) throw error
        fetchData(true)
      }

      notify.success(dict.MSG_STATUS_UPDATED, dict.MSG_SAVE_SUCCESS?.replace("%data%", dict.MENU_PAYMENTS) || "Payment saved successfully.")
      setIsOpen(false)
    } catch (err: any) {
      notify.error(dict.MSG_SAVE_FAILED, err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    const item = payments.find(p => p.id === id)
    const label = item ? `[${item.payment_number}]` : ""
    if (!confirm(dict.MSG_DELETE_CONFIRM || "Are you sure?")) return
    try {
      const { error } = await supabase.from("payments").delete().eq("id", id)
      if (error) throw error
      
      setPayments(prev => prev.filter(p => p.id !== id))
      notify.deleted(dict.MSG_DELETE_SUCCESS.replace("%data%", label))
    } catch (err: any) {
      notify.error(dict.MSG_SAVE_FAILED, err.message)
    }
  }

  const updateStatus = async (id: string, status: string) => {
    try {
      const { error } = await supabase.from("payments").update({ status }).eq("id", id)
      if (error) throw error
      
      setPayments(prev => prev.map(p => p.id === id ? { ...p, status } : p))
      notify.success(dict.MSG_STATUS_UPDATED, dict.MSG_QUOTATION_STATUS_UPDATED || "Payment status updated.")
    } catch (err: any) {
      notify.error(dict.MSG_UPDATE_FAILED, err.message)
    }
  }

  return (
    <div className="page-container h-full flex flex-col overflow-hidden">
      <div className="page-header shrink-0">
        <h1 className="page-title">
          <Wallet className="size-5 mr-2 inline-block text-primary" />
          {dict.MENU_PAYMENTS || "Payments"}
        </h1>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={() => handleOpenDialog()} disabled={!canInsert}>
              <Plus data-icon="inline-start" />
              {dict.BUTTON_RECORD_PAYMENT || "Record Payment"}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto p-0 gap-0">
            <DialogHeader className="p-5 border-b sticky top-0 bg-background z-10">
              <DialogTitle>
                {editingItem ? `${dict.BUTTON_EDIT} ${dict.MENU_PAYMENTS}` : `${dict.BUTTON_ADD} ${dict.MENU_PAYMENTS}`}
              </DialogTitle>
            </DialogHeader>
            <div className="p-6 space-y-6">
              <div className="grid gap-2">
                <Label>{dict.LABEL_PAYMENT_NUMBER || "Payment Number"}</Label>
                <Input value={formData.payment_number} onChange={e => setFormData({ ...formData, payment_number: e.target.value })} disabled={editingItem && !hasPermission("payments", "edit")} placeholder={dict.LABEL_AUTO_GENERATED} className="font-mono font-bold" />
              </div>
              
              <div className="grid gap-2">
                <Label>{dict.MENU_INVOICE}</Label>
                <LiveSearch
                  data={selectedInvoiceInfo ? [selectedInvoiceInfo] : []}
                  fetchData={async (query) => {
                    let q = supabase.from("invoices").select("id, invoice_number, total_amount, paid_amount, company:companies(name)").neq("status", "Cancelled").limit(8)
                    if (query) {
                      const searchStr = constructMultiWordSearch(query, ['invoice_number'])
                      if (searchStr) q = q.or(searchStr)
                    }
                    const { data } = await q
                    return data || []
                  }}
                  value={formData.invoice_id}
                  onSelect={(val, item) => {
                    setFormData({ 
                      ...formData, 
                      invoice_id: val,
                      amount: item ? (item.total_amount - item.paid_amount) : 0 // Auto-fill remaining amount
                    })
                    setSelectedInvoiceInfo(item)
                  }}
                  keyField="id"
                  displayField={(i) => `${i.invoice_number} - ${i.company?.name || ""}`}
                  defaultDisplay={selectedInvoiceInfo ? `${selectedInvoiceInfo.invoice_number} - ${selectedInvoiceInfo.company?.name || ""}` : ""}
                  searchColumns={["invoice_number"]}
                  visualColumns={[
                    { key: "invoice_number", header: dict.MENU_INVOICE, className: "w-1/2 font-medium font-mono", primary: true },
                    { key: "company.name", header: dict.LABEL_TYPE_CUSTOMER, className: "w-1/2" }
                  ]}
                  placeholder={dict.PLACEHOLDER_SELECT_QUOTATION?.replace(dict.MENU_QUOTATION, dict.MENU_INVOICE)}
                />
                {selectedInvoiceInfo && (
                  <div className="text-xs text-muted-foreground flex gap-4 mt-1">
                    <span>{dict.VERIFY_LABEL_TOTAL?.split(' ')[0]} Total: {SITE_CONFIG.currencySymbol} {Number(selectedInvoiceInfo.total_amount).toLocaleString()}</span>
                    <span className="text-amber-600 font-medium">{dict.LABEL_DUE_DATE?.split(' ')[0]} Due: {SITE_CONFIG.currencySymbol} {(selectedInvoiceInfo.total_amount - selectedInvoiceInfo.paid_amount).toLocaleString()}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>{dict.LABEL_PAYMENT_DATE || "Payment Date"}</Label>
                  <Input type="date" value={formData.payment_date} onChange={e => setFormData({ ...formData, payment_date: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>{dict.LABEL_AMOUNT} ({SITE_CONFIG.currencySymbol})</Label>
                  <Input type="number" value={formData.amount} onChange={e => setFormData({ ...formData, amount: Number(e.target.value) })} className="text-right font-bold" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>{dict.LABEL_PAYMENT_METHOD}</Label>
                  <Select value={formData.payment_method} onValueChange={v => setFormData({ ...formData, payment_method: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder={dict.LABEL_ALL} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Bank Transfer">{lang === "id" ? "Transfer Bank" : "Bank Transfer"}</SelectItem>
                      <SelectItem value="Cash">{lang === "id" ? "Tunai" : "Cash"}</SelectItem>
                      <SelectItem value="Cheque">{lang === "id" ? "Cek / Giro" : "Cheque / Giro"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>{dict.LABEL_REFERENCE_NUMBER || "Reference Number"}</Label>
                  <Input value={formData.reference_number} onChange={e => setFormData({ ...formData, reference_number: e.target.value })} placeholder="e.g. TRF-123456" />
                </div>
              </div>

              <div className="grid gap-2">
                <Label>{dict.LABEL_INTERNAL_NOTE || "Internal Note"}</Label>
                <Textarea value={formData.note} onChange={e => setFormData({ ...formData, note: e.target.value })} placeholder={dict.PLACEHOLDER_EDITOR} />
              </div>
            </div>
            <DialogFooter className="p-5 border-t shrink-0">
              <Button variant="outline" onClick={() => setIsOpen(false)}><X className="mr-2 size-4" />{dict.BUTTON_CANCEL}</Button>
              <Button onClick={handleSave} disabled={isSaving || !canEdit}>
                {isSaving ? <ButtonLoader /> : <Save className="mr-2 size-4" />}
                {dict.BUTTON_SAVE}
              </Button>
            </DialogFooter>
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
              <TableHead className="px-7">{dict.LABEL_PAYMENT_NUMBER || "Payment No"}</TableHead>
              <TableHead>{dict.MENU_INVOICE} & {dict.LABEL_TYPE_CUSTOMER}</TableHead>
              <TableHead>{dict.VERIFY_LABEL_DATE || "Date"}</TableHead>
              <TableHead className="text-right">{dict.LABEL_AMOUNT}</TableHead>
              <TableHead>{dict.LABEL_STATUS}</TableHead>
              <TableHead className="text-right px-7">{dict.LABEL_ACTIONS}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="p-0"><SectionLoader /></TableCell></TableRow>
            ) : payments.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">{dict.NO_DATA}</TableCell></TableRow>
            ) : payments.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="px-7 font-mono font-bold text-sm">
                  {p.payment_number}
                </TableCell>
                <TableCell>
                  <div className="font-medium text-sm">{p.invoice?.invoice_number}</div>
                  <div className="text-xs text-muted-foreground">{p.invoice?.company?.name}</div>
                </TableCell>
                <TableCell className="text-sm">
                  {format(new Date(p.payment_date), "dd MMM yyyy")}
                </TableCell>
                <TableCell className="text-right font-bold text-green-700">
                  {SITE_CONFIG.currencySymbol} {Number(p.amount).toLocaleString()}
                </TableCell>
                <TableCell>
                  <span className={cn("px-2 py-0.5 rounded text-xs font-bold uppercase", 
                    p.status === 'Verified' ? "bg-green-100 text-green-700" :
                    p.status === 'Pending' ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                  )}>
                    {p.status}
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
                        <DropdownMenuItem onClick={() => updateStatus(p.id, 'Pending')}>{dict.LABEL_PENDING || "Pending"}</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => updateStatus(p.id, 'Verified')} className="text-green-600 font-medium">{dict.LABEL_VERIFY || "Verify"}</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => updateStatus(p.id, 'Rejected')} className="text-destructive">{dict.LABEL_REJECT || "Reject"}</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button variant="table_action" size="sm" onClick={() => handleOpenDialog(p)} disabled={!canEdit}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button variant="table_action" size="sm" onClick={() => handleDelete(p.id)} disabled={!canDelete} className="text-destructive hover:text-destructive hover:bg-destructive/10">
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
                {!hasMore && payments.length > 0 && !loading && (
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
