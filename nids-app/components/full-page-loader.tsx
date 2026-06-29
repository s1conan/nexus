"use client"

import { Loader2 } from "lucide-react"
import { useDictionary } from "@/components/dictionary-provider"

interface FullPageLoaderProps {
  message?: string
}

export function FullPageLoader({ message }: FullPageLoaderProps) {
  const { dict } = useDictionary()

  return (
    <div className="fixed inset-0 z-[100] flex animate-in flex-col items-center justify-center bg-background/80 backdrop-blur-sm duration-300 fade-in">
      <div className="relative flex animate-in flex-col items-center gap-6 rounded-2xl border bg-card p-8 shadow-2xl duration-500 zoom-in-95">
        {/* Animated Rings */}
        <div className="relative flex size-16 items-center justify-center">
          <div className="absolute inset-0 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
          <div className="absolute inset-2 animate-[spin_1.5s_linear_infinite_reverse] rounded-full border-4 border-secondary/20 border-b-secondary" />
          <Loader2 className="size-6 animate-pulse text-primary" />
        </div>

        <div className="flex flex-col items-center gap-1 text-center">
          <span className="animate-pulse text-lg font-bold text-foreground">
            {message || dict.LOADING}
          </span>
          <p className="text-sm text-muted-foreground">
            Nexus Integrated Distribution System
          </p>
        </div>
      </div>
    </div>
  )
}
