'use client'

import { SessionProvider } from 'next-auth/react'
import SessionLifecycleGuard from '@/app/components/session-lifecycle-guard'

export default function Providers({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SessionProvider>
      <SessionLifecycleGuard />
      {children}
    </SessionProvider>
  )
}
