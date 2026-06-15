"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { Input } from "./ui/input";
import { useDictionary } from "./dictionary-provider";
import { cn } from "@/lib/utils"

interface NumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: number;
  onChange: (value: number) => void;
  badge?: React.ReactNode;
  badgePosition?: "left" | "right";
  leftBadge?: React.ReactNode;
  rightBadge?: React.ReactNode;
  badgeClassName?: string;
  containerClassName?: string;
}

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
  const { config } = useDictionary();
  const [displayValue, setDisplayValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Track cursor position
  const cursorRef = useRef<{ position: number | null; value: string }>({ position: null, value: "" });

  // Backward compatibility for badge prop
  const effectiveLeftBadge = leftBadge || (badge && badgePosition === "left" ? badge : null);
  const effectiveRightBadge = rightBadge || (badge && badgePosition === "right" ? badge : null);

  const locale = config.numberLocale || 'en-US';

  // Robust separator detection
  const separators = useMemo(() => {
    const parts = new Intl.NumberFormat(locale).formatToParts(1111.1);
    return {
      decimal: parts.find(p => p.type === 'decimal')?.value || '.',
      thousand: parts.find(p => p.type === 'group')?.value || ',',
    };
  }, [locale]);

  // Helper to format based on locale
  const formatValue = (num: number) => {
    if (num === 0 && displayValue === "") return "";
    return new Intl.NumberFormat(locale, {
      maximumFractionDigits: 20,
    }).format(num);
  };

  // Sync internal display when prop changes from outside
  useEffect(() => {
    if (value !== undefined && value !== null) {
      const formatted = formatValue(value);
      const currentParsed = parseFloat(displayValue.replaceAll(separators.thousand, "").replace(separators.decimal, "."));

      // Only update if the numeric value is actually different
      // This prevents stripping trailing zeros or decimal points while typing
      if (isNaN(currentParsed) || currentParsed !== value) {
        setDisplayValue(formatted);
      }
    } else {
      setDisplayValue("");
    }
  }, [value, locale, separators]);

  // Restore cursor position after update
  useEffect(() => {
    if (inputRef.current && cursorRef.current.position !== null) {
      const el = inputRef.current;
      const pos = cursorRef.current.position;

      // Adjust position if length changed (e.g. thousand separator added)
      const diff = displayValue.length - cursorRef.current.value.length;
      const newPos = Math.max(0, pos + diff);

      el.setSelectionRange(newPos, newPos);
      cursorRef.current.position = null;
    }
  }, [displayValue]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let nextValue = e.target.value;

    // Allow both . and , as decimal separators for better UX, but normalize to locale
    const otherDecimal = separators.decimal === "." ? "," : ".";
    if (nextValue.endsWith(otherDecimal)) {
      nextValue = nextValue.slice(0, -1) + separators.decimal;
    }

    // Track cursor position and current value before update
    const selectionStart = e.target.selectionStart;
    cursorRef.current = { position: selectionStart, value: nextValue };

    // Remove thousand separators for parsing
    const rawNumber = nextValue.replaceAll(separators.thousand, "").replace(separators.decimal, ".");

    if (nextValue === "") {
      onChange(0);
      setDisplayValue("");
      return;
    }

    // Check if it's a valid number or a valid partial number (e.g. "1.", "1.0")
    // This regex allows digits, one decimal separator, and optional leading minus
    const partialRegex = new RegExp(`^-?\\d*(\\${separators.decimal}\\d*)?$`);
    const cleanValue = nextValue.replaceAll(separators.thousand, "");

    if (partialRegex.test(cleanValue)) {
      const parsed = parseFloat(rawNumber);
      if (!isNaN(parsed)) {
        onChange(parsed);
      }

      // Apply live formatting for thousand separators if there's no decimal separator currently
      if (!cleanValue.includes(separators.decimal) && !isNaN(parsed)) {
        setDisplayValue(formatValue(parsed));
      } else {
        setDisplayValue(nextValue);
      }
    }
  };

  const handleBlur = () => {
    // Re-format on blur to normalize user input
    setDisplayValue(formatValue(value));
  };

  return (
    <div
      className={cn(
        "h-9 flex w-full items-center rounded-md border border-input bg-transparent shadow-sm transition-colors focus-within:ring-1 focus-within:ring-ring disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 overflow-hidden",
        containerClassName
      )}
    >
      {effectiveLeftBadge && (
        <div
          className={cn(
            "flex h-full shrink-0 font-bold items-center bg-muted/60 px-3 border-r border-input text-xs text-muted-foreground select-none pointer-events-none rounded-l-md whitespace-nowrap",
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
        className={cn(
          "flex-1 min-w-0 bg-transparent px-3 py-1 text-sm outline-none text-right font-mono placeholder:text-muted-foreground/40",
          className
        )}
      />
      {effectiveRightBadge && (
        <div
          className={cn(
            "flex h-full shrink-0 font-bold items-center bg-muted/60 px-3 border-l border-input text-xs text-muted-foreground select-none pointer-events-none rounded-r-md whitespace-nowrap",
            badgeClassName
          )}
        >
          {effectiveRightBadge}
        </div>
      )}
    </div>
  );
}
