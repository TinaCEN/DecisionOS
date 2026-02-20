import type { Metadata } from 'next'

import './globals.css'
import { AppShell } from '../components/layout/AppShell'
import { StoreHydration } from '../components/providers/StoreHydration'
import { ToasterProvider } from '../components/providers/ToasterProvider'

export const metadata: Metadata = {
  title: 'DecisionOS',
  description: 'DecisionOS frontend skeleton',
}

type RootLayoutProps = Readonly<{
  children: React.ReactNode
}>

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-slate-100 text-slate-900 antialiased">
        <StoreHydration />
        <ToasterProvider />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
