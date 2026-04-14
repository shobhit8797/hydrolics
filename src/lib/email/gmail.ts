import { google, type gmail_v1 } from "googleapis";
import type { IncomingEmail, EmailAttachment } from "./types";
import type { MailClient } from "./mail-client";

type MessagePart = gmail_v1.Schema$MessagePart;

interface GmailClientConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  userEmail?: string;
}

export class GmailClient implements MailClient {
  private gmail;
  private userEmail: string | null;

  constructor(config: GmailClientConfig) {
    const oauth2 = new google.auth.OAuth2(config.clientId, config.clientSecret);
    oauth2.setCredentials({ refresh_token: config.refreshToken });

    this.gmail = google.gmail({ version: "v1", auth: oauth2 });
    this.userEmail = config.userEmail || null;
  }

  async fetchUnreadEmails(query: string, maxResults: number): Promise<IncomingEmail[]> {
    const listRes = await this.gmail.users.messages.list({
      userId: "me",
      q: query,
      maxResults,
    });

    const messageIds = listRes.data.messages || [];
    if (messageIds.length === 0) return [];

    const emails: IncomingEmail[] = [];

    for (const msg of messageIds) {
      if (!msg.id) continue;
      try {
        const email = await this.fetchEmailDetail(msg.id);
        if (email) emails.push(email);
      } catch (err) {
        console.error(`Failed to fetch email ${msg.id}:`, err);
      }
    }

    return emails;
  }

  private async fetchEmailDetail(messageId: string): Promise<IncomingEmail | null> {
    const res = await this.gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "full",
    });

    const msg = res.data;
    if (!msg.payload) return null;

    const headers = msg.payload.headers || [];
    const getHeader = (name: string) =>
      headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || "";

    const body = this.extractBody(msg.payload, "text/plain");
    const bodyHtml = this.extractBody(msg.payload, "text/html");
    const attachments = this.extractAttachments(msg.payload);

    return {
      gmailMessageId: messageId,
      mailboxProvider: "gmail",
      threadId: msg.threadId || "",
      from: getHeader("From"),
      to: getHeader("To"),
      subject: getHeader("Subject"),
      body,
      bodyHtml,
      receivedAt: new Date(parseInt(msg.internalDate || "0")).toISOString(),
      labels: msg.labelIds || [],
      attachments,
    };
  }

  private extractBody(payload: MessagePart, mimeType: string): string {
    if (payload.mimeType === mimeType && payload.body?.data) {
      return Buffer.from(payload.body.data, "base64url").toString("utf-8");
    }

    if (payload.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === mimeType && part.body?.data) {
          return Buffer.from(part.body.data, "base64url").toString("utf-8");
        }
        if (part.parts) {
          const nested = this.extractBody(part, mimeType);
          if (nested) return nested;
        }
      }
    }

    return "";
  }

  private extractAttachments(payload: MessagePart): EmailAttachment[] {
    const attachments: EmailAttachment[] = [];

    const walk = (parts: MessagePart[] | undefined) => {
      if (!parts) return;
      for (const part of parts) {
        if (part.filename && part.body?.attachmentId) {
          attachments.push({
            filename: part.filename,
            mimeType: part.mimeType || "application/octet-stream",
            size: part.body.size || 0,
            attachmentId: part.body.attachmentId,
          });
        }
        if (part.parts) walk(part.parts);
      }
    };

    walk(payload.parts);
    return attachments;
  }

  async markAsRead(messageId: string): Promise<void> {
    await this.gmail.users.messages.modify({
      userId: "me",
      id: messageId,
      requestBody: { removeLabelIds: ["UNREAD"] },
    });
  }

  async sendEmail(to: string, subject: string, body: string, threadId?: string): Promise<string> {
    const messageParts = [
      ...(this.userEmail ? [`From: ${this.userEmail}`] : []),
      `To: ${to}`,
      `Subject: ${subject}`,
      `Content-Type: text/plain; charset=utf-8`,
      "",
      body,
    ];

    const rawMessage = Buffer.from(messageParts.join("\r\n")).toString("base64url");

    const res = await this.gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: rawMessage,
        threadId: threadId || undefined,
      },
    });

    return res.data.id || "";
  }

  async createDraft(to: string, subject: string, body: string, threadId?: string): Promise<string> {
    const messageParts = [
      ...(this.userEmail ? [`From: ${this.userEmail}`] : []),
      `To: ${to}`,
      `Subject: ${subject}`,
      `Content-Type: text/plain; charset=utf-8`,
      "",
      body,
    ];

    const rawMessage = Buffer.from(messageParts.join("\r\n")).toString("base64url");

    const res = await this.gmail.users.drafts.create({
      userId: "me",
      requestBody: {
        message: {
          raw: rawMessage,
          threadId: threadId || undefined,
        },
      },
    });

    return res.data.id || "";
  }
}
