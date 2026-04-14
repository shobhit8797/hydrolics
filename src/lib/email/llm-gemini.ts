import { GoogleGenerativeAI } from "@google/generative-ai";
import type { LLMProvider, LLMResponse } from "./llm-provider";

export class GeminiProvider implements LLMProvider {
  readonly name = "gemini";
  private client: GoogleGenerativeAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async generateResponse(
    systemPrompt: string,
    userMessage: string,
    model: string
  ): Promise<LLMResponse> {
    const genModel = this.client.getGenerativeModel({
      model,
      systemInstruction: systemPrompt,
    });

    const result = await genModel.generateContent(userMessage);
    const text = result.response.text();

    if (!text) {
      throw new Error("Gemini returned empty response");
    }

    const usage = result.response.usageMetadata;

    return {
      text,
      model,
      provider: this.name,
      promptTokens: usage?.promptTokenCount,
      completionTokens: usage?.candidatesTokenCount,
    };
  }
}
