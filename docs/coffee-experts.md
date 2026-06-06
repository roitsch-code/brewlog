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
| 2016 | **Kasuya 4:6** (Tetsu Kasuya, Japan) | V60 size 02 | 20g : 300g | 1:15 | 92°C | 390–400° | 3:30 | true |
| 2019 | **Du Origami Wave** (Jia Ning Du, China) | Origami + wave filter | 20g : 240g | 1:12 | 94°C | 377–387° | 3:15 | false |
| 2023 | **Medina Conical** (Carlos Medina, Chile) | Conical paper filter | 15.5g : 250g | 1:16.1 | 91°C | 387–393° | 3:30 | false |
| 2024 | **Wölfl Orea Fast** (Martin Wölfl, Austria) | Orea V4 Fast | 17g : 270g | 1:15.9 | 93°C | 380–390° | 2:20 | true |
| 2024 (WAC) | **Stanica AeroPress + Bypass** (George Stanica, Romania) | Inverted AeroPress, Aesir filter | 18g : 200g (120g extract + 80g bypass) | 1:11 ext | 96°C | 415–425° | 2:00 | true |

**Teaching summaries**

- **Kasuya 4:6** — How to dial acidity and strength independently. First 40% (two pours) controls acid/sweet axis; last 60% (three pours) controls strength. Changing pour counts changes the cup without touching grind or temperature.
- **Du Origami Wave** — How a rich brewing ratio (1:12) combined with custom low-mineral water (4ppm Ca / 15ppm Mg / 80ppm TDS) produces extreme clarity without sacrificing sweetness.
- **Medina Conical** — How a lean ratio (1:16) at moderate 91°C extracts the fermentation-derived sweetness of a Natural Sidra without amplifying ester sharpness.
- **Wölfl Orea Fast** — How fast-flowing geometry combined with turbulent pours delivers clarity on a Natural — the paradox of high agitation producing a clean cup because total bed-contact time stays in Zone 1–2.
- **Stanica AeroPress + Bypass** — How concentrate-and-bypass separates extraction from dilution. Over-pull a tight, intense concentrate at 1:11, then dial the cup back to drinking strength with cool water.

### 1b. Reference recipes

| Recipe | Brewer | Dose : Water | Temp | Niche° | Total | Verified |
|---|---|---|---|---|---|---|
| **Hoffmann V60 (Better 1 Cup)** | V60 size 02 | 15g : 250g | 80–100°C † | calibrate ‡ | 3:00 | true |
| **Hoffmann Ultimate Clever** | Clever Dripper | 18g : 300g | 96–100°C | 400–410° | 4:00 | true |
| **Hoffmann AeroPress** | Inverted AeroPress | 11g : 200g | 85–100°C † | 356–366° | 3:35 | true |
| **Hoffmann Moccamaster Method** | Technivorm Moccamaster | 50g : 750g | 96°C | 410–420° | 8:00 | true |
| **Hoffmann Immersion Iced** | Clever onto ice | 37.5g : 500g (~330g hot + ~170g ice) | 96–100°C | 400–410° | 6:05 | true |
| **Kasuya 4:6 (standard)** | V60 | 20g : 300g | 92°C | 411–421° | 3:30 | true |
| **April House V60 (Rolf)** | V60 | 20g : 300g | 92°C | — (calibrate) | 3:20–3:30 | true |
| **Gagné Long AeroPress** | AeroPress + Prismo | 20g : 200g | 80°C | 365–375° | 6:25 | true |
| **Perger High-Extraction V60** | V60 | 12g : 200g | 97°C | — (calibrate) | 2:20 | false |
| **Rao Rule of Thirds** | V60 | 22g : 352g | 96°C | 396–404° | 3:25 | true |
| **Hatakeyama Cafec Flower (roast-tailored)** | Cafec Flower Dripper | 15g : 225g *(unsourced — flagged)* | 88–95°C (by roast) | 396–406° | 3:10 | false |
| **Wallgren Kalita with Sieved Fines** | Kalita Wave 155 | 22g : 330g | 94°C | 396–406° | 3:35 | false |

† **Hoffmann roast-temperature staircase:** light = **freshly boiled (100 °C)**, medium 90–95 °C, dark 80–85 °C. The doc cell shows the full staircase range; brew by the bag's roast level. The TS `temperature.celsius` field is the canonical light-roast value; `rangeC` is the staircase span.
‡ Hoffmann does not publish a Niche Zero degree number — calibrate empirically against the recipe's drawdown target. The old "Niche 396–406°" claim had no Hoffmann source behind it and was removed per the third Hard Rule. See `src/lib/knowledge/recipes/reference.ts` (Hoffmann V60 `notes`) for the rescue moves Hoffmann published in his 2024 follow-up video.

**Teaching summaries**

- **Hoffmann V60 (Better 1 Cup)** — Swirl rather than stir, flatten the bed with a tap before drawdown. Both moves reduce fines migration and channeling without sacrificing extraction.
- **Hoffmann Ultimate Clever** — Water-first technique: pour all water first, drop coffee on top. The grounds saturate from below via buoyancy/capillary action; no mechanical agitation needed.
- **Hoffmann AeroPress** — Lean-ratio (1:18) AeroPress, roast-temperature staircase (light 100 °C, medium 90–95 °C, dark 85 °C), produces a clean, filter-style cup without the bitterness people associate with the brewer.
- **Hoffmann Moccamaster Method** — Pulsing showerhead + flat-bottomed paper filter approximates a multi-pour V60 without operator skill. 1:15 at medium-coarse grind for batches ≥500ml.
- **Hoffmann Immersion Iced** — Flash-chilling preserves aromatics that cold-brew loses to its long extraction time. 75 g coffee per litre of total water; total water split ~2/3 hot brew + ~1/3 ice (e.g. 37.5 g : 330 g hot + ~170 g ice = 1:13.3 final). Hot extraction at 1:8.8 then diluted by ice to the drinking ratio.
- **April House V60 (Rolf)** — April's agitation-forward house recipe: six even 50g pours on a ~30s cadence, each poured deliberately aggressively, finished with one stir. The opposite of a minimal-agitation brew. (Replaces a prior "Minimum Variables" entry that was a misattribution — no such single-continuous-pour Rolf recipe exists.)
- **Gagné Long AeroPress** — The "second sweet spot": fine grind + 80°C + 5-minute steep. Bitter Zone 3 compounds extract orders of magnitude slower at low temp; long steep saturates Zone 2 fully without invading Zone 3.
- **Perger High-Extraction V60** — Vigorous bloom stir + fine grind + spinning swirl during drawdown drives extraction yield above 22%. Bitterness comes from over-extracting the wrong compounds, not high yield itself.
- **Rao Rule of Thirds** — Equal-volume thirds + Rao spin (vortex swirl). Lower extraction variance run-to-run, easier to troubleshoot.
- **Hatakeyama Cafec Flower** — Match filter paper thickness to roast level. Light roast → thin paper (faster flow tolerable); dark roast → thick paper (slows flow where less contact is needed).
- **Wallgren Kalita** — Sieve out fines pre-brew. Fines over-extract relative to the rest of the grind; removing them tightens the extraction distribution and produces a startlingly clean cup.

> *Removed:* the **Turbo V60 (Hedrick)** entry — "turbo" is an espresso technique (Cameron/Hendon, *Matter* 2020; popularised by Hedrick ~2021), and no primary source documents a Hedrick filter recipe with the parameters it carried. The boiling-water + coarse-grind mechanism survives as a technique (§3a), de-attributed.

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

25 atomic moves (16 named-expert techniques + 9 general/foundational moves added in the June-2026 tag cleanup). Recipes are compositions of 3–6 of these, and every recipe's `techniques` field now references these ids — no free-text tags. Each technique cross-references the recipes that exemplify it.

### 3a. Temperature

| Technique | Author | Mechanism (1 line) | Exemplified by |
|---|---|---|---|
| **boiling-water-coarse-grind** *(Turbo)* | Cameron/Hendon (*Matter* 2020); Hedrick popularised | 100°C raises extraction rate across all zones; coarse grind partially cancels — net is high yield in short time. | *(no verified recipe — espresso-origin; filter "turbo pour-over" is a community application)* |
| **low-temp-long-steep** *(Gagné second sweet spot)* | Gagné | Bitter Zone-3 compounds extract orders of magnitude slower at 80°C — fine grind + long steep saturates Zone 2 without Zone 3. | gagne-long-aeropress |

### 3b. Agitation

| Technique | Author | Mechanism (1 line) | Exemplified by |
|---|---|---|---|
| **rao-spin** | Rao | Vortex swirl drags water down through puck centre rather than wall-first; counteracts V60 channeling. | rao-rule-of-thirds |
| **swirl-not-stir** | Hoffmann (popularised) | Swirl achieves saturation through bulk-puck motion, leaving fines distributed evenly. Stir agitates fines into the slurry. | hoffmann-v60-better-one-cup, rao-rule-of-thirds |
| **high-agitation-high-extraction** | Perger | Vigorous bloom stir + fine grind + drawdown swirl drives extraction yield above 22%. | perger-high-extraction-v60 |
| **minimal-agitation** | General (no single originator; **not** Rolf) | Single continuous pour, no stir. Removes pour count and pour spacing as variables. | wallgren-kalita-sieved |
| **melodrip-controlled-pouring** | Peng (2025) | Perforated disc breaks pour into many fine streams; eliminates pour-induced turbulence at the bed. | wbrc-2024-wolfl |
| **water-first** | Bailey (originated); Hoffmann (popularised) | Add water first, drop coffee on top. Grounds saturate from below via buoyancy/capillary action. | hoffmann-clever-ultimate |

### 3c. Pour pattern

| Technique | Author | Mechanism (1 line) | Exemplified by |
|---|---|---|---|
| **phase-separated-pouring** *(4:6)* | Kasuya | First 40% (two pours) controls acid/sweet axis; last 60% (3+ pours) controls strength. | wbrc-2016-kasuya, kasuya-4-6-standard |
| **rule-of-thirds** | Rao | Equal-volume pours after the bloom. Lower run-to-run variance. | rao-rule-of-thirds |

### 3d. Pre-brew

| Technique | Author | Mechanism (1 line) | Exemplified by |
|---|---|---|---|
| **fines-removal-sieving** | Wallgren (2016) | Discard particles <200µm pre-brew. Tightens extraction distribution. | wallgren-kalita-sieved |
| **roast-tailored-filter** | Hatakeyama | Match paper thickness to roast level — light roast → thin paper, dark roast → thick paper. | hatakeyama-cafec-flower |

### 3e. Post-brew

| Technique | Author | Mechanism (1 line) | Exemplified by |
|---|---|---|---|
| **concentrate-and-bypass** | Hoffmann; Stanica (WAC 2024) | Brew tight (1:6–1:11), dilute with cool bypass water. Separates extraction from drink concentration. | wac-2024-stanica |
| **flash-chilling** | Hoffmann (popularised) | Brew hot, drain onto ice. Aromatics lock into liquid before they volatilise. | hoffmann-immersion-iced-clever |

### 3f. Vessel-specific

| Technique | Author | Mechanism (1 line) | Exemplified by |
|---|---|---|---|
| **aeropress-inversion** | AeroPress competition community | Steep without dripping; cap, flip, press for exact contact-time control. | hoffmann-aeropress-standard, wac-2024-stanica, gagne-long-aeropress |

### 3g. Water

| Technique | Author | Mechanism (1 line) | Exemplified by |
|---|---|---|---|
| **low-mineral-water** *(championship water)* | Hendon (foundation); Du (championship application) | 40–80 ppm TDS, magnesium-biased. Removes bicarbonate buffering; sharpens delicate aromatic and acid expression. | wbrc-2019-du |

### 3h. General / foundational moves

Common-practice moves with no single originator (`verified: false` — the mechanisms are textbook brewing physics, not a cited routine). Added so every recipe references a real technique id instead of ad-hoc free text.

| Technique | Category | Mechanism (1 line) |
|---|---|---|
| **bloom** | pre-brew | Pre-wet the grounds (~2–3× dose) and wait 30–45 s so roast CO2 off-gasses before the main pours, preventing channeling. |
| **pulse-pouring** | pour-pattern | Add water in several discrete pours with pauses; pour count/size becomes the agitation + extraction control knob. |
| **immersion-steep** | vessel-specific | Fully submerge for a set time then drain — every particle sees the same water for the same time, so it's even and forgiving. |
| **central-pour** | pour-pattern | Pour only into the centre to keep water off the wall, reducing bypass and deepening the extraction column. |
| **spiral-pour** | pour-pattern | Outward spiral wets the whole surface evenly and washes wall grounds back into the bed. |
| **continuous-pour** | pour-pattern | One slow uninterrupted stream after the bloom — steady level, low agitation, fewer variables. |
| **machine-drip-brew** | vessel-specific | Auto drip machine meters water through a showerhead over a flat bed — multi-pour without operator skill. |
| **batch-scaling** | pre-brew | Scale up dose/batch at fixed ratio, coarsening grind because a deeper bed adds flow resistance. |
| **flat-bed-pour** | pour-pattern | Keep a flat, level bed (flat-bottom brewers, central pours) so water path length is uniform across all grounds. |

---

## 4. Cross-reference: who's behind what

| Expert | Recipes | Techniques |
|---|---|---|
| **James Hoffmann** | Better 1 Cup, Ultimate Clever, AeroPress, Moccamaster, Immersion Iced | swirl-not-stir, water-first (popularised), concentrate-and-bypass (popularised), flash-chilling (popularised) |
| **Tetsu Kasuya** | WBrC 2016, 4:6 standard | phase-separated-pouring |
| **Scott Rao** | Rule of Thirds | rao-spin, rule-of-thirds |
| **Matt Perger** | High-Extraction V60 | high-agitation-high-extraction |
| **Patrik Rolf** | April House V60 | (agitation-forward — none atomic) |
| **Jonathan Gagné** | Long-Brew AeroPress + Prismo | low-temp-long-steep |
| **Daiki Hatakeyama** | Cafec Flower (roast-tailored) | roast-tailored-filter |
| **Mikaela Wallgren** | Kalita with Sieved Fines | fines-removal-sieving |
| **Lance Hedrick** | (popularised the espresso "turbo"; no verified filter recipe) | boiling-water-coarse-grind (popularised) |
| **Cameron / Hendon** | (*Matter* 2020 — espresso "turbo" origin) | boiling-water-coarse-grind (foundation) |
| **James Bailey** | (originated water-first; Hoffmann popularised) | water-first (origin) |
| **Martin Wölfl** | WBrC 2024 | melodrip-controlled-pouring (exemplar); else composition of fast-flow + light agitation |
| **Carlos Medina** | WBrC 2023 | (none atomic — composition of lean ratio + moderate temp) |
| **Jia Ning Du** | WBrC 2019 | low-mineral-water (application) |
| **George Stanica** | WAC 2024 | concentrate-and-bypass (application) |
| **Christopher Hendon** | (water chemistry foundation) | low-mineral-water (foundation) |

---

## 5. What's deliberately NOT here

- **Espresso recipes.** BrewLog is filter-only; espresso has its own canon outside this corpus.
- **Anaerobic / heavily-experimental processing recipes.** The user avoids anaerobic; recipes targeting anaerobic-amplification are out of scope.
- **`/brew-insight` (post-brew haiku) integration.** That endpoint still uses its narrow Rao/Perger/Gagné/Solis canon by design — the haiku is 1–2 sentences and doesn't need the full corpus injected. If widened later, it'll be a separate change.
- **Hardcoded recipe paragraphs in `/recommend`'s system prompt.** Still present (`Wölfl 2024 Orea FAST`, Origami Air M variants, etc., in `src/lib/claude/recommend.ts`). They survive as a quick-reference embedded fallback; the structured corpus above is injected per turn alongside them. Future cleanup may remove the embedded list once we're sure the structured retrieval covers every case.
- **Staged / two-temperature recipes.** The one hard temperature rule: every recipe brews at ONE constant temperature. Staging — some water hot and some cool within a single brew, descending-temp pours, cool-bloom-then-hot, etc. — is out, because it needs two water setups and isn't practical for everyday brewing (removed by request, June 2026: Hsu 2022, Peng 2025, "The Peak", plus six experimental cold-bloom / multi-temp entries). `/recommend` + `/explore-agent` are instructed never to stage temperature; achieve aromatic preservation via grind, ratio, low-mineral water and minimal agitation instead. Enforced by `tests/recipes/validate.mjs`, which fails any recipe whose steps carry more than one temperature. **Cold brew is NOT excluded** — it's a single *cold* constant temperature, so it's allowed; iced/flash-chill brews likewise extract at one hot temperature and then dilute over ice (one brewing temperature, not staging).
