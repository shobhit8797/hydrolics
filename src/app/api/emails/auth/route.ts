import { NextResponse } from "next/server";
import {
  clearProviderSession,
  getAuthStore,
  setActiveProvider,
  type MailboxProvider,
} from "@/lib/email/auth-store";
import { hasProviderOAuthConfig } from "@/lib/email/oauth";
import { getEmailConfig } from "@/lib/email/config";

export const dynamic = "force-dynamic";

function authSummary() {
  const store = getAuthStore();
  const config = getEmailConfig();
  const hasGmailEnvMailbox = Boolean(
    process.env.GMAIL_CLIENT_ID &&
      process.env.GMAIL_CLIENT_SECRET &&
      process.env.GMAIL_REFRESH_TOKEN
  );
  const hasOutlookEnvMailbox = Boolean(
    process.env.OUTLOOK_TENANT_ID &&
      process.env.OUTLOOK_CLIENT_ID &&
      process.env.OUTLOOK_CLIENT_SECRET &&
      process.env.OUTLOOK_USER_EMAIL
  );

  return {
    activeProvider: store.activeProvider,
    defaultProvider: config.mailboxProvider,
    envMailboxReady: {
      gmail: hasGmailEnvMailbox,
      outlook: hasOutlookEnvMailbox,
    },
    providers: {
      gmail: {
        configured: hasProviderOAuthConfig("gmail"),
        connected: Boolean(store.gmail),
        userEmail: store.gmail?.userEmail ?? null,
      },
      outlook: {
        configured: hasProviderOAuthConfig("outlook"),
        connected: Boolean(store.outlook),
        userEmail: store.outlook?.userEmail ?? null,
      },
    },
  };
}

export async function GET() {
  return NextResponse.json(authSummary());
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const action = body.action;
    const provider = body.provider;

    if (provider !== "gmail" && provider !== "outlook") {
      return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
    }

    if (action === "set-active") {
      const store = getAuthStore();
      const connected = provider === "gmail" ? Boolean(store.gmail) : Boolean(store.outlook);
      if (!connected) {
        return NextResponse.json({ error: "Provider is not connected yet" }, { status: 400 });
      }
      setActiveProvider(provider);
      return NextResponse.json(authSummary());
    }

    if (action === "disconnect") {
      clearProviderSession(provider as MailboxProvider);
      return NextResponse.json(authSummary());
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Auth request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
