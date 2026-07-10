"use client"

import { useState, useEffect, useCallback, useRef, startTransition } from "react"
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
  DialogFooter,
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
  Settings,
  Mail,
  FileText,
  AlertCircle,
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
  value: unknown
  category: string
  label: string
  description: string | null
}

interface AppSettingsRow {
  id?: string
  category: string
  name: string
  value: unknown
  description?: string | null
  updated_at?: string
}

interface BankRow {
  id?: string
  name?: string
  bank_name?: string
  account_number?: string
  account_name?: string
  branch?: string | null
}

export default function SettingsPage() {
  const { dict } = useDictionary()
  const { profile, hasPermission, loading: authLoading } = useAuth()

  // Active sub-tab state inside settings
  const [activeTab, setActiveTab] = useState<
    "company" | "banks" | "parameters" | "emails" | "numbering"
  >("company")
  const [, setLoading] = useState(true)
  const loadDataRef = useRef<(() => Promise<void>) | null>(null)

  // ... (existing states)

  // 6. Document Numbering State
  const [numberingFormats, setNumberingFormats] = useState<
    Record<string, string>
  >({
    quotation: "QTN/{YYYY}/{SEQ:3}",
    "sales-order": "PO/{YYYY}/{SEQ:3}",
    "delivery-order": "DO/{YYYY}/{SEQ:3}",
    deposit: "DEP/{YYYY}/{SEQ:3}",
    invoice: "INV/{YYYY}/{SEQ:3}",
    payment: "PAY/{YYYY}/{SEQ:3}",
  })
  const [savingNumbering, setSavingNumbering] = useState(false)

  // 1. Company Profile State
  const [companyInfo, setCompanyInfo] = useState<CompanyProfile>({
    name: "",
    address: "",
    npwp: "",
    npwp_address: "",
    logo_url: "",
    email: "",
  })
  const [savingCompany, setSavingCompany] = useState(false)

  // 2. Bank Accounts State
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [isBankDialogOpen, setIsBankDialogOpen] = useState(false)
  const [, setSavingBank] = useState(false)
  const [, setDeletingBankId] = useState<string | null>(null)
  const [currentBank, setCurrentBank] = useState<Partial<BankAccount>>({
    bank_name: "",
    account_number: "",
    account_name: "",
    branch: "",
  })

  // 3. System Parameters State
  const [parameters, setParameters] = useState<SystemParameter[]>([])
  const [paramValues, setParamValues] = useState<Record<string, string>>({})
  const [savingParams, setSavingParams] = useState(false)

  // 4. Add Parameter Dialog State
  const [isParamDialogOpen, setIsParamDialogOpen] = useState(false)
  const [, setSavingParamDialog] = useState(false)
  const [newParam, setNewParam] = useState({
    key: "",
    value: "",
    description: "",
  })

  // 5. Email CCs State
  const [emailCCs, setEmailCCs] = useState<Record<string, string>>({
    cc_quotation: "",
    cc_po: "",
    cc_do: "",
    cc_invoice: "",
    cc_payment: "",
  })
  const [savingEmailCCs, setSavingEmailCCs] = useState(false)

  const canView = hasPermission("settings", "view")
  const canEdit = hasPermission("settings", "edit")
  const canDelete = hasPermission("settings", "delete")
  const canInsert = hasPermission("settings", "insert")

  // Fetch all settings data
  const loadData = useCallback(async () => {
    try {
      setLoading(true)

      // Fetch all rows from unified app_settings
      const { data, error } = await supabase
        .from("app_settings")
        .select("*")
        .order("name", { ascending: true })

      if (error) throw error

      if (!data || data.length === 0) {
        if (canEdit) {
          console.log("Settings: Table empty, seeding default configs...")
          const defaultSeeds = [
            {
              category: "company",
              name: "name",
              value: "PT Anugerah Buana Sriwijaya",
            },
            {
              category: "company",
              name: "address",
              value:
                "Jl. Bayam No. 1702 Kel. Sembilan Ilir Kec. Ilir Timur III Kota Palembang, Sumatera Selatan",
            },
            {
              category: "company",
              name: "email",
              value: "sales-order@anugerahbuanasriwijaya.co.id",
            },
            { category: "company", name: "npwp", value: "" },
            { category: "company", name: "npwp_address", value: "" },
            { category: "company", name: "logo_url", value: "" },
            { category: "tax", name: "PPN", value: 0.11 },
            { category: "tax", name: "PBBKB", value: 0.075 },
            { category: "tax", name: "PPH22", value: 0.003 },
            {
              category: "company",
              name: "bank",
              value: [
                {
                  id: "bank-1",
                  name: "Bank Mandiri",
                  bank_name: "Bank Mandiri",
                  account_number: "111231002319",
                  branch: "Letkol Iskandar",
                  account_name: "PT Anugerah Buana Sriwijaya",
                },
                {
                  id: "bank-2",
                  name: "Bank Central Asia",
                  bank_name: "Bank Central Asia",
                  account_number: "31312315",
                  branch: "Letkol Iskandar",
                  account_name: "PT Anugerah Buana Sriwijaya",
                },
              ],
            },
          ]
          const { error: seedError } = await supabase
            .from("app_settings")
            .insert(defaultSeeds)
          if (seedError) throw seedError
          loadDataRef.current?.()
          return
        } else {
          setCompanyInfo({
            name: "",
            address: "",
            email: "",
            npwp: "",
            npwp_address: "",
            logo_url: "",
          })
          setBankAccounts([])
          setParameters([])
          return
        }
      }

      if (data) {
        // Map data...
        const companyName =
          data.find(
            (r: AppSettingsRow) => r.category === "company" && r.name === "name"
          )?.value || ""
        const companyAddress =
          data.find(
            (r: AppSettingsRow) =>
              r.category === "company" && r.name === "address"
          )?.value || ""
        const companyEmail =
          data.find(
            (r: AppSettingsRow) =>
              r.category === "company" && r.name === "email"
          )?.value || ""
        const companyNpwp =
          data.find(
            (r: AppSettingsRow) => r.category === "company" && r.name === "npwp"
          )?.value || ""
        const companyNpwpAddress =
          data.find(
            (r: AppSettingsRow) =>
              r.category === "company" && r.name === "npwp_address"
          )?.value || ""
        const companyLogoUrl =
          data.find(
            (r: AppSettingsRow) =>
              r.category === "company" && r.name === "logo_url"
          )?.value || ""

        setCompanyInfo({
          name: companyName,
          address: companyAddress,
          email: companyEmail,
          npwp: companyNpwp,
          npwp_address: companyNpwpAddress,
          logo_url: companyLogoUrl,
        })

        const banksList =
          data.find(
            (r: AppSettingsRow) => r.category === "company" && r.name === "bank"
          )?.value || []
        setBankAccounts(
          banksList.map((b: BankRow) => ({
            id: b.id || Math.random().toString(36).substring(2, 9),
            name: b.name || b.bank_name || "",
            bank_name: b.bank_name || b.name || "",
            account_number: b.account_number || "",
            account_name: b.account_name || "",
            branch: b.branch || "",
          }))
        )

        const taxParams = data.filter(
          (r: AppSettingsRow) => r.category === "tax"
        )
        const systemParams: SystemParameter[] = taxParams.map(
          (p: AppSettingsRow) => ({
            key: p.name,
            value: p.value,
            category: p.category,
            label:
              p.name === "PPN"
                ? "PPN (VAT) Rate (%)"
                : p.name === "PBBKB"
                  ? "PBBKB Rate (%)"
                  : p.name === "PPH22"
                    ? "PPH22 Rate (%)"
                    : p.name,
            description:
              p.name === "PPN"
                ? "Value Added Tax rate applied to standard transactions."
                : p.name === "PBBKB"
                  ? "Fuel tax rate applied to logistics and shipping calculations."
                  : p.name === "PPH22"
                    ? "Art 22 Income Tax rate applied to imported or specific commodities."
                    : null,
          })
        )
        setParameters(systemParams)

        const valMap: Record<string, string> = {}
        systemParams.forEach((p: SystemParameter) => {
          valMap[p.key] =
            typeof p.value === "object"
              ? JSON.stringify(p.value)
              : String(p.value)
        })
        setParamValues(valMap)

        const ccs: Record<string, string> = {
          cc_quotation:
            data.find(
              (r: AppSettingsRow) =>
                r.category === "email" && r.name === "cc_quotation"
            )?.value || "",
          cc_po:
            data.find(
              (r: AppSettingsRow) =>
                r.category === "email" && r.name === "cc_po"
            )?.value || "",
          cc_do:
            data.find(
              (r: AppSettingsRow) =>
                r.category === "email" && r.name === "cc_do"
            )?.value || "",
          cc_invoice:
            data.find(
              (r: AppSettingsRow) =>
                r.category === "email" && r.name === "cc_invoice"
            )?.value || "",
          cc_payment:
            data.find(
              (r: AppSettingsRow) =>
                r.category === "email" && r.name === "cc_payment"
            )?.value || "",
        }
        setEmailCCs(ccs)

        const formats: Record<string, string> = {
          quotation:
            data.find(
              (r: AppSettingsRow) =>
                r.category === "numbering" && r.name === "quotation"
            )?.value || "QTN/{YYYY}/{SEQ:3}",
          "sales-order":
            data.find(
              (r: AppSettingsRow) =>
                r.category === "numbering" && r.name === "sales-order"
            )?.value || "PO/{YYYY}/{SEQ:3}",
          "delivery-order":
            data.find(
              (r: AppSettingsRow) =>
                r.category === "numbering" && r.name === "delivery-order"
            )?.value || "DO/{YYYY}/{SEQ:3}",
          deposit:
            data.find(
              (r: AppSettingsRow) =>
                r.category === "numbering" && r.name === "deposit"
            )?.value || "DEP/{YYYY}/{SEQ:3}",
          invoice:
            data.find(
              (r: AppSettingsRow) =>
                r.category === "numbering" && r.name === "invoice"
            )?.value || "INV/{YYYY}/{SEQ:3}",
          payment:
            data.find(
              (r: AppSettingsRow) =>
                r.category === "numbering" && r.name === "payment"
            )?.value || "PAY/{YYYY}/{SEQ:3}",
        }
        setNumberingFormats(formats)
      }
    } catch (error: unknown) {
      notify.error(
        dict.MSG_DATA_FETCH_FAILED || "Failed to load settings data",
        (error as Error).message
      )
    } finally {
      setLoading(false)
    }
  }, [canEdit, dict.MSG_DATA_FETCH_FAILED])

  useEffect(() => {
    loadDataRef.current = loadData
  })

  useEffect(() => {
    if (profile && canView) {
      startTransition(() => {
        loadData()
      })
    }
  }, [profile, canView, loadData])

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
        {
          category: "company",
          name: "npwp_address",
          value: companyInfo.npwp_address,
        },
        { category: "company", name: "logo_url", value: companyInfo.logo_url },
      ]
      const { error } = await supabase
        .from("app_settings")
        .upsert(updates, { onConflict: "category,name" })
      if (error) throw error
      notify.success(
        dict.MSG_UPDATE_SUCCESS.replace("%data%", `[${companyInfo.name}]`),
        dict.MSG_SUCCESS_UPDATE_DESC_NO_COMPANY.replace(
          "%entity%",
          `company settings [${companyInfo.name}]`
        ),
        undefined,
        true
      )
    } catch (error: unknown) {
      notify.error(
        dict.MSG_SAVE_FAILED.replace("%data%", `[${companyInfo.name}]`),
        error instanceof Error ? error.message : String(error)
      )
    } finally {
      setSavingCompany(false)
    }
  }

  const handleSaveBank = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canEdit) return
    try {
      setSavingBank(true)
      const updatedBanks: BankAccount[] = currentBank.id
        ? bankAccounts.map((b) =>
            b.id === currentBank.id
              ? ({ ...b, ...currentBank } as BankAccount)
              : b
          )
        : [
            ...bankAccounts,
            {
              ...currentBank,
              id: Math.random().toString(36).substring(2, 9),
            } as BankAccount,
          ]
      const { error } = await supabase
        .from("app_settings")
        .update({ value: updatedBanks })
        .eq("category", "company")
        .eq("name", "bank")
      if (error) throw error
      setBankAccounts(updatedBanks)
      setIsBankDialogOpen(false)
      if (currentBank.id) {
        notify.success(
          dict.MSG_UPDATE_SUCCESS.replace(
            "%data%",
            `[${currentBank.bank_name}]`
          ),
          dict.MSG_SUCCESS_UPDATE_DESC_NO_COMPANY.replace(
            "%entity%",
            `bank account [${currentBank.bank_name}]`
          ),
          undefined,
          true
        )
      } else {
        notify.success(
          dict.MSG_SAVE_SUCCESS.replace("%data%", `[${currentBank.bank_name}]`),
          dict.MSG_SUCCESS_SAVE_DESC_NO_COMPANY.replace(
            "%entity%",
            `bank account [${currentBank.bank_name}]`
          ),
          undefined,
          true
        )
      }
    } catch (error: unknown) {
      notify.error(
        dict.MSG_SAVE_FAILED.replace("%data%", `[${currentBank.bank_name}]`),
        error instanceof Error ? error.message : String(error)
      )
    } finally {
      setSavingBank(false)
    }
  }

  const handleDeleteBank = async (id: string) => {
    if (!canEdit) return
    const bank = bankAccounts.find((b) => b.id === id)
    const label = bank ? `[${bank.bank_name}]` : ""
    if (!confirm(dict.MSG_DELETE_CONFIRM || "Are you sure?")) return
    try {
      setDeletingBankId(id)
      const updatedBanks = bankAccounts.filter((b) => b.id !== id)
      const { error } = await supabase
        .from("app_settings")
        .update({ value: updatedBanks })
        .eq("category", "company")
        .eq("name", "bank")
      if (error) throw error
      setBankAccounts(updatedBanks)
      notify.deleted(
        dict.MSG_DELETE_SUCCESS.replace("%data%", label),
        dict.MSG_SUCCESS_DELETE_DESC_NO_COMPANY.replace(
          "%entity%",
          `bank account ${label}`
        ),
        undefined,
        true
      )
    } catch (error: unknown) {
      notify.error(
        dict.MSG_SAVE_FAILED.replace("%data%", label),
        error instanceof Error ? error.message : String(error)
      )
    } finally {
      setDeletingBankId(null)
    }
  }

  const handleParamValChange = (key: string, val: string) =>
    setParamValues((prev) => ({ ...prev, [key]: val }))

  const handleSaveParams = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canEdit) return
    try {
      setSavingParams(true)
      const updates = parameters.map((p) => ({
        category: p.category,
        name: p.key,
        value: paramValues[p.key],
      }))
      const { error } = await supabase
        .from("app_settings")
        .upsert(updates, { onConflict: "category,name" })
      if (error) throw error
      notify.success(
        dict.MSG_UPDATE_SUCCESS.replace("%data%", `[Parameters]`),
        dict.MSG_SUCCESS_UPDATE_DESC_NO_COMPANY.replace(
          "%entity%",
          "parameters"
        ),
        undefined,
        true
      )
    } catch (error: unknown) {
      notify.error(
        dict.MSG_SAVE_FAILED.replace("%data%", `[Parameters]`),
        error instanceof Error ? error.message : String(error)
      )
    } finally {
      setSavingParams(false)
    }
  }

  const handleSaveNewParam = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canEdit) return
    try {
      setSavingParamDialog(true)
      const { error } = await supabase
        .from("app_settings")
        .upsert(
          { category: "tax", name: newParam.key, value: newParam.value },
          { onConflict: "category,name" }
        )
      if (error) throw error
      setIsParamDialogOpen(false)
      loadData()
      notify.success(
        dict.MSG_SAVE_SUCCESS.replace("%data%", `[${newParam.key}]`),
        dict.MSG_SUCCESS_SAVE_DESC_NO_COMPANY.replace(
          "%entity%",
          `tax parameter [${newParam.key}]`
        ),
        undefined,
        true
      )
    } catch (error: unknown) {
      notify.error(
        dict.MSG_SAVE_FAILED.replace("%data%", `[${newParam.key}]`),
        error instanceof Error ? error.message : String(error)
      )
    } finally {
      setSavingParamDialog(false)
    }
  }

  const handleDeleteParam = async (key: string) => {
    if (!canEdit) return
    if (!confirm(dict.MSG_DELETE_CONFIRM || "Are you sure?")) return
    try {
      const { error } = await supabase
        .from("app_settings")
        .delete()
        .eq("category", "tax")
        .eq("name", key)
      if (error) throw error
      setParameters((prev) => prev.filter((p) => p.key !== key))
      notify.deleted(
        dict.MSG_DELETE_SUCCESS.replace("%data%", `[${key}]`),
        dict.MSG_SUCCESS_DELETE_DESC_NO_COMPANY.replace(
          "%entity%",
          `tax parameter [${key}]`
        ),
        undefined,
        true
      )
    } catch (error: unknown) {
      notify.error(
        dict.MSG_SAVE_FAILED.replace("%data%", `[${key}]`),
        error instanceof Error ? error.message : String(error)
      )
    }
  }

  const handleSaveEmailCCs = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canEdit) return
    try {
      setSavingEmailCCs(true)
      const updates = Object.entries(emailCCs).map(([k, v]) => ({
        category: "email",
        name: k,
        value: v,
      }))
      const { error } = await supabase
        .from("app_settings")
        .upsert(updates, { onConflict: "category,name" })
      if (error) throw error
      notify.success(
        dict.MSG_UPDATE_SUCCESS.replace("%data%", `[Email CC]`),
        dict.MSG_SUCCESS_UPDATE_DESC_NO_COMPANY.replace(
          "%entity%",
          "Email CC settings"
        ),
        undefined,
        true
      )
    } catch (error: unknown) {
      notify.error(
        dict.MSG_SAVE_FAILED.replace("%data%", `[Email CC]`),
        error instanceof Error ? error.message : String(error)
      )
    } finally {
      setSavingEmailCCs(false)
    }
  }

  const handleSaveNumbering = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canEdit) return
    try {
      setSavingNumbering(true)
      const updates = Object.entries(numberingFormats).map(([k, v]) => ({
        category: "numbering",
        name: k,
        value: v,
      }))
      const { error } = await supabase
        .from("app_settings")
        .upsert(updates, { onConflict: "category,name" })
      if (error) throw error
      notify.success(
        dict.MSG_UPDATE_SUCCESS.replace("%data%", `[Numbering Format]`),
        dict.MSG_SUCCESS_UPDATE_DESC_NO_COMPANY.replace(
          "%entity%",
          "numbering format settings"
        ),
        undefined,
        true
      )
    } catch (error: unknown) {
      notify.error(
        dict.MSG_SAVE_FAILED.replace("%data%", `[Numbering Format]`),
        error instanceof Error ? error.message : String(error)
      )
    } finally {
      setSavingNumbering(false)
    }
  }

  const previewFormat = (template: string) => {
    const now = new Date()
    let res = template
    res = res.replace("{YYYY}", now.getFullYear().toString())
    res = res.replace("{YY}", now.getFullYear().toString().slice(-2))
    res = res.replace("{MM}", (now.getMonth() + 1).toString().padStart(2, "0"))
    res = res.replace(
      "{MMM}",
      now.toLocaleString("default", { month: "short" }).toUpperCase()
    )
    res = res.replace("{DD}", now.getDate().toString().padStart(2, "0"))

    const seqMatch = res.match(/\{SEQ:([0-9]+)\}/)
    if (seqMatch) {
      const padding = parseInt(seqMatch[1])
      res = res.replace(seqMatch[0], "1".padStart(padding, "0"))
    }
    return res
  }

  if (authLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <SectionLoader />
      </div>
    )
  }

  if (!canView) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="space-y-2 text-center">
          <AlertCircle className="mx-auto size-8 text-destructive" />
          <h2 className="text-lg font-semibold">
            {dict.MSG_ACCESS_DENIED || "Access Denied"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {dict.MSG_NO_PERMISSION ||
              "You do not have permission to view this page."}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-7xl flex-col gap-6 overflow-hidden bg-background p-6">
      <div className="flex shrink-0 items-center justify-between border-b border-border/60 pb-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <Settings className="size-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              {dict.SETTINGS_TITLE || "Global Settings"}
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {dict.SETTINGS_SUBTITLE}
            </p>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 gap-4 border-b border-border/60">
        {(
          ["company", "banks", "parameters", "emails", "numbering"] as const
        ).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`relative z-10 -mb-[2px] flex items-center gap-2 border-b-2 px-1 pb-2.5 text-xs font-medium transition-all md:text-sm ${activeTab === t ? "border-primary font-semibold text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {t === "company" ? (
              <Building2 className="size-4" />
            ) : t === "banks" ? (
              <CreditCard className="size-4" />
            ) : t === "parameters" ? (
              <Sliders className="size-4" />
            ) : t === "emails" ? (
              <Mail className="size-4" />
            ) : (
              <FileText className="size-4" />
            )}
            <span>
              {(dict as Record<string, string>)[
                `SETTINGS_TAB_${t.toUpperCase()}`
              ] || (t === "numbering" ? "Numbering" : t)}
            </span>
          </button>
        ))}
      </div>

      <div className="no-scrollbar flex-1 overflow-y-auto scroll-smooth pb-6">
        {activeTab === "company" && (
          <form onSubmit={handleSaveCompany} className="space-y-6">
            <Card className="space-y-6 rounded-xl border-border/60 bg-card p-6 shadow-none">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>{dict.LABEL_COMPANY_NAME}</Label>
                  <Input
                    value={companyInfo.name || ""}
                    onChange={(e) =>
                      setCompanyInfo({ ...companyInfo, name: e.target.value })
                    }
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{dict.LABEL_EMAIL}</Label>
                  <Input
                    value={companyInfo.email || ""}
                    onChange={(e) =>
                      setCompanyInfo({ ...companyInfo, email: e.target.value })
                    }
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{dict.SETTINGS_LABEL_NPWP}</Label>
                  <Input
                    value={companyInfo.npwp || ""}
                    onChange={(e) =>
                      setCompanyInfo({ ...companyInfo, npwp: e.target.value })
                    }
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{dict.SETTINGS_LABEL_LOGO_URL}</Label>
                  <Input
                    value={companyInfo.logo_url || ""}
                    onChange={(e) =>
                      setCompanyInfo({
                        ...companyInfo,
                        logo_url: e.target.value,
                      })
                    }
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{dict.SETTINGS_LABEL_NPWP_ADDRESS}</Label>
                  <Textarea
                    value={companyInfo.npwp_address || ""}
                    onChange={(e) =>
                      setCompanyInfo({
                        ...companyInfo,
                        npwp_address: e.target.value,
                      })
                    }
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{dict.SETTINGS_LABEL_SHIPPING_ADDRESS}</Label>
                  <Textarea
                    value={companyInfo.address || ""}
                    onChange={(e) =>
                      setCompanyInfo({
                        ...companyInfo,
                        address: e.target.value,
                      })
                    }
                    disabled={!canEdit}
                  />
                </div>
              </div>
            </Card>
            {canEdit && (
              <div className="flex justify-end">
                <Button type="submit" disabled={savingCompany}>
                  {savingCompany ? (
                    <ButtonLoader />
                  ) : (
                    <Save className="mr-2 size-4" />
                  )}{" "}
                  {dict.SETTINGS_BUTTON_SAVE_COMPANY}
                </Button>
              </div>
            )}
          </form>
        )}

        {activeTab === "banks" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                {dict.SETTINGS_SEC_BANKS}
              </h3>
              {canEdit && (
                <Button
                  size="sm"
                  disabled={!canInsert}
                  onClick={() => {
                    setCurrentBank({})
                    setIsBankDialogOpen(true)
                  }}
                >
                  <Plus className="mr-2 size-4" /> Add
                </Button>
              )}
            </div>
            <div className="m-0.5 flex flex-wrap gap-4">
              {bankAccounts.map((bank) => (
                <Card
                  key={bank.id}
                  className="flex max-w-[350px] min-w-[180px] flex-1 flex-col justify-between gap-1 p-3"
                >
                  <div className="flex flex-row gap-4">
                    <div className="font-bold">{bank.bank_name}</div>
                    <div className="">( {bank.branch} )</div>
                  </div>
                  <div className="flex flex-row items-end gap-2">
                    <div className="flex-1 font-mono">
                      {bank.account_number}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={!canEdit}
                      onClick={() => {
                        setCurrentBank(bank)
                        setIsBankDialogOpen(true)
                      }}
                    >
                      <Pencil className="size-4" />
                    </Button>
                  </div>
                  <div className="flex flex-row items-end gap-2">
                    <div className="flex-1 text-sm text-muted-foreground">
                      {bank.account_name}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={!canDelete}
                      className="text-destructive"
                      onClick={() => handleDeleteBank(bank.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {activeTab === "parameters" && (
          <form onSubmit={handleSaveParams} className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                {dict.SETTINGS_SEC_PARAMS}
              </h3>
              {canEdit && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setIsParamDialogOpen(true)}
                >
                  <Plus className="mr-2 size-4" /> Add
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {parameters.map((p) => (
                <Card
                  key={p.key}
                  className="group relative gap-2 space-y-1 rounded border p-4"
                >
                  <Label className="text-xs font-bold">{p.label}</Label>
                  <Input
                    value={paramValues[p.key] || ""}
                    onChange={(e) =>
                      handleParamValChange(p.key, e.target.value)
                    }
                    disabled={!canEdit}
                  />
                  {canEdit && p.key !== "PPN" && p.key !== "PBBKB" && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 text-destructive opacity-0 group-hover:opacity-100"
                      onClick={() => handleDeleteParam(p.key)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </Card>
              ))}
            </div>
            {canEdit && (
              <div className="flex justify-end">
                <Button type="submit" disabled={savingParams}>
                  {savingParams ? (
                    <ButtonLoader />
                  ) : (
                    <Save className="mr-2 size-4" />
                  )}{" "}
                  {dict.SETTINGS_BUTTON_SAVE_PARAMS}
                </Button>
              </div>
            )}
          </form>
        )}

        {activeTab === "emails" && (
          <form onSubmit={handleSaveEmailCCs} className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {Object.entries(emailCCs).map(([k, v]) => (
                <Card key={k} className="space-y-1 rounded border p-4">
                  <Label className="capitalize">
                    {k.replace("cc_", "")} CCs
                  </Label>
                  <Input
                    value={v}
                    onChange={(e) =>
                      setEmailCCs((prev) => ({ ...prev, [k]: e.target.value }))
                    }
                    disabled={!canEdit}
                  />
                </Card>
              ))}
            </div>
            {canEdit && (
              <div className="flex justify-end">
                <Button type="submit" disabled={savingEmailCCs}>
                  {savingEmailCCs ? (
                    <ButtonLoader />
                  ) : (
                    <Save className="mr-2 size-4" />
                  )}{" "}
                  {dict.SETTINGS_BUTTON_SAVE_EMAILS}
                </Button>
              </div>
            )}
          </form>
        )}

        {activeTab === "numbering" && (
          <form onSubmit={handleSaveNumbering} className="space-y-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {Object.entries(numberingFormats).map(([k, v]) => (
                <Card key={k} className="gap-3 space-y-1 rounded border p-4">
                  <Label className="flex justify-between font-bold capitalize">
                    <span>{k.replace("-", " ")}</span>
                    <span className="rounded bg-muted p-1 font-mono text-[10px] text-muted-foreground">
                      {previewFormat(v)}
                    </span>
                  </Label>
                  <Input
                    value={v}
                    onChange={(e) =>
                      setNumberingFormats((prev) => ({
                        ...prev,
                        [k]: e.target.value,
                      }))
                    }
                    disabled={!canEdit}
                    placeholder="e.g. QTN/{YYYY}/{SEQ:3}"
                  />
                  <p className="text-[10px] text-muted-foreground italic">
                    Placeholders: {"{YYYY}"}, {"{YY}"}, {"{MM}"}, {"{MMM}"},{" "}
                    {"{DD}"}, {"{SEQ:N}"}
                  </p>
                </Card>
              ))}
            </div>
            {canEdit && (
              <div className="flex justify-end">
                <Button type="submit" disabled={savingNumbering}>
                  {savingNumbering ? (
                    <ButtonLoader />
                  ) : (
                    <Save className="mr-2 size-4" />
                  )}
                  {dict.BUTTON_SAVE || "Save"}
                </Button>
              </div>
            )}
          </form>
        )}
      </div>

      <Dialog open={isBankDialogOpen} onOpenChange={setIsBankDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Bank Account</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 p-4">
            <div className="grid gap-2">
              <Label>Bank Name</Label>
              <Input
                value={currentBank.bank_name || ""}
                onChange={(e) =>
                  setCurrentBank({ ...currentBank, bank_name: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>Account Number</Label>
              <Input
                value={currentBank.account_number || ""}
                onChange={(e) =>
                  setCurrentBank({
                    ...currentBank,
                    account_number: e.target.value,
                  })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>Account Holder</Label>
              <Input
                value={currentBank.account_name || ""}
                onChange={(e) =>
                  setCurrentBank({
                    ...currentBank,
                    account_name: e.target.value,
                  })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>Branch</Label>
              <Input
                value={currentBank.branch || ""}
                onChange={(e) =>
                  setCurrentBank({ ...currentBank, branch: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsBankDialogOpen(false)}
            >
              {dict.BUTTON_CANCEL}
            </Button>
            <Button onClick={handleSaveBank}>{dict.BUTTON_SAVE}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isParamDialogOpen} onOpenChange={setIsParamDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dict.SETTINGS_ADD_PARAM}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Key</Label>
              <Input
                value={newParam.key}
                onChange={(e) =>
                  setNewParam({ ...newParam, key: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>Value</Label>
              <Input
                value={newParam.value}
                onChange={(e) =>
                  setNewParam({ ...newParam, value: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsParamDialogOpen(false)}
            >
              {dict.BUTTON_CANCEL}
            </Button>
            <Button onClick={handleSaveNewParam}>{dict.BUTTON_SAVE}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
