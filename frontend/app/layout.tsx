import type { Metadata } from 'next'

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
      <body className="min-h-screen bg-neutral-50 text-neutral-900">
        <StoreHydration />
        <ToasterProvider />
        {children}
      </body>
    </html>
  )
}
