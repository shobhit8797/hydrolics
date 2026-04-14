import { getEmailConfig, getGmailCredentials, getOutlookCredentials } from "./config";
import type { MailClient } from "./mail-client";
import { GmailClient } from "./gmail";
import { OutlookClient } from "./outlook";
import { getAuthStore } from "./auth-store";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export function createMailClient(provider?: "gmail" | "outlook"): MailClient {
  const config = getEmailConfig();
  const authStore = getAuthStore();
  const selectedProvider = provider ?? authStore.activeProvider ?? config.mailboxProvider;

  if (selectedProvider === "gmail") {
    if (authStore.gmail) {
      return new GmailClient({
        clientId: requiredEnv("GMAIL_CLIENT_ID"),
        clientSecret: requiredEnv("GMAIL_CLIENT_SECRET"),
        refreshToken: authStore.gmail.refreshToken,
        userEmail: authStore.gmail.userEmail,
      });
    }
    return new GmailClient(getGmailCredentials());
  }

  if (authStore.outlook) {
    return new OutlookClient({
      tenantId: authStore.outlook.tenantId,
      clientId: requiredEnv("OUTLOOK_CLIENT_ID"),
      clientSecret: requiredEnv("OUTLOOK_CLIENT_SECRET"),
      refreshToken: authStore.outlook.refreshToken,
      userEmail: authStore.outlook.userEmail,
    });
  }
  return new OutlookClient(getOutlookCredentials());
}
