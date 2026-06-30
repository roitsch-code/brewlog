<!-- Generierter Spike-Report (scripts/recommend-model-spike.mjs, Lauf #3 Variation-Stress). Nicht von Hand editieren. -->

# /recommend — Modellvergleich (Spike, Variation-Stress)
Generiert: 2026-06-30T11:21:35.607Z

6 Szenarien mit harten Pfaden: **Summer Time** (iced → muss iceGrams setzen + hot/ice splitten), **Time=special** (fast shot ≤150s), und Volumen **210/450/520 ml** (triggern die Kapazitätsregeln). Gleicher echter Prompt (SYSTEM_PROMPT + injizierter Korpus) an alle Modelle. Mistral läuft 2× pro Szenario, Claude-Baselines 1×.

Flags (alle objektiv): `drift` = Fabrikation (reconcileToReference: Abweichung vom `basedOn`-Referenzrezept) · `staged` = verbotene Mehrtemperatur · `cap` = **Kapazitätsverletzung** (z.B. AeroPress >230ml, Clever >450ml, Moccamaster <500ml) · `ice` = bei Summer Time fehlt `iceGrams` (⚠️ FEHLT) oder der gesetzte Wert. Jedes Rezept steht unten im Volltext.


---

## Summer Time · 210ml custom — washed Ethiopian, high-clarity (iced + small)

| Modell | Kandidat | Methode | basedOn | Dose | Water | Ratio | Temp | Grind | Zeit | staged | drift | cap | ice |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Opus | Japanese Iced V60 | V60 | Du 2019 — Origami Wave | 8.5g | 128g | 1:15.1 | 96°C | 395° | 2:10 | nein | — | — | ⚠️ FEHLT |
| Opus | Hoffmann Immersion Iced | Clever Dripper | Hoffmann Immersion Iced | 8.5g | 128g | 1:15.1 | 95°C | 424° | 5:00 | nein | — | — | ⚠️ FEHLT |
| Mistral·r1 | Apex Slow Percolation | Orea Apex | Own recipe (inspired by Friedhats’ prior + Wendelboe V60) | 8g | 120g | 1:15.0 | 96°C | 404° | 2:45 | nein | — | — | 90g |
| Mistral·r1 | Ultra-Short Aromatic Shot | AeroPress | Jura 2009 — Ultra-Short AeroPress | 8g | 120g | 1:15.0 | 78°C | 380° | 0:45 | nein | — | — | 90g |
| Mistral·r2 | Slow Percolation Floral Lock | Orea Apex | Own recipe (inspired by Du 2019 Origami Wave) | 8g | 120g | 1:15.0 | 95°C | 405° | 2:30 | nein | — | — | 90g |
| Mistral·r2 | Ultra-Short Aromatic Flash | AeroPress | Jura 2009 Ultra-Short AeroPress | 8g | 120g | 1:15.0 | 85°C | 385° | 1:30 | nein | — | — | 90g |
| Sonnet | Nordic Flash V60 | V60 | Wendelboe V60 — Nordic Light | 8g | 126g | 1:15.8 | 95°C | 397° | 2:50 | nein | — | — | 84g |
| Sonnet | Low-Temp AeroPress Concentrate Iced | AeroPress | Jura 2009 — Ultra-Short AeroPress | 8g | 126g | 1:15.8 | 78°C | 393° | 2:30 | nein | — | — | 84g |

<details><summary><b>Volltext der Rezepte Summer Time · 210ml custom — washed Ethiopian, high-clarity (iced + small)</b></summary>


#### Opus 4-7 (status quo)
> You're opening a textbook clarity coffee — Friedhats' light-roasted washed Yirgacheffe on near-zero-buffer water — and the only honest first-session question is whether THIS lot prefers percolated transparency or immersion roundness, so I'm running Wendelboe/Du-school pour-over against Hoffmann's water-first immersion under identical flash-chill conditions; watch the jasmine top-note across both cups as they warm — that's where Gagné's Zone-1 solubility tells you which physics won.

**Japanese Iced V60** — V60 · basedOn: Du 2019 — Origami Wave
Rezept: 8.5g : 128g (1:15.1) · 96°C · Grind 395° · 2:10
- *Warum:* Conical percolation on clarity water is the canonical move for a washed Yirgacheffe — flash-chilled, it preserves the jasmine/bergamot top notes that define this coffee.
- *Hypothese:* Minimal-agitation conical brewing at 96°C on near-zero-buffering water maximises Zone-1 acid and aromatic extraction; the hot brew dripping straight onto ice (flash chill) traps volatiles in the liquid before they escape.
- *Erwartete Tasse:* Crystalline jasmine and bergamot up top, lemon acidity through the middle, black tea finish — light-bodied, transparent, vivid.
- *Worauf achten:* Notice whether the aroma still pops when the drink reaches drinking temperature — that's your signal Zone 1 survived.
- *pourSteps:* 1) Ice in server (wait, 0s) — 82g ice in the carafe/server BEFORE you start brewing — the V60 drips directly onto it  2) Bloom (bloom, 20g, 35s) — Slow spiral from centre, wet all grounds evenly. Long bloom for full CO₂ release.  3) Swirl (swirl, 5s) — Gentle swirl to settle the bed flat — no stir  4) Pour 2 (pour, 70g, 20s) — Slow spiral, stay off the wall  5) Final pour (final, 128g, 20s) — Slow spiral to finish — minimal agitation  6) Drawdown onto ice (drain, 50s) — Coffee drips directly onto the ice — flash-chilling locks in aromatics

**Hoffmann Immersion Iced** — Clever Dripper · basedOn: Hoffmann Immersion Iced
Rezept: 8.5g : 128g (1:15.1) · 95°C · Grind 424° · 5:00
- *Warum:* An immersion contrast against the V60 — same coffee, same water, same ice, but full-submersion extraction physics instead of percolation, so you can taste what each method does to this lot.
- *Hypothese:* Coarser grind + 5-minute full immersion extracts evenly with zero pour-induced turbulence — the Clever's water-first/no-stir approach is the cleanest possible immersion, and flash-chilling preserves whatever aromatics survive the longer contact.
- *Erwartete Tasse:* Rounder than the V60 — same lemon and jasmine notes but with more weight, a softer acid edge, longer tea-like finish.
- *Worauf achten:* Compare the two cups side by side: does immersion mute the florals (predicted) or build a more cohesive cup? That tells you which physics this coffee prefers.
- *pourSteps:* 1) Ice in server (wait, 0s) — 82g ice in the receiving vessel BEFORE you brew  2) Pour all water (pour, 128g, 15s) — Pour all 128g over the grounds in the Clever (valve closed)  3) Swirl (swirl, 5s) — Gentle swirl to fully wet — never stir  4) Steep (wait, 220s) — Lid on. Even temperature, even extraction.  5) Swirl (swirl, 5s) — One gentle swirl before opening the valve  6) Drain onto ice (drain, 55s) — Place on the ice-filled server — the brew flash-chills as it drains


#### Mistral Large 3 (sovereign)
> This washed Yirgacheffe’s jasmine and bergamot aromatics are highly volatile and extract fastest in Zone 1, but they dissipate with heat and over-agitation—Gagné’s solubility sequence predicts they’ll fade above 95°C. Today’s portfolio tests two opposing strategies: the Orea Apex’s slow percolation for balanced clarity, and Jura’s ultra-short AeroPress to isolate the aromatics before they degrade. Watch how the cup’s top notes evolve as it cools—this will reveal whether the coffee’s potential lies in extended contact or fleeting extraction.

**Apex Slow Percolation** — Orea Apex · basedOn: Own recipe (inspired by Friedhats’ prior + Wendelboe V60)
Rezept: 8g : 120g (1:15.0) · 96°C · Grind 404° · 2:45
- *Warum:* The Orea Apex’s restricted flow and minimal agitation preserve the fragile Zone 1 aromatics while the 96°C water efficiently extracts them.
- *Hypothese:* A slow, even percolation with no post-bloom agitation will yield a tea-like cup where jasmine and bergamot dominate without bitterness.
- *Erwartete Tasse:* Delicate jasmine and bergamot aromatics, lemon brightness, and a silky body with no astringency.
- *Worauf achten:* Note how the aromatics evolve as the cup cools—do they sharpen or fade?
- *pourSteps:* 1) Bloom (bloom, 24g, 45s) — Slow spiral from centre out, wet all grounds evenly  2) Swirl (swirl, 5s) — Gentle swirl to settle bed, no stir  3) Pour 2 (pour, 60g, 20s) — Centre pour, avoid walls  4) Pour 3 (pour, 96g, 20s) — Spiral outward, keep bed flat  5) Final pour (final, 120g, 20s) — Centre pour, minimal agitation  6) Drawdown (drain, 55s) — Drain onto 90g ice in server

**Ultra-Short Aromatic Shot** — AeroPress · basedOn: Jura 2009 — Ultra-Short AeroPress
Rezept: 8g : 120g (1:15.0) · 78°C · Grind 380° · 0:45
- *Warum:* Jura’s ultra-short contact isolates the most volatile aromatics, perfect for this coffee’s jasmine and bergamot notes.
- *Hypothese:* Low-temperature (78°C) and 45-second contact will extract only the aromatic compounds, yielding a highly concentrated, floral-forward shot.
- *Erwartete Tasse:* Intense jasmine and bergamot aromatics, lemon zest, and a light body with no bitterness or astringency.
- *Worauf achten:* Compare the aromatic intensity to the Orea Apex—does the shorter contact preserve more top notes?
- *pourSteps:* 1) Invert (invert) — Secure cap with filter, place on scale  2) Add water (pour, 120g, 10s) — Pour 120g water quickly, start timer  3) Stir (stir, 5s) — Stir 4× vigorously to saturate grounds  4) Secure filter (wait, 5s) — Place filter cap, no press yet  5) Flip and press (press, 25s) — Flip onto server with 90g ice, press gently


#### Sonnet 4-6 (cheaper Claude)
> This washed Yirgacheffe Heirloom sits at the intersection of two competing demands Gagné's solubility sequence makes explicit: the florals you want (jasmine, bergamot) extract in Zone 1 and volatilise above 95°C, so you need enough heat for full extraction of a dense light roast but a hard temperature ceiling — and the single thing to watch across both candidates is whether those aromatic top notes survive into the chilled cup or collapse into flat sourness.

**Nordic Flash V60** — V60 · basedOn: Wendelboe V60 — Nordic Light
Rezept: 8g : 126g (1:15.8) · 95°C · Grind 397° · 2:50
- *Warum:* The V60's conical bed and open drain give the fastest, cleanest percolation path through a small dose, and Wendelboe's lean-ratio Nordic logic (lean ratio + swirl-not-stir + low-mineral water) is purpose-built for washed Yirgacheffe aromatic clarity.
- *Hypothese:* Percolation through a free-draining conical bed at 95°C keeps extraction in Zone 1–2, and flash-chilling the hot concentrate onto ice instantly arrests aromatic volatilisation, preserving jasmine and bergamot in the chilled cup.
- *Erwartete Tasse:* Bright, tea-like, jasmine-forward with vivid lemon acidity and a light, clean finish — aromatic clarity at the expense of body.
- *Worauf achten:* Whether jasmine and bergamot are present and distinct in the cold cup, or whether the brightness collapses into flat sourness — that's your extraction-completeness signal.
- *pourSteps:* 1) Bloom (bloom, 20g, 10s) — Slow spiral from centre out — wet all 8g evenly, avoid dry patches  2) Swirl (swirl, 5s) — Gentle swirl of the V60 body — not a stir; keeps the bed intact  3) Bloom rest (wait, 30s) — Let CO₂ escape fully before the main pour — 9 days fresh, moderate outgassing  4) Pour 1 (pour, 76g, 25s) — Steady spiral to 76g total — keep the stream gentle and central  5) Pour 2 (final) (final, 126g, 25s) — Complete the brew water to 126g — slow outward spiral  6) Drawdown (drain, 75s) — Drain directly onto 84g ice in the server — flash-chill locks aromatics immediately

**Low-Temp AeroPress Concentrate Iced** — AeroPress · basedOn: Jura 2009 — Ultra-Short AeroPress
Rezept: 8g : 126g (1:15.8) · 78°C · Grind 393° · 2:30
- *Warum:* Jura's low-temperature short-contact AeroPress logic selectively extracts the most volatile aromatic compounds (highly soluble even below 80°C) while entirely bypassing the slower-extracting bitter Zone 3 phenolics — a completely different extraction mechanism from the V60, making it the ideal contrast for a first characterisation session.
- *Hypothese:* At 78°C in an immersion vessel, the highly soluble aromatic esters (jasmine, bergamot) dissolve rapidly while the lower-solubility phenolic and bitter compounds barely engage in the short steep, producing a selective aromatic extract that reveals a different face of this coffee when pressed onto ice.
- *Erwartete Tasse:* Florally intense, slightly sweet, low bitterness, lighter acidity than the V60 — aromatic top-note concentration with a softer, almost tea-like body rather than citrus brightness.
- *Worauf achten:* Whether the aromatic top notes (jasmine, bergamot) are MORE or LESS distinct than the V60 — and whether the lower temperature produces a sweeter, softer cup or a thinner, underpowered one.
- *pourSteps:* 1) Setup (invert, 0s) — Inverted AeroPress — plunger seated at bottom, cap off; pre-soak paper filter with hot water  2) Add water (pour, 126g, 10s) — Pour all 126g at 78°C over the grounds in one steady pour  3) Stir (stir, 5s) — 3–4 firm stirs — ensure full saturation of all grounds  4) Steep (wait, 80s) — Cap the filter head (wet filter) — let the cool immersion work; no further agitation  5) Flip (flip, 5s) — Invert carefully over a cup containing 84g ice  6) Press (press, 50s) — Slow, steady press directly onto the ice — the hot concentrate flash-chills instantly

</details>

---

## Summer Time · 520ml big — natural Brazil, balanced (iced + big)

| Modell | Kandidat | Methode | basedOn | Dose | Water | Ratio | Temp | Grind | Zeit | staged | drift | cap | ice |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Opus | Japanese Iced V60 | V60 | Japanese Iced V60 (60/40 Hot/Ice) | 34g | 310g | 1:9.1 | 95°C | 396° | 3:00 | nein | — | — | ⚠️ FEHLT |
| Opus | Iced Chemex Bright | Chemex | Japanese Iced V60 (60/40 Hot/Ice) | 33g | 310g | 1:9.4 | 94°C | 400° | 3:30 | nein | — | — | ⚠️ FEHLT |
| Mistral·r1 | Turbulent Sweetness Flash | Orea Fast | Wölfl 2024 Orea FAST | 34g | 520g | 1:15.3 | 94°C | 408° | 2:40 | nein | — | — | 210g |
| Mistral·r1 | Slow Sweetness Immersion | Chemex (Japanese Iced) | Japanese Iced V60 (60/40 Hot/Ice) | 33g | 310g | 1:9.4 | 93°C | 402° | 3:30 | nein | — | — | 210g |
| Mistral·r2 | Flash-Chilled Aromatic Lock | V60 (Japanese Iced) | Japanese Iced V60 (60/40 Hot/Ice) | 34g | 310g | 1:9.1 | 95°C | 398° | 3:00 | nein | — | — | 210g |
| Mistral·r2 | Pulse-Pour Fermentation Control | Origami (cone) | Medina 2023 (Five Even Pours) | 34g | 520g | 1:15.3 | 93°C | 403° | 3:30 | nein | — | ⚠️ Origami @520ml (>450) | ⚠️ FEHLT |
| Sonnet | Iced V60 Flash-Clarity | V60 | Japanese Iced V60 (60/40 Hot/Ice) | 34g | 310g | 1:9.1 | 95°C | 394° | 3:00 | nein | — | — | 210g |
| Sonnet | Iced Kalita Sweet Wave | Kalita Wave | Own recipe | 34g | 310g | 1:9.1 | 95°C | 397° | 3:00 | nein | — | — | 210g |

<details><summary><b>Volltext der Rezepte Summer Time · 520ml big — natural Brazil, balanced (iced + big)</b></summary>


#### Opus 4-7 (status quo)
> You're meeting this coffee for the first time over ice, so the priority is to learn how its Natural Yellow Bourbon sweetness behaves under flash-chilling — Hoffmann's principle that hot-brew-onto-ice preserves aromatics cold brew loses. Both candidates honour April's clarity-forward, agitation-sensitive style with gentle swirl-only blooms; the variable you're isolating is filter geometry, so taste body side by side.

**Japanese Iced V60** — V60 · basedOn: Japanese Iced V60 (60/40 Hot/Ice)
Rezept: 34g : 310g (1:9.1) · 95°C · Grind 396° · 3:00
- *Warum:* The clean reference for iced brewing — conical V60 with flash-chilling preserves the peach and floral top notes that define Yellow Bourbon.
- *Hypothese:* Hot extraction at 95°C releases aromatic esters; rapid chilling on ice locks them in the liquid before they volatilise into the air.
- *Erwartete Tasse:* Cool, transparent peach and milk chocolate with a clean hazelnut finish — body on the lighter side.
- *Worauf achten:* Whether the peach reads as fresh and aromatic, or muted — that tells you whether 95°C is enough heat for this past-peak coffee.
- *pourSteps:* 1) Pre-load server (wait, 0s) — 210g ice in the server below the V60  2) Bloom (bloom, 45g, 40s) — Slow circles centre out; gentle swirl — no stir (natural process, agitation-sensitive)  3) Pour 2 (pour, 160g, 35s) — Smooth spiral pour  4) Final pour (final, 310g, 30s) — Continue spiral to the wall and back  5) Drawdown onto ice (drain, 75s) — Hot brew chills on contact — swirl the server briefly to mix

**Iced Chemex Bright** — Chemex · basedOn: Japanese Iced V60 (60/40 Hot/Ice)
Rezept: 33g : 310g (1:9.4) · 94°C · Grind 400° · 3:30
- *Warum:* Genuinely different extraction physics from the V60 — Chemex's thick bonded filter strips oils and fines for the cleanest, most tea-like iced cup.
- *Hypothese:* The thick bonded paper removes far more lipids and micro-fines than a V60 paper, exposing the bean's acid structure and aromatic top notes without textural masking.
- *Erwartete Tasse:* Crystal-clear and tea-like: pronounced peach and bergamot-adjacent brightness, hazelnut as a finishing whisper, very light body.
- *Worauf achten:* Body — Chemex strips weight from Naturals; if the cup feels thin, that's the filter, not the coffee.
- *pourSteps:* 1) Pre-load server (wait, 0s) — 210g ice in the Chemex below the filter cone, or in the receiving carafe  2) Bloom (bloom, 60g, 45s) — Gentle swirl ONLY — never stir (thick bonded filter channels if disturbed)  3) Pour 2 (pour, 155g, 35s) — Slow circular pour, away from the filter wall  4) Final pour (final, 310g, 40s) — Continue gentle circles to the centre  5) Drawdown onto ice (drain, 90s) — Thick filter slows flow — swirl the carafe briefly once drained


#### Mistral Large 3 (sovereign)
> This Yellow Bourbon Natural from Daterra sits at the intersection of fermentation-derived sweetness and delicate peach aromatics, demanding a brew approach that balances extraction efficiency with aromatic preservation—James Hoffmann's 'second sweet spot' principle suggests a moderate temperature and controlled agitation to avoid amplifying fermentation esters while still developing the coffee's chocolatey body.

**Turbulent Sweetness Flash** — Orea Fast · basedOn: Wölfl 2024 Orea FAST
Rezept: 34g : 520g (1:15.3) · 94°C · Grind 408° · 2:40
- *Warum:* This adapts the Wölfl method to leverage fast, turbulent extraction that preserves aromatic clarity while developing sweetness in a short contact time.
- *Hypothese:* The Orea Fast's turbulent pours and rapid drain will extract the coffee's fermentation-derived sugars and chocolatey body without over-extracting the peach aromatics, which are prone to dissipation at higher temperatures or longer contact times.
- *Erwartete Tasse:* A bright, aromatic cup with pronounced peach and hazelnut notes, a medium body, and a clean finish that avoids fermentation sharpness.
- *Worauf achten:* Notice how the fast drawdown and turbulent pours affect the balance between sweetness and acidity, and whether the peach aromatics remain vibrant.
- *pourSteps:* 1) Bloom (bloom, 70g, 30s) — Gentle swirl to wet all grounds evenly  2) Stir (stir, 5s) — 1–2× light stir to settle the bed  3) Pour 2 (pour, 220g, 20s) — Fast, turbulent pour to the center  4) Pour 3 (pour, 370g, 20s) — Maintain turbulence, keep slurry level high  5) Final pour (final, 520g, 20s) — Finish with a gentle swirl to level the bed  6) Drawdown (drain, 65s) — Fast open-bed drain onto ice

**Slow Sweetness Immersion** — Chemex (Japanese Iced) · basedOn: Japanese Iced V60 (60/40 Hot/Ice)
Rezept: 33g : 310g (1:9.4) · 93°C · Grind 402° · 3:30
- *Warum:* This adapts the Japanese Iced method to the Chemex's thicker filter and slower flow, which should build body and sweetness while flash-chilling preserves the peach aromatics.
- *Hypothese:* The Chemex's thick filter and slower drawdown will extract more body and sweetness from the coffee's fermentation sugars, while the ice flash-chills the brew to lock in the peach aromatics before they dissipate.
- *Erwartete Tasse:* A round, sweet cup with pronounced chocolatey body, hazelnut depth, and a vibrant peach finish, all balanced by a gentle acidity.
- *Worauf achten:* Pay attention to how the thicker Chemex filter and slower drawdown affect the body and sweetness compared to the Orea Fast's clarity-focused approach.
- *pourSteps:* 1) Prep ice (wait, 5s) — Place 210g ice in the server  2) Bloom (bloom, 60g, 45s) — Gentle swirl to wet all grounds evenly  3) Pour 2 (pour, 155g, 30s) — Slow, spiral pour from center to edge  4) Final pour (final, 310g, 30s) — Maintain a steady, gentle flow  5) Drawdown (drain, 60s) — Slow drain onto ice for flash-chilling


#### Sonnet 4-6 (cheaper Claude)
> This Yellow Bourbon natural — moderate solubility, 24 days off-roast, brewed over ice — sits squarely in Gagné's Zone-2 tension: flash-chilling is superb at locking Zone-1 aromatics before they volatilise, but the peach and hazelnut sweetness you actually want lives in Zone 2, so the real question across both candidates is whether percolation geometry (V60 clarity vs Kalita pool-forming flat bed) shifts which zone the ice captures.

**Iced V60 Flash-Clarity** — V60 · basedOn: Japanese Iced V60 (60/40 Hot/Ice)
Rezept: 34g : 310g (1:9.1) · 95°C · Grind 394° · 3:00
- *Warum:* The V60's conical bed and fast drawdown produce the cleanest possible extract for flash-chilling, where preserving Zone-1 aromatics (peach, floral top notes) before they volatilise is the entire point.
- *Hypothese:* Brewing at 95°C and draining a concentrated 1:9 hot extract directly onto 210g ice will lock the Yellow Bourbon's fragile peach and soft floral esters into solution before thermal loss, yielding a bright, transparent iced cup.
- *Erwartete Tasse:* Clean peach and milk chocolate on the nose, medium-bright acidity, lighter body from the 3-pour structure — a transparent read of the variety's natural sweetness.
- *Worauf achten:* Notice whether the peach note arrives on the nose before you taste — if it does, the flash-chill worked; if the cup reads flat or hollow, the extraction was under-extracted at the hot stage.
- *pourSteps:* 1) Set up server (wait, 0s) — Place 210g ice in the server before brewing — do not start the timer yet  2) Bloom (bloom, 68g, 45s) — Slow spiral from centre out — wet all grounds; gentle swirl, do not stir  3) Pour 2 (pour, 160g, 30s) — Steady spiral pour, keep the bed level  4) Final pour (final, 310g, 30s) — Continuous spiral to the edge and back to centre  5) Drawdown onto ice (drain, 75s) — Let the concentrate drain fully onto the ice — flash-chilling locks aromatics

**Iced Kalita Sweet Wave** — Kalita Wave · basedOn: Own recipe
Rezept: 34g : 310g (1:9.1) · 95°C · Grind 397° · 3:00
- *Warum:* The Kalita's flat bed and three-hole restricted drain create a momentary pool above the paper on each pour, adding a short immersion phase that builds mouthfeel and draws more Zone-2 sugars — testing whether the Yellow Bourbon's hazelnut and chocolate body notes survive flash-chilling better under gentle immersion-adjacent conditions than under a pure V60 percolation.
- *Hypothese:* The Kalita's flat-bed geometry and slightly slower restricted drain will extend water-to-grounds contact just enough to shift extraction toward Zone-2 sweetness relative to the V60, yielding a rounder, more chocolate-forward iced cup from the same dose and temperature.
- *Erwartete Tasse:* Rounder body, milk chocolate and hazelnut leading, softer acidity — the fermentation-derived sweetness of the natural process expressing more fully than in the V60 candidate.
- *Worauf achten:* Compare the body weight in the first sip against the V60 cup — if the Kalita reads thicker and the chocolate note is more present, the flat-bed pool effect is doing real work; if both cups taste identical, the flash-chilling is dominating and the brewer difference becomes secondary.
- *pourSteps:* 1) Set up server (wait, 0s) — Place 210g ice in the server before brewing — do not start the timer yet  2) Bloom (bloom, 68g, 40s) — Gentle swirl only — NEVER stir a Kalita; flat bed channels under spoon agitation  3) Pour 2 (pour, 155g, 30s) — Steady flat pour across the whole bed surface, keep it even  4) Pour 3 (pour, 240g, 30s) — Same flat spiral; let the bed stay submerged briefly for extra contact  5) Final pour (final, 310g, 25s) — Pour to centre and finish — the flat bed holds a brief pool before drain  6) Drawdown onto ice (drain, 55s) — The Kalita's three small holes slow the drain slightly — brief pool before ice contact is normal

</details>

---

## Special/short · 350ml — washed Kenyan SL28, body-forward (fast shot)

| Modell | Kandidat | Methode | basedOn | Dose | Water | Ratio | Temp | Grind | Zeit | staged | drift | cap | ice |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Opus | High-Extraction V60 | V60 | Hedrick High-Extraction V60 (LH Variation) | 23g | 350g | 1:15.2 | 98°C | 398° | 2:30 | nein | — | — | — |
| Opus | Water-First Clever Immersion | Clever Dripper | Own recipe | 23g | 350g | 1:15.2 | 96°C | 424° | 2:30 | nein | — | — | — |
| Mistral·r1 | High-Agitation Orea Classic | Orea Classic | Own recipe | 23g | 350g | 1:15.2 | 98°C | 406° | 2:30 | nein | — | — | — |
| Mistral·r1 | Immersion Clever Baseline | Clever Dripper | Own recipe | 23g | 350g | 1:15.2 | 96°C | 421° | 3:00 | nein | — | — | — |
| Mistral·r2 | Deep-Bed Immersion Body | Origami Air M | Own recipe | 23g | 350g | 1:15.2 | 97°C | 403° | 3:00 | nein | — | — | — |
| Mistral·r2 | Turbulent Percolation Body | Orea Classic | Wölfl-adapted Orea Fast | 23g | 350g | 1:15.2 | 96°C | 408° | 2:30 | nein | — | — | — |
| Sonnet | Extended Immersion Body Build | Clever Dripper | Clever Extended | 23g | 350g | 1:15.2 | 96°C | 424° | 5:30 | nein | — | — | — |
| Sonnet | Flat-Bed High-Temp Drive | Kalita Wave | Own recipe | 23g | 350g | 1:15.2 | 97°C | 399° | 3:30 | nein | — | — | — |

<details><summary><b>Volltext der Rezepte Special/short · 350ml — washed Kenyan SL28, body-forward (fast shot)</b></summary>


#### Opus 4-7 (status quo)
> Your body-forward goal collides productively with a Nyeri SL28 — Hedrick's framework says body in dense washed coffees is built through extraction yield, not concentration, while the immersion contrast lets you taste body-from-contact instead; watch closely whether the heavier cup is the one with more extraction work done or the one with more time, because that answer shapes every brew of this bag.

**High-Extraction V60** — V60 · basedOn: Hedrick High-Extraction V60 (LH Variation)
Rezept: 23g : 350g (1:15.2) · 98°C · Grind 398° · 2:30
- *Warum:* SL28 tolerates aggressive extraction, and Hedrick's high-yield approach builds body through extraction depth rather than concentration.
- *Hypothese:* Boiling water + vigorous bloom stir + a finer grind drives yield above 22%, dragging late-cycle sugars and melanoidins into the cup for tangible body without bitterness on a dense washed Kenyan.
- *Erwartete Tasse:* Full-bodied blackcurrant with savoury tomato depth, syrupy texture, a long red-wine finish.
- *Worauf achten:* Does the body feel structural (heavy and integrated) or just concentrated? Is the finish sweet or tannic?
- *pourSteps:* 1) Bloom (bloom, 70g, 8s) — Wet all grounds evenly, fast pour  2) Vigorous stir (stir, 7s) — 3–5× firm stirs — break up the bed, eliminate dry pockets  3) Bloom rest (wait, 30s) — Let CO₂ release, bed settles  4) Main pour (pour, 230g, 25s) — Spiral pour, brisk but controlled  5) Final pour (final, 350g, 20s) — Continue spiral, keep flow steady  6) Rao spin (swirl, 5s) — Firm swirl to flatten bed and dislodge grounds from the wall  7) Drawdown (drain, 55s)

**Water-First Clever Immersion** — Clever Dripper · basedOn: Own recipe
Rezept: 23g : 350g (1:15.2) · 96°C · Grind 424° · 2:30
- *Warum:* A full immersion with no percolation gives a different body texture — heavier and more rounded — for direct comparison against the percolation V60.
- *Hypothese:* Total submersion at 96°C for ~2:30 pushes Zone 2 sugars evenly across every particle without any pour turbulence, building body through contact time rather than agitation.
- *Erwartete Tasse:* Rounder, heavier mouthfeel; blackcurrant softened and integrated; less acid edge, more dried-fruit and red-wine sweetness.
- *Worauf achten:* Is the body heavier than the V60 or just muddier? Where did the blackcurrant go — softened, or muted?
- *pourSteps:* 1) Water in (pour, 350g, 15s) — Valve closed. Pour all 350g into the empty Clever first.  2) Add coffee (bloom, 5s) — Sprinkle 23g coffee on top — let it float and self-saturate.  3) Settle (wait, 10s) — Coffee saturates evenly without stirring.  4) First swirl (swirl, 5s) — Gentle swirl — sink the crust, no stirring.  5) Steep (immersion-steep, 50s)  6) Mid-swirl (swirl, 5s) — Second gentle swirl, equalise the bed.  7) Drain (drain, 60s) — Place on cup — water-first drains faster than coffee-first.


#### Mistral Large 3 (sovereign)
> Kiriga’s SL28 is a high-density, high-solubility coffee that thrives on input but risks harshness if over-extracted—Perger’s agitation theory predicts that vigorous bloom agitation will build body, but the washed process demands restraint to avoid Zone 3 bitterness, so the contrast between high-agitation percolation and gentle immersion will reveal where the coffee’s sweet spot lies.

**High-Agitation Orea Classic** — Orea Classic · basedOn: Own recipe
Rezept: 23g : 350g (1:15.2) · 98°C · Grind 406° · 2:30
- *Warum:* Orea Classic’s medium flow rate and high-agitation bloom build body without over-extracting the delicate SL28.
- *Hypothese:* Vigorous bloom agitation and a 2:30 total brew time will extract Zone 2 sugars and melanoidins, amplifying body while keeping Zone 3 bitterness at bay.
- *Erwartete Tasse:* Rich blackcurrant and red-wine depth with a creamy mouthfeel, but watch for tomato-skin sharpness if the grind is too fine.
- *Worauf achten:* Does the body emerge cleanly, or does the cup tip into harshness as it cools?
- *pourSteps:* 1) Bloom (bloom, 46g, 20s) — Slow spiral from centre out, wet all grounds evenly  2) Stir (stir, 10s) — Vigorous 5–6× stir to break clumps and degas  3) Pour 2 (pour, 150g, 20s)  4) Pour 3 (pour, 250g, 20s)  5) Final pour (final, 350g, 20s)  6) Swirl (swirl, 5s) — Gentle swirl to flatten the bed  7) Drawdown (drain, 55s)

**Immersion Clever Baseline** — Clever Dripper · basedOn: Own recipe
Rezept: 23g : 350g (1:15.2) · 96°C · Grind 421° · 3:00
- *Warum:* Immersion’s even extraction isolates the coffee’s natural body without agitation-induced harshness.
- *Hypothese:* A 3-minute steep at 96°C will extract Zone 2 sugars uniformly, yielding a rounder, more integrated body than percolation.
- *Erwartete Tasse:* Smoother blackcurrant and tomato notes with a velvety mouthfeel, but potentially less aromatic intensity than the Orea.
- *Worauf achten:* Does the immersion cup feel more balanced, or does it lack the Orea’s vibrancy?
- *pourSteps:* 1) Pour water (pour, 350g, 15s) — Pour all water in one go, centre to edge  2) Swirl (swirl, 5s) — Gentle swirl to saturate all grounds  3) Steep (wait, 120s) — Let the coffee extract undisturbed  4) Swirl (swirl, 5s) — Final swirl to settle the bed  5) Drain (drain, 35s)


#### Sonnet 4-6 (cheaper Claude)
> Kenya SL28 is one of the slowest-extracting varieties in specialty coffee — Gagné's physics of dense cell walls predict that hitting the Zone-2 body and savoury depth the bag notes promise requires either sustained immersion contact time or aggressive percolation temperature, and the single thing to watch across both candidates today is whether the cup achieves full mouthfeel or stalls in a thin, tomato-skin sourness that signals the dense grounds haven't opened up yet.

**Extended Immersion Body Build** — Clever Dripper · basedOn: Clever Extended
Rezept: 23g : 350g (1:15.2) · 96°C · Grind 424° · 5:30
- *Warum:* Full immersion holds every gram of water in contact with the SL28 bed for over four minutes, giving the high-density variety the sustained time it needs to push extraction deep into Zone 2 where body and savoury sweetness live.
- *Hypothese:* Extended uniform contact at 96°C will coax the dense SL28 grounds into releasing maillard body and red-wine phenolics without the channeling risk that a turbulent pour-over introduces on a first unfamiliar lot.
- *Erwartete Tasse:* Full, syrupy mouthfeel with blackcurrant jam, dark-cherry sweetness, and a savoury tomato depth in the finish — rounder than a pour-over would give at the same dose.
- *Worauf achten:* Notice the weight and texture of the liquid in your mouth — does it coat the palate (body goal met) or does it feel watery despite the steep time, which would signal the grind is still too coarse for this dense variety?
- *pourSteps:* 1) Pour (pour, 350g, 15s) — Pour all 350g over the grounds in a steady spiral to wet evenly  2) Swirl (swirl, 5s) — Gentle swirl to settle the bed flat — do not stir  3) Steep (wait, 260s) — Valve closed — full immersion, let SL28's sugars and phenolics develop at contact  4) Pre-drain swirl (swirl, 5s) — Gentle swirl to lift settled fines back into suspension before draining  5) Drain (drain, 45s) — Set on cup and drain fully — note colour depth in the server

**Flat-Bed High-Temp Drive** — Kalita Wave · basedOn: Own recipe
Rezept: 23g : 350g (1:15.2) · 97°C · Grind 399° · 3:30
- *Warum:* The Kalita's flat bed and three-hole drain create the most even percolation geometry of any pour-over in your kit, distributing fresh hot water across the full SL28 bed uniformly rather than funnelling through a cone — at 97°C this pushes extraction hard enough to build body through sheer yield rather than contact time.
- *Hypothese:* A high-temperature flat-bed percolation with a 45-second bloom and four even pours will drive SL28 extraction yield into the upper Zone 2 range where body compounds and red-wine phenolics dominate, without the immersion's risk of over-extracting bitterness.
- *Erwartete Tasse:* Structured and defined body with vivid blackcurrant and tomato acidity still present, savoury depth in the finish, and a cleaner, more defined cup shape than the Clever — less syrupy but more articulate.
- *Worauf achten:* Compare the texture directly against the Clever: does the Kalita feel livelier and more defined (percolation delivering clarity alongside body) or does it feel thinner and more angular (immersion won the body contest)?
- *pourSteps:* 1) Bloom (bloom, 46g, 45s) — Pour 2× dose (46g) in slow circles — SL28 is dense, give it a full 45s to degas  2) Pour 2 (pour, 160g, 25s) — Gentle spiral pour — Kalita demands swirl only, never stir; keep pour height low  3) Pour 3 (pour, 260g, 25s) — Maintain steady flow rate, aim for flat bed throughout  4) Final pour (final, 350g, 25s) — Final pour, central spiral — resist any extra swirl on the Kalita  5) Drawdown (drain, 90s) — Kalita's three holes create a flat-bed drawdown — time it: should finish around 3:30 total

</details>

---

## Special/short · 210ml custom — Geisha, aromatic (fast + small)

| Modell | Kandidat | Methode | basedOn | Dose | Water | Ratio | Temp | Grind | Zeit | staged | drift | cap | ice |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Opus | Du Wave Aromatic Lift | Origami (wave) | Du 2019 — Origami Wave | 14g | 210g | 1:15.0 | 94°C | 402° | 2:20 | nein | — | — | — |
| Opus | Jura Ultra-Short Concentrate | AeroPress | Jura 2009 — Ultra-Short AeroPress | 21g | 210g | 1:10.0 | 75°C | 393° | 0:30 | nein | — | — | — |
| Mistral·r1 | Ultra-Short Aromatic Shot | AeroPress | Jura 2009 — Ultra-Short AeroPress | 14g | 140g | 1:10.0 | 75°C | 388° | 0:15 | nein | — | — | — |
| Mistral·r1 | Flat-Bed Clarity Pour | Origami (wave) | Du 2019 — Origami Wave | 14g | 210g | 1:15.0 | 94°C | 382° | 1:45 | nein | — | — | — |
| Mistral·r2 | Apex Clarity Baseline | Orea Apex | Own recipe (inspired by Manhattan’s Orea Apex preference) | 14g | 210g | 1:15.0 | 96°C | 403° | 2:30 | nein | — | — | — |
| Mistral·r2 | Ultra-Short Aromatic Shot | AeroPress | Jura 2009 — Ultra-Short AeroPress | 14g | 140g | 1:10.0 | 78°C | 388° | 0:15 | nein | — | — | — |
| Sonnet | Apex Floral Clarity | Orea Apex | Orea Apex clarity | 14g | 210g | 1:15.0 | 94°C | 404° | 2:30 | nein | — | — | — |
| Sonnet | Low-Temp Aromatic Concentrate | AeroPress | Jura 2009 — Ultra-Short AeroPress | 14g | 210g | 1:15.0 | 80°C | 393° | 2:30 | nein | — | — | — |

<details><summary><b>Volltext der Rezepte Special/short · 210ml custom — Geisha, aromatic (fast + small)</b></summary>


#### Opus 4-7 (status quo)
> You're meeting a Panama Geisha at peak freshness on near-zero-buffering water, which is the configuration where Gagné's solubility zones become audible in the cup — so the question today isn't whether you'll get clarity but which slice of the aromatic spectrum you want, the balanced Du-style flat-bed expression or Jura's narrow-band 75°C isolate; watch the jasmine-to-bergamot ratio in both.

**Du Wave Aromatic Lift** — Origami (wave) · basedOn: Du 2019 — Origami Wave
Rezept: 14g : 210g (1:15.0) · 94°C · Grind 402° · 2:20
- *Warum:* The Origami + wave filter on a 73ppm blend is the textbook delivery vehicle for Geisha florals — shallow flat bed, fast even drawdown, near-zero buffering.
- *Hypothese:* A thin flat bed with quick drawdown keeps total contact in Zone 1–2, so jasmine and bergamot reach the cup before phenolics engage.
- *Erwartete Tasse:* Tea-like clarity, lifted jasmine and bergamot up front, white peach mid-palate, clean lemon-zest finish, light body.
- *Worauf achten:* Whether the florals arrive on the nose before the first sip — that's the diagnostic for Zone-1 preservation.
- *pourSteps:* 1) Bloom (bloom, 55g, 10s) — Wet all grounds, gentle centre-out circles  2) Light stir (stir, 5s) — 1–2× to settle and saturate evenly — no more  3) Bloom rest (wait, 25s) — Let CO₂ escape; 11 days is peak so degas is moderate  4) Pour 2 (pour, 125g, 20s) — Gentle spiral, keep water off the wall  5) Bed-rest (wait, 20s) — Wait for the bed to draw down to a moist sheen  6) Final pour (final, 210g, 20s) — Same gentle spiral, no agitation  7) Drawdown (drain, 40s) — Should finish by ~2:20 total

**Jura Ultra-Short Concentrate** — AeroPress · basedOn: Jura 2009 — Ultra-Short AeroPress
Rezept: 21g : 210g (1:10.0) · 75°C · Grind 393° · 0:30
- *Warum:* A radically different physics hypothesis: 75°C + 1:10 + ~30s total isolates only the most-soluble aromatic top notes and refuses to engage anything else.
- *Hypothese:* Sub-80°C water selectively dissolves volatile aromatics while leaving body and bitter compounds dormant — even at 1:10, ~30s is too short to over-extract.
- *Erwartete Tasse:* Highly concentrated, narrow-spec aromatic-forward cup — intense bergamot and peach esters, very little body, almost no Zone-2 sweetness, short finish.
- *Worauf achten:* Whether the aromatics feel more INTENSE than the Origami but less BALANCED — that confirms Zone 1 isolated without Zone 2 support.
- *pourSteps:* 1) Invert (invert) — AeroPress inverted, plunger seated to first mark  2) Add water (pour, 210g, 8s) — Pour 75°C water over the grounds quickly  3) Stir (stir, 4s) — 4 brisk stirs — Jura's full agitation move  4) Cap & flip (flip) — Secure pre-rinsed paper filter, flip onto your cup  5) Press (press, 18s) — Steady gentle press to serve — total contact ~30s


#### Mistral Large 3 (sovereign)
> Geisha’s defining tension is its unparalleled aromatic complexity versus the fragility of those compounds—jasmine and bergamot extract early (Zone 1) and dissipate above 96°C, so your challenge is to preserve them without over-extracting body or bitterness. Per Gagné’s solubility sequence, the two candidates test opposite ends of the aromatic-preservation spectrum: the AeroPress isolates Zone 1 with ultra-low temperature and short contact, while the Origami Wave uses a flat bed and fast drawdown to maximize clarity. Watch how each method balances aromatic intensity against cup structure.

**Ultra-Short Aromatic Shot** — AeroPress · basedOn: Jura 2009 — Ultra-Short AeroPress
Rezept: 14g : 140g (1:10.0) · 75°C · Grind 388° · 0:15
- *Warum:* This candidate isolates the most volatile aromatic compounds by using ultra-low temperature (75°C) and an extreme 1:10 ratio, ensuring Zone 1 compounds dominate before Zone 2 or 3 can develop.
- *Hypothese:* Below 80°C, Geisha’s jasmine and bergamot volatiles dissolve rapidly, while the short 15-second contact prevents over-extraction of body or bitterness, creating a spec-narrow aromatic shot.
- *Erwartete Tasse:* Highly aromatic, with intense jasmine and bergamot upfront, but thin-bodied and potentially one-dimensional—aromatics without depth.
- *Worauf achten:* How much of the coffee’s aromatic complexity survives the ultra-short extraction, and whether the lack of body makes the cup feel incomplete.
- *pourSteps:* 1) Invert (invert) — Secure filter cap, place on scale, zero.  2) Add water (pour, 140g, 5s) — Pour 140g water quickly, saturating all grounds.  3) Stir (stir, 3s) — Stir 4× vigorously to ensure even wetting.  4) Secure filter (wait, 2s) — Place filter on top, press lightly to seal.  5) Flip and press (flip) — Flip onto cup, press steadily for 5 seconds.  6) Press (press, 5s) — Press until you hear a hiss.

**Flat-Bed Clarity Pour** — Origami (wave) · basedOn: Du 2019 — Origami Wave
Rezept: 14g : 210g (1:15.0) · 94°C · Grind 382° · 1:45
- *Warum:* The Origami Wave’s flat bed and fast drawdown are ideal for Geisha’s clarity, while the 1:15 ratio and 94°C temperature protect its delicate florals from over-extraction.
- *Hypothese:* A thin, even bed with minimal agitation and a quick drawdown will extract Geisha’s aromatic compounds cleanly, avoiding the muddiness that can come from deeper beds or longer contact times.
- *Erwartete Tasse:* Bright, transparent, and aromatic—jasmine and bergamot will dominate, with a delicate lemon zest acidity and a tea-like body.
- *Worauf achten:* Whether the flat bed and fast drawdown preserve the coffee’s aromatic complexity without introducing harshness or astringency.
- *pourSteps:* 1) Bloom (bloom, 42g, 10s) — Pour 42g water in slow spirals from centre out, wetting all grounds.  2) Rest (wait, 10s) — Let the bloom settle; avoid disturbing the bed.  3) Pour 2 (pour, 120g, 20s) — Pour in slow, controlled spirals, keeping the bed flat.  4) Rest (wait, 15s) — Let the bed draw down to a moist surface before the final pour.  5) Final pour (final, 210g, 20s) — Pour gently to 210g, avoiding the filter walls.  6) Drawdown (drain, 30s) — Let the coffee drain fully; total time ~1:45.


#### Sonnet 4-6 (cheaper Claude)
> This Panama Geisha's jasmine and bergamot aromatics are governed by Gagné's solubility-sequence law — they live in Zone 1, dissolve first, and are destroyed by heat above 94°C and dispersed by agitation — so the single thing to watch across both candidates is whether the aromatic top notes arrive vivid and distinct or muted, which will tell you exactly where this lot's ceiling sits and which extraction physics honours it best.

**Apex Floral Clarity** — Orea Apex · basedOn: Orea Apex clarity
Rezept: 14g : 210g (1:15.0) · 94°C · Grind 404° · 2:30
- *Warum:* The Orea Apex's restricted outlet maximizes bed contact time while Manhattan's roaster prior explicitly names it as the preferred vessel for premium clarity lots — it is the natural first hypothesis for a Geisha where the aromatic ceiling is the question.
- *Hypothese:* A slow, minimal-agitation Apex draw at 94°C on 73ppm water will hold Zone 1 aromatic compounds — jasmine, bergamot — in solution long enough to register fully in the cup without the thermal destruction that occurs above 94°C.
- *Erwartete Tasse:* Delicate jasmine and bergamot on the nose, lemon zest brightness in the mid-palate, light body with a clean finish — a tea-like, transparent cup.
- *Worauf achten:* Notice whether the floral top notes are vivid and distinct or muted — if they read flat, the bloom was insufficient or the grind is too coarse; if the cup tastes thin and sour, grind finer.
- *pourSteps:* 1) Bloom (bloom, 28g, 15s) — Slow central spiral out — wet all grounds evenly, no excess turbulence  2) Stir (stir, 5s) — 1 gentle stir only — just enough to submerge any dry crust  3) Bloom rest (wait, 25s) — Let CO₂ degas — 11-day-old coffee still has moderate gas; a full 25s rest prevents channeling  4) Pour 2 (pour, 90g, 20s) — Steady spiral pour, keep stream low and gentle  5) Pour 3 (pour, 150g, 20s) — No agitation after this pour  6) Final pour (final, 210g, 20s) — Pour centrally, no swirl — let the Apex plate control contact time  7) Drawdown (drain, 45s) — Apex plate is the slowest Orea bottom — expect a clean, measured drain

**Low-Temp Aromatic Concentrate** — AeroPress · basedOn: Jura 2009 — Ultra-Short AeroPress
Rezept: 14g : 210g (1:15.0) · 80°C · Grind 393° · 2:30
- *Warum:* A low-temperature short-steep AeroPress tests whether selective cold-side extraction isolates the most volatile Geisha aromatics in a way that percolation physically cannot — a genuinely different extraction physics that Jura used specifically on aromatic washed lots.
- *Hypothese:* At 80°C the most volatile aromatic esters dissolve rapidly (they are highly soluble at low temperature) while the slower-extracting Zone-3 phenolics and bitters barely engage in 90 seconds, delivering a concentrated aromatic-forward cup with minimal astringency.
- *Erwartete Tasse:* Intensely aromatic — white peach and bergamot may read almost perfumed — with moderate brightness, light body, and a very clean finish; expect a noticeably different aromatic register than the Apex.
- *Worauf achten:* Compare the aromatic register directly against the Apex cup — if the bergamot and peach read more vivid here, low-temperature selective extraction is doing real work; if the cup tastes sour and thin, the temperature was too low or steep too short.
- *pourSteps:* 1) Invert AeroPress (invert, 0s) — Set up inverted so no drip-through during steep  2) Add water (pour, 210g, 15s) — Pour all 210g at once over the dose — 80°C, gentle central pour  3) Stir (stir, 10s) — 4 gentle stirs to ensure full saturation — Jura's 4-stir technique  4) Steep (wait, 90s) — Let the low temperature selectively dissolve aromatic esters without engaging Zone-3 bitters  5) Flip and press (flip, 5s) — Flip carefully — steady, no turbulence  6) Press (press, 30s) — Slow, even press — stop before you hear air hiss

</details>

---

## Normal · 450ml custom — washed Pink Bourbon, high-clarity (Clever-at-max edge)

| Modell | Kandidat | Methode | basedOn | Dose | Water | Ratio | Temp | Grind | Zeit | staged | drift | cap | ice |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Opus | Du-style Origami Wave | Origami (wave) | Du 2019 — Origami Wave | 30g | 450g | 1:15.0 | 94°C | 402° | 2:45 | nein | — | — | — |
| Opus | Double-Bloom V60 | V60 | Standout — Double-Bloom V60 | 27g | 450g | 1:16.7 | 94°C | 400° | 4:00 | nein | — | — | — |
| Mistral·r1 | Du Wave Fast Drawdown | Origami (wave) | Du 2019 — Origami Wave | 30g | 450g | 1:15.0 | 94°C | 402° | 2:45 | nein | — | — | — |
| Mistral·r1 | Hoffmann Immersion Clarity | Clever Dripper | Own recipe | 30g | 450g | 1:15.0 | 94°C | 421° | 4:30 | nein | — | — | — |
| Mistral·r2 | Origami Wave Fast Clarity | Origami (wave) | Du 2019 — Origami Wave | 30g | 450g | 1:15.0 | 94°C | 402° | 2:45 | nein | — | — | — |
| Mistral·r2 | V60 Double-Bloom Clarity | V60 | Standout — Double-Bloom V60 | 30g | 450g | 1:15.0 | 94°C | 404° | 3:30 | nein | — | — | — |
| Sonnet | Wölfl-Adapted Orea Fast | Orea Fast | Wölfl 2024 — Orea V4 Fast | 28g | 445g | 1:15.9 | 93°C | 405° | 2:25 | nein | — | — | — |
| Sonnet | Double-Bloom V60 Clarity | V60 | Standout — Double-Bloom V60 | 27g | 450g | 1:16.7 | 93°C | 399° | 5:00 | nein | — | — | — |

<details><summary><b>Volltext der Rezepte Normal · 450ml custom — washed Pink Bourbon, high-clarity (Clever-at-max edge)</b></summary>


#### Opus 4-7 (status quo)
> You're meeting a Pink Bourbon that — per WCR 2024 — drinks like an Ethiopian landrace, so the whole cup is decided in Zone 1 where jasmine and lemon-pith live and where, as Gagné reminds us, aromatics dissipate above ~96°C; both candidates hold 94°C on your clarity blend and only change bed geometry, so watch which one keeps the florals brightest on the nose.

**Du-style Origami Wave** — Origami (wave) · basedOn: Du 2019 — Origami Wave
Rezept: 30g : 450g (1:15.0) · 94°C · Grind 402° · 2:45
- *Warum:* A thin flat bed plus the clarity blend is the textbook setup for landrace-style aromatics.
- *Hypothese:* Wave-filter flat bed drains fast and evenly, keeping contact in Zone 1–2 where the jasmine and peach live.
- *Erwartete Tasse:* Transparent, tea-like body with vivid jasmine and lemon-pith lift, peach on the finish.
- *Worauf achten:* Whether the florals arrive on the nose before the first sip and how long the lemon-pith brightness holds as the cup cools.
- *pourSteps:* 1) Bloom (bloom, 110g, 10s) — Saturate evenly, centre-out  2) Swirl (swirl, 5s) — Gentle swirl — wave bed channels if stirred  3) Bloom rest (wait, 35s)  4) Pour 2 (pour, 260g, 25s) — Slow spiral, keep water off the wall  5) Rest (wait, 20s) — Let surface go to a moist sheen  6) Final pour (final, 450g, 25s)  7) Drawdown (drain, 45s)

**Double-Bloom V60** — V60 · basedOn: Standout — Double-Bloom V60
Rezept: 27g : 450g (1:16.7) · 94°C · Grind 400° · 4:00
- *Warum:* A deep V60 cone with double bloom contrasts directly against the Origami's flat fast bed.
- *Hypothese:* Two small blooms degas the bed fully before main extraction, so the Zone-1 aromatics extract on an even, channel-free puck.
- *Erwartete Tasse:* Rounder than the wave with similar floral clarity — more peach and sweetness, slightly more body, brightness still present.
- *Worauf achten:* Compared to the Origami: is the cup heavier and sweeter, or does the deeper bed mute the jasmine?
- *pourSteps:* 1) Bloom 1 (bloom, 45g, 5s) — Quick saturate, centre-out  2) Wait (wait, 25s) — Let CO₂ vent  3) Bloom 2 (bloom, 90g, 5s) — Second saturation reaches any dry pockets  4) Wait (wait, 25s)  5) Pour 2 (pour, 270g, 35s) — Slow spiral  6) Rest (wait, 20s)  7) Final pour (final, 450g, 35s)  8) Drawdown (drain, 90s)


#### Mistral Large 3 (sovereign)
> This washed Pink Bourbon’s delicate jasmine and lemon-pith aromatics are highly volatile and dissipate quickly above 96°C, so you’ll cap temperature at 94°C and use the clarity blend to lift the top notes. The tension is balancing Zone 1 extraction (florals) with Zone 2 (sweetness) without invading Zone 3 (bitterness)—watch how each method’s contact time and agitation affect the cup’s transparency and depth.

**Du Wave Fast Drawdown** — Origami (wave) · basedOn: Du 2019 — Origami Wave
Rezept: 30g : 450g (1:15.0) · 94°C · Grind 402° · 2:45
- *Warum:* The Origami Wave’s flat bed and fast drawdown preserve the jasmine and lemon-pith aromatics by minimizing Zone 3 contact.
- *Hypothese:* A thin, even bed with tight particle distribution (via grind calibration) and low agitation will extract Zone 1 efficiently before the florals dissipate.
- *Erwartete Tasse:* Bright, tea-like clarity with pronounced jasmine and lemon-pith acidity, peach sweetness emerging as the cup cools.
- *Worauf achten:* How the aromatics hold up during the fast drawdown—do they fade or sharpen?
- *pourSteps:* 1) Bloom (bloom, 60g, 10s) — Gentle spiral from center out, saturate all grounds  2) Rest (wait, 10s) — Let the bed draw to a moist surface  3) Pour 2 (pour, 150g, 20s) — Slow center pour, avoid disturbing the flat bed  4) Rest (wait, 20s) — Wait until the bed is just moist, not dry  5) Final pour (final, 450g, 20s) — Gentle spiral to the edge, keep the bed flat  6) Drawdown (drain, 85s)

**Hoffmann Immersion Clarity** — Clever Dripper · basedOn: Own recipe
Rezept: 30g : 450g (1:15.0) · 94°C · Grind 421° · 4:30
- *Warum:* Immersion’s full saturation and controlled steep time offer a counterpoint to percolation’s fast drawdown, testing how contact time affects the florals.
- *Hypothese:* A 4.5-minute immersion with minimal agitation will extract Zone 1 and 2 evenly, preserving the jasmine while developing peach sweetness.
- *Erwartete Tasse:* Smoother and more integrated than the Origami, with jasmine and lemon-pith notes rounded by the longer contact time.
- *Worauf achten:* Does the immersion’s even extraction mute the florals or enhance their depth?
- *pourSteps:* 1) Pour water (pour, 450g, 15s) — Pour all water in one go, saturate the grounds evenly  2) Swirl (swirl, 5s) — Gentle swirl to settle the bed, avoid stirring  3) Steep (wait, 220s) — Let the coffee steep undisturbed  4) Swirl (swirl, 5s) — Gentle swirl to break the crust  5) Drain (drain, 25s) — Place on a cup and let drain fully


#### Sonnet 4-6 (cheaper Claude)
> This washed Pink Bourbon, sitting genetically closer to Ethiopian landraces than true Bourbon per WCR 2024, demands that you protect Zone-1 jasmine and peach aromatics — which Gagné's solubility sequence tells us extract first and dissipate fastest — so the single thing to watch across both candidates is whether those top-note florals arrive vivid and intact or soft and muted, which will tell you whether contact time or CO₂ management is the binding constraint for this coffee.

**Wölfl-Adapted Orea Fast** — Orea Fast · basedOn: Wölfl 2024 — Orea V4 Fast
Rezept: 28g : 445g (1:15.9) · 93°C · Grind 405° · 2:25
- *Warum:* The Orea Fast's rapid-drain geometry keeps total bed-contact time firmly in Zone 1–2, which is exactly where this Pink Bourbon's jasmine and peach aromatics live.
- *Hypothese:* Rapid, sequential pours through a fast-draining geometry will extract the fragile Zone-1 florals cleanly without stalling long enough to pull Zone-3 bitterness.
- *Erwartete Tasse:* Bright, transparent jasmine and lemon-pith aromatics up front, light peach sweetness in the middle, clean finish — high clarity, delicate body.
- *Worauf achten:* Whether the jasmine note is vivid and distinct versus soft or absent — that tells you if the fast drawdown preserved Zone-1 compounds before they volatilised.
- *pourSteps:* 1) Bloom (bloom, 56g, 40s) — Pour gently from centre outward — wet all grounds evenly. 2× dose bloom.  2) Pour 2 (pour, 112g, 10s) — Quick, decisive pour. Let the fast bottom drain before Pour 3.  3) Rest (wait, 25s) — Allow partial drawdown — this is the Wölfl rhythm: pour fast, rest, pour again.  4) Pour 3 (pour, 223g, 10s) — Even, confident spiral pour.  5) Rest (wait, 25s) — Partial drawdown again.  6) Pour 4 (pour, 334g, 10s) — Same rhythm — brief and deliberate.  7) Final Pour (final, 445g, 15s) — Complete the volume.  8) Drawdown (drain, 10s) — Fast bottom drains quickly — watch the bed clear fast.

**Double-Bloom V60 Clarity** — V60 · basedOn: Standout — Double-Bloom V60
Rezept: 27g : 450g (1:16.7) · 93°C · Grind 399° · 5:00
- *Warum:* The double-bloom structure ensures this 14-day-old Pink Bourbon's residual CO₂ is fully vented before extraction, eliminating the channeling risk that would stripe the delicate aromatics unevenly across the bed.
- *Hypothese:* Two sequential small blooms will fully saturate and degas a still-fresh washed coffee before main extraction, producing a more even extraction bed and cleaner sweetness than a single bloom allows.
- *Erwartete Tasse:* Rounded jasmine and peach sweetness, clean lemon-pith brightness, gentle body — slightly more developed sweetness and less sharpness than the Orea Fast candidate.
- *Worauf achten:* Whether the cup shows more sweetness and roundness compared to the Orea Fast — that differential tells you how much CO₂ interference was masking sweetness in a single-bloom approach.
- *pourSteps:* 1) Bloom 1 (bloom, 45g, 5s) — Small first bloom — just enough to wet all grounds. Pour gently from centre.  2) Wait 1 (wait, 25s) — Let CO₂ vent — you'll see bubbling settle.  3) Bloom 2 (bloom, 90g, 5s) — Second saturation pour — hits the dry spots the first bloom missed.  4) Wait 2 (wait, 25s) — Bed now fully saturated and degassed before main extraction begins.  5) Pour 1 (pour, 270g, 30s) — Slow spiral pour — keep water off the filter wall. No stir.  6) Wait 3 (wait, 20s) — Let the bed settle before the final pour.  7) Final Pour (final, 450g, 30s) — Complete the volume with the same gentle spiral.  8) Drawdown (drain, 160s) — Target total time ~5:00. If drawdown finishes before 5:00, note the time — it's your grind calibration data.

</details>

---

## Normal · 520ml big — Honey Catuai, sweetness-forward (big-volume capacity)

| Modell | Kandidat | Methode | basedOn | Dose | Water | Ratio | Temp | Grind | Zeit | staged | drift | cap | ice |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Opus | Kasuya Sweet-Split V60 | V60 | Kasuya 4:6 — Strong (sweetness-up split) | 34g | 520g | 1:15.3 | 93°C | 414° | 3:30 | nein | — | — | — |
| Opus | Chemex Clarity Pour | Chemex | Own recipe | 34g | 520g | 1:15.3 | 94°C | 402° | 5:00 | nein | — | — | — |
| Mistral·r1 | Apex Sweetness Calibration | Orea Apex | Own recipe | 34g | 520g | 1:15.3 | 95°C | 406° | 4:00 | nein | — | — | — |
| Mistral·r1 | Clever Immersion Sweetness | Clever Dripper | Hoffmann Ultimate Clever | 34g | 520g | 1:15.3 | 96°C | 418° | 5:00 | nein | — | ⚠️ Clever @520ml (>450) | — |
| Mistral·r2 | Apex Sweetness Pulse | Orea Apex | Wölfl-adapted Orea Apex | 34g | 520g | 1:15.3 | 94°C | 405° | 4:00 | nein | — | — | — |
| Mistral·r2 | Kasuya Sweetness Split | V60 (no Assist) | Kasuya 4:6 — Strong (sweetness-up split) | 34g | 520g | 1:15.3 | 93°C | 402° | 3:30 | nein | — | — | — |
| Sonnet | Kasuya Sweet-Phase V60 | V60 | Kasuya 4:6 — Strong (sweetness-up split) | 34g | 520g | 1:15.3 | 94°C | 418° | 3:30 | nein | — | — | — |
| Sonnet | Kalita Flat-Bed Sweetness Build | Kalita Wave | Own recipe | 34g | 520g | 1:15.3 | 94°C | 403° | 4:30 | nein | — | — | — |

<details><summary><b>Volltext der Rezepte Normal · 520ml big — Honey Catuai, sweetness-forward (big-volume capacity)</b></summary>


#### Opus 4-7 (status quo)
> You're meeting a paradox today — April's very-light clarity roast on a honey-processed Catuai whose sweetness lives in Zone 2 (Gagné's solubility sequence). The first session needs to answer one question: does this coffee reward pour choreography (Kasuya's phase-separated sweetness lever) or contact-time physics (Chemex's thick-paper extension)? Watch the brown-sugar mid-palate — that's where the two methods will diverge.

**Kasuya Sweet-Split V60** — V60 · basedOn: Kasuya 4:6 — Strong (sweetness-up split)
Rezept: 34g : 520g (1:15.3) · 93°C · Grind 414° · 3:30
- *Warum:* Kasuya's sweet-split front-loads the acid/sweet phase 60/60 — perfect lever for amplifying brown sugar on a honey Catuai.
- *Hypothese:* Splitting the first 40% into two equal sweetness-leaning pours raises Zone-2 sugar extraction without dragging Zone-3 bitterness into the cup.
- *Erwartete Tasse:* Red apple up front, brown sugar mid-palate, almond finish — clean and syrupy, not muddy.
- *Worauf achten:* Does the mid-cup brown-sugar note arrive distinctly between the apple acidity and almond finish, or do they blur?
- *pourSteps:* 1) Bloom (sweet-split pour 1) (bloom, 104g, 10s) — Pour to 104g in slow centre-out circles  2) Wait (wait, 35s) — Let CO₂ release; bed settles flat  3) Pour 2 (sweetness pour) (pour, 208g, 10s) — Second 40% pour — this is the sweetness lever  4) Wait (wait, 35s)  5) Pour 3 (strength) (pour, 312g, 10s)  6) Wait (wait, 30s)  7) Pour 4 (strength) (pour, 416g, 10s)  8) Wait (wait, 25s)  9) Final pour (final, 520g, 10s)  10) Drawdown (drain, 35s) — Bed should level flat — target ~3:30 total

**Chemex Clarity Pour** — Chemex · basedOn: Own recipe
Rezept: 34g : 520g (1:15.3) · 94°C · Grind 402° · 5:00
- *Warum:* Different physics from the V60: thick bonded filter strips oils/fines for tea-like clarity, contrasting Kasuya's phase-control approach.
- *Hypothese:* Chemex's thick paper extends contact time while removing oils — sweetness develops from duration, not pour choreography.
- *Erwartete Tasse:* Cleaner, more tea-like than the V60 — almond and apple sharpened, brown sugar slightly lighter but more transparent.
- *Worauf achten:* Compared to the V60, does the cup feel lighter-bodied but MORE sweet, or does the thick filter strip body without the sweetness payoff?
- *pourSteps:* 1) Bloom (bloom, 68g, 10s) — Pour 2× dose, wet all grounds in slow circles  2) Swirl (swirl, 5s) — Gentle swirl ONLY — never stir Chemex (thick filter channels)  3) Bloom rest (wait, 35s)  4) Pour 2 (pour, 220g, 30s) — Slow concentric circles, stay off the filter wall  5) Wait (wait, 20s)  6) Pour 3 (pour, 370g, 30s)  7) Wait (wait, 20s)  8) Final pour (final, 520g, 30s)  9) Drawdown (drain, 120s) — Thick filter drains slowly — should finish around 5:00


#### Mistral Large 3 (sovereign)
> This Tarrazú Honey’s fermentation sugars and Catuai’s balanced sweetness demand a method that develops body without muddying the cup—Gagné’s extraction physics (Zone 2 vs. Zone 3) will reveal whether percolation (Orea Apex) or immersion (Clever) better preserves the red apple brightness while amplifying brown sugar, and you’ll learn how April’s precision-light roast responds to each approach.

**Apex Sweetness Calibration** — Orea Apex · basedOn: Own recipe
Rezept: 34g : 520g (1:15.3) · 95°C · Grind 406° · 4:00
- *Warum:* Orea Apex’s restricted flow and gentle agitation are ideal for honey process coffees, balancing sweetness with clarity while respecting April’s agitation-sensitive style.
- *Hypothese:* The Apex’s slow, even extraction will develop the honey’s sugars (Zone 2) without over-extracting the almond base (Zone 3), while the moderate temperature preserves the red apple brightness (Zone 1).
- *Erwartete Tasse:* A cup with pronounced brown sugar sweetness, red apple acidity, and a silky almond body—clean but not thin, with a lingering caramel finish.
- *Worauf achten:* How the sweetness builds in the mid-palate and whether the almond note stays smooth or turns astringent.
- *pourSteps:* 1) Bloom (bloom, 70g, 45s) — Gentle swirl to saturate evenly—avoid stirring to prevent channeling  2) Pour 2 (pour, 220g, 30s) — Slow spiral from center out, keep bed flat  3) Pour 3 (pour, 370g, 30s) — Maintain even saturation, avoid disturbing the bed  4) Final pour (final, 520g, 30s) — Light swirl after final pour to settle grounds  5) Drawdown (drain, 65s) — Let drain fully—no rush

**Clever Immersion Sweetness** — Clever Dripper · basedOn: Hoffmann Ultimate Clever
Rezept: 34g : 520g (1:15.3) · 96°C · Grind 418° · 5:00
- *Warum:* The Clever’s immersion approach tests whether this honey process coffee can develop sweetness without the agitation risks of percolation, while the water-first technique ensures a fast, even drawdown.
- *Hypothese:* Full immersion will extract more body and sweetness (Zone 2) than percolation, but the water-first technique and paper filter will keep the cup cleaner than a French press, preserving the red apple acidity (Zone 1).
- *Erwartete Tasse:* A rounder, more syrupy cup with pronounced brown sugar and almond notes, but potentially less clarity in the apple acidity compared to the Orea.
- *Worauf achten:* Whether the sweetness feels more integrated or muddled, and if the almond note dominates the apple brightness.
- *pourSteps:* 1) Pour water (pour, 520g, 20s) — Pour water first into the Clever (valve closed)  2) Add coffee (agitate-bed, 5s) — Add coffee and swirl gently to mix—no stirring  3) Steep (wait, 210s) — Let steep undisturbed—no agitation  4) Swirl (swirl, 5s) — Gentle swirl to break the crust  5) Settle (wait, 30s) — Let grounds settle before draining  6) Drain (drain, 30s) — Place on carafe and let drain fully


#### Sonnet 4-6 (cheaper Claude)
> This honey Catuai sits in genuine tension between April's clarity-first roast identity and your sweetness-forward goal today — Gagné's solubility sequence tells us the brown sugar and almond body you're chasing lives in Zone 2, which both candidates try to reach through different physical means (pour-phase separation vs flat-bed geometry), so the one thing to watch is whether sweetness arrives early and persists as the cup cools, or only emerges once acidity fades.

**Kasuya Sweet-Phase V60** — V60 · basedOn: Kasuya 4:6 — Strong (sweetness-up split)
Rezept: 34g : 520g (1:15.3) · 94°C · Grind 418° · 3:30
- *Warum:* The 4:6 framework's equal first-phase split is the most direct lever for amplifying sweetness on a honey coffee while the coarser grind and 94°C temperature prevent the clarity-roast tendency from reading thin
- *Hypothese:* By splitting the first 40% into two equal pours at a coarser grind, the brew saturates Zone 2 sugars and maillard compounds before the strength phase controls concentration — the honey fermentation esters amplify this window
- *Erwartete Tasse:* Brown sugar sweetness up front, mild red apple acidity in the mid-palate, a clean almond finish with medium body — rounder and more textured than a standard V60 pour would produce from this coffee
- *Worauf achten:* Notice whether the sweetness arrives early and persists as the cup cools — if it only appears cool, the acidity was slightly masking it and the ratio can go a touch leaner next time
- *pourSteps:* 1) Bloom (bloom, 102g, 10s) — Pour 102g (3× dose) in slow spirals to wet all grounds evenly  2) Bloom wait (wait, 35s) — Let CO₂ degas; bed should domed slightly  3) Pour 2 — Sweet emphasis (pour, 204g, 10s) — Second equal pour — together with bloom this is the full 40% acid/sweet phase; equal splits tip balance toward sweetness  4) Wait 2 (wait, 35s) — Let the first phase drain almost fully before the strength phase begins  5) Pour 3 (pour, 312g, 10s) — First of three equal 60% strength pours  6) Wait 3 (wait, 20s) — Keep consistent cadence  7) Pour 4 (pour, 416g, 10s) — Second strength pour  8) Wait 4 (wait, 15s) — Bed should still have good depth  9) Final pour (final, 520g, 10s) — Third and final strength pour — gentle spiral, no agitation after  10) Drawdown (drain, 55s) — Target finish around 3:30 total; if draining faster, note for grind calibration

**Kalita Flat-Bed Sweetness Build** — Kalita Wave · basedOn: Own recipe
Rezept: 34g : 520g (1:15.3) · 94°C · Grind 403° · 4:30
- *Warum:* The Kalita's flat bed and three drainage holes slow the drawdown and distribute extraction across a wider, shallower puck — this physical geometry inherently favours body and sweetness over brightness, which is exactly what a honey Catuai needs when the roaster pushes toward clarity
- *Hypothese:* A flat-bed geometry with an even slow drawdown keeps the water in contact with the full bed uniformly, spending more time in Zone 2 than a conical V60 would — the result should be more brown-sugar body and less top-note acid pop
- *Erwartete Tasse:* Fuller body than the V60 candidate, softer red-apple acidity, more almond and brown sugar in the finish — a rounder, sweeter cup that may sacrifice some of the brightness April's roast style typically offers
- *Worauf achten:* Compare the mouthfeel directly against the V60 candidate — if the Kalita feels significantly thicker and sweeter, the bed geometry is doing real work; if they taste nearly identical, Catuai's moderate density is the equalizer
- *pourSteps:* 1) Bloom (bloom, 70g, 10s) — Pour gently over the full flat bed — the Kalita demands even saturation; never pour hard into one spot  2) Bloom swirl (swirl, 5s) — Gentle single swirl to level the bed — never stir a Kalita  3) Bloom wait (wait, 40s) — Full 45s bloom total; flat bed needs time to degas evenly before the main water  4) Pour 2 (pour, 220g, 35s) — Slow, low spiral pour — keep water off the filter walls, maintain a flat bed surface  5) Pour 3 (pour, 370g, 35s) — Same pace; the flat bed extracts evenly if you keep the pour gentle and central  6) Final pour (final, 520g, 35s) — Complete the spiral to the edges; no swirl or agitation after the final pour  7) Drawdown (drain, 110s) — Kalita drawdown is slower than V60 by design — ~1:30–2:00 is normal; if it drags past 2:00 go 3° coarser

</details>

---

## Kosten pro `/recommend`-Call (gemessen × Listenpreis)

| Modell | Calls | Ø Tokens in/out | Ø $/Call | drift | staged | cap-Verstöße | ice-Fehler |
|---|---|---|---|---|---|---|---|
| Opus 4-7 (status quo) | 6 | 26225/3079 | $0.208 | 0 | 0 | 0 | 4 |
| Mistral Large 3 (sovereign) | 12 | 19105/2017 | $0.050 | 0 | 0 | 2 | 1 |
| Sonnet 4-6 (cheaper Claude) | 6 | 18949/2979 | $0.102 | 0 | 0 | 0 | 0 |

_Hinweis: Spike-Calls sind uncached. Produktiv senkt Prompt-Caching die Opus-Input-Kosten; Mistral-Caching ist nicht eingerechnet (konservativ). Ø $/Call × monatliche /recommend-Frequenz = der echte Hebel._
