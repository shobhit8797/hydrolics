import { DEFAULT_EMAIL_CONFIG, type EmailConfig } from "./types";

function requiredEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function optionalEnv(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

function getLLMApiKey(provider: EmailConfig["llmProvider"]): string {
  if (provider === "openrouter") {
    return process.env.OPENROUTER_API_KEY || requiredEnv("LLM_API_KEY");
  }

  return requiredEnv("LLM_API_KEY");
}

export function getGmailCredentials() {
  return {
    clientId: requiredEnv("GMAIL_CLIENT_ID"),
    clientSecret: requiredEnv("GMAIL_CLIENT_SECRET"),
    refreshToken: requiredEnv("GMAIL_REFRESH_TOKEN"),
    userEmail: requiredEnv("GMAIL_USER_EMAIL"),
  };
}

export function getOutlookCredentials() {
  return {
    tenantId: requiredEnv("OUTLOOK_TENANT_ID"),
    clientId: requiredEnv("OUTLOOK_CLIENT_ID"),
    clientSecret: requiredEnv("OUTLOOK_CLIENT_SECRET"),
    userEmail: requiredEnv("OUTLOOK_USER_EMAIL"),
  };
}

export function getLLMConfig() {
  const provider = optionalEnv("LLM_PROVIDER", DEFAULT_EMAIL_CONFIG.llmProvider) as EmailConfig["llmProvider"];

  const modelDefaults: Record<EmailConfig["llmProvider"], string> = {
    openai: "gpt-4o-mini",
    gemini: "gemini-2.0-flash",
    claude: "claude-sonnet-4-20250514",
    openrouter: "arcee-ai/trinity-large-preview:free",
  };

  return {
    provider,
    model: optionalEnv("LLM_MODEL", modelDefaults[provider]),
    apiKey: getLLMApiKey(provider),
  };
}

export function getEmailConfig(): EmailConfig {
  const llmProvider = optionalEnv(
    "LLM_PROVIDER",
    DEFAULT_EMAIL_CONFIG.llmProvider
  ) as EmailConfig["llmProvider"];
  const modelDefaults: Record<EmailConfig["llmProvider"], string> = {
    openai: "gpt-4o-mini",
    gemini: "gemini-2.0-flash",
    claude: "claude-sonnet-4-20250514",
    openrouter: "arcee-ai/trinity-large-preview:free",
  };

  return {
    ...DEFAULT_EMAIL_CONFIG,
    pollIntervalMinutes: parseInt(optionalEnv("EMAIL_POLL_INTERVAL_MINUTES", "60"), 10),
    maxEmailsPerPoll: parseInt(optionalEnv("EMAIL_MAX_PER_POLL", "100"), 10),
    mailboxProvider: optionalEnv("EMAIL_MAILBOX_PROVIDER", "gmail") as EmailConfig["mailboxProvider"],
    mailboxQuery: optionalEnv("EMAIL_MAILBOX_QUERY", DEFAULT_EMAIL_CONFIG.mailboxQuery),
    llmProvider,
    llmModel: optionalEnv("LLM_MODEL", modelDefaults[llmProvider]),
    systemPrompt: optionalEnv("EMAIL_SYSTEM_PROMPT", DEFAULT_EMAIL_CONFIG.systemPrompt),
  };
}
