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
  Truck,
  AlertCircle,
  TrendingUp,
  Package,
  Calendar,
  Filter,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { SectionLoader } from "@/components/section-loader"
import { notify } from "@/lib/notifications"
import {
  format,
  startOfMonth,
  endOfMonth,
  isWithinInterval,
  parseISO,
} from "date-fns"
import { Button } from "@/components/ui/button"

export default function DeliveryReportPage() {
  const { dict } = useDictionary()
  const { hasPermission, loading: authLoading } = useAuth()
  const supabase = createClient()

  const statusStyles: Record<string, string> = {
    Delivered: "bg-green-100 text-green-700",
    Shipped: "bg-purple-100 text-purple-700",
    Cancelled: "bg-red-100 text-red-700",
    Draft: "bg-zinc-100 text-zinc-700",
  }

  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  // Date Filters
  const [startDate, setStartDate] = useState(
    format(startOfMonth(new Date()), "yyyy-MM-dd")
  )
  const [endDate, setEndDate] = useState(
    format(endOfMonth(new Date()), "yyyy-MM-dd")
  )

  async function fetchDeliveries() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("delivery_orders")
        .select(
          "*, company:companies!delivery_orders_company_id_fkey(id, name), product:products(id, name, sku)"
        )
        .order("shipment_date", { ascending: false })

      if (error) throw error
      setOrders(data || [])
    } catch (err: any) {
      notify.error(dict.MSG_DATA_FETCH_FAILED, err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDeliveries()
  }, [])

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const dateMatch = isWithinInterval(parseISO(o.shipment_date), {
        start: parseISO(startDate),
        end: parseISO(endDate),
      })

      const searchMatch =
        o.do_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (o.company?.name || "")
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        (o.product?.name || "")
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        (o.vehicle_number || "")
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        (o.driver_name || "").toLowerCase().includes(searchQuery.toLowerCase())

      return dateMatch && searchMatch
    })
  }, [orders, searchQuery, startDate, endDate])

  const stats = useMemo(() => {
    const totalVolume = filteredOrders.reduce(
      (sum, o) => sum + (o.quantity || 0),
      0
    )
    const delivered = filteredOrders.filter(
      (o) => o.status === "Delivered"
    ).length
    const shipped = filteredOrders.filter((o) => o.status === "Shipped").length
    const pending = filteredOrders.filter(
      (o) => o.status === "Draft" || !o.status
    ).length

    return {
      totalVolume,
      delivered,
      shipped,
      pending,
      count: filteredOrders.length,
    }
  }, [filteredOrders])

  const canViewReport = hasPermission("delivery-order", "view")

  if (!canViewReport && !loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="space-y-2 text-center">
          <AlertCircle className="mx-auto size-8 text-destructive" />
          <h2 className="text-lg font-semibold">{dict.MSG_ACCESS_DENIED}</h2>
          <p className="text-sm text-muted-foreground">
            {dict.MSG_NO_PERMISSION}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">
          <Truck className="mr-2 inline-block size-5 text-primary" />
          {dict.MENU_SHIPMENTS || "Delivery Report"}
        </h1>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card className="flex items-center gap-4 border-l-4 border-l-primary p-4">
          <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Package className="size-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
              {dict.LABEL_TOTAL_VOLUME || "Total Volume"}
            </p>
            <p className="text-xl font-black">
              {stats.totalVolume.toLocaleString()} L
            </p>
            <p className="text-[10px] text-muted-foreground">
              {stats.count} {dict.MENU_DELIVERY_ORDER || "Deliveries"}
            </p>
          </div>
        </Card>

        <Card className="flex items-center gap-4 border-l-4 border-l-green-500 p-4">
          <div className="flex size-10 items-center justify-center rounded-full bg-green-100 text-green-700">
            <Truck className="size-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
              {dict.LABEL_APPROVED || "Delivered"}
            </p>
            <p className="text-xl font-black">{stats.delivered}</p>
            <p className="text-[10px] text-muted-foreground">
              {dict.MSG_UPDATE_SUCCESS?.replace("%data%", "") ||
                "Successfully completed"}
            </p>
          </div>
        </Card>

        <Card className="flex items-center gap-4 border-l-4 border-l-blue-500 p-4">
          <div className="flex size-10 items-center justify-center rounded-full bg-blue-100 text-blue-700">
            <TrendingUp className="size-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
              {dict.LABEL_IN_TRANSIT || "In Transit"}
            </p>
            <p className="text-xl font-black">{stats.shipped}</p>
            <p className="text-[10px] text-muted-foreground">
              Currently on road
            </p>
          </div>
        </Card>

        <Card className="flex items-center gap-4 border-l-4 border-l-amber-500 p-4">
          <div className="flex size-10 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <Calendar className="size-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
              {dict.LABEL_PENDING || "Pending"}
            </p>
            <p className="text-xl font-black">{stats.pending}</p>
            <p className="text-[10px] text-muted-foreground">
              Draft or Scheduled
            </p>
          </div>
        </Card>
      </div>

      <div className="action-bar items-end gap-4">
        <div className="grid max-w-sm flex-1 gap-1.5">
          <label className="ml-1 text-[10px] font-bold text-muted-foreground uppercase">
            {dict.PLACEHOLDER_SEARCH || "Search"}
          </label>
          <div className="relative">
            <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder={`${dict.LABEL_DO_NUMBER}, ${dict.LABEL_COMPANY_NAME}, ${dict.LABEL_DRIVER_NAME}...`}
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="grid w-40 gap-1.5">
          <label className="ml-1 text-[10px] font-bold text-muted-foreground uppercase">
            {dict.LABEL_FROM_DATE || "From"}
          </label>
          <div className="relative">
            <Calendar className="absolute top-2.5 left-2.5 z-10 size-4 text-muted-foreground" />
            <Input
              type="date"
              className="pl-8"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
        </div>

        <div className="grid w-40 gap-1.5">
          <label className="ml-1 text-[10px] font-bold text-muted-foreground uppercase">
            {dict.LABEL_TO_DATE || "To"}
          </label>
          <div className="relative">
            <Calendar className="absolute top-2.5 left-2.5 z-10 size-4 text-muted-foreground" />
            <Input
              type="date"
              className="pl-8"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        <Button variant="outline" onClick={fetchDeliveries} className="h-10">
          <Filter className="mr-2 size-4" />
          {dict.BUTTON_REFRESH || "Refresh"}
        </Button>
      </div>

      <Card className="data-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="px-7">
                {dict.LABEL_DO_NUMBER || "DO Number"}
              </TableHead>
              <TableHead>
                {dict.LABEL_SHIPMENT_DATE || "Shipment Date"}
              </TableHead>
              <TableHead>
                {dict.LABEL_COMPANY_NAME} / {dict.MENU_PRODUCTS}
              </TableHead>
              <TableHead>{dict.LABEL_LOGISTICS || "Logistics"}</TableHead>
              <TableHead className="text-right">
                {dict.LABEL_QUANTITY || "Quantity"}
              </TableHead>
              <TableHead>{dict.LABEL_STATUS || "Status"}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="p-0">
                  <SectionLoader />
                </TableCell>
              </TableRow>
            ) : filteredOrders.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-10 text-center text-muted-foreground"
                >
                  {dict.NO_DATA}
                </TableCell>
              </TableRow>
            ) : (
              filteredOrders.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="px-7">
                    <span className="font-mono text-sm font-bold">
                      {o.do_number}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">
                    {format(parseISO(o.shipment_date), "dd MMM yyyy")}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">
                        {o.company?.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {o.product?.name}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-xs font-medium">
                        {o.vehicle_number || "-"}
                      </span>
                      <span className="text-[10px] text-muted-foreground uppercase">
                        {o.driver_name || dict.LABEL_NO_AUTH}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-sm font-black">
                      {o.quantity?.toLocaleString()} L
                    </span>
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "rounded px-2 py-0.5 text-[10px] font-bold uppercase",
                        statusStyles[o.status || "Draft"]
                      )}
                    >
                      {o.status || dict.LABEL_PENDING}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
