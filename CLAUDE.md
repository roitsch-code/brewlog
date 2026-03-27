# BrewLog — Claude Context

This is Markus's personal coffee brew advisor & diary PWA. Built with Next.js 14 + Firebase + Claude AI.

---

## User Profile: Markus

**Semi-expert Advanced Coffee Enthusiast** — Düsseldorf, Germany
**Philosophy:** Parameters are intelligent starting points, not rigid rules. The brew log exists to refine and evolve his preferences through real data.

### Taste Baseline (starting point — actual session ratings take precedence)

- **Stated likes:** Silky, creamy, balanced; slightly sweet, floral, fruity (elegant, not wild); light roast single origins
- **Stated avoids:** Anaerobic/extreme fermentation, infused varieties, heavy/dark roasts, "fruit bombs"
- **Favorite origins on paper:** Brazil Cerrado/Minas Gerais Natural ★★★ | Ethiopia Washed ★★★ | Kenya AA Washed ★★★ | Costa Rica Honey ★★
- **Budget:** max 20 €/250g

> The AI should treat the brew history as ground truth. If actual ratings contradict stated preferences, the ratings win. The goal is to discover what Markus *actually* likes, not enforce what he thought he liked.

### Equipment

| Device | Details |
|--------|---------|
| **PRIMARY brewer** | V60 size 2 + Hario Drip Assist (daily driver) |
| Other brewers | Orea V4 Wide (4 bottoms: Classic/Open/Fast/Apex), Clever Dripper (Hoffmann method), Kalita Wave, AeroPress, Moccamaster |
| **Grinder (primary)** | Niche Zero — **GRAD ° settings, NEVER clicks!** |
| Grinder (travel) | Comandante C40 MK2 — clicks |
| Kettle | Fellow Corvo EKG (900ml, temp-hold) |
| Scales | Acaia Lunar & Pearl |
| Water (daily) | Brita P1000 → ~220 ppm TDS, GH 3–4 °dKH, KH 5–6 °dKH |
| Water (championship) | Brita diluted with distilled: 1:3 = ~55 ppm / 1:4 = ~44 ppm / 1:2 = ~73 ppm |

---

## Critical Brew Rules

### Drip Assist (works with V60, Orea V4, Kalita Wave, and Chemex)

1. **Start temp +2–3°C higher** than without assist (heat loss from transfers)
   - Washed: **98–99°C** | Natural: **95–96°C** | Honey: **97°C**
2. **Kettle back on base after EVERY pour** (Fellow Corvo reheats in 10–15s)
3. **Bloom agitation mandatory at 0:10** — kräftig stir 3–5× for Washed, gentle swirl for Natural/Honey
4. **Niche°:** Washed 386–388° | Honey 388–390° | Natural 388–392°
5. **Pour-time:** 30–45s per 150g (outer ring, 3.5–5 g/s)

### Standard Drip Assist Recipes

| Size | Dose | Water | Ratio | Pour sequence | Total |
|------|------|-------|-------|---------------|-------|
| Big | 34g | 520g | 1:15.3 | 70 – 220 – 370 – 520 | ~4:00 |
| Small | 23g | 350g | 1:15.2 | 50 – 150 – 250 – 350 | ~3:30 |

### Championship / Exploration Mode

Triggered by: "exploration", "championship", "4:6", "Peng", "Wölfl", "experiment"
→ Always V60 **WITHOUT** Drip Assist | Championship water | Niche° 375–385° (finer)

| Method | Setup |
|--------|-------|
| Peng 2025 Temp-Staging | 15g:210g | Water 1:4 (44 ppm) | Niche° 365–375° | 96°C bloom → 80°C final | ~1:45 |
| Wölfl 2024 Orea FAST | 17g:270ml | Water 1:3 (55 ppm) | Niche° 380–390° | 4 rapid pours | ~2:25 |
| Kasuya 4:6 | 20g:300ml | Water 1:3 (55 ppm) | Niche° 390–400° | 40%+60% phases | ~3:00–3:30 |

### Timing Rule (CRITICAL)

**Drawdown end = total time = DONE.**
NEVER add a separate "total" or "target time" row after the drawdown row.
The drawdown row IS the last row. It ends with `= FERTIG! ✅`

### Niche° Quick Reference

| Method | Niche° |
|--------|--------|
| V60 + Drip Assist (Washed) | 386–388° |
| V60 + Drip Assist (Honey) | 388–390° |
| V60 + Drip Assist (Natural) | 388–392° |
| V60 without Assist | 375–385° |
| Orea V4 | 380–390° |
| Clever Dripper | 395–415° |
| AeroPress | 360–370° |
| Moccamaster | 410–420° |
| Peng (Championship) | 365–375° |
| 4:6 Method | 390–400° |

### Troubleshooting

| Problem | Fix |
|---------|-----|
| Too fast | −5° Niche (finer) |
| Too slow | +5° Niche (coarser) |
| Too bitter | +5° Niche OR −2°C |
| Too sour/flat | −3° Niche OR +2°C |
| Temp too low at end | Kettle not returned to base — use heating pauses! |
| Channeling | Bloom agitation at 0:10 is mandatory! |

---

## Tech Stack

- **Framework:** Next.js 14 App Router + TypeScript + Tailwind CSS
- **Database:** Firebase Firestore + Firebase Storage
- **AI:** Claude API (claude-sonnet-4-6) — bag analysis + brew recommendations + match scoring
- **Hosting:** Vercel | **Platform:** iPhone PWA

## Design Language

- **Colors:** Pure black bg (`#0A0A0A`), surfaces `#141414`/`#1E1E1E`, accent `#F0EDE8` (warm near-white), text white/muted
- **Fonts:** DM Serif Display (headlines), Inter (body), JetBrains Mono (numbers)
- **Style:** Crème cooking app aesthetic — editorial, content-first, premium, no emojis in UI

## Key Files

- `src/lib/claude/recommend.ts` — brew recommendation system prompt (full Markus profile baked in)
- `src/app/api/match/route.ts` — coffee match scoring against taste profile
- `src/app/api/analyze-bag/route.ts` — Claude vision bag extraction
- `src/store/flowStore.ts` — Zustand flow state
- `src/lib/types/session.ts` — core data model
