"use client"

import { useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { Loader2 } from "lucide-react"

function CallbackHandler() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  useEffect(() => {
    const handleAuth = async () => {
      // 1. Handle the 'code' flow (PKCE)
      const code = searchParams.get("code")
      const next = searchParams.get("next") || "/"

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) {
          console.error("Auth Callback: Exchange code error:", error.message)
          router.push(
            `/auth/auth-code-error?error=${encodeURIComponent(error.message)}`
          )
          return
        }
      }

      // 2. Handle the 'fragment' flow (Implicit)
      // Supabase client automatically picks up tokens from the hash/fragment
      // during instantiation or onAuthStateChange.
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError) {
        console.error("Auth Callback: User error:", userError.message)
        router.push(
          `/auth/auth-code-error?error=${encodeURIComponent(userError.message)}`
        )
        return
      }

      if (user) {
        console.log("Auth Callback: User established, redirecting to:", next)
        router.push(next)
      } else {
        // If no session and no code, check if there's an error in the hash
        const hash = window.location.hash
        if (hash.includes("error_description")) {
          console.error("Auth Callback: Hash contains error")
          router.push("/auth/auth-code-error")
        } else {
          // If we just landed here without any auth info
          console.log("Auth Callback: No session found, redirecting home")
          router.push("/")
        }
      }
    }

    handleAuth()
  }, [router, searchParams, supabase.auth])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-center">
      <div className="space-y-4">
        <div className="relative mx-auto flex size-16 items-center justify-center">
          <div className="absolute inset-0 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
          <div className="absolute inset-2 animate-[spin_1.5s_linear_infinite_reverse] rounded-full border-4 border-secondary/20 border-b-secondary" />
          <Loader2 className="size-6 animate-pulse text-primary" />
        </div>
        <h2 className="text-xl font-semibold">Completing authentication...</h2>
        <p className="text-muted-foreground">
          Please wait while we finalize your secure session.
        </p>
      </div>
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      }
    >
      <CallbackHandler />
    </Suspense>
  )
}
