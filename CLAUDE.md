# BrewLog — Claude Code Context

This file gives Claude Code context about the project so it can assist effectively. When you fork this project, update this file with your own profile and setup.

BrewLog is a personal coffee brew advisor & diary PWA. Built with Next.js 14 + Firebase + Claude AI.

---

## User Profile

This app is deeply personalised — the AI system prompts adapt to the user's equipment, taste profile, and brew history. Below is the example profile the app ships with. Replace with your own when you fork.

### Equipment

| Device | Details |
|--------|---------|
| **PRIMARY brewer** | V60 size 2 + Hario Drip Assist (daily driver) |
| Other brewers | Orea V4 Wide (4 bottoms: Classic/Open/Fast/Apex), Clever Dripper (Hoffmann method), Kalita Wave, AeroPress, Moccamaster |
| **Grinder (primary)** | Niche Zero — **GRAD ° settings, NEVER clicks!** |
| Grinder (travel) | Comandante C40 MK2 — clicks |
| Kettle | Fellow Corvo EKG (900ml, temp-hold) |
| Scales | Acaia Lunar & Pearl |
| Water (daily) | Tap ~300 ppm TDS |
| Water (diluted) | 1:1 tap + distilled = ~150 ppm (SCA optimal) |
| Water (championship) | 1:3 tap + distilled = ~75 ppm / 1:4 = ~75 ppm |

### Taste baseline

- **Likes:** Silky, creamy, balanced; slightly sweet, floral, fruity (elegant, not wild); light roast single origins
- **Avoids:** Anaerobic/extreme fermentation, infused varieties, heavy/dark roasts, "fruit bombs"
- **Favourite origins:** Brazil Cerrado Natural | Ethiopia Washed | Kenya AA Washed | Costa Rica Honey

> The AI treats brew history as ground truth. If actual ratings contradict stated preferences, the ratings win.

---

## Critical Brew Rules

### Drip Assist

1. **Start temp +2–3°C higher** (heat loss from transfers): Washed **98–99°C** | Natural **95–96°C** | Honey **97°C**
2. **Kettle back on base after EVERY pour** (Fellow Corvo reheats in 10–15s)
3. **Bloom agitation mandatory at 0:10** — vigorous stir 3–5× for Washed, gentle swirl for Natural/Honey
4. **Niche°:** Washed 403–408° | Honey 405–410° | Natural 406–412°

### Standard Drip Assist Recipes

| Size | Dose | Water | Ratio | Pour sequence | Total |
|------|------|-------|-------|---------------|-------|
| Big | 34g | 520g | 1:15.3 | 70 – 220 – 370 – 520 | ~4:00 |
| Small | 23g | 350g | 1:15.2 | 50 – 150 – 250 – 350 | ~3:30 |

### Championship Recipes

| Method | Setup |
|--------|-------|
| Peng 2025 Temp-Staging | 15g:210g | Water 1:4 (44 ppm) | Niche° 365–375° | 96°C bloom → 80°C final |
| Wölfl 2024 Orea FAST | 17g:270ml | Water 1:3 (55 ppm) | Niche° 380–390° | 4 rapid pours |
| Kasuya 4:6 | 20g:300ml | Water 1:3 (55 ppm) | Niche° 390–400° | 40%+60% phases |

### Timing Rule

**Drawdown end = total time = DONE.**
NEVER add a separate "total" row after the drawdown row.

### Niche° Quick Reference

| Method | Niche° |
|--------|--------|
| V60 + Drip Assist (Washed) | 403–408° |
| V60 + Drip Assist (Honey) | 405–410° |
| V60 + Drip Assist (Natural) | 406–412° |
| V60 without Assist | 396–406° |
| Orea V4 | 401–411° |
| Clever Dripper | 416–436° |
| AeroPress | 377–387° |
| Moccamaster | 431–441° |
| Peng (Championship) | 386–396° |
| 4:6 Method | 411–421° |

---

## Tech Stack

- **Framework:** Next.js 14 App Router + TypeScript + Tailwind CSS
- **Database:** Firebase Firestore (custom database ID: set via `FIRESTORE_DATABASE_ID`)
- **Storage:** Firebase Storage (download token pattern — see README)
- **AI:** Claude API (`claude-sonnet-4-6` for main flows, `claude-haiku-4-5` for lightweight tasks)
- **Hosting:** Vercel | **Platform:** iPhone PWA

## Design Language

- **Colors:** Pure black bg (`#0A0A0A`), surfaces `#141414`/`#1E1E1E`, accent `#F0EDE8` (warm near-white)
- **Fonts:** DM Serif Display (headlines), Inter (body), JetBrains Mono (numbers)
- **Style:** Editorial, content-first, premium, no emojis in UI

## Key Files

- `src/lib/claude/recommend.ts` — brew recommendation system prompt (full user profile baked in)
- `src/app/api/match/route.ts` — coffee match scoring against taste profile
- `src/app/api/analyze-bag/route.ts` — Claude vision bag extraction
- `src/app/api/explore/route.ts` — AMA chat system prompt
- `src/store/flowStore.ts` — Zustand brew flow state
- `src/lib/types/session.ts` — core data model

## Personalising for Your Own Setup

1. Set `USER_DISPLAY_NAME` and `USER_LOCATION` in `.env.local`
2. Update the equipment lists and grind settings in `src/lib/claude/recommend.ts` and `src/app/api/explore/route.ts`
3. Update taste preferences in `src/app/api/match/route.ts`
4. Run `node scripts/seed-insights.mjs` to populate the knowledge base
5. Update this file with your own profile
