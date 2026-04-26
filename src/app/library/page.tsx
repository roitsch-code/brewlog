"use client";
import { useRouter } from "next/navigation";

export default function LibraryPage() {
  const router = useRouter();

  return (
    <div className="min-h-full bg-brew-bg flex flex-col pb-8">

      {/* Header */}
      <div className="px-5 pb-6" style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.25rem)" }}>
        <h1 className="font-display text-3xl text-white leading-none">Library</h1>
        <p className="text-brew-muted text-sm mt-1.5">Your coffee collections</p>
      </div>

      <div className="px-5 flex flex-col gap-4">

        {/* Coffee Library */}
        <button
          type="button"
          onClick={() => router.push("/coffees")}
          className="w-full bg-brew-surface border border-brew-border rounded-2xl p-5 text-left active:scale-[0.98] transition-transform"
        >
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-brew-elevated flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-brew-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-base leading-tight">Coffee Library</p>
              <p className="text-brew-muted text-sm mt-1 leading-snug">
                Brew sessions sorted by coffee — everything you&apos;ve brewed at home.
              </p>
            </div>
            <svg className="w-4 h-4 text-brew-muted shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </div>
        </button>

        {/* Café Library */}
        <button
          type="button"
          onClick={() => router.push("/cafes")}
          className="w-full bg-brew-surface border border-brew-border rounded-2xl p-5 text-left active:scale-[0.98] transition-transform"
        >
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-brew-elevated flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-brew-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-base leading-tight">Café Library</p>
              <p className="text-brew-muted text-sm mt-1 leading-snug">
                Cafés, coffees, and sessions from your external visits.
              </p>
            </div>
            <svg className="w-4 h-4 text-brew-muted shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </div>
        </button>

      </div>
    </div>
  );
}
