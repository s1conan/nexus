"use client"

import { useState, useEffect, useRef, startTransition } from "react"

// All persisted state is namespaced with `nids_` so the logout / session
// expiry cleanup in auth-provider clears filters along with the session.
function toStorageKey(key: string) {
  return `nids_persisted_${key}`
}

export function usePersistedState<T>(key: string, initialState: T) {
  // Use a ref to track if we've initialized from localStorage
  const isInitialized = useRef(false)

  const [state, setState] = useState<T>(initialState)

  // Load from localStorage on mount
  useEffect(() => {
    const storageKey = toStorageKey(key)
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
  }, [key])

  // Save to localStorage whenever state changes
  useEffect(() => {
    if (!isInitialized.current) return

    const storageKey = toStorageKey(key)
    if (state === undefined || state === null) {
      localStorage.removeItem(storageKey)
    } else {
      localStorage.setItem(storageKey, JSON.stringify(state))
    }
  }, [key, state])

  return [state, setState] as const
}
