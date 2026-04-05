"use client"

import { useId, useState } from "react"
import { useLanguage } from "@/lib/language"

type PasswordInputProps = {
  id?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  autoComplete?: string
}

export default function PasswordInput({
  id,
  value,
  onChange,
  placeholder,
  autoComplete,
}: PasswordInputProps) {
  const fallbackId = useId()
  const { t } = useLanguage()
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div className="password-input-wrap">
      <input
        id={id ?? fallbackId}
        type={showPassword ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
      />
      <button
        type="button"
        className="password-visibility-btn"
        onClick={() => setShowPassword((current) => !current)}
        aria-label={
          showPassword
            ? t("ซ่อนรหัสผ่าน", "Hide password")
            : t("ดูรหัสผ่าน", "Show password")
        }
      >
        {showPassword ? t("ซ่อน", "Hide") : t("ดู", "Show")}
      </button>
    </div>
  )
}
