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
  className,
}: SummaryCardProps) {
  const colorMap = {
    primary: "border-l-primary text-primary bg-primary/10",
    green: "border-l-green-500 text-green-700 bg-green-100",
    blue: "border-l-blue-500 text-blue-700 bg-blue-100",
    amber: "border-l-amber-500 text-amber-700 bg-amber-100",
    red: "border-l-red-500 text-red-700 bg-red-100",
    slate: "border-l-slate-400 text-slate-700 bg-slate-100",
  }

  const borderClass = colorMap[color].split(" ")[0]
  const iconColorClass = colorMap[color].split(" ")[1]
  const iconBgClass = colorMap[color].split(" ")[2]

  return (
    <Card
      className={cn(
        "flex items-center justify-between gap-1 border-l-4 bg-muted px-3 py-2 shadow-none md:flex-row md:gap-3 md:py-2",
        borderClass,
        className
      )}
    >
      <div
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full md:size-6",
          iconBgClass,
          iconColorClass
        )}
      >
        <Icon className="size-3 md:size-4" />
      </div>
      <p className="truncate text-[8px] font-bold tracking-wider uppercase md:text-[10px]">
        {label}
      </p>
      <p className="truncate text-center text-[10px] leading-tight font-black md:text-[12px]">
        {value}
      </p>
      {description && (
        <p className="truncate text-[9px] opacity-80">{description}</p>
      )}
    </Card>
  )
}
