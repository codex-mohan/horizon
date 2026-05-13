import { useState, useEffect, useRef } from "react";
import { get } from "@/lib/api";
import { ChevronDown } from "lucide-react";

interface ModelInfo {
  id: string;
  name: string;
}

interface ProviderGroup {
  provider: string;
  label: string;
  models: ModelInfo[];
}

const LS_KEY = "horizon:default-model";

function getSavedModel(): string {
  if (typeof window === "undefined") return "openai/gpt-4o";
  return localStorage.getItem(LS_KEY) || "openai/gpt-4o";
}

function providerFromModel(id: string): string {
  const idx = id.indexOf("/");
  return idx > 0 ? id.slice(0, idx) : "";
}

function modelNameFromId(id: string): string {
  const idx = id.indexOf("/");
  return idx > 0 ? id.slice(idx + 1) : id;
}

export function ModelSelector() {
  const [providers, setProviders] = useState<ProviderGroup[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>("");
  const [selectedModelId, setSelectedModelId] = useState(getSavedModel);
  const [openDropdown, setOpenDropdown] = useState<"provider" | "model" | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    get<{ providers: ProviderGroup[] }>("/v1/models")
      .then((data) => setProviders(data.providers))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const saved = getSavedModel();
    setSelectedModelId(saved);
    setSelectedProvider(providerFromModel(saved));
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selectModel = (id: string) => {
    setSelectedModelId(id);
    setSelectedProvider(providerFromModel(id));
    localStorage.setItem(LS_KEY, id);
    setOpenDropdown(null);
  };

  const selectProvider = (provider: string) => {
    setSelectedProvider(provider);
    setOpenDropdown("model");
  };

  const currentProvider = providers.find((p) => p.provider === selectedProvider);
  const currentLabel = currentProvider
    ? `${currentProvider.label} / ${currentProvider.models.find((m) => m.id === selectedModelId)?.name || modelNameFromId(selectedModelId)}`
    : selectedModelId;

  const availableModels = currentProvider?.models || [];

  return (
    <div ref={dropdownRef} className="flex items-center gap-0">
      {/* Provider picker */}
      <div className="relative">
        <button
          onClick={() => setOpenDropdown(openDropdown === "provider" ? null : "provider")}
          className="flex items-center gap-2 px-3 py-1.5 bg-bg-surface border border-border-subtle text-text-muted text-[12px] hover:text-text-secondary hover:border-border-hover transition-all duration-200"
        >
          {currentProvider?.label || selectedProvider || "Provider"}
          <ChevronDown size={12} className={`transition-transform duration-200 ${openDropdown === "provider" ? "rotate-180" : ""}`} />
        </button>

        {openDropdown === "provider" && (
          <div className="absolute left-0 top-full mt-1 w-[180px] bg-bg-elevated border border-border-subtle z-[100] shadow-lg">
            {providers.map((group) => (
              <button
                key={group.provider}
                onClick={() => selectProvider(group.provider)}
                className={`w-full text-left px-3 py-2 text-[13px] transition-colors duration-150 ${
                  selectedProvider === group.provider
                    ? "bg-white/[0.06] text-text-primary"
                    : "text-text-secondary hover:bg-white/[0.03] hover:text-text-primary"
                }`}
              >
                {group.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Model picker */}
      <div className="relative">
        <button
          onClick={() => setOpenDropdown(openDropdown === "model" ? null : "model")}
          className="flex items-center gap-2 px-3 py-1.5 bg-bg-surface border-t border-b border-r border-border-subtle text-text-muted text-[12px] hover:text-text-secondary hover:border-border-hover transition-all duration-200"
        >
          {availableModels.find((m) => m.id === selectedModelId)?.name || modelNameFromId(selectedModelId) || "Model"}
          <ChevronDown size={12} className={`transition-transform duration-200 ${openDropdown === "model" ? "rotate-180" : ""}`} />
        </button>

        {openDropdown === "model" && (
          <div className="absolute left-0 top-full mt-1 w-[280px] max-h-[300px] overflow-y-auto bg-bg-elevated border border-border-subtle z-[100] shadow-lg">
            {availableModels.map((m) => (
              <button
                key={m.id}
                onClick={() => selectModel(m.id)}
                className={`w-full text-left px-3 py-2 text-[13px] transition-colors duration-150 ${
                  selectedModelId === m.id
                    ? "bg-white/[0.06] text-text-primary"
                    : "text-text-secondary hover:bg-white/[0.03] hover:text-text-primary"
                }`}
              >
                {m.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
