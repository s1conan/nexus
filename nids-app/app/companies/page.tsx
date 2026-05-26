"use client"

import { useState, useEffect } from "react"
import { useDictionary } from "@/components/dictionary-provider"
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
import { Plus, Building2, Search, Pencil, Save, X, Phone, Mail, MapPin, User, Info, Warehouse, Truck } from "lucide-react"
import { Input } from "@/components/ui/input"

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
import { cn } from "@/lib/utils"

import { SectionLoader } from "@/components/section-loader"
import { Checkbox } from "@/components/ui/checkbox"
import { notify } from "@/lib/notifications"
import { usePersistedState } from "@/hooks/use-persisted-state"

export default function CompaniesPage() {
  const { dict, config, lang } = useDictionary()
  const supabase = createClient()
  const [companies, setCompanies] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isOpen, setIsOpen] = usePersistedState("companies_dialog_open", false)
  const [editingCompany, setEditingCompany] = usePersistedState<any>("companies_editing_data", null)
  const [searchQuery, setSearchQuery] = usePersistedState("companies_search", "")
  const [typeFilter, setTypeFilter] = usePersistedState("companies_type_filter", "all")

  const [formData, setFormData] = usePersistedState("companies_form_data", {
    name: "",
    types: [] as string[],
    contact_person: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    other_info: "",
    is_active: true
  })

  async function fetchCompanies() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .order('created_at', { ascending: false })

      if (error) {
        console.error("Fetch Companies Error:", error)
        notify.error(dict.MSG_DATA_FETCH_FAILED, error.message)
        setCompanies([])
      } else if (data) {
        setCompanies(data)
      }
    } catch (err) {
      console.error("Fetch Companies Exception:", err)
      setCompanies([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCompanies()
  }, [])

  const handleOpenDialog = (company: any = null) => {
    if (company) {
      setEditingCompany(company)
      const details = company.details || {}
      setFormData({
        name: company.name,
        types: Array.isArray(company.type) ? company.type : [company.type],
        contact_person: details.contact_person || "",
        phone: details.phone || "",
        email: details.email || "",
        address: details.address || "",
        city: details.city || "",
        other_info: details.other_info || "",
        is_active: company.is_active ?? true
      })
    } else {
      setEditingCompany(null)
      setFormData({
        name: "",
        types: ["Customer"],
        contact_person: "",
        phone: "",
        email: "",
        address: "",
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

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement, SubmitEvent>) => {
    e.preventDefault()

    if (formData.types.length === 0) {
      notify.error(dict.ERROR_UNEXPECTED || "Error", "Please select at least one type.")
      return
    }

    const payload = {
      name: formData.name,
      type: formData.types,
      is_active: formData.is_active,
      details: {
        contact_person: formData.contact_person,
        phone: formData.phone,
        email: formData.email,
        address: formData.address,
        city: formData.city,
        other_info: formData.other_info
      }
    }

    if (editingCompany) {
      const { error } = await supabase.from("companies").update(payload).eq("id", editingCompany.id)
      if (!error) {
        setIsOpen(false)
        notify.success(dict.MSG_STATUS_UPDATED, dict.MSG_SAVE_SUCCESS)
      } else {
        notify.error(dict.MSG_SAVE_FAILED, error.message)
      }
    } else {
      const { error } = await supabase.from("companies").insert([payload])
      if (!error) {
        setIsOpen(false)
        notify.success(dict.MSG_STATUS_UPDATED, dict.MSG_SAVE_SUCCESS)
      } else {
        notify.error(dict.MSG_SAVE_FAILED, error.message)
      }
    }
    fetchCompanies()
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">{dict.TITLE_COMPANIES}</h1>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
              <Plus data-icon="inline-start" />
              {dict.TITLE_ADD_COMPANY}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingCompany ? dict.TITLE_EDIT_COMPANY : dict.TITLE_ADD_COMPANY}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="flex flex-col gap-6 p-5">
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
                        {formData.is_active ? dict.LABEL_ACTIVE : dict.LABEL_DEACTIVATED}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Types Selection */}
                <div className="flex flex-col gap-3 md:col-span-2 p-3 border rounded-lg bg-muted/20">
                  <Label>{dict.LABEL_TYPE}</Label>
                  <div className="flex flex-wrap gap-6">
                    {["Customer", "Supplier", "Transporter"].map((type) => (
                      <div key={type} className="flex items-center space-x-2">
                        <Checkbox
                          id={`type-${type}`}
                          checked={formData.types.includes(type)}
                          onCheckedChange={() => toggleType(type)}
                        />
                        <Label htmlFor={`type-${type}`} className="cursor-pointer font-normal">
                          {type === "Customer" ? dict.LABEL_TYPE_CUSTOMER :
                            type === "Supplier" ? dict.LABEL_TYPE_SUPPLIER :
                              dict.LABEL_TYPE_TRANSPORTER}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Contact Info */}
                <div className="flex flex-col gap-2">
                  <Label htmlFor="contact">{dict.LABEL_CONTACT_PERSON}</Label>
                  <div className="relative">
                    <User className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                    <Input
                      id="contact"
                      className="pl-9"
                      value={formData.contact_person}
                      onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="phone">{dict.LABEL_PHONE}</Label>
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
                <div className="flex flex-col gap-2 md:col-span-2">
                  <Label htmlFor="email">{dict.LABEL_EMAIL}</Label>
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

                {/* Location */}
                <div className="flex flex-col gap-2 md:col-span-2">
                  <Label htmlFor="address">{dict.LABEL_ADDRESS}</Label>
                  <div className="relative">
                    <MapPin className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                    <Input
                      id="address"
                      className="pl-9"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="city">{dict.LABEL_CITY}</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  />
                </div>

                {/* Other Info */}
                <div className="flex flex-col gap-2">
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

              <DialogFooter className="mt-2 gap-2 *:w-full *:flex-1 h-22 sm:h-auto">
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                  <X data-icon="inline-start" />
                  {dict.BUTTON_CANCEL}
                </Button>
                <Button type="submit">
                  <Save data-icon="inline-start" />
                  {dict.BUTTON_SAVE}
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

      <Card className="data-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead><Building2 className="size-4 mr-2 inline-block" />{dict.LABEL_NAME}</TableHead>
              <TableHead>{dict.LABEL_TYPE}</TableHead>
              <TableHead>{dict.LABEL_CONTACT_PERSON}</TableHead>
              <TableHead>{dict.LABEL_CITY}</TableHead>
              <TableHead className="text-right">{dict.LABEL_ACTIONS}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="p-0">
                  <SectionLoader />
                </TableCell>
              </TableRow>
            ) : (
              (() => {
                const filtered = companies.filter(company => {
                  const matchesSearch = company.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (company.details?.email || "").toLowerCase().includes(searchQuery.toLowerCase())

                  const types = Array.isArray(company.type) ? company.type : [company.type]
                  const matchesType = typeFilter === "all" || types.includes(typeFilter)

                  return matchesSearch && matchesType
                })

                if (filtered.length === 0) {
                  return (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">{dict.NO_DATA}</TableCell>
                    </TableRow>
                  )
                }

                return filtered.map((company) => (
                  <TableRow key={company.id} className="group">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "size-2 rounded-full",
                          company.is_active ? "bg-green-500" : "bg-muted-foreground/30"
                        )} />
                        <div>
                          <div>{company.name}</div>
                          <div className="text-xs text-muted-foreground font-normal mt-1 flex items-center gap-2">
                            {company.details?.email && <span className="flex items-center gap-1"><Mail className="size-3" /> {company.details.email}</span>}
                            {company.details?.phone && <span className="flex items-center gap-1"><Phone className="size-3" /> {company.details.phone}</span>}
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
                    <TableCell className="text-sm">{company.details?.contact_person || "-"}</TableCell>
                    <TableCell className="text-sm">{company.details?.city || "-"}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleOpenDialog(company)}
                      >
                        <Pencil className="size-4 md:mr-2" />
                        <span className="hidden md:inline">{dict.BUTTON_EDIT}</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              })()
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}