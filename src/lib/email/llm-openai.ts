import OpenAI from "openai";
import type { LLMProvider, LLMResponse } from "./llm-provider";

export class OpenAIProvider implements LLMProvider {
  readonly name = "openai";
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async generateResponse(
    systemPrompt: string,
    userMessage: string,
    model: string
  ): Promise<LLMResponse> {
    const completion = await this.client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: 1024,
    });

    const choice = completion.choices[0];
    if (!choice?.message?.content) {
      throw new Error("OpenAI returned empty response");
    }

    return {
      text: choice.message.content,
      model: completion.model,
      provider: this.name,
      promptTokens: completion.usage?.prompt_tokens,
      completionTokens: completion.usage?.completion_tokens,
    };
  }
}
