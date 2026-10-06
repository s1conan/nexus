"use client"

import { useState } from "react"
import { useDictionary } from "@/components/dictionary-provider"
import { SITE_CONFIG } from "@/lib/site-content"
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
  Save,
  X,
  Plus,
  Package,
  Search,
  Pencil,
  RefreshCw,
  AlertCircle,
  Trash2,
  Loader2,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { DeleteConfirmationDialog } from "@/components/confirmation-dialog"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

import { cn } from "@/lib/utils"

import { SectionLoader } from "@/components/section-loader"
import { notify } from "@/lib/notifications"
import { usePersistedState } from "@/hooks/use-persisted-state"
import { NumberInput } from "@/components/number-input"

import { formatCurrency } from "@/lib/formatters"
import { ButtonLoader } from "@/components/button-loader"
import { useTableData } from "@/hooks/use-table-data"
import { SortDialog } from "@/components/sort-dialog"

export default function ProductsPage() {
  const { dict, lang } = useDictionary()
  const supabase = createClient()
  const { hasPermission, loading: authLoading } = useAuth()

  const [updatedRowId, setUpdatedRowId] = useState<string | null>(null)

  const [isOpen, setIsOpen] = usePersistedState("products_dialog_open", false)
  const [editingProduct, setEditingProduct] = usePersistedState<any>(
    "products_editing_data",
    null
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [viewOnly, setViewOnly] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: string
    name: string
  } | null>(null)

  const [formData, setFormData] = usePersistedState("products_form_data", {
    sku: "",
    name: "",
    base_price: 0,
    is_active: true,
  })

  // Permission Checks
  const canView = hasPermission("products", "view")
  const canInsert = hasPermission("products", "insert")
  const canEdit = hasPermission("products", "edit")
  const canDelete = hasPermission("products", "delete")

  const sortColumns = [
    { label: dict.LABEL_PRODUCT_NAME, value: "name" },
    { label: dict.LABEL_SKU, value: "sku" },
    { label: dict.LABEL_BASE_PRICE, value: "base_price" },
    { label: dict.LABEL_IS_ACTIVE, value: "is_active" },
  ]

  const {
    rows: products,
    isLoading,
    isFetching,
    isLoadingMore,
    hasMore,
    refresh,
    searchQuery,
    setSearchQuery,
    sortLevels,
    setSortLevels,
    containerRef,
    sentinelRef,
  } = useTableData({
    table: "products",
    select: "id, sku, name, base_price, is_active",
    searchColumns: ["name", "sku"],
    sortColumns,
    defaultSort: [
      { id: "is_active", column: "is_active", direction: "desc" },
      { id: "name", column: "name", direction: "asc" },
    ],
    sortPersistKey: "products_sort",
    persistKey: "products_search",
    pageSize: 50,
  })

  const handleOpenDialog = (product: any = null, isViewOnly = false) => {
    setViewOnly(isViewOnly)
    if (product) {
      setEditingProduct(product)
      setFormData({
        sku: product.sku,
        name: product.name,
        base_price: product.base_price,
        is_active: product.is_active ?? true,
      })
    } else {
      if (!canInsert) return
      setEditingProduct(null)
      setFormData({ sku: "", name: "", base_price: 0, is_active: true })
    }
    setIsOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (isSubmitting) return

    // Validate required fields
    if (!formData.name?.trim()) {
      notify.error("Validation Error", "Product name is required.")
      return
    }
    if (!formData.sku?.trim()) {
      notify.error("Validation Error", "SKU is required.")
      return
    }

    setIsSubmitting(true)

    const payload = { ...formData }

    try {
      if (editingProduct) {
        const { error } = await supabase
          .from("products")
          .update(payload)
          .eq("id", editingProduct.id)
        if (error) throw error
        setUpdatedRowId(editingProduct.id)
        notify.success(
          dict.MSG_UPDATE_SUCCESS.replace("%data%", `[${formData.name}]`),
          dict.MSG_SUCCESS_UPDATE_DESC_NO_COMPANY.replace(
            "%entity%",
            `product [${formData.name}]`
          ),
          undefined,
          true
        )
      } else {
        const { data, error } = await supabase
          .from("products")
          .insert([payload])
          .select()
          .single()
        if (error) throw error
        setUpdatedRowId(data?.id ?? null)
        notify.success(
          dict.MSG_SAVE_SUCCESS.replace("%data%", `[${formData.name}]`),
          dict.MSG_SUCCESS_SAVE_DESC_NO_COMPANY.replace(
            "%entity%",
            `product [${formData.name}]`
          ),
          undefined,
          true
        )
      }
      setIsOpen(false)
      refresh()
    } catch (err: any) {
      console.error("Products: Save error:", err)
      notify.error(
        dict.MSG_SAVE_FAILED.replace("%data%", `[${formData.name}]`),
        err.message || "An unexpected error occurred"
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    const product = products.find((p) => p.id === id)
    if (!product) return
    setDeleteConfirm({ id: product.id, name: product.name })
  }

  const confirmDelete = async () => {
    if (!deleteConfirm) return
    try {
      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", deleteConfirm.id)
      if (error) throw error
      notify.deleted(
        dict.MSG_DELETE_SUCCESS.replace("%data%", `[${deleteConfirm.name}]`),
        dict.MSG_SUCCESS_DELETE_DESC_NO_COMPANY.replace(
          "%entity%",
          `product [${deleteConfirm.name}]`
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
          <Package className="mr-2 inline-block size-5 text-primary" />
          {dict.TITLE_PRODUCTS}
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
                title={dict.TITLE_ADD_PRODUCT}
                aria-label={dict.TITLE_ADD_PRODUCT}
                className="md:h-9 md:w-auto md:gap-1.5 md:px-2.5"
              >
                <Plus className="size-4" />
                <span className="hidden md:inline">
                  {dict.TITLE_ADD_PRODUCT}
                </span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:w-[350px]">
              <DialogHeader>
                <DialogTitle>
                  <Package className="mr-2 inline-block size-5" />
                  {viewOnly
                    ? formData.name
                    : editingProduct
                      ? dict.TITLE_EDIT_PRODUCT
                      : dict.TITLE_ADD_PRODUCT}
                </DialogTitle>
              </DialogHeader>
              <form
                onSubmit={handleSubmit}
                id="products-form"
                className="relative max-h-[70vh] overflow-y-auto"
              >
                <div
                  className={cn(
                    `relative flex w-full flex-col gap-6 p-5 ${viewOnly ? "rounded-b-xl border-2 border-orange-500" : ""}`
                  )}
                >
                  {viewOnly && <div className="absolute inset-0 z-20"></div>}
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="sku">
                      {dict.LABEL_SKU}
                      <span className="ml-0.5 text-destructive">*</span>
                    </Label>
                    <div className="flex items-center gap-3">
                      <Input
                        id="sku"
                        value={formData.sku}
                        onChange={(e) =>
                          setFormData({ ...formData, sku: e.target.value })
                        }
                        placeholder="OIL-001"
                        className="flex-1"
                        required
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
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="name">
                      {dict.LABEL_PRODUCT_NAME}
                      <span className="ml-0.5 text-destructive">*</span>
                    </Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      placeholder="Diesel Premium"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="base_price">{dict.LABEL_BASE_PRICE}</Label>
                    <NumberInput
                      id="base_price"
                      value={formData.base_price}
                      onChange={(val) =>
                        setFormData({ ...formData, base_price: val })
                      }
                      leftBadge={SITE_CONFIG.currencySymbol}
                      rightBadge="/ L"
                      required
                    />
                  </div>
                </div>
              </form>
              {!viewOnly && (
                <DialogFooter>
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
                    form="products-form"
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
              <TableHead className="px-7">{dict.LABEL_SKU}</TableHead>
              <TableHead className="max-md:hidden">
                {dict.LABEL_NAME}
              </TableHead>
              <TableHead className="text-right max-md:hidden">
                {dict.LABEL_BASE_PRICE}
              </TableHead>
              <TableHead className="text-right"> </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="p-0">
                  <SectionLoader />
                </TableCell>
              </TableRow>
            ) : (
              <>
                {products.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center">
                      {dict.NO_DATA}
                    </TableCell>
                  </TableRow>
                ) : (
                  products.map((product) => (
                    <TableRow
                      key={product.id}
                      className={cn(
                        "group cursor-pointer",
                        updatedRowId === product.id && "animate-row-highlight"
                      )}
                      onDoubleClick={() => handleOpenDialog(product, true)}
                      onAnimationEnd={() => {
                        if (updatedRowId === product.id) setUpdatedRowId(null)
                      }}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center justify-between gap-3 md:hidden">
                          <div className="flex min-w-0 items-center gap-3">
                            <div
                              className={cn(
                                "size-2 shrink-0 rounded-full",
                                product.is_active
                                  ? "bg-green-500"
                                  : "bg-muted-foreground/30"
                              )}
                            />
                            <span className="truncate">{product.name}</span>
                          </div>
                          <span className="shrink-0 font-mono text-muted-foreground">
                            {formatCurrency(
                              product.base_price,
                              lang === "id" ? "id-ID" : "en-US"
                            )}
                          </span>
                        </div>
                        <div className="hidden items-center gap-3 md:flex">
                          <div
                            className={cn(
                              "size-2 shrink-0 rounded-full",
                              product.is_active
                                ? "bg-green-500"
                                : "bg-muted-foreground/30"
                            )}
                          />
                          <span className="font-mono">{product.sku}</span>
                        </div>
                      </TableCell>
                      <TableCell className="max-md:hidden">
                        {product.name}
                      </TableCell>
                      <TableCell className="max-md:hidden text-right font-mono">
                        {formatCurrency(
                          product.base_price,
                          lang === "id" ? "id-ID" : "en-US"
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="table_action"
                            size="sm"
                            onClick={() => handleOpenDialog(product)}
                            disabled={!canEdit}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          {canDelete && (
                            <Button
                              variant="table_action"
                              size="sm"
                              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => handleDelete(product.id)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </>
            )}

            {/* Infinite Scroll Sentinel & Loader */}
            <TableRow ref={sentinelRef} className="border-0">
              <TableCell colSpan={4} className="overflow-hidden border-0 p-0">
                {isLoadingMore && (
                  <div className="relative h-24 w-full">
                    <SectionLoader />
                  </div>
                )}
                {!hasMore && products.length > 0 && !isLoading && (
                  <div className="py-3 text-center text-xs text-danger/70 select-none">
                    — End of data —
                  </div>
                )}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>

      <DeleteConfirmationDialog
        isOpen={deleteConfirm !== null}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        onConfirm={confirmDelete}
        title={dict.TITLE_DELETE || "Confirm Delete"}
        description={
          dict.MSG_DELETE_CONFIRM?.split("%data%")[0] ||
          "Are you sure you want to delete this item? This action cannot be undone."
        }
        dataName={deleteConfirm?.name}
        confirmText={dict.BUTTON_DELETE || "Delete"}
        cancelText={dict.BUTTON_CANCEL || "Cancel"}
        variant="destructive"
      />
    </div>
  )
}
