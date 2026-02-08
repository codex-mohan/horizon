import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import type { Preference, UserPreferences } from "./types.js";

/**
 * Preference Extractor
 *
 * Uses LLM to extract user preferences from conversations.
 * Identifies patterns in user behavior and feedback.
 */
export class PreferenceExtractor {
  private llm: ChatOpenAI;

  constructor(apiKey?: string) {
    this.llm = new ChatOpenAI({
      modelName: "gpt-4o-mini",
      temperature: 0.2,
      openAIApiKey: apiKey,
    });
  }

  /**
   * Extract preferences from a conversation thread
   */
  async extractPreferences(
    userId: string,
    messages: Array<{ role: string; content: string }>,
  ): Promise<Preference[]> {
    const conversationText = messages
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n");

    const systemPrompt = new SystemMessage(
      `You are a preference extraction assistant. Analyze the conversation and extract any user preferences, habits, or patterns you observe.

Extract preferences in these categories:
- style: Communication style preferences (concise, detailed, formal, casual, etc.)
- topic: Topics the user is interested in or wants to avoid
- tool: Tools or features the user prefers
- format: Output format preferences (markdown, code blocks, bullet points, etc.)
- behavior: Behavioral preferences (how they like to work, think, etc.)

For each preference, provide:
1. The preference key (short identifier)
2. The preference value (what they prefer)
3. Confidence score (0.0-1.0 based on how explicit/clear the preference is)
4. Category

Return ONLY a JSON array in this format:
[
  {
    "key": "communication_style",
    "value": "concise and direct",
    "confidence": 0.9,
    "category": "style"
  }
]

If no clear preferences are found, return an empty array [].`,
    );

    const userPrompt = new HumanMessage(
      `Extract user preferences from this conversation:\n\n${conversationText}`,
    );

    try {
      const response = await this.llm.invoke([systemPrompt, userPrompt]);
      const content = response.content as string;

      // Extract JSON from response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];

      const preferences: Omit<
        Preference,
        "source_message_id" | "extracted_at"
      >[] = JSON.parse(jsonMatch[0]);

      return preferences.map((p) => ({
        ...p,
        source_message_id: "extracted_batch",
        extracted_at: new Date().toISOString(),
      }));
    } catch (error) {
      console.error(
        "[PreferenceExtractor] Failed to extract preferences:",
        error,
      );
      return [];
    }
  }

  /**
   * Generate a summary of user preferences
   */
  async generatePreferenceSummary(preferences: Preference[]): Promise<string> {
    if (preferences.length === 0) {
      return "No significant preferences identified yet.";
    }

    const preferencesText = preferences
      .map((p) => `- ${p.key}: ${p.value} (confidence: ${p.confidence})`)
      .join("\n");

    const systemPrompt = new SystemMessage(
      `Create a brief, natural language summary of the user's preferences based on the extracted data.`,
    );

    const userPrompt = new HumanMessage(
      `Summarize these user preferences:\n\n${preferencesText}`,
    );

    try {
      const response = await this.llm.invoke([systemPrompt, userPrompt]);
      return response.content as string;
    } catch (error) {
      console.error("[PreferenceExtractor] Failed to generate summary:", error);
      return "User preferences available but summary generation failed.";
    }
  }

  /**
   * Check if a message indicates a preference
   */
  async isPreferenceStatement(content: string): Promise<boolean> {
    const systemPrompt = new SystemMessage(
      `Determine if this message contains a clear preference, opinion, or instruction that should be remembered for future interactions. Answer with just "yes" or "no".`,
    );

    const userPrompt = new HumanMessage(`Message: "${content}"`);

    try {
      const response = await this.llm.invoke([systemPrompt, userPrompt]);
      const answer = (response.content as string).toLowerCase().trim();
      return answer.includes("yes");
    } catch (error) {
      return false;
    }
  }
}
