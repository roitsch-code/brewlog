# Coffee Experts — Knowledge Layer Reference

> **Source of truth:** TypeScript modules under `src/lib/knowledge/`. This document mirrors them for human reading; if a number changes, update the TS first, then update this file.
>
> - Recipes — `src/lib/knowledge/recipes/{championship,reference}.ts`
> - Varieties — `src/lib/knowledge/varieties/data.ts`
> - Techniques — `src/lib/knowledge/techniques/data.ts`
>
> Consumed per turn by `/recommend`, `/explore`, and `/explore-agent`.

---

## 1. Recipes

Each entry: dose / water / ratio / temperature / Niche Zero degrees / total time, plus the technique it teaches and the verification status.

`verified: true` = mechanics agreed across the official video, the official write-up, and at least one independent transcription.
`verified: false` = headline parameters (dose, water, temp, brewer) are well-attested but the pour sequence is reconstructed from third-party transcriptions that diverge.

### 1a. Championship recipes (WBrC + WAC)

| Year | Recipe | Brewer | Dose : Water | Ratio | Temp | Niche° | Total | Verified |
|---|---|---|---|---|---|---|---|---|
| 2016 | **Kasuya 4:6** (Tetsu Kasuya, Japan) | V60 size 02 | 20g : 300g | 1:15 | 92°C | 411–421° | 3:30 | true |
| 2019 | **Du Origami Wave** (Jia Ning Du, China) | Origami + wave filter | 20g : 240g | 1:12 | 94°C | 398–408° | 3:15 | false |
| 2022 | **Hsu Staged-Temp V60** (Sherry Hsu, Taiwan) | V60 size 02 | 14g : 200g | 1:14.3 | 70°C bloom → 95°C | 388–396° | 2:30 | false |
| 2023 | **Medina Conical** (Carlos Medina, Chile) | Conical paper filter | 15.5g : 250g | 1:16.1 | 91°C | 398–406° | 3:30 | false |
| 2024 | **Wölfl Orea Fast** (Martin Wölfl, Austria) | Orea V4 Fast | 17g : 270g | 1:15.9 | 93°C | 401–411° | 2:20 | true |
| 2025 | **Peng Three-Roast / Staged** (George Peng, China) | Solo dripper + Melodrip | 15g (3×5g roasts) : 60g | 1:4 | 96 → 88 → 80°C | 386–396° | 2:00 | false |
| 2024 (WAC) | **Stanica AeroPress + Bypass** (George Stanica, Romania) | Inverted AeroPress, Aesir filter | 18g : 200g (120g extract + 80g bypass) | 1:11 ext | 96°C | 382–388° | 2:00 | true |

**Teaching summaries**

- **Kasuya 4:6** — How to dial acidity and strength independently. First 40% (two pours) controls acid/sweet axis; last 60% (three pours) controls strength. Changing pour counts changes the cup without touching grind or temperature.
- **Du Origami Wave** — How a rich brewing ratio (1:12) combined with custom low-mineral water (4ppm Ca / 15ppm Mg / 80ppm TDS) produces extreme clarity without sacrificing sweetness.
- **Hsu Staged-Temp V60** — How temperature staging isolates aromatic preservation from extraction efficiency. Cool bloom captures volatile florals before they evaporate; hot pours then do the bulk extraction.
- **Medina Conical** — How a lean ratio (1:16) at moderate 91°C extracts the fermentation-derived sweetness of a Natural Sidra without amplifying ester sharpness.
- **Wölfl Orea Fast** — How fast-flowing geometry combined with turbulent pours delivers clarity on a Natural — the paradox of high agitation producing a clean cup because total bed-contact time stays in Zone 1–2.
- **Peng Three-Roast / Staged** — How to compose a cup as a sequence — different roast levels extract different compounds at different rates, and staged temperatures + Melodrip-controlled agitation isolate which extraction phase contributes which character.
- **Stanica AeroPress + Bypass** — How concentrate-and-bypass separates extraction from dilution. Over-pull a tight, intense concentrate at 1:11, then dial the cup back to drinking strength with cool water.

### 1b. Reference recipes

| Recipe | Brewer | Dose : Water | Temp | Niche° | Total | Verified |
|---|---|---|---|---|---|---|
| **Hoffmann V60 (Better 1 Cup)** | V60 size 02 (plastic preferred) | 15g : 250g | 100°C light / 92 medium / 83 dark | user-empirical | 3:00 | true |
| **Hoffmann Ultimate Clever** | Clever Dripper | 18g : 300g | 96°C | 421–431° | 3:00 | true |
| **Hoffmann AeroPress** | Inverted AeroPress | 11g : 200g | 85°C | 377–387° | 2:30 | true |
| **Hoffmann Moccamaster Method** | Technivorm Moccamaster | 50g : 750g | 96°C | 431–441° | 8:00 | true |
| **Hoffmann Immersion Iced** | Clever onto ice | 20g : 250g (+200g ice) | 95°C | 421–431° | 5:00 | true |
| **Kasuya 4:6 (standard)** | V60 | 20g : 300g | 92°C | 411–421° | 3:30 | true |
| **Rolf Minimum Variables (Stagg [X])** | V60 / Stagg [X] | 18g : 300g | 96°C | 398–406° | 3:38 | true |
| **Gagné Long AeroPress** | AeroPress + Prismo | 20g : 200g | 80°C | 365–375° | 6:25 | true |
| **Perger High-Extraction V60** | V60 | 22g : 352g | 95°C | 388–396° | 3:35 | false |
| **Rao Rule of Thirds** | V60 | 22g : 352g | 96°C | 396–404° | 3:25 | true |
| **Hatakeyama Cafec Flower (roast-tailored)** | Cafec Flower Dripper | 15g : 225g | 88–95°C (by roast) | 396–406° | 3:10 | false |
| **Wallgren Kalita with Sieved Fines** | Kalita Wave 155 | 22g : 330g | 94°C | 396–406° | 3:35 | false |
| **Turbo V60 (Hedrick)** | V60 | 15g : 250g | 100°C | 391–396° | 2:00 | true |
| **Hedrick V60 Framework (Lazy 80%)** | V60 (any size) | 18g : 306g | 95°C max (light) | user-empirical / coarse | 3:00 | true |

**Teaching summaries**

- **Hoffmann V60 (Better 1 Cup)** — Bloom + 4 pulse pours of 50 g each (20% blocks), with ~10 s pour and ~10 s pause between each. Two counter-intuitive findings: (i) preheating with hot tap (not boiling) doesn't change measurable extraction but materially improves cup taste — the un-preheated bloom cools and the cup loses sweetness; (ii) a low spout produces more agitation than a high spout, because a high stream breaks before reaching the bed. Roast-temperature staircase: light at freshly boiled (100 °C), medium 90–95, dark 80–85.
- **Hoffmann Ultimate Clever** — Water-first technique: pour all water first, drop coffee on top. The grounds saturate from below via buoyancy/capillary action; no mechanical agitation needed.
- **Hoffmann AeroPress** — A low-temperature (85°C), lean-ratio (1:18) AeroPress produces a clean, filter-style cup without the bitterness people associate with the brewer.
- **Hoffmann Moccamaster Method** — Pulsing showerhead + flat-bottomed paper filter approximates a multi-pour V60 without operator skill. 1:15 at medium-coarse grind for batches ≥500ml.
- **Hoffmann Immersion Iced** — Flash-chilling preserves aromatics that cold-brew loses to its long extraction time. 1:12.5 hot extraction + ice dilution = effective 1:22 final drink.
- **Rolf Minimum Variables** — Single continuous pour with no stir. Removes pour count, pour spacing, and stir count as variables — isolates the coffee itself across brews.
- **Gagné Long AeroPress** — The "second sweet spot": fine grind + 80°C + 5-minute steep. Bitter Zone 3 compounds extract orders of magnitude slower at low temp; long steep saturates Zone 2 fully without invading Zone 3.
- **Perger High-Extraction V60** — Vigorous bloom stir + fine grind + spinning swirl during drawdown drives extraction yield above 22%. Bitterness comes from over-extracting the wrong compounds, not high yield itself.
- **Rao Rule of Thirds** — Equal-volume thirds + Rao spin (vortex swirl). Lower extraction variance run-to-run, easier to troubleshoot.
- **Hatakeyama Cafec Flower** — Match filter paper thickness to roast level. Light roast → thin paper (faster flow tolerable); dark roast → thick paper (slows flow where less contact is needed).
- **Wallgren Kalita** — Sieve out fines pre-brew. Fines over-extract relative to the rest of the grind; removing them tightens the extraction distribution and produces a startlingly clean cup.
- **Turbo V60** — 100°C + coarse grind + fast pour produces a clean, well-extracted cup in 2 minutes. Boiling water raises extraction rate; coarse grind partially cancels by reducing surface area; net = high yield in short contact.
- **Hedrick V60 Framework** — Framework over fixed recipe. Find a baseline you can brew reliably (1:17 ratio, 95°C max, coarse grind, bloom 30 s – 2 min coffee-dependent, fewer-pours-preferred), then tune in big steps: water → grind → ratio → temperature (3–6°C, not 1–2) → bloom time → grinder. Aim for 80% of a coffee's potential fast, then iterate. Hedrick retracts his older "brew off boiling for light roasts" stance; finds 95°C cleaner without losing what he liked about 99°C.

---

## 2. Varieties

WCR-grounded priors. Genetic / agronomic facts (parentage, identification year) sourced from the **World Coffee Research Arabica Coffee Varieties Catalog**. Cup descriptions synthesise specialty-industry consensus from Royal Coffee / The Crown's *Green Coffee Book*.

`confidence: wcr-curated` = traceable to WCR catalog.
`confidence: industry-canonical` = not in WCR but well-documented in trade publications.
`confidence: inferred` = limited public documentation; treat with caution.

### 2a. Bourbon family

| Variety | Parentage | Origin | Acidity / Body / Aromatics | Cup signature |
|---|---|---|---|---|
| **Bourbon** | Mutation of Typica on Île Bourbon | Réunion, ~1715 | mod / med / mod | Sweet, balanced, classic — caramel, milk chocolate, soft red fruit, gentle citric. The reference cup. |
| **Yellow Bourbon** | Natural mutation of Bourbon | Brazil, early 1900s | mod / med / mod | Sweeter and more delicate than Red Bourbon. Honey, peach, soft floral. |
| **Caturra** | Single-gene dwarf mutation of Bourbon | Minas Gerais, Brazil, 1937 | high / light / mod | Brighter, more citric than Bourbon. Lemon, white grape, herbal. Backbone of Colombian specialty. |
| **Catuai** | Mundo Novo × Caturra | Brazil, 1949 | mod / med / mod | Sweet, mild, balanced. Caramel, hazelnut, mild citrus. Pleasant rather than distinctive. |
| **Mundo Novo** | Sumatra (Typica) × Red Bourbon | Brazil, 1943 | low / full / mod | Heavy body, sweet, low acidity. Chocolate, nut, baked sugar. Body-forward. |
| **Pacas** | Single-gene dwarf mutation of Bourbon | Santa Ana, El Salvador, 1949 | mod / med / mod | Bourbon-like sweetness with slightly more pronounced citric acidity. |
| **Pink Bourbon** | **Genetically distinct from Bourbon per WCR 2024 — closer to Ethiopian landraces** | Huila, Colombia, mid-1900s | high / light / **intense** | Floral, jasmine, peach, lemon-pith. Treat like a Gesha — clarity methods, low temp, championship water. |

> **Pink Bourbon nuance:** marketing materials still call it a Bourbon mutation. WCR's 2024 genetic work shows the cup behaviour was telling us the truth: it brews delicate-coffee-style, not Bourbon-style.

### 2b. Typica family

| Variety | Parentage | Origin | Acidity / Body / Aromatics | Cup signature |
|---|---|---|---|---|
| **Typica** | Original Yemen-derived Arabica | Yemen → Indonesia (1696) | low / med / mod | Clean, sweet, balanced, low acidity. Honey, soft chocolate, gentle stone fruit. The classical profile. |
| **Java** | Indonesian Typica selection | Java, Indonesia | mod / med / mod | More lively than generic Typica. Lemon, herbal, sometimes spicy. |
| **Maragogype** | Giant-bean mutation of Typica | Bahia, Brazil, 1870 | low / full / mod | Soft, low acidity, full body, classical. Big beans extract slowly — needs coarser grind than usual. |
| **Sumatra (Lintong / Mandheling)** | Indonesian Typica selections | Sumatra, Indonesia | low / full / mod | Earthy, herbal, low acidity, full body, often spicy. The cup is mostly defined by wet-hulling (Giling Basah), not the variety itself. |

### 2c. Ethiopia landraces

| Variety | Parentage | Origin | Acidity / Body / Aromatics | Cup signature |
|---|---|---|---|---|
| **Ethiopian Heirloom** | Wild Arabica diversity (umbrella term) | Ethiopia (Yirgacheffe / Sidamo / Guji / Limu / Harrar / Kaffa) | high / light / **intense** | Region-defined. Yirgacheffe washed: jasmine, bergamot, lemon, tea. Guji natural: blueberry, strawberry, fruit punch. |
| **Wush Wush** | Distinct named landrace | Wushwush, Kaffa, Ethiopia | mod / light / **intense** | Floral, jasmine, tea-like, cinnamon, often savoury depth. Distinct from generic Yirgacheffe — more tea than citrus. |
| **Chiroso** | Long marketed as Caturra variant; recent work suggests landrace ancestry | Antioquia, Colombia | high / light / **intense** | Floral, lemongrass, white tea, lemon zest. Very expressive. |
| **Sidra** | **Disputed origin** — long claimed Bourbon × Typica; WCR notes parentage unclear | Ecuador / Colombia | high / light / **intense** | Floral, fruity, sometimes wild — tropical, jasmine, pineapple, lychee. Naturals lean fermentation-forward. |

### 2d. Geisha

| Variety | Parentage | Origin | Acidity / Body / Aromatics | Cup signature |
|---|---|---|---|---|
| **Geisha (Panama)** | Wild Arabica from Gesha forest, Ethiopia (1936) → Costa Rica → Panama (Hacienda La Esmeralda, 1960s) | Boquete, Panama | high / light / **intense** | Jasmine, bergamot, white peach, lemon zest, tea-like. The reference clarity coffee. Aromatic ceiling that no other variety matches. |

### 2e. Kenyan SL series

| Variety | Parentage | Origin | Acidity / Body / Aromatics | Cup signature |
|---|---|---|---|---|
| **SL28** | Tanganyika Drought Resistant population (Bourbon-derived) | Scott Labs, Kenya, 1935 | high / full / **intense** | Blackcurrant, tomato, red wine, savoury depth. The most distinctive Kenyan profile. |
| **SL34** | Scott Labs French Mission ancestry | Scott Labs, Kenya, 1939 | high / med / **intense** | Slightly less intense than SL28. Blackcurrant, citrus, more balance, less savoury depth. |
| **Ruiru 11** | SL28/SL34 × Catimor (disease-resistant) | Ruiru, Kenya, 1985 | mod / med / mod | Less complex than SL28/SL34 but still a recognisable Kenyan profile. Citric, milder body. |
| **Batian** | Multi-line: SL28/SL34/Rume Sudan/SL4/N39/K7 | Coffee Research Institute, Kenya, 2010 | high / med / **intense** | Closer to SL28's complexity than Ruiru 11 — preserves blackcurrant and structure with disease resistance. |

### 2f. F1 hybrids and Colombian disease-resistant

| Variety | Parentage | Origin | Acidity / Body / Aromatics | Cup signature |
|---|---|---|---|---|
| **Castillo** | Caturra × Hibrido de Timor | Cenicafé, Colombia, 2005 | mod / med / mod | Variable. Best lots: balanced, sweet, soft acidity. Lower-altitude or under-developed: green, grassy. |
| **Tabi** | Bourbon × Typica × Hibrido de Timor | Cenicafé, Colombia, 2002 | mod / med / mod | Bourbon-like — sweet, balanced. Less Catimor green character than Castillo. |
| **Centroamericano (H1)** | Sarchimor T5296 × Rume Sudan | CIRAD / ICAFE / Promecafe, 2010 | mod / med / **intense** | F1 hybrid. Sweet, complex, often floral. First commercially successful F1 in coffee. |

### 2g. Other

| Variety | Parentage | Origin | Acidity / Body / Aromatics | Cup signature |
|---|---|---|---|---|
| **Pacamara** | Pacas × Maragogype | El Salvador, 1958 | mod / full / **intense** | Distinctive — complex, savoury, often herbal. Tomato, basil, dark chocolate, sometimes tropical fruit. Big bean → coarser grind. |
| **Mokka** | Yemeni heirloom (small-bean Typica derivative) | Yemen / Ethiopia | mod / full / **intense** | Wine, dark chocolate, dried fruit, sometimes intense. Tiny beans → finer grind. |

---

## 3. Techniques

25 atomic moves. Recipes are compositions of 3–6 of these. Each technique cross-references the recipes that exemplify it.

### 3a. Temperature

| Technique | Author | Mechanism (1 line) | Exemplified by |
|---|---|---|---|
| **staged-temperature** | Hsu (2022); Peng (2025) | Cool bloom preserves fragile aromatics; hot pours do extraction work. | wbrc-2022-hsu, wbrc-2025-peng |
| **boiling-water-coarse-grind** *(Turbo)* | Hedrick (popularised) | 100°C raises extraction rate across all zones; coarse grind partially cancels — net is high yield in short time. | turbo-v60-hedrick |
| **low-temp-long-steep** *(Gagné second sweet spot)* | Gagné | Bitter Zone-3 compounds extract orders of magnitude slower at 80°C — fine grind + long steep saturates Zone 2 without Zone 3. | gagne-long-aeropress |

### 3b. Agitation

| Technique | Author | Mechanism (1 line) | Exemplified by |
|---|---|---|---|
| **rao-spin** | Rao | Vortex swirl drags water down through puck centre rather than wall-first; counteracts V60 channeling. | rao-rule-of-thirds |
| **swirl-not-stir** | Hoffmann (popularised) | Swirl achieves saturation through bulk-puck motion, leaving fines distributed evenly. Stir agitates fines into the slurry. | hoffmann-v60-better-one-cup, rolf-minimum-variables, rao-rule-of-thirds |
| **high-agitation-high-extraction** | Perger | Vigorous bloom stir + fine grind + drawdown swirl drives extraction yield above 22%. | perger-high-extraction-v60 |
| **minimal-agitation** | Rolf | Single continuous pour, no stir. Removes pour count and pour spacing as variables. | rolf-minimum-variables |
| **melodrip-controlled-pouring** | Peng (2025) | Perforated disc breaks pour into many fine streams; eliminates pour-induced turbulence at the bed. | wbrc-2025-peng |
| **water-first** | Bailey (originated); Hoffmann (popularised) | Add water first, drop coffee on top. Grounds saturate from below via buoyancy/capillary action. | hoffmann-clever-ultimate |
| **laminar-vs-turbulent-pour** | Hedrick (2024) | Stream just below break-up = max bed agitation; above break-up = droplets, minimal agitation. Spout height is the lever. | hedrick-v60-framework |

### 3c. Pour pattern

| Technique | Author | Mechanism (1 line) | Exemplified by |
|---|---|---|---|
| **phase-separated-pouring** *(4:6)* | Kasuya | First 40% (two pours) controls acid/sweet axis; last 60% (3+ pours) controls strength. | wbrc-2016-kasuya, kasuya-4-6-standard |
| **rule-of-thirds** | Rao | Equal-volume pours after the bloom. Lower run-to-run variance. | rao-rule-of-thirds |
| **pulsed-pours-50g-blocks** | Hoffmann (2023) | Equal 50 g pulses (20% blocks) with ~10 s pour + ~10 s pause. Each cycle = one agitation + one settle. Scales by dose. | hoffmann-v60-better-one-cup |
| **rescue-too-coarse-more-pours** | Hoffmann (2024) | If grind too coarse: 5 pours → 7, turbulent, full drain between each; optional +50 mL final pour at small dilution cost. | hoffmann-v60-better-one-cup |

### 3d. Pre-brew

| Technique | Author | Mechanism (1 line) | Exemplified by |
|---|---|---|---|
| **fines-removal-sieving** | Wallgren (2016) | Discard particles <200µm pre-brew. Tightens extraction distribution. | wallgren-kalita-sieved |
| **three-roast-layering** | Peng (2025) | Layer light/medium-light/medium of same green; each contributes different compounds. | wbrc-2025-peng |
| **roast-tailored-filter** | Hatakeyama | Match paper thickness to roast level — light roast → thin paper, dark roast → thick paper. | hatakeyama-cafec-flower |
| **preheat-via-hot-tap** | Hoffmann (2023) | Preheat dripper with hot tap, not boiling. Cup tastes materially sweeter even though measurable extraction doesn't change. | hoffmann-v60-better-one-cup |
| **bloom-time-tuning** | Hedrick (2024) | Bloom time is coffee-dependent (gas, freshness, roast). Best value may be 30 s, 60 s, or 120 s — not a constant. | hedrick-v60-framework |
| **bloom-visual-diagnostics** | Hoffmann (2024); Hedrick (2024) | Muddy bloom = grind too fine; dries fast = too coarse; high-and-dry grounds = bloom CO2 still trapped. | hoffmann-v60-better-one-cup, hedrick-v60-framework |

### 3e. Post-brew

| Technique | Author | Mechanism (1 line) | Exemplified by |
|---|---|---|---|
| **concentrate-and-bypass** | Hoffmann; Stanica (WAC 2024) | Brew tight (1:6–1:11), dilute with cool bypass water. Separates extraction from drink concentration. | wac-2024-stanica |
| **flash-chilling** | Hoffmann (popularised) | Brew hot, drain onto ice. Aromatics lock into liquid before they volatilise. | hoffmann-immersion-iced-clever |
| **rescue-too-fine-pull-early** | Hoffmann (2024) | If grind too fine: pour full schedule but pull cup at usual brew time even with liquid in cone; top up with hot water to expected liquid weight. | hoffmann-v60-better-one-cup |

### 3f. Vessel-specific

| Technique | Author | Mechanism (1 line) | Exemplified by |
|---|---|---|---|
| **aeropress-inversion** | AeroPress competition community | Steep without dripping; cap, flip, press for exact contact-time control. | hoffmann-aeropress-standard, wac-2024-stanica, gagne-long-aeropress |

### 3g. Water

| Technique | Author | Mechanism (1 line) | Exemplified by |
|---|---|---|---|
| **low-mineral-water** *(championship water)* | Hendon (foundation); Du, Peng (championship application) | 40–80 ppm TDS, magnesium-biased. Removes bicarbonate buffering; sharpens delicate aromatic and acid expression. | wbrc-2019-du, wbrc-2025-peng |

---

## 4. Cross-reference: who's behind what

| Expert | Recipes | Techniques |
|---|---|---|
| **James Hoffmann** | Better 1 Cup, Ultimate Clever, AeroPress, Moccamaster, Immersion Iced | swirl-not-stir, pulsed-pours-50g-blocks, preheat-via-hot-tap, bloom-visual-diagnostics, rescue-too-fine-pull-early, rescue-too-coarse-more-pours, water-first (popularised), concentrate-and-bypass (popularised), flash-chilling (popularised) |
| **Tetsu Kasuya** | WBrC 2016, 4:6 standard | phase-separated-pouring |
| **Scott Rao** | Rule of Thirds | rao-spin, rule-of-thirds |
| **Matt Perger** | High-Extraction V60 | high-agitation-high-extraction |
| **Patrik Rolf** | Minimum Variables (Stagg [X]) | minimal-agitation |
| **Jonathan Gagné** | Long-Brew AeroPress + Prismo | low-temp-long-steep |
| **Daiki Hatakeyama** | Cafec Flower (roast-tailored) | roast-tailored-filter |
| **Mikaela Wallgren** | Kalita with Sieved Fines | fines-removal-sieving |
| **Lance Hedrick** | Turbo V60 (popularised), Lazy 80% Framework | boiling-water-coarse-grind, bloom-time-tuning, laminar-vs-turbulent-pour, bloom-visual-diagnostics |
| **James Bailey** | (originated water-first; Hoffmann popularised) | water-first (origin) |
| **Sherry Hsu** | WBrC 2022 | staged-temperature |
| **George Peng** | WBrC 2025 | staged-temperature, melodrip-controlled-pouring, three-roast-layering |
| **Martin Wölfl** | WBrC 2024 | (none atomic — composition of fast-flow + light agitation) |
| **Carlos Medina** | WBrC 2023 | (none atomic — composition of lean ratio + moderate temp) |
| **Jia Ning Du** | WBrC 2019 | low-mineral-water (application) |
| **George Stanica** | WAC 2024 | concentrate-and-bypass (application) |
| **Christopher Hendon** | (water chemistry foundation) | low-mineral-water (foundation) |

---

## 5. What's deliberately NOT here

- **Espresso recipes.** BrewLog is filter-only; espresso has its own canon outside this corpus.
- **Cold brew.** Flash-chilling is in; long cold-brew steeps are not — the report flags cold brew as losing aromatics and BrewLog avoids the format.
- **Anaerobic / heavily-experimental processing recipes.** The user avoids anaerobic; recipes targeting anaerobic-amplification are out of scope.
- **`/brew-insight` (post-brew haiku) integration.** That endpoint still uses its narrow Rao/Perger/Gagné/Solis canon by design — the haiku is 1–2 sentences and doesn't need the full corpus injected. If widened later, it'll be a separate change.
- **Hardcoded recipe paragraphs in `/recommend`'s system prompt.** Still present (`Peng 2025 Temp-Staging`, `Wölfl 2024 Orea FAST`, etc., around line 376 of `src/lib/claude/recommend.ts`). They survive as a quick-reference embedded fallback; the structured corpus above is injected per turn alongside them. Future cleanup may remove the embedded list once we're sure the structured retrieval covers every case.
