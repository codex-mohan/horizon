"use client";

import { Button } from "@horizon/ui/components/button";
import { GlassProgress } from "@horizon/ui/components/glass-progress";
import { GradientButton } from "@horizon/ui/components/gradient-button";
import { Input } from "@horizon/ui/components/input";
import { Label } from "@horizon/ui/components/label";
import { ScrollArea } from "@horizon/ui/components/scroll-area";
import { Switch } from "@horizon/ui/components/switch";
import { cn } from "@horizon/ui/lib/utils";
import {
  AlertCircle,
  Brain,
  Check,
  ChevronDown,
  ChevronUp,
  Cpu,
  Download,
  Eye,
  EyeOff,
  Globe,
  Key,
  Loader2,
  RefreshCcw,
  Settings2,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import { memo, useEffect, useState } from "react";
import {
  DEFAULT_MODELS,
  type ModelProvider,
  PROVIDER_INFO,
  type ProviderConfig,
  useModelConfig,
} from "@/lib/stores/model-config";
import { useOllamaStore } from "@/lib/stores/ollama-store";

export interface ProviderConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ProviderIcon = ({ provider, className }: { provider: ModelProvider; className?: string }) => {
  const icons: Record<ModelProvider, React.ReactNode> = {
    nvidia_nim: <Sparkles className={className} />,
    openai: <Zap className={className} />,
    anthropic: <Brain className={className} />,
    groq: <Cpu className={className} />,
    google: <Globe className={className} />,
    ollama: <Cpu className={className} />,
  };
  return <>{icons[provider]}</>;
};

interface ProviderCardProps {
  provider: ModelProvider;
  config: ProviderConfig;
  isSelected: boolean;
  onSelect: () => void;
  onToggleEnabled: (enabled: boolean) => void;
  onApiKeyChange: (apiKey: string) => void;
  onBaseUrlChange: (baseUrl: string | undefined) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  dynamicModelCount?: number;
}

const ProviderCard = memo(function ProviderCard({
  provider,
  config,
  isSelected,
  onSelect,
  onToggleEnabled,
  onApiKeyChange,
  onBaseUrlChange,
  isExpanded,
  onToggleExpand,
  dynamicModelCount,
}: ProviderCardProps) {
  const info = PROVIDER_INFO[provider];
  const [showApiKey, setShowApiKey] = useState(false);
  const isConfigured = !info.requiresApiKey || (config?.apiKey && config.apiKey.length > 0);

  return (
    <div
      className={cn(
        "rounded-lg border transition-all duration-200",
        isSelected ? "border-primary/50 bg-primary/5" : "border-border/50",
        config?.enabled && isConfigured && "bg-emerald-500/5"
      )}
    >
      <div className="flex items-center justify-between p-3">
        <button
          className="flex flex-1 items-center gap-3 text-left"
          onClick={onSelect}
          type="button"
        >
          <div
            className={cn(
              "flex size-8 items-center justify-center rounded-lg",
              isSelected ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
            )}
          >
            <ProviderIcon className="size-4" provider={provider} />
          </div>
          <div className="flex flex-col">
            <span className="font-medium text-sm">{info.name}</span>
            <span className="text-muted-foreground text-xs">
              {config?.enabled ? (isConfigured ? "Configured" : "API key required") : "Disabled"}
            </span>
          </div>
        </button>

        <div className="flex items-center gap-2">
          {config?.enabled && isConfigured && <Check className="size-4 text-emerald-500" />}
          <Switch checked={config?.enabled} onCheckedChange={onToggleEnabled} />
        </div>
      </div>

      {config.enabled && (
        <>
          <button
            className="flex w-full items-center justify-between border-t px-3 py-2 text-muted-foreground text-xs hover:bg-muted/50"
            onClick={onToggleExpand}
            type="button"
          >
            <span>Configuration</span>
            {isExpanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
          </button>

          {isExpanded && (
            <div className="space-y-3 border-t p-3">
              {info.requiresApiKey && (
                <div className="space-y-1.5">
                  <Label className="text-xs" htmlFor={`${provider}-api-key`}>
                    API Key
                  </Label>
                  <div className="relative">
                    <Input
                      className="pr-9"
                      id={`${provider}-api-key`}
                      onChange={(e) => onApiKeyChange(e.target.value)}
                      placeholder={`Enter your ${info.name} API key`}
                      type={showApiKey ? "text" : "password"}
                      value={config?.apiKey || ""}
                    />
                    <button
                      className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowApiKey(!showApiKey)}
                      type="button"
                    >
                      {showApiKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  {!config.apiKey && (
                    <p className="flex items-center gap-1 text-amber-500 text-xs">
                      <AlertCircle className="size-3" />
                      API key required for this provider
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs" htmlFor={`${provider}-base-url`}>
                  Base URL
                  <span className="ml-1 text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  className="text-xs"
                  id={`${provider}-base-url`}
                  onChange={(e) => {
                    const value = e.target.value;
                    onBaseUrlChange(value === "" ? undefined : value);
                  }}
                  placeholder={
                    provider === "ollama"
                      ? "http://localhost:11434"
                      : provider === "nvidia_nim"
                        ? "https://integrate.api.nvidia.com/v1"
                        : "Custom endpoint URL"
                  }
                  value={config?.baseUrl || ""}
                />
              </div>

              <div className="rounded-md bg-muted/50 p-2">
                <p className="text-muted-foreground text-xs">
                  Available models: {dynamicModelCount ?? DEFAULT_MODELS[provider].length} models
                </p>
                <p className="mt-1 text-muted-foreground text-xs">
                  Supports reasoning: {info.supportsReasoning ? "Yes" : "No"}
                </p>
              </div>

              {provider === "ollama" && <OllamaModelsSection baseUrl={config.baseUrl} />}
            </div>
          )}
        </>
      )}
    </div>
  );
});

export const ProviderConfigDialog = memo(function ProviderConfigDialog({
  open,
  onOpenChange,
}: ProviderConfigDialogProps) {
  const { config, setProvider, setProviderApiKey, setProviderBaseUrl, setProviderEnabled } =
    useModelConfig();
  const { models: ollamaModels } = useOllamaStore();
  const [expandedProviders, setExpandedProviders] = useState<Set<ModelProvider>>(new Set());

  const toggleProviderExpand = (provider: ModelProvider) => {
    const newExpanded = new Set(expandedProviders);
    if (newExpanded.has(provider)) {
      newExpanded.delete(provider);
    } else {
      newExpanded.add(provider);
    }
    setExpandedProviders(newExpanded);
  };

  const handleSelectProvider = (provider: ModelProvider) => {
    setProvider(provider);
    if (!expandedProviders.has(provider)) {
      toggleProviderExpand(provider);
    }
  };

  if (!open) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-100 flex items-center justify-center bg-background/80 backdrop-blur-sm transition-all duration-300 ease-out",
        open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      )}
    >
      <div className="absolute inset-0" onClick={() => onOpenChange(false)} />

      <div
        className={cn(
          "glass-strong relative z-10 flex w-[90vw] max-w-[500px] h-[600px] flex-col overflow-hidden rounded-xl border-border shadow-2xl transition-all duration-300 ease-out max-h-[85vh]",
          open ? "scale-100 translate-y-0 opacity-100" : "scale-95 -translate-y-8 opacity-0"
        )}
      >
        <div className="flex items-center justify-between border-border border-b bg-card/50 px-6 py-4">
          <div className="flex items-center gap-2">
            <Settings2 className="size-5" />
            <h2 className="font-display text-sm font-semibold">Provider Configuration</h2>
          </div>
          <Button
            className="transition-transform duration-200 hover:scale-110"
            onClick={() => onOpenChange(false)}
            size="icon-sm"
            variant="ghost"
          >
            <X className="size-4" />
          </Button>
        </div>

        <p className="border-border border-b bg-card/30 px-6 py-2 text-muted-foreground text-xs">
          Configure your AI model providers and settings. Add API keys to enable providers.
        </p>

        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="space-y-3 p-6">
            <p className="text-muted-foreground text-sm">
              Select a provider and expand it to configure API keys and custom settings.
            </p>

            {(Object.keys(PROVIDER_INFO) as ModelProvider[]).map((provider) => (
              <ProviderCard
                config={config.providers[provider]}
                isExpanded={expandedProviders.has(provider)}
                isSelected={config.provider === provider}
                key={provider}
                dynamicModelCount={provider === "ollama" ? ollamaModels.length : undefined}
                onApiKeyChange={(key) => setProviderApiKey(provider, key)}
                onBaseUrlChange={(url) => setProviderBaseUrl(provider, url)}
                onToggleEnabled={(enabled) => setProviderEnabled(provider, enabled)}
                onToggleExpand={() => toggleProviderExpand(provider)}
                onSelect={() => handleSelectProvider(provider)}
                provider={provider}
              />
            ))}
          </div>
        </ScrollArea>

        <div className="border-t bg-card/10 px-6 py-4">
          <div className="flex w-full items-center justify-between">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <Key className="size-3" />
              <span>API keys are stored locally in your browser</span>
            </div>
            <Button onClick={() => onOpenChange(false)} size="sm">
              Done
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
});

interface OllamaModelsSectionProps {
  baseUrl?: string;
}

const OllamaModelsSection = memo(function OllamaModelsSection({
  baseUrl,
}: OllamaModelsSectionProps) {
  const {
    models,
    isLoadingModels,
    modelsError,
    pullProgress,
    isPulling,
    pullError,
    pullComplete,
    fetchModels,
    pullModel,
    clearPullState,
  } = useOllamaStore();
  const [pullModelName, setPullModelName] = useState("");

  useEffect(() => {
    if (baseUrl) {
      fetchModels(`/api/ollama?baseUrl=${encodeURIComponent(baseUrl)}`);
    } else {
      fetchModels();
    }
  }, [baseUrl, fetchModels]);

  const handlePull = async () => {
    if (!pullModelName.trim()) return;
    const url = baseUrl ? `/api/ollama?baseUrl=${encodeURIComponent(baseUrl)}` : undefined;
    await pullModel(pullModelName.trim(), url);
  };

  const progressPercent = pullProgress?.total
    ? Math.round(((pullProgress.completed || 0) / pullProgress.total) * 100)
    : 0;

  return (
    <div className="space-y-3 border-t pt-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs">Installed Models</Label>
        <Button
          className="h-6 px-2 text-xs"
          onClick={() => {
            const url = baseUrl ? `/api/ollama?baseUrl=${encodeURIComponent(baseUrl)}` : undefined;
            fetchModels(url);
          }}
          size="sm"
          variant="ghost"
        >
          <RefreshCcw className={cn("mr-1 size-3", isLoadingModels && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {isLoadingModels ? (
        <div className="flex items-center gap-2 text-muted-foreground text-xs">
          <Loader2 className="size-3 animate-spin" />
          Loading models...
        </div>
      ) : modelsError ? (
        <p className="text-amber-500 text-xs">{modelsError}</p>
      ) : models.length === 0 ? (
        <p className="text-muted-foreground text-xs">No models installed</p>
      ) : (
        <div className="max-h-24 space-y-1 overflow-y-auto rounded-md bg-muted/30 p-2">
          {models.map((model) => (
            <div className="flex items-center gap-2 text-xs" key={model}>
              <Check className="size-3 text-emerald-500" />
              <span className="truncate">{model}</span>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <Label className="text-xs" htmlFor="pull-model">
          Pull New Model
        </Label>
        <div className="flex gap-2">
          <Input
            className="h-7 text-xs"
            id="pull-model"
            onChange={(e) => setPullModelName(e.target.value)}
            placeholder="e.g., llama3.2:latest"
            value={pullModelName}
          />
          <GradientButton
            className="h-7 px-3"
            disabled={!pullModelName.trim() || isPulling}
            height={7}
            onClick={handlePull}
            width={12}
          >
            {isPulling ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Download className="size-3" />
            )}
          </GradientButton>
        </div>
        {isPulling && pullProgress && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground truncate">{pullProgress.status}</span>
              <span className="text-muted-foreground">{progressPercent}%</span>
            </div>
            <GlassProgress className="h-1" value={progressPercent} />
          </div>
        )}
        {pullError && <p className="text-amber-500 text-xs">{pullError}</p>}
        {pullComplete && <p className="text-emerald-500 text-xs">Model pulled successfully!</p>}
        {(pullComplete || pullError) && (
          <Button className="text-xs" onClick={clearPullState} variant="ghost">
            Dismiss
          </Button>
        )}
      </div>
    </div>
  );
});
