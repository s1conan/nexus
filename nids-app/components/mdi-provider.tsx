"use client"

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
} from "react"

export interface TabMetadata {
  id: string
  title: string
  closable?: boolean
}

export interface Tab extends TabMetadata {
  content: React.ReactNode
}

interface MdiContextType {
  tabs: Tab[]
  activeTabId: string | null
  openTab: (
    id: string,
    title: string,
    content: React.ReactNode,
    closable?: boolean
  ) => void
  closeTab: (id: string) => void
  setActiveTabId: (id: string) => void
  isRestored: boolean
}

const MdiContext = createContext<MdiContextType | undefined>(undefined)

const STORAGE_KEY_TABS = "nids_mdi_tabs"
const STORAGE_KEY_ACTIVE = "nids_mdi_active_tab"

export function MdiProvider({ children }: { children: React.ReactNode }) {
  const [tabs, setTabs] = useState<Tab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [isRestored, setIsRestored] = useState(false)

  // Load from localStorage on mount
  useEffect(() => {
    const savedTabs = localStorage.getItem(STORAGE_KEY_TABS)
    const savedActiveTab = localStorage.getItem(STORAGE_KEY_ACTIVE)

    if (savedTabs) {
      try {
        const metadata: TabMetadata[] = JSON.parse(savedTabs)
        // We initially load tabs without content.
        // The MdiLayout will be responsible for providing the content mapping.
        setTabs(metadata.map((m) => ({ ...m, content: null })))
      } catch (e) {
        console.error("Failed to restore MDI tabs", e)
      }
    }

    if (savedActiveTab) {
      setActiveTabId(savedActiveTab)
    }

    setIsRestored(true)
  }, [])

  // Save to localStorage when tabs change
  useEffect(() => {
    if (!isRestored) return

    const metadata: TabMetadata[] = tabs.map(({ id, title, closable }) => ({
      id,
      title,
      closable,
    }))
    localStorage.setItem(STORAGE_KEY_TABS, JSON.stringify(metadata))
  }, [tabs, isRestored])

  // Save active tab ID
  useEffect(() => {
    if (!isRestored) return
    if (activeTabId) {
      localStorage.setItem(STORAGE_KEY_ACTIVE, activeTabId)
    } else {
      localStorage.removeItem(STORAGE_KEY_ACTIVE)
    }
  }, [activeTabId, isRestored])

  const openTab = useCallback(
    (id: string, title: string, content: React.ReactNode, closable = true) => {
      setTabs((prevTabs) => {
        const existingTabIndex = prevTabs.findIndex((tab) => tab.id === id)

        if (existingTabIndex !== -1) {
          // Update content if it was null (from restoration)
          if (prevTabs[existingTabIndex].content === null) {
            const newTabs = [...prevTabs]
            newTabs[existingTabIndex] = {
              ...newTabs[existingTabIndex],
              content,
            }
            setActiveTabId(id)
            return newTabs
          }
          setActiveTabId(id)
          return prevTabs
        }

        const newTabs = [...prevTabs, { id, title, content, closable }]
        setActiveTabId(id)
        return newTabs
      })
    },
    []
  )

  const closeTab = useCallback(
    (id: string) => {
      setTabs((prevTabs) => {
        const tabIndex = prevTabs.findIndex((tab) => tab.id === id)
        if (tabIndex === -1) return prevTabs

        const newTabs = prevTabs.filter((tab) => tab.id !== id)

        if (activeTabId === id) {
          if (newTabs.length > 0) {
            const nextIndex = Math.max(0, tabIndex - 1)
            setActiveTabId(newTabs[nextIndex].id)
          } else {
            setActiveTabId(null)
          }
        }

        return newTabs
      })
    },
    [activeTabId]
  )

  const value = useMemo(
    () => ({
      tabs,
      activeTabId,
      openTab,
      closeTab,
      setActiveTabId,
      isRestored,
    }),
    [tabs, activeTabId, openTab, closeTab, isRestored]
  )

  return <MdiContext.Provider value={value}>{children}</MdiContext.Provider>
}

export function useMdi() {
  const context = useContext(MdiContext)
  if (context === undefined) {
    throw new Error("useMdi must be used within an MdiProvider")
  }
  return context
}
