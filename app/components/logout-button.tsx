"use client"

import { signOut } from "next-auth/react"
import { clearBrowserSessionMarker } from "@/lib/browser-session"
import { useLanguage } from "@/lib/language"

export default function LogoutButton({
  className = "btn btn-ghost",
  children = "ออกจากระบบ",
}: {
  className?: string
  children?: React.ReactNode
}) {
  const { t } = useLanguage()

  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        clearBrowserSessionMarker()
        signOut({ callbackUrl: "/login" })
      }}
    >
      {children === "ออกจากระบบ" ? t("ออกจากระบบ", "Log out") : children}
    </button>
  )
}
