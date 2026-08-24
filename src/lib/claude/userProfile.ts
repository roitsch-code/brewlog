import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { preferences } from "@/lib/db/schema";
import type { UserPreferences } from "@/lib/types/preferences";
import { formatGrindSettingsForPrompt, GRIND_FOOTNOTE } from "@/lib/constants/grindSettings";

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

const CANONICAL_PROFILE = `**Equipment:**
- Primary grinder: Niche Zero (Niche DEGREES, never clicks!)
- Travel grinder: Comandante C40 MK2 (clicks, not degrees)
- Primary brewer: V60 size 2 (daily driver)
- Other brewers: Orea V4 Wide, Origami Air M (resin, AS-resin "Air" line — lighter, lower thermal mass than ceramic), Clever Dripper, Kalita Wave, AeroPress, Moccamaster, Chemex
- Kettle: Fellow Stagg EKG (gooseneck, precise temp control, 60-min hold) — the default at home
- Travel pour control: Hario V60 Drip Assist — the disc he packs for when there is no gooseneck kettle. He has confirmed it fits ALL of his cones (V60, Orea V4, Origami), so it is an accessory, never a brewer choice. At home with the Stagg it is unused; don't bring it up unprompted (see "Kettle & pour control")
- Water: BWT Bestmax Premium V filter (bypass 0) turns ~370 ppm Düsseldorf tap into ~220 ppm TDS (GH 5–6 °dH, KH 4 °dH) — the daily driver, fine straight for naturals & honeys. For washed/floral coffees a 1:2 blend (BWT-filtered + distilled) gives ~73 ppm TDS (KH ~1.3 °dH) for maximum clarity — ideal for championship methods (Peng, Kasuya, Wölfl)

**Taste preferences:**
- Likes: silky, balanced, floral/fruity light roasts — elegant, not wild
- Avoids: extreme fermentation, infused varieties, heavy/dark roasts, anaerobic "fruit bombs"
- Not at home: pineapple-forward coffees. The Avoids line above filters PROCESSING and roast; this one is a FLAVOUR, so a washed or honey coffee can be loudly pineapple and pass that filter untouched. Soft, not a ban — he will happily drink a pineapple cup out at a cafe, he just does not want one on the home counter.
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
      if (tp.avoidProcesses?.length) lines.push(`- Avoids processes: ${tp.avoidProcesses.join(", ")}`);
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
