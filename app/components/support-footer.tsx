'use client'

import { useLanguage } from '@/lib/language'

const SUPPORT_LINE_URL = 'https://lin.ee/Ouy2wb6'

export default function SupportFooter() {
  const { t } = useLanguage()

  return (
    <footer className="support-footer">
      <a href={SUPPORT_LINE_URL} target="_blank" rel="noreferrer" className="support-link">
        {t('ติดต่อทีมซัพพอร์ต', 'Contact support team')}
      </a>
    </footer>
  )
}
