"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { playListeningCue } from "@/lib/audio/listeningCue";

interface Options {
  onTranscript: (text: string) => void;
  onError?: (message: string) => void;
}

interface VoiceCapture {
  recording: boolean;
  busy: boolean;
  error: string | null;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  /** Abort an in-flight recording without transcribing. */
  cancel: () => void;
  toggle: () => Promise<void>;
  clearError: () => void;
  /** Snapshot the current input level normalised 0..1, or 0 when idle. */
  getLevel: () => number;
}

function pickMimeType(): string | undefined {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") return undefined;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/mp4;codecs=mp4a.40.2",
  ];
  for (const t of candidates) {
    try { if (MediaRecorder.isTypeSupported(t)) return t; } catch { /* ignore */ }
  }
  return undefined;
}

export function useVoiceCapture({ onTranscript, onError }: Options): VoiceCapture {
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const mimeRef = useRef<string | undefined>(undefined);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const levelBufferRef = useRef<Uint8Array | null>(null);

  const teardownAnalyser = useCallback(() => {
    try { sourceNodeRef.current?.disconnect(); } catch { /* ignore */ }
    sourceNodeRef.current = null;
    analyserRef.current = null;
    levelBufferRef.current = null;
    if (audioCtxRef.current) {
      const ctx = audioCtxRef.current;
      audioCtxRef.current = null;
      // close() is async — fire and forget; errors here don't matter.
      ctx.close().catch(() => { /* ignore */ });
    }
  }, []);

  const teardownStream = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    teardownAnalyser();
  }, [teardownAnalyser]);

  const surfaceError = useCallback((msg: string) => {
    setError(msg);
    onError?.(msg);
  }, [onError]);

  const start = useCallback(async () => {
    if (recording || busy) return;
    setError(null);
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      surfaceError("Microphone not supported on this browser.");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        surfaceError("Microphone blocked. Open iOS Settings → BrewLog → Microphone to enable.");
      } else if (name === "NotFoundError") {
        surfaceError("No microphone found.");
      } else {
        surfaceError("Couldn't access the microphone.");
      }
      return;
    }
    streamRef.current = stream;
    // Analyser for live waveform rendering. Errors here mustn't block recording —
    // worst case the waveform sits flat.
    try {
      const Ctor: typeof AudioContext | undefined =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctor) {
        const ctx = new Ctor();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.4;
        source.connect(analyser);
        audioCtxRef.current = ctx;
        sourceNodeRef.current = source;
        analyserRef.current = analyser;
        levelBufferRef.current = new Uint8Array(analyser.fftSize);
      }
    } catch { /* analyser optional */ }
    const mime = pickMimeType();
    mimeRef.current = mime;
    let recorder: MediaRecorder;
    try {
      recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    } catch {
      teardownStream();
      surfaceError("This browser can't record audio.");
      return;
    }
    chunksRef.current = [];
    recorder.ondataavailable = ev => {
      if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
    };
    recorderRef.current = recorder;
    recorder.start(250);
    setRecording(true);
    // The mic is now hot — sound the "BTTS is listening" earcon so the user
    // knows they can speak (bridges the Siri-launch handoff; also confirms a tap).
    playListeningCue();
  }, [recording, busy, surfaceError, teardownStream]);

  const stop = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder || !recording) return;

    setBusy(true);
    try {
      const stopped = new Promise<void>(resolve => {
        recorder.addEventListener("stop", () => resolve(), { once: true });
      });
      try { recorder.stop(); } catch { /* ignore */ }
      await stopped;
      setRecording(false);
      recorderRef.current = null;
      teardownStream();

      const mime = mimeRef.current ?? "audio/webm";
      const blob = new Blob(chunksRef.current, { type: mime });
      chunksRef.current = [];

      if (blob.size < 1024) {
        surfaceError("Didn't catch that — try holding the mic a bit longer.");
        return;
      }

      const ext = mime.includes("mp4") ? "m4a" : "webm";
      const form = new FormData();
      form.append("audio", blob, `voice.${ext}`);

      let res: Response;
      try {
        res = await fetch("/api/voice/transcribe", { method: "POST", body: form });
      } catch {
        surfaceError("Couldn't reach BrewLog. Check your connection.");
        return;
      }
      const data = await res.json().catch(() => null) as { text?: string; error?: string } | null;
      if (!res.ok) {
        surfaceError(data?.error ?? `Transcription failed (${res.status}).`);
        return;
      }
      const text = data?.text?.trim() ?? "";
      if (!text) {
        surfaceError("Didn't catch that — try again.");
        return;
      }
      onTranscript(text);
    } finally {
      setBusy(false);
    }
  }, [recording, onTranscript, surfaceError, teardownStream]);

  const cancel = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder) {
      try { recorder.stop(); } catch { /* ignore */ }
    }
    recorderRef.current = null;
    chunksRef.current = [];
    setRecording(false);
    teardownStream();
  }, [teardownStream]);

  const toggle = useCallback(async () => {
    if (recording) await stop();
    else await start();
  }, [recording, start, stop]);

  const clearError = useCallback(() => setError(null), []);

  // Pulls the current peak amplitude (0..1) from the analyser. Returns 0
  // when no analyser exists (e.g. browser doesn't support AudioContext).
  const getLevel = useCallback(() => {
    const analyser = analyserRef.current;
    const buf = levelBufferRef.current;
    if (!analyser || !buf) return 0;
    // The DOM lib types getByteTimeDomainData more strictly than the
    // runtime needs; cast through the underlying ArrayBufferView interface.
    analyser.getByteTimeDomainData(buf as unknown as Uint8Array<ArrayBuffer>);
    // Peak deviation from 128 (silence midpoint).
    let peak = 0;
    for (let i = 0; i < buf.length; i++) {
      const dev = Math.abs(buf[i] - 128);
      if (dev > peak) peak = dev;
    }
    return Math.min(peak / 128, 1);
  }, []);

  useEffect(() => () => {
    try { recorderRef.current?.stop(); } catch { /* ignore */ }
    teardownStream();
  }, [teardownStream]);

  return { recording, busy, error, start, stop, cancel, toggle, clearError, getLevel };
}
