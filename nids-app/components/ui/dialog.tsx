"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"

function Dialog({
  modal = false,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" modal={modal} {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  isLocal,
  ...props
}: React.ComponentProps<"div"> & { isLocal?: boolean }) {
  return (
    <div
      data-slot="dialog-overlay"
      className={cn(
        isLocal ? "absolute" : "fixed",
        "inset-0 isolate z-50 animate-in bg-black/20 backdrop-blur-[1.5px] duration-200 fade-in-0",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
}) {
  const [container, setContainer] = React.useState<HTMLElement | null>(null)
  const [isLocal, setIsLocal] = React.useState(false)

  // Find the nearest .page-container to portal into
  const markerRef = React.useCallback((node: HTMLDivElement | null) => {
    if (node) {
      const parent = node.closest(".page-container")
      if (parent instanceof HTMLElement) {
        setContainer(parent)
        setIsLocal(true)
      }
    }
  }, [])

  return (
    <>
      <div ref={markerRef} style={{ display: "none" }} />
      <DialogPortal container={container || undefined}>
        <DialogOverlay isLocal={isLocal} />
        <DialogPrimitive.Content
          data-slot="dialog-content"
          aria-describedby={undefined}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          onFocusOutside={(e) => e.preventDefault()}
          className={cn(
            isLocal ? "absolute" : "fixed",
            "top-[calc(50%-1px)] left-1/2 z-50 flex max-h-[85vh] w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl bg-popover text-sm text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none has-[[data-slot=dialog-description]]:max-h-[84vh] data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className
          )}
          {...props}
        >
          {children}
          {showCloseButton && (
            <DialogPrimitive.Close data-slot="dialog-close" asChild>
              <Button
                variant="close"
                className="absolute top-2.5 right-1.5 right-2 z-51 flex size-7 min-h-6 items-center justify-center rounded-full border-none bg-transparent p-0 text-primary-foreground shadow-none hover:bg-destructive/80"
              >
                <XIcon className="size-4" strokeWidth={3} />
                <span className="sr-only">Close</span>
              </Button>
            </DialogPrimitive.Close>
          )}
        </DialogPrimitive.Content>
      </DialogPortal>
    </>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn(
        "sticky top-0 z-50 flex shrink-0 flex-col gap-1 rounded-t-xl bg-primary px-5 py-3 text-base font-medium text-primary-foreground select-none",
        className
      )}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex shrink-0 flex-col gap-3 rounded-b-xl border-t bg-muted/5 px-5 py-4 *:flex-1 sm:flex-row",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">Close</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "font-heading flex flex-row items-center leading-none font-medium font-semibold",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  if (!props?.children) return null
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "pl-7.5 text-[10px] text-primary-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
