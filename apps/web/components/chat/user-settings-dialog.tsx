"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Separator } from "@workspace/ui/components/separator";
import { cn } from "@workspace/ui/lib/utils";
import { Bell, LogOut, Settings, Shield, User, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/stores/auth";

interface UserSettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsTab = "profile" | "security" | "notifications" | "appearance";

export function UserSettingsDialog({ isOpen, onClose }: UserSettingsDialogProps) {
  const { user, logout, updateProfile } = useAuthStore();
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Profile State
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [username, _setUsername] = useState(user?.username || "");

  // Security State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  // Notifications State
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [pushNotifs, setPushNotifs] = useState(true);

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

  const handleUpdateProfile = async () => {
    setIsLoading(true);
    try {
      const result = await updateProfile({ displayName });
      if (result.success) {
        toast.success("Profile updated successfully");
      } else {
        toast.error(result.error);
      }
    } catch (_error) {
      toast.error("An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdatePassword = () => {
    // Mock API call
    toast.success("Password updated successfully (Mock)");
    setCurrentPassword("");
    setNewPassword("");
  };

  if (!isOpen) {
    return null;
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fade-in fixed inset-0 z-[90] animate-in bg-background/60 backdrop-blur-sm duration-200"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="fade-in zoom-in-95 fixed top-1/2 left-1/2 z-[100] w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 animate-in duration-200">
        <div className="glass-strong flex h-[600px] overflow-hidden rounded-2xl border border-border/50 shadow-2xl">
          {/* Sidebar */}
          <div className="flex w-64 flex-col border-border/50 border-r bg-muted/20 p-4">
            <div className="mb-6 px-2">
              <h2 className="flex items-center gap-2 font-display font-semibold text-lg">
                <Settings className="size-5 text-primary" />
                Settings
              </h2>
            </div>

            <nav className="flex-1 space-y-1">
              <Button
                className="w-full justify-start gap-3"
                onClick={() => setActiveTab("profile")}
                variant={activeTab === "profile" ? "secondary" : "ghost"}
              >
                <User className="size-4" />
                Profile
              </Button>
              <Button
                className="w-full justify-start gap-3"
                onClick={() => setActiveTab("security")}
                variant={activeTab === "security" ? "secondary" : "ghost"}
              >
                <Shield className="size-4" />
                Security
              </Button>
              <Button
                className="w-full justify-start gap-3"
                onClick={() => setActiveTab("notifications")}
                variant={activeTab === "notifications" ? "secondary" : "ghost"}
              >
                <Bell className="size-4" />
                Notifications
              </Button>
            </nav>

            <div className="mt-auto border-border/30 border-t pt-4">
              <Button
                className="w-full justify-start gap-3 text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={isLoggingOut}
                onClick={handleLogout}
                variant="ghost"
              >
                <LogOut className={cn("size-4", isLoggingOut && "animate-spin")} />
                {isLoggingOut ? "Signing out..." : "Sign Out"}
              </Button>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex min-w-0 flex-1 flex-col bg-background/30">
            <div className="flex items-center justify-between border-border/30 border-b p-6 pb-4">
              <h3 className="font-semibold text-xl capitalize">{activeTab}</h3>
              <Button
                className="hover:bg-destructive/10 hover:text-destructive"
                onClick={onClose}
                size="icon-sm"
                variant="ghost"
              >
                <X className="size-4" />
              </Button>
            </div>

            <div className="custom-scrollbar flex-1 space-y-6 overflow-y-auto p-6">
              {activeTab === "profile" && (
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <Avatar className="size-20 ring-4 ring-primary/10">
                      <AvatarImage src={user?.avatarUrl || undefined} />
                      <AvatarFallback className="bg-gradient-to-br from-[var(--gradient-from)] to-[var(--gradient-to)] font-display text-2xl text-white">
                        {user?.displayName?.substring(0, 2).toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h4 className="font-medium text-lg">{user?.displayName}</h4>
                      <p className="text-muted-foreground text-sm">@{user?.username}</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="grid gap-2">
                      <Label htmlFor="display-name">Display Name</Label>
                      <Input
                        id="display-name"
                        onChange={(e) => setDisplayName(e.target.value)}
                        value={displayName}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="username">Username</Label>
                      <Input className="bg-muted/50" disabled id="username" value={username} />
                      <p className="text-muted-foreground text-xs">Username cannot be changed.</p>
                    </div>
                    <Button disabled={isLoading} onClick={handleUpdateProfile}>
                      {isLoading ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                </div>
              )}

              {activeTab === "security" && (
                <div className="space-y-6">
                  <div className="space-y-4">
                    <h4 className="font-medium">Change Password</h4>
                    <div className="grid gap-2">
                      <Label htmlFor="current-password">Current Password</Label>
                      <Input
                        id="current-password"
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        type="password"
                        value={currentPassword}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="new-password">New Password</Label>
                      <Input
                        id="new-password"
                        onChange={(e) => setNewPassword(e.target.value)}
                        type="password"
                        value={newPassword}
                      />
                    </div>
                    <Button onClick={handleUpdatePassword} variant="outline">
                      Update Password
                    </Button>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h4 className="font-medium text-destructive">Danger Zone</h4>
                    <Button variant="destructive">Delete Account</Button>
                  </div>
                </div>
              )}

              {activeTab === "notifications" && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/10 p-4">
                    <div className="space-y-0.5">
                      <Label className="text-base">Email Notifications</Label>
                      <p className="text-muted-foreground text-sm">
                        Receive emails about your activity
                      </p>
                    </div>
                    <Button
                      onClick={() => setEmailNotifs(!emailNotifs)}
                      size="sm"
                      variant={emailNotifs ? "default" : "outline"}
                    >
                      {emailNotifs ? "On" : "Off"}
                    </Button>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/10 p-4">
                    <div className="space-y-0.5">
                      <Label className="text-base">Push Notifications</Label>
                      <p className="text-muted-foreground text-sm">
                        Receive push notifications on this device
                      </p>
                    </div>
                    <Button
                      onClick={() => setPushNotifs(!pushNotifs)}
                      size="sm"
                      variant={pushNotifs ? "default" : "outline"}
                    >
                      {pushNotifs ? "On" : "Off"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
