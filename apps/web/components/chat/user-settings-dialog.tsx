"use client";

import { useState } from "react";
import { LogOut, Settings, User, Mail, Shield, X, Bell, Moon, Sun, Monitor, ChevronRight } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Separator } from "@workspace/ui/components/separator";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { cn } from "@workspace/ui/lib/utils";
import { useAuthStore } from "@/lib/stores/auth";
import { toast } from "sonner";

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
    const [username, setUsername] = useState(user?.username || "");

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
        } catch (error) {
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
    }

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-[90] bg-background/60 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={onClose}
            />

            {/* Dialog */}
            <div className="fixed left-1/2 top-1/2 z-[100] w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 animate-in fade-in zoom-in-95 duration-200">
                <div className="glass-strong rounded-2xl border border-border/50 shadow-2xl overflow-hidden flex h-[600px]">

                    {/* Sidebar */}
                    <div className="w-64 bg-muted/20 border-r border-border/50 flex flex-col p-4">
                        <div className="mb-6 px-2">
                            <h2 className="text-lg font-display font-semibold flex items-center gap-2">
                                <Settings className="size-5 text-primary" />
                                Settings
                            </h2>
                        </div>

                        <nav className="space-y-1 flex-1">
                            <Button
                                variant={activeTab === "profile" ? "secondary" : "ghost"}
                                className="w-full justify-start gap-3"
                                onClick={() => setActiveTab("profile")}
                            >
                                <User className="size-4" />
                                Profile
                            </Button>
                            <Button
                                variant={activeTab === "security" ? "secondary" : "ghost"}
                                className="w-full justify-start gap-3"
                                onClick={() => setActiveTab("security")}
                            >
                                <Shield className="size-4" />
                                Security
                            </Button>
                            <Button
                                variant={activeTab === "notifications" ? "secondary" : "ghost"}
                                className="w-full justify-start gap-3"
                                onClick={() => setActiveTab("notifications")}
                            >
                                <Bell className="size-4" />
                                Notifications
                            </Button>
                        </nav>

                        <div className="mt-auto pt-4 border-t border-border/30">
                            <Button
                                variant="ghost"
                                className="w-full justify-start gap-3 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                onClick={handleLogout}
                                disabled={isLoggingOut}
                            >
                                <LogOut className={cn("size-4", isLoggingOut && "animate-spin")} />
                                {isLoggingOut ? "Signing out..." : "Sign Out"}
                            </Button>
                        </div>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 flex flex-col min-w-0 bg-background/30">
                        <div className="flex items-center justify-between p-6 pb-4 border-b border-border/30">
                            <h3 className="text-xl font-semibold capitalize">{activeTab}</h3>
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={onClose}
                                className="hover:bg-destructive/10 hover:text-destructive"
                            >
                                <X className="size-4" />
                            </Button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                            {activeTab === "profile" && (
                                <div className="space-y-6">
                                    <div className="flex items-center gap-4">
                                        <Avatar className="size-20 ring-4 ring-primary/10">
                                            <AvatarImage src={user?.avatarUrl || undefined} />
                                            <AvatarFallback className="text-2xl font-display bg-gradient-to-br from-[var(--gradient-from)] to-[var(--gradient-to)] text-white">
                                                {user?.displayName?.substring(0, 2).toUpperCase() || "U"}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <h4 className="font-medium text-lg">{user?.displayName}</h4>
                                            <p className="text-sm text-muted-foreground">@{user?.username}</p>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="grid gap-2">
                                            <Label htmlFor="display-name">Display Name</Label>
                                            <Input
                                                id="display-name"
                                                value={displayName}
                                                onChange={(e) => setDisplayName(e.target.value)}
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="username">Username</Label>
                                            <Input
                                                id="username"
                                                value={username}
                                                disabled
                                                className="bg-muted/50"
                                            />
                                            <p className="text-xs text-muted-foreground">Username cannot be changed.</p>
                                        </div>
                                        <Button onClick={handleUpdateProfile} disabled={isLoading}>
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
                                                type="password"
                                                value={currentPassword}
                                                onChange={(e) => setCurrentPassword(e.target.value)}
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="new-password">New Password</Label>
                                            <Input
                                                id="new-password"
                                                type="password"
                                                value={newPassword}
                                                onChange={(e) => setNewPassword(e.target.value)}
                                            />
                                        </div>
                                        <Button onClick={handleUpdatePassword} variant="outline">Update Password</Button>
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
                                    <div className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-muted/10">
                                        <div className="space-y-0.5">
                                            <Label className="text-base">Email Notifications</Label>
                                            <p className="text-sm text-muted-foreground">Receive emails about your activity</p>
                                        </div>
                                        <Button
                                            variant={emailNotifs ? "default" : "outline"}
                                            onClick={() => setEmailNotifs(!emailNotifs)}
                                            size="sm"
                                        >
                                            {emailNotifs ? "On" : "Off"}
                                        </Button>
                                    </div>

                                    <div className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-muted/10">
                                        <div className="space-y-0.5">
                                            <Label className="text-base">Push Notifications</Label>
                                            <p className="text-sm text-muted-foreground">Receive push notifications on this device</p>
                                        </div>
                                        <Button
                                            variant={pushNotifs ? "default" : "outline"}
                                            onClick={() => setPushNotifs(!pushNotifs)}
                                            size="sm"
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
