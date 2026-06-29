"use client"

import { usePathname } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import { MdiProvider } from "@/components/mdi-provider"
import { MdiLayout } from "@/components/mdi-layout"
import { FullPageLoader } from "@/components/full-page-loader"

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user, loading } = useAuth()
  const isPublicPage =
    pathname === "/" ||
    pathname === "/signup" ||
    pathname === "/reset-password" ||
    pathname?.startsWith("/auth/") ||
    pathname?.startsWith("/verify/")

  if (loading) {
    return <FullPageLoader />
  }

  if (isPublicPage) {
    return <>{children}</>
  }

  return (
    <MdiProvider>
      <MdiLayout />
    </MdiProvider>
  )
}
