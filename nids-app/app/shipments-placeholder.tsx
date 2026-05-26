"use client"

import { useDictionary } from "@/components/dictionary-provider"
import { Truck } from "lucide-react"

export default function ShipmentsPage() {
  const { dict } = useDictionary()
  
  return (
    <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4">
      <Truck className="size-16 opacity-20" />
      <h2 className="text-xl font-semibold">{dict.MENU_SHIPMENTS}</h2>
      <p className="max-w-xs text-center">{dict.NO_DATA}</p>
    </div>
  )
}
