"use client"

import { useState } from "react"
import { useDictionary } from "@/components/dictionary-provider"
import { useAuth } from "@/components/auth-provider"
import { createClient } from "@/lib/supabase"
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
import {
  Plus,
  User,
  Search,
  Pencil,
  Save,
  X,
  Phone,
  Fingerprint,
  CreditCard,
  Trash2,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Users,
  Loader2,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { SummaryCard } from "@/components/summary-card"
import { DeleteConfirmationDialog } from "@/components/confirmation-dialog"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

import { SectionLoader } from "@/components/section-loader"
import { notify } from "@/lib/notifications"
import { usePersistedState } from "@/hooks/use-persisted-state"
import { ButtonLoader } from "@/components/button-loader"
import { useTableData } from "@/hooks/use-table-data"
import { SortDialog } from "@/components/sort-dialog"

export default function FundersPage() {
  const { dict } = useDictionary()
  const supabase = createClient()
  const { hasPermission, loading: authLoading } = useAuth()

  const [updatedRowId, setUpdatedRowId] = useState<string | null>(null)

  const [isOpen, setIsOpen] = usePersistedState("funders_dialog_open", false)
  const [editingFunder, setEditingFunder] = usePersistedState<any>(
    "funders_editing_data",
    null
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [viewOnly, setViewOnly] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: string
    name: string
  } | null>(null)

  const [formData, setFormData] = usePersistedState("funders_form_data", {
    name: "",
    id_number: "",
    phone: "",
    bank_accounts: [
      { bank_name: "", account_number: "", account_holder: "" },
    ] as {
      bank_name: string
      account_number: string
      account_holder: string
    }[],
    is_active: true,
  })

  // Permission Checks
  const canView = hasPermission("funders", "view")
  const canInsert = hasPermission("funders", "insert")
  const canEdit = hasPermission("funders", "edit")
  const canDelete = hasPermission("funders", "delete")

  const sortColumns = [
    { label: dict.LABEL_NAME, value: "name" },
    { label: dict.LABEL_ID_NUMBER, value: "id_number" },
    { label: dict.LABEL_PHONE, value: "phone" },
    { label: dict.LABEL_IS_ACTIVE, value: "is_active" },
  ]

  const {
    rows: funders,
    isLoading,
    isFetching,
    isLoadingMore,
    hasMore,
    refresh,
    searchQuery,
    setSearchQuery,
    sortLevels,
    setSortLevels,
    stats,
    containerRef,
    sentinelRef,
  } = useTableData({
    table: "funders",
    select: "id, name, id_number, phone, bank_accounts, is_active",
    searchColumns: ["name", "id_number", "phone"],
    sortColumns,
    defaultSort: [
      { id: "is_active", column: "is_active", direction: "desc" },
      { id: "name", column: "name", direction: "asc" },
    ],
    sortPersistKey: "funders_sort",
    persistKey: "funders_search",
    pageSize: 50,
    // Counts only — fire on mount + after save/delete, never per keystroke.
    statsFetcher: async () => {
      const [{ count: totalCount }, { count: activeCount }] = await Promise.all(
        [
          supabase.from("funders").select("*", { count: "exact", head: true }),
          supabase
            .from("funders")
            .select("*", { count: "exact", head: true })
            .eq("is_active", true),
        ]
      )
      return {
        totalFunders: totalCount || 0,
        activeFunders: activeCount || 0,
      }
    },
  })

  const handleOpenDialog = (funder: any = null, isViewOnly = false) => {
    setViewOnly(isViewOnly)
    if (funder) {
      setEditingFunder(funder)
      setFormData({
        name: funder.name,
        id_number: funder.id_number || "",
        phone: funder.phone || "",
        bank_accounts:
          Array.isArray(funder.bank_accounts) && funder.bank_accounts.length > 0
            ? funder.bank_accounts
            : [{ bank_name: "", account_number: "", account_holder: "" }],
        is_active: funder.is_active ?? true,
      })
    } else {
      if (!canInsert) return
      setEditingFunder(null)
      setFormData({
        name: "",
        id_number: "",
        phone: "",
        bank_accounts: [
          { bank_name: "", account_number: "", account_holder: "" },
        ],
        is_active: true,
      })
    }
    setIsOpen(true)
  }

  const addBankAccount = () => {
    setFormData((prev) => ({
      ...prev,
      bank_accounts: [
        ...prev.bank_accounts,
        { bank_name: "", account_number: "", account_holder: "" },
      ],
    }))
  }

  const removeBankAccount = (index: number) => {
    if (formData.bank_accounts.length <= 1) return
    setFormData((prev) => ({
      ...prev,
      bank_accounts: prev.bank_accounts.filter((_, i) => i !== index),
    }))
  }

  const updateBankAccount = (
    index: number,
    field: keyof (typeof formData.bank_accounts)[0],
    value: string
  ) => {
    setFormData((prev) => {
      const newBanks = [...prev.bank_accounts]
      newBanks[index] = { ...newBanks[index], [field]: value }
      return { ...prev, bank_accounts: newBanks }
    })
  }

  const handleSubmit = async (
    e: React.SyntheticEvent<HTMLFormElement, SubmitEvent>
  ) => {
    e.preventDefault()
    if (isSubmitting) return
    setIsSubmitting(true)

    try {
      const payload = {
        name: formData.name,
        id_number: formData.id_number,
        phone: formData.phone,
        bank_accounts: formData.bank_accounts.filter(
          (b) => b.account_number.trim() !== ""
        ),
        is_active: formData.is_active,
        updated_at: new Date().toISOString(),
      }

      if (editingFunder) {
        const { error } = await supabase
          .from("funders")
          .update(payload)
          .eq("id", editingFunder.id)
        if (error) throw error
        setUpdatedRowId(editingFunder.id)
        notify.success(
          dict.MSG_UPDATE_SUCCESS.replace("%data%", `[${formData.name}]`),
          dict.MSG_SUCCESS_UPDATE_DESC_NO_COMPANY.replace(
            "%entity%",
            `funder [${formData.name}]`
          ),
          undefined,
          true
        )
      } else {
        const { data, error } = await supabase
          .from("funders")
          .insert([payload])
          .select()
          .single()
        if (error) throw error
        setUpdatedRowId(data?.id ?? null)
        notify.success(
          dict.MSG_SAVE_SUCCESS.replace("%data%", `[${formData.name}]`),
          dict.MSG_SUCCESS_SAVE_DESC_NO_COMPANY.replace(
            "%entity%",
            `funder [${formData.name}]`
          ),
          undefined,
          true
        )
      }
      setIsOpen(false)
      refresh()
    } catch (err) {
      console.error("Submit Funder Error:", err)
      notify.error(
        dict.MSG_SAVE_FAILED.replace("%data%", `[${formData.name}]`),
        (err as Error).message
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    const funder = funders.find((f) => f.id === id)
    if (!funder) return
    setDeleteConfirm({ id: funder.id, name: funder.name })
  }

  const confirmDelete = async () => {
    if (!deleteConfirm) return
    try {
      const { error } = await supabase
        .from("funders")
        .delete()
        .eq("id", deleteConfirm.id)
      if (error) throw error
      notify.deleted(
        dict.MSG_DELETE_SUCCESS.replace("%data%", `[${deleteConfirm.name}]`),
        dict.MSG_SUCCESS_DELETE_DESC_NO_COMPANY.replace(
          "%entity%",
          `funder [${deleteConfirm.name}]`
        ),
        undefined,
        true
      )
      setDeleteConfirm(null)
      refresh()
    } catch (err: any) {
      notify.error(
        dict.MSG_SAVE_FAILED.replace("%data%", `[${deleteConfirm.name}]`),
        err.message
      )
    } finally {
      setDeleteConfirm(null)
    }
  }

  if (!canView && !isLoading && !authLoading) {
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
      <div className="page-header shrink-0 flex-row items-center justify-between">
        <h1 className="page-title">
          <User className="mr-2 inline-block size-5 text-primary" />
          {dict.TITLE_FUNDERS}
        </h1>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={refresh}
            disabled={isLoading || isLoadingMore}
            title="Refresh Data"
          >
            <RefreshCw className={cn("size-4", isFetching && "animate-spin")} />
          </Button>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button
                size="icon"
                onClick={() => handleOpenDialog()}
                disabled={!canInsert}
                title={dict.TITLE_ADD_FUNDER}
                aria-label={dict.TITLE_ADD_FUNDER}
                className="md:h-9 md:w-auto md:gap-1.5 md:px-2.5"
              >
                <Plus className="size-4" />
                <span className="hidden md:inline">
                  {dict.TITLE_ADD_FUNDER}
                </span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>
                  <User className="mr-2 inline-block size-5" />
                  {viewOnly
                    ? formData.name
                    : editingFunder
                      ? dict.TITLE_EDIT_FUNDER
                      : dict.TITLE_ADD_FUNDER}
                </DialogTitle>
              </DialogHeader>
              <form
                onSubmit={handleSubmit}
                id="funder-form"
                className="relative max-h-[70vh] overflow-y-auto"
              >
                <div
                  className={cn(
                    `relative flex w-full flex-col gap-6 p-5 ${viewOnly ? "rounded-b-xl border-2 border-orange-500" : ""}`
                  )}
                >
                  {viewOnly && <div className="absolute inset-0 z-20"></div>}
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {/* Name */}
                    <div className="flex flex-col gap-2 md:col-span-2">
                      <Label htmlFor="name">{dict.LABEL_NAME}</Label>
                      <div className="flex items-center gap-3">
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) =>
                            setFormData({ ...formData, name: e.target.value })
                          }
                          required
                          className="flex-1"
                        />
                        <div className="flex min-w-[60px] flex-col items-center gap-0.5">
                          <Switch
                            id="is_active"
                            checked={formData.is_active}
                            onCheckedChange={(checked) =>
                              setFormData({ ...formData, is_active: checked })
                            }
                          />
                          <span className="mt-1.5 text-[10px] leading-none font-bold text-muted-foreground uppercase">
                            {formData.is_active
                              ? dict.LABEL_IS_ACTIVE
                              : dict.LABEL_IS_INACTIVE}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* ID Number */}
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="id_number">{dict.LABEL_ID_NUMBER}</Label>
                      <div className="relative">
                        <Fingerprint className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
                        <Input
                          id="id_number"
                          className="pl-9"
                          value={formData.id_number}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              id_number: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>

                    {/* Phone */}
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="phone">{dict.LABEL_PHONE}</Label>
                      <div className="relative">
                        <Phone className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
                        <Input
                          id="phone"
                          className="pl-9"
                          value={formData.phone}
                          onChange={(e) =>
                            setFormData({ ...formData, phone: e.target.value })
                          }
                        />
                      </div>
                    </div>

                    {/* Bank Accounts */}
                    <div className="flex flex-col gap-4 rounded-lg border bg-muted/5 p-4 md:col-span-2">
                      <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-2">
                          <CreditCard className="size-4" />
                          {dict.SETTINGS_TAB_BANKS}
                        </Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={addBankAccount}
                          className="h-8"
                        >
                          <Plus className="size-4" />
                        </Button>
                      </div>

                      <div className="flex flex-col gap-4">
                        {formData.bank_accounts.map((bank, index) => (
                          <div
                            key={index}
                            className="group/bank flex flex-col gap-3 rounded-md border bg-background p-3"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                                {dict.LABEL_BANK_ACCOUNTS} #{index + 1}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className={cn(
                                  "size-7 transition-colors",
                                  formData.bank_accounts.length > 1
                                    ? "text-destructive hover:bg-destructive/10"
                                    : "text-muted-foreground/20"
                                )}
                                disabled={formData.bank_accounts.length <= 1}
                                onClick={() => removeBankAccount(index)}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </div>

                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                              <div className="flex flex-col gap-1.5">
                                <Label className="text-[10px] font-bold tracking-tighter text-muted-foreground uppercase">
                                  {dict.SETTINGS_LABEL_BANK_NAME}
                                </Label>
                                <Input
                                  value={bank.bank_name}
                                  onChange={(e) =>
                                    updateBankAccount(
                                      index,
                                      "bank_name",
                                      e.target.value
                                    )
                                  }
                                  placeholder="e.g. BCA, Mandiri"
                                  className="h-8 text-sm"
                                />
                              </div>
                              <div className="flex flex-col gap-1.5">
                                <Label className="text-[10px] font-bold tracking-tighter text-muted-foreground uppercase">
                                  {dict.SETTINGS_LABEL_ACC_NUM}
                                </Label>
                                <Input
                                  value={bank.account_number}
                                  onChange={(e) =>
                                    updateBankAccount(
                                      index,
                                      "account_number",
                                      e.target.value
                                    )
                                  }
                                  className="h-8 font-mono text-sm"
                                />
                              </div>
                              <div className="flex flex-col gap-1.5 md:col-span-2">
                                <Label className="text-[10px] font-bold tracking-tighter text-muted-foreground uppercase">
                                  {dict.SETTINGS_LABEL_ACC_HOLDER}
                                </Label>
                                <Input
                                  value={bank.account_holder}
                                  onChange={(e) =>
                                    updateBankAccount(
                                      index,
                                      "account_holder",
                                      e.target.value
                                    )
                                  }
                                  className="h-8 text-sm"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </form>
              {!viewOnly && (
                <DialogFooter className="px-5 pb-5">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsOpen(false)}
                  >
                    <X data-icon="inline-start" />
                    {dict.BUTTON_CANCEL}
                  </Button>
                  <Button
                    type="submit"
                    form="funder-form"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <ButtonLoader />
                    ) : (
                      <Save data-icon="inline-start" />
                    )}
                    {dict.BUTTON_SAVE}
                  </Button>
                </DialogFooter>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="action-bar shrink-0">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder={dict.PLACEHOLDER_SEARCH}
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {isFetching && (
            <Loader2 className="absolute top-2.5 right-2.5 size-4 animate-spin text-muted-foreground" />
          )}
        </div>
        <SortDialog
          sortLevels={sortLevels}
          sortColumns={sortColumns}
          onSortLevelsChange={setSortLevels}
        />
      </div>

      <Card
        ref={containerRef}
        className="data-card custom-scrollbar flex-1 overflow-auto"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="px-7">{dict.LABEL_NAME}</TableHead>
              <TableHead className="max-md:hidden">
                {dict.LABEL_PHONE}
              </TableHead>
              <TableHead>{dict.LABEL_ID_NUMBER}</TableHead>
              <TableHead>{dict.LABEL_BANK_ACCOUNTS}</TableHead>
              <TableHead className="text-right"> </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="p-0">
                  <SectionLoader />
                </TableCell>
              </TableRow>
            ) : (
              <>
                {funders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center">
                      {dict.NO_DATA}
                    </TableCell>
                  </TableRow>
                ) : (
                  funders.map((funder) => {
                    const banks = Array.isArray(funder.bank_accounts)
                      ? funder.bank_accounts
                      : []
                    const primaryBank = banks[0]

                    return (
                      <TableRow
                        key={funder.id}
                        className={cn(
                          "group cursor-pointer",
                          updatedRowId === funder.id && "animate-row-highlight"
                        )}
                        onDoubleClick={() => handleOpenDialog(funder, true)}
                        onAnimationEnd={() => {
                          if (updatedRowId === funder.id) setUpdatedRowId(null)
                        }}
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center justify-between gap-3 md:hidden">
                            <div className="flex min-w-0 items-center gap-3">
                              <div
                                className={cn(
                                  "size-2 shrink-0 rounded-full",
                                  funder.is_active
                                    ? "bg-green-500"
                                    : "bg-muted-foreground/30"
                                )}
                              />
                              <div className="truncate">{funder.name}</div>
                            </div>
                            <span className="shrink-0 font-mono text-sm text-muted-foreground">
                              {funder.phone || "-"}
                            </span>
                          </div>
                          <div className="hidden items-center gap-3 md:flex">
                            <div
                              className={cn(
                                "size-2 shrink-0 rounded-full",
                                funder.is_active
                                  ? "bg-green-500"
                                  : "bg-muted-foreground/30"
                              )}
                            />
                            <div className="truncate">{funder.name}</div>
                          </div>
                        </TableCell>
                        <TableCell className="max-md:hidden">
                          <span className="text-sm">{funder.phone || "-"}</span>
                        </TableCell>
                        <TableCell className="max-md:hidden">
                          <span className="font-mono text-sm">
                            {funder.id_number || "-"}
                          </span>
                        </TableCell>
                        <TableCell className="max-md:hidden">
                          {primaryBank ? (
                            <div className="flex flex-col text-xs">
                              <span className="font-medium text-primary">
                                {primaryBank.bank_name}
                              </span>
                              <span className="font-mono text-muted-foreground">
                                {primaryBank.account_number}
                              </span>
                              {banks.length > 1 && (
                                <span className="mt-0.5 text-[10px] font-bold text-primary">
                                  + {banks.length - 1} more
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              -
                            </span>
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
            <TableRow ref={sentinelRef} className="border-0">
              <TableCell colSpan={5} className="overflow-hidden border-0 p-0">
                {isLoadingMore && (
                  <div className="relative h-24 w-full">
                    <SectionLoader />
                  </div>
                )}
                {!hasMore && funders.length > 0 && !isLoading && (
                  <div className="py-3 text-center text-xs text-danger/70 select-none">
                    — End of data —
                  </div>
                )}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>

      <div className="mb-1 grid shrink-0 grid-cols-2 gap-4">
        <SummaryCard
          label={dict.TITLE_FUNDERS || "Total Funders"}
          value={stats?.totalFunders ?? 0}
          icon={Users}
          color="primary"
        />
        <SummaryCard
          label={dict.LABEL_ACTIVE_FUNDERS || "Active Funders"}
          value={stats?.activeFunders ?? 0}
          icon={CheckCircle}
          color="green"
        />
      </div>

      <DeleteConfirmationDialog
        isOpen={deleteConfirm !== null}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        onConfirm={confirmDelete}
        title={dict.TITLE_DELETE || "Confirm Delete"}
        description={
          dict.MSG_DELETE_CONFIRM?.split("%data%")[0] ||
          "Are you sure you want to delete this funder? This action cannot be undone."
        }
        dataName={deleteConfirm?.name}
        confirmText={dict.BUTTON_DELETE || "Delete"}
        cancelText={dict.BUTTON_CANCEL || "Cancel"}
        variant="destructive"
      />
    </div>
  )
}
