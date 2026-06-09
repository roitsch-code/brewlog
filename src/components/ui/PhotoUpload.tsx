"use client";
import { useRef } from "react";
import { cn } from "@/lib/utils/cn";
import Image from "next/image";
import CoffeeBeanGlow from "@/components/ui/CoffeeBeanGlow";

interface PhotoUploadProps {
  onFile: (file: File) => void;
  preview?: string;
  loading?: boolean;
  className?: string;
}

export default function PhotoUpload({ onFile, preview, loading, className }: PhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  return (
    <div className={cn("relative", className)}>
      {/* Library picker — no capture attribute */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
      {/* Camera direct */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />

      {preview ? (
        /* Preview — with loading overlay while analysing */
        <div className="relative w-full h-44 rounded-2xl overflow-hidden border border-brew-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Coffee bag" className={`w-full h-full object-cover transition-opacity duration-300 ${loading ? "opacity-40" : "opacity-100"}`} />
          {loading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <CoffeeBeanGlow size={56} />
              <span className="text-white/70 text-xs tracking-widest uppercase">Reading label…</span>
            </div>
          ) : (
            <div className="absolute bottom-0 left-0 right-0 flex gap-2 p-3">
              <button
                type="button"
                onClick={() => cameraRef.current?.click()}
                className="flex-1 py-2 rounded-xl bg-black/60 backdrop-blur text-white text-xs font-medium"
              >
                Retake
              </button>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="flex-1 py-2 rounded-xl bg-black/60 backdrop-blur text-white text-xs font-medium"
              >
                Choose other
              </button>
            </div>
          )}
        </div>
      ) : loading ? (
        <div className="w-full h-44 rounded-2xl bg-brew-surface border border-brew-border flex flex-col items-center justify-center gap-2">
          <svg className="animate-spin h-8 w-8 text-brew-accent" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-brew-muted text-sm">Analyzing bag…</span>
        </div>
      ) : (
        /* Empty state — two tap targets */
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            className="flex-1 h-36 rounded-2xl border border-brew-border bg-brew-surface flex flex-col items-center justify-center gap-2 active:scale-95 transition-all"
          >
            <svg className="w-6 h-6 text-brew-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-white text-sm font-medium">Camera</span>
          </button>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex-1 h-36 rounded-2xl border border-brew-border bg-brew-surface flex flex-col items-center justify-center gap-2 active:scale-95 transition-all"
          >
            <svg className="w-6 h-6 text-brew-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-white text-sm font-medium">Library</span>
          </button>
        </div>
      )}
    </div>
  );
}
