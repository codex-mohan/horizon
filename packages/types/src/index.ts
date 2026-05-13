import { z } from "zod";

export const MessageRole = z.enum(["user", "assistant", "toolResult"]);
export type MessageRole = z.infer<typeof MessageRole>;

export const TextContent = z.object({
  type: z.literal("text"),
  text: z.string(),
});
export type TextContent = z.infer<typeof TextContent>;

export const ToolCallContent = z.object({
  type: z.literal("toolCall"),
  id: z.string(),
  name: z.string(),
  arguments: z.record(z.string(), z.unknown()),
});
export type ToolCallContent = z.infer<typeof ToolCallContent>;

export const Message = z.object({
  id: z.string(),
  role: MessageRole,
  content: z.string(),
  timestamp: z.number(),
  toolCallId: z.string().optional(),
  toolName: z.string().optional(),
  isError: z.boolean().optional(),
});
export type Message = z.infer<typeof Message>;

export const Session = z.object({
  id: z.string(),
  title: z.string().default("New Session"),
  messages: z.array(Message).default([]),
  createdAt: z.number(),
  updatedAt: z.number(),
  model: z.string().default("gpt-4o"),
});
export type Session = z.infer<typeof Session>;

export const ModelConfig = z.object({
  id: z.string(),
  name: z.string(),
  provider: z.enum(["openai", "anthropic", "groq", "ollama"]),
  maxTokens: z.number().default(4096),
});
export type ModelConfig = z.infer<typeof ModelConfig>;

export const AppConfig = z.object({
  theme: z.enum(["dark", "light"]).default("dark"),
  model: z.string().default("gpt-4o"),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().default(4096),
});
export type AppConfig = z.infer<typeof AppConfig>;

export const LogLevel = z.enum(["debug", "info", "warn", "error"]);
export type LogLevel = z.infer<typeof LogLevel>;

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: number;
  context?: Record<string, unknown>;
}

export interface AnalyticsEvent {
  name: string;
  properties?: Record<string, unknown>;
  timestamp: number;
}
