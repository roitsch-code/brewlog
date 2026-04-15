import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { getAlerts, markRead } from "@/lib/knowledge/alerts";

export async function GET() {
  try {
    const alerts = await getAlerts(20);
    return NextResponse.json({ alerts });
  } catch (err) {
    console.error("alerts/route GET error:", err);
    return NextResponse.json({ alerts: [] }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json() as { id: string };
    if (!body.id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    await markRead(body.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("alerts/route PATCH error:", err);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}
