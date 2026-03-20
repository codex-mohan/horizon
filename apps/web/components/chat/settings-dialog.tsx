"use client";

import { Badge } from "@horizon/ui/components/badge";
import { Button } from "@horizon/ui/components/button";
import { GradientSlider } from "@horizon/ui/components/gradient-slider";
import { Separator } from "@horizon/ui/components/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@horizon/ui/components/tabs";
import { Cpu, Info, Settings2, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { useAuthStore } from "@/lib/stores/auth";
import { useChatSettings } from "@/lib/stores/chat-settings";
import { useModelConfig } from "@/lib/stores/model-config";
import { PrivacyToggle } from "../settings/privacy-toggle";

interface ParameterSliderProps {
  label: string;
  description: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  formatValue: (value: number) => string;
}

function ParameterSlider({
  label,
  description,
  value,
  min,
  max,
  step,
  onChange,
  formatValue,
}: ParameterSliderProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-medium">{label}</span>
          <p className="text-muted-foreground text-xs">{description}</p>
        </div>
        <span className="rounded-lg bg-[var(--gradient-from)]/20 px-2 py-1 font-mono text-xs font-medium text-[var(--gradient-to)]">
          {formatValue(value)}
        </span>
      </div>
      <GradientSlider
        max={max}
        min={min}
        onValueChange={(val) => onChange(val[0])}
        step={step}
        thumbClassName="w-4 h-4"
        trackClassName="h-2 rounded-full"
        value={[value]}
      />
    </div>
  );
}

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const PARAMETER_PRESETS = [
  { label: "Precise", icon: "🎯", settings: { temperature: 0.2, topP: 0.8, topK: 20 } },
  { label: "Balanced", icon: "的天", settings: { temperature: 0.7, topP: 0.9, topK: 50 } },
  { label: "Creative", icon: "✨", settings: { temperature: 1.2, topP: 0.95, topK: 100 } },
];

export function SettingsDialog({ isOpen, onClose }: SettingsDialogProps) {
  const { settings, setModelSetting } = useChatSettings();
  const { user } = useAuthStore();
  const { config } = useModelConfig();

  const ms = settings.modelSettings || {
    temperature: 0.7,
    maxTokens: 2048,
    topP: 0.9,
    topK: 50,
    frequencyPenalty: 0,
    presencePenalty: 0,
    systemPrompt: "",
  };

  const applyPreset = (preset: (typeof PARAMETER_PRESETS)[number]) => {
    setModelSetting("temperature", preset.settings.temperature);
    setModelSetting("topP", preset.settings.topP);
    setModelSetting("topK", preset.settings.topK);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <>
      <button
        className="fixed inset-0 z-50 cursor-default animate-in fade-in-0 duration-200"
        onClick={onClose}
        type="button"
        aria-label="Close settings"
      >
        <div className="absolute inset-0 bg-black/50 backdrop-blur-xl" />
      </button>

      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 lg:p-8 animate-in zoom-in-95 duration-200">
        <div className="glass-strong relative flex h-[85vh] max-h-[600px] w-[90vw] max-w-lg flex-col overflow-hidden rounded-2xl border border-[var(--gradient-from)]/20 shadow-2xl">
          {/* Header */}
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--gradient-from)]/10 bg-gradient-to-b from-[var(--gradient-from)]/5 to-transparent px-5">
            <div className="flex items-center gap-3">
              <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--gradient-from)] to-[var(--gradient-to)]">
                <Settings2 className="size-4 text-white" />
              </div>
              <div>
                <h2 className="font-display text-sm font-semibold">Settings</h2>
                <p className="text-muted-foreground text-xs">
                  Configure your model and preferences
                </p>
              </div>
            </div>
            <Button
              className="size-8 rounded-lg hover:bg-[var(--gradient-from)]/20"
              onClick={onClose}
              size="icon-sm"
              variant="ghost"
            >
              <X className="size-4" />
            </Button>
          </div>

          {/* Tabs */}
          <Tabs className="flex min-h-0 shrink-0 flex-col flex-1" defaultValue="model">
            <TabsList className="mx-5 mt-3 shrink-0 grid w-auto grid-cols-3 gap-1 rounded-xl border border-[var(--gradient-from)]/20 bg-[var(--gradient-from)]/10 p-1">
              <TabsTrigger
                className="rounded-lg text-xs font-medium transition-colors duration-150 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--gradient-from)]/60 data-[state=active]:to-[var(--gradient-to)]/60 data-[state=active]:text-white data-[state=active]:shadow-sm"
                value="model"
              >
                <Cpu className="mr-1.5 size-3.5" />
                Model
              </TabsTrigger>
              <TabsTrigger
                className="rounded-lg text-xs font-medium transition-colors duration-150 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--gradient-from)]/60 data-[state=active]:to-[var(--gradient-to)]/60 data-[state=active]:text-white data-[state=active]:shadow-sm"
                value="parameters"
              >
                <SlidersHorizontal className="mr-1.5 size-3.5" />
                Parameters
              </TabsTrigger>
              <TabsTrigger
                className="rounded-lg text-xs font-medium transition-colors duration-150 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--gradient-from)]/60 data-[state=active]:to-[var(--gradient-to)]/60 data-[state=active]:text-white data-[state=active]:shadow-sm"
                value="privacy"
              >
                <Sparkles className="mr-1.5 size-3.5" />
                Privacy
              </TabsTrigger>
            </TabsList>

            {/* Scrollable Content */}
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[var(--gradient-from)]/30 hover:[&::-webkit-scrollbar-thumb]:bg-[var(--gradient-from)]/50">
              <TabsContent className="mt-0 animate-in fade-in-0 duration-150" value="model">
                <div className="space-y-4">
                  <div className="rounded-xl border border-[var(--gradient-from)]/20 bg-gradient-to-br from-[var(--gradient-from)]/10 to-[var(--gradient-to)]/10 p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <span className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                        Current Model
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{config.modelName || "Not selected"}</p>
                        <p className="text-muted-foreground text-xs capitalize">
                          {config.provider || "No provider"} provider
                        </p>
                      </div>
                      <Badge
                        className="rounded-full bg-gradient-to-r from-[var(--gradient-from)] to-[var(--gradient-to)] text-xs font-medium text-white"
                        variant="secondary"
                      >
                        Active
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label
                      className="text-xs font-medium text-muted-foreground uppercase tracking-wider"
                      htmlFor="system-prompt"
                    >
                      System Prompt
                    </label>
                    <textarea
                      className="min-h-[80px] w-full resize-none rounded-xl border border-[var(--gradient-from)]/20 bg-[var(--gradient-from)]/5 p-3 text-sm outline-none transition-all placeholder:text-muted-foreground/50 focus:border-[var(--gradient-from)]/50 focus:ring-1 focus:ring-[var(--gradient-from)]/20"
                      id="system-prompt"
                      placeholder="Enter custom instructions for the AI assistant..."
                      value={ms.systemPrompt}
                      onChange={(e) => setModelSetting("systemPrompt", e.target.value)}
                    />
                    <p className="text-muted-foreground text-xs">
                      Define the AI&apos;s personality and behavior guidelines.
                    </p>
                  </div>

                  <div className="flex items-start gap-3 rounded-xl border border-[var(--gradient-from)]/30 bg-[var(--gradient-from)]/10 p-4">
                    <Info className="mt-0.5 size-4 shrink-0 text-[var(--gradient-from)]" />
                    <div className="space-y-1">
                      <p className="text-xs font-medium">Configuration Tips</p>
                      <p className="text-muted-foreground text-xs">
                        Settings are saved automatically and persist across sessions.
                      </p>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent className="mt-0 animate-in fade-in-0 duration-150" value="parameters">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Quick Presets
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      {PARAMETER_PRESETS.map((preset) => (
                        <button
                          key={preset.label}
                          className="flex flex-col items-center gap-1 rounded-xl border border-[var(--gradient-from)]/20 bg-[var(--gradient-from)]/5 p-3 text-center transition-all hover:border-[var(--gradient-from)]/40 hover:bg-[var(--gradient-from)]/10"
                          onClick={() => applyPreset(preset)}
                          type="button"
                        >
                          <span className="text-lg">{preset.icon}</span>
                          <span className="text-xs font-medium">{preset.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <Separator className="bg-[var(--gradient-from)]/10" />

                  <div className="space-y-3">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Generation Parameters
                    </span>

                    <ParameterSlider
                      label="Temperature"
                      description="Controls randomness"
                      value={ms.temperature}
                      min={0}
                      max={2}
                      step={0.1}
                      onChange={(val) => setModelSetting("temperature", val)}
                      formatValue={(v) => v.toFixed(1)}
                    />

                    <ParameterSlider
                      label="Max Tokens"
                      description="Maximum response length"
                      value={ms.maxTokens}
                      min={256}
                      max={131072}
                      step={256}
                      onChange={(val) => setModelSetting("maxTokens", val)}
                      formatValue={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toString())}
                    />

                    <ParameterSlider
                      label="Top P"
                      description="Nucleus sampling"
                      value={ms.topP}
                      min={0}
                      max={1}
                      step={0.05}
                      onChange={(val) => setModelSetting("topP", val)}
                      formatValue={(v) => v.toFixed(2)}
                    />

                    <ParameterSlider
                      label="Top K"
                      description="Vocabulary limit"
                      value={ms.topK}
                      min={1}
                      max={100}
                      step={1}
                      onChange={(val) => setModelSetting("topK", val)}
                      formatValue={(v) => v.toString()}
                    />
                  </div>

                  <Separator className="bg-[var(--gradient-from)]/10" />

                  <div className="space-y-3">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Repetition Control
                    </span>

                    <ParameterSlider
                      label="Frequency Penalty"
                      description="Reduces token repetition"
                      value={ms.frequencyPenalty}
                      min={-2}
                      max={2}
                      step={0.1}
                      onChange={(val) => setModelSetting("frequencyPenalty", val)}
                      formatValue={(v) => v.toFixed(1)}
                    />

                    <ParameterSlider
                      label="Presence Penalty"
                      description="Encourages topic diversity"
                      value={ms.presencePenalty}
                      min={-2}
                      max={2}
                      step={0.1}
                      onChange={(val) => setModelSetting("presencePenalty", val)}
                      formatValue={(v) => v.toFixed(1)}
                    />
                  </div>

                  <Button
                    className="w-full rounded-xl border border-[var(--gradient-from)]/20 bg-[var(--gradient-from)]/5 text-xs hover:bg-[var(--gradient-from)]/10"
                    onClick={() => {
                      setModelSetting("temperature", 0.7);
                      setModelSetting("maxTokens", 2048);
                      setModelSetting("topP", 0.9);
                      setModelSetting("topK", 50);
                      setModelSetting("frequencyPenalty", 0);
                      setModelSetting("presencePenalty", 0);
                    }}
                    variant="ghost"
                  >
                    Reset to Defaults
                  </Button>
                </div>
              </TabsContent>

              <TabsContent className="mt-0 animate-in fade-in-0 duration-150" value="privacy">
                {user?.id ? (
                  <PrivacyToggle userId={user.id} />
                ) : (
                  <div className="flex items-center justify-center py-8">
                    <p className="text-muted-foreground text-sm">
                      Sign in to manage privacy settings
                    </p>
                  </div>
                )}
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </>
  );
}
