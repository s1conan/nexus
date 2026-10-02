"use client"

import { useState, useEffect, useRef, startTransition } from "react"

export type PersistedStateScope = "session" | "preference"

export interface PersistedStateOptions {
  /**
   * "session" (default) → `nids_persisted_<key>` — cleared on logout/session expiry.
   * "preference"       → `nids_pref_<key>`       — survives logout (user preference),
   *                       whitelisted by the `nids_pref_` check in auth-provider.
   */
  scope?: PersistedStateScope
  /** When false, localStorage is never read or written. Defaults to true. */
  enabled?: boolean
}

// Session state is namespaced `nids_persisted_` so the logout / session expiry
// cleanup in auth-provider clears filters along with the session. Preferences use
// `nids_pref_` so they deliberately survive logout (e.g. language, sort order).
function toStorageKey(key: string, scope: PersistedStateScope) {
  return scope === "preference" ? `nids_pref_${key}` : `nids_persisted_${key}`
}

export function usePersistedState<T>(
  key: string,
  initialState: T,
  options: PersistedStateOptions = {}
) {
  const { scope = "session", enabled = true } = options

  // Use a ref to track if we've initialized from localStorage
  const isInitialized = useRef(false)
  // Tracks whether the persisted value has been read back, so consumers can
  // wait for hydration before firing data fetches (avoids a double fetch).
  const [isHydrated, setIsHydrated] = useState(!enabled)

  const [state, setState] = useState<T>(initialState)

  // Load from localStorage on mount
  useEffect(() => {
    if (!enabled) return

    const storageKey = toStorageKey(key, scope)
    // Migrate: drop any legacy unprefixed key from previous versions
    localStorage.removeItem(key)
    const saved = localStorage.getItem(storageKey)
    if (saved !== null) {
      try {
        startTransition(() => {
          setState(JSON.parse(saved))
        })
      } catch (e) {
        console.error(`Failed to parse persisted state for key "${key}"`, e)
      }
    }
    isInitialized.current = true
    startTransition(() => setIsHydrated(true))
  }, [key, scope, enabled])

  // Save to localStorage whenever state changes
  useEffect(() => {
    if (!enabled || !isInitialized.current) return

    const storageKey = toStorageKey(key, scope)
    if (state === undefined || state === null) {
      localStorage.removeItem(storageKey)
    } else {
      localStorage.setItem(storageKey, JSON.stringify(state))
    }
  }, [key, scope, enabled, state])

  return [state, setState, isHydrated] as const
}
