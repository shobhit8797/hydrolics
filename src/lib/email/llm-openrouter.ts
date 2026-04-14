import OpenAI from "openai";
import type { LLMProvider, LLMResponse } from "./llm-provider";

export class OpenRouterProvider implements LLMProvider {
  readonly name = "openrouter";
  private client: OpenAI;

  constructor(apiKey: string) {
    const referer = process.env.OPENROUTER_HTTP_REFERER;
    const title = process.env.OPENROUTER_TITLE;
    const defaultHeaders: Record<string, string> = {};

    if (referer) defaultHeaders["HTTP-Referer"] = referer;
    if (title) defaultHeaders["X-OpenRouter-Title"] = title;

    this.client = new OpenAI({
      apiKey,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: Object.keys(defaultHeaders).length ? defaultHeaders : undefined,
    });
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
      throw new Error("OpenRouter returned empty response");
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
