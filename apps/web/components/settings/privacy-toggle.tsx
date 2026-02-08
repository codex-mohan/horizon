"use client";

import { motion } from "framer-motion";
import {
  Shield,
  Eye,
  EyeOff,
  Trash2,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { Switch } from "@workspace/ui/components/switch";
import { Button } from "@workspace/ui/components/button";
import { Slider } from "@workspace/ui/components/slider";
import { Label } from "@workspace/ui/components/label";
import { cn } from "@workspace/ui/lib/utils";
import { useState, useEffect } from "react";

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
            ? "bg-destructive/10 border-destructive/30"
            : "bg-muted/50",
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "p-2 rounded-lg transition-colors",
                settings.enabled
                  ? "bg-destructive/20 text-destructive"
                  : "bg-primary/10 text-primary",
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
              <p className="text-xs text-muted-foreground">
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
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 p-3 bg-destructive/10 rounded-md flex items-start gap-2"
          >
            <AlertTriangle className="size-4 text-destructive shrink-0 mt-0.5" />
            <p className="text-xs text-destructive">
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
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-4"
        >
          <h4 className="font-medium text-sm flex items-center gap-2">
            <Shield className="size-4" />
            Memory Settings
          </h4>

          {/* Auto-detect sensitive info */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm">Auto-detect sensitive info</Label>
              <p className="text-xs text-muted-foreground">
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
              <p className="text-xs text-muted-foreground">
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
              <Label className="text-sm flex items-center gap-2">
                <Clock className="size-4" />
                Retention period
              </Label>
              <span className="text-sm font-medium">
                {settings.retentionDays} days
              </span>
            </div>
            <Slider
              value={[settings.retentionDays]}
              onValueChange={([value]) =>
                saveSettings({ ...settings, retentionDays: value })
              }
              min={7}
              max={365}
              step={7}
            />
            <p className="text-xs text-muted-foreground">
              Memories older than {settings.retentionDays} days will be
              automatically deleted
            </p>
          </div>

          {/* Delete all memories */}
          <div className="pt-4 border-t">
            {!showDeleteConfirm ? (
              <Button
                variant="outline"
                className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="size-4 mr-2" />
                Delete All My Memories
              </Button>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3"
              >
                <p className="text-sm text-center text-muted-foreground">
                  Are you sure? This will permanently delete all stored
                  memories.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowDeleteConfirm(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={handleDeleteAllMemories}
                    disabled={isLoading}
                  >
                    {isLoading ? "Deleting..." : "Yes, Delete All"}
                  </Button>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
