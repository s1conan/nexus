"use client"

import { useEffect, useState, type ComponentType, type CSSProperties } from "react"
import { useDictionary } from "@/components/dictionary-provider"
import { useAuth } from "@/components/auth-provider"
import { Card, CardContent, CardTitle } from "@/components/ui/card"
import {
  ClipboardList,
  ShoppingBag,
  Truck,
  Receipt,
  Wallet,
} from "lucide-react"
import { formatNumber, formatCompactCurrency } from "@/lib/formatters"
import { SectionLoader } from "@/components/section-loader"
import { Separator } from "@/components/ui/separator"
import { createClient } from "@/lib/supabase"
import { format, addDays, startOfMonth, endOfMonth, setDate } from "date-fns"

interface DashboardStats {
  sentQuotations: number
  expiringQuotations: number
  acceptedQuotations: number
  pendingSalesOrders: number
  undeliveredDOs: number
  inTransitDOs: number
  overdueInvoices: number
  dueSoonInvoices: number
  unsentInvoices: number
  outstandingReceivables: number
  pendingPayments: number
  collectedThisPeriod: number
}

type DashboardCard = {
  key: string
  caption: string
  subCaption: string
  count: number
  icon: ComponentType<{ className?: string; style?: CSSProperties }>
  show: boolean
  color: string
  currency?: boolean
}

// A quotation period runs from the 1st to the 15th, or the 16th to end of month.
const getQuotationPeriod = (date: Date) => {
  const monthStart = startOfMonth(date)
  const monthEnd = endOfMonth(date)
  return date.getDate() <= 15
    ? { start: monthStart, end: setDate(monthStart, 15) }
    : { start: setDate(monthStart, 16), end: monthEnd }
}

export default function DashboardPage() {
  const { dict, lang } = useDictionary()
  const { hasPermission } = useAuth()
  const [stats, setStats] = useState<DashboardStats>({
    sentQuotations: 0,
    expiringQuotations: 0,
    acceptedQuotations: 0,
    pendingSalesOrders: 0,
    undeliveredDOs: 0,
    inTransitDOs: 0,
    overdueInvoices: 0,
    dueSoonInvoices: 0,
    unsentInvoices: 0,
    outstandingReceivables: 0,
    pendingPayments: 0,
    collectedThisPeriod: 0,
  })
  const [loading, setLoading] = useState(true)
  const [periodLabel, setPeriodLabel] = useState("")

  useEffect(() => {
    const fetchStats = async () => {
      const supabase = createClient()
      const today = new Date()
      const { start: periodStart, end: periodEnd } = getQuotationPeriod(today)
      const nextWeek = addDays(today, 7)
      const todayStr = format(today, "yyyy-MM-dd")
      const periodStartStr = format(periodStart, "yyyy-MM-dd")
      const periodEndStr = format(periodEnd, "yyyy-MM-dd")
      const nextWeekStr = format(nextWeek, "yyyy-MM-dd")

      const newStats: DashboardStats = {
        sentQuotations: 0,
        expiringQuotations: 0,
        acceptedQuotations: 0,
        pendingSalesOrders: 0,
        undeliveredDOs: 0,
        inTransitDOs: 0,
        overdueInvoices: 0,
        dueSoonInvoices: 0,
        unsentInvoices: 0,
        outstandingReceivables: 0,
        pendingPayments: 0,
        collectedThisPeriod: 0,
      }

      try {
        if (hasPermission("quotation", "view")) {
          const [sentResult, expiringResult, acceptedResult] =
            await Promise.all([
              supabase
                .from("quotations")
                .select("id", { count: "exact", head: true })
                .eq("status", "Sent")
                .gte("created_at", periodStartStr)
                .lte("created_at", `${periodEndStr}T23:59:59`),
              supabase
                .from("quotations")
                .select("id", { count: "exact", head: true })
                .neq("status", "Processed")
                .neq("status", "Rejected")
                .neq("status", "Accepted")
                .gte("expiry_date", todayStr)
                .lte("expiry_date", nextWeekStr),
              supabase
                .from("quotations")
                .select("id", { count: "exact", head: true })
                .eq("status", "Accepted")
                .gte("created_at", periodStartStr)
                .lte("created_at", `${periodEndStr}T23:59:59`),
            ])
          newStats.sentQuotations = sentResult.count || 0
          newStats.expiringQuotations = expiringResult.count || 0
          newStats.acceptedQuotations = acceptedResult.count || 0
        }

        if (hasPermission("sales-order", "view")) {
          const { count } = await supabase
            .from("sales_orders")
            .select("id", { count: "exact", head: true })
            .eq("status", "Approved")
          newStats.pendingSalesOrders = count || 0
        }

        if (hasPermission("delivery-order", "view")) {
          const [undeliveredResult, inTransitResult] = await Promise.all([
            supabase
              .from("delivery_orders")
              .select("id", { count: "exact", head: true })
              .in("status", ["Draft", "Approved", "Shipped"]),
            supabase
              .from("delivery_orders")
              .select("id", { count: "exact", head: true })
              .eq("status", "Shipped"),
          ])
          newStats.undeliveredDOs = undeliveredResult.count || 0
          newStats.inTransitDOs = inTransitResult.count || 0
        }

        if (hasPermission("invoice", "view")) {
          const [overdueResult, dueSoonResult, unsentResult, unpaidResult] =
            await Promise.all([
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
              supabase
                .from("invoices")
                .select("id", { count: "exact", head: true })
                .eq("status", "Draft"),
              supabase
                .from("invoices")
                .select("total_amount, paid_amount")
                .in("status", ["Sent", "Partial"]),
            ])
          newStats.overdueInvoices = overdueResult.count || 0
          newStats.dueSoonInvoices = dueSoonResult.count || 0
          newStats.unsentInvoices = unsentResult.count || 0
          const unpaidRows = (unpaidResult.data || []) as {
            total_amount: number | null
            paid_amount: number | null
          }[]
          newStats.outstandingReceivables = unpaidRows.reduce(
            (sum, inv) =>
              sum +
              Math.max(
                0,
                (Number(inv.total_amount) || 0) - (Number(inv.paid_amount) || 0)
              ),
            0
          )
        }

        if (hasPermission("payments", "view")) {
          const [pendingResult, collectedResult] = await Promise.all([
            supabase
              .from("payments")
              .select("id", { count: "exact", head: true })
              .eq("status", "Pending"),
            supabase
              .from("payments")
              .select("amount")
              .eq("status", "Verified")
              .gte("payment_date", periodStartStr)
              .lte("payment_date", periodEndStr),
          ])
          newStats.pendingPayments = pendingResult.count || 0
          const collectedRows = (collectedResult.data || []) as {
            amount: number | null
          }[]
          newStats.collectedThisPeriod = collectedRows.reduce(
            (sum, p) => sum + (Number(p.amount) || 0),
            0
          )
        }
      } catch (error) {
        console.error("Error fetching dashboard stats:", error)
      }

      setStats(newStats)
      setPeriodLabel(
        `${format(periodStart, "dd/MM")} – ${format(periodEnd, "dd/MM")}`
      )
      setLoading(false)
    }

    fetchStats()
  }, [hasPermission])

  // A distinct accent color per module. Applied as an inline style at low
  // opacity (rather than a Tailwind utility) so it always renders and blends
  // softly into the card background.
  // Quotation=violet, Sales Order=blue, Delivery Order=amber,
  // Invoice=rose, Payments=emerald.
  const cards: DashboardCard[] = [
    {
      key: "sentQuotations",
      caption: dict.MENU_QUOTATION,
      subCaption: periodLabel
        ? `${dict.LABEL_STATUS_SENT} · ${periodLabel}`
        : dict.LABEL_STATUS_SENT,
      count: stats.sentQuotations,
      icon: ClipboardList,
      show: hasPermission("quotation", "view"),
      color: "var(--dash-quotation)",
    },
    {
      key: "expiringQuotations",
      caption: dict.MENU_QUOTATION,
      subCaption: dict.LABEL_DASH_WILL_EXPIRE,
      count: stats.expiringQuotations,
      icon: ClipboardList,
      show: hasPermission("quotation", "view"),
      color: "var(--dash-quotation)",
    },
    {
      key: "acceptedQuotations",
      caption: dict.MENU_QUOTATION,
      subCaption: periodLabel
        ? `${dict.LABEL_DASH_ACCEPTED} · ${periodLabel}`
        : dict.LABEL_DASH_ACCEPTED,
      count: stats.acceptedQuotations,
      icon: ClipboardList,
      show: hasPermission("quotation", "view"),
      color: "var(--dash-quotation)",
    },
    {
      key: "pendingSalesOrders",
      caption: dict.MENU_SALES_ORDER,
      subCaption: dict.LABEL_DASH_PENDING,
      count: stats.pendingSalesOrders,
      icon: ShoppingBag,
      show: hasPermission("sales-order", "view"),
      color: "var(--dash-sales-order)",
    },
    {
      key: "undeliveredDOs",
      caption: dict.MENU_DELIVERY_ORDER,
      subCaption: dict.LABEL_DASH_UNDELIVERED,
      count: stats.undeliveredDOs,
      icon: Truck,
      show: hasPermission("delivery-order", "view"),
      color: "var(--dash-delivery-order)",
    },
    {
      key: "inTransitDOs",
      caption: dict.MENU_DELIVERY_ORDER,
      subCaption: dict.LABEL_DASH_IN_TRANSIT,
      count: stats.inTransitDOs,
      icon: Truck,
      show: hasPermission("delivery-order", "view"),
      color: "var(--dash-delivery-order)",
    },
    {
      key: "overdueInvoices",
      caption: dict.MENU_INVOICE,
      subCaption: dict.LABEL_DASH_OVERDUE,
      count: stats.overdueInvoices,
      icon: Receipt,
      show: hasPermission("invoice", "view"),
      color: "var(--dash-invoice)",
    },
    {
      key: "dueSoonInvoices",
      caption: dict.MENU_INVOICE,
      subCaption: dict.LABEL_DASH_DUE_SOON,
      count: stats.dueSoonInvoices,
      icon: Receipt,
      show: hasPermission("invoice", "view"),
      color: "var(--dash-invoice)",
    },
    {
      key: "unsentInvoices",
      caption: dict.MENU_INVOICE,
      subCaption: dict.LABEL_DASH_UNSENT,
      count: stats.unsentInvoices,
      icon: Receipt,
      show: hasPermission("invoice", "view"),
      color: "var(--dash-invoice)",
    },
    {
      key: "outstandingReceivables",
      caption: dict.MENU_INVOICE,
      subCaption: dict.LABEL_DASH_OUTSTANDING,
      count: stats.outstandingReceivables,
      icon: Receipt,
      show: hasPermission("invoice", "view"),
      color: "var(--dash-invoice)",
      currency: true,
    },
    {
      key: "pendingPayments",
      caption: dict.MENU_PAYMENTS,
      subCaption: dict.LABEL_DASH_PENDING,
      count: stats.pendingPayments,
      icon: Wallet,
      show: hasPermission("payments", "view"),
      color: "var(--dash-payments)",
    },
    {
      key: "collectedThisPeriod",
      caption: dict.MENU_PAYMENTS,
      subCaption: periodLabel
        ? `${dict.LABEL_DASH_COLLECTED} · ${periodLabel}`
        : dict.LABEL_DASH_COLLECTED,
      count: stats.collectedThisPeriod,
      icon: Wallet,
      show: hasPermission("payments", "view"),
      color: "var(--dash-payments)",
      currency: true,
    },
  ]

  const visibleCards = cards.filter((c) => c.show)
  const cardLocale = lang === "id" ? "id-ID" : "en-US"

  if (loading) {
    return <SectionLoader className="min-h-[400px]" />
  }

  if (visibleCards.length === 0) {
    return (
      <div className="custom-scrollbar flex h-full flex-col gap-6 overflow-auto p-6">
        <div className="flex items-center justify-between">
          <h1 className="page-title">{dict.DASHBOARD_TITLE}</h1>
        </div>
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {dict.MSG_NO_PERMISSION ||
              "No modules available with current permissions."}
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {visibleCards.map((card) => {
          const Icon = card.icon
          const accent = `color-mix(in srgb, ${card.color} 70%, transparent)`
          const dividerColor = `color-mix(in srgb, ${card.color} 15%, transparent)`
          const cardBg = `color-mix(in srgb, ${card.color} 3%, transparent)`
          return (
            <Card
              key={card.key}
              tabIndex={0}
              className="py-4"
              style={{ backgroundColor: cardBg }}
            >
              <CardContent className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle
                      className="text-sm font-semibold"
                      style={{ color: accent }}
                    >
                      {card.caption}
                    </CardTitle>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      {card.subCaption}
                    </p>
                  </div>
                  <Icon
                    className="size-10 shrink-0"
                    style={{ color: accent }}
                  />
                </div>
                <Separator style={{ backgroundColor: dividerColor }} />
                <div className="text-2xl font-bold">
                  {card.currency
                    ? formatCompactCurrency(card.count, cardLocale)
                    : formatNumber(card.count, cardLocale)}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
