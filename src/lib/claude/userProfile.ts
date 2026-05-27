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
- Other brewers: Orea V4 Wide, Origami Dripper, Clever Dripper, Kalita Wave, AeroPress, Moccamaster, Chemex
- Kettle: Fellow Stagg EKG (gooseneck, precise temp control, 60-min hold)
- Water: BWT Bestmax Premium V filter (bypass 0) turns ~370 ppm Düsseldorf tap into ~220 ppm TDS (GH 5–6 °dH, KH 4 °dH) — the daily driver, fine straight for naturals & honeys. For washed/floral coffees a 1:2 blend (BWT-filtered + distilled) gives ~73 ppm TDS (KH ~1.3 °dH) for maximum clarity — ideal for championship methods (Peng, Kasuya, Wölfl)

**Taste preferences:**
- Likes: silky, balanced, floral/fruity light roasts — elegant, not wild
- Avoids: extreme fermentation, infused varieties, heavy/dark roasts, anaerobic "fruit bombs"
- Favourite origins: Ethiopia Washed, Kenya AA Washed, Brazil Natural, Costa Rica Honey`;

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
