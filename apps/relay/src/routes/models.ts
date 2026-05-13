import { Hono } from "hono";
import { redis } from "../lib/redis.js";
import { createLogger } from "../lib/logger.js";

const logger = createLogger("Models");

const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";
const CACHE_KEY = "openrouter:models";
const CACHE_TTL_SECONDS = 3600; // 1 hour

interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  context_length?: number;
  pricing?: {
    prompt?: string;
    completion?: string;
  };
  architecture?: {
    modality?: string;
    input_modalities?: string[];
    output_modalities?: string[];
  };
  top_provider?: {
    is_moderated?: boolean;
    max_completion_tokens?: number | null;
  };
}

export interface ModelInfo {
  id: string;
  name: string;
  description?: string;
  contextLength: number;
  inputPrice: number;
  outputPrice: number;
  modality: string;
  isModerated: boolean;
}

export interface ProviderGroup {
  provider: string;
  label: string;
  models: ModelInfo[];
}

// Curated models for direct providers (not through OpenRouter)
const CURATED_DIRECT_MODELS: ModelInfo[] = [
  // OpenAI
  { id: "openai/gpt-4o", name: "GPT-4o", contextLength: 128000, inputPrice: 2.5, outputPrice: 10, modality: "text->text", isModerated: false },
  { id: "openai/gpt-4o-mini", name: "GPT-4o Mini", contextLength: 128000, inputPrice: 0.15, outputPrice: 0.6, modality: "text->text", isModerated: false },
  { id: "openai/o1", name: "o1", contextLength: 200000, inputPrice: 15, outputPrice: 60, modality: "text->text", isModerated: false },
  { id: "openai/o3-mini", name: "o3 Mini", contextLength: 200000, inputPrice: 1.1, outputPrice: 4.4, modality: "text->text", isModerated: false },
  // Anthropic
  { id: "anthropic/claude-sonnet-4-20250514", name: "Claude Sonnet 4", contextLength: 200000, inputPrice: 3, outputPrice: 15, modality: "text->text", isModerated: false },
  { id: "anthropic/claude-3-5-haiku-20250219", name: "Claude 3.5 Haiku", contextLength: 200000, inputPrice: 0.8, outputPrice: 4, modality: "text->text", isModerated: false },
  // Groq
  { id: "groq/llama-3.3-70b-versatile", name: "Llama 3.3 70B", contextLength: 128000, inputPrice: 0, outputPrice: 0, modality: "text->text", isModerated: false },
  { id: "groq/llama-3.1-8b-instant", name: "Llama 3.1 8B Instant", contextLength: 128000, inputPrice: 0, outputPrice: 0, modality: "text->text", isModerated: false },
  { id: "groq/deepseek-r1-distill-llama-70b", name: "DeepSeek R1 Distill Llama 70B", contextLength: 128000, inputPrice: 0, outputPrice: 0, modality: "text->text", isModerated: false },
  { id: "groq/mixtral-8x7b-32768", name: "Mixtral 8x7B", contextLength: 32768, inputPrice: 0, outputPrice: 0, modality: "text->text", isModerated: false },
  { id: "groq/gemma2-9b-it", name: "Gemma 2 9B", contextLength: 8192, inputPrice: 0, outputPrice: 0, modality: "text->text", isModerated: false },
];

function getProviderPrefix(modelId: string): string {
  const slashIndex = modelId.indexOf("/");
  if (slashIndex === -1) return "other";
  return modelId.slice(0, slashIndex);
}

function getProviderLabel(prefix: string): string {
  const labels: Record<string, string> = {
    "anthropic": "Anthropic",
    "openai": "OpenAI",
    "groq": "Groq",
    "google": "Google",
    "x-ai": "xAI",
    "meta-llama": "Meta",
    "mistralai": "Mistral",
    "deepseek": "DeepSeek",
    "01-ai": "01.AI (Z.ai)",
    "minimax": "MiniMax",
    "moonshotai": "Kimi (Moonshot)",
    "qwen": "Qwen (Alibaba)",
    "cohere": "Cohere",
    "nousresearch": "Nous Research",
    "perplexity": "Perplexity",
    "microsoft": "Microsoft",
    "amazon": "Amazon",
    "nvidia": "NVIDIA",
    "recursal": "Recursal",
    "liquid": "Liquid",
    "bytedance": "ByteDance",
    "thudm": "THUDM",
    "alibaba": "Alibaba",
    "stabilityai": "Stability AI",
    "huggingfaceh4": "HuggingFace",
    "fireworks": "Fireworks",
    "together": "Together AI",
    "phind": "Phind",
    "openrouter": "OpenRouter",
  };
  return labels[prefix] || prefix.charAt(0).toUpperCase() + prefix.slice(1);
}

function parsePrice(priceStr: string | undefined): number {
  if (!priceStr) return 0;
  const n = parseFloat(priceStr);
  return isNaN(n) ? 0 : n;
}

async function fetchOpenRouterModels(): Promise<ModelInfo[]> {
  const res = await fetch(OPENROUTER_MODELS_URL, {
    headers: { "Accept": "application/json" },
  });

  if (!res.ok) {
    throw new Error(`OpenRouter API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json() as { data?: OpenRouterModel[] };
  if (!data.data || !Array.isArray(data.data)) {
    throw new Error("Invalid response format from OpenRouter");
  }

  return data.data.map((m) => ({
    id: m.id,
    name: m.name || m.id,
    description: m.description,
    contextLength: m.context_length || 0,
    inputPrice: parsePrice(m.pricing?.prompt),
    outputPrice: parsePrice(m.pricing?.completion),
    modality: m.architecture?.modality || "text->text",
    isModerated: m.top_provider?.is_moderated ?? false,
  }));
}

async function getCachedOrFetchModels(): Promise<ModelInfo[]> {
  const cached = await redis.get(CACHE_KEY);
  if (cached) {
    try {
      const parsed = JSON.parse(cached) as ModelInfo[];
      logger.info("Serving OpenRouter models from cache");
      return parsed;
    } catch {
      // Invalid cache
    }
  }

  const models = await fetchOpenRouterModels();
  await redis.setex(CACHE_KEY, CACHE_TTL_SECONDS, JSON.stringify(models));
  logger.info("Fetched OpenRouter models from API", { count: models.length });
  return models;
}

function groupByProvider(models: ModelInfo[], filterProviders?: string[]): ProviderGroup[] {
  const groups = new Map<string, ModelInfo[]>();

  for (const model of models) {
    const prefix = getProviderPrefix(model.id);
    if (filterProviders && !filterProviders.includes(prefix)) continue;
    if (!groups.has(prefix)) {
      groups.set(prefix, []);
    }
    groups.get(prefix)!.push(model);
  }

  const priorityProviders = [
    "anthropic", "openai", "groq", "deepseek", "x-ai", "meta-llama",
    "mistralai", "google", "01-ai", "minimax", "moonshotai",
  ];

  const entries = Array.from(groups.entries());
  entries.sort((a, b) => {
    const pa = priorityProviders.indexOf(a[0]);
    const pb = priorityProviders.indexOf(b[0]);
    if (pa !== -1 && pb !== -1) return pa - pb;
    if (pa !== -1) return -1;
    if (pb !== -1) return 1;
    return a[0].localeCompare(b[0]);
  });

  return entries.map(([provider, models]) => ({
    provider,
    label: getProviderLabel(provider),
    models: models.sort((a, b) => a.name.localeCompare(b.name)),
  }));
}

const modelsRouter = new Hono();

// GET /v1/models/all — all available models (curated direct + OpenRouter)
modelsRouter.get("/all", async (c) => {
  try {
    const openrouterModels = await getCachedOrFetchModels();
    // Prefix OpenRouter model IDs so resolveModel routes them through OpenRouter
    const prefixed = openrouterModels.map((m) => ({
      ...m,
      id: `openrouter/${m.id}`,
    }));
    const allModels = [...CURATED_DIRECT_MODELS, ...prefixed];
    return c.json({ providers: groupByProvider(allModels) });
  } catch (err) {
    logger.error("Models route error", {
      error: err instanceof Error ? err.message : String(err),
    });
    return c.json({ error: "Failed to fetch models" }, 502);
  }
});

// GET /v1/models/openrouter — all OpenRouter models grouped by provider
modelsRouter.get("/openrouter", async (c) => {
  try {
    const models = await getCachedOrFetchModels();
    return c.json({ providers: groupByProvider(models), cached: false });
  } catch (err) {
    logger.error("OpenRouter models route error", {
      error: err instanceof Error ? err.message : String(err),
    });
    return c.json({ error: "Failed to fetch models" }, 502);
  }
});

// GET /v1/models/static — curated provider list (direct + OpenRouter)
modelsRouter.get("/static", async (c) => {
  try {
    const models = await getCachedOrFetchModels();
    const curatedProviders = [
      "anthropic", "openai", "groq", "deepseek",
      "01-ai", "minimax", "moonshotai",
    ];
    const filtered = [...CURATED_DIRECT_MODELS, ...models].filter((m) =>
      curatedProviders.includes(getProviderPrefix(m.id))
    );
    return c.json({ providers: groupByProvider(filtered) });
  } catch (err) {
    logger.error("Static models route error", {
      error: err instanceof Error ? err.message : String(err),
    });
    return c.json({ error: "Failed to fetch models" }, 502);
  }
});

// GET /v1/models/search?q=... — search across all models
modelsRouter.get("/search", async (c) => {
  try {
    const q = c.req.query("q")?.toLowerCase() || "";
    const openrouterModels = await getCachedOrFetchModels();
    const allModels = [...CURATED_DIRECT_MODELS, ...openrouterModels];

    const filtered = allModels.filter((m) =>
      m.name.toLowerCase().includes(q) ||
      m.id.toLowerCase().includes(q) ||
      getProviderLabel(getProviderPrefix(m.id)).toLowerCase().includes(q)
    );

    return c.json({
      providers: groupByProvider(filtered),
      total: filtered.length,
    });
  } catch (err) {
    logger.error("Model search error", {
      error: err instanceof Error ? err.message : String(err),
    });
    return c.json({ error: "Failed to search models" }, 502);
  }
});

export default modelsRouter;
