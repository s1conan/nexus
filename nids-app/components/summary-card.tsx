"use client"

import { Card } from "@/components/ui/card"
import { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface SummaryCardProps {
  label: string
  value: string | number
  icon: LucideIcon
  description?: string
  color?: "primary" | "green" | "blue" | "amber" | "red" | "slate"
  className?: string
}

export function SummaryCard({
  label,
  value,
  icon: Icon,
  description,
  color = "primary",
  className
}: SummaryCardProps) {
  const colorMap = {
    primary: "border-l-primary text-primary bg-primary/10",
    green: "border-l-green-500 text-green-700 bg-green-100",
    blue: "border-l-blue-500 text-blue-700 bg-blue-100",
    amber: "border-l-amber-500 text-amber-700 bg-amber-100",
    red: "border-l-red-500 text-red-700 bg-red-100",
    slate: "border-l-slate-400 text-slate-700 bg-slate-100",
  }

  const borderClass = colorMap[color].split(' ')[0]
  const iconColorClass = colorMap[color].split(' ')[1]
  const iconBgClass = colorMap[color].split(' ')[2]

  return (
    <Card className={cn("py-2 md:py-2 px-3 gap-1 md:gap-3 flex md:flex-row items-center justify-between border-l-4 shadow-none bg-muted", borderClass, className)}>
      <div className={cn("size-5 md:size-6 rounded-full flex items-center justify-center shrink-0", iconBgClass, iconColorClass)}>
        <Icon className="size-3 md:size-4" />
      </div>
      <p className="text-[8px] md:text-[10px] uppercase font-bold tracking-wider truncate">{label}</p>
      <p className="text-[10px] md:text-[12px] text-center font-black truncate leading-tight">{value}</p>
      {description && <p className="text-[9px] truncate opacity-80">{description}</p>}
    </Card>
  )
}
