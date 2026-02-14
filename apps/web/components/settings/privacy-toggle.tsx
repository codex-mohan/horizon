"use client";

import { Button } from "@workspace/ui/components/button";
import { Label } from "@workspace/ui/components/label";
import { Slider } from "@workspace/ui/components/slider";
import { Switch } from "@workspace/ui/components/switch";
import { cn } from "@workspace/ui/lib/utils";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Clock,
  Eye,
  EyeOff,
  Shield,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";

interface PrivacySettings {
  enabled: boolean;
  autoDetect: boolean;
  retentionDays: number;
  allowLearning: boolean;
}

interface PrivacyToggleProps {
  userId: string;
  apiUrl?: string;
}

export function PrivacyToggle({
  userId,
  apiUrl = "http://localhost:2024",
}: PrivacyToggleProps) {
  const [settings, setSettings] = useState<PrivacySettings>({
    enabled: false,
    autoDetect: true,
    retentionDays: 365,
    allowLearning: true,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Load settings from localStorage (or could fetch from API)
  useEffect(() => {
    const saved = localStorage.getItem(`privacy-${userId}`);
    if (saved) {
      setSettings(JSON.parse(saved));
    }
  }, [userId]);

  // Save settings
  const saveSettings = (newSettings: PrivacySettings) => {
    setSettings(newSettings);
    localStorage.setItem(`privacy-${userId}`, JSON.stringify(newSettings));

    // TODO: Sync with backend memory client
    // fetch(`${apiUrl}/privacy/settings`, {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify({ user_id: userId, ...newSettings }),
    // });
  };

  const handleTogglePrivacy = (enabled: boolean) => {
    saveSettings({ ...settings, enabled });
  };

  const handleDeleteAllMemories = async () => {
    setIsLoading(true);
    try {
      // TODO: Call backend to delete all memories
      // await fetch(`${apiUrl}/memory/delete-all?user_id=${userId}`, {
      //   method: "DELETE",
      // });

      // For now, just show success
      setTimeout(() => {
        setShowDeleteConfirm(false);
        setIsLoading(false);
      }, 1000);
    } catch (error) {
      console.error("Failed to delete memories:", error);
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Main Privacy Toggle */}
      <div
        className={cn(
          "rounded-lg border p-4 transition-colors",
          settings.enabled
            ? "border-destructive/30 bg-destructive/10"
            : "bg-muted/50"
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "rounded-lg p-2 transition-colors",
                settings.enabled
                  ? "bg-destructive/20 text-destructive"
                  : "bg-primary/10 text-primary"
              )}
            >
              {settings.enabled ? (
                <EyeOff className="size-5" />
              ) : (
                <Eye className="size-5" />
              )}
            </div>
            <div>
              <h3 className="font-medium text-sm">
                {settings.enabled ? "Privacy Mode ON" : "Privacy Mode OFF"}
              </h3>
              <p className="text-muted-foreground text-xs">
                {settings.enabled
                  ? "Your conversations are not being stored"
                  : "Your conversations are being stored for personalization"}
              </p>
            </div>
          </div>
          <Switch
            checked={settings.enabled}
            onCheckedChange={(checked: boolean) => handleTogglePrivacy(checked)}
          />
        </div>

        {/* Warning when enabled */}
        {settings.enabled && (
          <motion.div
            animate={{ opacity: 1, height: "auto" }}
            className="mt-4 flex items-start gap-2 rounded-md bg-destructive/10 p-3"
            exit={{ opacity: 0, height: 0 }}
            initial={{ opacity: 0, height: 0 }}
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
            <p className="text-destructive text-xs">
              When Privacy Mode is enabled, the AI won't remember your
              preferences or previous conversations. This gives you maximum
              privacy but reduces personalization.
            </p>
          </motion.div>
        )}
      </div>

      {/* Additional Settings (only shown when privacy is OFF) */}
      {!settings.enabled && (
        <motion.div
          animate={{ opacity: 1 }}
          className="space-y-4"
          initial={{ opacity: 0 }}
        >
          <h4 className="flex items-center gap-2 font-medium text-sm">
            <Shield className="size-4" />
            Memory Settings
          </h4>

          {/* Auto-detect sensitive info */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm">Auto-detect sensitive info</Label>
              <p className="text-muted-foreground text-xs">
                Automatically exclude passwords, API keys, etc.
              </p>
            </div>
            <Switch
              checked={settings.autoDetect}
              onCheckedChange={(checked: boolean) =>
                saveSettings({ ...settings, autoDetect: checked })
              }
            />
          </div>

          {/* Allow preference learning */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm">Learn preferences</Label>
              <p className="text-muted-foreground text-xs">
                Allow AI to learn your style and preferences
              </p>
            </div>
            <Switch
              checked={settings.allowLearning}
              onCheckedChange={(checked: boolean) =>
                saveSettings({ ...settings, allowLearning: checked })
              }
            />
          </div>

          {/* Retention period */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2 text-sm">
                <Clock className="size-4" />
                Retention period
              </Label>
              <span className="font-medium text-sm">
                {settings.retentionDays} days
              </span>
            </div>
            <Slider
              max={365}
              min={7}
              onValueChange={([value]) =>
                saveSettings({ ...settings, retentionDays: value })
              }
              step={7}
              value={[settings.retentionDays]}
            />
            <p className="text-muted-foreground text-xs">
              Memories older than {settings.retentionDays} days will be
              automatically deleted
            </p>
          </div>

          {/* Delete all memories */}
          <div className="border-t pt-4">
            {showDeleteConfirm ? (
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3"
                initial={{ opacity: 0, y: -10 }}
              >
                <p className="text-center text-muted-foreground text-sm">
                  Are you sure? This will permanently delete all stored
                  memories.
                </p>
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={() => setShowDeleteConfirm(false)}
                    variant="outline"
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1"
                    disabled={isLoading}
                    onClick={handleDeleteAllMemories}
                    variant="destructive"
                  >
                    {isLoading ? "Deleting..." : "Yes, Delete All"}
                  </Button>
                </div>
              </motion.div>
            ) : (
              <Button
                className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setShowDeleteConfirm(true)}
                variant="outline"
              >
                <Trash2 className="mr-2 size-4" />
                Delete All My Memories
              </Button>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
