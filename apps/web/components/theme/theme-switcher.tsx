"use client"

import { Palette, Moon, Sun, Check } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { useTheme } from "./theme-provider"
import { cn } from "@workspace/ui/lib/utils"

const themes = [
  {
    id: "horizon" as const,
    name: "Horizon",
    description: "Event horizon with deep black",
    gradient: "from-purple-600 via-blue-500 to-cyan-400",
  },
  {
    id: "nebula" as const,
    name: "Nebula",
    description: "Cosmic nebula colors",
    gradient: "from-pink-600 via-purple-500 to-orange-400",
  },
  {
    id: "aurora" as const,
    name: "Aurora",
    description: "Northern lights mystique",
    gradient: "from-green-500 via-teal-500 to-cyan-400",
  },
]

export function ThemeSwitcher() {
  const { theme, themeMode, setTheme, setThemeMode } = useTheme()
  const isDark = themeMode === "dark"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-lg"
          className="hover:bg-primary/20 transition-all duration-200 hover:scale-110 flex items-center justify-center"
        >
          <Palette className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="right"
        align="start"
        className="w-64 z-100 animate-scale-in glass-strong border-border/50"
      >
        <DropdownMenuLabel className="text-sm font-semibold flex items-center gap-2">
          <span>Theme Settings</span>
        </DropdownMenuLabel>

        {/* Dark/Light Mode Toggle */}
        <div className="flex items-center justify-between px-3 py-2 mx-1 mt-1 rounded-md bg-muted/50">
          <span className="text-sm text-muted-foreground">Appearance</span>
          <div className="flex items-center gap-1 p-1 rounded-lg bg-background/80">
            <Button
              variant={!isDark ? "default" : "ghost"}
              size="icon-sm"
              className={cn(
                "size-7 transition-all",
                !isDark && "bg-primary text-primary-foreground"
              )}
              onClick={() => setThemeMode("light")}
            >
              <Sun className="size-3.5" />
            </Button>
            <Button
              variant={isDark ? "default" : "ghost"}
              size="icon-sm"
              className={cn(
                "size-7 transition-all",
                isDark && "bg-primary text-primary-foreground"
              )}
              onClick={() => setThemeMode("dark")}
            >
              <Moon className="size-3.5" />
            </Button>
          </div>
        </div>

        <DropdownMenuSeparator className="my-2" />

        {/* Theme Selection */}
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground px-3">Color Theme</span>
          {themes.map((t) => (
            <DropdownMenuItem
              key={t.id}
              onClick={() => setTheme(t.id)}
              className={cn(
                "flex items-start gap-3 p-3 cursor-pointer transition-all duration-200",
                theme === t.id && "bg-primary/10",
              )}
            >
              <div className={cn("size-10 rounded-lg bg-linear-to-br shrink-0", t.gradient)} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{t.name}</span>
                  {theme === t.id && <Check className="size-4 text-primary" />}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-1">{t.description}</p>
              </div>
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
