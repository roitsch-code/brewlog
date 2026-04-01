"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Coffee } from "@/lib/types/coffee";
import StarRating from "@/components/ui/StarRating";
import TopMenu from "@/components/layout/TopMenu";

export default function CoffeesPage() {
  const [coffees, setCoffees] = useState<Coffee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const router = useRouter();

  useEffect(() => {
    setLoading(true);
    setError(false);
    fetch("/api/coffees", { cache: "no-store" })
      .then(r => {
        if (!r.ok) throw new Error("Failed to load coffees");
        return r.json();
      })
      .then((data: Coffee[]) => {
        const sorted = [...data].sort((a, b) => (b.firstSeenAt || "").localeCompare(a.firstSeenAt || ""));
        setCoffees(sorted);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [retryCount]);

  return (
    <div className="min-h-svh bg-brew-bg flex flex-col">
      {/* Header */}
      <div className="px-5 pb-4 flex items-center justify-between" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1.5rem)' }}>
        <div>
          <h1 className="font-display text-2xl text-white">Coffee Library</h1>
          <p className="text-brew-muted text-sm">{coffees.length} coffee{coffees.length !== 1 ? "s" : ""} tracked</p>
        </div>
        <TopMenu />
      </div>

      <div className="flex-1 px-5">
{loading ? (
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="aspect-[3/4] rounded-2xl bg-brew-surface animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-[60vh] text-center gap-4">
            <p className="font-display text-xl text-white">Couldn&apos;t load your library</p>
            <p className="text-brew-muted text-sm">Check your connection and try again.</p>
            <button onClick={() => setRetryCount(c => c + 1)} className="text-brew-accent text-sm underline">Retry</button>
          </div>
        ) : coffees.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[60vh] text-center gap-4">
            <svg className="w-12 h-12 text-brew-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
            </svg>
            <p className="font-display text-xl text-white">No coffees yet</p>
            <p className="text-brew-muted text-sm">Coffees you scan will appear here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {coffees.map(coffee => {
              const originProcess = [coffee.origin, coffee.process].filter(Boolean).join(" – ");
              return (
                <button
                  key={coffee.id}
                  type="button"
                  onClick={() => router.push(`/coffees/${coffee.id}`)}
                  className="bg-brew-surface rounded-2xl overflow-hidden border border-brew-border text-left active:scale-95 transition-transform"
                >
                  {/* Photo or blank */}
                  <div className="relative aspect-square w-full bg-brew-elevated">
                    {coffee.bagPhotoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={coffee.bagPhotoUrl} alt={coffee.name} className="absolute inset-0 w-full h-full object-cover" />
                    )}
                    <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm rounded-full px-2 py-0.5 z-10">
                      <span className="text-white text-xs font-medium">{coffee.sessionCount}×</span>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-3">
                    {coffee.roaster && (
                      <p className="text-brew-muted text-xs mb-0.5 truncate">{coffee.roaster}</p>
                    )}
                    <h3 className="text-white font-medium text-sm leading-tight truncate">{coffee.name}</h3>
                    {originProcess && (
                      <p className="text-brew-muted text-xs mt-0.5 truncate">{originProcess}</p>
                    )}
                    {coffee.avgRating != null && coffee.avgRating > 0 && (
                      <div className="mt-2">
                        <StarRating value={coffee.avgRating} readonly size="sm" />
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
