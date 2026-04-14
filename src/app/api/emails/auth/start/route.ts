import { NextResponse } from "next/server";
import { createOauthState } from "@/lib/email/oauth-state";
import { getGmailAuthUrl, getOutlookAuthUrl, hasProviderOAuthConfig } from "@/lib/email/oauth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const provider = url.searchParams.get("provider");

  if (provider !== "gmail" && provider !== "outlook") {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }

  if (!hasProviderOAuthConfig(provider)) {
    return NextResponse.json(
      { error: `${provider} OAuth is not configured in environment variables` },
      { status: 400 }
    );
  }

  try {
    const state = createOauthState(provider);
    const origin = url.origin;
    const authUrl = provider === "gmail" ? getGmailAuthUrl(origin, state) : getOutlookAuthUrl(origin, state);
    return NextResponse.redirect(authUrl);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to start OAuth flow";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
