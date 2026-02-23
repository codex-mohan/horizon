"use client";

import { Button } from "@workspace/ui/components/button";
import { GradientButton } from "@workspace/ui/components/gradient-button";
import { GradientSlider } from "@workspace/ui/components/gradient-slider";
import { Label } from "@workspace/ui/components/label";
import { Textarea } from "@workspace/ui/components/textarea";
import { cn } from "@workspace/ui/lib/utils";
import { X } from "lucide-react";
import { useChatSettings } from "@/lib/stores/chat-settings";

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsDialog({ isOpen, onClose }: SettingsDialogProps) {
  const { settings, setModelSetting } = useChatSettings();

  // Provide defaults during hydration if modelSettings wasn't initially present in persisted storage
  const ms = settings.modelSettings || {
    temperature: 0.7,
    maxTokens: 2048,
    topP: 0.9,
    topK: 50,
    frequencyPenalty: 0,
    presencePenalty: 0,
    systemPrompt: "",
  };

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm transition-all duration-300 ease-out",
        isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      )}
    >
      <div className="absolute inset-0" onClick={onClose} />

      <div
        className={cn(
          "glass-strong relative z-10 flex w-[90vw] max-w-lg flex-col overflow-hidden rounded-xl border-border shadow-2xl transition-all duration-300 ease-out max-h-[70vh]",
          isOpen ? "scale-100 translate-y-0 opacity-100" : "scale-95 -translate-y-8 opacity-0"
        )}
      >
        <div className="flex items-center justify-between border-border border-b bg-card/50 px-4 py-3">
          <h2 className="font-display text-sm font-semibold">Model Configuration</h2>
          <Button
            className="transition-transform duration-200 hover:scale-110"
            onClick={onClose}
            size="icon-sm"
            variant="ghost"
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4">
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium" htmlFor="temperature">
                  Temperature
                </Label>
                <span className="font-mono text-xs text-primary">{ms.temperature}</span>
              </div>
              <GradientSlider
                id="temperature"
                max={2}
                min={0}
                onValueChange={(val) => setModelSetting("temperature", val[0])}
                step={0.1}
                thumbClassName="w-3 h-3 bg-white"
                trackClassName="h-2 rounded-full"
                value={[ms.temperature]}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium" htmlFor="max-tokens">
                  Max Tokens
                </Label>
                <span className="font-mono text-xs text-primary">{ms.maxTokens}</span>
              </div>
              <GradientSlider
                id="max-tokens"
                max={8192}
                min={256}
                onValueChange={(val) => setModelSetting("maxTokens", val[0])}
                step={256}
                thumbClassName="w-3 h-3 bg-white"
                trackClassName="h-2 rounded-full"
                value={[ms.maxTokens]}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium" htmlFor="top-p">
                  Top P
                </Label>
                <span className="font-mono text-xs text-primary">{ms.topP}</span>
              </div>
              <GradientSlider
                id="top-p"
                max={1}
                min={0}
                onValueChange={(val) => setModelSetting("topP", val[0])}
                step={0.05}
                thumbClassName="w-3 h-3 bg-white"
                trackClassName="h-2 rounded-full"
                value={[ms.topP]}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium" htmlFor="top-k">
                  Top K
                </Label>
                <span className="font-mono text-xs text-primary">{ms.topK}</span>
              </div>
              <GradientSlider
                id="top-k"
                max={100}
                min={1}
                onValueChange={(val) => setModelSetting("topK", val[0])}
                step={1}
                thumbClassName="w-3 h-3 bg-white"
                trackClassName="h-2 rounded-full"
                value={[ms.topK]}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium" htmlFor="frequency-penalty">
                  Freq. Penalty
                </Label>
                <span className="font-mono text-xs text-primary">{ms.frequencyPenalty}</span>
              </div>
              <GradientSlider
                id="frequency-penalty"
                max={2}
                min={-2}
                onValueChange={(val) => setModelSetting("frequencyPenalty", val[0])}
                step={0.1}
                thumbClassName="w-3 h-3 bg-white"
                trackClassName="h-2 rounded-full"
                value={[ms.frequencyPenalty]}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium" htmlFor="presence-penalty">
                  Pres. Penalty
                </Label>
                <span className="font-mono text-xs text-primary">{ms.presencePenalty}</span>
              </div>
              <GradientSlider
                id="presence-penalty"
                max={2}
                min={-2}
                onValueChange={(val) => setModelSetting("presencePenalty", val[0])}
                step={0.1}
                thumbClassName="w-3 h-3 bg-white"
                trackClassName="h-2 rounded-full"
                value={[ms.presencePenalty]}
              />
            </div>

            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs font-medium" htmlFor="system-prompt">
                System Prompt
              </Label>
              <Textarea
                className="glass min-h-[60px] resize-none overflow-y-auto text-sm transition-all duration-200 focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
                id="system-prompt"
                placeholder="Custom system instructions..."
                rows={2}
                value={ms.systemPrompt}
                onChange={(e) => setModelSetting("systemPrompt", e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="border-border border-t bg-card/10 px-4 py-3">
          <div className="flex justify-end">
            <GradientButton
              glowIntensity="medium"
              onClick={onClose}
              useThemeGradient
              className="px-4 py-1.5 text-sm"
            >
              Apply
            </GradientButton>
          </div>
        </div>
      </div>
    </div>
  );
}
