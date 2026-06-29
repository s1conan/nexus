"use client"

import { useState, useEffect, Suspense, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Lock, Loader2, CheckCircle2, ShieldCheck } from "lucide-react"
import { ButtonLoader } from "@/components/button-loader"
import { SectionLoader } from "@/components/section-loader"
import { useDictionary } from "@/components/dictionary-provider"
import Image from "next/image"

function SetupPasswordForm() {
  const { dict, config } = useDictionary()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(true)
  const [criticalError, setCriticalError] = useState("") // Verification/Session errors
  const [formError, setFormError] = useState("") // Validation errors (mismatch, etc)
  const [success, setSuccess] = useState(false)
  const [isFirstLogin, setIsFirstLogin] = useState(true)

  const router = useRouter()
  const searchParams = useSearchParams()
  const hasVerified = useRef(false)

  useEffect(() => {
    const verifyCustomToken = async () => {
      if (hasVerified.current) return
      hasVerified.current = true

      const token = searchParams.get("token")
      const type = searchParams.get("type")

      if (!token) {
        setCriticalError(
          "No security token found. Please use the link provided in your email."
        )
        setVerifying(false)
        return
      }

      console.log(`ResetPassword: Verifying application token...`)

      try {
        const response = await fetch("/api/auth/verify-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        })

        const result = await response.json()

        if (result.error) {
          console.error("ResetPassword: Verification failed:", result.error)
          const isExpired = result.error.toLowerCase().includes("expired")
          setCriticalError(
            isExpired
              ? "This security link has expired. Please contact your administrator to revoke and re-approve your account access."
              : `Security link error: ${result.error}. Please ask your administrator to re-approve your account.`
          )
        } else {
          console.log(
            "ResetPassword: Application token verified for",
            result.email
          )
          // Determine if first login or reset based on URL or DB state if needed
          if (type === "recovery") setIsFirstLogin(false)
        }
      } catch (err: any) {
        console.error("ResetPassword: API call failed:", err)
        setCriticalError(
          "An unexpected error occurred during security verification."
        )
      } finally {
        setVerifying(false)
      }
    }

    verifyCustomToken()
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setFormError("")

    if (password.length < 6) {
      setFormError("Password must be at least 6 characters.")
      setLoading(false)
      return
    }

    if (password !== confirmPassword) {
      setFormError("Passwords do not match. Please try again.")
      setLoading(false)
      return
    }

    const token = searchParams.get("token")

    try {
      const response = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      })

      const result = await response.json()

      if (result.error) {
        setFormError(result.error)
      } else {
        setSuccess(true)
        // No need for signOut as the user was never signed in during this process
        setTimeout(() => {
          router.push("/")
        }, 2000)
      }
    } catch (err: any) {
      setFormError(err.message || "An unexpected error occurred.")
    } finally {
      setLoading(false)
    }
  }

  if (verifying) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40">
        <SectionLoader message="Verifying security token..." />
      </div>
    )
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
        <Card className="w-full max-w-md animate-in border-emerald-500/20 text-center shadow-xl duration-500 zoom-in-95">
          <CardHeader>
            <div className="mb-4 flex justify-center">
              <div className="rounded-full bg-emerald-100 p-3 dark:bg-emerald-900/30">
                <CheckCircle2 className="size-12 text-emerald-500" />
              </div>
            </div>
            <CardTitle className="text-2xl">Security Updated</CardTitle>
            <CardDescription className="text-base">
              Your password has been set successfully. You are being redirected
              to the login page to sign in with your new credentials.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="login-background">
      <div className="login-card relative animate-in duration-700 fade-in slide-in-from-bottom-4">
        <div className="banner-container h-92">
          <Image
            src={config.assets.loginImage}
            alt="Security Header"
            fill
            className="object-cover object-top transition-all duration-500"
            priority
          />
          <div className="banner-overlay" />
          <div className="banner-blur-mask" />

          <div className="absolute inset-x-0 bottom-0 z-20 p-8 pb-4 text-center">
            <div className="mb-2 flex justify-center">
              <div className="rounded-xl border border-white/20 bg-background/20 p-3 backdrop-blur-md">
                <ShieldCheck className="size-8 text-foreground shadow-sm" />
              </div>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground drop-shadow-md">
              {isFirstLogin ? dict.TITLE_SETUP_ACC : dict.TITLE_RESET_PWD}
            </h1>
            <p className="mt-1 text-sm text-pretty text-foreground">
              {isFirstLogin ? dict.DESC_SETUP_ACC : dict.DESC_RESET_PWD}
            </p>
            <div className="mt-2 flex min-h-[60px] items-start justify-center">
              {formError && (
                <div className="w-full animate-in rounded-md border border-destructive/50 bg-background/40 p-3 text-sm text-destructive backdrop-blur-sm duration-700 fade-in">
                  {formError}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-8 pt-4">
          {criticalError ? (
            <div className="flex flex-col gap-6">
              <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-center text-sm font-medium text-destructive">
                {criticalError}
              </div>
              <Button
                variant="outline"
                onClick={() => router.push("/")}
                className="h-11 w-full"
              >
                {dict.LINK_RETURN_LOGIN}
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <Label htmlFor="password">{dict.LABEL_NEW_PASSWORD}</Label>
                <div className="group relative">
                  <Lock className="absolute top-3 left-3 size-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    className="h-11 pl-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="confirmPassword">
                  {dict.LABEL_CONFIRM_PASSWORD}
                </Label>
                <div className="group relative">
                  <Lock className="absolute top-3 left-3 size-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    className="h-11 pl-10"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="mt-2 h-11 w-full font-semibold tracking-wide"
                disabled={loading}
              >
                {loading ? <ButtonLoader /> : dict.BUTTON_SET_NEW_PWD}
              </Button>
            </form>
          )}

          <div className="mt-8 text-center text-xs font-medium tracking-widest text-muted-foreground opacity-60">
            {dict.COPYRIGHT}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SetupPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-muted/40">
          <div className="relative flex size-12 items-center justify-center">
            <div className="absolute inset-0 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
            <div className="absolute inset-1.5 animate-[spin_1.5s_linear_infinite_reverse] rounded-full border-2 border-secondary/20 border-b-secondary" />
            <Loader2 className="size-4 animate-pulse text-primary" />
          </div>
        </div>
      }
    >
      <SetupPasswordForm />
    </Suspense>
  )
}
