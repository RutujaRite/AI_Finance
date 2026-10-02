import { NextRequest, NextResponse } from "next/server";
import { processAntigravityWebhook, WebhookRequestPayload } from "@/lib/ai/antigravityWebhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body: WebhookRequestPayload = await req.json().catch(() => ({}));
    const result = await processAntigravityWebhook(body);
    return NextResponse.json({ success: true, ...result }, { status: 200 });
  } catch (error: any) {
    console.error("[Antigravity Webhook] Error processing request:", error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Webhook processing error",
      },
      { status: 500 }
    );
  }
}
