"use client"

import { Loader2 } from "lucide-react"
import { useDictionary } from "@/components/dictionary-provider"
import { cn } from "@/lib/utils"

interface SectionLoaderProps {
  message?: string
  className?: string
}

/**
 * A smaller, non-full-screen loader designed for use inside cards, tables, or specific page sections.
 */
export function SectionLoader({ message, className }: SectionLoaderProps) {
  const { dict } = useDictionary()

  return (
    <div
      className={cn(
        "flex min-h-[200px] w-full animate-in flex-col items-center justify-center p-8 duration-300 fade-in",
        className
      )}
    >
      <div className="flex flex-col items-center gap-4">
        {/* Animated Rings - Scaled down version of FullPageLoader */}
        <div className="relative flex size-12 items-center justify-center">
          <div className="absolute inset-0 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
          <div className="absolute inset-1.5 animate-[spin_1.5s_linear_infinite_reverse] rounded-full border-2 border-secondary/20 border-b-secondary" />
          <Loader2 className="size-4 animate-pulse text-primary" />
        </div>

        <div className="flex flex-col items-center gap-0.5 text-center">
          <span className="animate-pulse text-sm font-semibold text-foreground">
            {message || dict.LOADING}
          </span>
          <p className="text-[10px] tracking-wider text-muted-foreground/60 uppercase">
            Fetching Data
          </p>
        </div>
      </div>
    </div>
  )
}
