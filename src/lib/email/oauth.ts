import { google } from "googleapis";
import type { MailboxProvider } from "./auth-store";

const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/userinfo.email",
];

const OUTLOOK_SCOPES = [
  "offline_access",
  "User.Read",
  "Mail.ReadWrite",
  "Mail.Send",
];

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export function hasProviderOAuthConfig(provider: MailboxProvider): boolean {
  if (provider === "gmail") {
    return Boolean(process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET);
  }

  return Boolean(
    process.env.OUTLOOK_CLIENT_ID && process.env.OUTLOOK_CLIENT_SECRET && process.env.OUTLOOK_TENANT_ID
  );
}

export function getOAuthCallbackUrl(provider: MailboxProvider, origin: string): string {
  return `${origin}/api/emails/auth/callback/${provider}`;
}

export function getGmailAuthUrl(origin: string, state: string): string {
  const oauth2 = new google.auth.OAuth2(
    requiredEnv("GMAIL_CLIENT_ID"),
    requiredEnv("GMAIL_CLIENT_SECRET"),
    getOAuthCallbackUrl("gmail", origin)
  );

  return oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GMAIL_SCOPES,
    state,
  });
}

export async function exchangeGmailCode(origin: string, code: string) {
  const oauth2 = new google.auth.OAuth2(
    requiredEnv("GMAIL_CLIENT_ID"),
    requiredEnv("GMAIL_CLIENT_SECRET"),
    getOAuthCallbackUrl("gmail", origin)
  );
  const { tokens } = await oauth2.getToken(code);
  oauth2.setCredentials(tokens);

  const oauth2Api = google.oauth2({ version: "v2", auth: oauth2 });
  const user = await oauth2Api.userinfo.get();
  const userEmail = user.data.email;
  if (!userEmail) {
    throw new Error("Gmail account email not available from OAuth response");
  }

  const refreshToken = tokens.refresh_token;
  if (!refreshToken) {
    throw new Error("Gmail refresh token missing; re-authenticate and grant offline access");
  }

  return {
    refreshToken,
    userEmail,
  };
}

export function getOutlookAuthUrl(origin: string, state: string): string {
  const tenantId = requiredEnv("OUTLOOK_TENANT_ID");
  const clientId = requiredEnv("OUTLOOK_CLIENT_ID");
  const redirectUri = getOAuthCallbackUrl("outlook", origin);
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    response_mode: "query",
    scope: OUTLOOK_SCOPES.join(" "),
    state,
  });

  return `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/authorize?${params.toString()}`;
}

export async function exchangeOutlookCode(origin: string, code: string) {
  const tenantId = requiredEnv("OUTLOOK_TENANT_ID");
  const clientId = requiredEnv("OUTLOOK_CLIENT_ID");
  const clientSecret = requiredEnv("OUTLOOK_CLIENT_SECRET");
  const redirectUri = getOAuthCallbackUrl("outlook", origin);
  const tokenEndpoint = `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`;

  const tokenBody = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    scope: OUTLOOK_SCOPES.join(" "),
  });

  const tokenRes = await fetch(tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: tokenBody,
    cache: "no-store",
  });

  if (!tokenRes.ok) {
    const details = await tokenRes.text();
    throw new Error(`Outlook token exchange failed: ${details}`);
  }

  const tokenJson = (await tokenRes.json()) as {
    access_token: string;
    refresh_token?: string;
  };

  if (!tokenJson.refresh_token) {
    throw new Error("Outlook refresh token missing; re-authenticate and grant offline access");
  }

  const meRes = await fetch("https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${tokenJson.access_token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!meRes.ok) {
    const details = await meRes.text();
    throw new Error(`Outlook profile lookup failed: ${details}`);
  }

  const me = (await meRes.json()) as { mail?: string; userPrincipalName?: string };
  const userEmail = me.mail || me.userPrincipalName;
  if (!userEmail) {
    throw new Error("Outlook account email not available from OAuth response");
  }

  return {
    refreshToken: tokenJson.refresh_token,
    userEmail,
    tenantId,
  };
}
