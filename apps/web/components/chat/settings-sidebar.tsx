"use client";

import { X } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Label } from "@workspace/ui/components/label";
import { GradientSlider } from "@workspace/ui/components/gradient-slider";
import { Input } from "@workspace/ui/components/input";
import { ScrollArea } from "@workspace/ui/components/scroll-area";
import { useState } from "react";
import { cn } from "@workspace/ui/lib/utils";
import { GradientButton } from "@workspace/ui/components/gradient-button";

interface SettingsSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsSidebar({ isOpen, onClose }: SettingsSidebarProps) {
  const [temperature, setTemperature] = useState([0.7]);
  const [maxTokens, setMaxTokens] = useState([2048]);
  const [topP, setTopP] = useState([0.9]);
  const [frequencyPenalty, setFrequencyPenalty] = useState([0]);
  const [presencePenalty, setPresencePenalty] = useState([0]);

  return (
    <div
      className={cn(
        "fixed right-0 top-0 h-screen w-80 glass-strong border-l border-border z-20 transform transition-all duration-300 ease-out",
        isOpen ? "translate-x-0 opacity-100" : "translate-x-full opacity-0",
      )}
    >
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-semibold font-display">Model Settings</h2>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            className="hover:scale-110 transition-transform duration-200"
          >
            <X className="size-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1 p-4">
          <div className="space-y-6">
            <div className="space-y-2 stagger-item">
              <Label htmlFor="temperature" className="font-display">
                Temperature: {temperature[0]}
              </Label>
              <GradientSlider
                id="temperature"
                min={0}
                max={2}
                step={0.1}
                value={temperature}
                onValueChange={setTemperature}
                trackClassName="h-2.5"
                thumbClassName="w-5 h-5"
              />
              <p className="text-xs text-muted-foreground">
                Controls randomness. Lower values make the output more focused
                and deterministic.
              </p>
            </div>

            <div
              className="space-y-2 stagger-item"
              style={{ animationDelay: "0.05s" }}
            >
              <Label htmlFor="max-tokens" className="font-display">
                Max Tokens: {maxTokens[0]}
              </Label>
              <GradientSlider
                id="max-tokens"
                min={256}
                max={8192}
                step={256}
                value={maxTokens}
                onValueChange={setMaxTokens}
                trackClassName="h-2.5"
                thumbClassName="w-5 h-5"
              />
              <p className="text-xs text-muted-foreground">
                Maximum length of the generated response.
              </p>
            </div>

            <div
              className="space-y-2 stagger-item"
              style={{ animationDelay: "0.1s" }}
            >
              <Label htmlFor="top-p" className="font-display">
                Top P: {topP[0]}
              </Label>
              <GradientSlider
                id="top-p"
                min={0}
                max={1}
                step={0.05}
                value={topP}
                onValueChange={setTopP}
                trackClassName="h-2.5"
                thumbClassName="w-5 h-5"
              />
              <p className="text-xs text-muted-foreground">
                Controls diversity via nucleus sampling.
              </p>
            </div>

            <div
              className="space-y-2 stagger-item"
              style={{ animationDelay: "0.15s" }}
            >
              <Label htmlFor="frequency-penalty" className="font-display">
                Frequency Penalty: {frequencyPenalty[0]}
              </Label>
              <GradientSlider
                id="frequency-penalty"
                min={-2}
                max={2}
                step={0.1}
                value={frequencyPenalty}
                onValueChange={setFrequencyPenalty}
                trackClassName="h-2.5"
                thumbClassName="w-5 h-5"
              />
              <p className="text-xs text-muted-foreground">
                Reduces repetition of tokens based on their frequency.
              </p>
            </div>

            <div
              className="space-y-2 stagger-item"
              style={{ animationDelay: "0.2s" }}
            >
              <Label htmlFor="presence-penalty" className="font-display">
                Presence Penalty: {presencePenalty[0]}
              </Label>
              <GradientSlider
                id="presence-penalty"
                min={-2}
                max={2}
                step={0.1}
                value={presencePenalty}
                onValueChange={setPresencePenalty}
                trackClassName="h-2.5"
                thumbClassName="w-5 h-5"
              />
              <p className="text-xs text-muted-foreground">
                Reduces repetition of topics and ideas.
              </p>
            </div>

            <div
              className="space-y-2 stagger-item"
              style={{ animationDelay: "0.25s" }}
            >
              <Label htmlFor="system-prompt" className="font-display">
                System Prompt
              </Label>
              <Input
                id="system-prompt"
                placeholder="You are a helpful assistant..."
                className="glass transition-all duration-200 focus:border-primary/50"
              />
              <p className="text-xs text-muted-foreground">
                Sets the behavior and personality of the AI.
              </p>
            </div>
          </div>
        </ScrollArea>

        <div className="p-4 border-t border-border">
          <GradientButton
            width="full"
            height={10}
            useThemeGradient
            glowIntensity="medium"
            onClick={onClose}
          >
            Apply Settings
          </GradientButton>
        </div>
      </div>
    </div>
  );
}
