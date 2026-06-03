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
  ArrowUpDown
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
import { generateQuotationPDFReact } from "@/lib/pdf-generator-react"
import Gallery from "@/components/Gallery"

interface SortLevel {
  id: string
  column: string
  direction: "asc" | "desc"
}

export default function QuotationsPage() {
  const { dict, lang } = useDictionary()
  const { hasPermission, profile } = useAuth()
  const supabase = createClient()
  
  const [quotations, setQuotations] = useState<any[]>([])
  const [companies, setCompanies] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [availableBanks, setAvailableBanks] = useState<any[]>([])
  const [companyInfo, setCompanyInfo] = useState<any>(null)
  const [previewDoc, setPreviewDoc] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  
  // Dialog State
  const [isOpen, setIsOpen] = useState(false)
  const [isSortOpen, setIsSortOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)
  
  // Filter States
  const [searchQuery, setSearchQuery] = useState("")
  const [sortLevels, setSortLevels] = useState<SortLevel[]>([
    { id: "1", column: "quotation_date", direction: "desc" }
  ])

  // Form State
  const [formData, setFormData] = useState(() => ({
    quotation_number: "",
    company_id: "",
    product_id: "",
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
    bank_accounts: [] as any[]
  }))

  // Fetch Data
  async function fetchData() {
    setLoading(true)
    try {
      const [qRes, cRes, pRes, bRes, sRes] = await Promise.all([
        supabase.from("quotations").select("*, company:companies(name, details->contact_person), product:products(sku, name)").order("created_at", { ascending: false }),
        supabase.from("companies").select("id, name, contact_person:details->contact_person").contains('type', ['Customer']),
        supabase.from("products").select("id, sku, name"),
        supabase.from("app_settings").select("value").eq("category", "company").eq("name", "bank").maybeSingle(),
        supabase.from("app_settings").select("*").eq("category", "company")
      ])

      if (qRes.error) throw qRes.error
      if (cRes.error) throw cRes.error
      if (pRes.error) throw pRes.error

      setQuotations(qRes.data || [])
      setCompanies(cRes.data || [])
      setProducts(pRes.data || [])
      
      if (bRes.data?.value) {
        setAvailableBanks(bRes.data.value as any[])
      } else {
        setAvailableBanks([])
      }

      if (sRes.data) {
        const info: any = {}
        sRes.data.forEach((r: any) => {
          info[r.name] = r.value
        })
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

  // Permission Checks
  const canEditNum = hasPermission("quotation", "edit") || profile?.role === "admin" || profile?.role === "boss"
  const canDelete = hasPermission("quotation", "delete") || profile?.role === "admin" || profile?.role === "boss"

  // Open Dialog
  const handleOpenDialog = (item: any = null) => {
    if (item) {
      setEditingItem(item)
      setFormData({
        quotation_number: item.quotation_number,
        company_id: item.company_id,
        product_id: item.product_id,
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
        bank_accounts: item.bank_accounts || []
      })
    } else {
      setEditingItem(null)
      const nextNum = `QTN/${new Date().getFullYear()}/${(quotations.length + 1).toString().padStart(3, "0")}`
      setFormData({
        quotation_number: nextNum,
        company_id: "",
        product_id: "",
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
        bank_accounts: []
      })
    }
    setIsOpen(true)
  }

  // Actions
  const handleSave = async () => {
    try {
      const payload = { ...formData }
      if (editingItem) {
        const { error } = await supabase.from("quotations").update(payload).eq("id", editingItem.id)
        if (error) throw error
        notify.success(dict.MSG_STATUS_UPDATED, dict.MSG_QUOTATION_SAVED)
      } else {
        const { error } = await supabase.from("quotations").insert([payload])
        if (error) throw error
        notify.success(dict.MSG_STATUS_UPDATED, dict.MSG_QUOTATION_SAVED)
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
      const { error } = await supabase.from("quotations").delete().eq("id", id)
      if (error) throw error
      notify.success(dict.MSG_STATUS_UPDATED, dict.MSG_QUOTATION_DELETED)
      fetchData()
    } catch (err: any) {
      notify.error(dict.MSG_SAVE_FAILED, err.message)
    }
  }

  const updateStatus = async (id: string, status: string) => {
    try {
      const { error } = await supabase.from("quotations").update({ status }).eq("id", id)
      if (error) throw error
      notify.success(dict.MSG_STATUS_UPDATED, dict.MSG_QUOTATION_STATUS_UPDATED)
      fetchData()
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
      const dataUri = await generateQuotationPDFReact(
        {
          name: companyInfo.name || "PT Anugerah Buana Sriwijaya",
          address: companyInfo.address || "",
          email: companyInfo.email || "",
          logo_url: companyInfo.logo_url || "/images/company-logo.jpg"
        },
        {
          quotation_number: q.quotation_number,
          quotation_date: q.quotation_date,
          company_name: q.company?.name || "-",
          content: q.is_content_enabled ? q.content : "",
          discounts: q.discounts || [],
          note: q.is_note_enabled ? q.note : "",
          terms_conditions: q.is_terms_enabled ? q.terms_conditions : "",
          closing_remarks: q.is_closing_enabled ? q.closing_remarks : "",
          bank_accounts: q.bank_accounts || []
        },
        { save: false, output: "datauri" }
      )

      setPreviewDoc({
        id: q.id,
        title: q.quotation_number,
        description: ` ${q.company?.name || "-"}`,
        images: [],
        pdf: dataUri,
        customerEmail: q.company?.email,
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
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: doc.customerEmail,
          subject: `Quotation ${doc.title} - PT Anugerah Buana Sriwijaya`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
              <h1 style="color: #0f172a; font-size: 24px; margin-bottom: 16px;">Quotation ${doc.title}</h1>
              <p style="color: #475569; font-size: 16px; line-height: 24px">Dear ${doc.raw.company?.name},</p>
              <p style="color: #475569; font-size: 16px; line-height: 24px">Please find below the details of your quotation.</p>
              <div style="background-color: #f8fafc; padding: 16px; border-radius: 6px; margin: 24px 0;">
                ${doc.raw.content}
              </div>
              <p style="color: #475569; font-size: 16px; line-height: 24px">Best regards,<br>PT Anugerah Buana Sriwijaya</p>
            </div>
          `
        })
      })
      
      const result = await res.json()
      if (result.success) {
        notify.success(dict.MSG_STATUS_UPDATED, "Email sent successfully.")
      } else {
        throw new Error(result.error)
      }
    } catch (err: any) {
      notify.error("Failed to send email", err.message)
    }
  }

  const getSortableValue = (item: any, column: string) => {
    if (column === 'company.name') return item.company?.name || "";
    if (column === 'product.sku') return item.product?.sku || "";
    return item[column];
  }

  // Final Filtered and Sorted Data
  const sortedAndFilteredData = useMemo(() => {
    // 1. Filter - Including Company Name and SKU
    let result = quotations.filter(q => 
      q.quotation_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (q.company?.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (q.product?.sku || "").toLowerCase().includes(searchQuery.toLowerCase())
    )

    // 2. Multi-level Sort
    return [...result].sort((a, b) => {
      for (const level of sortLevels) {
        const aVal = getSortableValue(a, level.column)
        const bVal = getSortableValue(b, level.column)

        if (aVal === bVal) continue

        const multiplier = level.direction === "asc" ? 1 : -1
        
        // Handle numeric comparison
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return (aVal - bVal) * multiplier
        }
        
        // Handle string comparison (dates are strings in yyyy-MM-dd)
        return String(aVal).localeCompare(String(bVal)) * multiplier
      }
      return 0
    })
  }, [quotations, searchQuery, sortLevels])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    handleSave()
  }

  // Sort UI Handlers
  const addSortLevel = () => {
    setSortLevels([...sortLevels, { id: Math.random().toString(), column: "quotation_number", direction: "asc" }])
  }

  const removeSortLevel = (id: string) => {
    if (sortLevels.length <= 1) return
    setSortLevels(sortLevels.filter(l => l.id !== id))
  }

  const updateSortLevel = (id: string, field: keyof SortLevel, value: any) => {
    setSortLevels(sortLevels.map(l => l.id === id ? { ...l, [field]: value } : l))
  }

  const sortColumns = [
    { label: dict.LABEL_QUOTATION_NUMBER, value: "quotation_number" },
    { label: dict.LABEL_COMPANY_NAME, value: "company.name" },
    { label: dict.LABEL_SKU, value: "product.sku" },
    { label: dict.LABEL_QUOTATION_DATE, value: "quotation_date" },
    { label: dict.LABEL_EXPIRY_DATE, value: "expiry_date" },
    { label: dict.LABEL_MIN_ORDER, value: "minimum_order" },
    { label: dict.LABEL_STATUS, value: "status" }
  ]

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2">
          <ClipboardList className="size-5 text-primary" />
          {dict.MENU_QUOTATION}
        </h1>

        <div className="flex items-center gap-2">
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={() => handleOpenDialog()} className="h-9">
                <Plus data-icon="inline-start" />
                {dict.BUTTON_NEW_QUOTATION}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-4xl">
              <DialogHeader>
                <DialogTitle>
                  {editingItem ? dict.BUTTON_EDIT_QUOTATION : dict.BUTTON_NEW_QUOTATION}
                </DialogTitle>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5  overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Basic Fields */}
                  <div className="space-y-4">
                    <div className="grid gap-2">
                      <Label htmlFor="qnum">{dict.LABEL_QUOTATION_NUMBER}</Label>
                      <Input
                        id="qnum"
                        value={formData.quotation_number}
                        onChange={e => setFormData({ ...formData, quotation_number: e.target.value })}
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
                          { key: "name", header: dict.LABEL_COMPANY_NAME, className: "w-50", primary: true },
                          { key: "contact_person", header: dict.LABEL_CONTACT_PERSON, className: "w-30" }
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
                          { key: "sku", header: dict.LABEL_SKU, className: "w-15 font-mono", primary: true },
                          { key: "name", header: dict.LABEL_PRODUCT_NAME, className: ""}
                        ]}
                        placeholder={dict.SEARCH_PLACEHOLDER}
                        emptyMessage={dict.NO_DATA}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="minorder">{dict.LABEL_MIN_ORDER}</Label>
                        <Input
                          id="minorder"
                          type="number"
                          value={formData.minimum_order}
                          onChange={e => setFormData({ ...formData, minimum_order: Number(e.target.value) })}    
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="shrinkage">{dict.LABEL_SHRINKAGE_TOLERANCE}</Label>
                        <div className="relative">
                          <Input
                            id="shrinkage"
                            type="number"
                            value={formData.shrinkage_tolerance}
                            onChange={e => setFormData({ ...formData, shrinkage_tolerance: Number(e.target.value) })}
                            className="pr-8"
                          />
                          <span className="absolute right-3 top-2.5 text-sm text-muted-foreground">%</span>      
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Date/Expiry Section */}
                  <div className="space-y-4 border rounded-lg p-4 bg-muted/10 h-fit">
                    <div className="grid gap-2">
                      <Label className="flex items-center gap-2"><Calendar className="size-4" /> {dict.LABEL_QUOTATION_DATE}</Label>
                      <Input
                        type="date"
                        value={formData.quotation_date}
                        onChange={e => setFormData({ ...formData, quotation_date: e.target.value })}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label className="flex items-center gap-2"><Clock className="size-4" /> {dict.LABEL_EXPIRY_DATE}</Label>
                        <Input
                          type="date"
                          value={formData.expiry_date}
                          onChange={e => handleDateChange(e.target.value)}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>{dict.LABEL_VALIDITY_DAYS}</Label>
                        <Input
                          type="number"
                          value={formData.expiry_days}
                          onChange={e => handleDaysChange(Number(e.target.value))}
                        />
                      </div>
                    </div>
                    <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <AlertCircle className="size-3" /> {dict.MSG_EXPIRY_INFO}
                    </div>
                  </div>
                </div>

                <DropdownMenuSeparator className="my-2" />

                <div className="space-y-6">
                  <RichTextEditor
                    label={dict.LABEL_CONTENT}
                    value={formData.content}
                    onChange={val => setFormData({ ...formData, content: val || "" })}
                    isEnabled={formData.is_content_enabled}
                    onToggleEnabled={val => setFormData({ ...formData, is_content_enabled: val })}
                    placeholder="..."
                  />
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
                  <RichTextEditor
                    label={dict.LABEL_CLOSING}
                    value={formData.closing_remarks}
                    onChange={val => setFormData({ ...formData, closing_remarks: val || "" })}
                    isEnabled={formData.is_closing_enabled}
                    onToggleEnabled={val => setFormData({ ...formData, is_closing_enabled: val })}
                    placeholder="..."
                  />
                </div>

                <DropdownMenuSeparator className="my-2" />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Bank Accounts Section */}
                  <div className="space-y-4 border rounded-lg p-4 bg-muted/10 h-fit">
                    <Label className="text-base font-semibold">{dict.LABEL_BANK_ACCOUNTS}</Label>
                    <div className="flex flex-col gap-3">
                      {availableBanks.map((bank: any, idx) => {
                        const isSelected = formData.bank_accounts.some((b: any) => b.account_number === bank.account_number)
                        return (
                          <div key={idx} className="flex items-start space-x-3 bg-background p-3 rounded border">
                            <Checkbox
                              id={`bank-${idx}`}
                              checked={isSelected}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setFormData({ ...formData, bank_accounts: [...formData.bank_accounts, bank] }) 
                                } else {
                                  setFormData({ ...formData, bank_accounts: formData.bank_accounts.filter((b: any) => b.account_number !== bank.account_number) })
                                }
                              }}
                              className="mt-0.5"
                            />
                            <Label htmlFor={`bank-${idx}`} className="text-sm font-normal cursor-pointer leading-tight flex flex-col gap-1 w-full">
                              <span className="font-semibold text-foreground">{bank.name} - {bank.branch}</span> 
                              <span className="text-muted-foreground">{bank.account_number} a/n {bank.account_name}</span>
                            </Label>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Discounts Section */}
                  <div className="space-y-4 border rounded-lg p-4 bg-muted/10 h-fit">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-semibold">{dict.LABEL_DISCOUNT_TERMS}</Label>
                      <Button type="button" variant="outline" size="sm" onClick={() => setFormData({ ...formData, discounts: [...formData.discounts, { label: "", value: 0 }] })}>
                        <Plus className="size-4" />
                      </Button>
                    </div>
                    <div className="space-y-3">
                      {formData.discounts.map((d, i) => (
                        <div key={i} className="flex gap-2 items-center border-b border-muted pb-3 last:border-0">
                          <Input
                            className="flex-1 h-9"
                            placeholder={dict.LABEL_DISCOUNT_NAME}
                            value={d.label}
                            onChange={e => {
                              const newD = [...formData.discounts]
                              newD[i].label = e.target.value
                              setFormData({ ...formData, discounts: newD })
                            }}
                          />
                          <div className="relative w-24 shrink-0">
                            <Input
                              type="number"
                              value={d.value}
                              onChange={e => {
                                const newD = [...formData.discounts]
                                newD[i].value = Number(e.target.value)
                                setFormData({ ...formData, discounts: newD })
                              }}
                              className="pr-7 h-9"
                            />
                            <span className="absolute right-2.5 top-2 text-xs text-muted-foreground">%</span>    
                          </div>
                          <Button variant="ghost" size="icon" className="text-destructive shrink-0" onClick={() => setFormData({ ...formData, discounts: formData.discounts.filter((_, idx) => idx !== i) })}>
                            <MinusCircle className="size-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </form>
              <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                {dict.BUTTON_CANCEL}
              </Button>
              <Button type="submit">
                <Save data-icon="inline-start" />
                {dict.BUTTON_SAVE_QUOTATION}
              </Button>
            </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
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

        <Dialog open={isSortOpen} onOpenChange={setIsSortOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="h-9">
              <ArrowUpDown className="size-4 mr-2" />
              Sort
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{dict.TITLE_SORT_SETTINGS}</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4 p-5">
              {sortLevels.map((level, index) => (
                <div key={level.id} className="flex items-center gap-3">
                  <div className="w-17 shrink-0 font-semibold text-sm text-muted-foreground">
                    {index === 0 ? dict.LABEL_SORT_BY : dict.LABEL_THEN_BY}
                  </div>
                  <Select value={level.column} onValueChange={(val) => updateSortLevel(level.id, "column", val)}>
                    <SelectTrigger className="flex-1 h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {sortColumns.map(col => (
                        <SelectItem key={col.value} value={col.value}>{col.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 justify-start pl-3 pr-1"
                    onClick={() => updateSortLevel(level.id, "direction", level.direction === "asc" ? "desc" : "asc")}
                  >
                    {level.direction === "asc" ? (
                      <>
                        <ArrowUpAZ className="size-4 mr-2" />
                        
                      </>
                    ) : (
                      <>
                        <ArrowDownZA className="size-4 mr-2" />
                        
                      </>
                    )}
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="size-9 text-destructive hover:bg-destructive/10"
                    disabled={sortLevels.length <= 1}
                    onClick={() => removeSortLevel(level.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-fit mt-2" onClick={addSortLevel}>
                <Plus className="size-4 mr-2" />
                {dict.BUTTON_ADD_LEVEL}
              </Button>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsSortOpen(false)} className="flex-1">
                <X data-icon="inline-start" />
                {dict.BUTTON_CANCEL}
              </Button>
              <Button onClick={() => setIsSortOpen(false)} className="w-full"><Check data-icon="inline-start" />Apply</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="data-card">
        <Table>
          <TableHeader className="sticky top-0 z-10">
            <TableRow>
              <TableHead>
                <div className="flex items-center gap-1.5" title="Priority Level">
                  {dict.LABEL_QUOTATION_NUMBER}
                  {sortLevels.find(l => l.column === 'quotation_number') && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-bold">
                      {sortLevels.findIndex(l => l.column === 'quotation_number') + 1}
                      {sortLevels.find(l => l.column === 'quotation_number')?.direction === 'asc' ? <ArrowUp className="size-2.5" /> : <ArrowDown className="size-2.5" />}
                    </span>
                  )}
                </div>
              </TableHead>
              <TableHead>
                <div className="flex items-center gap-1.5">
                  {dict.LABEL_COMPANY_NAME}
                  {sortLevels.find(l => l.column === 'company.name') && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-bold">
                      {sortLevels.findIndex(l => l.column === 'company.name') + 1}
                      {sortLevels.find(l => l.column === 'company.name')?.direction === 'asc' ? <ArrowUp className="size-2.5" /> : <ArrowDown className="size-2.5" />}
                    </span>
                  )}
                </div>
              </TableHead>
              <TableHead>{dict.LABEL_SKU}</TableHead>
              <TableHead>
                <div className="flex items-center gap-1.5">
                  {dict.LABEL_QUOTATION_DATE}
                  {sortLevels.find(l => l.column === 'quotation_date') && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-bold">
                      {sortLevels.findIndex(l => l.column === 'quotation_date') + 1}
                      {sortLevels.find(l => l.column === 'quotation_date')?.direction === 'asc' ? <ArrowUp className="size-2.5" /> : <ArrowDown className="size-2.5" />}
                    </span>
                  )}
                </div>
              </TableHead>
              <TableHead>{dict.LABEL_EXPIRY_DATE}</TableHead>
              <TableHead>{dict.LABEL_MIN_ORDER}</TableHead>
              <TableHead>{dict.LABEL_STATUS}</TableHead>
              <TableHead className="text-right">{dict.LABEL_ACTIONS}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="p-0"><SectionLoader /></TableCell>
              </TableRow>
            ) : sortedAndFilteredData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">{dict.NO_DATA}</TableCell>
              </TableRow>
            ) : sortedAndFilteredData.map(q => (
              <TableRow key={q.id}>
                <TableCell className="font-medium">{q.quotation_number}</TableCell>
                <TableCell>{q.company?.name || "-"}</TableCell>
                <TableCell className="text-xs font-mono">{q.product?.sku || "-"}</TableCell>
                <TableCell>{format(new Date(q.quotation_date), "dd MMM yyyy")}</TableCell>
                <TableCell>
                  <div className="flex flex-col gap-0.5">
                    <span>{format(new Date(q.expiry_date), "dd MMM yyyy")}</span>
                    <span className="text-[10px] text-muted-foreground">{q.expiry_days} {lang === 'id' ? 'hari lagi' : 'days left'}</span>
                  </div>
                </TableCell>
                <TableCell>{q.minimum_order}</TableCell>
                <TableCell>
                  <div className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase w-fit",
                    q.status === "Accepted" ? "bg-green-100 text-green-700" :
                    q.status === "Rejected" ? "bg-red-100 text-red-700" :
                    q.status === "Sent" ? "bg-blue-100 text-blue-700" :
                    "bg-amber-100 text-amber-700"
                  )}>
                    {q.status}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="table_action" size="icon" className="size-8" onClick={() => handleOpenDialog(q)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button variant="table_action" size="icon" className="size-8" onClick={() => handlePrint(q)}>
                      <Printer className="size-4" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="secondary" size="icon" className="size-8">
                          <ChevronDown className="size-5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>
                            <CheckCircle2 className="size-4 mr-2" /> Status
                          </DropdownMenuSubTrigger>
                          <DropdownMenuPortal>
                            <DropdownMenuSubContent>
                              <DropdownMenuItem onClick={() => updateStatus(q.id, 'Accepted')} className="text-green-600">
                                Accepted
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateStatus(q.id, 'Rejected')} className="text-red-700">
                                Rejected
                              </DropdownMenuItem>
                            </DropdownMenuSubContent>
                          </DropdownMenuPortal>
                        </DropdownMenuSub>
                        {canDelete && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(q.id)}>
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
            previewDocument: "Preview Document",
            clickToPreview: "Click to preview",
            previousPage: "Previous",
            nextPage: "Next",
            pageLabel: "Page",
            closePreview: "Close",
            download: "Download",
            sendEmail: "Send Email",
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
