"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { useDictionary } from "@/components/dictionary-provider"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { CheckCircle2, AlertCircle, ShieldCheck, Download, Languages, Loader2 } from "lucide-react"
import { format } from "date-fns"
import { id as dateLocaleId } from "date-fns/locale"
import { generateStandardQuotationPDF } from "@/lib/pdf-generator"
import { notify } from "@/lib/notifications"
import { cn } from "@/lib/utils"

export default function VerificationPage() {
  const { id: uuid, type } = useParams()
  const { dict, lang, setLanguage } = useDictionary()
  const supabase = createClient()

  const [inputNumber, setInputNumber] = useState("")
  const [loading, setLoading] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [verifiedDoc, setVerifiedDoc] = useState<any>(null)
  const [pdfData, setPdfData] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [companyInfo, setCompanyInfo] = useState<any>(null)
  const [attempts, setAttempts] = useState(0)
  const [lastAttemptTime, setLastAttemptTime] = useState(0)

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Basic Rate Limiting (Client-side)
    const now = Date.now()
    if (attempts >= 5 && now - lastAttemptTime < 60000) {
      setError(dict.VERIFY_ERROR_RATE_LIMIT)
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/verify-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uuid, number: inputNumber, type })
      })

      const result = await res.json()

      if (res.ok && result.success) {
        const q = result.document
        const cInfo = result.companyInfo
        setVerifiedDoc(q)
        setCompanyInfo(cInfo)
        setAttempts(0)

        // Automatically generate PDF preview (Currently only supported for Quotations)
        if (cInfo && type === 'quotation') {
          const pdfUri = await generateStandardQuotationPDF(cInfo, q, { save: false, output: "datauri" })
          setPdfData(pdfUri as string)
        }
      } else {
        setAttempts(prev => prev + 1)
        setLastAttemptTime(Date.now())
        throw new Error(result.error || dict.VERIFY_ERROR_MSG)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadOfficial = async () => {
    if (!verifiedDoc || !companyInfo) return
    
    setDownloading(true)
    try {
      if (type === 'quotation') {
        await generateStandardQuotationPDF(companyInfo, verifiedDoc, { save: true })
      } else {
         // Placeholder for other types
         notify.error("Download not yet implemented for this document type")
      }
    } catch (err: any) {
      notify.error("Download failed", err.message)
    } finally {
      setDownloading(false)
    }
  }

  // Dynamic labels based on document type
  const getDocLabel = () => {
    if (type === 'quotation') return dict.VERIFY_LABEL_QUOTATION_NUMBER
    if (type === 'invoice') return lang === 'id' ? "Nomor Faktur" : "Invoice Number"
    if (type === 'delivery-order') return lang === 'id' ? "Nomor DO" : "DO Number"
    return "Document Number"
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      {/* Language Switcher */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setLanguage(lang === 'en' ? 'id' : 'en')}
          className="bg-white border shadow-sm"
        >
          <Languages className="size-4 mr-2" />
          {lang === 'en' ? 'Bahasa Indonesia' : 'English'}
        </Button>
      </div>

      <div className={cn("w-full transition-all duration-700", verifiedDoc ? "max-w-4xl" : "max-w-md")}>
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mb-4">
            <ShieldCheck className="size-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{dict.VERIFY_TITLE}</h1>
          <p className="text-slate-500 mt-2">{dict.VERIFY_SUBTITLE}</p>
        </div>

        {!verifiedDoc ? (
          <Card className="border-slate-200 shadow-xl">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">{getDocLabel()}</CardTitle>
              <CardDescription>
                {lang === 'id' 
                  ? `Masukkan nomor ${type} yang tertera pada dokumen untuk melanjutkan.`
                  : `Enter the ${type} number printed on the document to proceed.`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleVerify} className="space-y-4">
                <div className="space-y-2">
                  <Input
                    placeholder={dict.VERIFY_PLACEHOLDER_QUOTATION_NUMBER}
                    value={inputNumber}
                    onChange={(e) => setInputNumber(e.target.value)}
                    className="h-12 text-lg uppercase font-mono"
                    required
                  />
                </div>
                {error && (
                  <div className="flex items-start gap-2 p-3 rounded-md bg-red-50 text-red-600 text-sm border border-red-100 animate-in fade-in zoom-in duration-200">
                    <AlertCircle className="size-4 mt-0.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
                <Button type="submit" className="w-full h-12 text-lg" disabled={loading}>
                  {loading ? <Loader2 className="size-5 animate-spin mr-2" /> : <ShieldCheck className="size-5 mr-2" />}
                  {dict.VERIFY_BUTTON_VERIFY}
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="lg:col-span-1 space-y-6">
              <Card className="border-green-200 shadow-xl bg-white overflow-hidden">
                <div className="bg-green-600 p-6 text-white text-center">
                  <CheckCircle2 className="size-12 mx-auto mb-3" />
                  <h2 className="text-xl font-bold">{dict.VERIFY_SUCCESS_TITLE}</h2>
                  <p className="text-green-50/90 text-sm mt-1">{dict.VERIFY_SUCCESS_MSG}</p>
                </div>
                <CardContent className="p-6 space-y-6">
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 border-b pb-2">
                      {dict.VERIFY_DOC_DETAILS}
                    </h3>
                    <div className="space-y-4 text-sm">
                      <div>
                        <Label className="text-slate-500">{getDocLabel()}</Label>
                        <p className="font-mono font-bold text-slate-900">{verifiedDoc.quotation_number || verifiedDoc.invoice_number || verifiedDoc.do_number}</p>
                      </div>
                      <div>
                        <Label className="text-slate-500">{dict.VERIFY_LABEL_DATE}</Label>
                        <p className="font-semibold text-slate-900">
                          {format(new Date(verifiedDoc.quotation_date || verifiedDoc.created_at), "dd MMMM yyyy", { locale: lang === 'id' ? dateLocaleId : undefined })}
                        </p>
                      </div>
                      <div>
                        <Label className="text-slate-500">{dict.VERIFY_LABEL_COMPANY}</Label>
                        <p className="font-semibold text-slate-900">{verifiedDoc.company?.name}</p>
                      </div>
                    </div>
                  </div>

                  <Button 
                    variant="default" 
                    className="w-full h-12 text-lg bg-slate-900 hover:bg-slate-800"
                    onClick={handleDownloadOfficial}
                    disabled={downloading}
                  >
                    {downloading ? (
                      <>
                        <Loader2 className="size-5 animate-spin mr-2" />
                        {dict.VERIFY_BUTTON_DOWNLOADING}
                      </>
                    ) : (
                      <>
                        <Download className="size-5 mr-2" />
                        {dict.VERIFY_BUTTON_DOWNLOAD_OFFICIAL}
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-2">
              <Card className="border-slate-200 shadow-xl bg-white h-[600px] overflow-hidden flex flex-col">
                {pdfData ? (
                  <iframe 
                    src={`${pdfData}#toolbar=0&navpanes=0`}
                    className="w-full h-full border-0"
                    title="PDF Preview"
                  />
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-4">
                    {type === 'quotation' ? (
                      <>
                        <Loader2 className="size-8 animate-spin" />
                        <p>Generating preview...</p>
                      </>
                    ) : (
                      <p>Preview not available for this document type</p>
                    )}
                  </div>
                )}
              </Card>
            </div>
          </div>
        )}

        <p className="text-center text-slate-400 text-xs mt-8">
          {dict.COPYRIGHT}
        </p>
      </div>
    </div>
  )
}
