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
  MoreVertical
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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

export function MdiLayout() {
  const { dict, config, lang } = useDictionary()
  const { tabs, activeTabId, openTab, closeTab, setActiveTabId, isRestored } = useMdi()
  const { user, profile, signOut, changeLanguage } = useAuth()
  const { setTheme } = useTheme()
  const pathname = usePathname()
  const tabStripRef = useRef<HTMLDivElement>(null)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  // Mapping of tab IDs to their content components
  // This registry MUST be defined inside the component to be reactive to 'dict' changes
  const TAB_REGISTRY: Record<string, { title: string; content: React.ReactNode; closable?: boolean }> = {
    dashboard: { title: dict.MENU_DASHBOARD, content: <DashboardPage />, closable: false },
    companies: { title: dict.MENU_COMPANIES, content: <CompaniesPage /> },
    products: { title: dict.MENU_PRODUCTS, content: <ProductsPage /> },
    shipments: { title: dict.MENU_SHIPMENTS, content: <ShipmentsPage /> },
    users: { title: dict.MENU_USERS, content: <UsersPage /> },
    "component-test": { title: dict.MENU_SHOWCASE, content: <ComponentTestPage /> },
  }

  // Handlers for opening tabs
  const handleOpenDashboard = () => openTab("dashboard", dict.MENU_DASHBOARD, <DashboardPage />, false)
  const handleOpenCompanies = () => openTab("companies", dict.MENU_COMPANIES, <CompaniesPage />)
  const handleOpenProducts = () => openTab("products", dict.MENU_PRODUCTS, <ProductsPage />)
  const handleOpenShipments = () => openTab("shipments", dict.MENU_SHIPMENTS, <ShipmentsPage />)
  const handleOpenUsers = () => openTab("users", dict.MENU_USERS, <UsersPage />)
  const handleOpenComponentTest = () => openTab("component-test", dict.MENU_SHOWCASE, <ComponentTestPage />)

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
      else if (pathname === "/users") handleOpenUsers()
      else if (pathname === "/shipments") handleOpenShipments()
      else if (pathname === "/component-test") handleOpenComponentTest()
      else handleOpenDashboard()
    }
  }, [isRestored, pathname])

  const userDisplayName = profile?.full_name || user?.email?.split('@')[0] || "User"
  const userInitials = userDisplayName.substring(0, 2).toUpperCase()

  // Scroll active tab into view
  useEffect(() => {
    if (activeTabId && tabStripRef.current) {
      const activeTabElement = tabStripRef.current.querySelector(`[data-tab-id="${activeTabId}"]`)
      if (activeTabElement) {
        activeTabElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
      }
    }
  }, [activeTabId])

  const MenuItems = () => (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => { handleOpenDashboard(); setIsMobileMenuOpen(false); }}
        className="justify-start md:justify-center w-full md:w-auto"
      >
        <LayoutDashboard className="size-4 mr-2" />
        <span>{dict.MENU_DASHBOARD}</span>
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="justify-start md:justify-center w-full md:w-auto">
            <MenuIcon className="size-4 mr-2" />
            <span>{dict.MENU_GROUP_MASTER}</span>
            <ChevronDown className="size-3 ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => { handleOpenCompanies(); setIsMobileMenuOpen(false); }}>
            <Building2 className="size-4 mr-2" />
            <span>{dict.MENU_COMPANIES}</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => { handleOpenProducts(); setIsMobileMenuOpen(false); }}>
            <Package className="size-4 mr-2" />
            <span>{dict.MENU_PRODUCTS}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="justify-start md:justify-center w-full md:w-auto">
            <Truck className="size-4 mr-2" />
            <span>{dict.MENU_GROUP_REPORTS}</span>
            <ChevronDown className="size-3 ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => { handleOpenShipments(); setIsMobileMenuOpen(false); }}>
            <Truck className="size-4 mr-2" />
            <span>{dict.MENU_SHIPMENTS}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {profile?.role === 'admin' && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="justify-start md:justify-center w-full md:w-auto">
              <UserCog className="size-4 mr-2" />
              <span>{dict.MENU_GROUP_SYSTEM}</span>
              <ChevronDown className="size-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => { handleOpenUsers(); setIsMobileMenuOpen(false); }}>
              <UserCog className="size-4 mr-2" />
              <span>{dict.MENU_USERS}</span>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Settings className="size-4 mr-2" />
              <span>{dict.MENU_SETTINGS}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { handleOpenComponentTest(); setIsMobileMenuOpen(false); }}>
              <Languages className="size-4 mr-2" />
              <span>{dict.MENU_SHOWCASE}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </>
  )

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* Top Navbar */}
      <header className="flex h-14 items-center justify-between border-b px-4 shrink-0 bg-card z-50">
        <div className="flex items-center gap-3">
          <div className="font-bold text-lg mr-2">
            {config.brandName}
          </div>

          {/* Desktop Menu */}
          <nav className="hidden md:flex items-center gap-0">
            <MenuItems />
          </nav>

          {/* Mobile Menu Trigger */}
          <div className="md:hidden">
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MenuIcon className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px]">
                <SheetHeader>
                  <SheetTitle>{config.brandName} Menu</SheetTitle>
                </SheetHeader>
                <div className="flex flex-col gap-2 mt-4">
                  <MenuItems />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* User Profile Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="size-10 rounded-full p-0 overflow-hidden">
                <Avatar className="size-10">
                  <AvatarImage src={`https://avatar.vercel.sh/${user?.email}.png`} />
                  <AvatarFallback>{userInitials}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{userDisplayName}</p>
                  <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />

              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Languages className="mr-2 size-4" />
                  <span>{dict.LABEL_LANGUAGE} ({lang.toUpperCase()})</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onClick={() => changeLanguage("en")}>
                    <span>English</span>
                    {lang === "en" && <span className="ml-auto">✓</span>}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => changeLanguage("id")}>
                    <span>Bahasa Indonesia</span>
                    {lang === "id" && <span className="ml-auto">✓</span>}
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
                </DropdownMenuPortal>
                </DropdownMenuSub>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Sun className="mr-2 size-4 dark:hidden" />
                  <Moon className="mr-2 size-4 hidden dark:block" />
                  <span>{dict.LABEL_THEME}</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem onClick={() => setTheme("light")}>
                      <Sun className="mr-2 size-4" />
                      <span>{dict.LABEL_LIGHT}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setTheme("dark")}>
                      <Moon className="mr-2 size-4" />
                      <span>{dict.LABEL_DARK}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setTheme("system")}>
                      <Monitor className="mr-2 size-4" />
                      <span>{dict.LABEL_SYSTEM}</span>
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>

              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut} className="text-destructive">
                <LogOut className="mr-2 size-4" />
                <span>{dict.MENU_LOGOUT}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Tab Strip */}
      <div
        ref={tabStripRef}
        className="flex items-end h-10 border-b bg-muted/30 overflow-x-auto no-scrollbar scroll-smooth px-2 gap-0.5 shrink-0"
      >
        {tabs.map((tab) => {
          const registryItem = TAB_REGISTRY[tab.id]
          const displayTitle = registryItem ? registryItem.title : tab.title

          return (
            <div
              key={tab.id}
              data-tab-id={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className={cn(
                "flex items-center rounded-t-md text-xs md:text-sm font-medium cursor-pointer transition-all duration-200 ease-in-out whitespace-nowrap min-w-[80px] md:min-w-[120px] max-w-[200px] border-x border-t hover:scale-[1.03] active:scale-95 origin-bottom pl-2 pr-1",
                activeTabId === tab.id
                  ? "h-9 bg-primary border-primary text-primary-foreground z-10"
                  : "h-7 bg-primary/70 border-transparent text-primary-foreground/80"
              )}
            >
              <span className="truncate flex-1">{displayTitle}</span>
              {tab.closable !== false && (
                <Button
                  variant="close"
                  size="icon"
                  className={cn(
                    "size-4 ml-1 shrink-0 transition-colors shadow-none",
                    activeTabId === tab.id
                      ? ""
                      : ""
                  )}
                  onClick={(e) => {
                    e.stopPropagation()
                    closeTab(tab.id)
                  }}
                >
                  <X className="size-3" />
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
                "absolute inset-0 overflow-auto p-4 md:p-6",
                activeTabId === tab.id ? "block animate-in fade-in duration-300" : "hidden"
              )}
            >
              {displayContent}
            </div>
          )
        })}
      </main>
    </div>
  )
}
