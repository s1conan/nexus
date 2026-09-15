"use client"

import React, { useState, useEffect, useRef, startTransition } from "react"
import { cn } from "@/lib/utils"

interface NumberInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "onChange"
> {
  value: number
  onChange?: (value: number) => void
  badge?: React.ReactNode
  badgePosition?: "left" | "right"
  leftBadge?: React.ReactNode
  rightBadge?: React.ReactNode
  badgeClassName?: string
  containerClassName?: string
}

// Inputs always use English (en-US) formatting: "." is the decimal separator
// and "," is the thousand separator. Static display (labels, tables) keeps
// using the Indonesian format via SITE_CONFIG.numberLocale elsewhere.
const FORMAT_LOCALE = "en-US"
const DECIMAL = "."
const GROUP = ","

export function NumberInput({
  value,
  onChange,
  badge,
  badgePosition = "right",
  leftBadge,
  rightBadge,
  badgeClassName,
  containerClassName,
  className,
  ...props
}: NumberInputProps) {
  const [displayValue, setDisplayValue] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  // Track cursor position
  const cursorRef = useRef<{ position: number | null; value: string }>({
    position: null,
    value: "",
  })

  // Whether zero should render as empty (initial state or after user clears the field)
  const zeroAsEmptyRef = useRef(true)

  // Backward compatibility for badge prop
  const effectiveLeftBadge =
    leftBadge || (badge && badgePosition === "left" ? badge : null)
  const effectiveRightBadge =
    rightBadge || (badge && badgePosition === "right" ? badge : null)

  // Helper to format based on the fixed input locale
  const formatValue = (num: number) => {
    if (num === 0 && zeroAsEmptyRef.current) return ""
    return new Intl.NumberFormat(FORMAT_LOCALE, {
      maximumFractionDigits: 20,
    }).format(num)
  }

  // Sync internal display when prop changes from outside
  useEffect(() => {
    if (value !== undefined && value !== null) {
      const formatted = formatValue(value)
      // Only update if the formatted value differs from current display
      if (formatted !== displayValue) {
        // Don't clobber in-progress typing: if the current display parses to
        // the same value (e.g. "15." while value is 15), keep the user's input
        // so the decimal separator they just typed isn't erased
        const currentRaw = displayValue.replaceAll(GROUP, "")
        const currentParsed = parseFloat(currentRaw)
        if (isNaN(currentParsed) || currentParsed !== value) {
          startTransition(() => { setDisplayValue(formatted) })
        }
      }
    }
  }, [value, displayValue])

  // Restore cursor position after update
  useEffect(() => {
    if (inputRef.current && cursorRef.current.position !== null) {
      const el = inputRef.current
      const pos = cursorRef.current.position
      const diff = displayValue.length - cursorRef.current.value.length
      const newPos = Math.max(0, pos + diff)
      el.setSelectionRange(newPos, newPos)
      cursorRef.current.position = null
    }
  }, [displayValue])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Track cursor position against the raw DOM value (pre-normalization) so
    // the cursor-diff calculation compares strings with the same comma
    // structure as the formatted display, otherwise the cursor drifts when
    // typing in the middle of a group-formatted number
    const selectionStart = e.target.selectionStart
    cursorRef.current = { position: selectionStart, value: e.target.value }

    let nextValue = e.target.value

    // Normalize commas. Grouping commas come from our own auto-formatting, so a
    // comma followed by 3+ digits is a thousand separator and must be stripped
    // (covers shifted positions too, e.g. "100,000" + typed "0" -> "100,0000").
    // A trailing comma, or one followed by only 1-2 digits, is a typed decimal
    // keystroke (e.g. "100," or "100,5") and is normalized to ".".
    const firstComma = nextValue.indexOf(",")
    const commaIsGrouping =
      firstComma !== -1 && /^\d{3,}/.test(nextValue.slice(firstComma + 1))
    nextValue = commaIsGrouping
      ? nextValue.replaceAll(GROUP, "")
      : nextValue.replaceAll(",", DECIMAL)

    if (nextValue === "") {
      onChange?.(0)
      zeroAsEmptyRef.current = true
      setDisplayValue("")
      return
    }
    zeroAsEmptyRef.current = false

    // Check if it's a valid number or a valid partial number (e.g. "1.", "1.0")
    // This regex allows digits, one decimal separator, and optional leading minus
    const partialRegex = /^-?\d*(\.\d*)?$/
    // Collapse redundant leading zeros ("05" -> "5", "00.5" -> "0.5"),
    // but keep "0." so decimal values starting with zero still work
    const cleanValue = nextValue.replace(/^(-?)0+(?=\d)/, "$10")

    if (partialRegex.test(cleanValue)) {
      const parsed = parseFloat(cleanValue)
      if (!isNaN(parsed)) {
        onChange?.(parsed)
      }

      // Apply live formatting for thousand separators if there's no decimal separator currently
      if (!cleanValue.includes(DECIMAL) && !isNaN(parsed)) {
        setDisplayValue(formatValue(parsed))
      } else {
        setDisplayValue(cleanValue)
      }
    }
  }

  const handleBlur = () => {
    // Re-format on blur to normalize user input
    setDisplayValue(formatValue(value))
  }

  return (
    <div
      className={cn(
        "flex h-9 w-full items-center overflow-hidden rounded-md border border-input bg-transparent shadow-sm transition-colors focus-within:ring-1 focus-within:ring-ring dark:bg-input/30",
        props.disabled && "cursor-not-allowed opacity-60",
        containerClassName
      )}
    >
      {effectiveLeftBadge && (
        <div
          className={cn(
            "pointer-events-none flex h-full shrink-0 items-center rounded-l-md border-r border-input bg-muted/60 px-3 text-xs font-bold whitespace-nowrap text-muted-foreground select-none",
            badgeClassName
          )}
        >
          {effectiveLeftBadge}
        </div>
      )}
      <input
        {...props}
        ref={inputRef}
        type="text"
        inputMode="decimal"
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        disabled={props.disabled}
        className={cn(
          "min-w-0 flex-1 bg-transparent px-3 py-1 text-right font-mono text-sm outline-none placeholder:text-muted-foreground/40 disabled:cursor-not-allowed",
          className
        )}
      />
      {effectiveRightBadge && (
        <div
          className={cn(
            "pointer-events-none flex h-full shrink-0 items-center rounded-r-md border-l border-input bg-muted/60 px-3 text-xs font-bold whitespace-nowrap text-muted-foreground select-none",
            badgeClassName
          )}
        >
          {effectiveRightBadge}
        </div>
      )}
    </div>
  )
}
