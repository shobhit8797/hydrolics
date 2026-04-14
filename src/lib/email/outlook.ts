import type { IncomingEmail, EmailAttachment } from "./types";
import type { MailClient } from "./mail-client";

interface OutlookClientConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  userEmail?: string;
  refreshToken?: string;
}

interface GraphMessage {
  id: string;
  conversationId?: string;
  subject?: string;
  receivedDateTime?: string;
  body?: { contentType?: string; content?: string };
  bodyPreview?: string;
  from?: { emailAddress?: { name?: string; address?: string } };
  toRecipients?: Array<{ emailAddress?: { name?: string; address?: string } }>;
  categories?: string[];
  hasAttachments?: boolean;
}

export class OutlookClient implements MailClient {
  private readonly tenantId: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly userEmail: string | null;
  private refreshToken: string | null;
  private accessToken: string | null = null;
  private tokenExpiresAtMs = 0;

  constructor(config: OutlookClientConfig) {
    this.tenantId = config.tenantId;
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.userEmail = config.userEmail || null;
    this.refreshToken = config.refreshToken || null;
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAtMs - 60_000) {
      return this.accessToken;
    }

    const tokenEndpoint = `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`;
    const body = new URLSearchParams(
      this.refreshToken
        ? {
            client_id: this.clientId,
            client_secret: this.clientSecret,
            scope: "offline_access User.Read Mail.ReadWrite Mail.Send",
            refresh_token: this.refreshToken,
            grant_type: "refresh_token",
          }
        : {
            client_id: this.clientId,
            client_secret: this.clientSecret,
            scope: "https://graph.microsoft.com/.default",
            grant_type: "client_credentials",
          }
    );

    const response = await fetch(tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Failed to get Outlook access token: ${message}`);
    }

    const token = (await response.json()) as {
      access_token: string;
      expires_in: number;
      refresh_token?: string;
    };

    this.accessToken = token.access_token;
    this.tokenExpiresAtMs = Date.now() + token.expires_in * 1000;
    if (token.refresh_token) {
      this.refreshToken = token.refresh_token;
    }
    return this.accessToken;
  }

  private async graphRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await this.getAccessToken();
    const response = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Microsoft Graph request failed (${response.status}): ${message}`);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  private isPOEmail(message: GraphMessage): boolean {
    const haystack = `${message.subject || ""} ${message.bodyPreview || ""}`.toLowerCase();
    return /\b(po|purchase order|order confirmation)\b/.test(haystack);
  }

  private toIncomingEmail(message: GraphMessage): IncomingEmail {
    const fromAddr = message.from?.emailAddress?.address || "";
    const fromName = message.from?.emailAddress?.name || fromAddr;
    const to = (message.toRecipients || [])
      .map((recipient) => recipient.emailAddress?.address)
      .filter(Boolean)
      .join(", ");

    const bodyText = message.body?.content || message.bodyPreview || "";
    const bodyHtml = message.body?.contentType?.toLowerCase() === "html" ? bodyText : "";
    const labels = message.categories || [];
    const attachments: EmailAttachment[] = message.hasAttachments
      ? [
          {
            filename: "Attachment present",
            mimeType: "application/octet-stream",
            size: 0,
            attachmentId: "unknown",
          },
        ]
      : [];

    return {
      gmailMessageId: message.id,
      mailboxProvider: "outlook",
      threadId: message.conversationId || "",
      from: `${fromName} <${fromAddr}>`,
      to,
      subject: message.subject || "(No Subject)",
      body: bodyText,
      bodyHtml,
      receivedAt: message.receivedDateTime || new Date().toISOString(),
      labels,
      attachments,
    };
  }

  async fetchUnreadEmails(_query: string, maxResults: number): Promise<IncomingEmail[]> {
    const encodedFilter = encodeURIComponent("isRead eq false");
    const encodedSelect = encodeURIComponent(
      "id,conversationId,subject,receivedDateTime,bodyPreview,body,from,toRecipients,categories,hasAttachments"
    );
    const userPath = this.refreshToken ? "/me/messages" : `/users/${encodeURIComponent(this.userEmail || "")}/messages`;
    const data = await this.graphRequest<{ value: GraphMessage[] }>(
      `${userPath}?$filter=${encodedFilter}&$top=${maxResults}&$orderby=receivedDateTime desc&$select=${encodedSelect}`
    );

    return (data.value || []).filter((msg) => this.isPOEmail(msg)).map((msg) => this.toIncomingEmail(msg));
  }

  async markAsRead(messageId: string): Promise<void> {
    const userPath = this.refreshToken ? "/me/messages" : `/users/${encodeURIComponent(this.userEmail || "")}/messages`;
    await this.graphRequest<void>(`${userPath}/${messageId}`, {
      method: "PATCH",
      body: JSON.stringify({ isRead: true }),
    });
  }

  async sendEmail(to: string, subject: string, body: string): Promise<string> {
    const addressMatch = /<([^>]+)>/.exec(to);
    const recipientAddress = (addressMatch ? addressMatch[1] : to).trim();

    const sendPath = this.refreshToken ? "/me/sendMail" : `/users/${encodeURIComponent(this.userEmail || "")}/sendMail`;
    await this.graphRequest<void>(sendPath, {
      method: "POST",
      body: JSON.stringify({
        message: {
          subject,
          body: {
            contentType: "Text",
            content: body,
          },
          toRecipients: [
            {
              emailAddress: { address: recipientAddress },
            },
          ],
        },
      }),
    });

    return `outlook-${Date.now()}`;
  }
}
