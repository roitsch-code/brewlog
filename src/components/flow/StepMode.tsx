"use client";
import Image from "next/image";
import { useFlowStore } from "@/store/flowStore";
import { useRouter } from "next/navigation";

const MODES = [
  {
    id: "home" as const,
    label: "Home Brew",
    sub: "Get a recipe recommendation, brew with a timer, document the result.",
    img: "/images/mode-home.jpg",
  },
  {
    id: "external" as const,
    label: "Coffee Shop",
    sub: "Visiting a café? Document what you had and how it tasted.",
    img: "/images/mode-external.jpg",
  },
];

export default function StepMode() {
  const { setMode, setStep } = useFlowStore();
  const router = useRouter();

  const choose = (mode: "home" | "external") => {
    setMode(mode);
    setStep("scan");
  };

  return (
    <div className="min-h-svh flex flex-col bg-brew-bg px-5 pt-safe">
      {/* Back to home */}
      <div className="flex items-center pt-4 pb-8">
        <button onClick={() => router.push("/")} className="text-white/60 hover:text-white transition-colors">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      <div className="flex-1 flex flex-col gap-8 pt-6">
        {/* Title */}
        <div>
          <p className="text-brew-muted text-xs tracking-widest uppercase mb-2">New Session</p>
          <h1 className="font-display text-2xl text-white">Where are you brewing?</h1>
        </div>

        {/* Options */}
        <div className="flex flex-col gap-4">
          {MODES.map(m => (
            <button
              key={m.id}
              type="button"
              onClick={() => choose(m.id)}
              className="w-full rounded-2xl overflow-hidden border border-brew-border text-left transition-all active:scale-98 hover:border-white/30 group relative"
            >
              {/* Photo */}
              <div className="relative h-44 w-full bg-brew-surface">
                <Image
                  src={m.img}
                  alt={m.label}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 480px"
                />
                {/* gradient scrim */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              </div>
              {/* Text overlay */}
              <div className="absolute bottom-0 left-0 right-0 p-5">
                <h2 className="font-display text-xl text-white leading-tight mb-0.5">{m.label}</h2>
                <p className="text-white/60 text-sm leading-snug">{m.sub}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
