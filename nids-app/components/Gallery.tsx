"use client"

import "./pdf-polyfills"
import { useState, useEffect, useRef, useCallback, startTransition } from "react"
import Image from "next/image"
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Mail,
  Loader2,
  FileText,
  ZoomIn,
  ZoomOut,
  Maximize,
  ArrowLeftRight,
  ArrowUpDown,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "./ui/button"
import { cn } from "@/lib/utils"
import { notify } from "@/lib/notifications"
import { pdfjs, Document, Page } from "react-pdf"

// Configure PDF.js worker - bundle locally via bundler (no CDN dependency)
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString()

const PDF_OPTIONS = {
  verbosity: 0,
}

import "react-pdf/dist/Page/AnnotationLayer.css"
import "react-pdf/dist/Page/TextLayer.css"
type Doc = {
  title: string
  description: string
  images: string[]
  pdf?: string
  id?: string
  customerEmail?: string
  contacts?: { name: string; email?: string }[]
  ccEmails?: string
  bccEmails?: string
  raw?: any
}

type GalleryProps = {
  docs: Doc[]
  initialIndex: number | null
  labels: {
    previewDocument: string
    clickToPreview: string
    previousPage: string
    nextPage: string
    pageLabel: string
    closePreview: string
    download: string
    sendEmail: string
    confirmEmail: string
  }
  onDownload?: (doc: Doc) => void
  onSendEmail?: (doc: Doc) => Promise<void>
  onClose?: () => void
}

export default function Gallery({
  docs,
  initialIndex,
  labels,
  onDownload,
  onSendEmail,
  onClose,
}: GalleryProps) {
  // Reference width for PDF rendering at 100% zoom
  // A4 width: 8.27 inches × 96 DPI = 794px (matches desktop PDF viewers on Windows)
  const REFERENCE_WIDTH = 794

  const [activeDocIndex, setActiveDocIndex] = useState<number | null>(
    initialIndex
  )
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const [isSending, setIsSending] = useState(false)

  // Email Selection Dialog State
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false)
  const [selectedEmail, setSelectedEmail] = useState("")
  const [ccEmails, setCcEmails] = useState("")
  const [bccEmails, setBccEmails] = useState("")

  // PDF State
  const [numPages, setNumPages] = useState<number | null>(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [scale, setScale] = useState(1.0) // Zoom multiplier (1.0 = 100% actual size)
  const [containerWidth, setContainerWidth] = useState<number | undefined>(
    undefined
  )
  const [containerHeight, setContainerHeight] = useState<number | undefined>(
    undefined
  )
  const [pageAspectRatio, setPageAspectRatio] = useState(1.414) // Default A4

  const containerRef = useRef<HTMLDivElement>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)

  // Precise dimension measurement using ResizeObserver
  const onResize = useCallback((entries: ResizeObserverEntry[]) => {
    const [entry] = entries
    if (entry) {
      // Account for padding and scrollbar space
      setContainerWidth(entry.contentRect.width - 32)
      setContainerHeight(entry.contentRect.height - 32)
    }
  }, [])

  useEffect(() => {
    return () => {
      // Cleanup: disconnect ResizeObserver when component unmounts or doc changes
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect()
        resizeObserverRef.current = null
      }
    }
  }, [activeDocIndex])

  useEffect(() => {
    startTransition(() => {
      setActiveDocIndex(initialIndex)
      setActiveImageIndex(0)
      setPageNumber(1)
      setNumPages(null)
      setScale(1.0) // Reset zoom on new document
    })
  }, [initialIndex])

  const activeDoc = activeDocIndex !== null ? docs[activeDocIndex] : null
  const hasMultipleImages = activeDoc && activeDoc.images.length > 1

  function handleClose(open: boolean) {
    if (!open) {
      setActiveDocIndex(null)
      setActiveImageIndex(0)
      onClose?.()
    }
  }

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages)
  }

  function onPageLoadSuccess(page: any) {
    if (page.width && page.height) {
      const ratio = page.height / page.width
      setPageAspectRatio(ratio)
    }

    // Measure container dimensions when page is rendered
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      setContainerWidth(rect.width - 32)
      setContainerHeight(rect.height - 32)

      // Attach ResizeObserver if not already attached
      if (!resizeObserverRef.current) {
        resizeObserverRef.current = new ResizeObserver(onResize)
        resizeObserverRef.current.observe(containerRef.current)
        console.log("ResizeObserver attached in onPageLoadSuccess")
      }
    }
  }

  const fitToWidth = () => {
    // Scale to fit PDF width to container width
    if (containerWidth) {
      const newScale = containerWidth / REFERENCE_WIDTH
      setScale(Math.max(0.4, newScale))
    }
  }

  const fitToPage = () => {
    // Scale to fit entire page in container
    if (containerWidth && containerHeight) {
      const pageHeightAtReference = REFERENCE_WIDTH * pageAspectRatio
      const scaleForWidth = containerWidth / REFERENCE_WIDTH
      const scaleForHeight = containerHeight / pageHeightAtReference
      const newScale = Math.min(scaleForWidth, scaleForHeight) + 0.02
      setScale(Math.max(0.4, newScale))
    }
  }

  function changePage(offset: number) {
    setPageNumber((prevPageNumber) => {
      const next = prevPageNumber + offset
      if (next < 1) return numPages || 1
      if (numPages && next > numPages) return 1
      return next
    })
  }

  function goToPrevious() {
    if (!activeDoc) return
    setActiveImageIndex((current) =>
      current === 0 ? activeDoc.images.length - 1 : current - 1
    )
  }

  function goToNext() {
    if (!activeDoc) return
    setActiveImageIndex((current) =>
      current === activeDoc.images.length - 1 ? 0 : current + 1
    )
  }

  function handleSendEmailClick() {
    if (!activeDoc || !onSendEmail) return

    const availableContacts = activeDoc.contacts?.filter((c) => c.email) || []

    if (availableContacts.length > 0) {
      // Pre-select the first available email
      setSelectedEmail(availableContacts[0].email || "")
      setCcEmails(activeDoc.ccEmails || "")
      setBccEmails(activeDoc.bccEmails || "")
      setIsEmailDialogOpen(true)
    } else {
      // Fallback to original behavior if no contacts array is provided
      if (!activeDoc.customerEmail) {
        notify.error("Customer email not found.")
        return
      }
      setCcEmails(activeDoc.ccEmails || "")
      setBccEmails(activeDoc.bccEmails || "")
      if (confirm(`${labels.confirmEmail} ${activeDoc.customerEmail}?`)) {
        sendEmailDirectly(activeDoc.customerEmail)
      }
    }
  }

  async function sendEmailDirectly(emailToUse: string) {
    if (!activeDoc || !onSendEmail) return
    try {
      setIsSending(true)
      await onSendEmail({ ...activeDoc, customerEmail: emailToUse, ccEmails, bccEmails })
    } catch (error) {
      console.error("Failed to send email:", error)
    } finally {
      setIsSending(false)
      setIsEmailDialogOpen(false)
    }
  }

  function handleZoomIn() {
    setScale((s) => {
      const currentPct = Math.round(s * 100)
      let targetPct = Math.ceil(currentPct / 20) * 20
      if (targetPct - currentPct < 10) targetPct += 20
      return Math.min(4.0, targetPct / 100)
    })
  }

  function handleZoomOut() {
    setScale((s) => {
      const currentPct = Math.round(s * 100)
      let targetPct = Math.floor(currentPct / 20) * 20
      if (currentPct - targetPct < 10) targetPct -= 20
      return Math.max(0.4, targetPct / 100)
    })
  }

  function renderContent() {
    if (!activeDoc) return null

    if (activeDoc.pdf) {
      return (
        <div className="relative flex h-full w-full flex-col overflow-hidden bg-muted/30">
          {/* PDF Toolbar */}
          <div className="sticky top-0 z-30 flex w-full shrink-0 items-center justify-between border-b bg-muted px-2 py-2 text-xs font-medium md:px-4">
            <div className="flex items-center gap-2 text-[10px]">
              <span className="tracking-wider text-muted-foreground uppercase">
                Page
              </span>
              <span className="rounded bg-muted px-2 py-0.5 font-bold tabular-nums">
                {pageNumber} / {numPages || "..."}
              </span>
            </div>

            <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="size-7 rounded-md hover:bg-secondary/20"
                onClick={handleZoomOut}
              >
                <ZoomOut className="size-3.5" />
              </Button>
              <span className="w-12 text-center text-[10px] font-bold tabular-nums">
                {Math.round(scale * 100)}%
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 rounded-md hover:bg-secondary/20"
                onClick={handleZoomIn}
              >
                <ZoomIn className="size-3.5" />
              </Button>
              <div className="mx-0.5 h-3 w-px bg-border" />
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "size-7 rounded-md hover:bg-secondary/20",
                  scale === 1.0 && "bg-background text-primary shadow-sm"
                )}
                onClick={fitToWidth}
                title="Fit to Width"
              >
                <ArrowLeftRight className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 rounded-md hover:bg-secondary/20"
                onClick={fitToPage}
                title="Fit to Page"
              >
                <ArrowUpDown className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 rounded-md hover:bg-secondary/20"
                onClick={() => setScale(1.0)}
                title="Default Zoom (100%)"
              >
                <Maximize className="size-3.5" />
              </Button>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="size-7 hover:bg-secondary/20"
                onClick={() => changePage(-1)}
                disabled={!numPages || numPages <= 1}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="size-7 hover:bg-secondary/20"
                onClick={() => changePage(1)}
                disabled={!numPages || numPages <= 1}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>

          {/* PDF Canvas Area */}
          <div
            ref={containerRef}
            className="custom-scrollbar w-full flex-1 overflow-auto p-4"
          >
            <div className="mx-auto h-fit w-fit border bg-white shadow-lg">
              <Document
                file={activeDoc.pdf}
                options={PDF_OPTIONS}
                onLoadSuccess={onDocumentLoadSuccess}
                loading={
                  <div className="flex flex-col items-center justify-center gap-3 p-20">
                    <Loader2 className="size-8 animate-spin text-primary" />
                    <span className="animate-pulse text-xs font-medium text-muted-foreground">
                      Rendering...
                    </span>
                  </div>
                }
                error={
                  <div className="flex flex-col gap-2 p-10 text-center text-destructive">
                    <FileText className="mx-auto size-8 opacity-20" />
                    <p className="font-semibold">Failed to load PDF</p>
                  </div>
                }
              >
                <Page
                  pageNumber={pageNumber}
                  scale={scale}
                  width={REFERENCE_WIDTH}
                  onLoadSuccess={onPageLoadSuccess}
                  // High-DPI Fix: Force 2x resolution for sharpness on Retina/4K screens
                  devicePixelRatio={2}
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                  className="max-w-none shadow-sm"
                />
              </Document>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-black/5">
        <Image
          src={activeDoc.images[activeImageIndex]}
          alt={activeDoc.title}
          fill
          sizes="(min-width: 1024px) 70vw, 100vw"
          quality={90}
          className="object-contain p-2"
          priority
        />
      </div>
    )
  }

  return (
    <>
      <Dialog
        open={activeDocIndex !== null}
        onOpenChange={handleClose}
        modal={false}
      >
        {/* Fixed height to ensure footer never clips */}
        <DialogContent className="flex h-[88vh] max-w-[95vw] flex-col overflow-hidden border-none p-0 shadow-2xl sm:max-h-[88vh] sm:max-w-4xl">
          <DialogHeader className="shrink-0">
            <DialogTitle className="text-sm font-bold tracking-tight">
              <FileText className="mr-2 inline-block size-5" />
              {labels.previewDocument}
            </DialogTitle>
            {activeDoc && (
              <DialogDescription className="flex items-center gap-1.5">
                {activeDoc.title} <span className="">•</span>{" "}
                {activeDoc.description}
              </DialogDescription>
            )}
          </DialogHeader>

          {/* Main Content Area - flex-1 with min-h-0 ensures it shrinks to fit available space */}
          <div className="group relative min-h-0 w-full flex-1 overflow-hidden bg-neutral-50/10">
            {renderContent()}

            {hasMultipleImages && !activeDoc?.pdf && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-between px-4 opacity-0 transition-opacity group-hover:opacity-100">
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={goToPrevious}
                  className="pointer-events-auto h-10 w-10 rounded-full shadow-lg"
                >
                  <ChevronLeft size={24} />
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={goToNext}
                  className="pointer-events-auto h-10 w-10 rounded-full shadow-lg"
                >
                  <ChevronRight size={24} />
                </Button>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onDownload?.(activeDoc!)}
              className="gap-2"
            >
              <Download className="size-4" />
              {labels.download}
            </Button>
            <Button
              variant="default"
              onClick={handleSendEmailClick}
              disabled={isSending || !onSendEmail}
              className="gap-2 px-6"
            >
              {isSending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Mail className="size-4" />
              )}
              {labels.sendEmail}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email Selection Dialog */}
      <Dialog open={isEmailDialogOpen} onOpenChange={setIsEmailDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              <Mail className="mr-2 inline-block size-5" />
              Select Email Recipient
            </DialogTitle>
            <DialogDescription>
              Choose the contact person to receive this document.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 p-4">
            {activeDoc?.contacts
              ?.filter((c) => c.email)
              .map((contact, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-lg border p-2 transition-colors",
                    selectedEmail === contact.email
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50"
                  )}
                  onClick={() => setSelectedEmail(contact.email || "")}
                >
                  <div className="flex flex-1 flex-col">
                    <span className="flex items-center gap-4 text-sm font-semibold">
                      {contact.name}
                      {(contact as any).description && (
                        <span className="text-xs font-normal text-muted-foreground">
                          ({(contact as any).description})
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {contact.email}
                    </span>
                  </div>
                  <div
                    className={cn(
                      "flex size-4 items-center justify-center rounded-full border",
                      selectedEmail === contact.email
                        ? "border-primary"
                        : "border-muted-foreground"
                    )}
                  >
                    {selectedEmail === contact.email && (
                      <div className="size-2.5 rounded-full bg-primary" />
                    )}
                  </div>
                </div>
              ))}

            {/* CC Emails - small subtle editable textarea */}
            <div className="mt-1 flex flex-col gap-1">
              <label className="text-[10px] font-semibold tracking-wider text-muted-foreground/70 uppercase">
                CC Emails
              </label>
              <textarea
                value={ccEmails}
                onChange={(e) => setCcEmails(e.target.value)}
                placeholder="email1@example.com, email2@example.com"
                rows={2}
                className="w-full resize-none rounded-md border border-border/60 bg-muted/30 px-2.5 py-1.5 text-[11px] leading-snug text-muted-foreground outline-none transition-colors placeholder:text-muted-foreground/40 focus:border-primary/40 focus:bg-muted/50 focus:ring-1 focus:ring-primary/20"
              />
              <span className="text-[9px] text-muted-foreground/50">
                Comma-separated. These will be CC&apos;d on this email.
              </span>
            </div>
            {/* BCC Emails - small subtle editable textarea */}
            <div className="mt-1 flex flex-col gap-1">
              <label className="text-[10px] font-semibold tracking-wider text-muted-foreground/70 uppercase">
                BCC Emails
              </label>
              <textarea
                value={bccEmails}
                onChange={(e) => setBccEmails(e.target.value)}
                placeholder="email1@example.com, email2@example.com"
                rows={2}
                className="w-full resize-none rounded-md border border-border/60 bg-muted/30 px-2.5 py-1.5 text-[11px] leading-snug text-muted-foreground outline-none transition-colors placeholder:text-muted-foreground/40 focus:border-primary/40 focus:bg-muted/50 focus:ring-1 focus:ring-primary/20"
              />
              <span className="text-[9px] text-muted-foreground/50">
                Comma-separated. These will be BCC&apos;d on this email.
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEmailDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => sendEmailDirectly(selectedEmail)}
              disabled={!selectedEmail || isSending}
            >
              {isSending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Mail className="mr-2 size-4" />
              )}
              Send Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
