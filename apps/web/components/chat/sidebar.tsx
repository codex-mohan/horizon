"use client"

import { MessageSquare, FolderOpen, Layers, Bot, HelpCircle } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@workspace/ui/components/tooltip"
import { Button } from "@workspace/ui/components/button"
import { Separator } from "@workspace/ui/components/separator"
import { cn } from "@workspace/ui/lib/utils"
import { ExpandedSidebar } from "./expanded-sidebar"
import { ThemeSwitcher } from "@/components/theme/theme-switcher"
import { useAuthStore } from "@/lib/stores/auth"

interface SidebarProps {
  isExpanded: boolean
  activeSection: "conversations" | "my-items" | "collections" | "assistants" | null
  onSectionChange: (section: "conversations" | "my-items" | "collections" | "assistants") => void
  onCollapse: () => void
}

export function Sidebar({ isExpanded, activeSection, onSectionChange, onCollapse }: SidebarProps) {
  const { user } = useAuthStore()
  const topSections = [
    { id: "conversations", icon: MessageSquare, label: "Conversations" },
    { id: "my-items", icon: FolderOpen, label: "My Items" },
    { id: "collections", icon: Layers, label: "Collections" },
    { id: "assistants", icon: Bot, label: "Assistants" },
  ] as const

  return (
    <>
      <div className="relative z-10 flex">
        {/* Main Sidebar */}
        <div className="w-16 h-screen glass-strong flex flex-col items-center py-4 gap-2">
          {/* Logo Section */}
          <div className="flex items-center justify-center p-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    className="size-12 transition-all duration-200 hover:scale-110 hover:bg-primary/40 flex items-center justify-center p-2"
                  >
                    <img src="/horizon-icon.png" alt="Horizon Logo" className="size-full max-w-[48px] max-h-[48px] object-contain" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" className="animate-scale-in">
                  <p>Horizon</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Separator */}
          <Separator className="w-8 h-0.5 mb-1" />

          <div className="flex-1 flex flex-col items-center gap-2">
            <TooltipProvider>
              {topSections.map((section, index) => (
                <Tooltip key={section.id}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-lg"
                      className={cn(
                        "transition-all duration-200 hover:scale-110 hover:bg-primary/40 flex items-center justify-center",
                        activeSection === section.id && "bg-primary/30 text-primary-foreground scale-105 hover-glow",
                        "stagger-item",
                      )}
                      style={{ animationDelay: `${index * 0.05}s` }}
                      onClick={() => onSectionChange(section.id)}
                    >
                      <section.icon className="size-5 transition-transform duration-200" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="animate-scale-in">
                    <p>{section.label}</p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </TooltipProvider>
          </div>

          <div className="flex flex-col items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-lg"
                    className="hover:bg-primary/40 transition-all duration-200 hover:scale-110 flex items-center justify-center"
                  >
                    <HelpCircle className="size-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" className="animate-scale-in">
                  <p>Help</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <ThemeSwitcher />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right" className="animate-scale-in">
                  <p>Theme</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-10 p-0 transition-all duration-200 hover:scale-110 hover-glow flex items-center justify-center"
                  >
                    <Avatar className="size-10 transition-transform duration-200">
                      <AvatarImage src={user?.avatarUrl || "/horizon-icon.png"} />
                      <AvatarFallback className="bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] text-[var(--foreground)]">
                        {user?.displayName ? user.displayName.substring(0, 2).toUpperCase() : "U"}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" className="animate-scale-in">
                  <p>Profile</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Expanded Sidebar */}
        {isExpanded && activeSection && (
          <div className="animate-slide-in-right">
            <ExpandedSidebar section={activeSection} onClose={onCollapse} />
          </div>
        )}
      </div>
    </>
  )
}
