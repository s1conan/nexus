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
  TableRow
} from "@/components/ui/table"
import { Card } from "@/components/ui/card"
import {
  Search,
  Box,
  Warehouse,
  AlertCircle,
  TrendingUp,
  DollarSign,
  Package
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { SectionLoader } from "@/components/section-loader"
import { notify } from "@/lib/notifications"

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
        .select("*, supplier:companies(id, name), product:products(id, sku, name)")
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
    return inventory.filter(item =>
      (item.supplier?.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.product?.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.product?.sku || "").toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [inventory, searchQuery])

  const totals = useMemo(() => {
    return filteredInventory.reduce((acc, item) => {
      acc.stock += item.current_stock
      acc.value += item.total_inventory_value
      return acc
    }, { stock: 0, value: 0 })
  }, [filteredInventory])

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">
          <Warehouse className="size-5 mr-2 inline-block text-primary" />
          {dict.MENU_REPORTS_INVENTORY || "Inventory Report"}
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="p-4 flex items-center gap-4">
          <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <Package className="size-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">{dict.LABEL_TOTAL_VOLUME || "Total Stock"}</p>
            <p className="text-2xl font-black">{totals.stock.toLocaleString()} L</p>
          </div>
        </Card>

        {canViewValue && (
          <Card className="p-4 flex items-center gap-4">
            <div className="size-10 rounded-full bg-green-100 flex items-center justify-center text-green-700">
              <DollarSign className="size-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">{dict.LABEL_INVENTORY_VALUE || "Inventory Value"}</p>
              <p className="text-2xl font-black">Rp {totals.value.toLocaleString()}</p>
            </div>
          </Card>
        )}

        <Card className="p-4 flex items-center gap-4">
          <div className="size-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700">
            <Warehouse className="size-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">{dict.LABEL_ACTIVE_WAREHOUSES || "Active Warehouses"}</p>
            <p className="text-2xl font-black">{new Set(filteredInventory.map(i => i.supplier_id)).size}</p>
          </div>
        </Card>
      </div>

      <div className="action-bar gap-4">
        <div className="relative flex-1 w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder={dict.PLACEHOLDER_SEARCH || "Search..."}
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Button variant="outline" onClick={fetchInventory} className="h-10 shrink-0">
          <TrendingUp className="size-4 mr-2" />
          {dict.BUTTON_REFRESH || "Refresh"}
        </Button>
      </div>

      <Card className="data-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="px-7">{dict.LABEL_TYPE_SUPPLIER} / {dict.MENU_GROUP_MASTER}</TableHead>
              <TableHead>{dict.LABEL_PRODUCT_NAME}</TableHead>
              <TableHead className="text-right">{dict.LABEL_TOTAL_VOLUME || "Stock"}</TableHead>
              {canViewValue && (
                <>
                  <TableHead className="text-right">{dict.LABEL_AVG_COST || "HPP"}</TableHead>
                  <TableHead className="text-right">{dict.LABEL_INVENTORY_VALUE || "Total Value"}</TableHead>
                </>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={canViewValue ? 5 : 3} className="p-0"><SectionLoader /></TableCell>
              </TableRow>
            ) : filteredInventory.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canViewValue ? 5 : 3} className="text-center py-10 text-muted-foreground">
                  {dict.NO_DATA}
                </TableCell>
              </TableRow>
            ) : filteredInventory.map((item, idx) => (
              <TableRow key={idx}>
                <TableCell className="px-7">
                  <div className="flex flex-col">
                    <span className="font-bold text-sm">{item.supplier?.name}</span>
                    <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-tighter">{dict.LABEL_WAREHOUSE_ID || "Warehouse ID"}: {item.supplier_id.split('-')[0]}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{item.product?.name}</span>
                    <span className="text-xs text-muted-foreground font-mono">{item.product?.sku}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <span className={cn(
                    "font-black text-base",
                    item.current_stock < 1000 ? "text-amber-600" : "text-foreground"
                  )}>
                    {item.current_stock.toLocaleString()} L
                  </span>
                </TableCell>
                {canViewValue && (
                  <>
                    <TableCell className="text-right text-sm font-medium text-muted-foreground">
                      Rp {item.weighted_average_cost.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-bold text-green-700">
                        Rp {item.total_inventory_value.toLocaleString()}
                      </span>
                    </TableCell>
                  </>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
