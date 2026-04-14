import type { LLMProvider } from "./llm-provider";
import type { EmailConfig } from "./types";
import { OpenAIProvider } from "./llm-openai";
import { GeminiProvider } from "./llm-gemini";
import { ClaudeProvider } from "./llm-claude";
import { OpenRouterProvider } from "./llm-openrouter";

const providers: Record<EmailConfig["llmProvider"], new (apiKey: string) => LLMProvider> = {
  openai: OpenAIProvider,
  gemini: GeminiProvider,
  claude: ClaudeProvider,
  openrouter: OpenRouterProvider,
};

let cachedProvider: LLMProvider | null = null;
let cachedKey: string | null = null;

export function getLLMProvider(providerName: EmailConfig["llmProvider"], apiKey: string): LLMProvider {
  const cacheKey = `${providerName}:${apiKey}`;
  if (cachedProvider && cachedKey === cacheKey) return cachedProvider;

  const ProviderClass = providers[providerName];
  if (!ProviderClass) {
    throw new Error(
      `Unknown LLM provider: "${providerName}". Available: ${Object.keys(providers).join(", ")}`
    );
  }

  cachedProvider = new ProviderClass(apiKey);
  cachedKey = cacheKey;
  return cachedProvider;
}
