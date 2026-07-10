"use client"

import React, { useRef, useEffect, useState, useCallback } from "react"
import { useMdi } from "./mdi-provider"
import { useDictionary } from "./dictionary-provider"
import { usePathname } from "next/navigation"
import {
  Building2,
  Package,
  LayoutDashboard,
  Truck,
  UserCog,
  Settings,
  LogOut,
  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Menu as MenuIcon,
  Languages,
  Sun,
  Moon,
  Monitor,
  User,
  Key,
  Save,
  Banknote,
  ShoppingBag,
  Receipt,
  Wallet,
  ArrowDownToLine,
  ClipboardList,
  Warehouse,
  Activity,
  Bell,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/components/auth-provider"
import { useTheme } from "next-themes"
import { createClient } from "@/lib/supabase"
import { notify } from "@/lib/notifications"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ButtonLoader } from "@/components/button-loader"

import { cn } from "@/lib/utils"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

// Import components for tabs
import DashboardPage from "@/app/dashboard/page"
import CompaniesPage from "@/app/companies/page"
import ProductsPage from "@/app/products/page"
import UsersPage from "@/app/users/page"
import ShipmentsPage from "@/app/reports/delivery/page"
import ComponentTestPage from "@/app/component-test/page"
import SettingsPage from "@/app/settings/page"
import QuotationsPage from "@/app/quotations/page"
import DepositsPage from "@/app/deposit/page"
import SalesOrdersPage from "@/app/sales-order/page"
import DeliveryOrdersPage from "@/app/delivery-order/page"
import VehiclesPage from "@/app/vehicles/page"
import InvoicePage from "@/app/invoice/page"
import PaymentsPage from "@/app/payments/page"
import FundersPage from "@/app/funders/page"
import InventoryReportPage from "@/app/reports/inventory/page"
import DepositReportPage from "@/app/reports/deposit/page"
import QuotationReportPage from "@/app/reports/quotation/page"
import SalesOrderReportPage from "@/app/reports/sales-order/page"
import InvoiceReportPage from "@/app/reports/invoice/page"
import PaymentsReportPage from "@/app/reports/payments/page"
import ProfitLossReportPage from "@/app/reports/profit-loss/page"

export function MdiLayout() {
  const { dict, config, lang } = useDictionary()
  const { tabs, activeTabId, openTab, closeTab, setActiveTabId, isRestored } =
    useMdi()
  const {
    user,
    profile,
    signOut,
    changeLanguage,
    hasPermission,
    resolvedPermissions,
  } = useAuth()
  const { setTheme } = useTheme()
  const pathname = usePathname()
  const tabStripRef = useRef<HTMLDivElement>(null)
  const lastToastedUserIdRef = useRef<string | null>(null)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const [isOverflowing, setIsOverflowing] = useState(false)

  // Notification states and sync logic
  const MAX_HISTORY = 20
  const [notifications, setNotifications] = useState<any[]>([])
  const [hasUnread, setHasUnread] = useState(false)
  const [companyMap, setCompanyMap] = useState<Record<string, string>>({})
  const [invoiceMap, setInvoiceMap] = useState<
    Record<string, { companyId: string; number: string }>
  >({})

  // Format datetime string
  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString)
      if (isNaN(date.getTime())) return ""

      const now = new Date()
      const isToday = date.toDateString() === now.toDateString()

      const pad = (n: number) => n.toString().padStart(2, "0")
      const timeStr = `${pad(date.getHours())}:${pad(date.getMinutes())}`

      if (isToday) {
        return timeStr
      } else {
        return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${timeStr}`
      }
    } catch {
      return ""
    }
  }

  // Load reference maps and combined notifications from database & local storage
  useEffect(() => {
    if (!user?.id) return

    const supabase = createClient()

    const loadData = async () => {
      try {
        // 1. Fetch companies lookup
        const { data: companiesData, error: coError } = await supabase
          .from("companies")
          .select("id, name")

        const coMap: Record<string, string> = {}
        if (!coError && companiesData) {
          companiesData.forEach((c: any) => {
            coMap[c.id] = c.name
          })
          setCompanyMap(coMap)
        }

        // 2. Fetch invoices lookup
        const { data: invoicesData, error: invError } = await supabase
          .from("invoices")
          .select("id, invoice_number, company_id")

        const invMap: Record<string, { companyId: string; number: string }> = {}
        if (!invError && invoicesData) {
          invoicesData.forEach((i: any) => {
            invMap[i.id] = { companyId: i.company_id, number: i.invoice_number }
          })
          setInvoiceMap(invMap)
        }

        // 3. Fetch audit logs
        const { data: logsData } = await supabase
          .from("audit_logs")
          .select("*")
          .eq("changed_by", user.id)
          .order("created_at", { ascending: false })
          .limit(MAX_HISTORY)

        const dbLogs: any[] = logsData || []

        // 4. Load local notifications
        const localNotifsStr = localStorage.getItem("nids_local_notifications")
        const localNotifs: any[] = localNotifsStr
          ? JSON.parse(localNotifsStr)
          : []

        // 5. Check clear time
        const clearTimeStr = localStorage.getItem(
          "nids_notifications_clear_time"
        )
        const clearTime = clearTimeStr ? new Date(clearTimeStr).getTime() : 0

        // Filter out items cleared before
        let filteredDbLogs = dbLogs
        if (clearTime > 0) {
          filteredDbLogs = dbLogs.filter(
            (log) => new Date(log.created_at).getTime() > clearTime
          )
        }

        let filteredLocalNotifs = localNotifs
        if (clearTime > 0) {
          filteredLocalNotifs = localNotifs.filter(
            (notif) => new Date(notif.timestamp).getTime() > clearTime
          )
        }

        // Combine and sort
        const combined = [
          ...filteredDbLogs.map((log) => ({
            id: log.id,
            isDb: true,
            table_name: log.table_name,
            action: log.action,
            old_data: log.old_data,
            new_data: log.new_data,
            timestamp: log.created_at,
          })),
          ...filteredLocalNotifs.map((notif) => ({
            id: notif.id,
            isDb: false,
            type: notif.type,
            title: notif.title,
            description: notif.description,
            timestamp: notif.timestamp,
          })),
        ]

        // Sort by timestamp desc
        combined.sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )

        // Filter out duplicate IDs (just in case)
        const uniqueCombined = []
        const seenIds = new Set<string>()
        for (const item of combined) {
          if (!seenIds.has(item.id)) {
            seenIds.add(item.id)
            uniqueCombined.push(item)
          }
        }

        setNotifications(uniqueCombined.slice(0, MAX_HISTORY))
      } catch (err) {
        console.error("Error loading notification history:", err)
      }
    }

    loadData()
  }, [user?.id])

  // Listen to real-time custom notification event
  useEffect(() => {
    const handleNotification = (e: Event) => {
      const customEvent = e as CustomEvent
      const newNotif = customEvent.detail
      if (!newNotif) return

      setNotifications((prev) => {
        // If this ID is already in the list, ignore it to prevent duplicates
        if (prev.some((x) => x.id === newNotif.id)) {
          return prev
        }

        const item = {
          id: newNotif.id,
          isDb: newNotif.isDb,
          type: newNotif.type,
          title: newNotif.title,
          description: newNotif.description,
          timestamp: newNotif.timestamp,
        }

        // If it's not DB related, save it to localStorage
        if (!newNotif.isDb) {
          try {
            const localNotifsStr = localStorage.getItem(
              "nids_local_notifications"
            )
            let localNotifs = localNotifsStr ? JSON.parse(localNotifsStr) : []
            localNotifs.unshift({
              id: newNotif.id,
              type: newNotif.type,
              title: newNotif.title,
              description: newNotif.description,
              timestamp: newNotif.timestamp,
            })
            localNotifs = localNotifs.slice(0, MAX_HISTORY)
            localStorage.setItem(
              "nids_local_notifications",
              JSON.stringify(localNotifs)
            )
          } catch (err) {
            console.error("Failed to save local notification:", err)
          }
        }

        return [item, ...prev].slice(0, MAX_HISTORY)
      })

      setHasUnread(true)
    }

    window.addEventListener("nids-notification", handleNotification)
    return () =>
      window.removeEventListener("nids-notification", handleNotification)
  }, [])

  const clearNotifications = () => {
    setNotifications([])
    setHasUnread(false)
    localStorage.removeItem("nids_local_notifications")
    localStorage.setItem(
      "nids_notifications_clear_time",
      new Date().toISOString()
    )
  }

  const getBadgeStyle = (type: string) => {
    switch (type) {
      case "success":
        return "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
      case "deleted":
        return "bg-rose-500/10 text-rose-500 border border-rose-500/20"
      case "error":
        return "bg-rose-500/10 text-rose-500 border border-rose-500/20"
      case "warning":
        return "bg-amber-500/10 text-amber-500 border border-amber-500/20"
      case "info":
        return "bg-blue-500/10 text-blue-500 border border-blue-500/20"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  const formatNotification = (item: any) => {
    // If it's a pre-formatted notification (local log or real-time event log)
    if (!item.table_name && item.title) {
      return {
        title: item.title,
        description: item.description,
        type: item.type || "info",
      }
    }

    const data = item.new_data || item.old_data || {}
    const oldVal = item.old_data || {}
    const newVal = item.new_data || {}
    const action = item.action
    const table = item.table_name

    const getCompanyName = (companyId: string) => {
      return companyMap[companyId] ? `[${companyMap[companyId]}]` : ""
    }

    let title = ""
    let description = ""
    const type = action === "DELETE" ? "deleted" : "success"

    switch (table) {
      case "companies": {
        const name = data.name || ""
        if (action === "DELETE") {
          title =
            dict.MSG_DELETE_SUCCESS?.replace("%data%", `[${name}]`) ||
            `Company [${name}] deleted`
          description =
            dict.MSG_SUCCESS_DELETE_DESC_NO_COMPANY?.replace(
              "%entity%",
              `company [${name}]`
            ) || `Successfully deleted company [${name}].`
        } else if (action === "INSERT") {
          title =
            dict.MSG_SAVE_SUCCESS?.replace("%data%", `[${name}]`) ||
            `Company [${name}] saved`
          description =
            dict.MSG_SUCCESS_SAVE_DESC_NO_COMPANY?.replace(
              "%entity%",
              `company [${name}]`
            ) || `Successfully saved company [${name}].`
        } else {
          title =
            dict.MSG_UPDATE_SUCCESS?.replace("%data%", `[${name}]`) ||
            `Company [${name}] updated`
          description =
            dict.MSG_SUCCESS_UPDATE_DESC_NO_COMPANY?.replace(
              "%entity%",
              `company [${name}]`
            ) || `Successfully updated company [${name}].`
        }
        break
      }
      case "products": {
        const name = data.name || ""
        if (action === "DELETE") {
          title =
            dict.MSG_DELETE_SUCCESS?.replace("%data%", `[${name}]`) ||
            `Product [${name}] deleted`
          description =
            dict.MSG_SUCCESS_DELETE_DESC_NO_COMPANY?.replace(
              "%entity%",
              `product [${name}]`
            ) || `Successfully deleted product [${name}].`
        } else if (action === "INSERT") {
          title =
            dict.MSG_SAVE_SUCCESS?.replace("%data%", `[${name}]`) ||
            `Product [${name}] saved`
          description =
            dict.MSG_SUCCESS_SAVE_DESC_NO_COMPANY?.replace(
              "%entity%",
              `product [${name}]`
            ) || `Successfully saved product [${name}].`
        } else {
          title =
            dict.MSG_UPDATE_SUCCESS?.replace("%data%", `[${name}]`) ||
            `Product [${name}] updated`
          description =
            dict.MSG_SUCCESS_UPDATE_DESC_NO_COMPANY?.replace(
              "%entity%",
              `product [${name}]`
            ) || `Successfully updated product [${name}].`
        }
        break
      }
      case "funders": {
        const name = data.name || ""
        if (action === "DELETE") {
          title =
            dict.MSG_DELETE_SUCCESS?.replace("%data%", `[${name}]`) ||
            `Funder [${name}] deleted`
          description =
            dict.MSG_SUCCESS_DELETE_DESC_NO_COMPANY?.replace(
              "%entity%",
              `funder [${name}]`
            ) || `Successfully deleted funder [${name}].`
        } else if (action === "INSERT") {
          title =
            dict.MSG_SAVE_SUCCESS?.replace("%data%", `[${name}]`) ||
            `Funder [${name}] saved`
          description =
            dict.MSG_SUCCESS_SAVE_DESC_NO_COMPANY?.replace(
              "%entity%",
              `funder [${name}]`
            ) || `Successfully saved funder [${name}].`
        } else {
          title =
            dict.MSG_UPDATE_SUCCESS?.replace("%data%", `[${name}]`) ||
            `Funder [${name}] updated`
          description =
            dict.MSG_SUCCESS_UPDATE_DESC_NO_COMPANY?.replace(
              "%entity%",
              `funder [${name}]`
            ) || `Successfully updated funder [${name}].`
        }
        break
      }
      case "vehicles": {
        const lic = data.license_number || ""
        if (action === "DELETE") {
          title =
            dict.MSG_DELETE_SUCCESS?.replace("%data%", `[${lic}]`) ||
            `Vehicle [${lic}] deleted`
          description =
            dict.MSG_SUCCESS_DELETE_DESC_NO_COMPANY?.replace(
              "%entity%",
              `vehicle [${lic}]`
            ) || `Successfully deleted vehicle [${lic}].`
        } else if (action === "INSERT") {
          title =
            dict.MSG_SAVE_SUCCESS?.replace("%data%", `[${lic}]`) ||
            `Vehicle [${lic}] saved`
          description =
            dict.MSG_SUCCESS_SAVE_DESC_NO_COMPANY?.replace(
              "%entity%",
              `vehicle [${lic}]`
            ) || `Successfully saved vehicle [${lic}].`
        } else {
          title =
            dict.MSG_UPDATE_SUCCESS?.replace("%data%", `[${lic}]`) ||
            `Vehicle [${lic}] updated`
          description =
            dict.MSG_SUCCESS_UPDATE_DESC_NO_COMPANY?.replace(
              "%entity%",
              `vehicle [${lic}]`
            ) || `Successfully updated vehicle [${lic}].`
        }
        break
      }
      case "app_settings": {
        const name = data.name || ""
        if (action === "DELETE") {
          title =
            dict.MSG_DELETE_SUCCESS?.replace("%data%", `[${name}]`) ||
            `Setting [${name}] deleted`
          description =
            dict.MSG_SUCCESS_DELETE_DESC_NO_COMPANY?.replace(
              "%entity%",
              `setting [${name}]`
            ) || `Successfully deleted setting [${name}].`
        } else if (action === "INSERT") {
          title =
            dict.MSG_SAVE_SUCCESS?.replace("%data%", `[${name}]`) ||
            `Setting [${name}] saved`
          description =
            dict.MSG_SUCCESS_SAVE_DESC_NO_COMPANY?.replace(
              "%entity%",
              `setting [${name}]`
            ) || `Successfully saved setting [${name}].`
        } else {
          title =
            dict.MSG_UPDATE_SUCCESS?.replace("%data%", `[${name}]`) ||
            `Setting [${name}] updated`
          description =
            dict.MSG_SUCCESS_UPDATE_DESC_NO_COMPANY?.replace(
              "%entity%",
              `setting [${name}]`
            ) || `Successfully updated setting [${name}].`
        }
        break
      }
      case "quotations": {
        const num = data.quotation_number || ""
        const co = getCompanyName(data.company_id)
        if (action === "UPDATE" && newVal.status !== oldVal.status) {
          title =
            dict.MSG_QUOTATION_STATUS_UPDATED?.replace("%data%", `[${num}]`) ||
            `Quotation status [${num}] updated`
          description =
            dict.MSG_SUCCESS_STATUS_DESC?.replace(
              "%status%",
              `[${newVal.status}]`
            ).replace("%company%", co) ||
            `Successfully updated status for quotation [${num}].`
        } else if (action === "DELETE") {
          title =
            dict.MSG_QUOTATION_DELETED?.replace("%data%", `[${num}]`) ||
            `Quotation [${num}] deleted`
          description =
            dict.MSG_SUCCESS_DELETE_DESC?.replace(
              "%entity%",
              "quotation"
            ).replace("%company%", co) ||
            `Successfully deleted quotation [${num}].`
        } else if (action === "INSERT") {
          title =
            dict.MSG_QUOTATION_SAVED?.replace("%data%", `[${num}]`) ||
            `Quotation [${num}] saved`
          description =
            dict.MSG_SUCCESS_SAVE_DESC?.replace(
              "%entity%",
              "quotation"
            ).replace("%company%", co) ||
            `Successfully saved quotation [${num}].`
        } else {
          title =
            dict.MSG_UPDATE_SUCCESS?.replace("%data%", `[${num}]`) ||
            `Quotation [${num}] updated`
          description =
            dict.MSG_SUCCESS_UPDATE_DESC?.replace(
              "%entity%",
              "quotation"
            ).replace("%company%", co) ||
            `Successfully updated quotation [${num}].`
        }
        break
      }
      case "deposits": {
        const num = data.deposit_number || ""
        const co = getCompanyName(data.company_id)
        if (action === "UPDATE" && newVal.status !== oldVal.status) {
          title =
            dict.MSG_DEPOSIT_STATUS_UPDATED?.replace("%data%", `[${num}]`) ||
            `Deposit status [${num}] updated`
          description =
            dict.MSG_SUCCESS_STATUS_DESC?.replace(
              "%status%",
              `[${newVal.status}]`
            ).replace("%company%", co) ||
            `Successfully updated status for deposit [${num}].`
        } else if (action === "DELETE") {
          title =
            dict.MSG_DEPOSIT_DELETED?.replace("%data%", `[${num}]`) ||
            `Deposit [${num}] deleted`
          description =
            dict.MSG_SUCCESS_DELETE_DESC?.replace(
              "%entity%",
              "deposit"
            ).replace("%company%", co) ||
            `Successfully deleted deposit [${num}].`
        } else if (action === "INSERT") {
          title =
            dict.MSG_DEPOSIT_SAVED?.replace("%data%", `[${num}]`) ||
            `Deposit [${num}] saved`
          description =
            dict.MSG_SUCCESS_SAVE_DESC?.replace("%entity%", "deposit").replace(
              "%company%",
              co
            ) || `Successfully saved deposit [${num}].`
        } else {
          title =
            dict.MSG_UPDATE_SUCCESS?.replace("%data%", `[${num}]`) ||
            `Deposit [${num}] updated`
          description =
            dict.MSG_SUCCESS_UPDATE_DESC?.replace(
              "%entity%",
              "deposit"
            ).replace("%company%", co) ||
            `Successfully updated deposit [${num}].`
        }
        break
      }
      case "sales_orders": {
        const num = data.so_number || ""
        const co = getCompanyName(data.company_id)
        if (action === "UPDATE" && newVal.status !== oldVal.status) {
          title =
            dict.MSG_SO_STATUS_UPDATED?.replace("%data%", `[${num}]`) ||
            `Sales Order status [${num}] updated`
          description =
            dict.MSG_SUCCESS_STATUS_DESC?.replace(
              "%status%",
              `[${newVal.status}]`
            ).replace("%company%", co) ||
            `Successfully updated status for sales order [${num}].`
        } else if (action === "DELETE") {
          title =
            dict.MSG_SO_DELETED?.replace("%data%", `[${num}]`) ||
            `Sales Order [${num}] deleted`
          description =
            dict.MSG_SUCCESS_DELETE_DESC?.replace(
              "%entity%",
              "sales order"
            ).replace("%company%", co) ||
            `Successfully deleted sales order [${num}].`
        } else if (action === "INSERT") {
          title =
            dict.MSG_SO_SAVED?.replace("%data%", `[${num}]`) ||
            `Sales Order [${num}] saved`
          description =
            dict.MSG_SUCCESS_SAVE_DESC?.replace(
              "%entity%",
              "sales order"
            ).replace("%company%", co) ||
            `Successfully saved sales order [${num}].`
        } else {
          title =
            dict.MSG_UPDATE_SUCCESS?.replace("%data%", `[${num}]`) ||
            `Sales Order [${num}] updated`
          description =
            dict.MSG_SUCCESS_UPDATE_DESC?.replace(
              "%entity%",
              "sales order"
            ).replace("%company%", co) ||
            `Successfully updated sales order [${num}].`
        }
        break
      }
      case "delivery_orders": {
        const num = data.do_number || ""
        const co = getCompanyName(data.company_id)
        if (action === "UPDATE" && newVal.status !== oldVal.status) {
          title =
            dict.MSG_DO_STATUS_UPDATED?.replace("%data%", `[${num}]`) ||
            `Delivery Order status [${num}] updated`
          description =
            dict.MSG_SUCCESS_STATUS_DESC?.replace(
              "%status%",
              `[${newVal.status}]`
            ).replace("%company%", co) ||
            `Successfully updated status for delivery order [${num}].`
        } else if (action === "DELETE") {
          title =
            dict.MSG_DO_DELETED?.replace("%data%", `[${num}]`) ||
            `Delivery Order [${num}] deleted`
          description =
            dict.MSG_SUCCESS_DELETE_DESC?.replace(
              "%entity%",
              "delivery order"
            ).replace("%company%", co) ||
            `Successfully deleted delivery order [${num}].`
        } else if (action === "INSERT") {
          title =
            dict.MSG_DO_SAVED?.replace("%data%", `[${num}]`) ||
            `Delivery Order [${num}] saved`
          description =
            dict.MSG_SUCCESS_SAVE_DESC?.replace(
              "%entity%",
              "delivery order"
            ).replace("%company%", co) ||
            `Successfully saved delivery order [${num}].`
        } else {
          title =
            dict.MSG_UPDATE_SUCCESS?.replace("%data%", `[${num}]`) ||
            `Delivery Order [${num}] updated`
          description =
            dict.MSG_SUCCESS_UPDATE_DESC?.replace(
              "%entity%",
              "delivery order"
            ).replace("%company%", co) ||
            `Successfully updated delivery order [${num}].`
        }
        break
      }
      case "invoices": {
        const num = data.invoice_number || ""
        const co = getCompanyName(data.company_id)
        if (action === "UPDATE" && newVal.status !== oldVal.status) {
          title = (
            dict.MSG_QUOTATION_STATUS_UPDATED || "Invoice status %data% updated"
          ).replace("%data%", `[${num}]`)
          description =
            dict.MSG_SUCCESS_STATUS_DESC?.replace(
              "%status%",
              `[${newVal.status}]`
            ).replace("%company%", co) ||
            `Successfully updated status for invoice [${num}].`
        } else if (action === "DELETE") {
          title =
            dict.MSG_DELETE_SUCCESS?.replace("%data%", `[${num}]`) ||
            `Invoice [${num}] deleted`
          description =
            dict.MSG_SUCCESS_DELETE_DESC?.replace(
              "%entity%",
              "invoice"
            ).replace("%company%", co) ||
            `Successfully deleted invoice [${num}].`
        } else if (action === "INSERT") {
          title =
            dict.MSG_SAVE_SUCCESS?.replace("%data%", `[${num}]`) ||
            `Invoice [${num}] saved`
          description =
            dict.MSG_SUCCESS_SAVE_DESC?.replace("%entity%", "invoice").replace(
              "%company%",
              co
            ) || `Successfully saved invoice [${num}].`
        } else {
          title =
            dict.MSG_UPDATE_SUCCESS?.replace("%data%", `[${num}]`) ||
            `Invoice [${num}] updated`
          description =
            dict.MSG_SUCCESS_UPDATE_DESC?.replace(
              "%entity%",
              "invoice"
            ).replace("%company%", co) ||
            `Successfully updated invoice [${num}].`
        }
        break
      }
      case "payments": {
        const num = data.payment_number || ""
        const invDetails = invoiceMap[data.invoice_id] || {}
        const co = getCompanyName(invDetails.companyId)
        if (action === "UPDATE" && newVal.status !== oldVal.status) {
          title = (
            dict.MSG_QUOTATION_STATUS_UPDATED || "Payment status %data% updated"
          ).replace("%data%", `[${num}]`)
          description =
            dict.MSG_SUCCESS_STATUS_DESC?.replace(
              "%status%",
              `[${newVal.status}]`
            ).replace("%company%", co) ||
            `Successfully updated status for payment [${num}].`
        } else if (action === "DELETE") {
          title =
            dict.MSG_DELETE_SUCCESS?.replace("%data%", `[${num}]`) ||
            `Payment [${num}] deleted`
          description =
            dict.MSG_SUCCESS_DELETE_DESC?.replace(
              "%entity%",
              "payment"
            ).replace("%company%", co) ||
            `Successfully deleted payment [${num}].`
        } else if (action === "INSERT") {
          title =
            dict.MSG_SAVE_SUCCESS?.replace("%data%", `[${num}]`) ||
            `Payment [${num}] saved`
          description =
            dict.MSG_SUCCESS_SAVE_DESC?.replace("%entity%", "payment").replace(
              "%company%",
              co
            ) || `Successfully saved payment [${num}].`
        } else {
          title =
            dict.MSG_UPDATE_SUCCESS?.replace("%data%", `[${num}]`) ||
            `Payment [${num}] updated`
          description =
            dict.MSG_SUCCESS_UPDATE_DESC?.replace(
              "%entity%",
              "payment"
            ).replace("%company%", co) ||
            `Successfully updated payment [${num}].`
        }
        break
      }
      default: {
        title = `${action} on ${table}`
        description = `Record ID: ${item.record_id}`
        break
      }
    }

    return { title, description, type }
  }
  // Check if scrolling is possible
  const checkScroll = useCallback(() => {
    if (tabStripRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = tabStripRef.current
      setCanScrollLeft(scrollLeft > 0)
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 1)
      setIsOverflowing(scrollWidth > clientWidth)
    }
  }, [])

  useEffect(() => {
    checkScroll()
    window.addEventListener("resize", checkScroll)
    return () => window.removeEventListener("resize", checkScroll)
  }, [tabs, checkScroll])

  const scrollTabs = (direction: "left" | "right") => {
    if (tabStripRef.current) {
      const scrollAmount = 200
      tabStripRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      })
      // Update states after short delay to allow for smooth scroll
      setTimeout(checkScroll, 300)
    }
  }

  // Dynamic font size based on overflow status
  const getTabFontSize = () => {
    if (isOverflowing) return "text-[10px] md:text-xs"
    return "text-xs md:text-sm"
  }

  // Change Password State
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  // Diagnostic Hook: log permissions for debugging
  useEffect(() => {
    console.log("MDI Layout: [DEBUG] User loaded:", user)
    console.log("MDI Layout: [DEBUG] Profile loaded:", profile)
    console.log(
      "MDI Layout: [DEBUG] Resolved Permissions loaded:",
      resolvedPermissions
    )

    if (profile && resolvedPermissions) {
      if (lastToastedUserIdRef.current === profile.id) {
        return // Already logged for this profile load!
      }
      lastToastedUserIdRef.current = profile.id
    } else if (!profile) {
      lastToastedUserIdRef.current = null // Reset on logout
    }
  }, [user, profile, resolvedPermissions])

  // Mapping of tab IDs to their content components
  // Memoize this to prevent remounting of page components when MdiLayout rerenders
  const TAB_REGISTRY = React.useMemo<
    Record<
      string,
      { title: string; content: React.ReactNode; closable?: boolean }
    >
  >(
    () => ({
      dashboard: {
        title: dict.MENU_DASHBOARD,
        content: <DashboardPage />,
        closable: false,
      },
      companies: { title: dict.MENU_COMPANIES, content: <CompaniesPage /> },
      products: { title: dict.MENU_PRODUCTS, content: <ProductsPage /> },
      funders: { title: dict.MENU_FUNDERS, content: <FundersPage /> },
      vehicles: { title: dict.MENU_VEHICLES, content: <VehiclesPage /> },
      deposit: { title: dict.MENU_DEPOSIT, content: <DepositsPage /> },
      quotation: { title: dict.MENU_QUOTATION, content: <QuotationsPage /> },
      "sales-order": {
        title: dict.MENU_SALES_ORDER || "Sales Order",
        content: <SalesOrdersPage />,
      },
      "delivery-order": {
        title: dict.MENU_DELIVERY_ORDER,
        content: <DeliveryOrdersPage />,
      },
      invoice: { title: dict.MENU_INVOICE, content: <InvoicePage /> },
      payments: { title: dict.MENU_PAYMENTS, content: <PaymentsPage /> },
      inventory: {
        title: dict.MENU_REPORTS_INVENTORY || "Inventory Report",
        content: <InventoryReportPage />,
      },
      shipments: { title: dict.MENU_SHIPMENTS, content: <ShipmentsPage /> },
      "report-deposit": {
        title: dict.MENU_REPORTS_DEPOSIT,
        content: <DepositReportPage />,
      },
      "report-quotation": {
        title: dict.MENU_REPORTS_QUOTATION,
        content: <QuotationReportPage />,
      },
      "report-po": {
        title: dict.MENU_REPORTS_SO || "Sales Order Report",
        content: <SalesOrderReportPage />,
      },
      "report-invoice": {
        title: dict.MENU_REPORTS_INVOICE,
        content: <InvoiceReportPage />,
      },
      "report-payments": {
        title: dict.MENU_REPORTS_PAYMENTS,
        content: <PaymentsReportPage />,
      },
      "report-profit-loss": {
        title: dict.MENU_REPORTS_PROFIT_LOSS,
        content: <ProfitLossReportPage />,
      },
      users: { title: dict.MENU_USERS, content: <UsersPage /> },
      settings: { title: dict.MENU_SETTINGS, content: <SettingsPage /> },
      "component-test": {
        title: dict.MENU_SHOWCASE,
        content: <ComponentTestPage />,
      },
    }),
    [dict]
  )

  // Handlers for opening tabs
  const handleOpenDashboard = () =>
    openTab("dashboard", dict.MENU_DASHBOARD, <DashboardPage />, false)
  const handleOpenCompanies = () =>
    openTab("companies", dict.MENU_COMPANIES, <CompaniesPage />)
  const handleOpenProducts = () =>
    openTab("products", dict.MENU_PRODUCTS, <ProductsPage />)
  const handleOpenFunders = () =>
    openTab("funders", dict.MENU_FUNDERS, <FundersPage />)
  const handleOpenVehicles = () =>
    openTab("vehicles", dict.MENU_VEHICLES, <VehiclesPage />)
  const handleOpenDeposit = () =>
    openTab("deposit", dict.MENU_DEPOSIT, <DepositsPage />)
  const handleOpenQuotation = () =>
    openTab("quotation", dict.MENU_QUOTATION, <QuotationsPage />)
  const handleOpenSalesOrder = () =>
    openTab(
      "sales-order",
      dict.MENU_SALES_ORDER || "Sales Order",
      <SalesOrdersPage />
    )
  const handleOpenDeliveryOrder = () =>
    openTab("delivery-order", dict.MENU_DELIVERY_ORDER, <DeliveryOrdersPage />)
  const handleOpenInvoice = () =>
    openTab("invoice", dict.MENU_INVOICE, <InvoicePage />)
  const handleOpenPayments = () =>
    openTab("payments", dict.MENU_PAYMENTS, <PaymentsPage />)
  const handleOpenInventory = () =>
    openTab(
      "inventory",
      dict.MENU_REPORTS_INVENTORY || "Inventory Report",
      <InventoryReportPage />
    )
  const handleOpenShipments = () =>
    openTab("shipments", dict.MENU_SHIPMENTS, <ShipmentsPage />)
  const handleOpenReportDeposit = () =>
    openTab("report-deposit", dict.MENU_REPORTS_DEPOSIT, <DepositReportPage />)
  const handleOpenReportQuotation = () =>
    openTab(
      "report-quotation",
      dict.MENU_REPORTS_QUOTATION,
      <QuotationReportPage />
    )
  const handleOpenReportSO = () =>
    openTab(
      "report-po",
      dict.MENU_REPORTS_SO || "Sales Order Report",
      <SalesOrderReportPage />
    )
  const handleOpenReportInvoice = () =>
    openTab("report-invoice", dict.MENU_REPORTS_INVOICE, <InvoiceReportPage />)
  const handleOpenReportPayments = () =>
    openTab(
      "report-payments",
      dict.MENU_REPORTS_PAYMENTS,
      <PaymentsReportPage />
    )
  const handleOpenReportProfitLoss = () =>
    openTab(
      "report-profit-loss",
      dict.MENU_REPORTS_PROFIT_LOSS,
      <ProfitLossReportPage />
    )
  const handleOpenUsers = () => openTab("users", dict.MENU_USERS, <UsersPage />)
  const handleOpenSettings = () =>
    openTab("settings", dict.MENU_SETTINGS, <SettingsPage />)
  const handleOpenComponentTest = () =>
    openTab("component-test", dict.MENU_SHOWCASE, <ComponentTestPage />)

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()

    if (newPassword.length < 6) {
      notify.error(
        lang === "id"
          ? "Kata sandi baru harus minimal 6 karakter."
          : "New password must be at least 6 characters."
      )
      return
    }

    if (newPassword !== confirmPassword) {
      notify.error(
        lang === "id"
          ? "Kata sandi baru tidak cocok. Silakan coba lagi."
          : "New passwords do not match. Please try again."
      )
      return
    }

    try {
      setIsChangingPassword(true)
      const supabase = createClient()

      // 1. Verify current password by signing in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email,
        password: currentPassword,
      })

      if (signInError) {
        notify.error(
          lang === "id" ? "Gagal" : "Failed",
          lang === "id"
            ? "Kata sandi saat ini salah."
            : "Current password is incorrect."
        )
        setIsChangingPassword(false)
        return
      }

      // 2. Perform password update
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (updateError) throw updateError

      notify.success(
        lang === "id" ? "Keamanan Diperbarui" : "Security Updated",
        lang === "id"
          ? "Kata sandi Anda berhasil diubah."
          : "Your password has been changed successfully."
      )
      setIsChangePasswordOpen(false)
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (error: unknown) {
      const err = error as Error
      notify.error(dict.MSG_SAVE_FAILED || "Save Failed", err.message)
    } finally {
      setIsChangingPassword(false)
    }
  }

  // Restore content for persisted tabs and handle initial routing
  useEffect(() => {
    if (!isRestored) return

    // 1. If we have restored tabs from localStorage, re-attach their content
    tabs.forEach((tab) => {
      if (tab.content === null && TAB_REGISTRY[tab.id]) {
        const { title, content, closable } = TAB_REGISTRY[tab.id]
        openTab(tab.id, title, content, closable)
      }
    })

    // 2. Initial routing if no tabs exist
    if (tabs.length === 0) {
      if (pathname === "/companies") handleOpenCompanies()
      else if (pathname === "/products") handleOpenProducts()
      else if (pathname === "/funders") handleOpenFunders()
      else if (pathname === "/deposit") handleOpenDeposit()
      else if (pathname === "/quotation") handleOpenQuotation()
      else if (pathname === "/sales-order") handleOpenSalesOrder()
      else if (pathname === "/delivery-order") handleOpenDeliveryOrder()
      else if (pathname === "/invoice") handleOpenInvoice()
      else if (pathname === "/payments") handleOpenPayments()
      else if (pathname === "/users") handleOpenUsers()
      else if (pathname === "/shipments") handleOpenShipments()
      else if (pathname === "/reports/inventory") handleOpenInventory()
      else if (pathname === "/settings") handleOpenSettings()
      else if (pathname === "/component-test") handleOpenComponentTest()
      else handleOpenDashboard()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRestored, pathname])

  const userDisplayName =
    profile?.full_name || user?.email?.split("@")[0] || "User"

  // Scroll active tab into view
  useEffect(() => {
    if (activeTabId && tabStripRef.current) {
      const activeTabElement = tabStripRef.current.querySelector(
        `[data-tab-id="${activeTabId}"]`
      )
      if (activeTabElement) {
        activeTabElement.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "center",
        })
      }
    }
  }, [activeTabId])

  const isDashboardActive = activeTabId === "dashboard"
  const isMasterActive =
    activeTabId === "companies" ||
    activeTabId === "products" ||
    activeTabId === "funders" ||
    activeTabId === "vehicles"
  const isTransactionActive = [
    "deposit",
    "quotation",
    "sales-order",
    "delivery-order",
    "invoice",
    "payments",
  ].includes(activeTabId || "")
  const isReportsActive =
    activeTabId === "shipments" ||
    activeTabId === "inventory" ||
    activeTabId?.startsWith("report-")
  const isSystemActive =
    activeTabId === "users" ||
    activeTabId === "component-test" ||
    activeTabId === "settings"

  const renderMenuItems = () => (
    <div className="flex flex-row gap-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          handleOpenDashboard()
          setIsMobileMenuOpen(false)
        }}
        className={cn(
          "flex w-full items-center justify-start gap-2 rounded border-0 px-4 py-1.5 text-xs font-medium shadow-none transition-all duration-150 focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 md:w-auto md:justify-center md:text-sm",
          isDashboardActive
            ? "bg-primary/10 font-semibold text-primary"
            : "text-muted-foreground hover:bg-white/10 hover:text-foreground active:bg-white/15"
        )}
      >
        <LayoutDashboard className="size-4" />
        <span>{dict.MENU_DASHBOARD}</span>
      </Button>

      {(hasPermission("companies", "view") ||
        hasPermission("products", "view") ||
        hasPermission("funders", "view") ||
        hasPermission("vehicles", "view")) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "flex w-full items-center justify-start gap-2 rounded border-0 px-4 py-1.5 text-xs font-medium shadow-none transition-all duration-150 focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 md:w-auto md:justify-center md:text-sm",
                isMasterActive
                  ? "bg-primary/10 font-semibold text-primary"
                  : "text-muted-foreground active:bg-sidebar-accent/80"
              )}
            >
              <MenuIcon className="size-4" />
              <span>{dict.MENU_GROUP_MASTER}</span>
              <ChevronDown className="size-3 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="min-w-full rounded-lg border border-border/60 bg-popover p-1 shadow-none"
          >
            {hasPermission("companies", "view") && (
              <DropdownMenuItem
                onClick={() => {
                  handleOpenCompanies()
                  setIsMobileMenuOpen(false)
                }}
                className="flex cursor-pointer items-center gap-2 rounded p-2 transition-colors focus:bg-muted/50"
              >
                <Building2 className="size-4 text-muted-foreground" />
                <span>{dict.MENU_COMPANIES}</span>
              </DropdownMenuItem>
            )}
            {hasPermission("products", "view") && (
              <DropdownMenuItem
                onClick={() => {
                  handleOpenProducts()
                  setIsMobileMenuOpen(false)
                }}
                className="flex cursor-pointer items-center gap-2 rounded p-2 transition-colors focus:bg-muted/50"
              >
                <Package className="size-4 text-muted-foreground" />
                <span>{dict.MENU_PRODUCTS}</span>
              </DropdownMenuItem>
            )}
            {hasPermission("funders", "view") && (
              <DropdownMenuItem
                onClick={() => {
                  handleOpenFunders()
                  setIsMobileMenuOpen(false)
                }}
                className="flex cursor-pointer items-center gap-2 rounded p-2 transition-colors focus:bg-muted/50"
              >
                <User className="size-4 text-muted-foreground" />
                <span>{dict.MENU_FUNDERS}</span>
              </DropdownMenuItem>
            )}
            {hasPermission("vehicles", "view") && (
              <DropdownMenuItem
                onClick={() => {
                  handleOpenVehicles()
                  setIsMobileMenuOpen(false)
                }}
                className="flex cursor-pointer items-center gap-2 rounded p-2 transition-colors focus:bg-muted/50"
              >
                <Truck className="size-4 text-muted-foreground" />
                <span>{dict.MENU_VEHICLES}</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {(hasPermission("deposit", "view") ||
        hasPermission("quotation", "view") ||
        hasPermission("sales-order", "view") ||
        hasPermission("delivery-order", "view") ||
        hasPermission("invoice", "view") ||
        hasPermission("payments", "view")) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "flex items-center justify-start gap-2 rounded border-0 px-4 py-1.5 text-xs font-medium shadow-none transition-all duration-150 focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 md:justify-center md:text-sm",
                isTransactionActive
                  ? "bg-primary/10 font-semibold text-primary"
                  : "text-muted-foreground active:bg-white/15"
              )}
            >
              <Banknote className="size-4" />
              <span>{dict.MENU_TRANSACTION}</span>
              <ChevronDown className="size-3 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-full min-w-full rounded-lg border border-border/60 bg-popover p-1 shadow-none"
          >
            {hasPermission("deposit", "view") && (
              <DropdownMenuItem
                onClick={() => {
                  handleOpenDeposit()
                  setIsMobileMenuOpen(false)
                }}
                className="flex cursor-pointer items-center gap-2 rounded p-2 transition-colors focus:bg-muted/50"
              >
                <ArrowDownToLine className="size-4 text-muted-foreground" />
                <span>{dict.MENU_DEPOSIT}</span>
              </DropdownMenuItem>
            )}
            {hasPermission("quotation", "view") && (
              <DropdownMenuItem
                onClick={() => {
                  handleOpenQuotation()
                  setIsMobileMenuOpen(false)
                }}
                className="flex cursor-pointer items-center gap-2 rounded p-2 transition-colors focus:bg-muted/50"
              >
                <ClipboardList className="size-4 text-muted-foreground" />
                <span>{dict.MENU_QUOTATION}</span>
              </DropdownMenuItem>
            )}
            {hasPermission("sales-order", "view") && (
              <DropdownMenuItem
                onClick={() => {
                  handleOpenSalesOrder()
                  setIsMobileMenuOpen(false)
                }}
                className="flex cursor-pointer items-center gap-2 rounded p-2 transition-colors focus:bg-muted/50"
              >
                <ShoppingBag className="size-4 text-muted-foreground" />
                <span>{dict.MENU_SALES_ORDER}</span>
              </DropdownMenuItem>
            )}
            {hasPermission("delivery-order", "view") && (
              <DropdownMenuItem
                onClick={() => {
                  handleOpenDeliveryOrder()
                  setIsMobileMenuOpen(false)
                }}
                className="flex cursor-pointer items-center gap-2 rounded p-2 transition-colors focus:bg-muted/50"
              >
                <Truck className="size-4 text-muted-foreground" />
                <span>{dict.MENU_DELIVERY_ORDER}</span>
              </DropdownMenuItem>
            )}
            {hasPermission("invoice", "view") && (
              <DropdownMenuItem
                onClick={() => {
                  handleOpenInvoice()
                  setIsMobileMenuOpen(false)
                }}
                className="flex cursor-pointer items-center gap-2 rounded p-2 transition-colors focus:bg-muted/50"
              >
                <Receipt className="size-4 text-muted-foreground" />
                <span>{dict.MENU_INVOICE}</span>
              </DropdownMenuItem>
            )}
            {hasPermission("payments", "view") && (
              <DropdownMenuItem
                onClick={() => {
                  handleOpenPayments()
                  setIsMobileMenuOpen(false)
                }}
                className="flex cursor-pointer items-center gap-2 rounded p-2 transition-colors focus:bg-muted/50"
              >
                <Wallet className="size-4 text-muted-foreground" />
                <span>{dict.MENU_PAYMENTS}</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {(hasPermission("shipments", "view") ||
        hasPermission("inventory", "view")) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "flex w-full items-center justify-start gap-2 rounded border-0 px-4 py-1.5 text-xs font-medium shadow-none transition-all duration-150 focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 md:w-auto md:justify-center md:text-sm",
                isReportsActive
                  ? "bg-primary/10 font-semibold text-primary"
                  : "text-muted-foreground active:bg-white/15"
              )}
            >
              <Truck className="size-4" />
              <span>{dict.MENU_GROUP_REPORTS}</span>
              <ChevronDown className="size-3 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-full min-w-full rounded-lg border border-border/60 bg-popover p-1 shadow-none"
          >
            {hasPermission("inventory", "view") && (
              <DropdownMenuItem
                onClick={() => {
                  handleOpenInventory()
                  setIsMobileMenuOpen(false)
                }}
                className="flex cursor-pointer items-center gap-2 rounded p-2 transition-colors focus:bg-muted/50"
              >
                <Warehouse className="size-4 text-muted-foreground" />
                <span>{dict.MENU_REPORTS_INVENTORY || "Inventory Report"}</span>
              </DropdownMenuItem>
            )}
            {hasPermission("shipments", "view") && (
              <DropdownMenuItem
                onClick={() => {
                  handleOpenShipments()
                  setIsMobileMenuOpen(false)
                }}
                className="flex cursor-pointer items-center gap-2 rounded p-2 transition-colors focus:bg-muted/50"
              >
                <Truck className="size-4 text-muted-foreground" />
                <span>{dict.MENU_SHIPMENTS}</span>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator className="my-1 border-border/60" />
            {hasPermission("deposit", "view") && (
              <DropdownMenuItem
                onClick={() => {
                  handleOpenReportDeposit()
                  setIsMobileMenuOpen(false)
                }}
                className="flex cursor-pointer items-center gap-2 rounded p-2 transition-colors focus:bg-muted/50"
              >
                <ArrowDownToLine className="size-4 text-muted-foreground" />
                <span>{dict.MENU_REPORTS_DEPOSIT}</span>
              </DropdownMenuItem>
            )}
            {hasPermission("quotation", "view") && (
              <DropdownMenuItem
                onClick={() => {
                  handleOpenReportQuotation()
                  setIsMobileMenuOpen(false)
                }}
                className="flex cursor-pointer items-center gap-2 rounded p-2 transition-colors focus:bg-muted/50"
              >
                <ClipboardList className="size-4 text-muted-foreground" />
                <span>{dict.MENU_REPORTS_QUOTATION}</span>
              </DropdownMenuItem>
            )}
            {hasPermission("sales-order", "view") && (
              <DropdownMenuItem
                onClick={() => {
                  handleOpenReportSO()
                  setIsMobileMenuOpen(false)
                }}
                className="flex cursor-pointer items-center gap-2 rounded p-2 transition-colors focus:bg-muted/50"
              >
                <ShoppingBag className="size-4 text-muted-foreground" />
                <span>{dict.MENU_REPORTS_SO}</span>
              </DropdownMenuItem>
            )}
            {hasPermission("invoice", "view") && (
              <DropdownMenuItem
                onClick={() => {
                  handleOpenReportInvoice()
                  setIsMobileMenuOpen(false)
                }}
                className="flex cursor-pointer items-center gap-2 rounded p-2 transition-colors focus:bg-muted/50"
              >
                <Receipt className="size-4 text-muted-foreground" />
                <span>{dict.MENU_REPORTS_INVOICE}</span>
              </DropdownMenuItem>
            )}
            {hasPermission("payments", "view") && (
              <DropdownMenuItem
                onClick={() => {
                  handleOpenReportPayments()
                  setIsMobileMenuOpen(false)
                }}
                className="flex cursor-pointer items-center gap-2 rounded p-2 transition-colors focus:bg-muted/50"
              >
                <Wallet className="size-4 text-muted-foreground" />
                <span>{dict.MENU_REPORTS_PAYMENTS}</span>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator className="my-1 border-border/60" />
            <DropdownMenuItem
              onClick={() => {
                handleOpenReportProfitLoss()
                setIsMobileMenuOpen(false)
              }}
              className="flex cursor-pointer items-center gap-2 rounded p-2 font-semibold text-emerald-600 transition-colors focus:bg-muted/50"
            >
              <Activity className="size-4" />
              <span>{dict.MENU_REPORTS_PROFIT_LOSS || "Profit & Loss"}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {(hasPermission("users", "view") ||
        hasPermission("component-test", "view") ||
        hasPermission("settings", "view")) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "flex w-full items-center justify-start gap-2 rounded border-0 px-4 py-1.5 text-xs font-medium shadow-none transition-all duration-150 focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 md:w-auto md:justify-center md:text-sm",
                isSystemActive
                  ? "bg-primary/10 font-semibold text-primary"
                  : "text-muted-foreground active:bg-white/15"
              )}
            >
              <UserCog className="size-4" />
              <span>{dict.MENU_GROUP_SYSTEM}</span>
              <ChevronDown className="size-3 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-full min-w-full rounded-lg border border-border/60 bg-popover p-1 shadow-none"
          >
            {hasPermission("users", "view") && (
              <DropdownMenuItem
                onClick={() => {
                  handleOpenUsers()
                  setIsMobileMenuOpen(false)
                }}
                className="flex cursor-pointer items-center gap-2 rounded p-2 transition-colors focus:bg-muted/50"
              >
                <UserCog className="size-4 text-muted-foreground" />
                <span>{dict.MENU_USERS}</span>
              </DropdownMenuItem>
            )}
            {hasPermission("settings", "view") && (
              <DropdownMenuItem
                onClick={() => {
                  handleOpenSettings()
                  setIsMobileMenuOpen(false)
                }}
                className="flex cursor-pointer items-center gap-2 rounded p-2 transition-colors focus:bg-muted/50"
              >
                <Settings className="size-4 text-muted-foreground" />
                <span>{dict.MENU_SETTINGS}</span>
              </DropdownMenuItem>
            )}
            {hasPermission("component-test", "view") && (
              <DropdownMenuItem
                onClick={() => {
                  handleOpenComponentTest()
                  setIsMobileMenuOpen(false)
                }}
                className="flex cursor-pointer items-center gap-2 rounded p-2 transition-colors focus:bg-muted/50"
              >
                <Languages className="size-4 text-muted-foreground" />
                <span>{dict.MENU_SHOWCASE}</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )

  return (
    <div className="mx-auto flex h-screen max-w-[1800px] flex-col overflow-hidden bg-background">
      {/* Top Navbar */}
      <header className="z-50 flex h-14 shrink-0 items-center justify-between border-b border-border/60 bg-card px-6 shadow-none">
        <div className="flex items-center gap-6">
          <div className="cursor-pointer text-lg font-bold tracking-tight transition-opacity hover:opacity-85">
            {config.brandName}
          </div>

          {/* Desktop Menu */}
          <nav className="hidden items-center gap-1 md:flex">
            {renderMenuItems()}
          </nav>

          {/* Mobile Menu Trigger */}
          <div className="md:hidden">
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-md">
                  <MenuIcon className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="w-[280px] border-r border-border/60 bg-background p-6 shadow-none"
              >
                <SheetHeader className="mb-4 border-b border-border/60 pb-4 text-left">
                  <SheetTitle className="text-xl font-bold">
                    {config.brandName}
                  </SheetTitle>
                </SheetHeader>
                <div className="mt-4 flex flex-col gap-2">
                  {renderMenuItems()}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Notification Bell Dropdown */}
          <DropdownMenu
            onOpenChange={(open) => {
              if (open) setHasUnread(false)
            }}
          >
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative flex size-9 items-center justify-center rounded-full border border-border/60 p-0 transition-colors hover:bg-muted/50"
              >
                <Bell className="size-5 text-muted-foreground" />
                {hasUnread && (
                  <span className="absolute top-1.5 right-1.5 flex h-2 w-2 rounded-full bg-destructive" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="z-50 max-h-[480px] w-80 overflow-y-auto rounded-lg border border-border/60 bg-popover p-1 shadow-lg"
            >
              <DropdownMenuLabel className="flex items-center justify-between p-2.5 text-sm font-semibold">
                <span>
                  {lang === "id"
                    ? "Riwayat Notifikasi"
                    : "Notification History"}
                </span>
                {notifications.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearNotifications}
                    className="h-auto px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    {lang === "id" ? "Bersihkan" : "Clear All"}
                  </Button>
                )}
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="my-1 border-border/60" />
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  {lang === "id"
                    ? "Tidak ada notifikasi."
                    : "No notifications yet."}
                </div>
              ) : (
                notifications.map((item) => {
                  const formatted = formatNotification(item)
                  return (
                    <div
                      key={item.id}
                      className="flex flex-col items-start gap-1 border-b border-border/40 p-2.5 last:border-b-0"
                    >
                      <div className="flex w-full items-center justify-between">
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[10px] font-semibold",
                            getBadgeStyle(formatted.type)
                          )}
                        >
                          {formatted.type.toUpperCase()}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {formatTime(item.timestamp)}
                        </span>
                      </div>
                      <span className="text-xs leading-snug font-semibold text-foreground">
                        {formatted.title}
                      </span>
                      {formatted.description && (
                        <span className="text-[11px] leading-normal text-muted-foreground">
                          {formatted.description}
                        </span>
                      )}
                    </div>
                  )
                })
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User Profile Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="flex size-9 items-center justify-center rounded-full border border-border bg-gradient-to-br from-secondary to-white p-0"
              >
                <User className="size-5 text-secondary-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-56 rounded-lg border border-border/60 bg-popover p-1 shadow-none"
            >
              <DropdownMenuLabel className="p-2.5 font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm leading-none font-semibold">
                    {userDisplayName}
                  </p>
                  <p className="truncate text-xs leading-none text-muted-foreground">
                    {user?.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="my-1 border-border/60" />

              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="flex cursor-pointer items-center gap-2 rounded p-2 transition-colors">
                  <Languages className="size-4 text-muted-foreground" />
                  <span>
                    {dict.LABEL_LANGUAGE} ({lang.toUpperCase()})
                  </span>
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent className="rounded-lg border border-border/60 bg-popover p-1 shadow-none">
                    <DropdownMenuItem
                      onClick={() => changeLanguage("en")}
                      className="flex cursor-pointer items-center rounded p-2 transition-colors"
                    >
                      <span>English</span>
                      {lang === "en" && (
                        <span className="ml-auto text-primary">✓</span>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => changeLanguage("id")}
                      className="flex cursor-pointer items-center rounded p-2 transition-colors"
                    >
                      <span>Bahasa Indonesia</span>
                      {lang === "id" && (
                        <span className="ml-auto text-primary">✓</span>
                      )}
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="flex cursor-pointer items-center gap-2 rounded p-2 transition-colors">
                  <Sun className="size-4 text-muted-foreground dark:hidden" />
                  <Moon className="hidden size-4 text-muted-foreground dark:block" />
                  <span>{dict.LABEL_THEME}</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent className="rounded-lg border border-border/60 bg-popover p-1 shadow-none">
                    <DropdownMenuItem
                      onClick={() => setTheme("light")}
                      className="flex cursor-pointer items-center gap-2 rounded p-2 transition-colors"
                    >
                      <Sun className="size-4 text-muted-foreground" />
                      <span>{dict.LABEL_LIGHT}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setTheme("dark")}
                      className="flex cursor-pointer items-center gap-2 rounded p-2 transition-colors"
                    >
                      <Moon className="size-4 text-muted-foreground" />
                      <span>{dict.LABEL_DARK}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setTheme("system")}
                      className="flex cursor-pointer items-center gap-2 rounded p-2 transition-colors"
                    >
                      <Monitor className="size-4 text-muted-foreground" />
                      <span>{dict.LABEL_SYSTEM}</span>
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>

              <DropdownMenuSeparator className="my-1 border-border/60" />
              <DropdownMenuItem
                onClick={() => setIsChangePasswordOpen(true)}
                className="flex cursor-pointer items-center gap-2 rounded p-2 transition-colors"
              >
                <Key className="size-4 text-muted-foreground" />
                <span>{dict.TITLE_RESET_PWD || "Change Password"}</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={signOut}
                className="flex cursor-pointer items-center gap-2 rounded p-2 text-destructive transition-colors focus:bg-destructive/10 focus:text-destructive"
              >
                <LogOut className="size-4" />
                <span>{dict.MENU_LOGOUT}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Tab Strip */}
      <div className="group/tabstrip relative flex h-10 shrink-0 items-center gap-1 overflow-hidden border-b border-border/60 bg-muted/5 px-2">
        {/* Scroll Left Button */}
        {canScrollLeft && (
          <Button
            variant="ghost"
            size="icon"
            className="z-20 size-7 shrink-0 rounded-full border border-gray-400 bg-background/80 shadow-sm backdrop-blur-sm hover:bg-muted"
            onClick={() => scrollTabs("left")}
          >
            <ChevronLeft className="size-4" />
          </Button>
        )}

        <div
          ref={tabStripRef}
          onScroll={checkScroll}
          className="no-scrollbar flex h-full flex-1 items-end gap-1 overflow-x-auto scroll-smooth"
        >
          {tabs.map((tab) => {
            const registryItem = TAB_REGISTRY[tab.id]
            const displayTitle = registryItem ? registryItem.title : tab.title
            const isActive = activeTabId === tab.id

            return (
              <div
                key={tab.id}
                data-tab-id={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className={cn(
                  "relative z-10 -mb-[1px] flex h-9 max-w-[180px] min-w-[100px] cursor-pointer items-center justify-between gap-1.5 rounded-t-md border-x border-t pr-1.5 pl-3 font-medium whitespace-nowrap transition-all duration-150 ease-in-out",
                  getTabFontSize(),
                  isActive
                    ? "border-x-primary border-t-primary border-b-transparent bg-primary/15 font-semibold text-primary"
                    : "border-x-border/80 border-t-border/80 border-b-border/60 bg-transparent text-muted-foreground hover:bg-muted/10 hover:text-foreground"
                )}
              >
                <span className="relative z-10 flex-1 truncate text-left">
                  {displayTitle}
                </span>
                {tab.closable !== false && (
                  <button
                    className={cn(
                      "relative z-20 flex size-4 shrink-0 items-center justify-center rounded-full bg-destructive/30 text-destructive-foreground transition-colors hover:bg-destructive/70"
                    )}
                    onClick={(e) => {
                      e.stopPropagation()
                      closeTab(tab.id)
                    }}
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* Scroll Right Button */}
        {canScrollRight && (
          <Button
            variant="ghost"
            size="icon"
            className="z-20 size-7 shrink-0 rounded-full border border-gray-400 bg-background/80 shadow-sm backdrop-blur-sm hover:bg-muted"
            onClick={() => scrollTabs("right")}
          >
            <ChevronRight className="size-4" />
          </Button>
        )}
      </div>

      {/* Content Area */}
      <main className="relative flex-1 overflow-hidden bg-muted/10">
        {tabs.map((tab) => {
          const registryItem = TAB_REGISTRY[tab.id]
          const displayContent = registryItem
            ? registryItem.content
            : tab.content

          return (
            <div
              key={tab.id}
              className={cn(
                "absolute inset-0 flex min-h-0 flex-col overflow-hidden",
                activeTabId === tab.id
                  ? "flex animate-in duration-300 fade-in"
                  : "hidden"
              )}
            >
              {displayContent}
            </div>
          )
        })}
      </main>

      {/* Change Password Dialog Modal */}
      <Dialog
        open={isChangePasswordOpen}
        onOpenChange={setIsChangePasswordOpen}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {lang === "id" ? "Ubah Kata Sandi" : "Change Password"}
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={handleChangePassword}
            className="flex flex-col gap-6 p-5"
          >
            <div className="grid grid-cols-1 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="current_password">
                  {lang === "id" ? "Kata Sandi Saat Ini" : "Current Password"}{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="current_password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="new_password">
                  {lang === "id" ? "Kata Sandi Baru" : "New Password"}{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="new_password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="confirm_password">
                  {lang === "id"
                    ? "Konfirmasi Kata Sandi Baru"
                    : "Confirm New Password"}{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="confirm_password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <DialogFooter className="mt-2 h-22 gap-2 *:w-full *:flex-1 sm:h-auto">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsChangePasswordOpen(false)
                  setCurrentPassword("")
                  setNewPassword("")
                  setConfirmPassword("")
                }}
              >
                <X data-icon="inline-start" />
                {dict.BUTTON_CANCEL}
              </Button>
              <Button type="submit" disabled={isChangingPassword}>
                {isChangingPassword ? (
                  <ButtonLoader />
                ) : (
                  <Save data-icon="inline-start" />
                )}
                {lang === "id" ? "Ubah Kata Sandi" : "Change Password"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
