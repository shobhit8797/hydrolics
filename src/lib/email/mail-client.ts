import type { IncomingEmail } from "./types";

export interface MailClient {
  fetchUnreadEmails(query: string, maxResults: number): Promise<IncomingEmail[]>;
  markAsRead(messageId: string): Promise<void>;
  sendEmail(to: string, subject: string, body: string, threadId?: string): Promise<string>;
}
