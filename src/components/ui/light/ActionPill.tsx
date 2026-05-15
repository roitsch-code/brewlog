"use client";

import { useRouter } from "next/navigation";
import { Coffee, MapPin, User, Crosshair, Globe, BookOpen } from "lucide-react";
import type { NavAction } from "@/app/api/explore-agent/route";

/**
 * BTTS Action Pill — specs/home.md §6.
 *
 * Glass pill rendered under an agent response when the agent emits a
 * suggest_navigation call. Max 3 per response (§6.0 — agent prioritises
 * if more would apply).
 *
 * Icon prefix signals action type (§6.2):
 *   - Coffee-cup: navigation to a coffee detail / library
 *   - Map-pin: navigation to a map / café view
 *   - Crosshair: Match flow
 *   - User: Taste profile
 *   - Globe: generic navigation
 *
 * Tap is a single navigation event — no confirmation sheet (§6.3).
 * If the destination is a brew step that needs pre-population, that's
 * flowStore work and will land alongside PR2g/h follow-ups for the
 * brew-flow Light migration.
 */

function destinationToPath(action: NavAction): string {
  switch (action.destination) {
    case "coffee_library":
      return "/coffees";
    case "coffee_detail":
      return action.id ? `/coffees/${action.id}` : "/coffees";
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
  return (
    <button
      type="button"
      onClick={() => router.push(destinationToPath(action))}
      title={action.reason}
      className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-light-foreground/10 bg-light-card-default px-4 font-inter text-[13px] font-medium text-light-foreground backdrop-blur-[14px] backdrop-saturate-150"
    >
      <ActionPillIcon destination={action.destination} />
      {action.label}
    </button>
  );
}
