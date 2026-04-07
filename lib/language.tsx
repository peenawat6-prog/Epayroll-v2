"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

export type AppLanguage = "th" | "en"

const LANGUAGE_STORAGE_KEY = "epayroll-language"

type LanguageContextValue = {
  language: AppLanguage
  setLanguage: (nextLanguage: AppLanguage) => void
  t: (thaiText: string, englishText: string) => string
}

const LanguageContext = createContext<LanguageContextValue>({
  language: "th",
  setLanguage: () => undefined,
  t: (thaiText) => thaiText,
})

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>(() => {
    if (typeof window !== "undefined") {
      const savedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)

      if (savedLanguage === "th" || savedLanguage === "en") {
        return savedLanguage
      }
    }

    return "th"
  })

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  const setLanguage = useCallback((nextLanguage: AppLanguage) => {
    setLanguageState(nextLanguage)
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage)
    document.documentElement.lang = nextLanguage
  }, [])

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t: (thaiText: string, englishText: string) =>
        language === "th" ? thaiText : englishText,
    }),
    [language, setLanguage],
  )

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}
