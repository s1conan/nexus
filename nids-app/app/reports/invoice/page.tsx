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
  Receipt,
  AlertCircle,
  TrendingUp,
  FileText,
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

export default function InvoiceReportPage() {
  const { dict } = useDictionary()
  const { hasPermission, loading: authLoading } = useAuth()
  const supabase = createClient()

  const [invoices, setInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  
  // Date Filters
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"))
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"))

  async function fetchInvoices() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("invoices")
        .select("*, company:companies(id, name)")
        .order("invoice_date", { ascending: false })

      if (error) throw error
      setInvoices(data || [])
    } catch (err: any) {
      notify.error(dict.MSG_DATA_FETCH_FAILED, err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInvoices()
  }, [])

  const filteredInvoices = useMemo(() => {
    return invoices.filter(i => {
      const dateMatch = isWithinInterval(parseISO(i.invoice_date), {
        start: parseISO(startDate),
        end: parseISO(endDate)
      })
      
      const searchMatch = 
        i.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (i.company?.name || "").toLowerCase().includes(searchQuery.toLowerCase())

      return dateMatch && searchMatch
    })
  }, [invoices, searchQuery, startDate, endDate])

  const stats = useMemo(() => {
    const totalAmount = filteredInvoices.reduce((sum, i) => sum + (i.grand_total || 0), 0)
    return { totalAmount, count: filteredInvoices.length }
  }, [filteredInvoices])

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
      <div className="page-header">
        <h1 className="page-title">
          <Receipt className="size-5 mr-2 inline-block text-primary" />
          {dict.MENU_REPORTS_INVOICE || "Invoice Report"}
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="p-4 flex items-center gap-4 border-l-4 border-l-primary">
          <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <DollarSign className="size-5" />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">{dict.LABEL_GRAND_TOTAL || "Grand Total"}</p>
            <p className="text-xl font-black">{SITE_CONFIG.currencySymbol} {stats.totalAmount.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">{stats.count} {dict.MENU_INVOICE}</p>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-4 border-l-4 border-l-green-500">
          <div className="size-10 rounded-full bg-green-100 flex items-center justify-center text-green-700">
            <TrendingUp className="size-5" />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">{dict.LABEL_STATUS || "Status"}</p>
            <p className="text-xl font-black">{dict.LABEL_ACTIVE || "Active"}</p>
            <p className="text-[10px] text-muted-foreground">Active billing summary</p>
          </div>
        </Card>
      </div>

      <div className="action-bar items-end gap-4">
        <div className="grid gap-1.5 flex-1 max-sm:w-full max-w-sm">
          <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">{dict.PLACEHOLDER_SEARCH || "Search"}</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder={`${dict.MENU_INVOICE} No, ${dict.LABEL_COMPANY_NAME}...`}
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
        
        <Button variant="outline" onClick={fetchInvoices} className="h-10">
          <Filter className="size-4 mr-2" />
          {dict.BUTTON_REFRESH || "Refresh"}
        </Button>
      </div>

      <Card className="data-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="px-7">{dict.MENU_INVOICE} No</TableHead>
              <TableHead>{dict.VERIFY_LABEL_DATE || "Date"}</TableHead>
              <TableHead>{dict.LABEL_COMPANY_NAME}</TableHead>
              <TableHead className="text-right">{dict.LABEL_GRAND_TOTAL}</TableHead>
              <TableHead>{dict.LABEL_STATUS}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="p-0"><SectionLoader /></TableCell>
              </TableRow>
            ) : filteredInvoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                  {dict.NO_DATA}
                </TableCell>
              </TableRow>
            ) : filteredInvoices.map((i) => (
              <TableRow key={i.id}>
                <TableCell className="px-7">
                  <span className="font-bold text-sm font-mono">{i.invoice_number}</span>
                </TableCell>
                <TableCell className="text-sm">
                  {format(parseISO(i.invoice_date), "dd MMM yyyy")}
                </TableCell>
                <TableCell>
                  <span className="font-medium text-sm">{i.company?.name}</span>
                </TableCell>
                <TableCell className="text-right">
                  <span className="font-black text-sm">
                    {SITE_CONFIG.currencySymbol} {i.grand_total?.toLocaleString()}
                  </span>
                </TableCell>
                <TableCell>
                  <span className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                    i.status === 'Paid' ? "bg-green-100 text-green-700" :
                    i.status === 'Cancelled' ? "bg-red-100 text-red-700" :
                    i.status === 'Sent' ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-700"
                  )}>
                    {i.status || 'Draft'}
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
