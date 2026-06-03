"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Download, Mail, Loader2, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "./ui/button";

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
    const [activeDocIndex, setActiveDocIndex] = useState<number | null>(initialIndex);
    const [activeImageIndex, setActiveImageIndex] = useState(0);
    const [isSending, setIsSending] = useState(false);

    useEffect(() => {
        setActiveDocIndex(initialIndex);
        setActiveImageIndex(0);
    }, [initialIndex]);

    const activeDoc = activeDocIndex !== null ? docs[activeDocIndex] : null;
    const hasMultiplePages = activeDoc && activeDoc.images.length > 1;

    function handleClose(open: boolean) {
        if (!open) {
            setActiveDocIndex(null);
            setActiveImageIndex(0);
            onClose?.();
        }
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

    function renderContent() {
        if (!activeDoc) return null;
        if (activeDoc.pdf) {
            return (
                <div className="relative w-full overflow-hidden bg-muted/20">
                  <iframe
                      src={activeDoc.pdf}
                      title={activeDoc.title}
                      className="w-full h-[70vh]"
                      style={{ border: "none" }}
                  ></iframe>
                </div>
            );
        }
        return (
            <div className="relative w-full h-[65vh] bg-black/5 flex items-center justify-center overflow-hidden rounded-md border border-border/50">
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
        <Dialog open={activeDocIndex !== null} onOpenChange={handleClose} modal={true}>
            <DialogContent className="sm:max-w-4xl max-h-[99vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader>
                    <div className="flex items-center gap-2">
                      <FileText className="size-4" />
                      <DialogTitle className="text-base">{labels.previewDocument}</DialogTitle>
                    </div>
                    {activeDoc && (
                      <DialogDescription className="text-xs opacity-90">
                        {activeDoc.title} - {activeDoc.description}
                      </DialogDescription>
                    )}
                </DialogHeader>

                <div className="flex-1 overflow-auto p-2 flex flex-col">
                    <div className="relative flex-1 group">
                        {renderContent()}

                        {hasMultiplePages && !activeDoc?.pdf && (
                            <div className="absolute inset-0 flex items-center justify-between px-4 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                    variant="secondary"
                                    size="icon"
                                    onClick={goToPrevious}
                                    className="pointer-events-auto rounded-full shadow-lg"
                                >
                                    <ChevronLeft size={20} />
                                </Button>
                                <Button
                                    variant="secondary"
                                    size="icon"
                                    onClick={goToNext}
                                    className="pointer-events-auto rounded-full shadow-lg"
                                >
                                    <ChevronRight size={20} />
                                </Button>
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter className="flex flex-row justify-end items-center gap-3 p-4 bg-muted/20 border-t shrink-0 m-0 rounded-none">
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => onDownload?.(activeDoc!)}
                        className="gap-2"
                    >
                        <Download className="size-4" />
                        {labels.download}
                    </Button>
                    <Button 
                        variant="default" 
                        size="sm" 
                        onClick={handleSendEmail}
                        disabled={isSending || !onSendEmail}
                        className="gap-2"
                    >
                        {isSending ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
                        {labels.sendEmail}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
