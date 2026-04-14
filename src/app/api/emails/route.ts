import { NextResponse } from "next/server";
import { getAllEmails, getEmailStats, getLastPollTime } from "@/lib/email/email-store";
import { pollAndProcessEmails, regenerateFailedDrafts } from "@/lib/email/email-agent";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const emails = getAllEmails();
    const stats = getEmailStats();
    const lastPoll = getLastPollTime();
    return NextResponse.json({ emails, stats, lastPoll });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch emails";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = (body as Record<string, unknown>).action;
    const provider = (body as Record<string, unknown>).provider;

    if (action === "poll") {
      const selectedProvider = provider === "gmail" || provider === "outlook" ? provider : undefined;
      const result = await pollAndProcessEmails(selectedProvider);
      return NextResponse.json(result);
    }

    if (action === "retry_failed") {
      const result = await regenerateFailedDrafts();
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Poll failed";
    console.error("Email poll error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
