import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { preferences } from "@/lib/db/schema";
import type { UserPreferences } from "@/lib/types/preferences";
import { formatGrindSettingsForPrompt, GRIND_FOOTNOTE } from "@/lib/constants/grindSettings";
import { formatBrewerRolesForChat } from "@/lib/knowledge/brewers";

const KEY = "default";

export async function loadUserProfile(): Promise<UserPreferences | null> {
  try {
    const rows = await db.select().from(preferences).where(eq(preferences.key, KEY)).limit(1);
    if (rows.length === 0) return null;
    return rows[0].data as UserPreferences;
  } catch (err) {
    console.error("loadUserProfile error:", err);
    return null;
  }
}

export const CANONICAL_PROFILE = `**Equipment:**
- Grinders: Niche Zero (Niche DEGREES, never clicks) and a Comandante C40 MK2 (clicks, never degrees). Both are real options at home. The Niche is what he reaches for by default; the Comandante is worth proposing when there is a reason — the reference was published on one, a conical hand grind suits what you are after, a slow Sunday brew — and he decides. Whichever grinder a brew is set up with decides the unit.
- Brewers — all equal, each with a role and a limit; no primary brewer (owner, 2026-10-19):
${formatBrewerRolesForChat()}
- Pour-control disc: he owns a Hario V60 Drip Assist (fits ALL of his cones — V60, Orea V4, Origami — an accessory, never a brewer choice) but uses it very rarely and only when HE decides to, never automatically. It exists in a conversation only once he says he is brewing with it; a missing gooseneck does NOT mean the disc. Don't bring it up unprompted (see "Kettle & pour control")
- Kettle: Fellow Stagg EKG (gooseneck, precise temp control, 60-min hold) — the default at home
- Water: BWT Bestmax Premium V filter (bypass 0) turns ~370 ppm Düsseldorf tap into ~220 ppm TDS (GH 5–6 °dH, KH 4 °dH) — the daily driver, fine straight for naturals & honeys. For washed/floral coffees a 1:2 blend (BWT-filtered + distilled) gives ~73 ppm TDS (KH ~1.3 °dH) for maximum clarity — ideal for championship methods (Peng, Kasuya, Wölfl)

**Taste — a preference he weighs, never a rule you enforce:**
- Likes so far: silky, balanced, floral/fruity light roasts — elegant, not wild
- Has not enjoyed so far: extreme fermentation, infused coffees, heavy/dark roasts, anaerobic "fruit bombs". Weigh it; when you go against it, say why in one clause.
- Not at home: pineapple-forward coffees. The line above is about PROCESSING and roast; this one is a FLAVOUR, so a washed or honey coffee can be loudly pineapple and pass that line untouched. Soft, not a ban — he will happily drink a pineapple cup out at a cafe, he just does not want one on the home counter.
- Scope of that dislike: it governs SELECTION — which bag to open, to buy, to explore — and never brewing. If a bag he already owns turns out pineapple-forward, brew it as well as it can be brewed; do not try to suppress the fruit and do not talk him out of the cup.
- Favourite origins: Ethiopia Washed, Kenya AA Washed, Brazil Natural, Costa Rica Honey

**Reading his logged brews:** the log holds coffees he already chose, so it arrives pre-filtered by his taste. A flavour being rare or absent there is NOT evidence that he dislikes it — he may simply never have bought one. Only the lines above state a dislike; infer no others from silence.`;

export function formatProfileForPrompt(prefs: UserPreferences | null): string {
  let block = `## About you\n${CANONICAL_PROFILE}`;

  if (prefs) {
    const lines: string[] = [];
    if (prefs.equipment?.length) {
      lines.push(`- Equipment selected in onboarding: ${prefs.equipment.join(", ")}`);
    }
    if (prefs.grinder) {
      lines.push(`- Grinder selected in onboarding: ${prefs.grinder}`);
    }
    const tp = prefs.tasteProfile;
    if (tp) {
      if (tp.likedOrigins?.length) lines.push(`- Liked origins: ${tp.likedOrigins.join(", ")}`);
      if (tp.likedProcesses?.length) lines.push(`- Liked processes: ${tp.likedProcesses.join(", ")}`);
      if (tp.avoidProcesses?.length) lines.push(`- Has not enjoyed these processes so far: ${tp.avoidProcesses.join(", ")} (a preference to weigh, not a rule)`);
      if (tp.preferredBodyLevel) lines.push(`- Preferred body: ${tp.preferredBodyLevel}`);
      if (tp.preferredAcidityLevel) lines.push(`- Preferred acidity: ${tp.preferredAcidityLevel}`);
    }
    if (prefs.defaultAmount) lines.push(`- Default brew amount: ${prefs.defaultAmount}`);
    if (lines.length > 0) {
      block += `\n\n**From your saved onboarding profile (overrides the canonical defaults above when they conflict):**\n${lines.join("\n")}`;
    }
  }

  block += `\n\n**Niche Zero grind settings (degrees, not clicks):**\n${formatGrindSettingsForPrompt()}\n\n${GRIND_FOOTNOTE}`;

  return block;
}
