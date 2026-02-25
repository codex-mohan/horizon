"use client";

import { Button } from "@workspace/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { Switch } from "@workspace/ui/components/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip";
import { cn } from "@workspace/ui/lib/utils";
import { Brain, ChevronDown, Cpu, Settings2, Sparkles, Zap } from "lucide-react";
import { memo, useState } from "react";
import {
  DEFAULT_MODELS,
  type ModelProvider,
  PROVIDER_INFO,
  REASONING_MODELS,
  supportsReasoning,
  useModelConfig,
} from "@/lib/stores/model-config";

export interface ModelSelectorProps {
  onOpenSettings?: () => void;
  compact?: boolean;
}

const ProviderIcon = ({ provider, className }: { provider: ModelProvider; className?: string }) => {
  const icons: Record<ModelProvider, React.ReactNode> = {
    nvidia_nim: <Sparkles className={className} />,
    openai: <Zap className={className} />,
    anthropic: <Brain className={className} />,
    groq: <Cpu className={className} />,
    google: <Sparkles className={className} />,
    ollama: <Cpu className={className} />,
  };
  return <>{icons[provider]}</>;
};

function getModelDisplayName(modelName: string): string {
  const parts = modelName.split("/");
  const name = parts.length > 1 ? parts[parts.length - 1] : modelName;
  return name.replace(/-/g, " ").replace(/(\d+)/g, " $1").trim();
}

export const ModelSelector = memo(function ModelSelector({
  onOpenSettings,
  compact = false,
}: ModelSelectorProps) {
  const { config, setProvider, setModelName, setEnableReasoning } = useModelConfig();
  const [isOpen, setIsOpen] = useState(false);

  const currentProviderInfo = PROVIDER_INFO[config.provider];
  const modelSupportsReasoning = supportsReasoning(config.modelName, config.provider);

  const handleProviderSelect = (provider: ModelProvider) => {
    setProvider(provider);
  };

  const handleModelSelect = (model: string) => {
    setModelName(model);
  };

  const displayModelName = getModelDisplayName(config.modelName);

  return (
    <DropdownMenu onOpenChange={setIsOpen}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                className={cn(
                  "h-7 gap-1.5 text-xs transition-all duration-200",
                  compact ? "px-2" : "px-3",
                  isOpen && "ring-2 ring-primary/50"
                )}
                size="sm"
                variant="ghost"
              >
                <ProviderIcon className="size-3.5" provider={config.provider} />
                {!compact && (
                  <>
                    <span className="max-w-[120px] truncate">{displayModelName}</span>
                    {config.enableReasoning && modelSupportsReasoning && (
                      <Brain className="size-3 text-primary" />
                    )}
                  </>
                )}
                <ChevronDown
                  className={cn("size-3 opacity-50 transition-transform", isOpen && "rotate-180")}
                />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent className="z-[100] animate-scale-in" side="top">
            <p>
              {currentProviderInfo.name}: {config.modelName}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <DropdownMenuContent align="end" className="z-[100] w-72 animate-scale-in">
        <DropdownMenuLabel className="flex items-center gap-2 text-xs">
          <Cpu className="size-3.5" />
          Select Provider & Model
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="flex items-center gap-2">
            <ProviderIcon className="size-4" provider={config.provider} />
            <span>Provider: {currentProviderInfo.name}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="z-[110] min-w-[160px]" sideOffset={8}>
            {(Object.keys(PROVIDER_INFO) as ModelProvider[]).map((provider) => {
              const info = PROVIDER_INFO[provider];
              const isSelected = config.provider === provider;
              return (
                <DropdownMenuItem
                  className="flex items-center justify-between"
                  key={provider}
                  onClick={() => handleProviderSelect(provider)}
                >
                  <div className="flex items-center gap-2">
                    <ProviderIcon className="size-4" provider={provider} />
                    <span>{info.name}</span>
                  </div>
                  {isSelected && <span className="text-primary text-xs">✓</span>}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Models ({currentProviderInfo.name})
        </DropdownMenuLabel>

        <DropdownMenuRadioGroup
          onValueChange={(value) => handleModelSelect(value)}
          value={config.modelName}
        >
          <div className="custom-scrollbar max-h-48 overflow-y-auto">
            {DEFAULT_MODELS[config.provider].map((model) => {
              const hasReasoning = REASONING_MODELS.some((rm) =>
                model.toLowerCase().includes(rm.toLowerCase())
              );
              return (
                <DropdownMenuRadioItem
                  className="flex items-center gap-2 pr-8"
                  key={model}
                  value={model}
                >
                  <div className="flex items-center gap-2">
                    <span className="truncate">{getModelDisplayName(model)}</span>
                    {hasReasoning && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Brain className="size-3 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent className="z-[120]">Supports reasoning</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                </DropdownMenuRadioItem>
              );
            })}
          </div>
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />

        {modelSupportsReasoning && (
          <>
            <div className="flex items-center justify-between px-2 py-2">
              <div className="flex items-center gap-2">
                <Brain className="size-4 text-muted-foreground" />
                <div className="flex flex-col">
                  <span className="text-sm">Reasoning Mode</span>
                  <span className="text-muted-foreground text-xs">Extended thinking</span>
                </div>
              </div>
              <Switch
                className="bg-zinc-600 data-[state=checked]:bg-emerald-500"
                checked={config.enableReasoning}
                onCheckedChange={setEnableReasoning}
              />
            </div>
            <DropdownMenuSeparator />
          </>
        )}

        {onOpenSettings && (
          <DropdownMenuItem
            className="flex items-center gap-2 text-muted-foreground"
            onClick={onOpenSettings}
          >
            <Settings2 className="size-4" />
            <span>Configure Providers...</span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
});
