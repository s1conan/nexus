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
import { Save, X, Plus, Package, Search, Pencil, RefreshCw, AlertCircle, Banknote, Trash2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { SummaryCard } from "@/components/summary-card"
import { ConfirmationDialog } from "@/components/confirmation-dialog"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger
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
import { useDebounce } from "@/hooks/use-debounce"

const PAGE_SIZE = 50

export default function ProductsPage() {
  const { dict, lang } = useDictionary()
  const supabase = createClient()
  const { hasPermission, profile, loading: authLoading } = useAuth()

  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [offset, setOffset] = useState(0)

  const [isOpen, setIsOpen] = usePersistedState("products_dialog_open", false)
  const [editingProduct, setEditingProduct] = usePersistedState<any>("products_editing_data", null)
  const [searchQuery, setSearchQuery] = usePersistedState("products_search", "")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string, name: string } | null>(null)
  const debouncedSearchQuery = useDebounce(searchQuery, 300)

  const observerTarget = useRef(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [formData, setFormData] = usePersistedState("products_form_data", {
    sku: "",
    name: "",
    base_price: 0,
    is_active: true
  })

  // Permission Checks
  const canView = hasPermission("products", "view")
  const canInsert = hasPermission("products", "insert")
  const canEdit = hasPermission("products", "edit")
  const canDelete = hasPermission("products", "delete")

  const fetchProducts = useCallback(async (isInitial = false) => {
    if (isInitial) {
      setLoading(true)
      setOffset(0)
    } else {
      setLoadingMore(true)
    }

    try {
      const currentOffset = isInitial ? 0 : offset
      let query = supabase
        .from("products")
        .select("*")
        .order('is_active', { ascending: false })
        .order('name', { ascending: true })
        .range(currentOffset, currentOffset + PAGE_SIZE - 1)

      if (debouncedSearchQuery) {
        query = query.or(`name.ilike.%${debouncedSearchQuery}%,sku.ilike.%${debouncedSearchQuery}%`)
      }

      const { data, error } = await query

      if (error) {
        console.error("Products: Fetch error:", error)
        notify.error("Data Fetch Failed", error.message)
      } else if (data) {
        if (isInitial) {
          setProducts(data)
        } else {
          setProducts(prev => {
            const newItems = data.filter((item: any) => !prev.some(p => p.id === item.id))
            return [...prev, ...newItems]
          })
        }
        setHasMore(data.length === PAGE_SIZE)
        setOffset(currentOffset + data.length)
      }
    } catch (err) {
      console.error("Products: Unexpected fetch exception:", err)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [supabase, offset, debouncedSearchQuery])

  useEffect(() => {
    fetchProducts(true)
  }, [debouncedSearchQuery])

  // Infinite Scroll Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          fetchProducts(false)
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
  }, [fetchProducts, hasMore, loading, loadingMore])

  const handleRefresh = () => {
    fetchProducts(true)
  }

  const handleOpenDialog = (product: any = null) => {
    if (product) {
      setEditingProduct(product)
      setFormData({
        sku: product.sku,
        name: product.name,
        base_price: product.base_price,
        is_active: product.is_active ?? true
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
    if (isSubmitting) return;
    setIsSubmitting(true);

    const payload = { ...formData }

    try {
      if (editingProduct) {
        const { data, error } = await supabase.from("products").update(payload).eq("id", editingProduct.id).select().single()
        if (error) throw error
        setProducts(prev => prev.map(p => p.id === editingProduct.id ? data : p))
        notify.success(dict.MSG_UPDATE_SUCCESS.replace("%data%", ""), dict.MSG_UPDATE_SUCCESS.replace("%data%", `[${formData.name}]`))
      } else {
        const { data, error } = await supabase.from("products").insert([payload]).select().single()
        if (error) throw error
        setProducts(prev => [data, ...prev])
        notify.success(dict.MSG_SAVE_SUCCESS.replace("%data%", ""), dict.MSG_SAVE_SUCCESS.replace("%data%", `[${formData.name}]`))
      }
      fetchStats()
      setIsOpen(false)
    } catch (err: any) {
      console.error("Products: Save error:", err)
      notify.error(dict.MSG_SAVE_FAILED, err.message || "An unexpected error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    const product = products.find(p => p.id === id)
    if (!product) return
    setDeleteConfirm({ id: product.id, name: product.name })
  }

  const confirmDelete = async () => {
    if (!deleteConfirm) return
    try {
      const { error } = await supabase.from("products").delete().eq("id", deleteConfirm.id)
      if (error) throw error
      notify.success(dict.MSG_UPDATE_SUCCESS.replace("%data%", dict.TITLE_PRODUCTS || "Product"))
      setProducts(prev => prev.filter(p => p.id !== deleteConfirm.id))
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
          <Package className="size-5 mr-2 inline-block text-primary" />
          {dict.TITLE_PRODUCTS}
        </h1>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handleRefresh} disabled={loading || loadingMore} title="Refresh Data">
            <RefreshCw className={cn("size-4", (loading || loadingMore) && "animate-spin")} />
          </Button>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()} disabled={!canInsert}>
                <Plus data-icon="inline-start" />
                {dict.TITLE_ADD_PRODUCT}
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[350px]">
              <DialogHeader>
                <DialogTitle>
                  <Package className="size-5 mr-2 inline-block" />{editingProduct ? dict.TITLE_EDIT_PRODUCT : dict.TITLE_ADD_PRODUCT}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} id="products-form" className="flex flex-col gap-4 p-5">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="sku">{dict.LABEL_SKU}</Label>
                  <div className="flex items-center gap-3">
                    <Input
                      id="sku"
                      value={formData.sku}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                      placeholder="OIL-001"
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
                <div className="flex flex-col gap-2">
                  <Label htmlFor="name">{dict.LABEL_PRODUCT_NAME}</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Diesel Premium"
                    required
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="base_price">{dict.LABEL_BASE_PRICE}</Label>
                  <NumberInput
                    id="base_price"
                    value={formData.base_price}
                    onChange={(val) => setFormData({ ...formData, base_price: val })}
                    leftBadge="Rp"
                    rightBadge="/ L"
                    required
                  />
                </div>
              </form>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                  <X data-icon="inline-start" />
                  {dict.BUTTON_CANCEL}
                </Button>
                <Button type="submit" form="products-form" disabled={isSubmitting}  >
                  {isSubmitting ? <ButtonLoader /> : <Save data-icon="inline-start" />}
                  {dict.BUTTON_SAVE}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="action-bar shrink-0">
        <div className="relative flex-1 max-w-sm">
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
              <TableHead>{dict.LABEL_SKU}</TableHead>
              <TableHead className="text-right">{dict.LABEL_BASE_PRICE}</TableHead>
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
                {products.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8">{dict.NO_DATA}</TableCell>
                  </TableRow>
                ) : (
                  products.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "size-2 rounded-full",
                            product.is_active ? "bg-green-500" : "bg-muted-foreground/30"
                          )} />
                          <span>{product.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>{product.sku}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(product.base_price, lang === 'id' ? 'id-ID' : 'en-US')}</TableCell>
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
            <TableRow ref={observerTarget} className="border-0">
              <TableCell colSpan={4} className="p-0 border-0 overflow-hidden">
                {loadingMore && (
                  <div className="relative h-24 w-full">
                    <SectionLoader />
                  </div>
                )}
                {!hasMore && products.length > 0 && !loading && (
                  <div className="text-center py-3 text-xs text-danger/70 select-none">
                    — End of data —
                  </div>
                )}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>

      <ConfirmationDialog
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
