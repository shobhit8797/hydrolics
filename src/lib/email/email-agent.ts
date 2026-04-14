import { randomUUID } from "crypto";
import { getLLMProvider } from "./llm-factory";
import {
  addEmail,
  emailExistsByMessageId,
  getAllEmails,
  getEmailById,
  updateEmail,
  recordPollResult,
} from "./email-store";
import { getLLMConfig, getEmailConfig } from "./config";
import type { POEmail, IncomingEmail, AIDraft, EmailPollResult } from "./types";
import { createMailClient } from "./mail-factory";

const DEFAULT_DRAFT_RETRY_ATTEMPTS = 3;
const DEFAULT_DRAFT_RETRY_BASE_DELAY_MS = 750;

function parsePositiveIntEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) return fallback;

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function getDraftRetrySettings() {
  const attempts = Math.min(
    parsePositiveIntEnv("EMAIL_DRAFT_RETRY_ATTEMPTS", DEFAULT_DRAFT_RETRY_ATTEMPTS),
    10
  );
  const baseDelayMs = Math.min(
    parsePositiveIntEnv("EMAIL_DRAFT_RETRY_BASE_DELAY_MS", DEFAULT_DRAFT_RETRY_BASE_DELAY_MS),
    15000
  );

  return { attempts, baseDelayMs };
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateDraft(incoming: IncomingEmail): Promise<AIDraft> {
  const llmConfig = getLLMConfig();
  const emailConfig = getEmailConfig();
  const retrySettings = getDraftRetrySettings();
  const provider = getLLMProvider(llmConfig.provider, llmConfig.apiKey);

  const userMessage = [
    `From: ${incoming.from}`,
    `Subject: ${incoming.subject}`,
    `Date: ${incoming.receivedAt}`,
    "",
    incoming.body || "(No text body — HTML email)",
  ].join("\n");

  let lastError: unknown;

  for (let attempt = 1; attempt <= retrySettings.attempts; attempt++) {
    try {
      const response = await provider.generateResponse(
        emailConfig.systemPrompt,
        userMessage,
        llmConfig.model
      );
      const normalizedBody = response.text.trim();

      if (!normalizedBody) {
        throw new Error("AI returned an empty response body");
      }

      return {
        subject: `Re: ${incoming.subject}`,
        body: normalizedBody,
        generatedAt: new Date().toISOString(),
        llmProvider: response.provider,
        llmModel: response.model,
        promptTokens: response.promptTokens,
        completionTokens: response.completionTokens,
      };
    } catch (err) {
      lastError = err;
      if (attempt >= retrySettings.attempts) break;

      const delayMs = retrySettings.baseDelayMs * 2 ** (attempt - 1);
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.warn(
        JSON.stringify({
          level: "WARN",
          event: "email_draft_generation_retry",
          attempt,
          maxAttempts: retrySettings.attempts,
          retryInMs: delayMs,
          provider: llmConfig.provider,
          model: llmConfig.model,
          messageId: incoming.gmailMessageId,
          error: errorMessage,
        })
      );
      await wait(delayMs);
    }
  }

  const finalErrorMessage = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(
    `AI draft generation failed after ${retrySettings.attempts} attempts: ${finalErrorMessage}`
  );
}

export async function pollAndProcessEmails(provider?: "gmail" | "outlook"): Promise<EmailPollResult> {
  const config = getEmailConfig();
  const selectedProvider = provider ?? config.mailboxProvider;
  const mailClient = createMailClient(selectedProvider);
  const result: EmailPollResult = {
    newEmails: 0,
    processed: 0,
    errors: 0,
    timestamp: new Date().toISOString(),
  };

  let emails: IncomingEmail[];
  try {
    emails = await mailClient.fetchUnreadEmails(config.mailboxQuery, config.maxEmailsPerPoll);
  } catch (err) {
    console.error(`Failed to fetch emails from ${selectedProvider}:`, err);
    result.errors = 1;
    recordPollResult(result);
    return result;
  }

  for (const incoming of emails) {
    if (emailExistsByMessageId(incoming.gmailMessageId, incoming.mailboxProvider)) continue;
    result.newEmails++;

    const poEmail: POEmail = {
      id: randomUUID(),
      incoming,
      draft: null,
      status: "pending",
      sentAt: null,
      processedAt: new Date().toISOString(),
      error: null,
      manualEdits: null,
    };

    addEmail(poEmail);

    try {
      const draft = await generateDraft(incoming);
      updateEmail(poEmail.id, { draft, status: "draft_ready" });

      await mailClient.markAsRead(incoming.gmailMessageId);
      result.processed++;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`Failed to process email ${poEmail.id}:`, errorMsg);
      updateEmail(poEmail.id, { status: "failed", error: errorMsg });
      result.errors++;
    }
  }

  recordPollResult(result);
  return result;
}

export async function regenerateDraft(emailId: string): Promise<POEmail> {
  const email = getEmailById(emailId);
  if (!email) throw new Error(`Email not found: ${emailId}`);

  try {
    const draft = await generateDraft(email.incoming);
    const updated = updateEmail(emailId, {
      draft,
      status: "draft_ready",
      error: null,
      manualEdits: null,
    });
    return updated!;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    updateEmail(emailId, { status: "failed", error: errorMsg });
    throw err;
  }
}

export async function regenerateFailedDrafts(): Promise<{
  attempted: number;
  succeeded: number;
  failed: number;
}> {
  const failedEmails = getAllEmails().filter(
    (email) => email.status === "failed" && !email.draft
  );
  let succeeded = 0;

  for (const email of failedEmails) {
    try {
      await regenerateDraft(email.id);
      succeeded++;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(
        JSON.stringify({
          level: "ERROR",
          event: "email_failed_regeneration_error",
          emailId: email.id,
          mailboxProvider: email.incoming.mailboxProvider,
          error: errorMsg,
        })
      );
    }
  }

  return {
    attempted: failedEmails.length,
    succeeded,
    failed: failedEmails.length - succeeded,
  };
}

export async function sendEmailResponse(
  emailId: string,
  customBody?: string
): Promise<POEmail> {
  const email = getEmailById(emailId);
  if (!email) throw new Error(`Email not found: ${emailId}`);
  if (!email.draft) throw new Error("No draft available to send");

  const mailClient = createMailClient(email.incoming.mailboxProvider);
  const body = customBody || email.manualEdits || email.draft.body;

  try {
    await mailClient.sendEmail(
      email.incoming.from,
      email.draft.subject,
      body,
      email.incoming.threadId
    );

    const updated = updateEmail(emailId, {
      status: "sent",
      sentAt: new Date().toISOString(),
      manualEdits: customBody || email.manualEdits,
    });
    return updated!;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    updateEmail(emailId, { status: "failed", error: errorMsg });
    throw err;
  }
}

export async function updateDraftBody(
  emailId: string,
  editedBody: string
): Promise<POEmail> {
  const email = getEmailById(emailId);
  if (!email) throw new Error(`Email not found: ${emailId}`);

  const updated = updateEmail(emailId, { manualEdits: editedBody });
  return updated!;
}
