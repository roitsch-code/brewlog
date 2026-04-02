import { NextRequest, NextResponse } from "next/server";
import { analyzeBagImage } from "@/lib/claude/analyzeBag";
import { logTokenUsage } from "@/lib/claude/logUsage";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("image") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    const mimeType = file.type || "image/jpeg";

    const { result, usage } = await analyzeBagImage(base64, mimeType);
    void logTokenUsage({ endpoint: "analyze-bag", model: "claude-sonnet-4-6", usage, userId: "user" });
    return NextResponse.json(result);
  } catch (err) {
    console.error("analyze-bag error:", err);
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }
}
