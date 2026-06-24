"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
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
import { Plus, Building2, Search, Pencil, Save, X, Phone, Mail, User, Info, Warehouse, Truck, Trash2, RefreshCw, AlertCircle, Users, CheckCircle } from "lucide-react"
import { Input } from "@/components/ui/input"
import { SummaryCard } from "@/components/summary-card"
import { DeleteConfirmationDialog } from "@/components/confirmation-dialog"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { cn, constructMultiWordSearch } from "@/lib/utils"

import { SectionLoader } from "@/components/section-loader"
import { Checkbox } from "@/components/ui/checkbox"
import { notify } from "@/lib/notifications"
import { usePersistedState } from "@/hooks/use-persisted-state"
import { ButtonLoader } from "@/components/button-loader"
import { useDebounce } from "@/hooks/use-debounce"
import { Badge } from "@/components/ui/badge"

const PAGE_SIZE = 50

export default function CompaniesPage() {
  const { dict, config, lang } = useDictionary()
  const supabase = createClient()
  const { hasPermission, profile, loading: authLoading } = useAuth()

  const [companies, setCompanies] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [offset, setOffset] = useState(0)

  const [stats, setStats] = useState({
    totalCustomers: 0,
    totalSuppliers: 0,
    totalTransporters: 0,
    activeCompanies: 0
  })

  const [isOpen, setIsOpen] = usePersistedState("companies_dialog_open", false)
  const [editingCompany, setEditingCompany] = usePersistedState<any>("companies_editing_data", null)
  const [searchQuery, setSearchQuery] = usePersistedState("companies_search", "")
  const [typeFilter, setTypeFilter] = usePersistedState("companies_type_filter", "all")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string, name: string } | null>(null)
  const debouncedSearchQuery = useDebounce(searchQuery, 300)

  const observerTarget = useRef(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [formData, setFormData] = usePersistedState("companies_form_data", {
    name: "",
    types: [] as string[],
    contact_persons: [{ name: "", email: "", phone: "", description: "" }] as { name: string, email: string, phone: string, description: string }[],
    phone: "",
    email: "",
    addresses: [{ label: "", address: "" }] as { label: string, address: string }[],
    npwp: "",
    city: "",
    other_info: "",
    is_active: true
  })

  // Permission Checks
  const canView = hasPermission("companies", "view")
  const canInsert = hasPermission("companies", "insert")
  const canEdit = hasPermission("companies", "edit")
  const canDelete = hasPermission("companies", "delete")

  const fetchStats = useCallback(async () => {
    try {
      const [
        { count: activeCount },
        { count: customerCount },
        { count: supplierCount },
        { count: transporterCount }
      ] = await Promise.all([
        supabase.from('companies').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('companies').select('*', { count: 'exact', head: true }).contains('type', ['Customer']),
        supabase.from('companies').select('*', { count: 'exact', head: true }).contains('type', ['Supplier']),
        supabase.from('companies').select('*', { count: 'exact', head: true }).contains('type', ['Transporter'])
      ])

      setStats({
        activeCompanies: activeCount || 0,
        totalCustomers: customerCount || 0,
        totalSuppliers: supplierCount || 0,
        totalTransporters: transporterCount || 0
      })
    } catch (err) {
      console.error("Fetch Stats Error:", err)
    }
  }, [supabase])

  const fetchCompanies = useCallback(async (isInitial = false) => {
    if (isInitial) {
      setLoading(true)
      setOffset(0)
      fetchStats()
    } else {
      setLoadingMore(true)
    }

    try {
      const currentOffset = isInitial ? 0 : offset
      let query = supabase
        .from("companies")
        .select("*")
        .order('is_active', { ascending: false })
        .order('name', { ascending: true })
        .range(currentOffset, currentOffset + PAGE_SIZE - 1)

      if (debouncedSearchQuery) {
        // Deep filtering in JSONB and text fields
        const searchStr = constructMultiWordSearch(debouncedSearchQuery, ['name', 'details->>email', 'details->>phone', 'details->>contact_person'])
        if (searchStr) query = query.or(searchStr)
      }

      if (typeFilter !== "all") {
        query = query.contains('type', [typeFilter])
      }

      const { data, error } = await query

      if (error) {
        console.error("Fetch Companies Error:", error)
        notify.error(dict.MSG_DATA_FETCH_FAILED, error.message)
      } else if (data) {
        if (isInitial) {
          setCompanies(data)
        } else {
          setCompanies(prev => {
            const newItems = data.filter((item: any) => !prev.some(p => p.id === item.id))
            return [...prev, ...newItems]
          })
        }
        setHasMore(data.length === PAGE_SIZE)
        setOffset(currentOffset + data.length)
      }
    } catch (err) {
      console.error("Fetch Companies Exception:", err)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [supabase, offset, debouncedSearchQuery, typeFilter, dict.MSG_DATA_FETCH_FAILED])

  // Initial fetch and reset when filters change
  useEffect(() => {
    fetchCompanies(true)
  }, [debouncedSearchQuery, typeFilter])

  // Infinite Scroll Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          fetchCompanies(false)
        }
      },
      {
        root: containerRef.current,
        rootMargin: '400px',
        threshold: 0
      }
    )

    if (observerTarget.current) {
      observer.observe(observerTarget.current)
    }

    return () => observer.disconnect()
  }, [fetchCompanies, hasMore, loading, loadingMore])

  const handleRefresh = () => {
    fetchCompanies(true)
  }

  // Open Dialog
  const handleOpenDialog = (company: any = null) => {
    if (company) {
      setEditingCompany(company)
      const details = company.details || {}

      let addresses = details.addresses || []
      if (addresses.length === 0 && details.address) {
        addresses = [{ label: "Primary", address: details.address }]
      }
      if (addresses.length === 0) {
        addresses = [{ label: "", address: "" }]
      }

      let contact_persons = details.contact_persons || []
      if (contact_persons.length === 0 && details.contact_person) {
        contact_persons = [{ name: details.contact_person, email: "", phone: "", description: "" }]
      }
      if (contact_persons.length === 0) {
        contact_persons = [{ name: "", email: "", phone: "", description: "" }]
      }

      setFormData({
        name: company.name,
        types: Array.isArray(company.type) ? company.type : [company.type],
        contact_persons: contact_persons,
        phone: details.phone || "",
        email: details.email || "",
        addresses: addresses,
        npwp: details.npwp || "",
        city: details.city || "",
        other_info: details.other_info || "",
        is_active: company.is_active ?? true
      })
    } else {
      if (!canInsert) return
      setEditingCompany(null)
      setFormData({
        name: "",
        types: ["Customer"],
        contact_persons: [{ name: "", email: "", phone: "", description: "" }],
        phone: "",
        email: "",
        addresses: [{ label: "", address: "" }],
        npwp: "",
        city: "",
        other_info: "",
        is_active: true
      })
    }
    setIsOpen(true)
  }

  const toggleType = (type: string) => {
    setFormData(prev => ({
      ...prev,
      types: prev.types.includes(type)
        ? prev.types.filter(t => t !== type)
        : [...prev.types, type]
    }))
  }

  const addContactPerson = () => {
    setFormData(prev => ({
      ...prev,
      contact_persons: [...prev.contact_persons, { name: "", email: "", phone: "", description: "" }]
    }))
  }

  const removeContactPerson = (index: number) => {
    if (formData.contact_persons.length <= 1) return
    setFormData(prev => ({
      ...prev,
      contact_persons: prev.contact_persons.filter((_, i) => i !== index)
    }))
  }

  const updateContactPerson = (index: number, field: keyof typeof formData.contact_persons[0], value: string) => {
    setFormData(prev => {
      const newContacts = [...prev.contact_persons]
      newContacts[index] = { ...newContacts[index], [field]: value }
      return { ...prev, contact_persons: newContacts }
    })
  }

  const addAddress = () => {
    setFormData(prev => ({
      ...prev,
      addresses: [...prev.addresses, { label: "", address: "" }]
    }))
  }

  const removeAddress = (index: number) => {
    if (formData.addresses.length <= 1) return
    setFormData(prev => ({
      ...prev,
      addresses: prev.addresses.filter((_, i) => i !== index)
    }))
  }

  const updateAddress = (index: number, field: 'label' | 'address', value: string) => {
    setFormData(prev => {
      const newAddresses = [...prev.addresses]
      newAddresses[index] = { ...newAddresses[index], [field]: value }
      return { ...prev, addresses: newAddresses }
    })
  }

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement, SubmitEvent>) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      if (formData.types.length === 0) {
        notify.error(dict.ERROR_UNEXPECTED || "Error", "Please select at least one type.")
        return
      }

      const payload = {
        name: formData.name,
        type: formData.types,
        is_active: formData.is_active,
        details: {
          contact_persons: formData.contact_persons.filter(c => c.name.trim() !== ""),
          contact_person: formData.contact_persons.find(c => c.name.trim() !== "")?.name || "",
          phone: formData.phone,
          email: formData.email,
          addresses: formData.addresses.filter(a => a.address.trim() !== ""),
          npwp: formData.npwp,
          city: formData.city,
          other_info: formData.other_info
        }
      }

      if (editingCompany) {
        const { data, error } = await supabase
          .from("companies")
          .update(payload)
          .eq("id", editingCompany.id)
          .select()
          .single()

        if (error) throw error

        setCompanies(prev => prev.map(c => c.id === editingCompany.id ? data : c))
        notify.success(
          dict.MSG_UPDATE_SUCCESS.replace("%data%", `[${formData.name}]`),
          dict.MSG_SUCCESS_UPDATE_DESC_NO_COMPANY.replace("%entity%", `company [${formData.name}]`),
          undefined,
          true
        )
      } else {
        const { data, error } = await supabase
          .from("companies")
          .insert([payload])
          .select()
          .single()

        if (error) throw error

        setCompanies(prev => [data, ...prev])
        notify.success(
          dict.MSG_SAVE_SUCCESS.replace("%data%", `[${formData.name}]`),
          dict.MSG_SUCCESS_SAVE_DESC_NO_COMPANY.replace("%entity%", `company [${formData.name}]`),
          undefined,
          true
        )
      }
      fetchStats()
      setIsOpen(false)
    }
    catch (err) {
      console.error("Submit Company Error:", err)
      notify.error(
        dict.MSG_SAVE_FAILED.replace("%data%", `[${formData.name}]`),
        (err as Error).message
      )
    }
    finally {
      setIsSubmitting(false);
    }
  }

  const handleDelete = async (id: string) => {
    const company = companies.find(c => c.id === id)
    if (!company) return
    setDeleteConfirm({ id: company.id, name: company.name })
  }

  const confirmDelete = async () => {
    if (!deleteConfirm) return
    try {
      const { error } = await supabase.from("companies").delete().eq("id", deleteConfirm.id)
      if (error) throw error
      notify.deleted(
        dict.MSG_DELETE_SUCCESS.replace("%data%", `[${deleteConfirm.name}]`),
        dict.MSG_SUCCESS_DELETE_DESC_NO_COMPANY.replace("%entity%", `company [${deleteConfirm.name}]`),
        undefined,
        true
      )
      setCompanies(prev => prev.filter(c => c.id !== deleteConfirm.id))
      fetchStats()
    } catch (err: any) {
      notify.error(
        dict.MSG_SAVE_FAILED.replace("%data%", `[${deleteConfirm.name}]`),
        err.message
      )
    } finally {
      setDeleteConfirm(null)
    }
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
      <div className="page-header shrink-0">
        <h1 className="page-title">
          <Building2 className="size-6 mr-2 inline-block text-primary" />
          {dict.TITLE_COMPANIES}
        </h1>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handleRefresh} disabled={loading || loadingMore} title="Refresh Data">
            <RefreshCw className={cn("size-4", (loading || loadingMore) && "animate-spin")} />
          </Button>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()} disabled={!canInsert}>
                <Plus data-icon="inline-start" />
                {dict.TITLE_ADD_COMPANY}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[700px]">
              <DialogHeader>
                <DialogTitle>
                  <Building2 className="size-5 mr-2 inline-block" />{editingCompany ? dict.TITLE_EDIT_COMPANY : dict.TITLE_ADD_COMPANY}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} id="company-form" className="flex flex-col gap-6 p-5 overflow-y-auto max-h-[70vh]">
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2 md:col-span-2">
                    <Label htmlFor="name">{dict.LABEL_COMPANY_NAME}</Label>
                    <div className="flex items-center gap-3">
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder=""
                        className="flex-1"
                        required
                      />
                      <div className="flex flex-col items-center gap-0.5 min-w-[60px]">
                        <Switch
                          id="is_active"
                          checked={formData.is_active}
                          onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                        />
                        <span className="text-[10px] uppercase font-bold text-muted-foreground leading-none mt-1.5">
                          {formData.is_active ? dict.LABEL_IS_ACTIVE : dict.LABEL_IS_INACTIVE}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Types Selection */}
                  <div className="flex flex-row gap-10 md:col-span-2 p-3 border rounded-lg bg-muted/20">
                    <Label>{dict.LABEL_TYPE}</Label>
                    <div className="flex flex-wrap gap-8">
                      {["Customer", "Supplier", "Transporter"].map((type) => (
                        <div key={type} className="flex items-center space-x-2">
                          <Checkbox
                            id={`type-${type}`}
                            checked={formData.types.includes(type)}
                            onCheckedChange={() => toggleType(type)}
                          />
                          <Label htmlFor={`type-${type}`} className="cursor-pointer font-normal">
                            {type === "Customer" ? <>{dict.LABEL_TYPE_CUSTOMER} <User className="size-4 text-blue-600" /></> :
                              type === "Supplier" ? <>{dict.LABEL_TYPE_SUPPLIER} <Warehouse className="size-4 text-amber-600" /></> :
                                <>{dict.LABEL_TYPE_TRANSPORTER} <Truck className="size-4 text-emerald-600" /></>}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Company Contact Info */}
                  <div className="flex flex-col gap-6 md:col-span-2 p-4 border rounded-lg bg-muted/5">
                    <Label>
                      {dict.LABEL_COMPANY_CONTACT_INFO}
                    </Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="phone" className="text-xs">{dict.LABEL_PHONE}</Label>
                        <div className="relative">
                          <Phone className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                          <Input
                            id="phone"
                            className="pl-9"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="email" className="text-xs">{dict.LABEL_EMAIL}</Label>
                        <div className="relative">
                          <Mail className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                          <Input
                            id="email"
                            type="email"
                            className="pl-9"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          />
                        </div>
                      </div>
                      {/* NPWP Field */}
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="npwp " className="text-xs">{dict.LABEL_NPWP}</Label>
                        <Input
                          id="npwp"
                          value={formData.npwp}
                          onChange={(e) => setFormData({ ...formData, npwp: e.target.value })}
                          placeholder="00.000.000.0-000.000"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Contact Persons Section */}
                  <div className="flex flex-col gap-4 md:col-span-2 border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <Label>{dict.LABEL_CONTACT_PERSON}</Label>
                      <Button type="button" variant="outline" size="sm" onClick={addContactPerson} className="h-8">
                        <Plus className="size-4" />
                      </Button>
                    </div>

                    <div className="flex flex-col gap-4">
                      {formData.contact_persons.map((contact, index) => (
                        <div key={index} className="flex flex-col gap-3 p-3 border rounded-md bg-background/50 group/contact">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                              {dict.LABEL_CONTACT_PERSON} #{index + 1}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className={cn(
                                "size-7 transition-colors",
                                formData.contact_persons.length > 1 ? "text-destructive hover:bg-destructive/10" : "text-muted-foreground/20"
                              )}
                              disabled={formData.contact_persons.length <= 1}
                              onClick={() => removeContactPerson(index)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1.5">
                              <Label className="text-xs font-bold text-muted-foreground">{dict.LABEL_NAME}</Label>
                              <div className="relative">
                                <User className="absolute left-2 top-2.5 size-3.5 text-muted-foreground" />
                                <Input
                                  value={contact.name}
                                  onChange={(e) => updateContactPerson(index, 'name', e.target.value)}
                                  className="h-9 pl-8"
                                />
                              </div>
                            </div>
                            <div className="flex flex-col gap-1.5">
                              <Label className="text-xs font-bold text-muted-foreground">{dict.LABEL_DESCRIPTION}</Label>
                              <Input
                                value={contact.description}
                                onChange={(e) => updateContactPerson(index, 'description', e.target.value)}
                                className="h-9"
                                placeholder="Purchasing Manager"
                              />
                            </div>
                            <div className="flex flex-col gap-1.5">
                              <Label className="text-xs font-bold text-muted-foreground">{dict.LABEL_PHONE}</Label>
                              <div className="relative">
                                <Phone className="absolute left-2 top-2.5 size-3.5 text-muted-foreground" />
                                <Input
                                  value={contact.phone}
                                  onChange={(e) => updateContactPerson(index, 'phone', e.target.value)}
                                  className="h-9 pl-8"
                                />
                              </div>
                            </div>
                            <div className="flex flex-col gap-1.5">
                              <Label className="text-xs font-bold text-muted-foreground">{dict.LABEL_EMAIL}</Label>
                              <div className="relative">
                                <Mail className="absolute left-2 top-2.5 size-3.5 text-muted-foreground" />
                                <Input
                                  value={contact.email}
                                  onChange={(e) => updateContactPerson(index, 'email', e.target.value)}
                                  className="h-9 pl-8"
                                  type="email"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>


                  {/* Addresses Section */}
                  <div className="flex flex-col gap-4 md:col-span-2 border rounded-lg p-4 bg-muted/10">
                    <div className="flex items-center justify-between">
                      <Label>{dict.LABEL_ADDRESS}</Label>
                      <Button type="button" variant="outline" size="sm" onClick={addAddress} className="h-8">
                        <Plus className="size-4" />
                      </Button>
                    </div>

                    <div className="flex flex-col gap-3">
                      {formData.addresses.map((addr, index) => (
                        <div key={index} className="flex gap-2 items-end group/addr">
                          <div className="flex flex-col gap-1.5 w-[140px] shrink-0">
                            <Label className="text-xs font-bold text-muted-foreground">{dict.LABEL_ADDRESS_LABEL}</Label>
                            <Input
                              value={addr.label}
                              onChange={(e) => updateAddress(index, 'label', e.target.value)}
                              placeholder="Head Office"
                              className="h-9"
                            />
                          </div>
                          <div className="flex flex-col gap-1.5 flex-1">
                            <Label className="text-xs font-bold text-muted-foreground">{dict.LABEL_ADDRESS}</Label>
                            <Input
                              value={addr.address}
                              onChange={(e) => updateAddress(index, 'address', e.target.value)}
                              placeholder="Jln. Raya..."
                              className="h-9"
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={cn(
                              "size-9 shrink-0 transition-colors",
                              formData.addresses.length > 1 ? "text-destructive hover:bg-destructive/10" : "text-muted-foreground/20"
                            )}
                            disabled={formData.addresses.length <= 1}
                            onClick={() => removeAddress(index)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Other Info - Full Width */}
                  <div className="flex flex-col gap-2 md:col-span-2">
                    <Label htmlFor="other">{dict.LABEL_OTHER_INFO}</Label>
                    <div className="relative">
                      <Info className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                      <Input
                        id="other"
                        className="pl-9"
                        value={formData.other_info}
                        onChange={(e) => setFormData({ ...formData, other_info: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </form>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                  <X data-icon="inline-start" />
                  {dict.BUTTON_CANCEL}
                </Button>
                <Button type="submit" form="company-form" disabled={isSubmitting}>
                  {isSubmitting ? (<ButtonLoader />) : (<Save data-icon="inline-start" />)}
                  {dict.BUTTON_SAVE}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="action-bar shrink-0 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="relative flex-1 w-full max-sm:w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder={dict.PLACEHOLDER_SEARCH}
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder={dict.LABEL_TYPE} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{dict.LABEL_ALL}</SelectItem>
            <SelectItem value="Customer">{dict.LABEL_TYPE_CUSTOMER}</SelectItem>
            <SelectItem value="Supplier">{dict.LABEL_TYPE_SUPPLIER}</SelectItem>
            <SelectItem value="Transporter">{dict.LABEL_TYPE_TRANSPORTER}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card ref={containerRef} className="data-card flex-1 overflow-y-auto custom-scrollbar">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="px-7">{dict.LABEL_NAME}</TableHead>
              <TableHead>{dict.LABEL_TYPE}</TableHead>
              <TableHead>{dict.LABEL_CONTACT_PERSON}</TableHead>
              <TableHead className="text-right"> </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="p-0">
                  <SectionLoader />
                </TableCell>
              </TableRow>
            ) : (
              <>
                {companies.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">{dict.NO_DATA}</TableCell>
                  </TableRow>
                ) : (
                  companies.map((company) => {
                    const details = company.details || {}
                    const contacts = details.contact_persons || []
                    const firstContact = contacts[0]

                    return (
                      <TableRow key={company.id} className="group">
                        <TableCell className="font-medium py-3">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "size-2 rounded-full",
                              company.is_active ? "bg-green-500" : "bg-muted-foreground/30"
                            )} />
                            <div>
                              <div>{company.name}</div>
                              <div className="text-xs text-muted-foreground font-normal mt-1 flex items-center gap-2">
                                {details.email && <span className="flex items-center gap-1"><Mail className="size-3" /> {details.email}</span>}
                                {details.phone && <span className="flex items-center gap-1"><Phone className="size-3" /> {details.phone}</span>}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            {(Array.isArray(company.type) ? company.type : [company.type]).map((t: string) => (
                              <div
                                key={t}
                                title={t === "Customer" ? dict.LABEL_TYPE_CUSTOMER : t === "Supplier" ? dict.LABEL_TYPE_SUPPLIER : dict.LABEL_TYPE_TRANSPORTER}
                                className={cn(
                                  "p-1.5 rounded-md border transition-colors",
                                  t === "Customer" ? "bg-blue-500/10 text-blue-600 border-blue-200" :
                                    t === "Supplier" ? "bg-amber-500/10 text-amber-600 border-amber-200" :
                                      "bg-emerald-500/10 text-emerald-600 border-emerald-200"
                                )}
                              >
                                {t === "Customer" ? <User className="size-3.5" /> :
                                  t === "Supplier" ? <Warehouse className="size-3.5" /> :
                                    <Truck className="size-3.5" />}
                              </div>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {firstContact ? (
                              <div className="flex flex-col">
                                <span className="font-medium">{firstContact.name}</span>
                                {firstContact.description && <span className="text-[10px] text-muted-foreground">{firstContact.description}</span>}
                                {contacts.length > 1 && (
                                  <span className="text-[10px] text-primary font-bold mt-0.5">
                                    + {contacts.length - 1} more
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="table_action"
                              size="sm"
                              onClick={() => handleOpenDialog(company)}
                              disabled={!canEdit}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            {canDelete && (
                              <Button
                                variant="table_action"
                                size="sm"
                                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => handleDelete(company.id)}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </>
            )}

            {/* Infinite Scroll Sentinel & Loader */}
            <TableRow ref={observerTarget} className="border-0">
              <TableCell colSpan={4} className="p-0 border-0 overflow-hidden">
                {loadingMore && (
                  <div className="relative h-24 w-full">
                    <SectionLoader />
                  </div>
                )}
                {!hasMore && companies.length > 0 && !loading && (
                  <div className="text-center py-3 text-xs text-danger/70 select-none">
                    — End of data —
                  </div>
                )}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>
      <div className="grid grid-cols-4 gap-2 md:gap-4 mb-1 shrink-0">
        <SummaryCard
          label={dict.LABEL_ACTIVE_COMPANIES}
          value={stats.activeCompanies}
          icon={CheckCircle}
          color="green"
        />
        <SummaryCard
          label={dict.LABEL_TOTAL_CUSTOMERS}
          value={stats.totalCustomers}
          icon={Users}
          color="blue"
        />
        <SummaryCard
          label={dict.LABEL_TOTAL_SUPPLIERS}
          value={stats.totalSuppliers}
          icon={Warehouse}
          color="amber"
        />
        <SummaryCard
          label={dict.LABEL_TOTAL_TRANSPORTERS}
          value={stats.totalTransporters}
          icon={Truck}
          color="green"
        />
      </div>

      <DeleteConfirmationDialog
        isOpen={deleteConfirm !== null}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        onConfirm={confirmDelete}
        title={dict.TITLE_DELETE || "Confirm Delete"}
        description={dict.MSG_DELETE_CONFIRM?.split("%data%")[0] || "Are you sure you want to delete this item? This action cannot be undone."}
        dataName={deleteConfirm?.name}
        confirmText={dict.BUTTON_DELETE || "Delete"}
        cancelText={dict.BUTTON_CANCEL || "Cancel"}
        variant="destructive"
      />
    </div>
  )
}
