"use client"

import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface ButtonLoaderProps {
  className?: string
}

/**
 * A tiny dual-ring loader specifically for use inside buttons.
 * Inherits the current text color.
 */
export function ButtonLoader({ className }: ButtonLoaderProps) {
  return (
    <div className={cn("relative size-4 mr-2 flex items-center justify-center", className)}>
      <div className="absolute inset-0 rounded-full border-2 border-current/30 border-t-current animate-[spin_0.75s_linear_infinite]" />
      <div className="absolute inset-1 rounded-full border-2 border-current/30 border-b-current animate-[spin_1.5s_linear_infinite_reverse]" />
    </div>
  )
}
