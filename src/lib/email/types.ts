export type EmailStatus = "pending" | "draft_ready" | "sent" | "failed" | "skipped";

export interface IncomingEmail {
  gmailMessageId: string;
  mailboxProvider: "gmail" | "outlook";
  threadId: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  bodyHtml: string;
  receivedAt: string;
  labels: string[];
  attachments: EmailAttachment[];
}

export interface EmailAttachment {
  filename: string;
  mimeType: string;
  size: number;
  attachmentId: string;
}

export interface AIDraft {
  subject: string;
  body: string;
  generatedAt: string;
  llmProvider: string;
  llmModel: string;
  promptTokens?: number;
  completionTokens?: number;
}

export interface POEmail {
  id: string;
  incoming: IncomingEmail;
  draft: AIDraft | null;
  status: EmailStatus;
  sentAt: string | null;
  processedAt: string;
  error: string | null;
  manualEdits: string | null;
}

export interface EmailPollResult {
  newEmails: number;
  processed: number;
  errors: number;
  timestamp: string;
}

export interface EmailConfig {
  pollIntervalMinutes: number;
  mailboxProvider: "gmail" | "outlook";
  mailboxQuery: string;
  maxEmailsPerPoll: number;
  llmProvider: "openai" | "gemini" | "claude" | "openrouter";
  llmModel: string;
  systemPrompt: string;
}

export const DEFAULT_EMAIL_CONFIG: EmailConfig = {
  pollIntervalMinutes: 60,
  mailboxProvider: "gmail",
  mailboxQuery: "is:unread subject:(PO OR purchase order OR order confirmation)",
  maxEmailsPerPoll: 100,
  llmProvider: "openrouter",
  llmModel: "arcee-ai/trinity-large-preview:free",
  systemPrompt: `You are a professional purchase order (PO) assistant for GH (a manufacturing/trading company). 
Your job is to draft polite, professional email responses to incoming PO-related emails.

Guidelines:
- Acknowledge receipt of the purchase order
- Confirm key details (PO number, items, quantities, delivery dates) if mentioned
- If information is missing or unclear, politely request clarification
- Maintain a professional but warm tone
- Keep responses concise and actionable
- Sign off as "GH Purchase Order Team"

Respond with ONLY the email body text. Do not include subject line or headers.`,
};
