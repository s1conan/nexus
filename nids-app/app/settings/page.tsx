"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/components/auth-provider"
import { useDictionary } from "@/components/dictionary-provider"
import { createClient } from "@/lib/supabase"
import { notify } from "@/lib/notifications"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog"
import { SectionLoader } from "@/components/section-loader"
import { ButtonLoader } from "@/components/button-loader"
import {
  Building2,
  CreditCard,
  Sliders,
  Plus,
  Trash2,
  Pencil,
  Save,
  Percent,
  Settings,
  Mail,
  MapPin,
  FileText,
  X,
  Image as ImageIcon
} from "lucide-react"

const supabase = createClient()

interface CompanyProfile {
  name: string
  address: string | null
  npwp: string | null
  npwp_address: string | null
  logo_url: string | null
  email: string | null
}

interface BankAccount {
  id: string
  name: string
  bank_name: string
  account_number: string
  account_name: string
  branch: string | null
}

interface SystemParameter {
  key: string
  value: any
  category: string
  label: string
  description: string | null
}

export default function SettingsPage() {
  const { dict } = useDictionary()
  const { profile, hasPermission } = useAuth()

  const canEdit = hasPermission("settings", "edit")

  // Active sub-tab state inside settings
  const [activeTab, setActiveTab] = useState<"company" | "banks" | "parameters">("company")
  const [loading, setLoading] = useState(true)

  // 1. Company Profile State
  const [companyInfo, setCompanyInfo] = useState<CompanyProfile>({
    name: "",
    address: "",
    npwp: "",
    npwp_address: "",
    logo_url: "",
    email: ""
  })
  const [savingCompany, setSavingCompany] = useState(false)

  // Keyboard helper for Textareas: Enter submits the form, Shift+Enter adds a new line
  const handleAddressKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      e.currentTarget.form?.requestSubmit()
    }
  }

  // 2. Bank Accounts State
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [isBankDialogOpen, setIsBankDialogOpen] = useState(false)
  const [savingBank, setSavingBank] = useState(false)
  const [deletingBankId, setDeletingBankId] = useState<string | null>(null)
  const [currentBank, setCurrentBank] = useState<Partial<BankAccount>>({
    bank_name: "",
    account_number: "",
    account_name: "",
    branch: ""
  })

  // 3. System Parameters State
  const [parameters, setParameters] = useState<SystemParameter[]>([])
  const [paramValues, setParamValues] = useState<Record<string, string>>({})
  const [savingParams, setSavingParams] = useState(false)

  // 4. Add Parameter Dialog State
  const [isParamDialogOpen, setIsParamDialogOpen] = useState(false)
  const [savingParamDialog, setSavingParamDialog] = useState(false)
  const [newParam, setNewParam] = useState({
    key: "",
    value: "",
    description: ""
  })

  // Fetch all settings data
  const loadData = async () => {
    try {
      setLoading(true)

      // Fetch all rows from unified app_settings, ordered by name to guarantee stable layout order
      const { data, error } = await supabase
        .from("app_settings")
        .select("*")
        .order("name", { ascending: true })

      if (error) throw error

      // Dynamic reactive seeder if table is empty
      if (!data || data.length === 0) {
        if (canEdit) {
          console.log("Settings: Table empty, seeding default configs...")
          const defaultSeeds = [
            { category: "company", name: "name", value: "PT Anugerah Buana Sriwijaya" },
            { category: "company", name: "address", value: "Jl. Bayam No. 1702 Kel. Sembilan Ilir Kec. Ilir Timur III Kota Palembang, Sumatera Selatan" },
            { category: "company", name: "email", value: "purchase-order@anugerahbuanasriwijaya.co.id" },
            { category: "company", name: "npwp", value: "" },
            { category: "company", name: "npwp_address", value: "" },
            { category: "company", name: "logo_url", value: "" },
            { category: "tax", name: "PPN", value: 0.11 },
            { category: "tax", name: "PBBKB", value: 0.075 },
            { category: "tax", name: "PPH22", value: 0.003 },
            {
              category: "company", name: "bank", value: [
                { id: "bank-1", name: "Bank Mandiri", bank_name: "Bank Mandiri", account_number: "111231002319", branch: "Letkol Iskandar", account_name: "PT Anugerah Buana Sriwijaya" },
                { id: "bank-2", name: "Bank Central Asia", bank_name: "Bank Central Asia", account_number: "31312315", branch: "Letkol Iskandar", account_name: "PT Anugerah Buana Sriwijaya" }
              ]
            }
          ]

          const { error: seedError } = await supabase
            .from("app_settings")
            .insert(defaultSeeds)

          if (seedError) throw seedError

          // Retry load
          loadData()
          return
        } else {
          // If read-only and no configurations exist, just return empty state to avoid RLS insert violation
          setCompanyInfo({ name: "", address: "", email: "", npwp: "", npwp_address: "", logo_url: "" })
          setBankAccounts([])
          setParameters([])
          return
        }
      }

      if (data) {
        // 1. Map Company Profile settings
        const companyName = data.find((r: any) => r.category === "company" && r.name === "name")?.value || ""
        const companyAddress = data.find((r: any) => r.category === "company" && r.name === "address")?.value || ""
        const companyEmail = data.find((r: any) => r.category === "company" && r.name === "email")?.value || ""
        const companyNpwp = data.find((r: any) => r.category === "company" && r.name === "npwp")?.value || ""
        const companyNpwpAddress = data.find((r: any) => r.category === "company" && r.name === "npwp_address")?.value || ""
        const companyLogoUrl = data.find((r: any) => r.category === "company" && r.name === "logo_url")?.value || ""

        setCompanyInfo({
          name: companyName,
          address: companyAddress,
          email: companyEmail,
          npwp: companyNpwp,
          npwp_address: companyNpwpAddress,
          logo_url: companyLogoUrl
        })

        // 2. Map Bank Accounts JSONB array
        const banksList = data.find((r: any) => r.category === "company" && r.name === "bank")?.value || []
        const banksWithIds = banksList.map((b: any) => ({
          id: b.id || Math.random().toString(36).substring(2, 9),
          name: b.name || b.bank_name || "",
          bank_name: b.bank_name || b.name || "",
          account_number: b.account_number || "",
          account_name: b.account_name || "",
          branch: b.branch || ""
        }))
        setBankAccounts(banksWithIds)

        // 3. Map Dynamic Tax Parameters
        const taxParams = data.filter((r: any) => r.category === "tax")
        const systemParams: SystemParameter[] = taxParams.map((p: any) => ({
          key: p.name,
          value: p.value,
          category: p.category,
          label: p.name === "PPN" ? "PPN (VAT) Rate (%)" : p.name === "PBBKB" ? "PBBKB Rate (%)" : p.name === "PPH22" ? "PPH22 Rate (%)" : p.name,
          description: p.name === "PPN" ? "Value Added Tax rate applied to standard transactions." : p.name === "PBBKB" ? "Fuel tax rate applied to logistics and shipping calculations." : p.name === "PPH22" ? "Art 22 Income Tax rate applied to imported or specific commodities." : null
        }))
        setParameters(systemParams)

        const valMap: Record<string, string> = {}
        systemParams.forEach((p: SystemParameter) => {
          valMap[p.key] = typeof p.value === "object" ? JSON.stringify(p.value) : String(p.value)
        })
        setParamValues(valMap)
      }

    } catch (error: unknown) {
      const err = error as Error
      console.error("Settings: Fetch error", err)
      notify.error(dict.MSG_DATA_FETCH_FAILED || "Failed to load settings data", err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (profile) {
      loadData()
    }
  }, [profile])

  // Company Profile Submit
  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canEdit) return

    try {
      setSavingCompany(true)

      const updates = [
        { category: "company", name: "name", value: companyInfo.name },
        { category: "company", name: "email", value: companyInfo.email },
        { category: "company", name: "address", value: companyInfo.address },
        { category: "company", name: "npwp", value: companyInfo.npwp },
        { category: "company", name: "npwp_address", value: companyInfo.npwp_address },
        { category: "company", name: "logo_url", value: companyInfo.logo_url }
      ]

      const { error } = await supabase
        .from("app_settings")
        .upsert(updates)

      if (error) throw error
      notify.success(dict.MSG_SAVE_SUCCESS.replace("%data%", "") || "Saved successfully", "Company profile has been updated.")
    } catch (error: unknown) {
      const err = error as Error
      notify.error(dict.MSG_SAVE_FAILED || "Save failed", err.message)
    } finally {
      setSavingCompany(false)
    }
  }

  // Open Dialog for adding new bank account
  const handleAddBankClick = () => {
    setCurrentBank({
      bank_name: "",
      account_number: "",
      account_name: "",
      branch: ""
    })
    setIsBankDialogOpen(true)
  }

  // Open Dialog for editing bank account
  const handleEditBankClick = (bank: BankAccount) => {
    setCurrentBank(bank)
    setIsBankDialogOpen(true)
  }

  // Bank Account Submit
  const handleSaveBank = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canEdit) return
    if (!currentBank.bank_name || !currentBank.account_number || !currentBank.account_name) {
      notify.warning("Required Fields", "Bank name, account number, and account name are required.")
      return
    }

    try {
      setSavingBank(true)
      let updatedBanks: BankAccount[] = []

      if (currentBank.id) {
        // Edit existing bank account inside the array
        updatedBanks = bankAccounts.map(b => b.id === currentBank.id ? {
          id: currentBank.id,
          name: currentBank.bank_name || "",
          bank_name: currentBank.bank_name || "",
          account_number: currentBank.account_number || "",
          account_name: currentBank.account_name || "",
          branch: currentBank.branch || ""
        } : b)
      } else {
        // Add new bank account to array
        const newBank: BankAccount = {
          id: Math.random().toString(36).substring(2, 9),
          name: currentBank.bank_name || "",
          bank_name: currentBank.bank_name || "",
          account_number: currentBank.account_number || "",
          account_name: currentBank.account_name || "",
          branch: currentBank.branch || ""
        }
        updatedBanks = [...bankAccounts, newBank]
      }

      // Upsert to unified app_settings table
      const { error } = await supabase
        .from("app_settings")
        .upsert({
          category: "company",
          name: "bank",
          value: updatedBanks
        })

      if (error) throw error

      setBankAccounts(updatedBanks)
      notify.success(dict.MSG_SAVE_SUCCESS || "Saved successfully", "Bank account has been updated.")
      setIsBankDialogOpen(false)
    } catch (error: unknown) {
      const err = error as Error
      notify.error(dict.MSG_SAVE_FAILED || "Save failed", err.message)
    } finally {
      setSavingBank(false)
    }
  }

  // Delete Bank Account
  const handleDeleteBank = async (id: string) => {
    if (!canEdit) return
    try {
      setDeletingBankId(id)
      const updatedBanks = bankAccounts.filter(b => b.id !== id)

      // Upsert to unified app_settings table
      const { error } = await supabase
        .from("app_settings")
        .upsert({
          category: "company",
          name: "bank",
          value: updatedBanks
        })

      if (error) throw error
      notify.success("Deleted", "Bank account has been successfully removed.")
      setBankAccounts(updatedBanks)
    } catch (error: unknown) {
      const err = error as Error
      notify.error("Deletion failed", err.message)
    } finally {
      setDeletingBankId(null)
    }
  }

  // System Parameters Change Handler
  const handleParamValChange = (key: string, val: string) => {
    setParamValues(prev => ({
      ...prev,
      [key]: val
    }))
  }

  // System Parameters Submit
  const handleSaveParams = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canEdit) return

    try {
      setSavingParams(true)

      const updates = parameters.map((p: any) => {
        let parsedVal: string | number | boolean | object = paramValues[p.key]

        // Try parsing numbers or booleans so that they are saved in correct JSONB format
        if (!isNaN(Number(parsedVal)) && parsedVal.trim() !== "") {
          parsedVal = Number(parsedVal)
        } else if (parsedVal.toLowerCase() === "true") {
          parsedVal = true
        } else if (parsedVal.toLowerCase() === "false") {
          parsedVal = false
        } else {
          try {
            parsedVal = JSON.parse(parsedVal)
          } catch {
            // Keep as string
          }
        }

        return {
          category: p.category,
          name: p.key,
          value: parsedVal
        }
      })

      const { error } = await supabase
        .from("app_settings")
        .upsert(updates)

      if (error) throw error

      notify.success(dict.MSG_SAVE_SUCCESS || "Saved successfully", "System parameters have been successfully updated.")

      // Reload parameter settings, sorted stably to prevent cards from switching places
      const { data } = await supabase
        .from("app_settings")
        .select("*")
        .eq("category", "tax")
        .order("name", { ascending: true })
      if (data) {
        const systemParams: SystemParameter[] = data.map((p: any) => ({
          key: p.name,
          value: p.value,
          category: p.category,
          label: p.name === "PPN" ? "PPN (VAT) Rate (%)" : p.name === "PBBKB" ? "PBBKB Rate (%)" : p.name === "PPH22" ? "PPH22 Rate (%)" : p.name,
          description: p.name === "PPN" ? "Value Added Tax rate applied to standard transactions." : p.name === "PBBKB" ? "Fuel tax rate applied to logistics and shipping calculations." : p.name === "PPH22" ? "Art 22 Income Tax rate applied to imported or specific commodities." : null
        }))
        setParameters(systemParams)
      }
    } catch (error: unknown) {
      const err = error as Error
      notify.error(dict.MSG_SAVE_FAILED || "Save failed", err.message)
    } finally {
      setSavingParams(false)
    }
  }

  // Open Parameter Dialog
  const handleAddParamClick = () => {
    setNewParam({
      key: "",
      value: "",
      description: ""
    })
    setIsParamDialogOpen(true)
  }

  // Parameter Dialog Submit
  const handleSaveNewParam = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canEdit) return
    const keyName = newParam.key.trim()
    if (!keyName) {
      notify.warning("Required Fields", "Parameter Key is required.")
      return
    }

    // Check for duplicate key
    if (parameters.some(p => p.key.toLowerCase() === keyName.toLowerCase())) {
      notify.error("Duplicate Key", `Parameter "${keyName}" already exists.`)
      return
    }

    try {
      setSavingParamDialog(true)
      let parsedVal: string | number | boolean | object = newParam.value

      // Try parsing value
      if (!isNaN(Number(parsedVal)) && parsedVal.trim() !== "") {
        parsedVal = Number(parsedVal)
      } else if (parsedVal.toLowerCase() === "true") {
        parsedVal = true
      } else if (parsedVal.toLowerCase() === "false") {
        parsedVal = false
      }

      const { error } = await supabase
        .from("app_settings")
        .upsert({
          category: "tax",
          name: keyName,
          value: parsedVal
        })

      if (error) throw error

      notify.success(dict.MSG_SAVE_SUCCESS || "Saved successfully", "New parameter added.")
      setIsParamDialogOpen(false)

      // Reload parameters, sorted stably to prevent cards from switching places
      const { data } = await supabase
        .from("app_settings")
        .select("*")
        .eq("category", "tax")
        .order("name", { ascending: true })
      if (data) {
        const systemParams: SystemParameter[] = data.map((p: any) => ({
          key: p.name,
          value: p.value,
          category: p.category,
          label: p.name === "PPN" ? "PPN (VAT) Rate (%)" : p.name === "PBBKB" ? "PBBKB Rate (%)" : p.name === "PPH22" ? "PPH22 Rate (%)" : p.name,
          description: p.name === "PPN" ? "Value Added Tax rate applied to standard transactions." : p.name === "PBBKB" ? "Fuel tax rate applied to logistics and shipping calculations." : p.name === "PPH22" ? "Art 22 Income Tax rate applied to imported or specific commodities." : p.description || null
        }))
        setParameters(systemParams)

        const valMap: Record<string, string> = {}
        systemParams.forEach((p: SystemParameter) => {
          valMap[p.key] = typeof p.value === "object" ? JSON.stringify(p.value) : String(p.value)
        })
        setParamValues(valMap)
      }
    } catch (error: unknown) {
      const err = error as Error
      notify.error(dict.MSG_SAVE_FAILED || "Failed to add parameter", err.message)
    } finally {
      setSavingParamDialog(false)
    }
  }

  // Delete Dynamic Parameter
  const handleDeleteParam = async (key: string) => {
    if (!canEdit) return

    // Safety guard for core seeded parameters
    if (key === "PPN" || key === "PBBKB" || key === "PPH22") {
      notify.error("Protected Parameter", `Core operational parameters (PPN, PBBKB, PPH22) cannot be deleted.`)
      return
    }

    try {
      const { error } = await supabase
        .from("app_settings")
        .delete()
        .eq("category", "tax")
        .eq("name", key)

      if (error) throw error
      notify.success("Deleted", `Parameter "${key}" has been successfully removed.`)
      setParameters(prev => prev.filter(p => p.key !== key))
    } catch (error: unknown) {
      const err = error as Error
      notify.error("Deletion failed", err.message)
    }
  }

  if (loading) {
    return <SectionLoader />
  }

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden p-6 max-w-7xl mx-auto w-full gap-6">

      {/* Dynamic Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border/60 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 text-primary rounded-lg">
            <Settings className="size-6 animate-spin-slow" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              {dict.SETTINGS_TITLE || "Global Settings"}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {dict.SETTINGS_SUBTITLE || "Manage enterprise identities, dynamic tax rates, and core operational configurations."}
            </p>
          </div>
        </div>
      </div>

      {/* Tab Selectors */}
      <div className="flex border-b border-border/60 gap-4 shrink-0">
        <button
          onClick={() => setActiveTab("company")}
          className={`flex items-center gap-2 pb-2.5 text-xs md:text-sm font-medium transition-all relative z-10 border-b-2 px-1 -mb-[2px] ${activeTab === "company"
              ? "border-primary text-primary font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
        >
          <Building2 className="size-4" />
          <span>{dict.SETTINGS_TAB_COMPANY || "Company Profile"}</span>
        </button>

        <button
          onClick={() => setActiveTab("banks")}
          className={`flex items-center gap-2 pb-2.5 text-xs md:text-sm font-medium transition-all relative z-10 border-b-2 px-1 -mb-[2px] ${activeTab === "banks"
              ? "border-primary text-primary font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
        >
          <CreditCard className="size-4" />
          <span>{dict.SETTINGS_TAB_BANKS || "Bank Accounts"}</span>
        </button>

        <button
          onClick={() => setActiveTab("parameters")}
          className={`flex items-center gap-2 pb-2.5 text-xs md:text-sm font-medium transition-all relative z-10 border-b-2 px-1 -mb-[2px] ${activeTab === "parameters"
              ? "border-primary text-primary font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
        >
          <Sliders className="size-4" />
          <span>{dict.SETTINGS_TAB_PARAMETERS || "System Parameters"}</span>
        </button>
      </div>

      {/* Scrollable Content Container */}
      <div className="flex-1 overflow-y-auto no-scrollbar pb-6 scroll-smooth">

        {/* Tab 1: Company Profile */}
        {activeTab === "company" && (
          <form onSubmit={handleSaveCompany} className="space-y-6">
            <Card className="p-6 border-border/60 shadow-none bg-card rounded-xl space-y-6">
              <div className="border-b border-border/60 pb-3 flex items-center gap-2">
                <Building2 className="size-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">{dict.SETTINGS_SEC_COMPANY || "Enterprise Identity Specifications"}</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="company_name" className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <Building2 className="size-3.5" /> {dict.LABEL_COMPANY_NAME} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="company_name"
                    value={companyInfo.name || ""}
                    onChange={e => setCompanyInfo({ ...companyInfo, name: e.target.value })}
                    required
                    disabled={!canEdit}
                    placeholder="e.g. PT Anugerah Buana Sriwijaya"
                    className="h-10 text-sm border-border/60 rounded-lg focus-visible:ring-primary/20"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="company_email" className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <Mail className="size-3.5" /> {dict.LABEL_EMAIL}
                  </Label>
                  <Input
                    id="company_email"
                    type="email"
                    value={companyInfo.email || ""}
                    onChange={e => setCompanyInfo({ ...companyInfo, email: e.target.value })}
                    disabled={!canEdit}
                    placeholder="e.g. purchase-order@anugerahbuanasriwijaya.co.id"
                    className="h-10 text-sm border-border/60 rounded-lg focus-visible:ring-primary/20"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="company_npwp" className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <FileText className="size-3.5" /> {dict.SETTINGS_LABEL_NPWP || "NPWP (Tax Number)"}
                  </Label>
                  <Input
                    id="company_npwp"
                    value={companyInfo.npwp || ""}
                    onChange={e => setCompanyInfo({ ...companyInfo, npwp: e.target.value })}
                    disabled={!canEdit}
                    placeholder="e.g. 01.234.567.8-901.000"
                    className="h-10 text-sm border-border/60 rounded-lg focus-visible:ring-primary/20"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="company_logo" className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <ImageIcon className="size-3.5" /> {dict.SETTINGS_LABEL_LOGO_URL || "Brand Logo URL"}
                  </Label>
                  <Input
                    id="company_logo"
                    value={companyInfo.logo_url || ""}
                    onChange={e => setCompanyInfo({ ...companyInfo, logo_url: e.target.value })}
                    disabled={!canEdit}
                    placeholder="e.g. /images/logo.png"
                    className="h-10 text-sm border-border/60 rounded-lg focus-visible:ring-primary/20"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="company_npwp_address" className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <MapPin className="size-3.5" /> {dict.SETTINGS_LABEL_NPWP_ADDRESS || "NPWP Address"}
                  </Label>
                  <Textarea
                    id="company_npwp_address"
                    value={companyInfo.npwp_address || ""}
                    onChange={e => setCompanyInfo({ ...companyInfo, npwp_address: e.target.value })}
                    onKeyDown={handleAddressKeyDown}
                    disabled={!canEdit}
                    placeholder={dict.SETTINGS_PLACEHOLDER_NPWP_ADDRESS || "Official address registered in NPWP profile"}
                    className="h-24 min-h-24 max-h-24 text-sm border-border/60 rounded-lg focus-visible:ring-primary/20 resize-none py-2 overflow-hidden focus:outline-none focus-visible:outline-none box-border leading-normal"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="company_address" className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <MapPin className="size-3.5" /> {dict.SETTINGS_LABEL_SHIPPING_ADDRESS || "Operational / Shipping Office Address"}
                  </Label>
                  <Textarea
                    id="company_address"
                    value={companyInfo.address || ""}
                    onChange={e => setCompanyInfo({ ...companyInfo, address: e.target.value })}
                    onKeyDown={handleAddressKeyDown}
                    disabled={!canEdit}
                    placeholder={dict.SETTINGS_PLACEHOLDER_SHIPPING_ADDRESS || "Operational headquarters address"}
                    className="h-24 min-h-24 max-h-24 text-sm border-border/60 rounded-lg focus-visible:ring-primary/20 resize-none py-2 overflow-hidden focus:outline-none focus-visible:outline-none box-border leading-normal"
                  />
                </div>
              </div>
            </Card>

            {canEdit && (
              <div className="flex justify-end gap-3 shrink-0">
                <Button
                  type="submit"
                  disabled={savingCompany}
                  className="rounded-lg h-10 px-5 gap-2 font-medium transition-all shadow-none border-0 flex items-center justify-center cursor-pointer"
                >
                  {savingCompany ? <ButtonLoader /> : <Save className="size-4" />}
                  <span>{dict.SETTINGS_BUTTON_SAVE_COMPANY || "Save Specifications"}</span>
                </Button>
              </div>
            )}
          </form>
        )}

        {/* Tab 2: Bank Accounts */}
        {activeTab === "banks" && (
          <div className="space-y-6">

            {/* Header / Add Action */}
            <div className="flex justify-between items-center border-b border-border/60 pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <CreditCard className="size-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">{dict.SETTINGS_SEC_BANKS || "Relational Settlement Bank Accounts"}</h3>
              </div>

              {canEdit && (
                <Button
                  onClick={handleAddBankClick}
                  variant="outline"
                  size="sm"
                  className="rounded-lg border-border/60 text-xs font-semibold h-8 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="size-3.5 text-primary" />
                  <span>{dict.SETTINGS_ADD_BANK_ACC || "Add Bank Account"}</span>
                </Button>
              )}
            </div>

            {/* Banks Grid */}
            {bankAccounts.length === 0 ? (
              <Card className="p-8 border-dashed border-border/60 flex flex-col items-center justify-center text-center rounded-xl bg-card/20 shadow-none">
                <CreditCard className="size-8 text-muted-foreground/60 mb-2.5 animate-pulse" />
                <p className="text-sm font-medium text-muted-foreground">{dict.NO_DATA || "No bank accounts added yet."}</p>
                <p className="text-xs text-muted-foreground/60 mt-0.5">Please add bank accounts to configure transactions.</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {bankAccounts.map(bank => (
                  <Card key={bank.id} className="p-5 border border-border/60 bg-card rounded-xl hover:border-primary/45 transition-all shadow-none flex flex-col justify-between group">
                    <div className="space-y-2">
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-xs font-bold bg-primary/10 text-primary px-2.5 py-0.5 rounded-full tracking-wider uppercase">
                          {bank.bank_name}
                        </span>

                        {canEdit && (
                          <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditBankClick(bank)}
                              className="size-7 rounded-md p-0 focus-visible:ring-0 cursor-pointer"
                            >
                              <Pencil className="size-3.5 text-muted-foreground hover:text-foreground" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={deletingBankId === bank.id}
                              onClick={() => handleDeleteBank(bank.id)}
                              className="size-7 rounded-md p-0 focus-visible:ring-0 text-destructive hover:bg-destructive/10 cursor-pointer"
                            >
                              {deletingBankId === bank.id ? <ButtonLoader /> : <Trash2 className="size-3.5" />}
                            </Button>
                          </div>
                        )}
                      </div>

                      <div className="pt-1.5">
                        <div className="text-lg font-mono font-bold text-foreground leading-none tracking-tight">
                          {bank.account_number}
                        </div>
                        <div className="text-xs font-semibold text-muted-foreground mt-2 flex flex-col gap-0.5">
                          <span className="uppercase tracking-wide">{bank.account_name}</span>
                          {bank.branch && <span className="opacity-75">{bank.branch} Branch</span>}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: System Parameters */}
        {activeTab === "parameters" && (
          <form onSubmit={handleSaveParams} className="space-y-6">
            <Card className="p-6 border-border/60 shadow-none bg-card rounded-xl space-y-6">
              <div className="border-b border-border/60 pb-3 flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2">
                  <Sliders className="size-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">{dict.SETTINGS_SEC_PARAMS || "Dynamic Operational Parameters"}</h3>
                </div>

                {canEdit && (
                  <Button
                    type="button"
                    onClick={handleAddParamClick}
                    variant="outline"
                    size="sm"
                    className="rounded-lg border-border/60 text-xs font-semibold h-8 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="size-3.5 text-primary" />
                    <span>{dict.SETTINGS_ADD_PARAM || "Add Parameter"}</span>
                  </Button>
                )}
              </div>

              {parameters.length === 0 ? (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  No parameters registered in the database.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {parameters.map(param => {
                    const isTax = param.category === "tax"
                    const isProtected = param.key === "PPN" || param.key === "PBBKB" || param.key === "PPH22"

                    return (
                      <div key={param.key} className="space-y-2 border border-border/40 p-4 rounded-lg bg-card/40 flex flex-col justify-between relative group">

                        {/* Delete parameter button for custom dynamic options */}
                        {canEdit && !isProtected && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteParam(param.key)}
                            className="size-7 rounded-md p-0 text-destructive hover:bg-destructive/10 cursor-pointer absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        )}

                        <div className="space-y-2">
                          <div className="flex justify-between items-center pr-8">
                            <Label htmlFor={`param_${param.key}`} className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                              {isTax && <Percent className="size-3.5 text-primary" />}
                              <span>{param.label}</span>
                            </Label>
                            <span className="text-[10px] text-primary bg-primary/10 font-bold px-2 py-0.5 rounded uppercase leading-none font-mono">
                              {param.key}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <Input
                              id={`param_${param.key}`}
                              type="text"
                              value={paramValues[param.key] || ""}
                              onChange={e => handleParamValChange(param.key, e.target.value)}
                              disabled={!canEdit}
                              className="h-10 text-sm border-border/60 rounded-lg focus-visible:ring-primary/20 font-mono w-full"
                            />
                          </div>
                        </div>

                        {param.description && (
                          <p className="text-[10px] text-muted-foreground/80 mt-2 leading-relaxed">
                            {param.description}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>

            {canEdit && (
              <div className="flex justify-end gap-3 shrink-0">
                <Button
                  type="submit"
                  disabled={savingParams}
                  className="rounded-lg h-10 px-5 gap-2 font-medium transition-all shadow-none border-0 flex items-center justify-center cursor-pointer"
                >
                  {savingParams ? <ButtonLoader /> : <Save className="size-4" />}
                  <span>{dict.SETTINGS_BUTTON_SAVE_PARAMS || "Save Parameters"}</span>
                </Button>
              </div>
            )}
          </form>
        )}

      </div>

      {/* CRUD Dialog Modal for Bank Accounts */}
      <Dialog open={isBankDialogOpen} onOpenChange={setIsBankDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {currentBank.id ? (dict.SETTINGS_EDIT_BANK_ACC || "Modify Bank Account") : (dict.SETTINGS_ADD_BANK_ACC || "Add Bank Account")}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveBank} className="flex flex-col gap-6 p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="bank_name">{dict.SETTINGS_LABEL_BANK_NAME || "Bank Name"} <span className="text-destructive">*</span></Label>
                <Input
                  id="bank_name"
                  value={currentBank.bank_name || ""}
                  onChange={e => setCurrentBank({ ...currentBank, bank_name: e.target.value })}
                  placeholder={dict.SETTINGS_PLACEHOLDER_BANK_NAME || "e.g. Bank Mandiri, BCA"}
                  required
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="account_number">{dict.SETTINGS_LABEL_ACC_NUM || "Account Number"} <span className="text-destructive">*</span></Label>
                <Input
                  id="account_number"
                  value={currentBank.account_number || ""}
                  onChange={e => setCurrentBank({ ...currentBank, account_number: e.target.value })}
                  placeholder={dict.SETTINGS_PLACEHOLDER_ACC_NUM || "e.g. 111231002319"}
                  required
                />
              </div>

              <div className="flex flex-col gap-2 md:col-span-2">
                <Label htmlFor="account_name">{dict.SETTINGS_LABEL_ACC_HOLDER || "Account Holder Name"} <span className="text-destructive">*</span></Label>
                <Input
                  id="account_name"
                  value={currentBank.account_name || ""}
                  onChange={e => setCurrentBank({ ...currentBank, account_name: e.target.value })}
                  placeholder={dict.SETTINGS_PLACEHOLDER_ACC_HOLDER || "e.g. PT Anugerah Buana Sriwijaya"}
                  required
                />
              </div>

              <div className="flex flex-col gap-2 md:col-span-2">
                <Label htmlFor="branch">{dict.SETTINGS_LABEL_BRANCH || "Branch Name"}</Label>
                <Input
                  id="branch"
                  value={currentBank.branch || ""}
                  onChange={e => setCurrentBank({ ...currentBank, branch: e.target.value })}
                  placeholder={dict.SETTINGS_PLACEHOLDER_BRANCH || "e.g. Letkol Iskandar"}
                />
              </div>
            </div>
          </form>
          <DialogFooter className="mt-2 gap-2 *:w-full *:flex-1 h-22 sm:h-auto">
            <Button type="button" variant="outline" onClick={() => setIsBankDialogOpen(false)}>
              <X data-icon="inline-start" />
              {dict.BUTTON_CANCEL}
            </Button>
            <Button type="submit" disabled={savingBank}>
              {savingBank ? <ButtonLoader /> : <Save data-icon="inline-start" />}
              {dict.BUTTON_SAVE}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dynamic Dialog Modal for Adding Parameter */}
      <Dialog open={isParamDialogOpen} onOpenChange={setIsParamDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {dict.SETTINGS_ADD_PARAM || "Add Parameter"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveNewParam} className="flex flex-col gap-6 p-5">
            <div className="grid grid-cols-1 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="param_key">{dict.SETTINGS_LABEL_PARAM_KEY || "Parameter Key"} <span className="text-destructive">*</span></Label>
                <Input
                  id="param_key"
                  value={newParam.key}
                  onChange={e => setNewParam({ ...newParam, key: e.target.value })}
                  placeholder="e.g. PPH23"
                  required
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="param_value">{dict.SETTINGS_LABEL_PARAM_VALUE || "Parameter Value"} <span className="text-destructive">*</span></Label>
                <Input
                  id="param_value"
                  value={newParam.value}
                  onChange={e => setNewParam({ ...newParam, value: e.target.value })}
                  placeholder="e.g. 0.02"
                  required
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="param_desc">{dict.SETTINGS_LABEL_PARAM_DESC || "Parameter Description"}</Label>
                <Input
                  id="param_desc"
                  value={newParam.description}
                  onChange={e => setNewParam({ ...newParam, description: e.target.value })}
                  placeholder="e.g. Art 23 Income Tax Rate applied to domestic transactions."
                />
              </div>
            </div>
          </form>
          <DialogFooter className="mt-2 gap-2 *:w-full *:flex-1 h-22 sm:h-auto">
            <Button type="button" variant="outline" onClick={() => setIsParamDialogOpen(false)}>
              <X data-icon="inline-start" />
              {dict.BUTTON_CANCEL}
            </Button>
            <Button type="submit" disabled={savingParamDialog}>
              {savingParamDialog ? <ButtonLoader /> : <Save data-icon="inline-start" />}
              {dict.BUTTON_SAVE}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
