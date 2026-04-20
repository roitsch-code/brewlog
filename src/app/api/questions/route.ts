import { NextResponse } from "next/server";
import { getQuestions } from "@/lib/knowledge/questions";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const questions = await getQuestions();
    // Shuffle and return a random subset of 6
    const shuffled = [...questions].sort(() => Math.random() - 0.5);
    return NextResponse.json({ items: shuffled.slice(0, 6) });
  } catch (err) {
    console.error("questions/route error:", err);
    return NextResponse.json({ items: [] }, { status: 500 });
  }
}
