"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Coffee, MapPin, User, Crosshair, Globe, BookOpen, RotateCcw, Bookmark, Check, Plus } from "lucide-react";
import type { NavAction } from "@/app/api/explore-agent/route";
import { startBrewAgain, startBrewFromChat } from "@/lib/flow/brewAgain";
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
  components?: import("@/lib/types/session").BlendComponent[] | null;
  latestRoastDate?: string;
  bagPhotoUrl?: string;
  // Generative Field v1.1 — present on the /api/coffees/[id] response
  // via rowToCoffee, used for the Brew Again Field lift.
  fieldZones?: import("@/lib/field/types").FieldZones | null;
}

function destinationToPath(action: NavAction): string {
  switch (action.destination) {
    case "coffee_library":
      return "/coffees";
    case "coffee_detail":
      return action.id ? `/coffees/${action.id}` : "/coffees";
    case "brew_again":
    case "start_brew":
      // Both are handled specially — the click handler hydrates the flow
      // store first. Fallback path on failure.
      return "/brew/new";
    case "remember_advice":
    case "add_coffee":
      // Handled entirely client-side (tap-to-save / tap-to-add); never navigates.
      return "/";
    case "cafe_map":
      return "/cafes";
    case "cafe_detail":
      return action.id ? `/cafes/place/${encodeURIComponent(action.id)}` : "/cafes";
    case "taste_profile":
      return "/taste";
    case "match":
      return "/match";
    case "home":
      return "/";
    default:
      return "/";
  }
}

function ActionPillIcon({ destination }: { destination: NavAction["destination"] }) {
  // Cream icon on the anthracite pill body — same colour as the label.
  const cls = "h-4 w-4 text-light-text-on-dark";
  switch (destination) {
    case "coffee_library":
      return <BookOpen className={cls} strokeWidth={1.75} />;
    case "coffee_detail":
      return <Coffee className={cls} strokeWidth={1.75} />;
    case "brew_again":
    case "start_brew":
      return <RotateCcw className={cls} strokeWidth={1.75} />;
    case "remember_advice":
      return <Bookmark className={cls} strokeWidth={1.75} />;
    case "add_coffee":
      return <Plus className={cls} strokeWidth={1.75} />;
    case "cafe_map":
    case "cafe_detail":
      return <MapPin className={cls} strokeWidth={1.75} />;
    case "taste_profile":
      return <User className={cls} strokeWidth={1.75} />;
    case "match":
      return <Crosshair className={cls} strokeWidth={1.75} />;
    default:
      return <Globe className={cls} strokeWidth={1.75} />;
  }
}

export default function ActionPill({ action }: { action: NavAction }) {
  const router = useRouter();
  // remember_advice and add_coffee are tap-to-write: they persist instead of
  // navigating, and reflect progress on the pill itself.
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  // add_coffee only: the coffee landed but its coach note didn't. Reported
  // separately so the pill never implies the bag failed to be added.
  const [noteFailed, setNoteFailed] = useState(false);

  const handleClick = async () => {
    // Put a brand-new bag in the Coffee Library. Before this existed the chat
    // could read a bag off a photo but had to send the user to type it into
    // the scan form by hand.
    if (action.destination === "add_coffee") {
      if (saveState === "saving" || saveState === "saved") return;
      const coffee = action.coffee;
      if (!coffee?.roaster?.trim() || !coffee?.name?.trim()) {
        setSaveState("error");
        return;
      }
      setSaveState("saving");
      setNoteFailed(false);
      try {
        const res = await fetch("/api/coffees", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(coffee),
        });
        if (!res.ok) {
          setSaveState("error");
          return;
        }
        // The coffee exists now, so it finally has an id the coach note can
        // target — that ordering is the whole reason the note rides along here
        // instead of on a separate remember_advice pill.
        const { id } = (await res.json()) as { id?: string };
        if (id && action.observation && action.suggestion) {
          try {
            const noteRes = await fetch("/api/insights", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                observation: action.observation,
                suggestion: action.suggestion,
                citationFields: action.citationFields ?? [],
                coffeeId: id,
              }),
            });
            if (!noteRes.ok) setNoteFailed(true);
          } catch {
            setNoteFailed(true);
          }
        }
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
      return;
    }

    if (action.destination === "remember_advice") {
      if (saveState === "saving" || saveState === "saved") return;
      if (!action.observation || !action.suggestion) {
        setSaveState("error");
        return;
      }
      setSaveState("saving");
      try {
        const res = await fetch("/api/insights", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            observation: action.observation,
            suggestion: action.suggestion,
            citationFields: action.citationFields ?? [],
            coffeeId: action.id,
          }),
        });
        setSaveState(res.ok ? "saved" : "error");
      } catch {
        setSaveState("error");
      }
      return;
    }

    if ((action.destination === "brew_again" || action.destination === "start_brew") && action.id) {
      // Hydrate the flow store with the coffee first.
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
              components: row.components ?? undefined,
              roastLevel: "Light",
              roastDate: row.latestRoastDate,
              bagPhotoUrl: row.bagPhotoUrl,
              aiExtracted: false,
              coffeeId: row.id,
            };
            const fieldZones = row.fieldZones ?? null;
            const r = action.recipe;
            // start_brew with a complete recipe → jump STRAIGHT to the brew
            // timer with the chat's exact recipe (no context/recommend, so it
            // isn't re-generated). If the payload is incomplete, fall back to
            // the normal "brew again" path (Step Context) rather than break.
            if (
              action.destination === "start_brew" &&
              r &&
              typeof r.doseGrams === "number" &&
              typeof r.waterGrams === "number" &&
              typeof r.waterTempC === "number" &&
              typeof r.targetTimeSec === "number"
            ) {
              startBrewFromChat(
                identity,
                fieldZones,
                r,
                action.method || "Brew",
                action.title,
                action.basedOn,
              );
            } else {
              // Generative Field v1.1 — lift the persisted Field composition.
              startBrewAgain(identity, fieldZones);
            }
          }
        }
      } catch {
        /* fall through to plain navigation if the fetch fails */
      }
    }
    router.push(destinationToPath(action));
  };

  // For the tap-to-write pills the button doubles as its own status: label +
  // icon reflect progress, and it locks once written.
  const isRemember = action.destination === "remember_advice";
  const isAdd = action.destination === "add_coffee";
  const hasNote = Boolean(action.observation && action.suggestion);

  let label = action.label;
  if (isRemember) {
    if (saveState === "saving") label = "Saving…";
    else if (saveState === "saved") label = "Saved to coach";
    else if (saveState === "error") label = "Couldn't save — tap to retry";
  } else if (isAdd) {
    if (saveState === "saving") label = "Adding…";
    else if (saveState === "saved") {
      // The bag is in either way — say what actually happened to the note.
      label = noteFailed
        ? "Added — coach note didn't save"
        : hasNote
          ? "Added with coach note"
          : "Added to library";
    } else if (saveState === "error") label = "Couldn't add — tap to retry";
  }

  const isTapToWrite = isRemember || isAdd;
  const locked = isTapToWrite && (saveState === "saving" || saveState === "saved");

  // Filled-anthracite treatment so Action Pills don't visually echo the
  // cream Glass user bubbles — they read as "do this" CTAs rather than
  // another speech bubble. (Spec §6.1 specified Glass; user feedback in
  // the anthracite revision asked for clearer differentiation.)
  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={locked}
      title={action.reason}
      className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-light-foreground px-4 font-chivo text-[13px] font-medium text-light-text-on-dark shadow-light-float active:opacity-90 disabled:opacity-80"
    >
      {isTapToWrite && saveState === "saved" ? (
        <Check className="h-4 w-4 text-light-text-on-dark" strokeWidth={1.75} />
      ) : (
        <ActionPillIcon destination={action.destination} />
      )}
      {label}
    </button>
  );
}
