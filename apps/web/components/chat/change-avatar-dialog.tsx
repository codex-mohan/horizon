"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@workspace/ui/components/button";
import { GradientButton } from "@workspace/ui/components/gradient-button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Separator } from "@workspace/ui/components/separator";
import { useAuthStore } from "@/lib/stores/auth";
import { toast } from "sonner";
import { Dices, Link as LinkIcon, Loader2, Image as ImageIcon, X, Upload, Check, RefreshCw } from "lucide-react";
import { cn } from "@workspace/ui/lib/utils";

interface ChangeAvatarDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

// Using 'shapes' style for a modern, abstract, and professional look
const PRESET_SEEDS = [
    "Horizon", "Nebula", "Pulsar", "Quasar", "Vertex", "Orbit", "Flux", "Zenith", "Apex", "Prism"
];

const BACKGROUND_COLORS = [
    "00d4ff", // Cyan
    "a855f7", // Purple
    "6366f1", // Indigo
    "ef4444", // Red
    "f97316", // Orange
    "eab308", // Yellow
    "10b981", // Emerald
    "ec4899", // Pink
    "ffffff", // White
];

export function ChangeAvatarDialog({ isOpen, onClose }: ChangeAvatarDialogProps) {
    const { user, updateProfile } = useAuthStore();
    const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || "");
    const [selectedSeed, setSelectedSeed] = useState("");
    const [selectedColor, setSelectedColor] = useState("b6e3f4");
    const [isLoading, setIsLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Initialize state based on current avatar if it's a DiceBear URL
    useEffect(() => {
        if (isOpen && user?.avatarUrl) {
            setAvatarUrl(user.avatarUrl);
            if (user.avatarUrl.includes("dicebear.com")) {
                // Try to extract seed and color
                try {
                    const url = new URL(user.avatarUrl);
                    const seed = url.searchParams.get("seed");
                    const bg = url.searchParams.get("backgroundColor");
                    if (seed) setSelectedSeed(seed);
                    if (bg) setSelectedColor(bg);
                } catch (e) {
                    // Ignore parsing errors
                }
            }
        }
    }, [isOpen, user]);

    const updateDiceBearUrl = (seed: string, color: string) => {
        return `https://api.dicebear.com/9.x/shapes/svg?seed=${seed}&backgroundColor=${color}`;
    };

    const handlePresetSelect = (seed: string) => {
        setSelectedSeed(seed);
        const newUrl = updateDiceBearUrl(seed, selectedColor);
        setAvatarUrl(newUrl);
    };

    const handleColorSelect = (color: string) => {
        setSelectedColor(color);
        // Only update URL if we are currently using a DiceBear/Preset avatar
        // or if we have a seed selected
        if (selectedSeed) {
            const newUrl = updateDiceBearUrl(selectedSeed, color);
            setAvatarUrl(newUrl);
        } else if (avatarUrl.includes("dicebear")) {
            // Try to extract existing seed if not stored in state
            try {
                const url = new URL(avatarUrl);
                const seed = url.searchParams.get("seed") || "Felix";
                setSelectedSeed(seed);
                const newUrl = updateDiceBearUrl(seed, color);
                setAvatarUrl(newUrl);
            } catch (e) {
                // Fallback
                const newUrl = updateDiceBearUrl("Felix", color);
                setAvatarUrl(newUrl);
            }
        }
    };

    const handleSave = async () => {
        setIsLoading(true);
        try {
            const result = await updateProfile({ avatarUrl });
            if (result.success) {
                toast.success("Avatar updated successfully");
                onClose();
            } else {
                toast.error(result.error || "Failed to update avatar");
            }
        } catch (error) {
            toast.error("An error occurred");
        } finally {
            setIsLoading(false);
        }
    };

    const handleGenerateRandom = () => {
        const randomId = Math.random().toString(36).substring(7);
        setSelectedSeed(randomId);
        const newUrl = updateDiceBearUrl(randomId, selectedColor);
        setAvatarUrl(newUrl);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            toast.error("File size must be less than 5MB");
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result as string;
            setAvatarUrl(result);
            setSelectedSeed(""); // Clear seed as we are now using a custom image
        };
        reader.readAsDataURL(file);
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-[90] bg-background/60 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={onClose}
            />

            {/* Dialog */}
            <div className="fixed left-1/2 top-1/2 z-[100] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 animate-in fade-in zoom-in-95 duration-200">
                <div className="glass-strong rounded-2xl border border-border/50 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 pb-4 shrink-0">
                        <h2 className="text-xl font-display font-semibold flex items-center gap-2">
                            <ImageIcon className="size-5 text-primary" />
                            Change Profile Picture
                        </h2>
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={onClose}
                            className="hover:bg-destructive/10 hover:text-destructive"
                        >
                            <X className="size-4" />
                        </Button>
                    </div>

                    <Separator />

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                        {/* Current Avatar & Actions */}
                        <div className="flex flex-col items-center gap-6">
                            <div className="relative group">
                                <Avatar className="size-32 ring-4 ring-primary/10 transition-all duration-300 group-hover:ring-primary/30 shadow-xl bg-muted/50">
                                    <AvatarImage src={avatarUrl || undefined} className="object-cover" />
                                    <AvatarFallback className="text-3xl font-display bg-gradient-to-br from-[var(--gradient-from)] to-[var(--gradient-to)] text-white">
                                        {user?.displayName?.substring(0, 2).toUpperCase() || "U"}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="absolute bottom-0 right-0">
                                    <Button
                                        size="icon"
                                        className="rounded-full shadow-lg h-10 w-10 hover:scale-110 transition-transform"
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        <Upload className="size-5" />
                                    </Button>
                                </div>
                            </div>

                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept="image/*"
                                onChange={handleFileUpload}
                            />

                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    onClick={handleGenerateRandom}
                                    className="gap-2"
                                >
                                    <Dices className="size-4" />
                                    Randomize
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="gap-2"
                                >
                                    <Upload className="size-4" />
                                    Upload Image
                                </Button>
                            </div>
                        </div>

                        <Separator className="bg-border/50" />

                        {/* Presets */}
                        <div className="space-y-3">
                            <Label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                                Choose a Style
                            </Label>
                            <div className="grid grid-cols-5 gap-3">
                                {PRESET_SEEDS.map((seed) => {
                                    // Generate preview URL with the CURRENT selected color for consistency
                                    const previewUrl = updateDiceBearUrl(seed, selectedColor);
                                    const isSelected = selectedSeed === seed && !avatarUrl.startsWith("data:");

                                    return (
                                        <button
                                            key={seed}
                                            onClick={() => handlePresetSelect(seed)}
                                            className={cn(
                                                "relative aspect-square rounded-full overflow-hidden transition-all duration-200 border-2 bg-muted/30",
                                                isSelected
                                                    ? "border-primary ring-2 ring-primary/20 scale-105"
                                                    : "border-transparent ring-1 ring-border hover:scale-105 hover:border-primary/50"
                                            )}
                                            title={seed}
                                        >
                                            <img
                                                src={previewUrl}
                                                alt={`Preset ${seed}`}
                                                className="w-full h-full object-cover"
                                                loading="lazy"
                                            />
                                            {isSelected && (
                                                <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                                                    <div className="bg-primary text-primary-foreground rounded-full p-1 shadow-lg">
                                                        <Check className="size-3" />
                                                    </div>
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Color Picker */}
                        <div className={cn(
                            "space-y-3 transition-opacity duration-200",
                            avatarUrl.startsWith("data:") ? "opacity-50 pointer-events-none grayscale" : "opacity-100"
                        )}>
                            <Label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                                Background Shade
                            </Label>
                            <div className="flex flex-wrap gap-3">
                                {BACKGROUND_COLORS.map((color) => (
                                    <button
                                        key={color}
                                        onClick={() => handleColorSelect(color)}
                                        className={cn(
                                            "size-8 rounded-full border shadow-sm transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                                            selectedColor === color && !avatarUrl.startsWith("data:")
                                                ? "ring-2 ring-primary ring-offset-2 scale-110"
                                                : "border-border/50"
                                        )}
                                        style={{ backgroundColor: `#${color}` }}
                                        title={`#${color}`}
                                        disabled={avatarUrl.startsWith("data:")}
                                    />
                                ))}
                            </div>
                            {avatarUrl.startsWith("data:") && (
                                <p className="text-xs text-muted-foreground">
                                    Color shades are disabled for custom uploaded images.
                                </p>
                            )}
                        </div>

                        <Separator className="bg-border/50" />

                        {/* URL Input */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <Label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                                    Image URL
                                </Label>
                            </div>
                            <div className="relative">
                                <LinkIcon className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                                <Input
                                    value={avatarUrl}
                                    onChange={(e) => {
                                        setAvatarUrl(e.target.value);
                                        setSelectedSeed(""); // clear seed if user types URL
                                    }}
                                    placeholder="https://example.com/avatar.png"
                                    className="pl-10"
                                />
                            </div>
                        </div>
                    </div>

                    <Separator />

                    {/* Footer */}
                    <div className="p-4 flex items-center justify-end gap-3 bg-muted/20 shrink-0">
                        <Button variant="ghost" onClick={onClose} disabled={isLoading}>
                            Cancel
                        </Button>
                        <GradientButton
                            onClick={handleSave}
                            disabled={isLoading}
                            className="px-8 min-w-[140px]" // Ensure constant width
                            variant="default"
                            width="40" // Approx 160px
                        >
                            {isLoading ? (
                                <span className="flex items-center"><Loader2 className="size-4 mr-2 animate-spin" /> Saving...</span>
                            ) : (
                                "Save Changes"
                            )}
                        </GradientButton>
                    </div>
                </div>
            </div>
        </>
    );
}
