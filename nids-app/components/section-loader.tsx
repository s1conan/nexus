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
    <div className={cn(
      "flex flex-col items-center justify-center p-8 w-full min-h-[200px] animate-in fade-in duration-300",
      className
    )}>
      <div className="flex flex-col items-center gap-4">
        {/* Animated Rings - Scaled down version of FullPageLoader */}
        <div className="relative size-12 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
          <div className="absolute inset-1.5 rounded-full border-2 border-secondary/20 border-b-secondary animate-[spin_1.5s_linear_infinite_reverse]" />
          <Loader2 className="size-4 text-primary animate-pulse" />
        </div>

        <div className="flex flex-col items-center gap-0.5 text-center">
          <span className="text-sm font-semibold text-foreground animate-pulse">
            {message || dict.LOADING}
          </span>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
            Fetching Data
          </p>
        </div>
      </div>
    </div>
  )
}
