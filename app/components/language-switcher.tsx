"use client"

import { useLanguage } from "@/lib/language"

export default function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage()

  return (
    <div className="language-switcher" aria-label="Language switcher">
      <button
        type="button"
        className={`language-switch-btn ${language === "th" ? "active" : ""}`}
        onClick={() => setLanguage("th")}
      >
        TH
      </button>
      <button
        type="button"
        className={`language-switch-btn ${language === "en" ? "active" : ""}`}
        onClick={() => setLanguage("en")}
      >
        EN
      </button>
    </div>
  )
}
