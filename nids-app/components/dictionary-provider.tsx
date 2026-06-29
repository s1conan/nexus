"use client"

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
  useMemo,
} from "react"
import { SITE_CONTENT, Language, SITE_CONFIG } from "@/lib/site-content"

type DictionaryContextType = {
  dict: typeof SITE_CONTENT.en
  lang: Language
  setLanguage: (lang: Language, persist?: boolean) => void
  config: typeof SITE_CONFIG
}

const DictionaryContext = createContext<DictionaryContextType | undefined>(
  undefined
)

export function DictionaryProvider({
  children,
  initialLang = "en",
}: {
  children: ReactNode
  initialLang?: Language
}) {
  const [lang, setLang] = useState<Language>(initialLang)

  // Load language from localStorage on mount (for persistent user preference)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedLang = localStorage.getItem("nids_pref_lang") as Language
      if (savedLang && (savedLang === "en" || savedLang === "id")) {
        setLang(savedLang)
      }
    }
  }, [])

  const setLanguage = useCallback((newLang: Language) => {
    setLang(newLang)
    if (typeof window !== "undefined") {
      localStorage.setItem("nids_pref_lang", newLang)
    }
  }, [])

  // Update HTML lang attribute
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang
    }
  }, [lang])

  const value = useMemo(
    () => ({
      dict: SITE_CONTENT[lang],
      lang,
      setLanguage,
      config: SITE_CONFIG,
    }),
    [lang, setLanguage]
  )

  return (
    <DictionaryContext.Provider value={value}>
      {children}
    </DictionaryContext.Provider>
  )
}

export function useDictionary() {
  const context = useContext(DictionaryContext)
  if (context === undefined) {
    throw new Error("useDictionary must be used within a DictionaryProvider")
  }
  return context
}
