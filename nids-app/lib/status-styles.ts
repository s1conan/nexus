/**
 * Single source of truth for status badge colors across the app.
 *
 * Colors come from sRGB tokens defined in `app/globals.css` (`--status-*`), so
 * the border, text and fill render identically on every monitor instead of
 * drifting with per-page OKLCH/utility palettes. Every status word maps to one
 * of seven semantic roles; unknown/empty statuses fall back to `neutral`.
 */

export type StatusRole =
  | "neutral"
  | "pending"
  | "info"
  | "progress"
  | "success"
  | "danger"
  | "overdue"

export const STATUS_ROLE_CLASSES: Record<StatusRole, string> = {
  neutral:
    "bg-status-neutral-fill text-status-neutral border-status-neutral-border",
  pending:
    "bg-status-pending-fill text-status-pending border-status-pending-border",
  info: "bg-status-info-fill text-status-info border-status-info-border",
  progress:
    "bg-status-progress-fill text-status-progress border-status-progress-border",
  success:
    "bg-status-success-fill text-status-success border-status-success-border",
  danger:
    "bg-status-danger-fill text-status-danger border-status-danger-border",
  overdue:
    "bg-status-overdue-fill text-status-overdue border-status-overdue-border",
}

/**
 * Every status word used by the Transaction modules. Keyed in lowercase so the
 * lookup is case/whitespace tolerant.
 */
const STATUS_ROLES: Record<string, StatusRole> = {
  // not started
  default: "neutral",
  draft: "neutral",
  // waiting on someone
  pending: "pending",
  sent: "pending",
  // confirmed / billed
  approved: "info",
  accepted: "info",
  invoiced: "info",
  // partially through the workflow
  partial: "progress",
  shipped: "progress",
  // completed successfully
  processed: "success",
  fulfilled: "success",
  delivered: "success",
  paid: "success",
  verified: "success",
  // failed / void
  rejected: "danger",
  cancelled: "danger",
  canceled: "danger",
  // time-critical
  overdue: "overdue",
}

export function getStatusRole(status?: string | null): StatusRole {
  if (!status) return "neutral"
  return STATUS_ROLES[status.trim().toLowerCase()] ?? "neutral"
}

export function getStatusBadgeClass(status?: string | null): string {
  return STATUS_ROLE_CLASSES[getStatusRole(status)]
}
