import { SITE_CONFIG } from "./site-content"

/**
 * Formats a number with thousand separators based on global config or provided locale
 */
export const formatNumber = (num: number | string | null | undefined, locale?: string) => {
  if (num === null || num === undefined || num === "") return "0"
  const val = typeof num === "string" ? parseFloat(num.replace(/,/g, '')) : num
  if (isNaN(val)) return "0"
  
  // Dynamic locale: if not provided, try to detect from context or fallback to config
  const activeLocale = locale || (SITE_CONFIG.numberLocale)
  return new Intl.NumberFormat(activeLocale).format(val)
}

/**
 * Internal helper to pad numbers
 */
const pad = (n: number) => n.toString().padStart(2, '0')

/**
 * Formats a date based on global config (dd/MM/yyyy)
 */
export const formatDate = (date: Date | string | number | null | undefined) => {
  if (!date) return "-"
  try {
    const d = new Date(date)
    if (isNaN(d.getTime())) return "-"
    
    // Manual format to match dd/MM/yyyy exactly as requested in config
    const day = pad(d.getDate())
    const month = pad(d.getMonth() + 1)
    const year = d.getFullYear()
    
    return `${day}/${month}/${year}`
  } catch (e) {
    return "-"
  }
}

/**
 * Formats time based on global config (HH:mm)
 */
export const formatTime = (date: Date | string | number | null | undefined) => {
  if (!date) return "-"
  try {
    const d = new Date(date)
    if (isNaN(d.getTime())) return "-"
    
    const hours = pad(d.getHours())
    const minutes = pad(d.getMinutes())
    
    return `${hours}:${minutes}`
  } catch (e) {
    return "-"
  }
}

/**
 * Formats both date and time based on global config
 */
export const formatDateTime = (date: Date | string | number | null | undefined) => {
  if (!date) return "-"
  const dateStr = formatDate(date)
  const timeStr = formatTime(date)
  if (dateStr === "-" || timeStr === "-") return "-"
  return `${dateStr} ${timeStr}`
}

/**
 * Formats currency using the global symbol and dynamic locale
 */
export const formatCurrency = (num: number | string | null | undefined, locale?: string) => {
  return `${SITE_CONFIG.currencySymbol} ${formatNumber(num, locale)}`
}
