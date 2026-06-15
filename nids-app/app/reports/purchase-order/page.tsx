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
  ShoppingBag,
  AlertCircle,
  TrendingUp,
  Package,
  Calendar,
  Filter,
  DollarSign
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { SectionLoader } from "@/components/section-loader"
import { notify } from "@/lib/notifications"
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from "date-fns"
import { Button } from "@/components/ui/button"
import { NumberInput } from "@/components/number-input"

export default function PurchaseOrderReportPage() {
  const { dict } = useDictionary()
  const { hasPermission, loading: authLoading } = useAuth()
  const supabase = createClient()

  const [pos, setPos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  // Date Filters
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"))
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"))

  async function fetchPOs() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select("*, supplier:companies(id, name), product:products(id, name, sku)")
        .order("po_date", { ascending: false })

      if (error) throw error
      setPos(data || [])
    } catch (err: any) {
      notify.error(dict.MSG_DATA_FETCH_FAILED, err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPOs()
  }, [])

  const filteredPOs = useMemo(() => {
    return pos.filter(p => {
      const dateMatch = isWithinInterval(parseISO(p.po_date), {
        start: parseISO(startDate),
        end: parseISO(endDate)
      })

      const searchMatch =
        p.po_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.supplier?.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.product?.name || "").toLowerCase().includes(searchQuery.toLowerCase())

      return dateMatch && searchMatch
    })
  }, [pos, searchQuery, startDate, endDate])

  const stats = useMemo(() => {
    const totalAmount = filteredPOs.reduce((sum, p) => sum + (p.quantity * p.unit_price || 0), 0)
    const totalQty = filteredPOs.reduce((sum, p) => sum + (p.quantity || 0), 0)
    return { totalAmount, totalQty, count: filteredPOs.length }
  }, [filteredPOs])

  const canViewReport = hasPermission("purchase-order", "view")

  if (!canViewReport && !loading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="text-center space-y-2">
          <AlertCircle className="size-8 text-destructive mx-auto" />
          <h2 className="text-lg font-semibold">{dict.MSG_ACCESS_DENIED}</h2>
          <p className="text-sm text-muted-foreground">{dict.MSG_NO_PERMISSION}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">
          <ShoppingBag className="size-5 mr-2 inline-block text-primary" />
          {dict.MENU_REPORTS_PO || "PO Report"}
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="p-4 flex items-center gap-4 border-l-4 border-l-primary">
          <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <DollarSign className="size-5" />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">{dict.LABEL_TOTAL_AMOUNT || "Total Amount"}</p>
            <p className="text-xl font-black">Rp {stats.totalAmount.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">{stats.count} {dict.MENU_PURCHASE_ORDER}</p>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-4 border-l-4 border-l-amber-500">
          <div className="size-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-700">
            <Package className="size-5" />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">{dict.LABEL_QUANTITY || "Quantity"}</p>
            <p className="text-xl font-black">{stats.totalQty.toLocaleString()} L</p>
            <p className="text-[10px] text-muted-foreground">Total volume ordered</p>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-4 border-l-4 border-l-blue-500">
          <div className="size-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700">
            <TrendingUp className="size-5" />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">{dict.LABEL_STATUS || "Status"}</p>
            <p className="text-xl font-black">{dict.LABEL_ACTIVE || "Active"}</p>
            <p className="text-[10px] text-muted-foreground">Active procurement summary</p>
          </div>
        </Card>
      </div>

      <div className="action-bar items-end gap-4">
        <div className="grid gap-1.5 flex-1 max-w-sm">
          <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">{dict.PLACEHOLDER_SEARCH || "Search"}</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder={`${dict.LABEL_PO_NUMBER}, ${dict.LABEL_COMPANY_NAME}...`}
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-1.5 w-40">
          <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">{dict.LABEL_FROM_DATE || "From"}</label>
          <div className="relative">
            <Calendar className="absolute left-2.5 top-2.5 size-4 text-muted-foreground z-10" />
            <Input
              type="date"
              className="pl-8"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-1.5 w-40">
          <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">{dict.LABEL_TO_DATE || "To"}</label>
          <div className="relative">
            <Calendar className="absolute left-2.5 top-2.5 size-4 text-muted-foreground z-10" />
            <Input
              type="date"
              className="pl-8"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        <Button variant="outline" onClick={fetchPOs} className="h-10">
          <Filter className="size-4 mr-2" />
          {dict.BUTTON_REFRESH || "Refresh"}
        </Button>
      </div>

      <Card className="data-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="px-7">{dict.LABEL_PO_NUMBER}</TableHead>
              <TableHead>{dict.LABEL_PO_DATE}</TableHead>
              <TableHead>{dict.LABEL_COMPANY_NAME}</TableHead>
              <TableHead>{dict.LABEL_PRODUCT_NAME}</TableHead>
              <TableHead className="text-right">{dict.LABEL_QUANTITY}</TableHead>
              <TableHead className="text-right">{dict.LABEL_TOTAL_AMOUNT || "Total"}</TableHead>
              <TableHead>{dict.LABEL_STATUS}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="p-0"><SectionLoader /></TableCell>
              </TableRow>
            ) : filteredPOs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                  {dict.NO_DATA}
                </TableCell>
              </TableRow>
            ) : filteredPOs.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="px-7">
                  <span className="font-bold text-sm font-mono">{p.po_number}</span>
                </TableCell>
                <TableCell className="text-sm">
                  {format(parseISO(p.po_date), "dd MMM yyyy")}
                </TableCell>
                <TableCell>
                  <span className="font-medium text-sm">{p.supplier?.name}</span>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {p.product?.name}
                </TableCell>
                <TableCell className="text-right font-bold text-sm">
                  {p.quantity?.toLocaleString()} L
                </TableCell>
                <TableCell className="text-right">
                  <span className="font-black text-sm">
                    Rp {(p.quantity * p.unit_price)?.toLocaleString()}
                  </span>
                </TableCell>
                <TableCell>
                  <span className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                    p.status === 'Completed' ? "bg-green-100 text-green-700" :
                      p.status === 'Cancelled' ? "bg-red-100 text-red-700" :
                        p.status === 'Processing' ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-700"
                  )}>
                    {p.status || 'Draft'}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
