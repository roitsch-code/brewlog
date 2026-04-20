import { NextResponse } from "next/server";
import { getNews } from "@/lib/knowledge/news";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const items = await getNews(30);
    return NextResponse.json({ items });
  } catch (err) {
    console.error("news GET error:", err);
    return NextResponse.json({ items: [] });
  }
}
