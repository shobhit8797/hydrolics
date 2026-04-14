import { NextResponse } from "next/server";
import { sendEmailResponse } from "@/lib/email/email-agent";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const customBody = (body as Record<string, unknown>).body as string | undefined;

    const updated = await sendEmailResponse(id, customBody);
    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Send failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
