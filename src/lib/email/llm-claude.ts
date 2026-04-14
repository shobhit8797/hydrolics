import Anthropic from "@anthropic-ai/sdk";
import type { LLMProvider, LLMResponse } from "./llm-provider";

export class ClaudeProvider implements LLMProvider {
  readonly name = "claude";
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async generateResponse(
    systemPrompt: string,
    userMessage: string,
    model: string
  ): Promise<LLMResponse> {
    const message = await this.client.messages.create({
      model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("Claude returned empty response");
    }

    return {
      text: textBlock.text,
      model: message.model,
      provider: this.name,
      promptTokens: message.usage.input_tokens,
      completionTokens: message.usage.output_tokens,
    };
  }
}
