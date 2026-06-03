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
import { Save, X, Plus, Package, Search, Pencil } from "lucide-react"
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
import { Switch } from "@/components/ui/switch"

import { cn } from "@/lib/utils"

import { SectionLoader } from "@/components/section-loader"
import { notify } from "@/lib/notifications"
import { usePersistedState } from "@/hooks/use-persisted-state"
import { NumberInput } from "@/components/number-input"

import { formatCurrency } from "@/lib/formatters"
import { ButtonLoader } from "@/components/button-loader"

export default function ProductsPage() {
  const { dict, config, lang } = useDictionary()
  const supabase = createClient()
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isOpen, setIsOpen] = usePersistedState("products_dialog_open", false)
  const [editingProduct, setEditingProduct] = usePersistedState<any>("products_editing_data", null)
  const [searchQuery, setSearchQuery] = usePersistedState("products_search", "")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [formData, setFormData] = usePersistedState("products_form_data", {
    sku: "",
    name: "",
    base_price: 0,
    is_active: true
  })

  async function fetchProducts() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order('is_active', { ascending: false })
        .order('created_at', { ascending: false })

      if (error) {
        console.error("Products: Fetch error:", error)
        notify.error("Data Fetch Failed", error.message)
        setProducts([])
      } else if (data) {
        setProducts(data)
      }
    } catch (err) {
      console.error("Products: Unexpected fetch exception:", err)
      setProducts([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProducts()
  }, [])

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
        const { error } = await supabase.from("products").update(payload).eq("id", editingProduct.id)
        if (error) throw error
        notify.success(dict.MSG_UPDATE_SUCCESS.replace("%data%", ""), dict.MSG_UPDATE_SUCCESS.replace("%data%", `[${formData.name}]`))
      } else {
        const { error } = await supabase.from("products").insert([payload])
        if (error) throw error
        notify.success(dict.MSG_SAVE_SUCCESS.replace("%data%", ""), dict.MSG_SAVE_SUCCESS.replace("%data%", `[${formData.name}]`))
      }
      setIsOpen(false)
      fetchProducts()
    } catch (err: any) {
      console.error("Products: Save error:", err)
      notify.error(dict.MSG_SAVE_FAILED, err.message || "An unexpected error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title"><Package className="size-5 mr-2 inline-block text-primary" />{dict.TITLE_PRODUCTS}</h1>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
              <Plus data-icon="inline-start" />
              {dict.TITLE_ADD_PRODUCT}
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[350px]">
            <DialogHeader>
              <DialogTitle>
                {editingProduct ? dict.TITLE_EDIT_PRODUCT : dict.TITLE_ADD_PRODUCT}
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
                  className="text-right font-mono"
                  value={formData.base_price}
                  onChange={(val) => setFormData({ ...formData, base_price: val })}
                  required
                />
              </div>


            </form>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)} className="flex-1">
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

      <div className="action-bar">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder={dict.SEARCH_PLACEHOLDER}
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <Card className="data-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{dict.LABEL_NAME}</TableHead>
              <TableHead>{dict.LABEL_SKU}</TableHead>
              <TableHead className="text-right">{dict.LABEL_BASE_PRICE}</TableHead>
              <TableHead className="text-right">{dict.LABEL_ACTIONS}</TableHead>
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
              (() => {
                const filtered = products.filter(p =>
                  p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  p.sku.toLowerCase().includes(searchQuery.toLowerCase())
                )

                if (filtered.length === 0) {
                  return (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8">{dict.NO_DATA}</TableCell>
                    </TableRow>
                  )
                }

                return filtered.map((product) => (
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
                      <Button
                        variant="table_action"
                        size="sm"
                        onClick={() => handleOpenDialog(product)}
                      >
                        <Pencil className="size-4" />
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