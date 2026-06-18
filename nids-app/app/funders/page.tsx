"use client"

import { useState, useEffect, useCallback, useRef } from "react"
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
import { Plus, User, Search, Pencil, Save, X, Phone, Fingerprint, CreditCard, Trash2, RefreshCw, AlertCircle, CheckCircle, Users } from "lucide-react"
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
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

import { SectionLoader } from "@/components/section-loader"
import { notify } from "@/lib/notifications"
import { usePersistedState } from "@/hooks/use-persisted-state"
import { ButtonLoader } from "@/components/button-loader"
import { useDebounce } from "@/hooks/use-debounce"

const PAGE_SIZE = 50

export default function FundersPage() {
  const { dict } = useDictionary()
  const supabase = createClient()
  const { hasPermission, profile, loading: authLoading } = useAuth()

  const [funders, setFunders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [offset, setOffset] = useState(0)

  const [stats, setStats] = useState({
    totalFunders: 0,
    activeFunders: 0
  })

  const [isOpen, setIsOpen] = usePersistedState("funders_dialog_open", false)
  const [editingFunder, setEditingFunder] = usePersistedState<any>("funders_editing_data", null)
  const [searchQuery, setSearchQuery] = usePersistedState("funders_search", "")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string, name: string } | null>(null)
  const debouncedSearchQuery = useDebounce(searchQuery, 300)

  const observerTarget = useRef(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [formData, setFormData] = usePersistedState("funders_form_data", {
    name: "",
    id_number: "",
    phone: "",
    bank_accounts: [{ bank_name: "", account_number: "", account_holder: "" }] as { bank_name: string, account_number: string, account_holder: string }[],
    is_active: true
  })

  // Permission Checks
  const canView = hasPermission("funders", "view")
  const canInsert = hasPermission("funders", "insert")
  const canEdit = hasPermission("funders", "edit")
  const canDelete = hasPermission("funders", "delete")

  const fetchStats = useCallback(async () => {
    try {
      const [
        { count: totalCount },
        { count: activeCount }
      ] = await Promise.all([
        supabase.from('funders').select('*', { count: 'exact', head: true }),
        supabase.from('funders').select('*', { count: 'exact', head: true }).eq('is_active', true)
      ])

      setStats({
        totalFunders: totalCount || 0,
        activeFunders: activeCount || 0
      })
    } catch (err) {
      console.error("Fetch Funders Stats Error:", err)
    }
  }, [supabase])

  const fetchFunders = useCallback(async (isInitial = false) => {
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
        .from("funders")
        .select("*")
        .order('is_active', { ascending: false })
        .order('name', { ascending: true })
        .range(currentOffset, currentOffset + PAGE_SIZE - 1)

      if (debouncedSearchQuery) {
        query = query.or(`name.ilike.%${debouncedSearchQuery}%,id_number.ilike.%${debouncedSearchQuery}%,phone.ilike.%${debouncedSearchQuery}%`)
      }

      const { data, error } = await query

      if (error) {
        console.error("Fetch Funders Error:", error)
        notify.error(dict.MSG_DATA_FETCH_FAILED, error.message)
      } else if (data) {
        if (isInitial) {
          setFunders(data)
        } else {
          setFunders(prev => {
            const newItems = data.filter((item: any) => !prev.some(p => p.id === item.id))
            return [...prev, ...newItems]
          })
        }
        setHasMore(data.length === PAGE_SIZE)
        setOffset(currentOffset + data.length)
      }
    } catch (err) {
      console.error("Fetch Funders Exception:", err)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [supabase, offset, debouncedSearchQuery, dict.MSG_DATA_FETCH_FAILED])

  useEffect(() => {
    fetchFunders(true)
  }, [debouncedSearchQuery])

  // Simple Ordinary Infinite Scroll
  useEffect(() => {
    const rootElement = containerRef.current;
    if (!rootElement) return;

    const observer = new IntersectionObserver(
      entries => {
        const entry = entries[0]
        if (entry.isIntersecting && hasMore && !loading && !loadingMore) {
          fetchFunders(false)
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
  }, [fetchFunders, hasMore, loading, loadingMore])

  const handleRefresh = () => {
    fetchFunders(true)
  }

  const handleOpenDialog = (funder: any = null) => {
    if (funder) {
      setEditingFunder(funder)
      setFormData({
        name: funder.name,
        id_number: funder.id_number || "",
        phone: funder.phone || "",
        bank_accounts: Array.isArray(funder.bank_accounts) && funder.bank_accounts.length > 0
          ? funder.bank_accounts
          : [{ bank_name: "", account_number: "", account_holder: "" }],
        is_active: funder.is_active ?? true
      })
    } else {
      if (!canInsert) return
      setEditingFunder(null)
      setFormData({
        name: "",
        id_number: "",
        phone: "",
        bank_accounts: [{ bank_name: "", account_number: "", account_holder: "" }],
        is_active: true
      })
    }
    setIsOpen(true)
  }

  const addBankAccount = () => {
    setFormData(prev => ({
      ...prev,
      bank_accounts: [...prev.bank_accounts, { bank_name: "", account_number: "", account_holder: "" }]
    }))
  }

  const removeBankAccount = (index: number) => {
    if (formData.bank_accounts.length <= 1) return
    setFormData(prev => ({
      ...prev,
      bank_accounts: prev.bank_accounts.filter((_, i) => i !== index)
    }))
  }

  const updateBankAccount = (index: number, field: keyof typeof formData.bank_accounts[0], value: string) => {
    setFormData(prev => {
      const newBanks = [...prev.bank_accounts]
      newBanks[index] = { ...newBanks[index], [field]: value }
      return { ...prev, bank_accounts: newBanks }
    })
  }

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement, SubmitEvent>) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const payload = {
        name: formData.name,
        id_number: formData.id_number,
        phone: formData.phone,
        bank_accounts: formData.bank_accounts.filter(b => b.account_number.trim() !== ""),
        is_active: formData.is_active,
        updated_at: new Date().toISOString()
      }

      if (editingFunder) {
        const { data, error } = await supabase.from("funders").update(payload).eq("id", editingFunder.id).select().single()
        if (error) throw error
        setFunders(prev => prev.map(f => f.id === editingFunder.id ? data : f))
        notify.success(dict.MSG_UPDATE_SUCCESS.replace("%data%", ""), dict.MSG_UPDATE_SUCCESS.replace("%data%", `[${formData.name}]`))
      } else {
        const { data, error } = await supabase.from("funders").insert([payload]).select().single()
        if (error) throw error
        setFunders(prev => [data, ...prev])
        notify.success(dict.MSG_SAVE_SUCCESS.replace("%data%", ""), dict.MSG_SAVE_SUCCESS.replace("%data%", `[${formData.name}]`))
      }
      fetchStats()
      setIsOpen(false)
    }
    catch (err) {
      console.error("Submit Funder Error:", err)
      notify.error(dict.MSG_SAVE_FAILED, (err as Error).message)
    }
    finally {
      setIsSubmitting(false);
    }
  }

  const handleDelete = async (id: string) => {
    const funder = funders.find(f => f.id === id)
    if (!funder) return
    setDeleteConfirm({ id: funder.id, name: funder.name })
  }

  const confirmDelete = async () => {
    if (!deleteConfirm) return
    try {
      const { error } = await supabase.from("funders").delete().eq("id", deleteConfirm.id)
      if (error) throw error
      notify.deleted(dict.MSG_DELETE_SUCCESS.replace("%data%", `[${deleteConfirm.name}]`))
      setFunders(prev => prev.filter(f => f.id !== deleteConfirm.id))
      fetchStats()
    } catch (err: any) {
      notify.error(dict.MSG_SAVE_FAILED, err.message)
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
    <div className="page-container overflow-hidden">
      <div className="page-header shrink-0">
        <h1 className="page-title">
          <User className="size-5 mr-2 inline-block text-primary" />
          {dict.TITLE_FUNDERS}
        </h1>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handleRefresh} disabled={loading || loadingMore} title="Refresh Data">
            <RefreshCw className={cn("size-4", (loading || loadingMore) && "animate-spin")} />
          </Button>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()} disabled={!canInsert}>
                <Plus data-icon="inline-start" />
                {dict.TITLE_ADD_FUNDER}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>
                  <User className="size-5 mr-2 inline-block" />{editingFunder ? dict.TITLE_EDIT_FUNDER : dict.TITLE_ADD_FUNDER}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} id="funder-form" className="flex flex-col gap-6 p-5 overflow-y-auto max-h-[70vh]">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Name */}
                  <div className="flex flex-col gap-2 md:col-span-2">
                    <Label htmlFor="name">{dict.LABEL_NAME}</Label>
                    <div className="flex items-center gap-3">
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                        className="flex-1"
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

                  {/* ID Number */}
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="id_number">{dict.LABEL_ID_NUMBER}</Label>
                    <div className="relative">
                      <Fingerprint className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                      <Input
                        id="id_number"
                        className="pl-9"
                        value={formData.id_number}
                        onChange={(e) => setFormData({ ...formData, id_number: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Phone */}
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

                  {/* Bank Accounts */}
                  <div className="flex flex-col gap-4 md:col-span-2 border rounded-lg p-4 bg-muted/5">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2">
                        <CreditCard className="size-4" />
                        {dict.SETTINGS_TAB_BANKS}
                      </Label>
                      <Button type="button" variant="outline" size="sm" onClick={addBankAccount} className="h-8">
                        <Plus className="size-4" />
                      </Button>
                    </div>

                    <div className="flex flex-col gap-4">
                      {formData.bank_accounts.map((bank, index) => (
                        <div key={index} className="flex flex-col gap-3 p-3 border rounded-md bg-background group/bank">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                              {dict.LABEL_BANK_ACCOUNTS} #{index + 1}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className={cn(
                                "size-7 transition-colors",
                                formData.bank_accounts.length > 1 ? "text-destructive hover:bg-destructive/10" : "text-muted-foreground/20"
                              )}
                              disabled={formData.bank_accounts.length <= 1}
                              onClick={() => removeBankAccount(index)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1.5">
                              <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">{dict.SETTINGS_LABEL_BANK_NAME}</Label>
                              <Input
                                value={bank.bank_name}
                                onChange={(e) => updateBankAccount(index, 'bank_name', e.target.value)}
                                placeholder="e.g. BCA, Mandiri"
                                className="h-8 text-sm"
                              />
                            </div>
                            <div className="flex flex-col gap-1.5">
                              <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">{dict.SETTINGS_LABEL_ACC_NUM}</Label>
                              <Input
                                value={bank.account_number}
                                onChange={(e) => updateBankAccount(index, 'account_number', e.target.value)}
                                className="h-8 text-sm font-mono"
                              />
                            </div>
                            <div className="flex flex-col gap-1.5 md:col-span-2">
                              <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">{dict.SETTINGS_LABEL_ACC_HOLDER}</Label>
                              <Input
                                value={bank.account_holder}
                                onChange={(e) => updateBankAccount(index, 'account_holder', e.target.value)}
                                className="h-8 text-sm"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </form>
              <DialogFooter className="px-5 pb-5">
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                  <X data-icon="inline-start" />
                  {dict.BUTTON_CANCEL}
                </Button>
                <Button type="submit" form="funder-form" disabled={isSubmitting}>
                  {isSubmitting ? (<ButtonLoader />) : (<Save data-icon="inline-start" />)}
                  {dict.BUTTON_SAVE}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="action-bar shrink-0">
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

      <Card ref={containerRef} className="data-card flex-1 overflow-auto custom-scrollbar">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="px-7">{dict.LABEL_NAME}</TableHead>
              <TableHead>{dict.LABEL_ID_NUMBER}</TableHead>
              <TableHead>{dict.LABEL_PHONE}</TableHead>
              <TableHead>{dict.LABEL_BANK_ACCOUNTS}</TableHead>
              <TableHead className="text-right"> </TableHead>
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
              <>
                {funders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">{dict.NO_DATA}</TableCell>
                  </TableRow>
                ) : (
                  funders.map((funder) => {
                    const banks = Array.isArray(funder.bank_accounts) ? funder.bank_accounts : []
                    const primaryBank = banks[0]

                    return (
                      <TableRow key={funder.id} className="group">
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "size-2 rounded-full",
                              funder.is_active ? "bg-green-500" : "bg-muted-foreground/30"
                            )} />
                            <div>{funder.name}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-mono">{funder.id_number || "-"}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{funder.phone || "-"}</span>
                        </TableCell>
                        <TableCell>
                          {primaryBank ? (
                            <div className="flex flex-col text-xs">
                              <span className="font-medium text-primary">{primaryBank.bank_name}</span>
                              <span className="text-muted-foreground font-mono">{primaryBank.account_number}</span>
                              {banks.length > 1 && (
                                <span className="text-[10px] text-primary font-bold mt-0.5">
                                  + {banks.length - 1} more
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="table_action"
                              size="sm"
                              onClick={() => handleOpenDialog(funder)}
                              disabled={!canEdit}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            {canDelete && (
                              <Button
                                variant="table_action"
                                size="sm"
                                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => handleDelete(funder.id)}
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

            {/* Sentinel - ALWAYS mounted so observer doesn't lose it */}
            <TableRow ref={observerTarget} className="border-0">
              <TableCell colSpan={5} className="p-0 border-0 overflow-hidden">
                {loadingMore && (
                  <div className="relative h-24 w-full">
                    <SectionLoader />
                  </div>
                )}
                {!hasMore && funders.length > 0 && !loading && (
                  <div className="text-center py-3 text-xs text-danger/70 select-none">
                    — End of data —
                  </div>
                )}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>

      <div className="grid grid-cols-2 gap-4 mb-1 shrink-0">
        <SummaryCard
          label={dict.TITLE_FUNDERS || "Total Funders"}
          value={stats.totalFunders}
          icon={Users}
          color="primary"
        />
        <SummaryCard
          label={dict.LABEL_ACTIVE_FUNDERS || "Active Funders"}
          value={stats.activeFunders}
          icon={CheckCircle}
          color="green"
        />
      </div>

      <DeleteConfirmationDialog
        isOpen={deleteConfirm !== null}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        onConfirm={confirmDelete}
        title={dict.TITLE_DELETE || "Confirm Delete"}
        description={dict.MSG_DELETE_CONFIRM?.split("%data%")[0] || "Are you sure you want to delete this funder? This action cannot be undone."}
        dataName={deleteConfirm?.name}
        confirmText={dict.BUTTON_DELETE || "Delete"}
        cancelText={dict.BUTTON_CANCEL || "Cancel"}
        variant="destructive"
      />
    </div>
  )
}
