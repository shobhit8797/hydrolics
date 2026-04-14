export interface LLMResponse {
  text: string;
  model: string;
  provider: string;
  promptTokens?: number;
  completionTokens?: number;
}

export interface LLMProvider {
  readonly name: string;
  generateResponse(systemPrompt: string, userMessage: string, model: string): Promise<LLMResponse>;
}
