import { Geist_Mono, Noto_Sans } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@/lib/utils";

const notoSans = Noto_Sans({ subsets: ['latin'], variable: '--font-sans' })
const fontMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono", })

import { DictionaryProvider } from "@/components/dictionary-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { LayoutWrapper } from "@/components/layout-wrapper"
import { AuthProvider } from "@/components/auth-provider"
import { Toaster } from "@/components/ui/sonner"
import { createServerSideClient } from "@/lib/supabase-server"

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Fetch session and profile on the server for instant initialization
  let initialLang: string = 'en'
  let initialUser: any = null
  let initialProfile: any = null

  try {
    const supabase = await createServerSideClient()
    
    // Add a simple timeout race to prevent server hanging on slow DB
    const { data: { user } } = await Promise.race([
      supabase.auth.getUser(),
      new Promise<any>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 3000))
    ])

    if (user) {
      initialUser = user
      const { data: profile } = await supabase
        .from('profiles')
        .select(`
          *,
          role_permissions (
            permissions
          )
        `)
        .eq('auth_id', user.id)
        .maybeSingle()

      if (profile) {
        initialProfile = profile
        initialLang = profile.preferred_language || 'en'
      }
    }
  } catch (e) {
    console.error("Layout: Server-side data fetch failed or timed out", e)
  }

  return (
    <html
      lang={initialLang}
      suppressHydrationWarning
      className={cn("antialiased", fontMono.variable, "font-sans", notoSans.variable)}
    >
      <body className="min-h-screen bg-background font-sans antialiased">
        <ThemeProvider>
          <DictionaryProvider initialLang={initialLang}>
            <AuthProvider initialUser={initialUser} initialProfile={initialProfile}>
              <TooltipProvider>
                <LayoutWrapper>
                  {children}
                </LayoutWrapper>
                <Toaster />
              </TooltipProvider>
            </AuthProvider>
          </DictionaryProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}