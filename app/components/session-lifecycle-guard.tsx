"use client"

import { useEffect, useRef } from "react"
import { signOut, useSession } from "next-auth/react"
import { usePathname } from "next/navigation"
import {
  clearBrowserSessionMarker,
  hasBrowserSessionMarker,
} from "@/lib/browser-session"

const PUBLIC_PATHS = new Set([
  "/login",
  "/employee/login",
  "/employee/register",
  "/management/register",
  "/shop/register",
  "/sales/register",
  "/forgot-password",
  "/reset-password",
  "/subscription-expired",
])

export default function SessionLifecycleGuard() {
  const pathname = usePathname()
  const { status } = useSession()
  const signOutTriggeredRef = useRef(false)

  useEffect(() => {
    if (status !== "authenticated") {
      return
    }

    if (PUBLIC_PATHS.has(pathname) || hasBrowserSessionMarker()) {
      return
    }

    if (signOutTriggeredRef.current) {
      return
    }

    signOutTriggeredRef.current = true
    clearBrowserSessionMarker()
    signOut({ callbackUrl: "/login" })
  }, [pathname, status])

  return null
}
