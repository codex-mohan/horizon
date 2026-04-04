import type { RuntimeModelConfig } from "../../lib/model.js";

export interface SubAgentResult {
  task_id: string;
  agent_id: string;
  status: "success" | "failure";
  output: string;
  artifacts_created?: string[];
  errors?: string[];
  metrics?: {
    tokens_used?: number;
    execution_time_ms?: number;
  };
}

export interface SubAgentConfig {
  id: string;
  name: string;
  systemPrompt: string;
  tools: string[];
  modelConfig?: RuntimeModelConfig;
  timeout?: number;
  context?: Record<string, any>;
}
