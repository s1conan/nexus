"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { User, Mail, ArrowLeft, Phone, Loader2 } from "lucide-react"
import { useDictionary } from "@/components/dictionary-provider"
import { createClient } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { ButtonLoader } from "@/components/button-loader"

export default function SignupPage() {
  const { dict, config, lang, setLanguage } = useDictionary()
  const router = useRouter()
  const supabase = createClient()

  const [fullName, setFullName] = useState("")
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (
    e: React.SyntheticEvent<HTMLFormElement, SubmitEvent>
  ) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError("")

    // 1. Basic Frontend Validation
    if (!email.includes("@")) {
      setError(
        dict.ERROR_INVALID_EMAIL || "Please enter a valid email address."
      )
      setIsSubmitting(false)
      return
    }

    try {
      // 2. Intelligent Phone Formatting
      const trimmed = phone.trim()
      let formattedPhone = ""

      if (trimmed.startsWith("+")) {
        // If it already has a +, just keep digits after it
        formattedPhone = "+" + trimmed.replace(/\D/g, "")
      } else {
        const digits = trimmed.replace(/\D/g, "")
        if (digits.startsWith("0")) {
          formattedPhone = "+62" + digits.substring(1)
        } else if (digits.startsWith("62")) {
          formattedPhone = "+" + digits
        } else if (digits.length > 0) {
          formattedPhone = "+62" + digits
        }
      }

      // 3. Insert into profiles
      const { error: insertError } = await supabase.from("profiles").insert({
        username: username.toLowerCase().trim(),
        email: email.toLowerCase().trim(),
        full_name: fullName.trim(),
        phone: formattedPhone,
      })

      if (insertError) {
        // 3. Surgical Error Parsing
        const msg = insertError.message.toLowerCase()
        const detail = (insertError as any).details?.toLowerCase() || ""

        if (
          insertError.code === "23505" ||
          msg.includes("duplicate") ||
          msg.includes("already exists")
        ) {
          if (msg.includes("email") || detail.includes("email")) {
            setError(
              dict.ERROR_EMAIL_EXISTS || "This email address is already in use."
            )
          } else if (msg.includes("username") || detail.includes("username")) {
            setError(
              dict.ERROR_USERNAME_EXISTS || "This username is already taken."
            )
          } else if (msg.includes("phone") || detail.includes("phone")) {
            setError(
              dict.ERROR_PHONE_EXISTS ||
                "This phone number is already registered."
            )
          } else {
            setError(
              dict.ERROR_INFO_EXISTS ||
                "An account with this information already exists."
            )
          }
        } else if (
          msg.includes("row-level security") ||
          msg.includes("permission denied")
        ) {
          setError(
            dict.ERROR_REG_RESTRICTED || "Registration is currently restricted."
          )
        } else {
          setError(dict.ERROR_SUBMIT_FAILED || "Unable to submit request.")
        }
        console.error("Signup error:", insertError)
      } else {
        setSuccess(true)
      }
    } catch (err) {
      setError(dict.ERROR_UNEXPECTED || "An unexpected error occurred.")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="login-background">
        <div className="login-card p-8 text-center">
          <h1 className="mb-4 text-2xl font-bold">
            {dict.SIGNUP_SUCCESS_TITLE}
          </h1>
          <p className="mb-8 text-pretty text-muted-foreground">
            {dict.SIGNUP_SUCCESS_MSG}
          </p>
          <Button asChild className="w-full">
            <Link href="/">{dict.LINK_RETURN_LOGIN}</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="login-background">
      <div className="login-card relative">
        <div className="lang-toggle-wrapper">
          <button
            onClick={() => setLanguage(lang === "en" ? "id" : "en")}
            className="lang-toggle-btn"
            title={dict.TOOLTIP_LANG}
          >
            {lang.toUpperCase()}
          </button>
        </div>

        <div className="banner-container h-64">
          <Image
            src={config.assets.loginImage}
            alt="Login Header"
            fill
            className="object-cover object-top transition-all duration-500"
            priority
          />
          <div className="banner-overlay" />
          <div className="banner-blur-mask" />

          <div className="absolute inset-x-0 bottom-0 z-20 p-8 pb-4">
            <Link
              href="/"
              className="mb-2 inline-flex items-center text-xs text-foreground/80 transition-colors hover:text-white"
            >
              <ArrowLeft className="mr-1 size-3" />
              {dict.LINK_BACK_LOGIN}
            </Link>
            <h1 className="text-3xl font-bold tracking-tight text-foreground/80">
              {dict.SIGNUP_TITLE}
            </h1>
            <p className="mt-1 text-xs text-pretty text-foreground/80">
              {dict.SIGNUP_SUBTITLE.replace("Nexus", config.brandName)}
            </p>
            <div className="mt-2 flex min-h-[60px] flex-col justify-start">
              {error && (
                <div className="animate-in rounded-md border border-destructive/50 bg-background/60 p-3 text-sm text-destructive backdrop-blur-md duration-200 zoom-in-95 fade-in">
                  {error}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-8 pt-4">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="fullName">{dict.LABEL_FULL_NAME}</Label>
                <div className="group relative">
                  <User className="absolute top-3 left-3 size-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                  <Input
                    id="fullName"
                    placeholder="John Doe"
                    className="pl-10"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="username">{dict.LABEL_USERNAME}</Label>
                <Input
                  id="username"
                  placeholder="johndoe"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">{dict.LABEL_EMAIL}</Label>
              <div className="group relative">
                <Mail className="absolute top-3 left-3 size-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  className="pl-10"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isSubmitting}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone">{dict.LABEL_PHONE}</Label>
              <div className="group relative">
                <Phone className="absolute top-3 left-3 size-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                <Input
                  id="phone"
                  type="tel"
                  placeholder={dict.PLACEHOLDER_PHONE}
                  className="pl-10"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
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
              {isSubmitting ? <ButtonLoader /> : null}
              {isSubmitting
                ? dict.BUTTON_SIGNUP_LOADING || "Sending Request..."
                : dict.BUTTON_SIGNUP || "Request Access"}
            </Button>
          </form>

          <div className="mt-8 text-center text-sm text-muted-foreground">
            {dict.TEXT_HAS_ACCOUNT}{" "}
            <Link
              href="/"
              className="font-semibold text-primary underline-offset-4 hover:underline"
            >
              {dict.LINK_LOGIN}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
