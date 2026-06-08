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
  Trash2,
  ChevronDown,
  CheckCircle2,
  Banknote,
  Calendar,
  Wallet
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

export default function DepositsPage() {
  const { dict, lang } = useDictionary()
  const { hasPermission, profile } = useAuth()
  const supabase = createClient()

  const [deposits, setDeposits] = useState<any[]>([])
  const [companies, setCompanies] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Dialog State
  const [isOpen, setIsOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)

  // Filter States
  const [searchQuery, setSearchQuery] = useState("")

  // Form State
  const [formData, setFormData] = useState(() => ({
    deposit_number: "",
    company_id: "",
    deposit_date: format(new Date(), "yyyy-MM-dd"),
    amount: 0,
    payment_method: "Transfer",
    status: "Pending",
    note: "",
    is_note_enabled: true
  }))

  // Fetch Data
  async function fetchData() {
    setLoading(true)
    try {
      const [dRes, cRes] = await Promise.all([
        supabase.from("deposits").select("*, company:companies(name, details->contact_person)").order("created_at", { ascending: false }),
        supabase.from("companies").select("id, name, contact_person:details->contact_person").contains('type', ['Customer'])
      ])

      if (dRes.error) throw dRes.error
      if (cRes.error) throw cRes.error

      setDeposits(dRes.data || [])
      setCompanies(cRes.data || [])
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
  const canEditNum = hasPermission("deposit", "edit") || profile?.role === "admin" || profile?.role === "boss"
  const canDelete = hasPermission("deposit", "delete") || profile?.role === "admin" || profile?.role === "boss"

  // Open Dialog
  const handleOpenDialog = (item: any = null) => {
    if (item) {
      setEditingItem(item)
      setFormData({
        deposit_number: item.deposit_number,
        company_id: item.company_id,
        deposit_date: item.deposit_date,
        amount: item.amount,
        payment_method: item.payment_method || "Transfer",
        status: item.status,
        note: item.note || "",
        is_note_enabled: item.is_note_enabled ?? true
      })
    } else {
      setEditingItem(null)
      const nextNum = `DEP/${new Date().getFullYear()}/${(deposits.length + 1).toString().padStart(3, "0")}`
      setFormData({
        deposit_number: nextNum,
        company_id: "",
        deposit_date: format(new Date(), "yyyy-MM-dd"),
        amount: 0,
        payment_method: "Transfer",
        status: "Pending",
        note: "",
        is_note_enabled: true
      })
    }
    setIsOpen(true)
  }

  // Actions
  const handleSave = async () => {
    try {
      const payload = { ...formData }
      if (editingItem) {
        const { error } = await supabase.from("deposits").update(payload).eq("id", editingItem.id)
        if (error) throw error
        notify.success(dict.MSG_STATUS_UPDATED, dict.MSG_DEPOSIT_SAVED)
      } else {
        const { error } = await supabase.from("deposits").insert([payload])
        if (error) throw error
        notify.success(dict.MSG_STATUS_UPDATED, dict.MSG_DEPOSIT_SAVED)
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
    return deposits.filter(d =>
      d.deposit_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.company?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.company?.contact_person || "").toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [deposits, searchQuery])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleSave()
  }

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">
          <Banknote className="size-5 mr-2 inline-block text-primary" />
          {dict.MENU_DEPOSIT}
        </h1>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <Button size="sm" onClick={() => handleOpenDialog()}>
            <Plus data-icon="inline-start" />
            {dict.BUTTON_NEW_DEPOSIT}
          </Button>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0">
            <DialogHeader className="p-5 border-b sticky top-0 bg-background z-10">
              <DialogTitle>
                {editingItem ? dict.BUTTON_EDIT + " Setoran" : dict.BUTTON_NEW_DEPOSIT}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="flex flex-col gap-6 p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="dnum">{dict.LABEL_DEPOSIT_NUMBER}</Label>
                  <Input id="dnum" value={formData.deposit_number} onChange={e => setFormData({ ...formData, deposit_number: e.target.value })} disabled={!canEditNum} />
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
                  <Label className="flex items-center gap-2"><Calendar className="size-4" /> {dict.LABEL_DEPOSIT_DATE}</Label>
                  <Input type="date" value={formData.deposit_date} onChange={e => setFormData({ ...formData, deposit_date: e.target.value })} />
                </div>

                <div className="grid gap-2">
                  <Label className="flex items-center gap-2"><Wallet className="size-4" /> {dict.LABEL_AMOUNT}</Label>
                  <Input type="number" value={formData.amount} onChange={e => setFormData({ ...formData, amount: Number(e.target.value) })} />
                </div>

                <div className="grid gap-2 md:col-span-2">
                  <Label>{dict.LABEL_PAYMENT_METHOD}</Label>
                  <Input value={formData.payment_method} onChange={e => setFormData({ ...formData, payment_method: e.target.value })} placeholder="e.g. Bank Transfer, Cash" />
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

              <DialogFooter className="mt-2 sticky bottom-0 bg-background z-10 border-t pt-4 gap-2 *:w-full *:flex-1 h-22 sm:h-auto">
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                  {dict.BUTTON_CANCEL}
                </Button>
                <Button type="submit">
                  <Save data-icon="inline-start" />
                  {dict.BUTTON_SAVE_DEPOSIT}
                </Button>
              </DialogFooter>
            </form>
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
              <TableHead>{dict.LABEL_AMOUNT}</TableHead>
              <TableHead>{dict.LABEL_STATUS}</TableHead>
              <TableHead className="text-right"> </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="p-0"><SectionLoader /></TableCell>
              </TableRow>
            ) : filteredDeposits.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">{dict.NO_DATA}</TableCell></TableRow>
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
                <TableCell className="font-semibold text-primary">
                  {new Intl.NumberFormat(lang === 'id' ? 'id-ID' : 'en-US', { style: 'currency', currency: 'IDR' }).format(d.amount)}
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
                    <Button variant="table_action" size="sm" onClick={() => handleOpenDialog(d)}>
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
                              <DropdownMenuItem onClick={() => updateStatus(d.id, 'Accepted')} className="text-green-600">Accepted</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateStatus(d.id, 'Rejected')} className="text-red-600">Rejected</DropdownMenuItem>
                            </DropdownMenuSubContent>
                          </DropdownMenuPortal>
                        </DropdownMenuSub>
                        {canDelete && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(d.id)}>
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
