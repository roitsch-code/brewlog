"use client";

/**
 * useAcaiaScale — React wrapper over the Acaia BLE manager.
 *
 * Exposes live weight + connection status and connect/disconnect/tare actions.
 * `available` is false everywhere except inside the native shell, so consumers
 * can hide the whole scale UI on the Safari PWA. Everything is try/caught and a
 * no-op off the shell — importing this hook never touches BLE until connect()
 * is called (the plugin is dynamically imported inside the manager).
 */
import { useCallback, useEffect, useRef, useState } from "react";

import {
  acaiaCapable,
  connectAcaia,
  disconnectAcaia,
  type AcaiaHandle,
  type AcaiaStatus,
} from "@/lib/native/acaia/manager";

export type AcaiaUiStatus = AcaiaStatus | "idle";

export interface UseAcaiaScale {
  available: boolean;
  status: AcaiaUiStatus;
  weight: number | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  tare: () => void;
}

export interface UseAcaiaScaleOptions {
  /** Called on every weight sample with a wall-clock timestamp — feeds the live
   * flow coach's rolling window. Additive; no effect off the native shell. */
  onSample?: (grams: number, atMs: number) => void;
}

export function useAcaiaScale(opts: UseAcaiaScaleOptions = {}): UseAcaiaScale {
  const onSampleRef = useRef(opts.onSample);
  onSampleRef.current = opts.onSample;
  // Resolve capability after mount so SSR markup stays stable (server = false).
  const [available, setAvailable] = useState(false);
  const [status, setStatus] = useState<AcaiaUiStatus>("idle");
  const [weight, setWeight] = useState<number | null>(null);
  const handleRef = useRef<AcaiaHandle | null>(null);

  useEffect(() => {
    setAvailable(acaiaCapable());
  }, []);

  const connect = useCallback(async () => {
    if (!acaiaCapable() || handleRef.current) return;
    try {
      const handle = await connectAcaia({
        onWeight: (grams) => {
          setWeight(grams);
          onSampleRef.current?.(grams, Date.now());
        },
        onStatus: (s) => setStatus(s),
      });
      handleRef.current = handle;
    } catch {
      handleRef.current = null;
      // Manager already pushed a terminal status (not-found / error / unsupported).
    }
  }, []);

  const disconnect = useCallback(async () => {
    handleRef.current = null;
    setWeight(null);
    setStatus("idle");
    try {
      await disconnectAcaia();
    } catch {
      /* ignore */
    }
  }, []);

  const tare = useCallback(() => {
    try {
      handleRef.current?.tare();
    } catch {
      /* ignore */
    }
  }, []);

  // Drop the BLE link if the brew screen unmounts mid-connection.
  useEffect(() => {
    return () => {
      if (handleRef.current) {
        handleRef.current = null;
        void disconnectAcaia();
      }
    };
  }, []);

  return { available, status, weight, connect, disconnect, tare };
}
