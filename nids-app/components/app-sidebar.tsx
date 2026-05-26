"use client"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { Building2, Package, LayoutDashboard, FileText, ShoppingCart, Truck, Settings, User, Sun, Moon, Monitor, ChevronUp, Languages, UserCog } from "lucide-react"
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useTheme } from "next-themes"
import { useDictionary } from "@/components/dictionary-provider"
import { ContentKey } from "@/lib/site-content"

import Link from "next/link"

const items: { titleKey: ContentKey; url: string; icon: any }[] = [
  {
    titleKey: "MENU_DASHBOARD",
    url: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    titleKey: "MENU_COMPANIES",
    url: "/companies",
    icon: Building2,
  },
  {
    titleKey: "MENU_PRODUCTS",
    url: "/products",
    icon: Package,
  },
  {
    titleKey: "MENU_QUOTES",
    url: "/quotes",
    icon: FileText,
  },
  {
    titleKey: "MENU_ORDERS",
    url: "/orders",
    icon: ShoppingCart,
  },
  {
    titleKey: "MENU_SHIPMENTS",
    url: "/shipments",
    icon: Truck,
  },
  {
    titleKey: "MENU_USERS",
    url: "/users",
    icon: UserCog,
  },
]

import { useAuth } from "@/components/auth-provider"
import { useMemo } from "react"
import { createClient } from "@/lib/supabase"

export function AppSidebar() {
  const { dict, config, lang, setLanguage } = useDictionary()
  const { user, profile, hasPermission, signOut, changeLanguage } = useAuth()
  const { setTheme } = useTheme()

  const userDisplayName = useMemo(() => {
    return profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || "User"
  }, [profile?.full_name, user?.user_metadata, user?.email])

  const userInitials = useMemo(() => {
    return userDisplayName
      .split(/\s+/)
      .filter(Boolean)
      .map((namePart: string) => namePart[0])
      .join('')
      .substring(0, 2)
      .toUpperCase()
  }, [userDisplayName])

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      // Basic mapping: MENU_COMPANIES -> companies
      const moduleKey = item.titleKey.replace('MENU_', '').toLowerCase()
      return hasPermission(moduleKey, 'view')
    })
  }, [hasPermission])

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 p-2 font-bold text-lg">
          {config.brandName}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{dict.MENU_GROUP_MASTER}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredItems.map((item) => (
                <SidebarMenuItem key={item.titleKey}>
                  <SidebarMenuButton asChild>
                    <Link href={item.url}>
                      <item.icon data-icon="inline-start" />
                      <span>{dict[item.titleKey]}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton className="h-12">
                  <Avatar className="size-8">
                    <AvatarImage src={`https://avatar.vercel.sh/${user?.email}.png`} />
                    <AvatarFallback>{userInitials}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col items-start text-sm truncate">
                    <span className="font-semibold">{userDisplayName}</span>
                    <span className="text-xs text-muted-foreground">
                      {profile?.role ? (profile.role.charAt(0).toUpperCase() + profile.role.slice(1)) : dict.LABEL_USER}
                    </span>
                  </div>
                  <ChevronUp className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-[--radix-popper-anchor-width]">
                <DropdownMenuLabel>{userDisplayName}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                
                {/* Language Switcher */}
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
                    <Sun className="mr-2 size-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                    <Moon className="absolute mr-2 size-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
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
                <DropdownMenuItem>
                  <Settings className="mr-2 size-4" />
                  <span>{dict.MENU_SETTINGS}</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onClick={signOut}>
                  <span>{dict.MENU_LOGOUT}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}