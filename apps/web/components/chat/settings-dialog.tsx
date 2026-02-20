"use client";

import { Button } from "@workspace/ui/components/button";
import { GradientButton } from "@workspace/ui/components/gradient-button";
import { GradientSlider } from "@workspace/ui/components/gradient-slider";
import { Textarea } from "@workspace/ui/components/textarea";
import { Label } from "@workspace/ui/components/label";
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
        "fixed inset-0 z-50 flex items-start justify-center bg-background/80 pt-[5vh] backdrop-blur-sm transition-all duration-300 ease-out",
        isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      )}
    >
      <div className="absolute inset-0" onClick={onClose} />

      <div
        className={cn(
          "glass-strong relative z-10 flex w-[90vw] max-w-3xl flex-col overflow-hidden rounded-2xl border-border shadow-2xl transition-all duration-300 ease-out max-h-[90vh]",
          isOpen ? "scale-100 translate-y-0 opacity-100" : "scale-95 -translate-y-8 opacity-0"
        )}
      >
        <div className="flex items-center justify-between border-border border-b bg-card/50 p-5">
          <div className="flex items-center gap-3">
            <h2 className="font-display text-lg font-semibold tracking-tight">Model Configuration</h2>
          </div>
          <Button
            className="transition-transform duration-200 hover:scale-110"
            onClick={onClose}
            size="icon-sm"
            variant="ghost"
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-6 pb-4 lg:p-8 lg:pb-4">
          <div className="grid grid-cols-1 gap-x-12 gap-y-8 md:grid-cols-2">
            <div className="stagger-item space-y-3">
              <div className="flex items-center justify-between">
                <Label className="font-display text-sm font-medium" htmlFor="temperature">
                  Temperature
                </Label>
                <span className="font-mono text-sm text-primary">{ms.temperature}</span>
              </div>
              <GradientSlider
                id="temperature"
                max={2}
                min={0}
                onValueChange={(val) => setModelSetting("temperature", val[0])}
                step={0.1}
                thumbClassName="w-4 h-4 bg-white"
                trackClassName="h-3 rounded-full"
                value={[ms.temperature]}
              />
              <p className="text-muted-foreground text-xs leading-relaxed">
                Controls randomness. Lower values make the output more focused and deterministic.
              </p>
            </div>

            <div className="stagger-item space-y-3" style={{ animationDelay: "0.05s" }}>
              <div className="flex items-center justify-between">
                <Label className="font-display text-sm font-medium" htmlFor="max-tokens">
                  Max Tokens
                </Label>
                <span className="font-mono text-sm text-primary">{ms.maxTokens}</span>
              </div>
              <GradientSlider
                id="max-tokens"
                max={8192}
                min={256}
                onValueChange={(val) => setModelSetting("maxTokens", val[0])}
                step={256}
                thumbClassName="w-4 h-4 bg-white"
                trackClassName="h-3 rounded-full"
                value={[ms.maxTokens]}
              />
              <p className="text-muted-foreground text-xs leading-relaxed">
                Maximum length of the generated response.
              </p>
            </div>

            <div className="stagger-item space-y-3" style={{ animationDelay: "0.1s" }}>
              <div className="flex items-center justify-between">
                <Label className="font-display text-sm font-medium" htmlFor="top-p">
                  Top P
                </Label>
                <span className="font-mono text-sm text-primary">{ms.topP}</span>
              </div>
              <GradientSlider
                id="top-p"
                max={1}
                min={0}
                onValueChange={(val) => setModelSetting("topP", val[0])}
                step={0.05}
                thumbClassName="w-4 h-4 bg-white"
                trackClassName="h-3 rounded-full"
                value={[ms.topP]}
              />
              <p className="text-muted-foreground text-xs leading-relaxed">
                Controls diversity via nucleus sampling.
              </p>
            </div>

            <div className="stagger-item space-y-3" style={{ animationDelay: "0.15s" }}>
              <div className="flex items-center justify-between">
                <Label className="font-display text-sm font-medium" htmlFor="top-k">
                  Top K
                </Label>
                <span className="font-mono text-sm text-primary">{ms.topK}</span>
              </div>
              <GradientSlider
                id="top-k"
                max={100}
                min={1}
                onValueChange={(val) => setModelSetting("topK", val[0])}
                step={1}
                thumbClassName="w-4 h-4 bg-white"
                trackClassName="h-3 rounded-full"
                value={[ms.topK]}
              />
              <p className="text-muted-foreground text-xs leading-relaxed">
                Only sample from the top K vocabulary tokens.
              </p>
            </div>

            <div className="stagger-item space-y-3" style={{ animationDelay: "0.2s" }}>
              <div className="flex items-center justify-between">
                <Label className="font-display text-sm font-medium" htmlFor="frequency-penalty">
                  Frequency Penalty
                </Label>
                <span className="font-mono text-sm text-primary">{ms.frequencyPenalty}</span>
              </div>
              <GradientSlider
                id="frequency-penalty"
                max={2}
                min={-2}
                onValueChange={(val) => setModelSetting("frequencyPenalty", val[0])}
                step={0.1}
                thumbClassName="w-4 h-4 bg-white"
                trackClassName="h-3 rounded-full"
                value={[ms.frequencyPenalty]}
              />
              <p className="text-muted-foreground text-xs leading-relaxed">
                Reduces repetition of tokens based on their frequency.
              </p>
            </div>

            <div className="stagger-item space-y-3" style={{ animationDelay: "0.25s" }}>
              <div className="flex items-center justify-between">
                <Label className="font-display text-sm font-medium" htmlFor="presence-penalty">
                  Presence Penalty
                </Label>
                <span className="font-mono text-sm text-primary">{ms.presencePenalty}</span>
              </div>
              <GradientSlider
                id="presence-penalty"
                max={2}
                min={-2}
                onValueChange={(val) => setModelSetting("presencePenalty", val[0])}
                step={0.1}
                thumbClassName="w-4 h-4 bg-white"
                trackClassName="h-3 rounded-full"
                value={[ms.presencePenalty]}
              />
              <p className="text-muted-foreground text-xs leading-relaxed">
                Reduces repetition of topics and ideas.
              </p>
            </div>

            <div className="stagger-item md:col-span-2 space-y-3" style={{ animationDelay: "0.3s" }}>
              <Label className="font-display text-sm font-medium" htmlFor="system-prompt">
                System Prompt Template Override
              </Label>
              <Textarea
                className="glass min-h-[120px] resize-none overflow-y-auto transition-all duration-200 focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
                id="system-prompt"
                placeholder="Append custom system instructions here (e.g. You are an expert in Physics...)"
                rows={4}
                value={ms.systemPrompt}
                onChange={(e) => setModelSetting("systemPrompt", e.target.value)}
              />
              <p className="text-muted-foreground text-xs leading-relaxed">
                These instructions are appended to the core backend agent template.
              </p>
            </div>
          </div>
        </div>

        <div className="border-border border-t bg-card/10 p-5">
          <div className="flex justify-end">
            <GradientButton
              glowIntensity="medium"
              onClick={onClose}
              useThemeGradient
              className="px-8"
            >
              Apply configuration
            </GradientButton>
          </div>
        </div>
      </div>
    </div>
  );
}
