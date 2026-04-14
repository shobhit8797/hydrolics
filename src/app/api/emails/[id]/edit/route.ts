import { NextResponse } from "next/server";
import { updateDraftBody } from "@/lib/email/email-agent";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const editedBody = (body as Record<string, unknown>).body as string;

    if (!editedBody) {
      return NextResponse.json({ error: "Body text is required" }, { status: 400 });
    }

    const updated = await updateDraftBody(id, editedBody);
    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Edit failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
