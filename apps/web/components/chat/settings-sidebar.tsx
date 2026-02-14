"use client";

import { Button } from "@workspace/ui/components/button";
import { GradientButton } from "@workspace/ui/components/gradient-button";
import { GradientSlider } from "@workspace/ui/components/gradient-slider";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { ScrollArea } from "@workspace/ui/components/scroll-area";
import { cn } from "@workspace/ui/lib/utils";
import { X } from "lucide-react";
import { useState } from "react";

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
        "glass-strong fixed top-0 right-0 z-20 h-screen w-80 transform border-border border-l transition-all duration-300 ease-out",
        isOpen ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"
      )}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-border border-b p-4">
          <h2 className="font-display font-semibold">Model Settings</h2>
          <Button
            className="transition-transform duration-200 hover:scale-110"
            onClick={onClose}
            size="icon-sm"
            variant="ghost"
          >
            <X className="size-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1 p-4">
          <div className="space-y-6">
            <div className="stagger-item space-y-2">
              <Label className="font-display" htmlFor="temperature">
                Temperature: {temperature[0]}
              </Label>
              <GradientSlider
                id="temperature"
                max={2}
                min={0}
                onValueChange={setTemperature}
                step={0.1}
                thumbClassName="w-5 h-5"
                trackClassName="h-2.5"
                value={temperature}
              />
              <p className="text-muted-foreground text-xs">
                Controls randomness. Lower values make the output more focused
                and deterministic.
              </p>
            </div>

            <div
              className="stagger-item space-y-2"
              style={{ animationDelay: "0.05s" }}
            >
              <Label className="font-display" htmlFor="max-tokens">
                Max Tokens: {maxTokens[0]}
              </Label>
              <GradientSlider
                id="max-tokens"
                max={8192}
                min={256}
                onValueChange={setMaxTokens}
                step={256}
                thumbClassName="w-5 h-5"
                trackClassName="h-2.5"
                value={maxTokens}
              />
              <p className="text-muted-foreground text-xs">
                Maximum length of the generated response.
              </p>
            </div>

            <div
              className="stagger-item space-y-2"
              style={{ animationDelay: "0.1s" }}
            >
              <Label className="font-display" htmlFor="top-p">
                Top P: {topP[0]}
              </Label>
              <GradientSlider
                id="top-p"
                max={1}
                min={0}
                onValueChange={setTopP}
                step={0.05}
                thumbClassName="w-5 h-5"
                trackClassName="h-2.5"
                value={topP}
              />
              <p className="text-muted-foreground text-xs">
                Controls diversity via nucleus sampling.
              </p>
            </div>

            <div
              className="stagger-item space-y-2"
              style={{ animationDelay: "0.15s" }}
            >
              <Label className="font-display" htmlFor="frequency-penalty">
                Frequency Penalty: {frequencyPenalty[0]}
              </Label>
              <GradientSlider
                id="frequency-penalty"
                max={2}
                min={-2}
                onValueChange={setFrequencyPenalty}
                step={0.1}
                thumbClassName="w-5 h-5"
                trackClassName="h-2.5"
                value={frequencyPenalty}
              />
              <p className="text-muted-foreground text-xs">
                Reduces repetition of tokens based on their frequency.
              </p>
            </div>

            <div
              className="stagger-item space-y-2"
              style={{ animationDelay: "0.2s" }}
            >
              <Label className="font-display" htmlFor="presence-penalty">
                Presence Penalty: {presencePenalty[0]}
              </Label>
              <GradientSlider
                id="presence-penalty"
                max={2}
                min={-2}
                onValueChange={setPresencePenalty}
                step={0.1}
                thumbClassName="w-5 h-5"
                trackClassName="h-2.5"
                value={presencePenalty}
              />
              <p className="text-muted-foreground text-xs">
                Reduces repetition of topics and ideas.
              </p>
            </div>

            <div
              className="stagger-item space-y-2"
              style={{ animationDelay: "0.25s" }}
            >
              <Label className="font-display" htmlFor="system-prompt">
                System Prompt
              </Label>
              <Input
                className="glass transition-all duration-200 focus:border-primary/50"
                id="system-prompt"
                placeholder="You are a helpful assistant..."
              />
              <p className="text-muted-foreground text-xs">
                Sets the behavior and personality of the AI.
              </p>
            </div>
          </div>
        </ScrollArea>

        <div className="border-border border-t p-4">
          <GradientButton
            glowIntensity="medium"
            height={10}
            onClick={onClose}
            useThemeGradient
            width="full"
          >
            Apply Settings
          </GradientButton>
        </div>
      </div>
    </div>
  );
}
