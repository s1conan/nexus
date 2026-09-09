"use client"

import { useEffect, useRef } from "react"
import { SITE_CONFIG } from "@/lib/site-content"

const LAST_ACTIVE_KEY = "nids_last_active"

const ACTIVITY_EVENTS = [
  "pointerdown",
  "pointermove",
  "keydown",
  "wheel",
  "touchstart",
  "scroll",
] as const

const ACTIVITY_WRITE_THROTTLE_MS = 30_000
const EXPIRY_CHECK_INTERVAL_MS = 30_000

/**
 * Auto-logout on session inactivity.
 *
 * Fires `onExpire()` when the session is considered expired. Expiry is based
 * on the last recorded user activity, persisted to localStorage so the
 * elapsed wall-clock time survives sleep/hibernate and browser restarts:
 *
 * - Idle in the app too long → periodic check fires
 * - Computer slept / hibernated → wall-clock gap caught on wake
 *   (visibilitychange or next interval tick)
 * - Browser closed → timestamp persists; if the app is reopened after the
 *   timeout, it expires immediately on mount
 *
 * Activity is shared via localStorage, so movement in one tab keeps all
 * tabs alive, and all tabs expire together.
 */
export function useSessionExpiry(enabled: boolean, onExpire: () => void) {
  const onExpireRef = useRef(onExpire)

  useEffect(() => {
    onExpireRef.current = onExpire
  }, [onExpire])

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return

    const timeoutMs = SITE_CONFIG.sessionTimeoutMinutes * 60 * 1000

    if (localStorage.getItem(LAST_ACTIVE_KEY) === null) {
      localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()))
    }

    const isExpired = () => {
      const last = Number(localStorage.getItem(LAST_ACTIVE_KEY))
      if (!last || Number.isNaN(last)) return false
      return Date.now() - last > timeoutMs
    }

    let expired = false
    let lastWrite = 0

    const recordActivity = () => {
      const now = Date.now()
      if (now - lastWrite > ACTIVITY_WRITE_THROTTLE_MS) {
        lastWrite = now
        localStorage.setItem(LAST_ACTIVE_KEY, String(now))
      }
    }

    const checkExpiry = () => {
      if (expired || !isExpired()) return
      expired = true
      cleanup()
      localStorage.removeItem(LAST_ACTIVE_KEY)
      onExpireRef.current()
    }

    const onVisibilityChange = () => {
      // Catch wake-up from sleep/hibernate and returning to the tab
      if (document.visibilityState === "visible") checkExpiry()
    }

    const cleanup = () => {
      clearInterval(intervalId)
      document.removeEventListener("visibilitychange", onVisibilityChange)
      ACTIVITY_EVENTS.forEach((event) =>
        window.removeEventListener(event, recordActivity)
      )
    }

    const intervalId = setInterval(checkExpiry, EXPIRY_CHECK_INTERVAL_MS)
    document.addEventListener("visibilitychange", onVisibilityChange)
    ACTIVITY_EVENTS.forEach((event) =>
      window.addEventListener(event, recordActivity, { passive: true })
    )

    // Immediate check on mount: covers reopening the browser after it was
    // closed longer than the timeout.
    checkExpiry()

    return cleanup
  }, [enabled])
}
