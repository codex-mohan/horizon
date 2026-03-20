"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@horizon/ui/components/avatar";
import { Badge } from "@horizon/ui/components/badge";
import { Button } from "@horizon/ui/components/button";
import { Input } from "@horizon/ui/components/input";
import { Label } from "@horizon/ui/components/label";
import { Separator } from "@horizon/ui/components/separator";
import { Switch } from "@horizon/ui/components/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@horizon/ui/components/tabs";
import { cn } from "@horizon/ui/lib/utils";
import {
  Activity,
  AlertCircle,
  Bell,
  ChevronRight,
  Code,
  Download,
  Eye,
  Globe,
  Keyboard,
  Languages,
  LogOut,
  MessageSquare,
  Moon,
  Palette,
  Shield,
  Sun,
  Terminal,
  Trash2,
  User,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/stores/auth";
import { type ToolApprovalMode, useChatSettings } from "@/lib/stores/chat-settings";
import { useTheme } from "../theme/theme-provider";

interface UserSettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UserSettingsDialog({ isOpen, onClose }: UserSettingsDialogProps) {
  const { user, logout } = useAuthStore();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      onClose();
    } catch (error) {
      console.error("Logout failed:", error);
      setIsLoggingOut(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <>
      <button
        className="fixed inset-0 z-[90] cursor-default animate-in fade-in-0 duration-200"
        onClick={onClose}
        type="button"
        aria-label="Close settings"
      >
        <div className="absolute inset-0 bg-black/50 backdrop-blur-xl" />
      </button>

      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 lg:p-8 animate-in zoom-in-95 duration-200">
        <div className="glass-strong relative flex h-[85vh] max-h-[700px] w-[90vw] max-w-2xl flex-col overflow-hidden rounded-2xl border border-[var(--gradient-from)]/20 shadow-2xl">
          {/* Header */}
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--gradient-from)]/10 bg-gradient-to-b from-[var(--gradient-from)]/5 to-transparent px-5">
            <div className="flex items-center gap-3">
              <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--gradient-from)] to-[var(--gradient-to)]">
                <User className="size-4 text-white" />
              </div>
              <div>
                <h2 className="font-display text-sm font-semibold">Account Settings</h2>
                <p className="text-muted-foreground text-xs">Manage your profile and preferences</p>
              </div>
            </div>
            <Button
              className="size-8 rounded-lg hover:bg-[var(--gradient-from)]/20"
              onClick={onClose}
              size="icon-sm"
              variant="ghost"
            >
              <X className="size-4" />
            </Button>
          </div>

          {/* Tabs */}
          <Tabs className="flex min-h-0 shrink-0 flex-col flex-1" defaultValue="profile">
            <TabsList className="mx-5 mt-3 shrink-0 grid w-auto grid-cols-5 gap-1 rounded-xl border border-[var(--gradient-from)]/20 bg-[var(--gradient-from)]/10 p-1">
              <TabsTrigger
                className="rounded-lg text-xs font-medium transition-colors duration-150 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--gradient-from)]/60 data-[state=active]:to-[var(--gradient-to)]/60 data-[state=active]:text-white data-[state=active]:shadow-sm"
                value="profile"
              >
                <User className="mr-1.5 size-3.5" />
                Profile
              </TabsTrigger>
              <TabsTrigger
                className="rounded-lg text-xs font-medium transition-colors duration-150 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--gradient-from)]/60 data-[state=active]:to-[var(--gradient-to)]/60 data-[state=active]:text-white data-[state=active]:shadow-sm"
                value="appearance"
              >
                <Palette className="mr-1.5 size-3.5" />
                Display
              </TabsTrigger>
              <TabsTrigger
                className="rounded-lg text-xs font-medium transition-colors duration-150 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--gradient-from)]/60 data-[state=active]:to-[var(--gradient-to)]/60 data-[state=active]:text-white data-[state=active]:shadow-sm"
                value="chat"
              >
                <MessageSquare className="mr-1.5 size-3.5" />
                Chat
              </TabsTrigger>
              <TabsTrigger
                className="rounded-lg text-xs font-medium transition-colors duration-150 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--gradient-from)]/60 data-[state=active]:to-[var(--gradient-to)]/60 data-[state=active]:text-white data-[state=active]:shadow-sm"
                value="security"
              >
                <Shield className="mr-1.5 size-3.5" />
                Security
              </TabsTrigger>
              <TabsTrigger
                className="rounded-lg text-xs font-medium transition-colors duration-150 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--gradient-from)]/60 data-[state=active]:to-[var(--gradient-to)]/60 data-[state=active]:text-white data-[state=active]:shadow-sm"
                value="about"
              >
                <Activity className="mr-1.5 size-3.5" />
                About
              </TabsTrigger>
            </TabsList>

            {/* Scrollable Content */}
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[var(--gradient-from)]/30 hover:[&::-webkit-scrollbar-thumb]:bg-[var(--gradient-from)]/50">
              <TabsContent className="mt-0 animate-in fade-in-0 duration-150" value="profile">
                <ProfileTab user={user} onLogout={handleLogout} isLoggingOut={isLoggingOut} />
              </TabsContent>

              <TabsContent className="mt-0 animate-in fade-in-0 duration-150" value="appearance">
                <AppearanceTab />
              </TabsContent>

              <TabsContent className="mt-0 animate-in fade-in-0 duration-150" value="chat">
                <ChatTab />
              </TabsContent>

              <TabsContent className="mt-0 animate-in fade-in-0 duration-150" value="security">
                <SecurityTab />
              </TabsContent>

              <TabsContent className="mt-0 animate-in fade-in-0 duration-150" value="about">
                <AboutTab />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </>
  );
}

interface TabProps {
  user?: {
    displayName?: string | null;
    username?: string | null;
    avatarUrl?: string | null;
  } | null;
  onLogout?: () => void;
  isLoggingOut?: boolean;
}

function ProfileTab({ user, onLogout, isLoggingOut }: TabProps) {
  const { updateProfile } = useAuthStore();
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [username] = useState(user?.username || "");
  const [isLoading, setIsLoading] = useState(false);

  const handleUpdateProfile = async () => {
    setIsLoading(true);
    try {
      const result = await updateProfile({ displayName });
      if (result.success) {
        toast.success("Profile updated successfully");
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <Avatar className="size-16 ring-2 ring-[var(--gradient-from)]/20">
          <AvatarImage src={user?.avatarUrl || undefined} />
          <AvatarFallback className="bg-gradient-to-br from-[var(--gradient-from)] to-[var(--gradient-to)] font-display text-lg text-white">
            {user?.displayName?.substring(0, 2).toUpperCase() || "U"}
          </AvatarFallback>
        </Avatar>
        <div>
          <h4 className="font-medium text-base">{user?.displayName}</h4>
          <p className="text-muted-foreground text-sm">@{user?.username}</p>
        </div>
      </div>

      <Separator className="bg-[var(--gradient-from)]/10" />

      <div className="space-y-4">
        <div className="space-y-2">
          <Label
            className="text-xs font-medium text-muted-foreground uppercase tracking-wider"
            htmlFor="display-name"
          >
            Display Name
          </Label>
          <Input
            className="h-10 border-[var(--gradient-from)]/20 bg-[var(--gradient-from)]/5 text-sm focus:border-[var(--gradient-from)]/50"
            id="display-name"
            onChange={(e) => setDisplayName(e.target.value)}
            value={displayName}
          />
        </div>

        <div className="space-y-2">
          <Label
            className="text-xs font-medium text-muted-foreground uppercase tracking-wider"
            htmlFor="username"
          >
            Username
          </Label>
          <Input
            className="h-10 border-[var(--gradient-from)]/20 bg-[var(--gradient-from)]/5 text-sm"
            disabled
            id="username"
            value={username}
          />
          <p className="text-muted-foreground text-xs">Username cannot be changed</p>
        </div>

        <Button
          className="w-full bg-gradient-to-r from-[var(--gradient-from)] to-[var(--gradient-to)] text-sm hover:opacity-90"
          disabled={isLoading || displayName === user?.displayName}
          onClick={handleUpdateProfile}
        >
          {isLoading ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      <Separator className="bg-[var(--gradient-from)]/10" />

      <Button
        className="w-full border border-destructive/30 bg-destructive/10 text-destructive text-sm hover:bg-destructive/20"
        disabled={isLoggingOut}
        onClick={onLogout}
        variant="outline"
      >
        <LogOut className={cn("mr-2 size-4", isLoggingOut && "animate-spin")} />
        {isLoggingOut ? "Signing out..." : "Sign Out"}
      </Button>
    </div>
  );
}

function AppearanceTab() {
  const { theme, themeMode, setTheme, setThemeMode } = useTheme();

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Theme Color
        </Label>
        <div className="grid grid-cols-3 gap-2">
          {(["horizon", "nebula", "aurora"] as const).map((t) => (
            <button
              key={t}
              className={cn(
                "flex items-center justify-center rounded-xl border p-3 text-xs font-medium capitalize transition-all",
                theme === t
                  ? "border-[var(--gradient-from)]/60 bg-[var(--gradient-from)]/20"
                  : "border-[var(--gradient-from)]/20 bg-[var(--gradient-from)]/5 hover:border-[var(--gradient-from)]/40"
              )}
              onClick={() => setTheme(t)}
              type="button"
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <Separator className="bg-[var(--gradient-from)]/10" />

      <div className="space-y-3">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Appearance Mode
        </Label>
        <div className="grid grid-cols-2 gap-2">
          <button
            className={cn(
              "flex items-center justify-center gap-2 rounded-xl border p-3 text-sm transition-all",
              themeMode === "dark"
                ? "border-[var(--gradient-from)]/60 bg-[var(--gradient-from)]/20"
                : "border-[var(--gradient-from)]/20 bg-[var(--gradient-from)]/5 hover:border-[var(--gradient-from)]/40"
            )}
            onClick={() => setThemeMode("dark")}
            type="button"
          >
            <Moon className="size-4" />
            Dark
          </button>
          <button
            className={cn(
              "flex items-center justify-center gap-2 rounded-xl border p-3 text-sm transition-all",
              themeMode === "light"
                ? "border-[var(--gradient-from)]/60 bg-[var(--gradient-from)]/20"
                : "border-[var(--gradient-from)]/20 bg-[var(--gradient-from)]/5 hover:border-[var(--gradient-from)]/40"
            )}
            onClick={() => setThemeMode("light")}
            type="button"
          >
            <Sun className="size-4" />
            Light
          </button>
        </div>
      </div>

      <Separator className="bg-[var(--gradient-from)]/10" />

      <div className="space-y-4">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Display Options
        </Label>

        <ToggleOption
          icon={<Code className="size-4" />}
          label="Show Code Blocks"
          description="Display syntax-highlighted code"
        />

        <ToggleOption
          icon={<Globe className="size-4" />}
          label="Show Web Links"
          description="Display clickable URLs in messages"
        />

        <ToggleOption
          icon={<Languages className="size-4" />}
          label="Auto-detect Language"
          description="Detect and highlight code languages"
        />
      </div>
    </div>
  );
}

function ChatTab() {
  const { settings, setShowToolCalls, setShowActivityTimeline, setToolApprovalMode } =
    useChatSettings();

  const approvalModes: { value: ToolApprovalMode; label: string; description: string }[] = [
    {
      value: "dangerous_only",
      label: "Dangerous Only",
      description: "Ask only for dangerous tools",
    },
    { value: "always_ask", label: "Always Ask", description: "Confirm every tool execution" },
    { value: "never_ask", label: "Never Ask", description: "Auto-execute all tools" },
  ];

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Chat Display
        </Label>

        <ToggleOption
          icon={<Eye className="size-4" />}
          label="Show Tool Calls"
          description="Display tool execution in chat"
          checked={settings.showToolCalls}
          onCheckedChange={setShowToolCalls}
        />

        <ToggleOption
          icon={<Activity className="size-4" />}
          label="Show Activity Timeline"
          description="Display execution steps"
          checked={settings.showActivityTimeline}
          onCheckedChange={setShowActivityTimeline}
        />
      </div>

      <Separator className="bg-[var(--gradient-from)]/10" />

      <div className="space-y-3">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Tool Approval Mode
        </Label>
        <div className="space-y-2">
          {approvalModes.map((mode) => (
            <button
              key={mode.value}
              className={cn(
                "flex w-full items-center justify-between rounded-xl border p-3 text-left text-sm transition-all",
                settings.toolApprovalMode === mode.value
                  ? "border-[var(--gradient-from)]/60 bg-[var(--gradient-from)]/20"
                  : "border-[var(--gradient-from)]/20 bg-[var(--gradient-from)]/5 hover:border-[var(--gradient-from)]/40"
              )}
              onClick={() => setToolApprovalMode(mode.value)}
              type="button"
            >
              <div>
                <p className="font-medium">{mode.label}</p>
                <p className="text-muted-foreground text-xs">{mode.description}</p>
              </div>
              {settings.toolApprovalMode === mode.value && (
                <Badge
                  className="rounded-full bg-[var(--gradient-from)] text-xs font-medium text-white"
                  variant="secondary"
                >
                  Active
                </Badge>
              )}
            </button>
          ))}
        </div>
      </div>

      <Separator className="bg-[var(--gradient-from)]/10" />

      <div className="space-y-3">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Data Management
        </Label>

        <Button
          className="w-full justify-start border border-[var(--gradient-from)]/20 bg-[var(--gradient-from)]/5 text-sm hover:bg-[var(--gradient-from)]/10"
          variant="outline"
        >
          <Download className="mr-2 size-4" />
          Export Chat History
        </Button>

        <Button
          className="w-full justify-start border border-destructive/30 bg-destructive/10 text-destructive text-sm hover:bg-destructive/20"
          variant="outline"
        >
          <Trash2 className="mr-2 size-4" />
          Clear All Chats
        </Button>
      </div>
    </div>
  );
}

function SecurityTab() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

  const handleUpdatePassword = () => {
    if (!currentPassword || !newPassword) {
      toast.error("Please fill in all fields");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    toast.success("Password updated successfully");
    setCurrentPassword("");
    setNewPassword("");
  };

  return (
    <div className="space-y-5">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="size-4 text-[var(--gradient-from)]" />
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Change Password
          </Label>
        </div>

        <div className="space-y-3">
          <Input
            className="h-10 border-[var(--gradient-from)]/20 bg-[var(--gradient-from)]/5 text-sm"
            id="current-password"
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Current password"
            type="password"
            value={currentPassword}
          />
          <Input
            className="h-10 border-[var(--gradient-from)]/20 bg-[var(--gradient-from)]/5 text-sm"
            id="new-password"
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password"
            type="password"
            value={newPassword}
          />
          <Button
            className="w-full bg-gradient-to-r from-[var(--gradient-from)] to-[var(--gradient-to)] text-sm hover:opacity-90"
            onClick={handleUpdatePassword}
          >
            Update Password
          </Button>
        </div>
      </div>

      <Separator className="bg-[var(--gradient-from)]/10" />

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <AlertCircle className="size-4 text-[var(--gradient-from)]" />
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Two-Factor Authentication
          </Label>
        </div>

        <ToggleOption
          icon={<Shield className="size-4" />}
          label="Enable 2FA"
          description="Add extra security to your account"
          checked={twoFactorEnabled}
          onCheckedChange={setTwoFactorEnabled}
        />

        {twoFactorEnabled && (
          <div className="rounded-xl border border-[var(--gradient-from)]/30 bg-[var(--gradient-from)]/10 p-4">
            <p className="text-muted-foreground text-xs">
              Two-factor authentication is enabled. Your account is protected with an additional
              layer of security.
            </p>
          </div>
        )}
      </div>

      <Separator className="bg-[var(--gradient-from)]/10" />

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <AlertCircle className="size-4 text-destructive" />
          <Label className="text-xs font-medium uppercase tracking-wider text-destructive">
            Danger Zone
          </Label>
        </div>

        <Button
          className="w-full border border-destructive/30 bg-destructive/10 text-destructive text-sm hover:bg-destructive/20"
          variant="outline"
        >
          <Trash2 className="mr-2 size-4" />
          Delete Account
        </Button>
        <p className="text-muted-foreground text-xs">
          Permanently delete your account and all associated data. This action cannot be undone.
        </p>
      </div>
    </div>
  );
}

function AboutTab() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4 rounded-xl border border-[var(--gradient-from)]/20 bg-gradient-to-br from-[var(--gradient-from)]/10 to-[var(--gradient-to)]/10 p-4">
        <div className="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--gradient-from)] to-[var(--gradient-to)]">
          <Terminal className="size-6 text-white" />
        </div>
        <div>
          <h3 className="font-display font-semibold">Horizon</h3>
          <p className="text-muted-foreground text-xs">Version 1.0.0</p>
          <Badge
            className="mt-1 rounded-full bg-[var(--gradient-from)]/20 text-xs font-medium text-[var(--gradient-from)]"
            variant="secondary"
          >
            Production
          </Badge>
        </div>
      </div>

      <Separator className="bg-[var(--gradient-from)]/10" />

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Keyboard className="size-4 text-[var(--gradient-from)]" />
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Keyboard Shortcuts
          </Label>
        </div>

        <div className="space-y-2">
          <ShortcutItem keys={["Ctrl", "Enter"]} description="Send message" />
          <ShortcutItem keys={["Ctrl", "Shift", "C"]} description="Copy last response" />
          <ShortcutItem keys={["Ctrl", "/"]} description="Show shortcuts" />
          <ShortcutItem keys={["Esc"]} description="Close modal" />
        </div>
      </div>

      <Separator className="bg-[var(--gradient-from)]/10" />

      <div className="space-y-3">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Resources
        </Label>

        <div className="space-y-2">
          <LinkItem icon={<Globe className="size-4" />} label="Documentation" />
          <LinkItem icon={<GithubIcon className="size-4" />} label="GitHub" />
          <LinkItem icon={<Bell className="size-4" />} label="Report an Issue" />
        </div>
      </div>

      <Separator className="bg-[var(--gradient-from)]/10" />

      <div className="text-center">
        <p className="text-muted-foreground text-xs">
          Built with care by <span className="text-[var(--gradient-from)]">@codex-mohan</span>
        </p>
        <p className="text-muted-foreground mt-1 text-xs">
          Past the Event Horizon, everything is possible.
        </p>
      </div>
    </div>
  );
}

interface ToggleOptionProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

function ToggleOption({ icon, label, description, checked, onCheckedChange }: ToggleOptionProps) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-[var(--gradient-from)]/20 bg-[var(--gradient-from)]/5 p-3">
      <div className="flex items-center gap-3">
        <div className="text-[var(--gradient-from)]">{icon}</div>
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-muted-foreground text-xs">{description}</p>
        </div>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-[var(--gradient-from)] data-[state=checked]:to-[var(--gradient-to)]"
      />
    </div>
  );
}

function ShortcutItem({ keys, description }: { keys: string[]; description: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-[var(--gradient-from)]/5 p-2">
      <span className="text-muted-foreground text-xs">{description}</span>
      <div className="flex gap-1">
        {keys.map((key, i) => (
          <kbd
            key={i}
            className="rounded border border-[var(--gradient-from)]/30 bg-[var(--gradient-from)]/10 px-1.5 py-0.5 font-mono text-xs"
          >
            {key}
          </kbd>
        ))}
      </div>
    </div>
  );
}

function LinkItem({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button
      className="flex w-full items-center justify-between rounded-xl border border-[var(--gradient-from)]/20 bg-[var(--gradient-from)]/5 p-3 text-sm transition-all hover:border-[var(--gradient-from)]/40"
      type="button"
    >
      <div className="flex items-center gap-3">
        <div className="text-[var(--gradient-from)]">{icon}</div>
        {label}
      </div>
      <ChevronRight className="size-4 text-muted-foreground" />
    </button>
  );
}

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"
        fill="currentColor"
      />
    </svg>
  );
}
