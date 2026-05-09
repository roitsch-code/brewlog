"use client";

/**
 * Three-dot "thinking" indicator. Replaces the in-chat CoffeeBeanGlow
 * spinner per spec §6.2. Used inline where the next assistant message
 * will appear; left-aligned, no bubble, no avatar.
 */
export default function ThinkingDots({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-1.5 ${className}`} aria-label="Thinking">
      <span className="thinking-dot" />
      <span className="thinking-dot" style={{ animationDelay: "120ms" }} />
      <span className="thinking-dot" style={{ animationDelay: "240ms" }} />
      <style jsx>{`
        .thinking-dot {
          width: 6px;
          height: 6px;
          border-radius: 999px;
          background: var(--text-secondary);
          opacity: 0.35;
          animation: thinking-pulse 1200ms ease-in-out infinite;
        }
        @keyframes thinking-pulse {
          0%, 60%, 100% { opacity: 0.25; transform: scale(1); }
          30%           { opacity: 1;    transform: scale(1.15); }
        }
        @media (prefers-reduced-motion: reduce) {
          .thinking-dot { animation: none; opacity: 0.55; }
        }
      `}</style>
    </div>
  );
}
