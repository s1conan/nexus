"use client"

import * as React from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"

interface DeleteConfirmationDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  title: string
  description?: string | React.ReactNode
  dataName?: string
  confirmText?: string
  cancelText?: string
  variant?: "default" | "destructive"
}

export function DeleteConfirmationDialog({
  isOpen,
  onOpenChange,
  onConfirm,
  title,
  description,
  dataName,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "destructive",
}: DeleteConfirmationDialogProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent className={cn("p-0")}>
        <AlertDialogHeader>
          <AlertDialogTitle
            className={cn(
              "flex w-full items-center gap-2 rounded-t-xl bg-destructive/20 px-4 py-2 text-destructive"
            )}
          >
            {variant === "destructive" && (
              <AlertTriangle className="size-4 shrink-0" />
            )}
            {title}
          </AlertDialogTitle>
          <div className={cn("flex w-full flex-col gap-3 px-4 py-2")}>
            {description && (
              <div className="flex-1 text-sm text-muted-foreground">
                {description}
              </div>
            )}
            {dataName && (
              <div className="rounded-md border border-dashed border-muted-foreground/30 bg-muted/50 p-2 text-center text-base font-semibold break-all text-foreground">
                {dataName}
              </div>
            )}
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter className={cn("flex flex-col gap-8 border-t p-2")}>
          <AlertDialogCancel className={cn("min-w-[90px]")}>
            {cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              onConfirm()
              onOpenChange(false)
            }}
            variant="destructive"
            className={cn(
              "min-w-[90px] hover:bg-destructive/90 hover:text-destructive-foreground"
            )}
          >
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function SendConfirmationDialog({
  isOpen,
  onOpenChange,
  onConfirm,
  title,
  description,
  dataName,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "destructive",
}: DeleteConfirmationDialogProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            {variant === "destructive" && (
              <AlertTriangle className="size-4 shrink-0" />
            )}
            {title}
          </AlertDialogTitle>
          <div className="flex flex-col gap-4 py-2">
            {description && (
              <div className="text-sm text-muted-foreground">{description}</div>
            )}
            {dataName && (
              <div className="rounded-md border border-dashed border-muted-foreground/30 bg-muted/50 p-3 text-center text-base font-black tracking-tight break-all text-foreground">
                {dataName}
              </div>
            )}
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{cancelText}</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              onConfirm()
              onOpenChange(false)
            }}
            className={
              variant === "destructive"
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : ""
            }
          >
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
