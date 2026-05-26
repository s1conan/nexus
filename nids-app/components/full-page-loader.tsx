"use client"

import { Loader2 } from "lucide-react"
import { useDictionary } from "@/components/dictionary-provider"

interface FullPageLoaderProps {
  message?: string
}

export function FullPageLoader({ message }: FullPageLoaderProps) {
  const { dict } = useDictionary()

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="relative flex flex-col items-center gap-6 p-8 rounded-2xl bg-card shadow-2xl border animate-in zoom-in-95 duration-500">
        {/* Animated Rings */}
        <div className="relative size-16 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <div className="absolute inset-2 rounded-full border-4 border-secondary/20 border-b-secondary animate-[spin_1.5s_linear_infinite_reverse]" />
          <Loader2 className="size-6 text-primary animate-pulse" />
        </div>

        <div className="flex flex-col items-center gap-1 text-center">
          <span className="text-lg font-bold text-foreground animate-pulse">
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
