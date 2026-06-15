"use client"

import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface ButtonLoaderProps {
  className?: string
}

/**
 * A tiny loader specifically for use inside buttons.
 * Inherits the current text color.
 */
export function ButtonLoader({ className }: ButtonLoaderProps) {
  return (
    <Loader2 className={cn("size-4 animate-spin", className)} />
  )
}
