import type { Metadata } from "next"
import "./globals.css"
import Providers from "./providers"

export const metadata: Metadata = {
  title: "Cafe SaaS",
  description: "ระบบ attendance และ payroll สำหรับธุรกิจหลายสาขา",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="th">
      <body className="app-shell">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
