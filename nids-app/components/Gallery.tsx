"use client";

import "./pdf-polyfills";
import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
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
    Expand,
    ArrowLeftRight,
    ArrowUpDown
} from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { pdfjs, Document, Page } from 'react-pdf';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

type Doc = {
    title: string;
    description: string;
    images: string[];
    pdf?: string;
    id?: string;
    customerEmail?: string;
};

type GalleryProps = {
    docs: Doc[];
    initialIndex: number | null;
    labels: {
        previewDocument: string;
        clickToPreview: string;
        previousPage: string;
        nextPage: string;
        pageLabel: string;
        closePreview: string;
        download: string;
        sendEmail: string;
        confirmEmail: string;
    };
    onDownload?: (doc: Doc) => void;
    onSendEmail?: (doc: Doc) => Promise<void>;
    onClose?: () => void;
};

export default function Gallery({ docs, initialIndex, labels, onDownload, onSendEmail, onClose }: GalleryProps) {
    // Reference width for PDF rendering at 100% zoom
    // A4 width: 8.27 inches × 96 DPI = 794px (matches desktop PDF viewers on Windows)
    const REFERENCE_WIDTH = 794;

    const [activeDocIndex, setActiveDocIndex] = useState<number | null>(initialIndex);
    const [activeImageIndex, setActiveImageIndex] = useState(0);
    const [isSending, setIsSending] = useState(false);

    // PDF State
    const [numPages, setNumPages] = useState<number | null>(null);
    const [pageNumber, setPageNumber] = useState(1);
    const [scale, setScale] = useState(1.0); // Zoom multiplier (1.0 = 100% actual size)
    const [containerWidth, setContainerWidth] = useState<number | undefined>(undefined);
    const [containerHeight, setContainerHeight] = useState<number | undefined>(undefined);
    const [pageAspectRatio, setPageAspectRatio] = useState(1.414); // Default A4

    const containerRef = useRef<HTMLDivElement>(null);
    const resizeObserverRef = useRef<ResizeObserver | null>(null);

    // Precise dimension measurement using ResizeObserver
    const onResize = useCallback((entries: ResizeObserverEntry[]) => {
        const [entry] = entries;
        if (entry) {
            // Account for padding and scrollbar space
            setContainerWidth(entry.contentRect.width - 32);
            setContainerHeight(entry.contentRect.height - 32);
        }
    }, []);

    useEffect(() => {
        return () => {
            // Cleanup: disconnect ResizeObserver when component unmounts or doc changes
            if (resizeObserverRef.current) {
                resizeObserverRef.current.disconnect();
                resizeObserverRef.current = null;
            }
        };
    }, [activeDocIndex]);

    useEffect(() => {
        setActiveDocIndex(initialIndex);
        setActiveImageIndex(0);
        setPageNumber(1);
        setNumPages(null);
        setScale(1.0); // Reset zoom on new document
    }, [initialIndex]);

    const activeDoc = activeDocIndex !== null ? docs[activeDocIndex] : null;
    const hasMultipleImages = activeDoc && activeDoc.images.length > 1;

    function handleClose(open: boolean) {
        if (!open) {
            setActiveDocIndex(null);
            setActiveImageIndex(0);
            onClose?.();
        }
    }

    function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
        setNumPages(numPages);
    }

    function onPageLoadSuccess(page: any) {
        if (page.width && page.height) {
            const ratio = page.height / page.width;
            setPageAspectRatio(ratio);
        }

        // Measure container dimensions when page is rendered
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            setContainerWidth(rect.width - 32);
            setContainerHeight(rect.height - 32);

            // Attach ResizeObserver if not already attached
            if (!resizeObserverRef.current) {
                resizeObserverRef.current = new ResizeObserver(onResize);
                resizeObserverRef.current.observe(containerRef.current);
                console.log("ResizeObserver attached in onPageLoadSuccess");
            }
        }
    }

    const fitToWidth = () => {
        // Scale to fit PDF width to container width
        if (containerWidth) {
            const newScale = containerWidth / REFERENCE_WIDTH;
            setScale(Math.max(0.4, newScale));
        }
    };

    const fitToPage = () => {
        // Scale to fit entire page in container
        if (containerWidth && containerHeight) {
            const pageHeightAtReference = REFERENCE_WIDTH * pageAspectRatio;
            const scaleForWidth = containerWidth / REFERENCE_WIDTH;
            const scaleForHeight = containerHeight / pageHeightAtReference;
            const newScale = Math.min(scaleForWidth, scaleForHeight) + 0.02;
            setScale(Math.max(0.4, newScale));
        }
    };

    function changePage(offset: number) {
        setPageNumber(prevPageNumber => {
            const next = prevPageNumber + offset;
            if (next < 1) return numPages || 1;
            if (numPages && next > numPages) return 1;
            return next;
        });
    }

    function goToPrevious() {
        if (!activeDoc) return;
        setActiveImageIndex((current) =>
            current === 0 ? activeDoc.images.length - 1 : current - 1
        );
    }

    function goToNext() {
        if (!activeDoc) return;
        setActiveImageIndex((current) =>
            current === activeDoc.images.length - 1 ? 0 : current + 1
        );
    }

    async function handleSendEmail() {
        if (!activeDoc || !onSendEmail) return;
        if (!activeDoc.customerEmail) {
            alert("Customer email not found.");
            return;
        }
        if (confirm(`${labels.confirmEmail} ${activeDoc.customerEmail}?`)) {
            setIsSending(true);
            try {
                await onSendEmail(activeDoc);
            } finally {
                setIsSending(false);
            }
        }
    }

    function handleZoomIn() {
        setScale(s => {
            const currentPct = Math.round(s * 100);
            let targetPct = Math.ceil(currentPct / 20) * 20;
            if (targetPct - currentPct < 10) targetPct += 20;
            return Math.min(4.0, targetPct / 100);
        });
    }

    function handleZoomOut() {
        setScale(s => {
            const currentPct = Math.round(s * 100);
            let targetPct = Math.floor(currentPct / 20) * 20;
            if (currentPct - targetPct < 10) targetPct -= 20;
            return Math.max(0.4, targetPct / 100);
        });
    }

    function renderContent() {
        if (!activeDoc) return null;

        if (activeDoc.pdf) {
            return (
                <div className="relative w-full h-full flex flex-col overflow-hidden bg-muted/30">
                    {/* PDF Toolbar */}
                    <div className="sticky top-0 z-30 w-full shrink-0 flex items-center justify-between bg-muted border-b px-2 md:px-4 py-2 text-xs font-medium">
                        <div className="flex items-center gap-2 text-[10px]">
                            <span className="text-muted-foreground uppercase tracking-wider">Page</span>
                            <span className="bg-muted px-2 py-0.5 rounded tabular-nums font-bold">
                                {pageNumber} / {numPages || '...'}
                            </span>
                        </div>

                        <div className="flex items-center gap-1 bg-muted/40 p-0.5 rounded-lg border">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 rounded-md hover:bg-secondary/20"
                                onClick={handleZoomOut}
                            >
                                <ZoomOut className="size-3.5" />
                            </Button>
                            <span className="w-12 text-center tabular-nums text-[10px] font-bold">{Math.round(scale * 100)}%</span>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 rounded-md hover:bg-secondary/20"
                                onClick={handleZoomIn}
                            >
                                <ZoomIn className="size-3.5" />
                            </Button>
                            <div className="w-px h-3 bg-border mx-0.5" />
                            <Button
                                variant="ghost"
                                size="icon"
                                className={cn("size-7 rounded-md hover:bg-secondary/20", scale === 1.0 && "bg-background text-primary shadow-sm")}
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
                        className="w-full flex-1 overflow-auto p-4 custom-scrollbar"
                    >
                        <div className="shadow-lg bg-white border h-fit w-fit mx-auto">
                            <Document
                                file={activeDoc.pdf}
                                onLoadSuccess={onDocumentLoadSuccess}
                                loading={
                                    <div className="flex flex-col items-center justify-center p-20 gap-3">
                                        <Loader2 className="size-8 animate-spin text-primary" />
                                        <span className="text-xs text-muted-foreground font-medium animate-pulse">Rendering...</span>
                                    </div>
                                }
                                error={
                                    <div className="p-10 text-destructive text-center flex flex-col gap-2">
                                        <FileText className="size-8 mx-auto opacity-20" />
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
            );
        }

        return (
            <div className="relative w-full h-full bg-black/5 flex items-center justify-center overflow-hidden">
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
        );
    }

    return (
        <Dialog open={activeDocIndex !== null} onOpenChange={handleClose} modal={false}>
            {/* Fixed height to ensure footer never clips */}
            <DialogContent className="sm:max-w-4xl max-w-[95vw] h-[88vh] sm:max-h-[88vh] flex flex-col p-0 overflow-hidden shadow-2xl border-none">
                <DialogHeader className="shrink-0">
                    <DialogTitle className="text-sm font-bold tracking-tight"><FileText className="size-5 mr-2 inline-block" />{labels.previewDocument}</DialogTitle>
                    {activeDoc && (
                        <DialogDescription className="flex items-center gap-1.5 ">
                            {activeDoc.title} <span className="">•</span> {activeDoc.description}
                        </DialogDescription>
                    )}
                </DialogHeader>

                {/* Main Content Area - flex-1 with min-h-0 ensures it shrinks to fit available space */}
                <div className="flex-1 min-h-0 w-full relative group bg-neutral-50/10 overflow-hidden">
                    {renderContent()}

                    {hasMultipleImages && !activeDoc?.pdf && (
                        <div className="absolute inset-0 flex items-center justify-between px-4 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                                variant="secondary"
                                size="icon"
                                onClick={goToPrevious}
                                className="pointer-events-auto rounded-full shadow-lg h-10 w-10"
                            >
                                <ChevronLeft size={24} />
                            </Button>
                            <Button
                                variant="secondary"
                                size="icon"
                                onClick={goToNext}
                                className="pointer-events-auto rounded-full shadow-lg h-10 w-10"
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
                        onClick={handleSendEmail}
                        disabled={isSending || !onSendEmail}
                        className="gap-2 px-6"
                    >
                        {isSending ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
                        {labels.sendEmail}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
