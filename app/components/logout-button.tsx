"use client"

import { signOut } from "next-auth/react"
import { clearBrowserSessionMarker } from "@/lib/browser-session"

export default function LogoutButton({
  className = "btn btn-ghost",
  children = "ออกจากระบบ",
}: {
  className?: string
  children?: React.ReactNode
}) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        clearBrowserSessionMarker()
        signOut({ callbackUrl: "/login" })
      }}
    >
      {children}
    </button>
  )
}
