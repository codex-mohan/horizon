import type React from "react";
import type { Metadata } from "next";
import { Space_Grotesk, Source_Sans_3, Source_Code_Pro, Playfair_Display } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { Toaster } from "sonner";
import "highlight.js/styles/github-dark.css";
import "@workspace/ui/styles/globals.css";

// Display font: Space Grotesk - Modern geometric sans-serif with personality
// Perfect for headings and brand elements, has a tech-forward but human feel
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

// Accent/Editorial font: Playfair Display - Elegant serif for special moments
// Used for quotes, timestamps, and distinctive UI moments
const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-accent",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

// Body font: Source Sans 3 - Highly readable, professional, warm
// Excellent for long-form text and chat messages
const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

// Mono font: Source Code Pro - Clean, readable code font
// Perfect for code blocks and technical content
const sourceCodePro = Source_Code_Pro({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Horizon - AI Chat Interface",
  description:
    "Experience the event horizon of AI conversations by Singularity.ai",
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
};

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
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body
        className={`${spaceGrotesk.variable} ${playfairDisplay.variable} ${sourceSans.variable} ${sourceCodePro.variable} font-body antialiased`}
      >
        <ThemeProvider>
          {children}
          <Toaster
            position="top-right"
            expand={false}
            richColors
            closeButton
            toastOptions={{
              classNames: {
                toast: "glass-strong",
              },
            }}
          />
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  );
}
