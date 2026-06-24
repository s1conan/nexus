"use client"

import { useState, useEffect, useMemo } from "react"
import { useDictionary } from "@/components/dictionary-provider"
import { useAuth } from "@/components/auth-provider"
import { createClient } from "@/lib/supabase"
import { Card } from "@/components/ui/card"
import {
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Calendar,
  Filter,
  DollarSign,
  Activity
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { SectionLoader } from "@/components/section-loader"
import { notify } from "@/lib/notifications"
import { format, startOfMonth, endOfMonth } from "date-fns"
import { Button } from "@/components/ui/button"
import { SITE_CONFIG } from "@/lib/site-content"

export default function ProfitLossReportPage() {
  const { dict } = useDictionary()
  const { hasPermission, loading: authLoading } = useAuth()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)

  // Date Filters
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"))
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"))

  // Data States
  const [revenue, setRevenue] = useState<number>(0)
  const [cogs, setCogs] = useState<number>(0)
  const [invoiceCount, setInvoiceCount] = useState<number>(0)

  async function fetchReport() {
    setLoading(true)
    try {
      // 1. Fetch Revenue (Sum of Invoice subtotals in period, excluding Draft/Cancelled)
      const { data: invoices, error: invError } = await supabase
        .from("invoices")
        .select("subtotal")
        .gte("issue_date", startDate)
        .lte("issue_date", endDate)
        .not("status", "in", '("Draft","Cancelled")')

      if (invError) throw invError

      const totalRevenue = invoices?.reduce((sum: number, inv: any) => sum + (Number(inv.subtotal) || 0), 0) || 0
      
      // 2. Fetch COGS (Sum of OUT inventory ledger in period)
      // Since inventory_ledger created_at is TIMESTAMPTZ, we'll filter by that
      const endDatePlusOne = new Date(endDate)
      endDatePlusOne.setDate(endDatePlusOne.getDate() + 1)
      const endDateStr = format(endDatePlusOne, "yyyy-MM-dd")

      const { data: ledger, error: ledError } = await supabase
        .from("inventory_ledger")
        .select("quantity, unit_cost")
        .eq("transaction_type", "OUT")
        .gte("created_at", startDate)
        .lt("created_at", endDateStr)

      if (ledError) throw ledError

      const totalCogs = ledger?.reduce((sum: number, item: any) => sum + ((Number(item.quantity) || 0) * (Number(item.unit_cost) || 0)), 0) || 0

      setRevenue(totalRevenue)
      setCogs(totalCogs)
      setInvoiceCount(invoices?.length || 0)

    } catch (err: any) {
      notify.error(dict.MSG_DATA_FETCH_FAILED, err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReport()
  }, [])

  const grossProfit = revenue - cogs
  const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0

  // We are reusing invoice permission for P&L for now, or we can use 'inventory'
  const canViewReport = hasPermission("invoice", "view")

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
      <div className="page-header shrink-0">
        <h1 className="page-title">
          <Activity className="size-5 mr-2 inline-block text-primary" />
          {dict.MENU_REPORTS_PROFIT_LOSS || "Profit & Loss Statement"}
        </h1>
      </div>

      <div className="action-bar items-end gap-4 shrink-0 mb-6">
        <div className="grid gap-1.5 w-48">
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

        <div className="grid gap-1.5 w-48">
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

        <Button variant="outline" onClick={fetchReport} className="h-10">
          <Filter className="size-4 mr-2" />
          {dict.BUTTON_REFRESH || "Refresh"}
        </Button>
      </div>

      {loading ? (
        <div className="flex-1 flex justify-center items-center">
          <SectionLoader />
        </div>
      ) : (
        <div className="flex-1 overflow-auto custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 max-w-5xl">
            {/* Revenue Card */}
            <Card className="p-6 flex flex-col justify-center border-l-4 border-l-emerald-500 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <div className="size-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700">
                  <DollarSign className="size-6" />
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Transactions</p>
                  <p className="text-lg font-bold">{invoiceCount} Invoices</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground uppercase font-bold tracking-wider mb-1">Total Revenue</p>
              <p className="text-3xl font-black text-emerald-700 truncate">{SITE_CONFIG.currencySymbol} {revenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
            </Card>

            {/* COGS Card */}
            <Card className="p-6 flex flex-col justify-center border-l-4 border-l-amber-500 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <div className="size-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-700">
                  <TrendingDown className="size-6" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground uppercase font-bold tracking-wider mb-1">Cost of Goods Sold (HPP)</p>
              <p className="text-3xl font-black text-amber-700 truncate">{SITE_CONFIG.currencySymbol} {cogs.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
            </Card>

            {/* Gross Profit Card */}
            <Card className={cn("p-6 flex flex-col justify-center border-l-4 shadow-sm", grossProfit >= 0 ? "border-l-primary" : "border-l-destructive")}>
              <div className="flex justify-between items-start mb-4">
                <div className={cn("size-12 rounded-full flex items-center justify-center", grossProfit >= 0 ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive")}>
                  {grossProfit >= 0 ? <TrendingUp className="size-6" /> : <TrendingDown className="size-6" />}
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Margin</p>
                  <p className={cn("text-lg font-bold", grossProfit >= 0 ? "text-primary" : "text-destructive")}>{grossMargin.toFixed(2)}%</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground uppercase font-bold tracking-wider mb-1">Gross Profit</p>
              <p className={cn("text-3xl font-black truncate", grossProfit >= 0 ? "text-primary" : "text-destructive")}>
                {SITE_CONFIG.currencySymbol} {grossProfit.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
            </Card>
          </div>

          {/* Detailed Statement view */}
          <Card className="max-w-5xl overflow-hidden">
            <div className="p-6 border-b bg-muted/20">
              <h2 className="text-lg font-bold uppercase tracking-wider">{dict.MENU_REPORTS_PROFIT_LOSS || "Profit & Loss Statement"}</h2>
              <p className="text-sm text-muted-foreground">For the period {format(new Date(startDate), "dd MMM yyyy")} to {format(new Date(endDate), "dd MMM yyyy")}</p>
            </div>
            
            <div className="p-0">
              <table className="w-full text-sm">
                <tbody>
                  {/* Revenue Section */}
                  <tr className="bg-muted/10">
                    <td className="p-4 font-bold text-lg" colSpan={2}>Income</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-4 pl-8">Sales Revenue (Invoices)</td>
                    <td className="p-4 text-right font-mono font-medium">{SITE_CONFIG.currencySymbol} {revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                  <tr className="border-b-2 border-primary/20 bg-primary/5">
                    <td className="p-4 pl-8 font-bold">Total Income</td>
                    <td className="p-4 text-right font-mono font-bold text-emerald-700">{SITE_CONFIG.currencySymbol} {revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>

                  {/* COGS Section */}
                  <tr className="bg-muted/10">
                    <td className="p-4 font-bold text-lg" colSpan={2}>Cost of Goods Sold (COGS)</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-4 pl-8">Inventory Outbound Cost (HPP)</td>
                    <td className="p-4 text-right font-mono font-medium">{SITE_CONFIG.currencySymbol} {cogs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                  <tr className="border-b-2 border-amber-500/20 bg-amber-500/5">
                    <td className="p-4 pl-8 font-bold">Total COGS</td>
                    <td className="p-4 text-right font-mono font-bold text-amber-700">{SITE_CONFIG.currencySymbol} {cogs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>

                  {/* Profit Section */}
                  <tr className={cn(grossProfit >= 0 ? "bg-primary/10" : "bg-destructive/10")}>
                    <td className="p-6 font-black text-xl uppercase tracking-wider">Gross Profit</td>
                    <td className={cn("p-6 text-right font-mono font-black text-xl", grossProfit >= 0 ? "text-primary" : "text-destructive")}>
                      {SITE_CONFIG.currencySymbol} {grossProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}