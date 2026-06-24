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
import { SITE_CONFIG } from "@/lib/site-content"

export default function SalesOrderReportPage() {
  const { dict } = useDictionary()
  const { hasPermission, loading: authLoading } = useAuth()
  const supabase = createClient()

  const statusStyles: Record<string, string> = {
    Fulfilled: "bg-green-100 text-green-700",
    Partial: "bg-purple-100 text-purple-700",
    Sent: "bg-amber-100 text-amber-700",
    Cancelled: "bg-red-100 text-red-700",
    Draft: "bg-zinc-100 text-zinc-700",
  }

  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  // Date Filters
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"))
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"))

  async function fetchOrders() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("sales_orders") // table name remains same
        .select("*, supplier:companies(id, name), product:products(id, name, sku)")
        .order("so_date", { ascending: false })

      if (error) throw error
      setOrders(data || [])
    } catch (err: any) {
      notify.error(dict.MSG_DATA_FETCH_FAILED, err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrders()
  }, [])

  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const dateMatch = isWithinInterval(parseISO(o.so_date), {
        start: parseISO(startDate),
        end: parseISO(endDate)
      })

      const searchMatch =
        o.so_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (o.supplier?.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (o.product?.name || "").toLowerCase().includes(searchQuery.toLowerCase())

      return dateMatch && searchMatch
    })
  }, [orders, searchQuery, startDate, endDate])

  const stats = useMemo(() => {
    const totalAmount = filteredOrders.reduce((sum, o) => sum + (o.quantity * o.unit_price || 0), 0)
    const totalQty = filteredOrders.reduce((sum, o) => sum + (o.quantity || 0), 0)
    return { totalAmount, totalQty, count: filteredOrders.length }
  }, [filteredOrders])

  const canViewReport = hasPermission("sales-order", "view")

  if (!canViewReport && !loading && !authLoading) {
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
      <div className="page-header shrink-0">
        <h1 className="page-title">
          <ShoppingBag className="size-5 mr-2 inline-block text-primary" />
          {dict.MENU_REPORTS_SO}
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 shrink-0">
        <Card className="p-4 flex items-center gap-4 border-l-4 border-l-primary">
          <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <DollarSign className="size-5" />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">{dict.LABEL_TOTAL_AMOUNT || "Total Amount"}</p>
            <p className="text-xl font-black">{SITE_CONFIG.currencySymbol} {stats.totalAmount.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">{stats.count} {dict.MENU_SALES_ORDER}</p>
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
            <p className="text-[10px] text-muted-foreground">Active sales summary</p>
          </div>
        </Card>
      </div>

      <div className="action-bar items-end gap-4 shrink-0">
        <div className="grid gap-1.5 flex-1 max-w-sm">
          <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">{dict.PLACEHOLDER_SEARCH || "Search"}</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder={`${dict.LABEL_SO_NUMBER}, ${dict.LABEL_COMPANY_NAME}...`}
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

        <Button variant="outline" onClick={fetchOrders} className="h-10">
          <Filter className="size-4 mr-2" />
          {dict.BUTTON_REFRESH || "Refresh"}
        </Button>
      </div>

      <Card className="data-card flex-1 overflow-auto custom-scrollbar">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm">
            <TableRow>
              <TableHead className="px-7">{dict.LABEL_SO_NUMBER}</TableHead>
              <TableHead>{dict.LABEL_SO_DATE}</TableHead>
              <TableHead>{dict.LABEL_COMPANY_NAME}</TableHead>
              <TableHead>{dict.LABEL_PRODUCT_NAME}</TableHead>
              <TableHead className="text-right">{dict.LABEL_QUANTITY}</TableHead>
              <TableHead className="text-right">{dict.LABEL_GRAND_TOTAL}</TableHead>
              <TableHead>{dict.LABEL_STATUS}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="p-0"><SectionLoader /></TableCell>
              </TableRow>
            ) : filteredOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                  {dict.NO_DATA}
                </TableCell>
              </TableRow>
            ) : filteredOrders.map((o) => (
              <TableRow key={o.id}>
                <TableCell className="px-7">
                  <span className="font-bold text-sm font-mono">{o.so_number}</span>
                </TableCell>
                <TableCell className="text-sm">
                  {format(parseISO(o.so_date), "dd MMM yyyy")}
                </TableCell>
                <TableCell>
                  <span className="font-medium text-sm">{o.supplier?.name}</span>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {o.product?.name}
                </TableCell>
                <TableCell className="text-right font-bold text-sm">
                  {o.quantity?.toLocaleString()} L
                </TableCell>
                <TableCell className="text-right">
                  <span className="font-black text-sm text-primary">
                    {SITE_CONFIG.currencySymbol} {Number(o.total_amount || (o.quantity * o.unit_price)).toLocaleString()}
                  </span>
                </TableCell>
                <TableCell>
                  <span className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                    statusStyles[o.status || 'Draft']
                  )}>
                    {o.status || 'Draft'}
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
