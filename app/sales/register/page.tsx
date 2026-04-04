"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function SalesRegisterPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/login")
  }, [router])

  return <div className="page">Redirecting...</div>
}
