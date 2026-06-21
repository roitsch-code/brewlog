import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/requireAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MIN_BYTES = 1024;             // drop empty/silent recordings
const MAX_BYTES = 25 * 1024 * 1024; // sanity cap; Scribe accepts much more

export async function POST(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  const apiKey = process.env.ELEVENLABS_API_KEY;
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
  const filename = file.name && file.name.includes(".") ? file.name : "voice.webm";
  upstream.append("file", file, filename);
  upstream.append("model_id", "scribe_v1");
  // Don't transcribe non-speech sounds — otherwise Scribe tags the "I'm
  // listening" earcon (and any kettle/clatter) as e.g. "(computer chirp)".
  upstream.append("tag_audio_events", "false");

  const baseUrl = process.env.ELEVENLABS_BASE_URL || "https://api.elevenlabs.io";

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/v1/speech-to-text`, {
      method: "POST",
      headers: { "xi-api-key": apiKey },
      body: upstream,
    });
  } catch {
    return NextResponse.json({ error: "Transcription service unreachable." }, { status: 502 });
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("[voice/transcribe] upstream error", res.status, detail.slice(0, 500));
    const snippet = detail.slice(0, 300).replace(/\s+/g, " ").trim();
    return NextResponse.json(
      { error: `Scribe ${res.status}: ${snippet || "(no body)"}` },
      { status: 502 },
    );
  }

  const data = await res.json().catch(() => null) as { text?: string } | null;
  const text = stripAudioEventTags(data?.text ?? "");
  return NextResponse.json({ text });
}

/**
 * Defensive backstop to `tag_audio_events=false`: Scribe annotates non-speech
 * sounds in parentheses — "(computer chirp)", "(laughter)", "(footsteps)".
 * Spoken speech is never parenthesised, so dropping short bracketed segments
 * strips any stray sound tag without touching real words.
 */
function stripAudioEventTags(raw: string): string {
  return raw
    .replace(/\([^)]{0,40}\)/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}
