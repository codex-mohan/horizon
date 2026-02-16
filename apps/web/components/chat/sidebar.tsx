"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { Separator } from "@workspace/ui/components/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip";
import { cn } from "@workspace/ui/lib/utils";
import {
  Bot,
  FolderOpen,
  HelpCircle,
  Image,
  Layers,
  LogOut,
  MessageSquare,
  Settings,
} from "lucide-react";
import { useState } from "react";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";
import { useAuthStore } from "@/lib/stores/auth";
import { ChangeAvatarDialog } from "./change-avatar-dialog";
import { ExpandedSidebar } from "./expanded-sidebar";
import { UserSettingsDialog } from "./user-settings-dialog";

interface SidebarProps {
  isExpanded: boolean;
  activeSection: "conversations" | "my-items" | "collections" | "assistants" | null;
  onSectionChange: (section: "conversations" | "my-items" | "collections" | "assistants") => void;
  onCollapse: () => void;
}

export function Sidebar({ isExpanded, activeSection, onSectionChange, onCollapse }: SidebarProps) {
  const { user, logout } = useAuthStore();
  const [isUserSettingsOpen, setIsUserSettingsOpen] = useState(false);
  const [isChangeAvatarOpen, setIsChangeAvatarOpen] = useState(false);
  const topSections = [
    { id: "conversations", icon: MessageSquare, label: "Conversations" },
    { id: "my-items", icon: FolderOpen, label: "My Items" },
    { id: "collections", icon: Layers, label: "Collections" },
    { id: "assistants", icon: Bot, label: "Assistants" },
  ] as const;

  return (
    <>
      <div className="relative z-10 flex">
        {/* Main Sidebar */}
        <div className="glass-strong flex h-screen w-16 flex-col items-center gap-2 py-4">
          {/* Logo Section */}
          <div className="flex items-center justify-center p-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    className="flex size-12 items-center justify-center p-2 transition-all duration-200 hover:scale-110 hover:bg-primary/40"
                    variant="ghost"
                  >
                    <img
                      alt="Horizon Logo"
                      className="size-full max-h-[48px] max-w-[48px] object-contain"
                      src="/horizon-icon.png"
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="animate-scale-in" side="right">
                  <p>Horizon</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Separator */}
          <Separator className="mb-1 h-0.5 w-8" />

          <div className="flex flex-1 flex-col items-center gap-2">
            <TooltipProvider>
              {topSections.map((section, index) => (
                <Tooltip key={section.id}>
                  <TooltipTrigger asChild>
                    <Button
                      className={cn(
                        "flex items-center justify-center transition-all duration-200 hover:scale-110 hover:bg-primary/40",
                        activeSection === section.id &&
                          "hover-glow scale-105 bg-primary/30 text-primary-foreground",
                        "stagger-item"
                      )}
                      onClick={() => onSectionChange(section.id)}
                      size="icon-lg"
                      style={{ animationDelay: `${index * 0.05}s` }}
                      variant="ghost"
                    >
                      <section.icon className="size-5 transition-transform duration-200" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="animate-scale-in" side="right">
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
                    className="flex items-center justify-center transition-all duration-200 hover:scale-110 hover:bg-primary/40"
                    size="icon-lg"
                    variant="ghost"
                  >
                    <HelpCircle className="size-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="animate-scale-in" side="right">
                  <p>Help</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <ThemeSwitcher />
                  </div>
                </TooltipTrigger>
                <TooltipContent className="animate-scale-in" side="right">
                  <p>Theme</p>
                </TooltipContent>
              </Tooltip>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    className="hover-glow flex size-10 items-center justify-center rounded-full p-0 transition-all duration-200 hover:scale-110"
                    size="icon"
                    variant="ghost"
                  >
                    <Avatar className="size-10 transition-transform duration-200">
                      <AvatarImage src={user?.avatarUrl || "/horizon-icon.png"} />
                      <AvatarFallback className="bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] text-[var(--foreground)]">
                        {user?.displayName ? user.displayName.substring(0, 2).toUpperCase() : "U"}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56" side="right" sideOffset={10}>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="font-medium text-sm leading-none">
                        {user?.displayName || "User"}
                      </p>
                      <p className="text-muted-foreground text-xs leading-none">
                        @{user?.username || "username"}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setIsChangeAvatarOpen(true)}>
                    <Image className="mr-2 size-4" />
                    <span>Change Profile Picture</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setIsUserSettingsOpen(true)}>
                    <Settings className="mr-2 size-4" />
                    <span>Account Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                    onClick={() => logout()}
                  >
                    <LogOut className="mr-2 size-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TooltipProvider>
          </div>
        </div>

        {/* Expanded Sidebar */}
        {isExpanded && activeSection && (
          <div className="animate-slide-in-right">
            <ExpandedSidebar onClose={onCollapse} section={activeSection} />
          </div>
        )}
      </div>

      {/* User Settings Dialog */}
      <UserSettingsDialog
        isOpen={isUserSettingsOpen}
        onClose={() => setIsUserSettingsOpen(false)}
      />

      <ChangeAvatarDialog
        isOpen={isChangeAvatarOpen}
        onClose={() => setIsChangeAvatarOpen(false)}
      />
    </>
  );
}
