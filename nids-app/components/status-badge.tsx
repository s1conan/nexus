import * as React from "react"

import { cn } from "@/lib/utils"
import { getStatusBadgeClass } from "@/lib/status-styles"

/**
 * Consistent status pill for Transaction and Report tables. Colors resolve from
 * the shared sRGB status tokens (`lib/status-styles.ts`). The base shape can be
 * overridden via `className` (e.g. a fixed `w-20`) without touching the colors.
 */
export function StatusBadge({
  status,
  label,
  className,
  ...props
}: React.ComponentProps<"span"> & {
  status?: string | null
  label?: React.ReactNode
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-[10px] font-bold whitespace-nowrap uppercase",
        getStatusBadgeClass(status),
        className
      )}
      {...props}
    >
      {label ?? status}
    </span>
  )
}
