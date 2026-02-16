"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";
import { GradientButton } from "@workspace/ui/components/gradient-button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Separator } from "@workspace/ui/components/separator";
import { cn } from "@workspace/ui/lib/utils";
import {
  Check,
  Dices,
  Image as ImageIcon,
  Link as LinkIcon,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/stores/auth";

interface ChangeAvatarDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

// Using 'shapes' style for a modern, abstract, and professional look
const PRESET_SEEDS = [
  "Horizon",
  "Nebula",
  "Pulsar",
  "Quasar",
  "Vertex",
  "Orbit",
  "Flux",
  "Zenith",
  "Apex",
  "Prism",
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
          if (seed) {
            setSelectedSeed(seed);
          }
          if (bg) {
            setSelectedColor(bg);
          }
        } catch (_e) {
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
      } catch (_e) {
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
    } catch (_error) {
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
    if (!file) {
      return;
    }

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
      <div className="fade-in zoom-in-95 fixed top-1/2 left-1/2 z-[100] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 animate-in duration-200">
        <div className="glass-strong flex max-h-[90vh] flex-col overflow-hidden rounded-2xl border border-border/50 shadow-2xl">
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between p-6 pb-4">
            <h2 className="flex items-center gap-2 font-display font-semibold text-xl">
              <ImageIcon className="size-5 text-primary" />
              Change Profile Picture
            </h2>
            <Button
              className="hover:bg-destructive/10 hover:text-destructive"
              onClick={onClose}
              size="icon-sm"
              variant="ghost"
            >
              <X className="size-4" />
            </Button>
          </div>

          <Separator />

          {/* Content */}
          <div className="custom-scrollbar flex-1 space-y-6 overflow-y-auto p-6">
            {/* Current Avatar & Actions */}
            <div className="flex flex-col items-center gap-6">
              <div className="group relative">
                <Avatar className="size-32 bg-muted/50 shadow-xl ring-4 ring-primary/10 transition-all duration-300 group-hover:ring-primary/30">
                  <AvatarImage className="object-cover" src={avatarUrl || undefined} />
                  <AvatarFallback className="bg-gradient-to-br from-[var(--gradient-from)] to-[var(--gradient-to)] font-display text-3xl text-white">
                    {user?.displayName?.substring(0, 2).toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute right-0 bottom-0">
                  <Button
                    className="h-10 w-10 rounded-full shadow-lg transition-transform hover:scale-110"
                    onClick={() => fileInputRef.current?.click()}
                    size="icon"
                  >
                    <Upload className="size-5" />
                  </Button>
                </div>
              </div>

              <input
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
                ref={fileInputRef}
                type="file"
              />

              <div className="flex gap-2">
                <Button className="gap-2" onClick={handleGenerateRandom} variant="outline">
                  <Dices className="size-4" />
                  Randomize
                </Button>
                <Button
                  className="gap-2"
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                >
                  <Upload className="size-4" />
                  Upload Image
                </Button>
              </div>
            </div>

            <Separator className="bg-border/50" />

            {/* Presets */}
            <div className="space-y-3">
              <Label className="font-medium text-muted-foreground text-sm uppercase tracking-wider">
                Choose a Style
              </Label>
              <div className="grid grid-cols-5 gap-3">
                {PRESET_SEEDS.map((seed) => {
                  // Generate preview URL with the CURRENT selected color for consistency
                  const previewUrl = updateDiceBearUrl(seed, selectedColor);
                  const isSelected = selectedSeed === seed && !avatarUrl.startsWith("data:");

                  return (
                    <button
                      className={cn(
                        "relative aspect-square overflow-hidden rounded-full border-2 bg-muted/30 transition-all duration-200",
                        isSelected
                          ? "scale-105 border-primary ring-2 ring-primary/20"
                          : "border-transparent ring-1 ring-border hover:scale-105 hover:border-primary/50"
                      )}
                      key={seed}
                      onClick={() => handlePresetSelect(seed)}
                      title={seed}
                    >
                      <img
                        alt={`Preset ${seed}`}
                        className="h-full w-full object-cover"
                        loading="lazy"
                        src={previewUrl}
                      />
                      {isSelected && (
                        <div className="absolute inset-0 flex items-center justify-center bg-primary/20">
                          <div className="rounded-full bg-primary p-1 text-primary-foreground shadow-lg">
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
            <div
              className={cn(
                "space-y-3 transition-opacity duration-200",
                avatarUrl.startsWith("data:")
                  ? "pointer-events-none opacity-50 grayscale"
                  : "opacity-100"
              )}
            >
              <Label className="font-medium text-muted-foreground text-sm uppercase tracking-wider">
                Background Shade
              </Label>
              <div className="flex flex-wrap gap-3">
                {BACKGROUND_COLORS.map((color) => (
                  <button
                    className={cn(
                      "size-8 rounded-full border shadow-sm transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                      selectedColor === color && !avatarUrl.startsWith("data:")
                        ? "scale-110 ring-2 ring-primary ring-offset-2"
                        : "border-border/50"
                    )}
                    disabled={avatarUrl.startsWith("data:")}
                    key={color}
                    onClick={() => handleColorSelect(color)}
                    style={{ backgroundColor: `#${color}` }}
                    title={`#${color}`}
                  />
                ))}
              </div>
              {avatarUrl.startsWith("data:") && (
                <p className="text-muted-foreground text-xs">
                  Color shades are disabled for custom uploaded images.
                </p>
              )}
            </div>

            <Separator className="bg-border/50" />

            {/* URL Input */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="font-medium text-muted-foreground text-sm uppercase tracking-wider">
                  Image URL
                </Label>
              </div>
              <div className="relative">
                <LinkIcon className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
                <Input
                  className="pl-10"
                  onChange={(e) => {
                    setAvatarUrl(e.target.value);
                    setSelectedSeed(""); // clear seed if user types URL
                  }}
                  placeholder="https://example.com/avatar.png"
                  value={avatarUrl}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Footer */}
          <div className="flex shrink-0 items-center justify-end gap-3 bg-muted/20 p-4">
            <Button disabled={isLoading} onClick={onClose} variant="ghost">
              Cancel
            </Button>
            <GradientButton
              className="min-w-[140px] px-8"
              disabled={isLoading}
              onClick={handleSave} // Ensure constant width
              variant="default"
              width="40" // Approx 160px
            >
              {isLoading ? (
                <span className="flex items-center">
                  <Loader2 className="mr-2 size-4 animate-spin" /> Saving...
                </span>
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
