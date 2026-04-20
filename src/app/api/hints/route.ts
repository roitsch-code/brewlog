import { NextResponse } from "next/server";
import { getHints } from "@/lib/knowledge/hints";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const hints = await getHints();
    return NextResponse.json({ hints });
  } catch (err) {
    console.error("hints/route error:", err);
    return NextResponse.json({ hints: [] }, { status: 500 });
  }
}
