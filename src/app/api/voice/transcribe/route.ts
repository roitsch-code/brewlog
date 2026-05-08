import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/requireAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MIN_BYTES = 1024;            // ~drop empty/silent recordings
const MAX_BYTES = 25 * 1024 * 1024; // Whisper hard limit

export async function POST(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Voice transcription not configured." }, { status: 503 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form body." }, { status: 400 });
  }

  const file = form.get("audio");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing 'audio' field." }, { status: 400 });
  }
  if (file.size < MIN_BYTES) {
    return NextResponse.json({ error: "Recording too short." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Recording too large (25 MB max)." }, { status: 413 });
  }

  const upstream = new FormData();
  // Whisper infers format from filename extension; default to .webm if missing.
  const filename = file.name && file.name.includes(".") ? file.name : "voice.webm";
  upstream.append("file", file, filename);
  upstream.append("model", "whisper-1");
  upstream.append("response_format", "json");
  upstream.append("temperature", "0");

  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upstream,
    });
  } catch {
    return NextResponse.json({ error: "Transcription service unreachable." }, { status: 502 });
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("[voice/transcribe] upstream error", res.status, detail.slice(0, 300));
    return NextResponse.json({ error: "Transcription failed." }, { status: 502 });
  }

  const data = await res.json().catch(() => null) as { text?: string } | null;
  const text = (data?.text ?? "").trim();
  return NextResponse.json({ text });
}
