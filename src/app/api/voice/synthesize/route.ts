import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/requireAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; // Rachel
const MAX_TEXT_LEN = 1000;

export async function POST(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Voice playback not configured." }, { status: 503 });
  }

  let body: { text?: string; voiceId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const text = (body.text ?? "").trim();
  if (!text) {
    return NextResponse.json({ error: "Missing 'text'." }, { status: 400 });
  }
  if (text.length > MAX_TEXT_LEN) {
    return NextResponse.json({ error: "Text too long for a single chunk." }, { status: 413 });
  }

  const voiceId = body.voiceId || process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;
  const baseUrl = process.env.ELEVENLABS_BASE_URL || "https://api.elevenlabs.io";
  const url =
    `${baseUrl}/v1/text-to-speech/${encodeURIComponent(voiceId)}/stream` +
    `?optimize_streaming_latency=3&output_format=mp3_44100_128`;

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_turbo_v2_5",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    });
  } catch {
    return NextResponse.json({ error: "Voice service unreachable." }, { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    console.error("[voice/synthesize] upstream error", upstream.status, detail.slice(0, 300));
    return NextResponse.json({ error: "Voice synthesis failed." }, { status: 502 });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
    },
  });
}
