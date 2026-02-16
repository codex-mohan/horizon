import { config } from "dotenv";
import { z } from "zod";

// Load environment variables
config();

const EnvSchema = z.object({
  PORT: z.string().default("2024").transform(Number),
  ENVIRONMENT: z.enum(["development", "production"]).default("development"),
  API_KEY: z.string().optional(),

  // Model Configuration
  MODEL_PROVIDER: z.enum(["openai", "anthropic", "google", "ollama", "groq"]).default("groq"),
  MODEL_NAME: z.string().default("meta-llama/llama-4-scout-17b-16e-instruct"),
  TEMPERATURE: z.string().default("0.7").transform(Number),
  MAX_TOKENS: z.string().default("4096").transform(Number),
  BASE_URL: z.string().optional(),

  // API Keys
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GOOGLE_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),

  // Feature Flags (Middleware)
  ENABLE_MEMORY: z
    .string()
    .default("true")
    .transform((s) => s === "true"),
  ENABLE_SUMMARIZATION: z
    .string()
    .default("true")
    .transform((s) => s === "true"),
  ENABLE_PII_DETECTION: z
    .string()
    .default("true")
    .transform((s) => s === "true"),
  ENABLE_RATE_LIMITING: z
    .string()
    .default("true")
    .transform((s) => s === "true"),
  ENABLE_TOKEN_TRACKING: z
    .string()
    .default("true")
    .transform((s) => s === "true"),
  ENABLE_MODEL_FALLBACK: z
    .string()
    .default("true")
    .transform((s) => s === "true"),
  ENABLE_TOOL_RETRY: z
    .string()
    .default("true")
    .transform((s) => s === "true"),
  ENABLE_TOOL_APPROVAL: z
    .string()
    .default("true")
    .transform((s) => s === "true"),
  ENABLE_TODO_LIST: z
    .string()
    .default("true")
    .transform((s) => s === "true"),
  ENABLE_TODO_PLANNER: z
    .string()
    .default("true")
    .transform((s) => s === "true"),

  // Limits
  MAX_MODEL_CALLS: z.string().default("10").transform(Number),
  MAX_TOOL_CALLS: z.string().default("20").transform(Number),
  SUMMARIZATION_THRESHOLD: z.string().default("135000").transform(Number),
  RATE_LIMIT_WINDOW: z.string().default("60").transform(Number),

  // Retry Settings
  MAX_RETRIES: z.string().default("3").transform(Number),
  BACKOFF_FACTOR: z.string().default("2.0").transform(Number),
  INITIAL_DELAY: z.string().default("1.0").transform(Number),

  // Prompts
  CHARACTER: z.string().default("You are a helpful AI assistant."),
  CORE_BEHAVIOR: z.string().default("Be helpful, harmless, and honest."),
  INSTRUCTIONS: z.string().default("Follow user instructions carefully."),
  INTERACTION_GUIDELINES: z.string().default("Be conversational and clear."),
  KNOWLEDGE_CAPABILITIES: z.string().default("Use available tools when needed."),
  REASONING_APPROACH: z.string().default("Think step by step."),
  RESPONSE_FORMAT: z.string().default("Respond in a clear format."),
  FORMATTING_STANDARDS: z.string().default("Use markdown when appropriate."),
  SECURITY_REQUIREMENTS: z.string().default("Never share sensitive information."),
});

export type AgentConfig = z.infer<typeof EnvSchema>;

export const agentConfig = EnvSchema.parse(process.env);
