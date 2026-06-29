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
  Wallet,
  AlertCircle,
  TrendingUp,
  Banknote,
  Calendar,
  Filter,
  DollarSign,
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
import { SITE_CONFIG } from "@/lib/site-content"

export default function PaymentsReportPage() {
  const { dict } = useDictionary()
  const { hasPermission, loading: authLoading } = useAuth()
  const supabase = createClient()

  const statusStyles: Record<string, string> = {
    Verified: "bg-green-100 text-green-700",
    Rejected: "bg-red-100 text-red-700",
    Pending: "bg-amber-100 text-amber-700",
  }

  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  // Date Filters
  const [startDate, setStartDate] = useState(
    format(startOfMonth(new Date()), "yyyy-MM-dd")
  )
  const [endDate, setEndDate] = useState(
    format(endOfMonth(new Date()), "yyyy-MM-dd")
  )

  async function fetchPayments() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("payments")
        .select("*, invoice:invoices(id, company:companies(id, name))")
        .order("payment_date", { ascending: false })

      if (error) throw error
      setPayments(data || [])
    } catch (err: any) {
      notify.error(dict.MSG_DATA_FETCH_FAILED, err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPayments()
  }, [])

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      const dateMatch = isWithinInterval(parseISO(p.payment_date), {
        start: parseISO(startDate),
        end: parseISO(endDate),
      })

      const searchMatch =
        p.payment_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.invoice?.company?.name || "")
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        (p.payment_method || "")
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        (p.reference_number || "")
          .toLowerCase()
          .includes(searchQuery.toLowerCase())

      return dateMatch && searchMatch
    })
  }, [payments, searchQuery, startDate, endDate])

  const stats = useMemo(() => {
    const totalAmount = filteredPayments.reduce(
      (sum, p) => sum + (p.amount || 0),
      0
    )
    return { totalAmount, count: filteredPayments.length }
  }, [filteredPayments])

  const canViewReport = hasPermission("payments", "view")

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
          <Wallet className="mr-2 inline-block size-5 text-primary" />
          {dict.MENU_REPORTS_PAYMENTS || "Payment Report"}
        </h1>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="flex items-center gap-4 border-l-4 border-l-primary p-4">
          <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <DollarSign className="size-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
              {dict.LABEL_TOTAL_AMOUNT || "Total Amount"}
            </p>
            <p className="text-xl font-black">
              {SITE_CONFIG.currencySymbol} {stats.totalAmount.toLocaleString()}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {stats.count} {dict.MENU_PAYMENTS}
            </p>
          </div>
        </Card>

        <Card className="flex items-center gap-4 border-l-4 border-l-green-500 p-4">
          <div className="flex size-10 items-center justify-center rounded-full bg-green-100 text-green-700">
            <TrendingUp className="size-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
              {dict.LABEL_STATUS || "Status"}
            </p>
            <p className="text-xl font-black">
              {dict.LABEL_ACTIVE || "Active"}
            </p>
            <p className="text-[10px] text-muted-foreground">
              Active cash inflow summary
            </p>
          </div>
        </Card>
      </div>

      <div className="action-bar items-end gap-4">
        <div className="grid max-w-sm flex-1 gap-1.5 max-sm:w-full">
          <label className="ml-1 text-[10px] font-bold text-muted-foreground uppercase">
            {dict.PLACEHOLDER_SEARCH || "Search"}
          </label>
          <div className="relative">
            <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder={`${dict.MENU_PAYMENTS} No, Ref No, ${dict.LABEL_COMPANY_NAME}...`}
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

        <Button variant="outline" onClick={fetchPayments} className="h-10">
          <Filter className="mr-2 size-4" />
          {dict.BUTTON_REFRESH || "Refresh"}
        </Button>
      </div>

      <Card className="data-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="px-7">{dict.MENU_PAYMENTS} No</TableHead>
              <TableHead>{dict.VERIFY_LABEL_DATE || "Date"}</TableHead>
              <TableHead>{dict.LABEL_COMPANY_NAME}</TableHead>
              <TableHead>{dict.LABEL_PAYMENT_METHOD}</TableHead>
              <TableHead className="text-right">{dict.LABEL_AMOUNT}</TableHead>
              <TableHead>{dict.LABEL_STATUS}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="p-0">
                  <SectionLoader />
                </TableCell>
              </TableRow>
            ) : filteredPayments.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-10 text-center text-muted-foreground"
                >
                  {dict.NO_DATA}
                </TableCell>
              </TableRow>
            ) : (
              filteredPayments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="px-7">
                    <span className="font-mono text-sm font-bold">
                      {p.payment_number}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">
                    {format(parseISO(p.payment_date), "dd MMM yyyy")}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm font-medium">
                      {p.invoice?.company?.name}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">{p.payment_method}</TableCell>
                  <TableCell className="text-right">
                    <span className="text-sm font-black">
                      {SITE_CONFIG.currencySymbol} {p.amount?.toLocaleString()}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "rounded px-2 py-0.5 text-[10px] font-bold uppercase",
                        statusStyles[p.status || "Pending"]
                      )}
                    >
                      {p.status || "Pending"}
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
