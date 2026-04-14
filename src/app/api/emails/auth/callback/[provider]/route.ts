import { NextResponse } from "next/server";
import { consumeOauthState } from "@/lib/email/oauth-state";
import { exchangeGmailCode, exchangeOutlookCode } from "@/lib/email/oauth";
import { upsertGmailSession, upsertOutlookSession } from "@/lib/email/auth-store";

export const dynamic = "force-dynamic";

function popupResponse(
  status: "success" | "error",
  provider: "gmail" | "outlook",
  message?: string
) {
  const payload = {
    type: "email-auth",
    status,
    provider,
    message: message || null,
  };

  const html = `<!doctype html>
<html>
  <head><meta charset="utf-8"><title>Email Auth</title></head>
  <body>
    <script>
      (function() {
        var payload = ${JSON.stringify(payload)};
        if (window.opener) {
          window.opener.postMessage(payload, window.location.origin);
          window.close();
          return;
        }
        var qs = new URLSearchParams({
          emailAuthStatus: payload.status,
          emailAuthProvider: payload.provider,
          emailAuthMessage: payload.message || ""
        });
        window.location.href = "/?" + qs.toString();
      })();
    </script>
  </body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;
  if (provider !== "gmail" && provider !== "outlook") {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const authError = url.searchParams.get("error");

  if (authError) {
    return popupResponse("error", provider, authError);
  }

  if (!code || !state) {
    return popupResponse("error", provider, "Missing OAuth callback parameters");
  }

  if (!consumeOauthState(state, provider)) {
    return popupResponse("error", provider, "Invalid or expired OAuth state");
  }

  try {
    if (provider === "gmail") {
      const gmail = await exchangeGmailCode(url.origin, code);
      upsertGmailSession(gmail.refreshToken, gmail.userEmail);
    } else {
      const outlook = await exchangeOutlookCode(url.origin, code);
      upsertOutlookSession(outlook.refreshToken, outlook.userEmail, outlook.tenantId);
    }

    return popupResponse("success", provider);
  } catch (err) {
    const message = err instanceof Error ? err.message : "OAuth callback failed";
    return popupResponse("error", provider, message);
  }
}
