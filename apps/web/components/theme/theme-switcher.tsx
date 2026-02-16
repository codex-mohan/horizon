"use client";

import { Button } from "@workspace/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { cn } from "@workspace/ui/lib/utils";
import { Check, Moon, Palette, Sun } from "lucide-react";
import { useTheme } from "./theme-provider";

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
];

export function ThemeSwitcher() {
  const { theme, themeMode, setTheme, setThemeMode } = useTheme();
  const isDark = themeMode === "dark";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className="flex items-center justify-center transition-all duration-200 hover:scale-110 hover:bg-primary/20"
          size="icon-lg"
          variant="ghost"
        >
          <Palette className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="glass-strong z-100 w-64 animate-scale-in border-border/50"
        side="right"
      >
        <DropdownMenuLabel className="flex items-center gap-2 font-semibold text-sm">
          <span>Theme Settings</span>
        </DropdownMenuLabel>

        {/* Dark/Light Mode Toggle */}
        <div className="mx-1 mt-1 flex items-center justify-between rounded-md bg-muted/50 px-3 py-2">
          <span className="text-muted-foreground text-sm">Appearance</span>
          <div className="flex items-center gap-1 rounded-lg bg-background/80 p-1">
            <Button
              className={cn(
                "size-7 transition-all",
                !isDark && "bg-primary text-primary-foreground"
              )}
              onClick={() => setThemeMode("light")}
              size="icon-sm"
              variant={isDark ? "ghost" : "default"}
            >
              <Sun className="size-3.5" />
            </Button>
            <Button
              className={cn(
                "size-7 transition-all",
                isDark && "bg-primary text-primary-foreground"
              )}
              onClick={() => setThemeMode("dark")}
              size="icon-sm"
              variant={isDark ? "default" : "ghost"}
            >
              <Moon className="size-3.5" />
            </Button>
          </div>
        </div>

        <DropdownMenuSeparator className="my-2" />

        {/* Theme Selection */}
        <div className="space-y-1">
          <span className="px-3 text-muted-foreground text-xs">Color Theme</span>
          {themes.map((t) => (
            <DropdownMenuItem
              className={cn(
                "flex cursor-pointer items-start gap-3 p-3 transition-all duration-200",
                theme === t.id && "bg-primary/10"
              )}
              key={t.id}
              onClick={() => setTheme(t.id)}
            >
              <div className={cn("size-10 shrink-0 rounded-lg bg-linear-to-br", t.gradient)} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{t.name}</span>
                  {theme === t.id && <Check className="size-4 text-primary" />}
                </div>
                <p className="line-clamp-1 text-muted-foreground text-xs">{t.description}</p>
              </div>
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
