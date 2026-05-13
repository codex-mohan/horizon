import { useState, useEffect, useRef } from "react";
import { get } from "@/lib/api";
import { ChevronDown, Sparkles } from "lucide-react";

interface ModelInfo {
  id: string;
  name: string;
  contextLength: number;
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

function getLabel(modelId: string, allModels?: ProviderGroup[]): string {
  if (allModels) {
    for (const group of allModels) {
      for (const m of group.models) {
        if (m.id === modelId) return `${group.label} / ${m.name}`;
      }
    }
  }
  const parts = modelId.split("/");
  if (parts.length >= 2) {
    const provider = parts[0] ?? "";
    const name = parts.slice(1).join("/");
    if (!provider) return modelId;
    return `${provider.charAt(0).toUpperCase() + provider.slice(1)} / ${name}`;
  }
  return modelId;
}

export function ModelSelector() {
  const [providers, setProviders] = useState<ProviderGroup[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(getSavedModel);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    get<{ providers: ProviderGroup[] }>("/v1/models")
      .then((data) => setProviders(data.providers))
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const select = (id: string) => {
    setSelected(id);
    localStorage.setItem(LS_KEY, id);
    setOpen(false);
  };

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 bg-bg-surface border border-border-subtle text-text-muted text-[12px] hover:text-text-secondary hover:border-border-hover transition-all duration-200"
      >
        <Sparkles size={12} />
        <span className="truncate max-w-[200px]">{getLabel(selected, providers)}</span>
        <ChevronDown size={12} className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-[320px] max-h-[360px] overflow-y-auto bg-bg-elevated border border-border-subtle z-50 shadow-lg">
          {providers.map((group) => (
            <div key={group.provider}>
              <div className="px-3 py-2 text-[11px] font-medium text-text-muted uppercase tracking-wider bg-bg-surface/50">
                {group.label}
              </div>
              {group.models.map((m) => (
                <button
                  key={m.id}
                  onClick={() => select(m.id)}
                  className={`w-full text-left px-3 py-2 text-[13px] transition-colors duration-150 flex items-center justify-between ${
                    selected === m.id
                      ? "bg-white/[0.06] text-text-primary"
                      : "text-text-secondary hover:bg-white/[0.03] hover:text-text-primary"
                  }`}
                >
                  <span>{m.name}</span>
                  {selected === m.id && (
                    <span className="text-accent-indigo text-[10px]">Selected</span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
