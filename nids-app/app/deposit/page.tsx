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
  TableRow,
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
  AlertCircle,
  RefreshCw,
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
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { cn, constructMultiWordSearch } from "@/lib/utils"
import { SectionLoader } from "@/components/section-loader"
import { notify } from "@/lib/notifications"
import { RichTextEditor } from "@/components/rich-text-editor"
import { LiveSearch } from "@/components/live-search"
import { format } from "date-fns"
import { ButtonLoader } from "@/components/button-loader"

const PAGE_SIZE = 50

export default function DepositsPage() {
  const { dict, lang } = useDictionary()
  const { hasPermission, profile, loading: authLoading } = useAuth()
  const supabase = createClient()

  const [deposits, setDeposits] = useState<any[]>([])
  const [appBanks, setAppBanks] = useState<any[]>([])
  const [globalTaxes, setGlobalTaxes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [offset, setOffset] = useState(0)
  const [isSaving, setIsSaving] = useState(false)

  // Dialog State
  const [isOpen, setIsOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)
  const [viewOnly, setViewOnly] = useState(false)

  // Filter States
  const [searchQuery, setSearchQuery] = useState("")
  const debouncedSearchQuery = useDebounce(searchQuery, 300)
  const [selectedCompanyInfo, setSelectedCompanyInfo] = useState<any>(null)
  const [selectedProductInfo, setSelectedProductInfo] = useState<any>(null)

  const observerTarget = useRef(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const statusStyles: Record<string, string> = {
    Pending:
      "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
    Accepted:
      "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
    Rejected:
      "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20",
  }

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
    tax_details: [] as any[],
  }))

  // Permission Checks
  const canView = hasPermission("deposit", "view")
  const canInsert = hasPermission("deposit", "insert")
  const canEdit = hasPermission("deposit", "edit")
  const canDelete = hasPermission("deposit", "delete")
  const canPrint = hasPermission("deposit", "print")

  // Fetch Data
  const fetchData = useCallback(
    async (isInitial = false) => {
      if (isInitial) {
        setLoading(true)
        setOffset(0)
      } else {
        setLoadingMore(true)
      }

      try {
        const currentOffset = isInitial ? 0 : offset

        // Fetch settings in parallel only on initial load
        if (isInitial) {
          const [bRes, tRes] = await Promise.all([
            supabase
              .from("app_settings")
              .select("value")
              .eq("category", "company")
              .eq("name", "bank")
              .maybeSingle(),
            supabase.from("app_settings").select("*").eq("category", "tax"),
          ])
          if (bRes.error) throw bRes.error
          if (tRes.error) throw tRes.error
          setAppBanks(bRes.data?.value || [])
          setGlobalTaxes(tRes.data || [])
        }

        let query = supabase
          .from("deposits")
          .select(
            "*, company:companies(id, name, details->contact_person), product:products(id, name, sku)"
          )
          .order("created_at", { ascending: false })
          .range(currentOffset, currentOffset + PAGE_SIZE - 1)

        if (debouncedSearchQuery) {
          const searchStr = constructMultiWordSearch(debouncedSearchQuery, [
            "deposit_number",
            "company.name",
          ])
          if (searchStr) query = query.or(searchStr)
        }

        const { data, error } = await query
        if (error) throw error

        if (data) {
          if (isInitial) {
            setDeposits(data)
          } else {
            setDeposits((prev) => {
              const newItems = data.filter(
                (item: any) => !prev.some((p) => p.id === item.id)
              )
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
    },
    [supabase, offset, debouncedSearchQuery, dict.MSG_DATA_FETCH_FAILED]
  )

  const handleRefresh = () => {
    fetchData(true)
  }

  useEffect(() => {
    fetchData(true)
  }, [debouncedSearchQuery])

  // Ordinary Infinite Scroll
  useEffect(() => {
    const rootElement = containerRef.current
    if (!rootElement) return

    const observer = new IntersectionObserver(
      (entries) => {
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

  // Calculation logic
  const totals = useMemo(() => {
    const subtotal = formData.qty_liter * formData.price_per_liter
    let taxTotal = 0
    const appliedTaxes = formData.tax_details.map((t) => {
      if (!t.enabled) return { ...t, amount: 0 }
      const amt = (subtotal * Number(t.rate)) / 100
      taxTotal += amt
      return { ...t, amount: amt }
    })
    const grandTotal = subtotal + taxTotal
    return { subtotal, taxTotal, grandTotal, appliedTaxes }
  }, [formData.qty_liter, formData.price_per_liter, formData.tax_details])

  // Update total amount whenever grandTotal changes
  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      total_amount: totals.grandTotal,
    }))
  }, [totals.grandTotal])

  const handlePrint = (d: any) => {
    notify.info("Print function is not implemented yet")
  }

  // Open Dialog
  const handleOpenDialog = (item: any = null, isViewOnly = false) => {
    setViewOnly(isViewOnly)
    if (item) {
      setEditingItem(item)
      setSelectedCompanyInfo(item.company)
      setSelectedProductInfo(item.product)

      // Merge saved taxes with current global taxes
      const savedTaxes = Array.isArray(item.tax_details) ? item.tax_details : []
      const mergedTaxes = globalTaxes.map((gt) => {
        const existing = savedTaxes.find((st: any) => st.name === gt.name)
        if (existing)
          return { ...gt, rate: existing.rate, enabled: existing.enabled }
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
        product_id: item.product_id || "",
        deposit_date: item.deposit_date,
        qty_liter: item.qty_liter || 0,
        price_per_liter: item.price_per_liter || 0,
        total_amount: item.total_amount || 0,
        payment_method: item.payment_method || "Transfer",
        payment_bank_account: item.payment_bank_account || null,
        status: item.status,
        note: item.note || "",
        is_note_enabled: item.is_note_enabled ?? true,
        tax_details: mergedTaxes,
      })
    } else {
      if (!canInsert) return
      setEditingItem(null)
      setSelectedCompanyInfo(null)
      setSelectedProductInfo(null)

      setFormData({
        deposit_number: "", // Will be auto-generated on save if empty
        company_id: "",
        product_id: "",
        deposit_date: format(new Date(), "yyyy-MM-dd"),
        qty_liter: 0,
        price_per_liter: 0,
        total_amount: 0,
        payment_method: "Transfer",
        payment_bank_account: null,
        status: "Pending",
        note: "",
        is_note_enabled: true,
        tax_details: globalTaxes.map((gt) => ({
          ...gt,
          rate: gt.value,
          enabled: false,
        })),
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
        total_amount: totals.grandTotal, // Ensure we use the latest calculation
      }
      if (editingItem) {
        const { error } = await supabase
          .from("deposits")
          .update(payload)
          .eq("id", editingItem.id)
        if (error) throw error

        // Fetch updated row to keep local state in sync with relations
        const { data: updatedRow, error: fetchError } = await supabase
          .from("deposits")
          .select(
            "*, company:companies(id, name, details->contact_person), product:products(id, name, sku)"
          )
          .eq("id", editingItem.id)
          .single()

        if (!fetchError && updatedRow) {
          setDeposits((prev) =>
            prev.map((d) => (d.id === editingItem.id ? updatedRow : d))
          )
        } else {
          fetchData(true)
        }

        const docLabel = `[${payload.deposit_number || formData.deposit_number}]`
        notify.success(
          dict.MSG_UPDATE_SUCCESS.replace("%data%", docLabel),
          dict.MSG_SUCCESS_UPDATE_DESC.replace("%entity%", "deposit").replace(
            "%company%",
            `[${selectedCompanyInfo?.name || ""}]`
          ),
          undefined,
          true
        )
      } else {
        // Generate document number if empty
        if (!payload.deposit_number) {
          const { data, error: rpcError } = await supabase.rpc(
            "generate_document_number",
            { p_doc_type: "deposit" }
          )
          if (rpcError) throw rpcError
          payload.deposit_number = data
        }

        const { error } = await supabase.from("deposits").insert([payload])
        if (error) throw error
        const docLabel = `[${payload.deposit_number || formData.deposit_number}]`
        notify.success(
          dict.MSG_DEPOSIT_SAVED.replace("%data%", docLabel),
          dict.MSG_SUCCESS_SAVE_DESC.replace("%entity%", "deposit").replace(
            "%company%",
            `[${selectedCompanyInfo?.name || ""}]`
          ),
          undefined,
          true
        )
        fetchData(true)
      }
      setIsOpen(false)
    } catch (err: any) {
      const docLabel = `[${formData.deposit_number}]`
      notify.error(
        dict.MSG_SAVE_FAILED.replace("%data%", docLabel),
        err.message
      )
    } finally {
      setIsSaving(false)
    }
  }

  // Check if inventory from a deposit's supplier+product has been used in delivery orders
  const checkInventoryUsed = async (item: any): Promise<boolean> => {
    if (item.status !== "Accepted" || !item.company_id || !item.product_id)
      return false
    try {
      const { data, error } = await supabase
        .from("inventory_ledger")
        .select("id")
        .eq("supplier_id", item.company_id)
        .eq("product_id", item.product_id)
        .eq("transaction_type", "OUT")
        .limit(1)
      if (error) return false
      return (data?.length ?? 0) > 0
    } catch {
      return false
    }
  }

  const handleDelete = async (id: string) => {
    const item = deposits.find((d) => d.id === id)
    if (!item) return
    const docLabel = `[${item.deposit_number}]`
    const companyName = item.company?.name || ""

    // Block deletion of Accepted deposits whose inventory is already used
    if (item.status === "Accepted") {
      const inUse = await checkInventoryUsed(item)
      if (inUse) {
        notify.error(
          dict.MSG_DEPOSIT_DELETE_BLOCKED,
          dict.MSG_DEPOSIT_INVENTORY_IN_USE.replace("%data%", docLabel)
        )
        return
      }
    }

    if (!confirm(dict.MSG_DELETE_CONFIRM || "Are you sure?")) return
    try {
      const { error } = await supabase.from("deposits").delete().eq("id", id)
      if (error) throw error

      setDeposits((prev) => prev.filter((d) => d.id !== id))
      notify.deleted(
        dict.MSG_DEPOSIT_DELETED.replace("%data%", docLabel),
        dict.MSG_SUCCESS_DELETE_DESC.replace("%entity%", "deposit").replace(
          "%company%",
          `[${companyName}]`
        ),
        undefined,
        true
      )
    } catch (err: any) {
      const msg = err.message || ""
      if (msg.includes("DEPOSIT_INVENTORY_IN_USE")) {
        notify.error(
          dict.MSG_DEPOSIT_DELETE_BLOCKED,
          dict.MSG_DEPOSIT_INVENTORY_IN_USE.replace("%data%", docLabel)
        )
      } else {
        notify.error(dict.MSG_SAVE_FAILED.replace("%data%", docLabel), msg)
      }
    }
  }

  const updateStatus = async (id: string, status: string) => {
    const item = deposits.find((d) => d.id === id)
    if (!item) return
    const docLabel = `[${item.deposit_number}]`
    const companyName = item.company?.name || ""

    // Block un-accepting a deposit whose inventory is already used
    if (item.status === "Accepted" && status !== "Accepted") {
      const inUse = await checkInventoryUsed(item)
      if (inUse) {
        notify.error(
          dict.MSG_DEPOSIT_DELETE_BLOCKED,
          dict.MSG_DEPOSIT_INVENTORY_IN_USE.replace("%data%", docLabel)
        )
        return
      }
    }

    try {
      const { error } = await supabase
        .from("deposits")
        .update({ status })
        .eq("id", id)
      if (error) throw error

      setDeposits((prev) =>
        prev.map((d) => (d.id === id ? { ...d, status } : d))
      )
      notify.success(
        dict.MSG_DEPOSIT_STATUS_UPDATED.replace("%data%", docLabel),
        dict.MSG_SUCCESS_STATUS_DESC.replace("%status%", `[${status}]`).replace(
          "%company%",
          `[${companyName}]`
        ),
        undefined,
        true
      )
    } catch (err: any) {
      const msg = err.message || ""
      if (msg.includes("DEPOSIT_INVENTORY_IN_USE")) {
        notify.error(
          dict.MSG_DEPOSIT_DELETE_BLOCKED,
          dict.MSG_DEPOSIT_INVENTORY_IN_USE.replace("%data%", docLabel)
        )
      } else {
        notify.error(dict.MSG_UPDATE_FAILED.replace("%data%", docLabel), msg)
      }
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleSave()
  }

  if (!canView && !loading && !authLoading) {
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
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header shrink-0">
        <h1 className="page-title">
          <CirclePile className="mr-2 inline-block size-5 text-primary" />
          {dict.MENU_DEPOSIT}
        </h1>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={loading || loadingMore}
            title="Refresh Data"
          >
            <RefreshCw
              className={cn(
                "size-4",
                (loading || loadingMore) && "animate-spin"
              )}
            />
          </Button>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                onClick={() => handleOpenDialog()}
                disabled={!canInsert}
              >
                <Plus data-icon="inline-start" />
                {dict.BUTTON_NEW_DEPOSIT}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  <CirclePile className="mr-2 inline-block size-5" />
                  {viewOnly
                    ? formData.deposit_number
                    : editingItem
                      ? dict.BUTTON_EDIT + " Setoran"
                      : dict.BUTTON_NEW_DEPOSIT}
                </DialogTitle>
                <DialogDescription />
              </DialogHeader>

              <form
                onSubmit={handleSubmit}
                className="relative max-h-[70vh] overflow-y-auto"
              >
                <div
                  className={cn(
                    `relative flex w-full flex-col gap-6 p-5 ${viewOnly ? "rounded-b-xl border-2 border-orange-500" : ""}`
                  )}
                >
                  {viewOnly && <div className="absolute inset-0 z-20"></div>}
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="dnum">{dict.LABEL_DEPOSIT_NUMBER}</Label>
                      <Input
                        id="dnum"
                        value={formData.deposit_number}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            deposit_number: e.target.value,
                          })
                        }
                        disabled={
                          editingItem && !hasPermission("deposit", "edit")
                        }
                        placeholder={dict.LABEL_AUTO_GENERATED}
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label>{dict.LABEL_COMPANY_NAME}</Label>
                      <LiveSearch
                        data={selectedCompanyInfo ? [selectedCompanyInfo] : []}
                        fetchData={async (query) => {
                          let q = supabase
                            .from("companies")
                            .select(
                              "id, name, contact_person:details->contact_person"
                            )
                            .contains("type", ["Supplier"])
                            .limit(8)
                          if (query) {
                            const searchStr = constructMultiWordSearch(query, [
                              "name",
                              "details->>contact_person",
                            ])
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
                        defaultDisplay={
                          editingItem?.company_id === formData.company_id
                            ? editingItem?.company?.name
                            : ""
                        }
                        searchColumns={["name", "contact_person"]}
                        visualColumns={[
                          {
                            key: "name",
                            header: dict.LABEL_COMPANY_NAME,
                            className: "w-3/5 font-medium",
                            primary: true,
                          },
                          {
                            key: "contact_person",
                            header: dict.LABEL_CONTACT_PERSON,
                            className: "w-2/5",
                          },
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
                          let q = supabase
                            .from("products")
                            .select("id, sku, name")
                            .limit(8)
                          if (query) {
                            const searchStr = constructMultiWordSearch(query, [
                              "sku",
                              "name",
                            ])
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
                        defaultDisplay={
                          editingItem?.product_id === formData.product_id
                            ? editingItem?.product?.name
                            : ""
                        }
                        searchColumns={["sku", "name"]}
                        visualColumns={[
                          {
                            key: "sku",
                            header: "SKU",
                            className: "w-1/3 font-mono",
                            primary: true,
                          },
                          {
                            key: "name",
                            header: dict.LABEL_PRODUCT_NAME,
                            className: "w-2/3",
                          },
                        ]}
                        placeholder={dict.PLACEHOLDER_SEARCH}
                        emptyMessage={dict.NO_DATA}
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label className="flex items-center gap-2">
                        {dict.LABEL_QUANTITY}
                      </Label>
                      <NumberInput
                        value={formData.qty_liter}
                        onChange={(val) =>
                          setFormData({ ...formData, qty_liter: val })
                        }
                        rightBadge="L"
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label className="flex items-center gap-2 text-muted-foreground">
                        {dict.LABEL_UNIT_PRICE}
                      </Label>
                      <NumberInput
                        value={formData.price_per_liter}
                        onChange={(val) =>
                          setFormData({ ...formData, price_per_liter: val })
                        }
                        leftBadge={SITE_CONFIG.currencySymbol}
                        rightBadge="/ L"
                      />
                    </div>

                    <div className="col-span-1 h-fit space-y-4 rounded-lg border bg-muted/10 p-4 md:col-span-2">
                      <div className="mr-2 mb-2 flex justify-between font-mono text-sm font-semibold text-foreground">
                        <span>{dict.LABEL_SUBTOTAL || "Subtotal"}:</span>
                        <span>
                          {SITE_CONFIG.currencySymbol}{" "}
                          {totals.subtotal.toLocaleString()}
                        </span>
                      </div>

                      <div className="space-y-2 border-t pt-2">
                        <Label className="mb-2 block text-xs font-bold tracking-wider text-muted-foreground uppercase">
                          {dict.LABEL_TAXES || "Taxes"}
                        </Label>
                        <div className="space-y-2">
                          {formData.tax_details.map((tax, idx) => {
                            const calculatedAmount =
                              totals.appliedTaxes.find(
                                (t) => t.name === tax.name
                              )?.amount || 0
                            return (
                              <div
                                key={idx}
                                className="flex h-10 items-center gap-4 rounded border bg-background p-2"
                              >
                                <div className="w-24 shrink-0 font-medium">
                                  <Label
                                    htmlFor={`tax-${idx}`}
                                    className="cursor-pointer"
                                  >
                                    {tax.name}
                                  </Label>
                                </div>

                                <div className="flex w-12 shrink-0 items-center justify-center">
                                  <Switch
                                    id={`tax-${idx}`}
                                    checked={tax.enabled}
                                    onCheckedChange={(val) => {
                                      const newTaxes = [...formData.tax_details]
                                      newTaxes[idx].enabled = val
                                      setFormData({
                                        ...formData,
                                        tax_details: newTaxes,
                                      })
                                    }}
                                  />
                                </div>

                                <div className="flex w-24 shrink-0 items-center gap-2">
                                  <div
                                    style={{ opacity: tax.enabled ? 1 : 0.3 }}
                                    className="w-full transition-opacity"
                                  >
                                    <NumberInput
                                      className="text-right font-mono text-xs"
                                      containerClassName="h-6 bg-muted/50"
                                      disabled
                                      value={tax.rate}
                                      onChange={() => {}}
                                      rightBadge="%"
                                    />
                                  </div>
                                </div>

                                <div className="flex flex-1 justify-end">
                                  <span
                                    className={cn(
                                      "font-mono text-sm transition-opacity",
                                      tax.enabled
                                        ? "text-foreground opacity-100"
                                        : "text-muted-foreground opacity-30"
                                    )}
                                  >
                                    {SITE_CONFIG.currencySymbol}{" "}
                                    {calculatedAmount.toLocaleString()}
                                  </span>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      <div className="mr-2 flex justify-between border-t pt-4 font-mono text-sm font-bold">
                        <span>{dict.LABEL_GRAND_TOTAL || "Grand Total"}:</span>
                        <span className="text-primary">
                          {SITE_CONFIG.currencySymbol}{" "}
                          {totals.grandTotal.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="grid gap-2 md:col-span-2">
                      <Label>{dict.LABEL_PAYMENT_METHOD}</Label>
                      <div className="flex gap-2">
                        <Input
                          className="w-1/3"
                          value={formData.payment_method}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              payment_method: e.target.value,
                            })
                          }
                          placeholder="e.g. Transfer"
                        />
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              className="flex-1 justify-between"
                            >
                              {formData.payment_bank_account
                                ? `${formData.payment_bank_account.bank_name} - ${formData.payment_bank_account.account_number}`
                                : "Select Bank (Optional)"}
                              <ChevronDown className="size-4 opacity-50" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="w-80">
                            <DropdownMenuItem
                              onClick={() =>
                                setFormData({
                                  ...formData,
                                  payment_bank_account: null,
                                })
                              }
                            >
                              None / Manual
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {appBanks.map((bank, idx) => (
                              <DropdownMenuItem
                                key={idx}
                                onClick={() =>
                                  setFormData({
                                    ...formData,
                                    payment_bank_account: bank,
                                  })
                                }
                              >
                                <div className="flex flex-col">
                                  <span className="font-medium">
                                    {bank.bank_name}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {bank.account_number} ({bank.account_name})
                                  </span>
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
                      onChange={(val) =>
                        setFormData({ ...formData, note: val || "" })
                      }
                      isEnabled={formData.is_note_enabled}
                      onToggleEnabled={(val) =>
                        setFormData({ ...formData, is_note_enabled: val })
                      }
                      placeholder="..."
                    />
                  </div>
                </div>
              </form>
              {!viewOnly && (
                <DialogFooter className="shrink-0 px-5 pb-5">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsOpen(false)}
                  >
                    {dict.BUTTON_CANCEL}
                  </Button>
                  <Button
                    onClick={() => handleSave()}
                    disabled={isSaving || (editingItem ? !canEdit : !canInsert)}
                  >
                    {isSaving ? (
                      <ButtonLoader />
                    ) : (
                      <Save data-icon="inline-start" />
                    )}{" "}
                    {dict.BUTTON_SAVE_DEPOSIT}
                  </Button>
                </DialogFooter>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="action-bar shrink-0">
        <div className="relative w-full max-w-sm flex-1">
          <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder={dict.PLACEHOLDER_SEARCH}
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <Card
        ref={containerRef}
        className="data-card custom-scrollbar flex-1 overflow-auto"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="px-7">
                {dict.LABEL_DEPOSIT_NUMBER}
              </TableHead>
              <TableHead>{dict.LABEL_COMPANY_NAME}</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead className="text-center">
                {dict.LABEL_DEPOSIT_DATE}
              </TableHead>
              <TableHead>Qty (L)</TableHead>
              <TableHead>{dict.LABEL_TOTAL_PRICE}</TableHead>
              <TableHead className="text-center">{dict.LABEL_STATUS}</TableHead>
              <TableHead className="text-right"> </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="p-0">
                  <SectionLoader />
                </TableCell>
              </TableRow>
            ) : deposits.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="py-10 text-center text-muted-foreground"
                >
                  {dict.NO_DATA}
                </TableCell>
              </TableRow>
            ) : (
              deposits.map((d) => (
                <TableRow
                  key={d.id}
                  className="group cursor-pointer"
                  onDoubleClick={() => handleOpenDialog(d, true)}
                >
                  <TableCell className="font-medium">
                    {d.deposit_number}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {d.company?.name || "-"}
                      </span>
                      {d.company?.contact_person && (
                        <span className="text-[10px] text-muted-foreground">
                          {d.company.contact_person}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs">
                      {d.product?.sku || "-"}
                    </span>
                  </TableCell>
                  <TableCell className="text-center text-sm text-muted-foreground">
                    {format(new Date(d.deposit_date), "dd MMM yyyy")}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-bold">
                        {new Intl.NumberFormat(
                          lang === "id" ? "id-ID" : "en-US"
                        ).format(d.qty_liter)}{" "}
                        L
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="font-semibold text-primary">
                    {new Intl.NumberFormat(lang === "id" ? "id-ID" : "en-US", {
                      style: "currency",
                      currency: "IDR",
                    }).format(d.total_amount)}
                  </TableCell>
                  <TableCell className="text-center align-middle">
                    <div
                      className={cn(
                        "inline-flex w-20 items-center justify-center rounded-full px-2 py-1 text-[10px] font-bold uppercase",
                        statusStyles[d.status] || statusStyles.Pending
                      )}
                    >
                      {d.status}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="table_action"
                        size="sm"
                        onClick={() => handleOpenDialog(d)}
                        disabled={!canEdit}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="table_action"
                        size="sm"
                        onClick={() => handlePrint(d)}
                        disabled={!canPrint}
                      >
                        <Printer className="size-4" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="secondary"
                            size="icon"
                            className="size-8"
                          >
                            <ChevronDown className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                              <CheckCircle2 className="mr-2 size-4" /> Status
                            </DropdownMenuSubTrigger>
                            <DropdownMenuPortal>
                              <DropdownMenuSubContent>
                                <DropdownMenuItem
                                  onClick={() => updateStatus(d.id, "Pending")}
                                  className="font-medium text-amber-600 dark:text-amber-400"
                                  disabled={!canEdit}
                                >
                                  Pending
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => updateStatus(d.id, "Accepted")}
                                  className="font-medium text-emerald-600 dark:text-emerald-400"
                                  disabled={!canEdit}
                                >
                                  Accepted
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => updateStatus(d.id, "Rejected")}
                                  className="font-medium text-rose-600 dark:text-rose-400"
                                  disabled={!canEdit}
                                >
                                  Rejected
                                </DropdownMenuItem>
                              </DropdownMenuSubContent>
                            </DropdownMenuPortal>
                          </DropdownMenuSub>
                          {canDelete && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                                onClick={() => handleDelete(d.id)}
                              >
                                <Trash2 className="mr-2 size-4" />
                                {dict.BUTTON_DELETE}
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}

            {/* Infinite Scroll Sentinel & Loader */}
            <TableRow ref={observerTarget} className="border-0">
              <TableCell colSpan={8} className="overflow-hidden border-0 p-0">
                {loadingMore && (
                  <div className="relative h-24 w-full">
                    <SectionLoader />
                  </div>
                )}
                {!hasMore && deposits.length > 0 && !loading && (
                  <div className="py-3 text-center text-xs text-danger/70 select-none">
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
