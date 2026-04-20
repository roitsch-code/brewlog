import { NextResponse } from "next/server";
import { getInsights } from "@/lib/knowledge/insights";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const items = await getInsights(20);
    return NextResponse.json({ items });
  } catch (err) {
    console.error("insights/route error:", err);
    return NextResponse.json({ items: [] }, { status: 500 });
  }
}
