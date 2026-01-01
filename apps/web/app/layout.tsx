import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { ThemeProvider } from "@/components/theme/theme-provider"
import "highlight.js/styles/github-dark.css"
import "@workspace/ui/styles/globals.css"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Horizon - AI Chat Interface",
  description: "Experience the event horizon of AI conversations by Singularity.ai",
  generator: "v0.app",
  icons: {
    icon: [
      {
        url: "/horizon-icon.png",
        sizes: "any",
      },
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.png",
  },
}

// Script to apply theme before React hydrates
const themeScript = `
  (function() {
    try {
      var theme = localStorage.getItem('horizon-theme') || 'horizon';
      var mode = localStorage.getItem('horizon-theme-mode') || 'dark';
      document.documentElement.setAttribute('data-theme', theme);
      if (mode === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch (e) {}
  })();
`

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`font-sans antialiased`}>
        <ThemeProvider>
          {children}
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  )
}
