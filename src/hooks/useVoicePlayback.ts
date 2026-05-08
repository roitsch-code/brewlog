"use client";
import { useCallback, useEffect, useRef, useState } from "react";

interface QueueItem {
  text: string;
  controller: AbortController;
  blobUrl?: string;
  ready?: Promise<string | null>;
}

interface VoicePlayback {
  speaking: boolean;
  enqueue: (text: string) => void;
  cancel: () => void;
  unlock: () => void;
}

// 1-frame silent MP3 — tiny payload that can be played inside a click handler
// to satisfy iOS's "audio requires a user gesture" rule. Subsequent <audio>
// playback on the same element then plays without further gestures.
const SILENT_MP3 =
  "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQxAADB8AhSmxhIIEVCSiJrDCQBTcu3UrAIwUdkRgQbFAZC1CQEwTJ9mjRvBA4UOLD8nKVOWfh+UlK3z/177OXrfOdKl7pyn3Xf//FJAhAAQ0pHWIVy/+RwY/E5Q9Pm8RzXukXQGV6kUZ8BZAOQYwYjB0jWhmosVsoGcaSkBoXszLhRX0cs7FSdANtPMBjGNBwwCgFcuABNBvLqSVYsyhixYwBrwFqUQQOpc5gIglhgKAZagYZAAQGwOQAAEAB6QM4G7v5z+MWvjz53t//XOhMVqcrZuDxzEMbo7///8/+P2P//5+9/I0eVHV9jCjEvjknkn0eQAAGgAEAVQEMSCgwwoQAVtCGNCQXjAQAEpwTeYxFKaxdQ6tBKoCp5L+5b7YWl4FFrpL4u/s7L86bZ9V/9NGr0NLeuv/zXV/eylPe/8+u9F1IHGQ8nIRZ9Zayuel9F5o0wTHVvkEymAVZNxgAAFcoo0BeYUmSO0BPkKuwG4Z2gXgYi4mAYG2rRkM5znrtTW6+Va1uzMvL07/RVRbREfqJTZG+yMlrEbiKOxlcjjXY8O7jcK/i9CBz2sdj5dx+9hFMtjxwKkvAd8b4ROegjy7DxgQYcgQ06TY9YVjhQOlSjkr1WdFEdr3FvGrYnUjuPbu/vS6707iVqMtXBvaepZ09/8x4aZjT9VVEEH9PNHDh5//9Es55t//s+QU1qWUlsoy1oUeUqUw3oDhUAAhgKQVIWAaAUEFFAk9CAjgNNkjMoa2NyMy1zopMNiub84o2Pl4Y/dHxzvTnTu0+pvzKlQ6vrZ8Q3/8/8d//3Pcrs1y/zeoKUUTkJ81rVoq2sJsZJyP10VfbA";

const MIN_TEXT = 2;
const MAX_TEXT = 1000;
const MAX_AHEAD = 2;

export function useVoicePlayback(): VoicePlayback {
  const [speaking, setSpeaking] = useState(false);

  const queueRef = useRef<QueueItem[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playingRef = useRef(false);
  const unlockedRef = useRef(false);
  const cancelledRef = useRef(false);

  const ensureAudio = useCallback((): HTMLAudioElement => {
    if (audioRef.current) return audioRef.current;
    const el = new Audio();
    el.preload = "auto";
    audioRef.current = el;
    return el;
  }, []);

  const unlock = useCallback(() => {
    if (unlockedRef.current) return;
    const el = ensureAudio();
    try {
      el.src = SILENT_MP3;
      const p = el.play();
      if (p && typeof p.then === "function") p.catch(() => { /* ignore */ });
      unlockedRef.current = true;
    } catch { /* ignore */ }
  }, [ensureAudio]);

  const fetchTts = useCallback((item: QueueItem): Promise<string | null> => {
    if (item.ready) return item.ready;
    const promise = (async () => {
      try {
        const res = await fetch("/api/voice/synthesize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: item.text }),
          signal: item.controller.signal,
        });
        if (!res.ok) return null;
        const blob = await res.blob();
        if (item.controller.signal.aborted) return null;
        const url = URL.createObjectURL(blob);
        item.blobUrl = url;
        return url;
      } catch {
        return null;
      }
    })();
    item.ready = promise;
    return promise;
  }, []);

  const playNext = useCallback(async () => {
    if (playingRef.current) return;
    playingRef.current = true;
    setSpeaking(true);

    while (queueRef.current.length > 0 && !cancelledRef.current) {
      const item = queueRef.current[0];

      // Pre-fetch a small window of upcoming sentences in parallel
      for (let i = 1; i <= MAX_AHEAD && i < queueRef.current.length; i++) {
        void fetchTts(queueRef.current[i]);
      }

      const url = await fetchTts(item);
      // Item may have been cancelled while we were waiting for the network.
      if (cancelledRef.current) {
        if (item.blobUrl) URL.revokeObjectURL(item.blobUrl);
        break;
      }
      // Drop the head — it's been consumed (success or failure).
      queueRef.current.shift();
      if (!url) continue;

      const el = ensureAudio();
      try {
        el.src = url;
        const ended = new Promise<void>(resolve => {
          const cleanup = () => {
            el.removeEventListener("ended", onEnd);
            el.removeEventListener("error", onErr);
            resolve();
          };
          const onEnd = () => cleanup();
          const onErr = () => cleanup();
          el.addEventListener("ended", onEnd);
          el.addEventListener("error", onErr);
        });
        const playPromise = el.play();
        if (playPromise && typeof playPromise.then === "function") {
          try { await playPromise; } catch { /* swallow — fall through to ended */ }
        }
        await ended;
      } finally {
        URL.revokeObjectURL(url);
        item.blobUrl = undefined;
      }
    }

    playingRef.current = false;
    setSpeaking(false);
    cancelledRef.current = false;
  }, [ensureAudio, fetchTts]);

  const enqueue = useCallback((text: string) => {
    const trimmed = text.trim();
    if (trimmed.length < MIN_TEXT) return;
    const chunks: string[] = [];
    let remaining = trimmed;
    while (remaining.length > MAX_TEXT) {
      const slice = remaining.slice(0, MAX_TEXT);
      const cut = Math.max(slice.lastIndexOf(" "), MAX_TEXT - 1);
      chunks.push(slice.slice(0, cut));
      remaining = remaining.slice(cut).trim();
    }
    if (remaining.length > 0) chunks.push(remaining);

    for (const chunk of chunks) {
      queueRef.current.push({ text: chunk, controller: new AbortController() });
    }
    if (!playingRef.current) void playNext();
  }, [playNext]);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    for (const item of queueRef.current) {
      try { item.controller.abort(); } catch { /* ignore */ }
      if (item.blobUrl) URL.revokeObjectURL(item.blobUrl);
    }
    queueRef.current = [];
    const el = audioRef.current;
    if (el) {
      try { el.pause(); } catch { /* ignore */ }
      el.removeAttribute("src");
      el.load();
    }
    setSpeaking(false);
  }, []);

  useEffect(() => () => { cancel(); }, [cancel]);

  return { speaking, enqueue, cancel, unlock };
}
