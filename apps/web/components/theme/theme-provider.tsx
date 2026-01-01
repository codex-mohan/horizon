"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"

type Theme = "horizon" | "nebula" | "aurora"
type ThemeMode = "light" | "dark"

type ThemeContextType = {
  theme: Theme
  themeMode: ThemeMode
  setTheme: (theme: Theme) => void
  setThemeMode: (mode: ThemeMode) => void
  resolvedTheme: string
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("horizon")
  const [themeMode, setThemeMode] = useState<ThemeMode>("dark")
  const [mounted, setMounted] = useState(false)
  const [resolvedTheme, setResolvedTheme] = useState<string>("horizon-dark")

  // Initialize theme from localStorage on mount
  useEffect(() => {
    setMounted(true)
    const savedTheme = localStorage.getItem("horizon-theme") as Theme | null
    const savedMode = localStorage.getItem("horizon-theme-mode") as ThemeMode | null

    if (savedTheme) {
      setTheme(savedTheme)
    }
    if (savedMode) {
      setThemeMode(savedMode)
    }
  }, [])

  // Apply theme changes to document
  useEffect(() => {
    if (!mounted) return

    const fullTheme = `${theme}-${themeMode}`
    setResolvedTheme(fullTheme)

    const root = document.documentElement

    // Set data-theme attribute
    root.setAttribute("data-theme", theme)

    // Handle dark mode class
    if (themeMode === "dark") {
      root.classList.add("dark")
    } else {
      root.classList.remove("dark")
    }

    // Save to localStorage
    localStorage.setItem("horizon-theme", theme)
    localStorage.setItem("horizon-theme-mode", themeMode)
  }, [theme, themeMode, mounted])

  // Prevent flash of incorrect theme
  useEffect(() => {
    if (!mounted) {
      // On first render, apply default theme immediately
      const root = document.documentElement
      root.setAttribute("data-theme", theme)
      if (themeMode === "dark") {
        root.classList.add("dark")
      }
    }
  }, [mounted, theme, themeMode])

  return (
    <ThemeContext.Provider
      value={{
        theme,
        themeMode,
        setTheme,
        setThemeMode,
        resolvedTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }
  return context
}
