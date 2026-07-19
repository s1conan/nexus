"use client"

import { useEffect, useState } from "react"
import { useDictionary } from "@/components/dictionary-provider"
import { useAuth } from "@/components/auth-provider"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ClipboardList,
  Clock,
  FileCheck,
  Truck,
  AlertCircle,
  CalendarClock,
  Wallet,
} from "lucide-react"
import { formatNumber } from "@/lib/formatters"
import { createClient } from "@/lib/supabase"
import { format, startOfWeek, endOfWeek, addDays } from "date-fns"

interface DashboardStats {
  newQuotations: number
  expiringQuotations: number
  pendingSalesOrders: number
  undeliveredDOs: number
  overdueInvoices: number
  dueSoonInvoices: number
  pendingPayments: number
}

export default function DashboardPage() {
  const { dict, lang } = useDictionary()
  const { hasPermission } = useAuth()
  const [stats, setStats] = useState<DashboardStats>({
    newQuotations: 0,
    expiringQuotations: 0,
    pendingSalesOrders: 0,
    undeliveredDOs: 0,
    overdueInvoices: 0,
    dueSoonInvoices: 0,
    pendingPayments: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      const supabase = createClient()
      const today = new Date()
      const weekStart = startOfWeek(today, { weekStartsOn: 1 })
      const weekEnd = endOfWeek(today, { weekStartsOn: 1 })
      const nextWeek = addDays(today, 7)
      const todayStr = format(today, "yyyy-MM-dd")
      const weekStartStr = format(weekStart, "yyyy-MM-dd")
      const weekEndStr = format(weekEnd, "yyyy-MM-dd")
      const nextWeekStr = format(nextWeek, "yyyy-MM-dd")

      const newStats: DashboardStats = {
        newQuotations: 0,
        expiringQuotations: 0,
        pendingSalesOrders: 0,
        undeliveredDOs: 0,
        overdueInvoices: 0,
        dueSoonInvoices: 0,
        pendingPayments: 0,
      }

      try {
        if (hasPermission("quotation", "view")) {
          const [newQtResult, expiringResult] = await Promise.all([
            supabase
              .from("quotations")
              .select("id", { count: "exact", head: true })
              .gte("created_at", weekStartStr)
              .lte("created_at", weekEndStr),
            supabase
              .from("quotations")
              .select("id", { count: "exact", head: true })
              .neq("status", "Processed")
              .neq("status", "Rejected")
              .neq("status", "Accepted")
              .gte("expiry_date", todayStr)
              .lte("expiry_date", nextWeekStr),
          ])
          newStats.newQuotations = newQtResult.count || 0
          newStats.expiringQuotations = expiringResult.count || 0
        }

        if (hasPermission("sales-order", "view")) {
          const { count } = await supabase
            .from("sales_orders")
            .select("id", { count: "exact", head: true })
            .eq("status", "Approved")
          newStats.pendingSalesOrders = count || 0
        }

        if (hasPermission("delivery-order", "view")) {
          const { count } = await supabase
            .from("delivery_orders")
            .select("id", { count: "exact", head: true })
            .in("status", ["Draft", "Approved", "Shipped"])
          newStats.undeliveredDOs = count || 0
        }

        if (hasPermission("invoice", "view")) {
          const [overdueResult, dueSoonResult] = await Promise.all([
            supabase
              .from("invoices")
              .select("id", { count: "exact", head: true })
              .in("status", ["Sent", "Partial"])
              .lt("due_date", todayStr),
            supabase
              .from("invoices")
              .select("id", { count: "exact", head: true })
              .in("status", ["Sent", "Partial"])
              .gte("due_date", todayStr)
              .lte("due_date", nextWeekStr),
          ])
          newStats.overdueInvoices = overdueResult.count || 0
          newStats.dueSoonInvoices = dueSoonResult.count || 0
        }

        if (hasPermission("payments", "view")) {
          const { count } = await supabase
            .from("payments")
            .select("id", { count: "exact", head: true })
            .eq("status", "Pending")
          newStats.pendingPayments = count || 0
        }
      } catch (error) {
        console.error("Error fetching dashboard stats:", error)
      }

      setStats(newStats)
      setLoading(false)
    }

    fetchStats()
  }, [hasPermission])

  const cards = [
    {
      key: "newQuotations",
      label: dict.LABEL_NEW_QUOTATIONS,
      sublabel: dict.LABEL_THIS_WEEK,
      count: stats.newQuotations,
      icon: ClipboardList,
      show: hasPermission("quotation", "view"),
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      key: "expiringQuotations",
      label: dict.LABEL_EXPIRING_QUOTATIONS,
      sublabel: dict.LABEL_THIS_WEEK,
      count: stats.expiringQuotations,
      icon: Clock,
      show: hasPermission("quotation", "view"),
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
    },
    {
      key: "pendingSalesOrders",
      label: dict.LABEL_PENDING_SO,
      sublabel: dict.LABEL_THIS_WEEK,
      count: stats.pendingSalesOrders,
      icon: FileCheck,
      show: hasPermission("sales-order", "view"),
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
    {
      key: "undeliveredDOs",
      label: dict.LABEL_UNDELIVERED_DO,
      sublabel: "",
      count: stats.undeliveredDOs,
      icon: Truck,
      show: hasPermission("delivery-order", "view"),
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
    },
    {
      key: "overdueInvoices",
      label: dict.LABEL_OVERDUE_INVOICES,
      sublabel: "",
      count: stats.overdueInvoices,
      icon: AlertCircle,
      show: hasPermission("invoice", "view"),
      color: "text-red-500",
      bgColor: "bg-red-500/10",
    },
    {
      key: "dueSoonInvoices",
      label: dict.LABEL_DUE_SOON_INVOICES,
      sublabel: dict.LABEL_THIS_WEEK,
      count: stats.dueSoonInvoices,
      icon: CalendarClock,
      show: hasPermission("invoice", "view"),
      color: "text-yellow-500",
      bgColor: "bg-yellow-500/10",
    },
    {
      key: "pendingPayments",
      label: dict.LABEL_PENDING_PAYMENTS,
      sublabel: "",
      count: stats.pendingPayments,
      icon: Wallet,
      show: hasPermission("payments", "view"),
      color: "text-teal-500",
      bgColor: "bg-teal-500/10",
    },
  ]

  const visibleCards = cards.filter((c) => c.show)

  if (loading) {
    return (
      <div className="custom-scrollbar flex h-full flex-col gap-6 overflow-auto p-6">
        <div className="flex items-center justify-between">
          <h1 className="page-title">{dict.DASHBOARD_TITLE}</h1>
        </div>
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-4 w-24 rounded bg-muted" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-16 rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (visibleCards.length === 0) {
    return (
      <div className="custom-scrollbar flex h-full flex-col gap-6 overflow-auto p-6">
        <div className="flex items-center justify-between">
          <h1 className="page-title">{dict.DASHBOARD_TITLE}</h1>
        </div>
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {dict.MSG_NO_PERMISSION || "No modules available with current permissions."}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="custom-scrollbar flex h-full flex-col gap-6 overflow-auto p-6">
      <div className="flex items-center justify-between">
        <h1 className="page-title">{dict.DASHBOARD_TITLE}</h1>
      </div>
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
        {visibleCards.map((card) => {
          const Icon = card.icon
          return (
            <Card key={card.key} tabIndex={0}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {card.label}
                </CardTitle>
                <div className={`rounded p-1.5 ${card.bgColor}`}>
                  <Icon className={`size-4 ${card.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatNumber(card.count, lang === "id" ? "id-ID" : "en-US")}
                </div>
                {card.sublabel && (
                  <p className="text-xs text-muted-foreground">{card.sublabel}</p>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
