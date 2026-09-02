"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useDictionary } from "@/components/dictionary-provider"
import { SITE_CONFIG } from "@/lib/site-content"
import { useAuth } from "@/components/auth-provider"
import { createClient } from "@/lib/supabase"
import { useDebounce } from "@/hooks/use-debounce"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Plus,
  Search,
  Pencil,
  Save,
  X,
  Trash2,
  ChevronDown,
  Wallet,
  AlertCircle,
  RefreshCw,
  Printer,
  CheckCircle2,
  FileText,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { cn, constructMultiWordSearch } from "@/lib/utils"
import { SectionLoader } from "@/components/section-loader"
import { notify } from "@/lib/notifications"
import { LiveSearch } from "@/components/live-search"
import { format } from "date-fns"
import { ButtonLoader } from "@/components/button-loader"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { NumberInput } from "@/components/number-input"
import { generateStandardPaymentPDF } from "@/lib/pdf-generator"
import { SummaryCard } from "@/components/summary-card"
import { usePersistedState } from "@/hooks/use-persisted-state"
import dynamic from "next/dynamic"

const Gallery = dynamic(() => import("@/components/Gallery"), { ssr: false })

const PAGE_SIZE = 50

interface AppSettingsRow {
  id?: string
  category: string
  name: string
  value: unknown
  description?: string | null
}

interface CompanyInfo {
  name?: string
  address?: string
  email?: string
  npwp?: string
  npwp_address?: string
  logo_url?: string
}

interface InvoiceInfo {
  id: string
  invoice_number: string
  total_amount: number
  paid_amount: number
  company?: {
    name?: string
    nickname?: string
    details?: {
      contact_persons?: { email?: string; name?: string }[]
      cc_emails?: string
      bcc_emails?: string
    }
  }
}

interface PaymentWithRelations {
  id: string
  payment_number: string
  invoice_id: string
  payment_date: string
  amount: number
  payment_method: string
  reference_number?: string
  status: string
  note?: string
  invoice?: InvoiceInfo
}

interface PreviewDoc {
  id?: string
  title: string
  description: string
  images: string[]
  pdf: string
  customerEmail?: string
  contacts: { name: string; email?: string }[]
  ccEmails?: string
  bccEmails?: string
  raw: PaymentWithRelations
}

type GalleryDoc = {
  id?: string
  title: string
  description: string
  images: string[]
  pdf?: string
  customerEmail?: string
  contacts?: { name: string; email?: string }[]
  ccEmails?: string
  bccEmails?: string
  raw?: unknown
}

export default function PaymentsPage() {
  const { dict, lang } = useDictionary()
  const { hasPermission, loading: authLoading } = useAuth()
  const supabase = createClient()

  const [payments, setPayments] = useState<PaymentWithRelations[]>([])
  const [updatedRowId, setUpdatedRowId] = useState<string | null>(null)
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null)
  const [previewDoc, setPreviewDoc] = useState<PreviewDoc | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [offset, setOffset] = useState(0)
  const [isSaving, setIsSaving] = useState(false)

  // Stats State
  const [stats, setStats] = useState({
    totalPayments: 0,
    totalAmount: 0,
    pendingCount: 0,
    verifiedCount: 0,
  })

  // Dialog State
  const [isOpen, setIsOpen] = usePersistedState("payments_dialog_open", false)
  const [editingItem, setEditingItem] = useState<PaymentWithRelations | null>(
    null
  )
  const [viewOnly, setViewOnly] = useState(false)

  // Filter States
  const [searchQuery, setSearchQuery] = useState("")
  const debouncedSearchQuery = useDebounce(searchQuery, 300)

  const observerTarget = useRef(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const statusStyles: Record<string, string> = {
    Pending:
      "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
    Verified:
      "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
    Rejected:
      "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20",
  }

  // Fetch Stats
  const fetchStats = useCallback(async () => {
    try {
      const { data: allPayments } = await supabase
        .from("payments")
        .select("id, amount, status")

      if (allPayments) {
        type PaymentStatsRow = (typeof allPayments)[number]
        const totalAmount = allPayments.reduce(
          (sum: number, p: PaymentStatsRow) => sum + (Number(p.amount) || 0),
          0
        )
        const pendingCount = allPayments.filter(
          (p: PaymentStatsRow) => p.status === "Pending"
        ).length
        const verifiedCount = allPayments.filter(
          (p: PaymentStatsRow) => p.status === "Verified"
        ).length

        setStats({
          totalPayments: allPayments.length,
          totalAmount,
          pendingCount,
          verifiedCount,
        })
      }
    } catch (err) {
      console.error("Fetch Stats Error:", err)
    }
  }, [supabase])

  // Form State
  const [formData, setFormData] = useState(() => ({
    payment_number: "",
    invoice_id: "",
    payment_date: format(new Date(), "yyyy-MM-dd"),
    amount: 0,
    payment_method: "Bank Transfer",
    reference_number: "",
    status: "Pending",
    note: "",
  }))

  const [selectedInvoiceInfo, setSelectedInvoiceInfo] =
    useState<InvoiceInfo | null>(null)

  const fetchData = useCallback(
    async (isInitial = false) => {
      if (isInitial) {
        setLoading(true)
        setOffset(0)
        fetchStats()
      } else {
        setLoadingMore(true)
      }

      try {
        const currentOffset = isInitial ? 0 : offset

        // Fetch company settings on initial load
        if (isInitial) {
          const { data: settings } = await supabase
            .from("app_settings")
            .select("*")
            .eq("category", "company")
          const info: Record<string, string> = {}
          settings?.forEach((r: AppSettingsRow) => {
            info[r.name] = (r.value as string) || ""
          })
          setCompanyInfo(info as CompanyInfo)
        }

        let query = supabase
          .from("payments")
          .select(
            "*, invoice:invoices(id, invoice_number, total_amount, paid_amount, company:companies(name, nickname))"
          )
          .order("created_at", { ascending: false })
          .range(currentOffset, currentOffset + PAGE_SIZE - 1)

        if (debouncedSearchQuery) {
          const searchStr = constructMultiWordSearch(debouncedSearchQuery, [
            "payment_number",
            "reference_number",
          ])
          if (searchStr) query = query.or(searchStr)
        }

        const { data, error } = await query
        if (error) throw error

        if (data) {
          const rows = data as PaymentWithRelations[]
          if (isInitial) {
            setPayments(rows)
          } else {
            setPayments((prev) => {
              const newItems = rows.filter(
                (item) => !prev.some((p) => p.id === item.id)
              )
              return [...prev, ...newItems]
            })
          }
          setHasMore(rows.length === PAGE_SIZE)
          setOffset(currentOffset + rows.length)
        }
      } catch (err: unknown) {
        notify.error(
          dict.MSG_DATA_FETCH_FAILED,
          err instanceof Error ? err.message : String(err)
        )
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [
      supabase,
      offset,
      debouncedSearchQuery,
      dict.MSG_DATA_FETCH_FAILED,
      fetchStats,
    ]
  )

  const handleRefresh = () => {
    fetchData(true)
  }

  useEffect(() => {
    fetchData(true)
  }, [debouncedSearchQuery])

  // Ordinary Infinite Scroll
  useEffect(() => {
    const rootElement = containerRef.current
    if (!rootElement) return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry.isIntersecting && hasMore && !loading && !loadingMore) {
          fetchData(false)
        }
      },
      {
        root: rootElement,
        rootMargin: "400px",
        threshold: 0,
      }
    )

    if (observerTarget.current) {
      observer.observe(observerTarget.current)
    }

    return () => observer.disconnect()
  }, [fetchData, hasMore, loading, loadingMore])

  const canView = hasPermission("payments", "view")
  const canInsert = hasPermission("payments", "insert")
  const canEdit = hasPermission("payments", "edit")
  const canDelete = hasPermission("payments", "delete")
  const canPrint = hasPermission("payments", "print")

  if (!canView && !loading && !authLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="space-y-2 text-center">
          <AlertCircle className="mx-auto size-8 text-destructive" />
          <h2 className="text-lg font-semibold">
            {dict.MSG_ACCESS_DENIED || "Access Denied"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {dict.MSG_NO_PERMISSION ||
              "You do not have permission to view this page."}
          </p>
        </div>
      </div>
    )
  }

  const handleOpenDialog = (
    item: PaymentWithRelations | null = null,
    isViewOnly = false
  ) => {
    setViewOnly(isViewOnly)
    if (item) {
      setEditingItem(item)
      setSelectedInvoiceInfo(item.invoice ?? null)

      setFormData({
        payment_number: item.payment_number,
        invoice_id: item.invoice_id,
        payment_date: item.payment_date,
        amount: item.amount,
        payment_method: item.payment_method,
        reference_number: item.reference_number || "",
        status: item.status,
        note: item.note || "",
      })
    } else {
      if (!canInsert) return
      setEditingItem(null)
      setSelectedInvoiceInfo(null)

      setFormData({
        payment_number: "",
        invoice_id: "",
        payment_date: format(new Date(), "yyyy-MM-dd"),
        amount: 0,
        payment_method: "Bank Transfer",
        reference_number: "",
        status: "Pending",
        note: "",
      })
    }
    setIsOpen(true)
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const payload = { ...formData }

      if (!editingItem && !payload.payment_number) {
        // For payments, company is linked through invoice - pass null for now
        const { data, error: rpcError } = await supabase.rpc(
          "generate_document_number",
          { p_doc_type: "payment", p_company_id: null }
        )
        if (rpcError) throw rpcError
        payload.payment_number = data
      }

      if (editingItem) {
        const { error } = await supabase
          .from("payments")
          .update(payload)
          .eq("id", editingItem.id)
        if (error) throw error

        // Fetch updated row to keep local state in sync with relations
        const { data: updatedRow, error: fetchError } = await supabase
          .from("payments")
          .select(
            "*, invoice:invoices(id, invoice_number, total_amount, paid_amount, company:companies(name, nickname))"
          )
          .eq("id", editingItem.id)
          .single()

        if (!fetchError && updatedRow) {
          setPayments((prev) =>
            prev.map((p) => (p.id === editingItem.id ? updatedRow : p))
          )
          setUpdatedRowId(editingItem.id)
        } else {
          fetchData(true)
        }
      } else {
        const { error } = await supabase.from("payments").insert([payload])
        if (error) throw error
        fetchData(true)
      }

      const companyName = selectedInvoiceInfo?.company?.name || ""
      const docLabel = `[${payload.payment_number || formData.payment_number}]`
      if (editingItem) {
        notify.success(
          dict.MSG_UPDATE_SUCCESS.replace("%data%", docLabel),
          dict.MSG_SUCCESS_UPDATE_DESC.replace("%entity%", "payment").replace(
            "%company%",
            `[${companyName}]`
          ),
          undefined,
          true
        )
      } else {
        notify.success(
          dict.MSG_SAVE_SUCCESS.replace("%data%", docLabel),
          dict.MSG_SUCCESS_SAVE_DESC.replace("%entity%", "payment").replace(
            "%company%",
            `[${companyName}]`
          ),
          undefined,
          true
        )
      }
      setIsOpen(false)
    } catch (err: unknown) {
      const docLabel = `[${formData.payment_number}]`
      notify.error(
        dict.MSG_SAVE_FAILED.replace("%data%", docLabel),
        err instanceof Error ? err.message : String(err)
      )
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    const item = payments.find((p) => p.id === id)
    if (!item) return
    const docLabel = `[${item.payment_number}]`
    const companyName = item.invoice?.company?.name || ""
    if (!confirm(dict.MSG_DELETE_CONFIRM || "Are you sure?")) return
    try {
      const { error } = await supabase.from("payments").delete().eq("id", id)
      if (error) throw error

      setPayments((prev) => prev.filter((p) => p.id !== id))
      notify.deleted(
        dict.MSG_DELETE_SUCCESS.replace("%data%", docLabel),
        dict.MSG_SUCCESS_DELETE_DESC.replace("%entity%", "payment").replace(
          "%company%",
          `[${companyName}]`
        ),
        undefined,
        true
      )
    } catch (err: unknown) {
      notify.error(
        dict.MSG_SAVE_FAILED.replace("%data%", docLabel),
        err instanceof Error ? err.message : String(err)
      )
    }
  }

  const updateStatus = async (id: string, status: string) => {
    const item = payments.find((p) => p.id === id)
    if (!item) return
    const docLabel = `[${item.payment_number}]`
    const companyName = item.invoice?.company?.name || ""
    try {
      const { error } = await supabase
        .from("payments")
        .update({ status })
        .eq("id", id)
      if (error) throw error

      setPayments((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status } : p))
      )
      setUpdatedRowId(id)
      notify.success(
        dict.MSG_QUOTATION_STATUS_UPDATED.replace("%data%", docLabel),
        dict.MSG_SUCCESS_STATUS_DESC.replace("%status%", `[${status}]`).replace(
          "%company%",
          `[${companyName}]`
        ),
        undefined,
        true
      )
      fetchStats()
    } catch (err: unknown) {
      notify.error(
        dict.MSG_UPDATE_FAILED.replace("%data%", docLabel),
        err instanceof Error ? err.message : String(err)
      )
    }
  }

  // Handle Print with Gallery preview
  const handlePrint = async (p: PaymentWithRelations) => {
    if (!companyInfo) {
      notify.error("Error", "Company info not loaded")
      return
    }
    try {
      const dataUri = await generateStandardPaymentPDF(companyInfo, p, {
        save: false,
        output: "datauri",
      })
      if (!dataUri || typeof dataUri !== "string") {
        throw new Error("Failed to generate PDF data URI")
      }
      const contacts = (
        p.invoice?.company?.details?.contact_persons?.length
          ? p.invoice.company.details.contact_persons
          : []
      ).filter((c): c is { name: string; email?: string } => !!c.name)
      setPreviewDoc({
        id: p.id,
        title: p.payment_number,
        description: p.invoice?.company?.name || "-",
        images: [],
        pdf: dataUri,
        customerEmail: contacts[0]?.email || "",
        contacts: contacts,
        ccEmails: p.invoice?.company?.details?.cc_emails || "",
        bccEmails: p.invoice?.company?.details?.bcc_emails || "",
        raw: p,
      })
    } catch (err: unknown) {
      notify.error(
        "Failed to generate PDF",
        err instanceof Error ? err.message : String(err)
      )
    }
  }

  const handleDownload = (doc: GalleryDoc) => {
    const link = document.createElement("a")
    if (!doc.pdf) return
    link.href = doc.pdf
    const raw = doc.raw as PaymentWithRelations | undefined
    const nickname =
      raw?.invoice?.company?.nickname || raw?.invoice?.company?.name || ""
    link.download = `P - ${nickname} - ${doc.title}.pdf`
    link.click()
    notify.success(
      dict.MSG_PRINT_SUCCESS,
      dict.MSG_PRINT_SUCCESS_DESC?.replace("%data%", `[${doc.title}]`),
      undefined,
      false
    )
  }

  const handleSendEmail = async (doc: GalleryDoc) => {
    try {
      const p = (doc.raw || doc) as PaymentWithRelations
      const pdfDataUri = await generateStandardPaymentPDF(companyInfo, p, {
        save: false,
        output: "datauri",
      })
      if (!pdfDataUri) throw new Error("Failed to generate PDF for attachment.")
      const attachments = [
        {
          filename: `P - ${p.invoice?.company?.nickname || p.invoice?.company?.name || ""} - ${doc.title}.pdf`,
          content: (pdfDataUri as string).split(",")[1],
        },
      ]
      const { data: ccData } = await supabase
        .from("app_settings")
        .select("value")
        .eq("category", "email")
        .eq("name", "cc_payment")
        .single()
      const globalCcList = ccData?.value
        ? ccData.value
            .split(",")
            .map((email: string) => email.trim())
            .filter((e: string) => e !== "")
        : []
      const companyCcList = doc.ccEmails
        ? doc.ccEmails
            .split(",")
            .map((email: string) => email.trim())
            .filter((e: string) => e !== "")
        : []
      const ccList = [...new Set([...globalCcList, ...companyCcList])]

      const { data: bccData } = await supabase
        .from("app_settings")
        .select("value")
        .eq("category", "email")
        .eq("name", "bcc_payment")
        .single()
      const globalBccList = bccData?.value
        ? bccData.value
            .split(",")
            .map((email: string) => email.trim())
            .filter((e: string) => e !== "")
        : []
      const companyBccList = doc.bccEmails
        ? doc.bccEmails
            .split(",")
            .map((email: string) => email.trim())
            .filter((e: string) => e !== "")
        : []
      const bccList = [...new Set([...globalBccList, ...companyBccList])]

      const paymentDate = p.payment_date
        ? new Date(p.payment_date).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          })
        : "-"

      const emailHtml = `<div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 800px; margin: 0 auto; padding: 0; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: #ffffff;">
        <div style="background: #00955c; padding: 32px 40px; text-align: center;">
          <h1 style="color: #ffffff; font-size: 28px; margin: 0 0 4px 0; font-weight: 700; letter-spacing: -0.5px;">PT Anugerah Buana Sriwijaya</h1>
          <p style="color: rgba(255,255,255,0.9); font-size: 14px; margin: 0;">Industrial Fuel Distributor</p>
        </div>
        <div style="background: #f8fafc; padding: 20px 40px; border-bottom: 1px solid #e2e8f0; text-align: center;">
          <span style="display: inline-block; background: #00955c; color: white; padding: 8px 24px; border-radius: 20px; font-size: 14px; font-weight: 600; letter-spacing: 0.5px;">PAYMENT CONFIRMATION</span>
        </div>
        <div style="padding: 40px;">
          <p style="color: #1e293b; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">Dear <strong style="color: #00955c;">${p.invoice?.company?.name || "Valued Customer"}</strong>,</p>
          <p style="color: #475569; font-size: 15px; line-height: 1.7; margin: 0 0 20px 0;">We are pleased to confirm that we have received your payment. Please find the payment receipt attached for your records.</p>
          <div style="background: #f8fafc; border-radius: 8px; padding: 24px; margin: 24px 0; border-left: 4px solid #00955c;">
            <h3 style="color: #1e293b; font-size: 16px; margin: 0 0 16px 0; font-weight: 600;">Payment Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px; width: 35%;">Payment No.</td>
                <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${p.payment_number || "-"}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Date</td>
                <td style="padding: 8px 0; color: #1e293b; font-size: 14px;">${paymentDate}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Invoice No.</td>
                <td style="padding: 8px 0; color: #1e293b; font-size: 14px;">${p.invoice?.invoice_number || "-"}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Amount</td>
                <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${SITE_CONFIG.currencySymbol} ${Number(p.amount || 0).toLocaleString()}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Method</td>
                <td style="padding: 8px 0; color: #1e293b; font-size: 14px;">${p.payment_method || "-"}</td>
              </tr>
            </table>
          </div>
          <p style="color: #475569; font-size: 15px; line-height: 1.7; margin: 24px 0;">For your reference, you can verify this payment using the QR code attached to the PDF document.</p>
          <p style="color: #475569; font-size: 15px; line-height: 1.7; margin: 24px 0 32px 0;">Should you have any questions or require further clarification, please do not hesitate to contact us.</p>
          <p style="color: #1e293b; font-size: 15px; line-height: 1.6; margin: 0;">Best regards,<br><strong style="font-size: 16px;">PT Anugerah Buana Sriwijaya</strong><br><span style="color: #64748b; font-size: 14px;">Finance Team</span></p>
        </div>
        <div style="background: #f8fafc; padding: 24px 40px; border-top: 1px solid #e2e8f0;">
          <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0; line-height: 1.6;">This is an automated message from PT Anugerah Buana Sriwijaya.<br>Please do not reply directly to this email.<br><br>&copy; ${new Date().getFullYear()} PT Anugerah Buana Sriwijaya. All rights reserved.</p>
        </div>
      </div>`

      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: doc.customerEmail,
          cc: ccList,
          bcc: bccList,
          subject: `Payment Confirmation ${p.payment_number} - PT Anugerah Buana Sriwijaya`,
          html: emailHtml,
          attachments,
        }),
      })
      const result = await res.json()
      if (result.success) {
        notify.success(
          dict.MSG_EMAIL_SENT_SUCCESS || "Email Sent",
          dict.MSG_EMAIL_SENT_SUCCESS_DESC?.replace(
            "%data%",
            `[${p.payment_number}]`
          ) || `Payment confirmation sent`,
          undefined,
          true
        )
      } else throw new Error(result.error)
    } catch (err: unknown) {
      notify.error(
        "Failed to send email",
        err instanceof Error ? err.message : String(err)
      )
    }
  }

  return (
    <div className="page-container">
      <div className="page-header shrink-0">
        <h1 className="page-title">
          <Wallet className="mr-2 inline-block size-5 text-primary" />
          {dict.MENU_PAYMENTS || "Payments"}
        </h1>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={loading || loadingMore}
            title="Refresh Data"
          >
            <RefreshCw
              className={cn(
                "size-4",
                (loading || loadingMore) && "animate-spin"
              )}
            />
          </Button>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                onClick={() => handleOpenDialog()}
                disabled={!canInsert}
              >
                <Plus data-icon="inline-start" />
                {dict.BUTTON_RECORD_PAYMENT || "Record Payment"}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-3xl">
              <DialogHeader>
                <DialogTitle>
                  <Wallet className="mr-2 inline-block size-5" />
                  {viewOnly
                    ? formData.payment_number
                    : editingItem
                      ? `${dict.BUTTON_EDIT} ${dict.MENU_PAYMENTS}`
                      : `${dict.BUTTON_ADD} ${dict.MENU_PAYMENTS}`}
                </DialogTitle>
                <DialogDescription />
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  handleSave()
                }}
                className="relative max-h-[70vh] overflow-y-auto"
              >
                <div
                  className={cn(
                    `relative flex w-full flex-col gap-6 p-5 ${viewOnly ? "rounded-b-xl border-2 border-orange-500" : ""}`
                  )}
                >
                  {viewOnly && <div className="absolute inset-0 z-20"></div>}
                  <div className="grid gap-2">
                    <Label>
                      {dict.LABEL_PAYMENT_NUMBER || "Payment Number"}
                    </Label>
                    <Input
                      value={formData.payment_number}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          payment_number: e.target.value,
                        })
                      }
                      disabled={
                        editingItem !== null &&
                        !hasPermission("payments", "edit")
                      }
                      placeholder={dict.LABEL_AUTO_GENERATED}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label>{dict.MENU_INVOICE}</Label>
                    <LiveSearch
                      data={selectedInvoiceInfo ? [selectedInvoiceInfo] : []}
                      fetchData={async (query) => {
                        let q = supabase
                          .from("invoices")
                          .select(
                            "id, invoice_number, total_amount, paid_amount, company:companies(name, nickname)"
                          )
                          .neq("status", "Cancelled")
                          .limit(8)
                        if (query) {
                          const searchStr = constructMultiWordSearch(query, [
                            "invoice_number",
                          ])
                          if (searchStr) q = q.or(searchStr)
                        }
                        const { data } = await q
                        return data || []
                      }}
                      value={formData.invoice_id}
                      onSelect={(val, item) => {
                        setFormData({
                          ...formData,
                          invoice_id: val,
                          amount: item
                            ? item.total_amount - item.paid_amount
                            : 0, // Auto-fill remaining amount
                        })
                        setSelectedInvoiceInfo(item as InvoiceInfo | null)
                      }}
                      keyField="id"
                      displayField={(i) =>
                        `${i.invoice_number} - ${i.company?.name || ""}`
                      }
                      defaultDisplay={
                        selectedInvoiceInfo
                          ? `${selectedInvoiceInfo.invoice_number} - ${selectedInvoiceInfo.company?.name || ""}`
                          : ""
                      }
                      searchColumns={["invoice_number"]}
                      visualColumns={[
                        {
                          key: "invoice_number",
                          header: dict.MENU_INVOICE,
                          className: "w-1/2 font-medium font-mono",
                          primary: true,
                        },
                        {
                          key: "company.name" as keyof InvoiceInfo,
                          header: dict.LABEL_TYPE_CUSTOMER,
                          className: "w-1/2",
                        },
                      ]}
                      placeholder={dict.PLACEHOLDER_SELECT_QUOTATION?.replace(
                        dict.MENU_QUOTATION,
                        dict.MENU_INVOICE
                      )}
                    />
                    {selectedInvoiceInfo && (
                      <div className="mt-1 flex gap-4 text-xs text-muted-foreground">
                        <span>
                          {dict.VERIFY_LABEL_TOTAL?.split(" ")[0]} Total:{" "}
                          {SITE_CONFIG.currencySymbol}{" "}
                          {Number(
                            selectedInvoiceInfo.total_amount
                          ).toLocaleString()}
                        </span>
                        <span className="font-medium text-amber-600">
                          {dict.LABEL_DUE_DATE?.split(" ")[0]} Due:{" "}
                          {SITE_CONFIG.currencySymbol}{" "}
                          {(
                            selectedInvoiceInfo.total_amount -
                            selectedInvoiceInfo.paid_amount
                          ).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>{dict.LABEL_PAYMENT_DATE || "Payment Date"}</Label>
                      <Input
                        type="date"
                        value={formData.payment_date}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            payment_date: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>{dict.LABEL_AMOUNT}</Label>
                      <NumberInput
                        type="number"
                        value={formData.amount}
                        onChange={(value) =>
                          setFormData({
                            ...formData,
                            amount: value,
                          })
                        }
                        leftBadge={SITE_CONFIG.currencySymbol}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>{dict.LABEL_PAYMENT_METHOD}</Label>
                      <Select
                        value={formData.payment_method}
                        onValueChange={(v) =>
                          setFormData({ ...formData, payment_method: v })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={dict.LABEL_ALL} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Bank Transfer">
                            {lang === "id" ? "Transfer Bank" : "Bank Transfer"}
                          </SelectItem>
                          <SelectItem value="Cash">
                            {lang === "id" ? "Tunai" : "Cash"}
                          </SelectItem>
                          <SelectItem value="Cheque">
                            {lang === "id" ? "Cek / Giro" : "Cheque / Giro"}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>
                        {dict.LABEL_REFERENCE_NUMBER || "Reference Number"}
                      </Label>
                      <Input
                        value={formData.reference_number}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            reference_number: e.target.value,
                          })
                        }
                        placeholder="e.g. TRF-123456"
                      />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label>{dict.LABEL_INTERNAL_NOTE || "Internal Note"}</Label>
                    <Textarea
                      value={formData.note}
                      onChange={(e) =>
                        setFormData({ ...formData, note: e.target.value })
                      }
                      placeholder={dict.PLACEHOLDER_EDITOR}
                    />
                  </div>

                  {/* Status Badge in View Mode */}
                  {viewOnly && (
                    <div className="flex items-center gap-2 rounded border bg-muted/50 p-3">
                      <span className="text-sm font-medium">Status:</span>
                      <span
                        className={cn(
                          "rounded border px-2 py-0.5 text-[10px] font-bold uppercase",
                          statusStyles[formData.status] || statusStyles.Pending
                        )}
                      >
                        {formData.status}
                      </span>
                    </div>
                  )}
                </div>
              </form>
              {!viewOnly && (
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsOpen(false)}>
                    <X className="mr-2 size-4" />
                    {dict.BUTTON_CANCEL}
                  </Button>
                  <Button onClick={handleSave} disabled={isSaving || !canEdit}>
                    {isSaving ? (
                      <ButtonLoader />
                    ) : (
                      <Save className="mr-2 size-4" />
                    )}
                    {dict.BUTTON_SAVE}
                  </Button>
                </DialogFooter>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="action-bar shrink-0">
        <div className="relative w-full max-w-sm flex-1">
          <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder={dict.PLACEHOLDER_SEARCH}
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <Card
        ref={containerRef}
        className="data-card custom-scrollbar flex-1 overflow-auto"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{dict.LABEL_PAYMENT_NUMBER || "Payment No"}</TableHead>
              <TableHead>
                {dict.MENU_INVOICE} & {dict.LABEL_TYPE_CUSTOMER}
              </TableHead>
              <TableHead>{dict.VERIFY_LABEL_DATE || "Date"}</TableHead>
              <TableHead className="text-right">{dict.LABEL_AMOUNT}</TableHead>
              <TableHead className="text-center">{dict.LABEL_STATUS}</TableHead>
              <TableHead className="text-right"> </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="p-0">
                  <SectionLoader />
                </TableCell>
              </TableRow>
            ) : payments.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-10 text-center text-muted-foreground"
                >
                  {dict.NO_DATA}
                </TableCell>
              </TableRow>
            ) : (
              payments.map((p) => (
                <TableRow
                  key={p.id}
                  className={cn(
                    "cursor-pointer",
                    updatedRowId === p.id && "animate-row-highlight"
                  )}
                  onDoubleClick={() => handleOpenDialog(p, true)}
                  onAnimationEnd={() => {
                    if (updatedRowId === p.id) setUpdatedRowId(null)
                  }}
                >
                  <TableCell className="text-sm">{p.payment_number}</TableCell>
                  <TableCell>
                    <div className="text-sm font-medium">
                      {p.invoice?.invoice_number}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {p.invoice?.company?.name}
                    </div>
                  </TableCell>
                  <TableCell className="text-center text-sm">
                    {format(new Date(p.payment_date), "dd MMM yyyy")}
                  </TableCell>
                  <TableCell className="text-right font-bold text-green-700">
                    {SITE_CONFIG.currencySymbol}{" "}
                    {Number(p.amount).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-center align-middle">
                    <div
                      className={cn(
                        "inline-flex w-20 items-center justify-center rounded-full px-2 py-1 text-[10px] font-bold uppercase",
                        statusStyles[p.status]
                      )}
                    >
                      {p.status}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="table_action"
                        size="sm"
                        onClick={() => handleOpenDialog(p)}
                        disabled={!canEdit}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="table_action"
                        size="sm"
                        onClick={() => handlePrint(p)}
                        disabled={!canPrint}
                      >
                        <Printer className="size-4" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="secondary"
                            size="icon"
                            className="size-8"
                            disabled={!canEdit && !canDelete}
                          >
                            <span className="sr-only">{dict.LABEL_STATUS}</span>
                            <ChevronDown className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                              <CheckCircle2 className="mr-2 size-4" /> Status
                            </DropdownMenuSubTrigger>
                            <DropdownMenuPortal>
                              <DropdownMenuSubContent>
                                <DropdownMenuItem
                                  onClick={() => updateStatus(p.id, "Pending")}
                                  className="font-medium text-amber-600 dark:text-amber-400"
                                >
                                  Pending
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => updateStatus(p.id, "Verified")}
                                  className="font-medium text-emerald-600 dark:text-emerald-400"
                                >
                                  Verified
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => updateStatus(p.id, "Rejected")}
                                  className="font-medium text-rose-600 dark:text-rose-400"
                                >
                                  Rejected
                                </DropdownMenuItem>
                              </DropdownMenuSubContent>
                            </DropdownMenuPortal>
                          </DropdownMenuSub>
                          {canDelete && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => handleDelete(p.id)}
                              >
                                <Trash2 className="mr-2 size-4" />
                                {dict.BUTTON_DELETE}
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}

            {/* Infinite Scroll Sentinel & Loader */}
            <TableRow ref={observerTarget} className="border-0">
              <TableCell colSpan={6} className="overflow-hidden border-0 p-0">
                {loadingMore && (
                  <div className="relative h-24 w-full">
                    <SectionLoader />
                  </div>
                )}
                {!hasMore && payments.length > 0 && !loading && (
                  <div className="py-3 text-center text-xs text-danger/70 select-none">
                    — End of data —
                  </div>
                )}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>

      <div className="grid shrink-0 grid-cols-4 gap-2 md:gap-4">
        <SummaryCard
          label="Total Payments"
          value={stats.totalPayments}
          icon={Wallet}
          color="slate"
        />
        <SummaryCard
          label="Total Amount"
          value={`${SITE_CONFIG.currencySymbol} ${stats.totalAmount.toLocaleString()}`}
          icon={FileText}
          color="green"
        />
        <SummaryCard
          label="Pending"
          value={stats.pendingCount}
          icon={AlertCircle}
          color="amber"
        />
        <SummaryCard
          label="Verified"
          value={stats.verifiedCount}
          icon={CheckCircle2}
          color="blue"
        />
      </div>

      {previewDoc && (
        <Gallery
          docs={[previewDoc]}
          initialIndex={0}
          labels={{
            previewDocument: "Preview Payment",
            clickToPreview: "Click to preview",
            previousPage: "Previous",
            nextPage: "Next",
            pageLabel: "Page",
            closePreview: "Close",
            download: "Download PDF",
            sendEmail: "Send to Customer",
            confirmEmail:
              "Are you sure you want to send this payment confirmation to",
          }}
          onDownload={handleDownload}
          onSendEmail={handleSendEmail}
          onClose={() => setPreviewDoc(null)}
        />
      )}
    </div>
  )
}
