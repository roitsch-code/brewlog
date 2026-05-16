"use client";

import { useRouter } from "next/navigation";
import { Coffee, MapPin, User, Crosshair, Globe, BookOpen, RotateCcw } from "lucide-react";
import type { NavAction } from "@/app/api/explore-agent/route";
import { useFlowStore } from "@/store/flowStore";
import type { CoffeeIdentity } from "@/lib/types/session";

/**
 * BTTS Action Pill — specs/home.md §6.
 *
 * Glass pill rendered under an agent response when the agent emits a
 * suggest_navigation call. Max 3 per response (§6.0).
 *
 * Icon prefix signals action type (§6.2):
 *   - BookOpen / Coffee: navigation to library or detail
 *   - RotateCcw: Brew Action — starts a brew flow with a coffee
 *     pre-selected; lands in Step 3 (Context). Spec §6.2 calls this
 *     the "Brew/refresh icon".
 *   - MapPin: navigation to a map / café view
 *   - Crosshair: Match flow
 *   - User: Taste profile
 *   - Globe: generic navigation
 *
 * For brew_again specifically: tap fetches the coffee from
 * /api/coffees/[id], synthesises a CoffeeIdentity (same shape as the
 * /coffees library page's "Brew this" button), hydrates the
 * flowStore, then navigates to /brew/new. The brew flow opens directly
 * on Step 3 (Context) with the bag already selected. (§6.3)
 */

interface CoffeeRow {
  id: string;
  roaster: string;
  name: string;
  origin: string;
  process: string;
  latestRoastDate?: string;
  bagPhotoUrl?: string;
}

function destinationToPath(action: NavAction): string {
  switch (action.destination) {
    case "coffee_library":
      return "/coffees";
    case "coffee_detail":
      return action.id ? `/coffees/${action.id}` : "/coffees";
    case "brew_again":
      // brew_again is handled specially — the click handler hydrates
      // the flow store first. Fallback path on failure.
      return "/brew/new";
    case "cafe_map":
      return "/cafes";
    case "cafe_detail":
      return action.id ? `/cafes/place/${encodeURIComponent(action.id)}` : "/cafes";
    case "taste_profile":
      return "/taste";
    case "match":
      return "/match";
    case "home":
      return "/home";
    default:
      return "/home";
  }
}

function ActionPillIcon({ destination }: { destination: NavAction["destination"] }) {
  const cls = "h-4 w-4 text-light-foreground/80";
  switch (destination) {
    case "coffee_library":
      return <BookOpen className={cls} strokeWidth={1.5} />;
    case "coffee_detail":
      return <Coffee className={cls} strokeWidth={1.5} />;
    case "brew_again":
      return <RotateCcw className={cls} strokeWidth={1.5} />;
    case "cafe_map":
    case "cafe_detail":
      return <MapPin className={cls} strokeWidth={1.5} />;
    case "taste_profile":
      return <User className={cls} strokeWidth={1.5} />;
    case "match":
      return <Crosshair className={cls} strokeWidth={1.5} />;
    default:
      return <Globe className={cls} strokeWidth={1.5} />;
  }
}

export default function ActionPill({ action }: { action: NavAction }) {
  const router = useRouter();
  const { reset, setCoffee, setMode, setSkipScan, setStep } = useFlowStore();

  const handleClick = async () => {
    if (action.destination === "brew_again" && action.id) {
      // Hydrate the flow store with the coffee, then jump into Step 3.
      // Same pattern /coffees and /coffees/[id] use for "Brew this".
      try {
        const res = await fetch(`/api/coffees/${action.id}`, { cache: "no-store" });
        if (res.ok) {
          const row = (await res.json()) as CoffeeRow | null;
          if (row && row.id) {
            const identity: CoffeeIdentity = {
              roaster: row.roaster,
              name: row.name,
              origin: row.origin,
              process: row.process,
              roastLevel: "Light",
              roastDate: row.latestRoastDate,
              bagPhotoUrl: row.bagPhotoUrl,
              aiExtracted: false,
              coffeeId: row.id,
            };
            reset();
            setCoffee(identity);
            setMode("home");
            setSkipScan(true);
            setStep("context");
          }
        }
      } catch {
        /* fall through to plain navigation if the fetch fails */
      }
    }
    router.push(destinationToPath(action));
  };

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      title={action.reason}
      className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-light-foreground/10 bg-light-card-default px-4 font-inter text-[13px] font-medium text-light-foreground backdrop-blur-[14px] backdrop-saturate-150"
    >
      <ActionPillIcon destination={action.destination} />
      {action.label}
    </button>
  );
}
