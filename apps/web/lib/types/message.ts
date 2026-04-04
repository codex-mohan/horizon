/**
 * Message types - replaces @langchain/langgraph-sdk Message type
 */

export interface ContentBlock {
  type: "text" | "image_url" | "tool_use" | "tool_result";
  text?: string;
  image_url?: { url: string };
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  output?: string | ContentBlock[];
}

export interface Message {
  id?: string;
  type?: string;
  role?: string;
  content: string | ContentBlock[];
  name?: string;
  tool_calls?: Array<{
    id: string;
    name: string;
    args: Record<string, unknown>;
  }>;
  tool_call_id?: string;
  additional_kwargs?: Record<string, unknown>;
  response_metadata?: Record<string, unknown>;
}

export function isAIMessage(msg: Message | unknown): boolean {
  const m = msg as Message;
  return m.role === "assistant" || m.type === "ai" || m.type === "AIMessage";
}

export function isHumanMessage(msg: Message | unknown): boolean {
  const m = msg as Message;
  return m.role === "user" || m.type === "human" || m.type === "HumanMessage";
}

export function isToolMessage(msg: Message | unknown): boolean {
  const m = msg as Message;
  return m.role === "tool" || m.type === "tool" || m.type === "ToolMessage";
}

export function getMessageRole(msg: Message): string {
  if (msg.role) return msg.role;
  if (msg.type === "human") return "user";
  if (msg.type === "ai") return "assistant";
  if (msg.type === "tool") return "tool";
  if (msg.type === "system") return "system";
  return msg.type || "unknown";
}
