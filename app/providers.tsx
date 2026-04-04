'use client'

import { SessionProvider } from 'next-auth/react'
import SessionLifecycleGuard from '@/app/components/session-lifecycle-guard'
import LanguageSwitcher from '@/app/components/language-switcher'
import SupportFooter from '@/app/components/support-footer'
import { LanguageProvider } from '@/lib/language'

export default function Providers({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SessionProvider>
      <LanguageProvider>
        <SessionLifecycleGuard />
        <LanguageSwitcher />
        {children}
        <SupportFooter />
      </LanguageProvider>
    </SessionProvider>
  )
}
