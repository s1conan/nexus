"use client"

import React, { useRef, useEffect, useState } from "react"
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
  Menu as MenuIcon,
  Languages,
  Sun,
  Moon,
  Monitor,
  User,
  Key,
  Save,
  Banknote,
  FileText,
  ShoppingBag,
  Receipt,
  Wallet,
  ArrowDownToLine,
  ClipboardList
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
  DialogFooter
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
  SheetTrigger
} from "@/components/ui/sheet"

// Import components for tabs
import DashboardPage from "@/app/dashboard/page"
import CompaniesPage from "@/app/companies/page"
import ProductsPage from "@/app/products/page"
import UsersPage from "@/app/users/page"
import ShipmentsPage from "@/app/shipments-placeholder"
import ComponentTestPage from "@/app/component-test/page"
import SettingsPage from "@/app/settings/page"
import QuotationsPage from "@/app/quotations/page"
import DepositsPage from "@/app/deposit/page"
import PurchaseOrdersPage from "@/app/purchase-order/page"
import DeliveryOrdersPage from "@/app/delivery-order/page"
import VehiclesPage from "@/app/vehicles/page"

function TransactionPlaceholder({ title, icon: Icon }: { title: string; icon: any }) {
  const { dict } = useDictionary()
  return (
    <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4">
      <Icon className="size-16 opacity-20" />
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="max-w-xs text-center">{dict.NO_DATA}</p>
    </div>
  )
}

export function MdiLayout() {
  const { dict, config, lang } = useDictionary()
  const { tabs, activeTabId, openTab, closeTab, setActiveTabId, isRestored } = useMdi()
  const { user, profile, signOut, changeLanguage, hasPermission, resolvedPermissions } = useAuth()
  const { setTheme } = useTheme()
  const pathname = usePathname()
  const tabStripRef = useRef<HTMLDivElement>(null)
  const lastToastedUserIdRef = useRef<string | null>(null)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  // Change Password State
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  // Diagnostic Hook: log and toast permissions for debugging
  useEffect(() => {
    console.log("MDI Layout: [DEBUG] User loaded:", user)
    console.log("MDI Layout: [DEBUG] Profile loaded:", profile)
    console.log("MDI Layout: [DEBUG] Resolved Permissions loaded:", resolvedPermissions)
    
    if (profile && resolvedPermissions) {
      if (lastToastedUserIdRef.current === profile.id) {
        return // Already toasted for this profile load!
      }
      
      const activeModules = Object.keys(resolvedPermissions).filter(
        key => resolvedPermissions[key] && Object.values(resolvedPermissions[key]).some(val => val === true)
      )
      notify.info(
        `User Loaded: ${profile.username} (${profile.role.toUpperCase()})`,
        `Permissions active for: ${activeModules.join(", ") || "none"}. Check browser developer tools console for raw details.`
      )
      lastToastedUserIdRef.current = profile.id
    } else if (!profile) {
      lastToastedUserIdRef.current = null // Reset on logout
    }
  }, [user, profile, resolvedPermissions])

  // Mapping of tab IDs to their content components
  // Memoize this to prevent remounting of page components when MdiLayout rerenders
  const TAB_REGISTRY = React.useMemo<Record<string, { title: string; content: React.ReactNode; closable?: boolean }>>(() => ({
    dashboard: { title: dict.MENU_DASHBOARD, content: <DashboardPage />, closable: false },
    companies: { title: dict.MENU_COMPANIES, content: <CompaniesPage /> },
    products: { title: dict.MENU_PRODUCTS, content: <ProductsPage /> },
    vehicles: { title: dict.MENU_VEHICLES, content: <VehiclesPage /> },
    deposit: { title: dict.MENU_DEPOSIT, content: <DepositsPage /> },
    quotation: { title: dict.MENU_QUOTATION, content: <QuotationsPage /> },
    "purchase-order": { title: dict.MENU_PURCHASE_ORDER, content: <PurchaseOrdersPage /> },
    "delivery-order": { title: dict.MENU_DELIVERY_ORDER, content: <DeliveryOrdersPage /> },
    invoice: { title: dict.MENU_INVOICE, content: <TransactionPlaceholder title={dict.MENU_INVOICE} icon={Receipt} /> },
    payments: { title: dict.MENU_PAYMENTS, content: <TransactionPlaceholder title={dict.MENU_PAYMENTS} icon={Wallet} /> },
    shipments: { title: dict.MENU_SHIPMENTS, content: <ShipmentsPage /> },
    users: { title: dict.MENU_USERS, content: <UsersPage /> },
    settings: { title: dict.MENU_SETTINGS, content: <SettingsPage /> },
    "component-test": { title: dict.MENU_SHOWCASE, content: <ComponentTestPage /> },
  }), [dict])

  // Handlers for opening tabs
  const handleOpenDashboard = () => openTab("dashboard", dict.MENU_DASHBOARD, <DashboardPage />, false)
  const handleOpenCompanies = () => openTab("companies", dict.MENU_COMPANIES, <CompaniesPage />)
  const handleOpenProducts = () => openTab("products", dict.MENU_PRODUCTS, <ProductsPage />)
  const handleOpenVehicles = () => openTab("vehicles", dict.MENU_VEHICLES, <VehiclesPage />)
  const handleOpenDeposit = () => openTab("deposit", dict.MENU_DEPOSIT, <DepositsPage />)
  const handleOpenQuotation = () => openTab("quotation", dict.MENU_QUOTATION, <QuotationsPage />)
  const handleOpenPurchaseOrder = () => openTab("purchase-order", dict.MENU_PURCHASE_ORDER, <PurchaseOrdersPage />)
  const handleOpenDeliveryOrder = () => openTab("delivery-order", dict.MENU_DELIVERY_ORDER, <DeliveryOrdersPage />)
  const handleOpenInvoice = () => openTab("invoice", dict.MENU_INVOICE, <TransactionPlaceholder title={dict.MENU_INVOICE} icon={Receipt} />)
  const handleOpenPayments = () => openTab("payments", dict.MENU_PAYMENTS, <TransactionPlaceholder title={dict.MENU_PAYMENTS} icon={Wallet} />)
  const handleOpenShipments = () => openTab("shipments", dict.MENU_SHIPMENTS, <ShipmentsPage />)
  const handleOpenUsers = () => openTab("users", dict.MENU_USERS, <UsersPage />)
  const handleOpenSettings = () => openTab("settings", dict.MENU_SETTINGS, <SettingsPage />)
  const handleOpenComponentTest = () => openTab("component-test", dict.MENU_SHOWCASE, <ComponentTestPage />)

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (newPassword.length < 6) {
      notify.error(lang === "id" ? "Kata sandi baru harus minimal 6 karakter." : "New password must be at least 6 characters.")
      return
    }
    
    if (newPassword !== confirmPassword) {
      notify.error(lang === "id" ? "Kata sandi baru tidak cocok. Silakan coba lagi." : "New passwords do not match. Please try again.")
      return
    }
    
    try {
      setIsChangingPassword(true)
      const supabase = createClient()
      
      // 1. Verify current password by signing in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email,
        password: currentPassword
      })

      if (signInError) {
        notify.error(
          lang === "id" ? "Gagal" : "Failed",
          lang === "id" ? "Kata sandi saat ini salah." : "Current password is incorrect."
        )
        setIsChangingPassword(false)
        return
      }

      // 2. Perform password update
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
      
      if (updateError) throw updateError
      
      notify.success(
        lang === "id" ? "Keamanan Diperbarui" : "Security Updated",
        lang === "id" ? "Kata sandi Anda berhasil diubah." : "Your password has been changed successfully."
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
    tabs.forEach(tab => {
      if (tab.content === null && TAB_REGISTRY[tab.id]) {
        const { title, content, closable } = TAB_REGISTRY[tab.id]
        openTab(tab.id, title, content, closable)
      }
    })

    // 2. Initial routing if no tabs exist
    if (tabs.length === 0) {
      if (pathname === "/companies") handleOpenCompanies()
      else if (pathname === "/products") handleOpenProducts()
      else if (pathname === "/deposit") handleOpenDeposit()
      else if (pathname === "/quotation") handleOpenQuotation()
      else if (pathname === "/purchase-order") handleOpenPurchaseOrder()
      else if (pathname === "/delivery-order") handleOpenDeliveryOrder()
      else if (pathname === "/invoice") handleOpenInvoice()
      else if (pathname === "/payments") handleOpenPayments()
      else if (pathname === "/users") handleOpenUsers()
      else if (pathname === "/shipments") handleOpenShipments()
      else if (pathname === "/settings") handleOpenSettings()
      else if (pathname === "/component-test") handleOpenComponentTest()
      else handleOpenDashboard()
    }
  }, [isRestored, pathname])

  const userDisplayName = profile?.full_name || user?.email?.split('@')[0] || "User"


  // Scroll active tab into view
  useEffect(() => {
    if (activeTabId && tabStripRef.current) {
      const activeTabElement = tabStripRef.current.querySelector(`[data-tab-id="${activeTabId}"]`)
      if (activeTabElement) {
        activeTabElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
      }
    }
  }, [activeTabId])

  const isDashboardActive = activeTabId === 'dashboard'
  const isMasterActive = activeTabId === 'companies' || activeTabId === 'products'
  const isTransactionActive = ['deposit', 'quotation', 'purchase-order', 'delivery-order', 'invoice', 'payments'].includes(activeTabId || '')
  const isReportsActive = activeTabId === 'shipments'
  const isSystemActive = activeTabId === 'users' || activeTabId === 'component-test' || activeTabId === 'settings'

  const renderMenuItems = () => (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => { handleOpenDashboard(); setIsMobileMenuOpen(false); }}
        className={cn(
          "justify-start md:justify-center w-full md:w-auto px-4 py-1.5 rounded text-xs md:text-sm font-medium transition-all duration-150 flex items-center gap-2 border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none focus:ring-0",
          isDashboardActive
            ? "bg-primary/10 text-primary font-semibold"
            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
        )}
      >
        <LayoutDashboard className="size-4" />
        <span>{dict.MENU_DASHBOARD}</span>
      </Button>

      {(hasPermission('companies', 'view') || hasPermission('products', 'view')) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "justify-start md:justify-center w-full md:w-auto px-4 py-1.5 rounded text-xs md:text-sm font-medium transition-all duration-150 flex items-center gap-2 border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none focus:ring-0",
                isMasterActive
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              <MenuIcon className="size-4" />
              <span>{dict.MENU_GROUP_MASTER}</span>
              <ChevronDown className="size-3 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="rounded-lg p-1 bg-popover border border-border/60 shadow-none">
            {hasPermission('companies', 'view') && (
              <DropdownMenuItem onClick={() => { handleOpenCompanies(); setIsMobileMenuOpen(false); }} className="rounded p-2 transition-colors focus:bg-muted/50 cursor-pointer flex items-center gap-2">
                <Building2 className="size-4 text-muted-foreground" />
                <span>{dict.MENU_COMPANIES}</span>
              </DropdownMenuItem>
            )}
            {hasPermission('products', 'view') && (
              <DropdownMenuItem onClick={() => { handleOpenProducts(); setIsMobileMenuOpen(false); }} className="rounded p-2 transition-colors focus:bg-muted/50 cursor-pointer flex items-center gap-2">
                <Package className="size-4 text-muted-foreground" />
                <span>{dict.MENU_PRODUCTS}</span>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => { handleOpenVehicles(); setIsMobileMenuOpen(false); }} className="rounded p-2 transition-colors focus:bg-muted/50 cursor-pointer flex items-center gap-2">
              <Truck className="size-4 text-muted-foreground" />
              <span>{dict.MENU_VEHICLES}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {(hasPermission('deposit', 'view') || 
        hasPermission('quotation', 'view') || 
        hasPermission('purchase-order', 'view') || 
        hasPermission('delivery-order', 'view') || 
        hasPermission('invoice', 'view') || 
        hasPermission('payments', 'view')) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "justify-start md:justify-center w-full md:w-auto px-4 py-1.5 rounded text-xs md:text-sm font-medium transition-all duration-150 flex items-center gap-2 border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none focus:ring-0",
                isTransactionActive
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              <Banknote className="size-4" />
              <span>{dict.MENU_TRANSACTION}</span>
              <ChevronDown className="size-3 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="rounded-lg p-1 bg-popover border border-border/60 shadow-none">
            {hasPermission('deposit', 'view') && (
              <DropdownMenuItem onClick={() => { handleOpenDeposit(); setIsMobileMenuOpen(false); }} className="rounded p-2 transition-colors focus:bg-muted/50 cursor-pointer flex items-center gap-2">
                <ArrowDownToLine className="size-4 text-muted-foreground" />
                <span>{dict.MENU_DEPOSIT}</span>
              </DropdownMenuItem>
            )}
            {hasPermission('quotation', 'view') && (
              <DropdownMenuItem onClick={() => { handleOpenQuotation(); setIsMobileMenuOpen(false); }} className="rounded p-2 transition-colors focus:bg-muted/50 cursor-pointer flex items-center gap-2">
                <ClipboardList className="size-4 text-muted-foreground" />
                <span>{dict.MENU_QUOTATION}</span>
              </DropdownMenuItem>
            )}
            {hasPermission('purchase-order', 'view') && (
              <DropdownMenuItem onClick={() => { handleOpenPurchaseOrder(); setIsMobileMenuOpen(false); }} className="rounded p-2 transition-colors focus:bg-muted/50 cursor-pointer flex items-center gap-2">
                <ShoppingBag className="size-4 text-muted-foreground" />
                <span>{dict.MENU_PURCHASE_ORDER}</span>
              </DropdownMenuItem>
            )}
            {hasPermission('delivery-order', 'view') && (
              <DropdownMenuItem onClick={() => { handleOpenDeliveryOrder(); setIsMobileMenuOpen(false); }} className="rounded p-2 transition-colors focus:bg-muted/50 cursor-pointer flex items-center gap-2">
                <Truck className="size-4 text-muted-foreground" />
                <span>{dict.MENU_DELIVERY_ORDER}</span>
              </DropdownMenuItem>
            )}
            {hasPermission('invoice', 'view') && (
              <DropdownMenuItem onClick={() => { handleOpenInvoice(); setIsMobileMenuOpen(false); }} className="rounded p-2 transition-colors focus:bg-muted/50 cursor-pointer flex items-center gap-2">
                <Receipt className="size-4 text-muted-foreground" />
                <span>{dict.MENU_INVOICE}</span>
              </DropdownMenuItem>
            )}
            {hasPermission('payments', 'view') && (
              <DropdownMenuItem onClick={() => { handleOpenPayments(); setIsMobileMenuOpen(false); }} className="rounded p-2 transition-colors focus:bg-muted/50 cursor-pointer flex items-center gap-2">
                <Wallet className="size-4 text-muted-foreground" />
                <span>{dict.MENU_PAYMENTS}</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {hasPermission('shipments', 'view') && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "justify-start md:justify-center w-full md:w-auto px-4 py-1.5 rounded text-xs md:text-sm font-medium transition-all duration-150 flex items-center gap-2 border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none focus:ring-0",
                isReportsActive
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              <Truck className="size-4" />
              <span>{dict.MENU_GROUP_REPORTS}</span>
              <ChevronDown className="size-3 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="rounded-lg p-1 bg-popover border border-border/60 shadow-none">
            <DropdownMenuItem onClick={() => { handleOpenShipments(); setIsMobileMenuOpen(false); }} className="rounded p-2 transition-colors focus:bg-muted/50 cursor-pointer flex items-center gap-2">
              <Truck className="size-4 text-muted-foreground" />
              <span>{dict.MENU_SHIPMENTS}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {(hasPermission('users', 'view') || hasPermission('component-test', 'view') || hasPermission('settings', 'view')) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "justify-start md:justify-center w-full md:w-auto px-4 py-1.5 rounded text-xs md:text-sm font-medium transition-all duration-150 flex items-center gap-2 border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none focus:ring-0",
                isSystemActive
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              <UserCog className="size-4" />
              <span>{dict.MENU_GROUP_SYSTEM}</span>
              <ChevronDown className="size-3 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="rounded-lg p-1 bg-popover border border-border/60 shadow-none">
            {hasPermission('users', 'view') && (
              <DropdownMenuItem onClick={() => { handleOpenUsers(); setIsMobileMenuOpen(false); }} className="rounded p-2 transition-colors focus:bg-muted/50 cursor-pointer flex items-center gap-2">
                <UserCog className="size-4 text-muted-foreground" />
                <span>{dict.MENU_USERS}</span>
              </DropdownMenuItem>
            )}
            {hasPermission('settings', 'view') && (
              <DropdownMenuItem onClick={() => { handleOpenSettings(); setIsMobileMenuOpen(false); }} className="rounded p-2 transition-colors focus:bg-muted/50 cursor-pointer flex items-center gap-2">
                <Settings className="size-4 text-muted-foreground" />
                <span>{dict.MENU_SETTINGS}</span>
              </DropdownMenuItem>
            )}
            {hasPermission('component-test', 'view') && (
              <DropdownMenuItem onClick={() => { handleOpenComponentTest(); setIsMobileMenuOpen(false); }} className="rounded p-2 transition-colors focus:bg-muted/50 cursor-pointer flex items-center gap-2">
                <Languages className="size-4 text-muted-foreground" />
                <span>{dict.MENU_SHOWCASE}</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </>
  )

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* Top Navbar */}
      <header className="flex h-14 items-center justify-between border-b border-border/60 px-6 shrink-0 bg-card z-50 shadow-none">
        <div className="flex items-center gap-6">
          <div className="font-bold text-lg tracking-tight hover:opacity-85 transition-opacity cursor-pointer">
            {config.brandName}
          </div>

          {/* Desktop Menu */}
          <nav className="hidden md:flex items-center gap-1">
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
              <SheetContent side="left" className="w-[280px] p-6 bg-background shadow-none border-r border-border/60">
                <SheetHeader className="text-left border-b pb-4 mb-4 border-border/60">
                  <SheetTitle className="text-xl font-bold">{config.brandName}</SheetTitle>
                </SheetHeader>
                <div className="flex flex-col gap-2 mt-4">
                  {renderMenuItems()}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* User Profile Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="bg-gradient-to-br from-secondary to-white size-9 rounded-full p-0 flex items-center justify-center border border-border/60 hover:bg-muted/60 transition-colors shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none focus:ring-0">
                <User className="size-5 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-lg p-1 bg-popover border border-border/60 shadow-none">
              <DropdownMenuLabel className="font-normal p-2.5">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-semibold leading-none">{userDisplayName}</p>
                  <p className="text-xs leading-none text-muted-foreground truncate">{user?.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="my-1 border-border/60" />

              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="rounded p-2 transition-colors cursor-pointer flex items-center gap-2">
                  <Languages className="size-4 text-muted-foreground" />
                  <span>{dict.LABEL_LANGUAGE} ({lang.toUpperCase()})</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent className="rounded-lg p-1 bg-popover border border-border/60 shadow-none">
                    <DropdownMenuItem onClick={() => changeLanguage("en")} className="rounded p-2 transition-colors cursor-pointer flex items-center">
                      <span>English</span>
                      {lang === "en" && <span className="ml-auto text-primary">✓</span>}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => changeLanguage("id")} className="rounded p-2 transition-colors cursor-pointer flex items-center">
                      <span>Bahasa Indonesia</span>
                      {lang === "id" && <span className="ml-auto text-primary">✓</span>}
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="rounded p-2 transition-colors cursor-pointer flex items-center gap-2">
                  <Sun className="size-4 text-muted-foreground dark:hidden" />
                  <Moon className="size-4 text-muted-foreground hidden dark:block" />
                  <span>{dict.LABEL_THEME}</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent className="rounded-lg p-1 bg-popover border border-border/60 shadow-none">
                    <DropdownMenuItem onClick={() => setTheme("light")} className="rounded p-2 transition-colors cursor-pointer flex items-center gap-2">
                      <Sun className="size-4 text-muted-foreground" />
                      <span>{dict.LABEL_LIGHT}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setTheme("dark")} className="rounded p-2 transition-colors cursor-pointer flex items-center gap-2">
                      <Moon className="size-4 text-muted-foreground" />
                      <span>{dict.LABEL_DARK}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setTheme("system")} className="rounded p-2 transition-colors cursor-pointer flex items-center gap-2">
                      <Monitor className="size-4 text-muted-foreground" />
                      <span>{dict.LABEL_SYSTEM}</span>
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>

              <DropdownMenuSeparator className="my-1 border-border/60" />
              <DropdownMenuItem onClick={() => setIsChangePasswordOpen(true)} className="rounded p-2 transition-colors cursor-pointer flex items-center gap-2">
                <Key className="size-4 text-muted-foreground" />
                <span>{dict.TITLE_RESET_PWD || "Change Password"}</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={signOut} className="rounded p-2 text-destructive focus:bg-destructive/10 focus:text-destructive transition-colors cursor-pointer flex items-center gap-2">
                <LogOut className="size-4" />
                <span>{dict.MENU_LOGOUT}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Tab Strip */}
      <div
        ref={tabStripRef}
        className="flex items-end h-10 border-b border-border/60 bg-muted/10 overflow-x-auto no-scrollbar scroll-smooth px-4 shrink-0 shadow-none gap-1"
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
                "flex items-center justify-between h-9 text-xs md:text-sm font-medium cursor-pointer transition-all duration-150 ease-in-out whitespace-nowrap pl-4 pr-2 rounded-t-md border-t border-x gap-2 relative z-10 -mb-[1px] min-w-[130px] max-w-[200px]",
                isActive
                  ? "bg-primary/15 border-t-primary border-x-primary border-b-transparent text-primary font-semibold"
                  : "bg-transparent border-t-border/80 border-x-border/80 border-b-border/60 text-muted-foreground hover:bg-muted/10 hover:text-foreground"
              )}
            >
              <span className="truncate flex-1 text-left relative z-10">{displayTitle}</span>
              {tab.closable !== false && (
                <Button
                  variant="close"
                  size="icon"
                  className={cn(
                    "size-4 shrink-0 flex items-center justify-center transition-colors shadow-none relative z-10"
                  )}
                  onClick={(e) => {
                    e.stopPropagation()
                    closeTab(tab.id)
                  }}
                >
                  <X className="size-4"/>
                </Button>
              )}
            </div>
          )
        })}
      </div>

      {/* Content Area */}
      <main className="flex-1 relative overflow-hidden bg-muted/10">
        {tabs.map((tab) => {
          const registryItem = TAB_REGISTRY[tab.id]
          const displayContent = registryItem ? registryItem.content : tab.content

          return (
            <div
              key={tab.id}
              className={cn(
                "absolute inset-0 flex flex-col overflow-hidden min-h-0",
                activeTabId === tab.id ? "flex animate-in fade-in duration-300" : "hidden"
              )}
            >
              {displayContent}
            </div>
          )
        })}
      </main>

      {/* Change Password Dialog Modal */}
      <Dialog open={isChangePasswordOpen} onOpenChange={setIsChangePasswordOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {lang === "id" ? "Ubah Kata Sandi" : "Change Password"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleChangePassword} className="flex flex-col gap-6 p-5">
            <div className="grid grid-cols-1 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="current_password">
                  {lang === "id" ? "Kata Sandi Saat Ini" : "Current Password"} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="current_password"
                  type="password"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="new_password">
                  {lang === "id" ? "Kata Sandi Baru" : "New Password"} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="new_password"
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="confirm_password">
                  {lang === "id" ? "Konfirmasi Kata Sandi Baru" : "Confirm New Password"} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="confirm_password"
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <DialogFooter className="mt-2 gap-2 *:w-full *:flex-1 h-22 sm:h-auto">
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
                {isChangingPassword ? <ButtonLoader /> : <Save data-icon="inline-start" />}
                {lang === "id" ? "Ubah Kata Sandi" : "Change Password"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
