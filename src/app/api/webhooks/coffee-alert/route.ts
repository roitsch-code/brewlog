import { NextRequest, NextResponse } from "next/server";
import { saveAlert } from "@/lib/knowledge/alerts";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // Verify webhook secret
  const secret = req.headers.get("x-coffee-alert-secret");
  const expectedSecret = process.env.COFFEE_ALERT_WEBHOOK_SECRET;

  if (!expectedSecret || secret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json() as {
      roaster: string;
      coffeeName: string;
      origin: string;
      process?: string;
      score: number;
      summary: string;
      url?: string;
    };

    const { roaster, coffeeName, origin, process, score, summary, url } = body;

    if (!roaster || !coffeeName || !origin || typeof score !== "number" || !summary) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const id = await saveAlert({
      roaster,
      coffeeName,
      origin,
      process,
      score,
      summary,
      url,
      alertedAt: new Date().toISOString(),
      read: false,
    });

    return NextResponse.json({ ok: true, id });
  } catch (err) {
    console.error("coffee-alert webhook error:", err);
    return NextResponse.json({ error: "Failed to save alert" }, { status: 500 });
  }
}
