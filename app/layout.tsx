import React from "react"
import type { Metadata, Viewport } from "next"
import { ClerkProvider } from "@clerk/nextjs"

export const dynamic = "force-dynamic"
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google"

import { Providers } from "@/components/providers"
import "./globals.css"

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  weight: ["400", "500", "600", "700"],
})
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
})

export const metadata: Metadata = {
  title: 'NXT STOCK PULSE - Live Stock Take Management',
  description: 'Real-time stock take management powered by NXT STOCK PULSE',
  icons: { icon: '/icon.svg' },
}

export const viewport: Viewport = {
  themeColor: '#0a0a0a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${plusJakarta.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
        <body className="font-sans antialiased min-h-screen">
          <Providers>{children}</Providers>
        </body>
      </html>
    </ClerkProvider>
  )
}
