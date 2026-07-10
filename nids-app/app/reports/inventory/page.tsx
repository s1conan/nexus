"use client"

import { useState, useEffect, useMemo } from "react"
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
import { Card } from "@/components/ui/card"
import {
  Search,
  Box,
  Warehouse,
  AlertCircle,
  TrendingUp,
  DollarSign,
  Package,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { SectionLoader } from "@/components/section-loader"
import { notify } from "@/lib/notifications"
import { SITE_CONFIG } from "@/lib/site-content"

export default function InventoryReportPage() {
  const { dict } = useDictionary()
  const { hasPermission, loading: authLoading } = useAuth()
  const supabase = createClient()

  const [inventory, setInventory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  // Permission Checks
  const canViewValue = hasPermission("inventory", "print") // Permission to see financial values

  async function fetchInventory() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("supplier_stock_summary")
        .select(
          "*, supplier:companies(id, name), product:products(id, sku, name)"
        )
        .order("supplier_id")

      if (error) throw error
      setInventory(data || [])
    } catch (err: any) {
      notify.error(dict.MSG_DATA_FETCH_FAILED, err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInventory()
  }, [])

  const filteredInventory = useMemo(() => {
    return inventory.filter(
      (item) =>
        (item.supplier?.name || "")
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        (item.product?.name || "")
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        (item.product?.sku || "")
          .toLowerCase()
          .includes(searchQuery.toLowerCase())
    )
  }, [inventory, searchQuery])

  const totals = useMemo(() => {
    return filteredInventory.reduce(
      (acc, item) => {
        acc.stock += item.current_stock
        acc.value += item.total_inventory_value
        return acc
      },
      { stock: 0, value: 0 }
    )
  }, [filteredInventory])

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">
          <Warehouse className="mr-2 inline-block size-5 text-primary" />
          {dict.MENU_REPORTS_INVENTORY || "Inventory Report"}
        </h1>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="flex items-center gap-4 p-4">
          <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Package className="size-5" />
          </div>
          <div>
            <p className="text-center text-xs font-bold tracking-wider text-muted-foreground uppercase">
              {dict.LABEL_TOTAL_VOLUME || "Total Stock"}
            </p>
            <p className="text-center text-2xl font-black">
              {totals.stock.toLocaleString()} L
            </p>
          </div>
        </Card>

        {canViewValue && (
          <Card className="flex items-center gap-4 p-4">
            <div className="flex size-10 items-center justify-center rounded-full bg-green-100 text-green-700">
              <DollarSign className="size-5" />
            </div>
            <div>
              <p className="text-center text-xs font-bold tracking-wider text-muted-foreground uppercase">
                {dict.LABEL_INVENTORY_VALUE || "Inventory Value"}
              </p>
              <p className="text-center text-2xl font-black">
                {SITE_CONFIG.currencySymbol} {totals.value.toLocaleString()}
              </p>
            </div>
          </Card>
        )}

        <Card className="flex items-center gap-4 p-4">
          <div className="flex size-10 items-center justify-center rounded-full bg-blue-100 text-blue-700">
            <Warehouse className="size-5" />
          </div>
          <div>
            <p className="text-center text-xs font-bold tracking-wider text-muted-foreground uppercase">
              {dict.LABEL_ACTIVE_WAREHOUSES || "Active Warehouses"}
            </p>
            <p className="text-center text-2xl font-black">
              {new Set(filteredInventory.map((i) => i.supplier_id)).size}
            </p>
          </div>
        </Card>
      </div>

      <div className="action-bar gap-4">
        <div className="relative w-full max-w-sm flex-1">
          <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder={dict.PLACEHOLDER_SEARCH || "Search..."}
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Button
          variant="outline"
          onClick={fetchInventory}
          className="h-10 shrink-0"
        >
          <TrendingUp className="mr-2 size-4" />
          {dict.BUTTON_REFRESH || "Refresh"}
        </Button>
      </div>

      <Card className="data-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="px-7">
                {dict.LABEL_TYPE_SUPPLIER} / {dict.MENU_GROUP_MASTER}
              </TableHead>
              <TableHead>{dict.LABEL_PRODUCT_NAME}</TableHead>
              <TableHead className="text-right">
                {dict.LABEL_TOTAL_VOLUME || "Stock"}
              </TableHead>
              {canViewValue && (
                <>
                  <TableHead className="text-right">
                    {dict.LABEL_AVG_COST || "HPP"}
                  </TableHead>
                  <TableHead className="text-right">
                    {dict.LABEL_INVENTORY_VALUE || "Total Value"}
                  </TableHead>
                </>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={canViewValue ? 5 : 3} className="p-0">
                  <SectionLoader />
                </TableCell>
              </TableRow>
            ) : filteredInventory.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={canViewValue ? 5 : 3}
                  className="py-10 text-center text-muted-foreground"
                >
                  {dict.NO_DATA}
                </TableCell>
              </TableRow>
            ) : (
              filteredInventory.map((item, idx) => (
                <TableRow key={idx}>
                  <TableCell className="px-7">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold">
                        {item.supplier?.name}
                      </span>
                      <span className="font-mono text-[10px] tracking-tighter text-muted-foreground uppercase">
                        {dict.LABEL_WAREHOUSE_ID || "Warehouse ID"}:{" "}
                        {item.supplier_id.split("-")[0]}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{item.product?.name}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {item.product?.sku}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={cn(
                        "text-base font-black",
                        item.current_stock < 1000
                          ? "text-amber-600"
                          : "text-foreground"
                      )}
                    >
                      {item.current_stock.toLocaleString()} L
                    </span>
                  </TableCell>
                  {canViewValue && (
                    <>
                      <TableCell className="text-right text-sm font-medium text-muted-foreground">
                        {SITE_CONFIG.currencySymbol}{" "}
                        {item.weighted_average_cost.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-bold text-green-700">
                          {SITE_CONFIG.currencySymbol}{" "}
                          {item.total_inventory_value.toLocaleString()}
                        </span>
                      </TableCell>
                    </>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
