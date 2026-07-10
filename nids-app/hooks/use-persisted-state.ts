"use client"

import { useState, useEffect, useRef, startTransition } from "react"

export function usePersistedState<T>(key: string, initialState: T) {
  // Use a ref to track if we've initialized from localStorage
  const isInitialized = useRef(false)

  const [state, setState] = useState<T>(initialState)

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(key)
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

    if (state === undefined || state === null) {
      localStorage.removeItem(key)
    } else {
      localStorage.setItem(key, JSON.stringify(state))
    }
  }, [key, state])

  return [state, setState] as const
}
