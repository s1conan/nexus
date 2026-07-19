"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { User, Lock, LogIn } from "lucide-react"
import { useDictionary } from "@/components/dictionary-provider"
import { useAuth } from "@/components/auth-provider"
import { createClient } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { FullPageLoader } from "@/components/full-page-loader"
import { ButtonLoader } from "@/components/button-loader"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

import { toast } from "sonner"

export default function LoginPage() {
  const { dict, config, lang, setLanguage } = useDictionary()
  const { user, profile, loading } = useAuth()
  const router = useRouter()
  const supabase = createClient()
  const passwordRef = useRef<HTMLInputElement>(null)

  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [loginError, setLoginError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Forgot Password State
  const [isForgotOpen, setIsForgotOpen] = useState(false)
  const [forgotEmail, setForgotEmail] = useState("")
  const [forgotLoading, setForgotLoading] = useState(false)

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setForgotLoading(true)

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      })

      const result = await response.json()

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(dict.MSG_RESET_LINK_SENT, {
          description: dict.MSG_RESET_SENT,
          duration: 8000,
        })
        setForgotEmail("")
        setIsForgotOpen(false) // Close dialog on success
      }
    } catch (err: any) {
      toast.error("An unexpected error occurred.")
    } finally {
      setForgotLoading(false)
    }
  }

  // Focus password on error
  useEffect(() => {
    if (loginError && passwordRef.current) {
      passwordRef.current.focus()
      passwordRef.current.select() // Select text to make it easier to re-type
    }
  }, [loginError])

  // Redirect if ALREADY logged in on mount
  useEffect(() => {
    if (!loading && user && profile?.is_active) {
      router.push("/dashboard")
    }
  }, [loading, user, profile, router])

  const toggleLanguage = () => {
    setLanguage(lang === "en" ? "id" : "en")
  }

  const handleSubmit = async (
    e: React.SyntheticEvent<HTMLFormElement, SubmitEvent>
  ) => {
    e.preventDefault()
    setIsSubmitting(true)
    setLoginError("")
    const input = username.toLowerCase().trim()
    console.log("Login: Starting login process for:", input)

    const timeoutId = setTimeout(() => {
      setLoginError(dict.ERROR_TIMEOUT || "Request timed out.")
      setIsSubmitting(false)
    }, 15000)

    try {
      // 1. Find profile by username OR email
      console.log("Login: Searching for profile record...")
      const { data: profileRecord, error: lookupError } = await supabase
        .from("profiles")
        .select("id, email, is_active, preferred_language")
        .or(`username.eq.${input},email.eq.${input}`)
        .maybeSingle()

      if (lookupError) {
        console.error("Login: Database lookup error", lookupError)
        setLoginError(dict.ERROR_VERIFY_STATUS || "Database error.")
        clearTimeout(timeoutId)
        return
      }

      if (!profileRecord) {
        console.warn("Login: No profile found for", input)
        setLoginError(dict.LOGIN_ERROR_INVALID || "Invalid credentials.")
        clearTimeout(timeoutId)
        return
      }

      const emailToUse = profileRecord.email
      console.log("Login: Profile found. Using email:", emailToUse)

      // 2. Sign In with resolved email
      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({
          email: emailToUse,
          password: password,
        })

      if (authError) {
        console.error("Login: Supabase Auth error", authError)
        setLoginError(dict.LOGIN_ERROR_INVALID || "Invalid password.")
        clearTimeout(timeoutId)
        return
      }

      if (authData?.user) {
        console.log("Login: Auth successful. User ID:", authData.user.id)

        // 3. Status Check (Using data from profile record)
        if (!profileRecord.is_active) {
          console.warn("Login: Account not active.")
          setLoginError(dict.LOGIN_ERROR_PENDING || "Account pending approval.")
          await supabase.auth.signOut()
          clearTimeout(timeoutId)
          return
        }

        // 4. Update last_login, preferred_language and redirect
        const updateData: any = {
          last_login: new Date().toISOString(),
        }

        const localLang =
          typeof window !== "undefined"
            ? localStorage.getItem("nids_pref_lang")
            : null
        if (
          !profileRecord.preferred_language ||
          (localLang && localLang !== profileRecord.preferred_language)
        ) {
          updateData.preferred_language = lang
        }

        await supabase
          .from("profiles")
          .update(updateData)
          .eq("auth_id", authData.user.id)

        console.log("Login: Redirecting...")
        router.push("/dashboard")
      }
    } catch (err) {
      console.error("Login: Unexpected exception", err)
      setLoginError(dict.ERROR_UNEXPECTED || "System error.")
    } finally {
      clearTimeout(timeoutId)
      setIsSubmitting(false)
    }
  }
  if (loading) {
    return <FullPageLoader />
  }

  return (
    <div className="login-background">
      <div className="login-card relative">
        <div className="lang-toggle-wrapper">
          <button
            onClick={toggleLanguage}
            className="lang-toggle-btn"
            title={dict.TOOLTIP_LANG || "Switch Language"}
          >
            {lang.toUpperCase()}
          </button>
        </div>

        <div className="banner-container h-92">
          <Image
            src={config.assets.loginImage}
            alt="Login Header"
            fill
            sizes="(max-width: 768px) 100vw, 500px"
            className="object-cover object-top transition-all duration-500"
            priority
          />
          <div className="banner-overlay" />
          <div className="banner-blur-mask" />

          <div className="absolute inset-x-0 bottom-0 z-20 p-8 pb-4 text-center">
            <div className="mb-2 flex justify-center">
              <div className="rounded-xl border border-white/20 bg-background/20 p-3 backdrop-blur-md">
                <LogIn className="size-8 text-foreground" />
              </div>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-black drop-shadow-md text-shadow-gray-200 text-shadow-stroke">
              {config.brandName}
            </h1>
            <p className="mt-1 text-sm text-pretty text-foreground">
              {dict.LOGIN_SUBTITLE}
            </p>
            <div className="mt-2 flex min-h-[60px] items-start justify-center">
              {loginError && (
                <div className="w-full animate-in rounded-md border border-destructive/50 bg-background/40 p-3 text-sm text-destructive backdrop-blur-sm duration-700 fade-in">
                  {loginError}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-8 pt-4">
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <Label htmlFor="username">{dict.LABEL_USERNAME}</Label>
              <div className="group relative">
                <User className="absolute top-3 left-3 size-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                <Input
                  id="username"
                  placeholder="username / email"
                  className="pl-10"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="password">{dict.LABEL_PASSWORD}</Label>
              <div className="group relative">
                <Lock className="absolute top-3 left-3 size-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                <Input
                  id="password"
                  ref={passwordRef}
                  type="password"
                  placeholder={dict.PLACEHOLDER_PASSWORD}
                  className="pl-10 text-2xl"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <Button
              type="submit"
              className="mt-2 h-11 w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ButtonLoader />
              ) : (
                <LogIn data-icon="inline-start" />
              )}
              {dict.BUTTON_LOGIN}
            </Button>
          </form>

          <div className="mt-8 flex flex-col items-center gap-4">
            <div className="text-center text-sm text-muted-foreground">
              {dict.TEXT_NO_ACCOUNT}{" "}
              <Link
                href="/signup"
                className="font-semibold text-primary underline-offset-4 hover:underline"
              >
                {dict.LINK_SIGNUP}
              </Link>
            </div>

            <button
              type="button"
              onClick={() => setIsForgotOpen(true)}
              className="text-xs font-medium text-primary underline-offset-4 hover:underline"
            >
              {dict.LINK_FORGOT_PWD || "Forgot password?"}
            </button>
          </div>

          <div className="mt-8 text-center text-xs text-muted-foreground">
            {dict.COPYRIGHT}
          </div>
        </div>
      </div>

      <Dialog open={isForgotOpen} onOpenChange={setIsForgotOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dict.TITLE_FORGOT_PWD || "Reset Password"}
            </DialogTitle>
            <DialogDescription>
              {dict.DESC_FORGOT_PWD ||
                "Enter your email address and we'll send you a link to reset your password."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleForgotSubmit} className="space-y-4 p-5">
            <div className="space-y-2">
              <Label htmlFor="forgot-email">{dict.LABEL_EMAIL}</Label>
              <Input
                id="forgot-email"
                type="email"
                placeholder="name@example.com"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                required
                className="text-sm"
                disabled={forgotLoading}
              />
            </div>

            <DialogFooter className="flex flex-col sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsForgotOpen(false)}
                className="w-full sm:flex-1"
                disabled={forgotLoading}
              >
                {dict.BUTTON_CANCEL}
              </Button>
              <Button
                type="submit"
                className="w-full sm:flex-1"
                disabled={forgotLoading}
              >
                {forgotLoading ? <ButtonLoader /> : null}
                {dict.BUTTON_SEND_LINK || "Send Link"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
