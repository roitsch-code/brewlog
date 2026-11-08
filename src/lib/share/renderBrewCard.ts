/**
 * Paints the shareable brew card — one phone screen (1080 × 1920, 9:16) — on a
 * canvas and hands back a PNG blob. Client only (needs the DOM canvas and the
 * app's fonts).
 *
 * The background is the coffee's own Field, drawn from the SAME layer data the
 * app's background is composed from (`composeFieldLayers`), so the card wears
 * the bag's colours. Everything on top is the Light System at phone scale:
 * the card is an 844 pt phone screen drawn 1920 px tall (× 2.27), so every
 * size below is a Light token or primitive times that factor — the Hero (Fraunces 600
 * 40 px, leading 1.05, tracking −0.01 em), the Headline (Fraunces 3xl), the
 * `.label-eyebrow`, the detail page's Section title and Stat cell, the Card
 * radius (3xl), the StarRating colours, the Footnote, the two-line wordmark.
 * The colours are the Light tokens of tailwind.config.ts as literals — the
 * canvas cannot read a class. Keep both in step.
 */

import { composeFieldLayers, fieldBlobColors } from "@/lib/field/composeGradient";
import { DEFAULT_FIELD_ZONES } from "@/lib/field/defaultZones";
import type { FieldZones } from "@/lib/field/types";
import type { BrewCardData } from "./brewCard";

export const CARD_W = 1080;
export const CARD_H = 1920;

/** The card is an iPhone screen (390 × 844 pt) drawn 1920 px tall; the
 * 1080 px width then holds 475 pt, a little more room than the phone. */
const S = CARD_H / 844;
const px = (phonePx: number) => Math.round(phonePx * S);

// ── Light tokens (tailwind.config.ts `light.*`, globals.css) ───────────────
const INK = "hsl(0 0% 14%)"; // light-foreground
const INK_90 = "hsl(0 0% 14% / 0.9)"; // .label-eyebrow colour
const INK_80 = "hsl(0 0% 14% / 0.8)"; // text-light-foreground/80
const INK_75 = "hsl(0 0% 14% / 0.75)"; // text-light-foreground/75
const INK_70 = "hsl(0 0% 14% / 0.7)"; // text-light-foreground/70
const INK_15 = "hsl(0 0% 14% / 0.15)"; // border-light-foreground/15
const MUTED = "hsl(0 0% 16%)"; // light-muted-foreground
const GLASS = "hsl(36 55% 96% / 0.55)"; // light-card-default
const STAR_FILL = "hsl(0 0% 14%)"; // StarRating FILLED_FILL
const STAR_EMPTY = "hsl(0 0% 14% / 0.25)"; // StarRating EMPTY_STROKE

const GUTTER = px(20); // px-5
const INNER_W = CARD_W - GUTTER * 2;
const RADIUS_CARD = px(24); // rounded-3xl (Card)
const RADIUS_STAT = px(16); // rounded-2xl (Stat cell)

type Ctx = CanvasRenderingContext2D;

interface Fonts {
  fraunces: string;
  chivo: string;
  mono: string;
}

/** The app's font stacks, read off the CSS variables fonts.css / layout.tsx
 * set on <html>; the vendored family names are the fallback (no DOM vars). */
function fontStacks(): Fonts {
  const read = (name: string) =>
    typeof document === "undefined" ? "" : getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const fraunces = read("--font-fraunces") || "'__btts_Fraunces'";
  const chivo = read("--font-chivo") || "'__btts_Chivo'";
  // .font-mono-num: Geist Mono, then JetBrains Mono.
  const geist = read("--font-geist-mono");
  const jet = read("--font-jetbrains-mono") || "'__btts_JetBrains_Mono'";
  const mono = [geist, jet].filter(Boolean).join(", ");
  return {
    fraunces: `${fraunces}, ui-serif, Georgia, serif`,
    chivo: `${chivo}, ui-sans-serif, system-ui, sans-serif`,
    mono: `${mono}, ui-monospace, monospace`,
  };
}

/** The same colour with another alpha — "hsl(h s% l% / a)" or "hsl(h s% l%)". */
function withAlpha(color: string, alpha: number): string {
  const m = color.match(/^hsl\(([^/]+?)(?:\s*\/\s*[\d.]+)?\)$/);
  if (!m) return color;
  return `hsl(${m[1].trim()} / ${alpha})`;
}

function paintField(ctx: Ctx, zones: FieldZones): void {
  const layers = composeFieldLayers(zones, 0) ?? composeFieldLayers(DEFAULT_FIELD_ZONES, 0);
  if (!layers) {
    ctx.fillStyle = "hsl(30 60% 92%)";
    ctx.fillRect(0, 0, CARD_W, CARD_H);
    return;
  }
  // Linear base. CSS angle: 0deg = up, 90deg = right; the gradient line is
  // |W·sin θ| + |H·cos θ| long and centred.
  const theta = (layers.base.angleDeg * Math.PI) / 180;
  const dx = Math.sin(theta);
  const dy = -Math.cos(theta);
  const len = Math.abs(CARD_W * dx) + Math.abs(CARD_H * dy);
  const cx = CARD_W / 2;
  const cy = CARD_H / 2;
  const lin = ctx.createLinearGradient(cx - (dx * len) / 2, cy - (dy * len) / 2, cx + (dx * len) / 2, cy + (dy * len) / 2);
  for (const s of layers.base.stops) lin.addColorStop(s.pct / 100, s.color);
  ctx.fillStyle = lin;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  const radial = (x: number, y: number, rx: number, ry: number, color: string, fade: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(rx, ry);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, color);
    g.addColorStop(Math.min(1, fade), withAlpha(color, 0));
    g.addColorStop(1, withAlpha(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(-x / rx, -y / ry, CARD_W / rx, CARD_H / ry);
    ctx.restore();
  };

  for (const r of layers.radials) {
    const x = (r.cxPct / 100) * CARD_W;
    const y = (r.cyPct / 100) * CARD_H;
    if (r.shape === "circle") {
      // CSS `circle` = farthest-corner.
      const far = Math.max(Math.hypot(x, y), Math.hypot(CARD_W - x, y), Math.hypot(x, CARD_H - y), Math.hypot(CARD_W - x, CARD_H - y));
      radial(x, y, far, far, r.color, r.fadePct / 100);
    } else {
      radial(x, y, (r.rxPct / 100) * CARD_W, (r.ryPct / 100) * CARD_H, r.color, r.fadePct / 100);
    }
  }
  // The living layer, at rest: the four drifting blobs as soft discs.
  for (const b of fieldBlobColors(zones)) {
    const R = CARD_W * 0.42;
    radial((b.cx / 100) * CARD_W, (b.cy / 100) * CARD_H, R, R, b.color, 0.7);
  }
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** `Card`: cream glass, rounded-3xl, no border. */
function cardSurface(ctx: Ctx, x: number, y: number, w: number, h: number): void {
  roundRect(ctx, x, y, w, h, RADIUS_CARD);
  ctx.fillStyle = GLASS;
  ctx.fill();
}

/** The detail page's `Stat` cell: cream glass, rounded-2xl, foreground/15 border. */
function statSurface(ctx: Ctx, x: number, y: number, w: number, h: number): void {
  roundRect(ctx, x, y, w, h, RADIUS_STAT);
  ctx.fillStyle = GLASS;
  ctx.fill();
  ctx.lineWidth = px(1);
  ctx.strokeStyle = INK_15;
  ctx.stroke();
}

function wrap(ctx: Ctx, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const probe = line ? `${line} ${w}` : w;
    if (ctx.measureText(probe).width <= maxWidth || !line) {
      line = probe;
    } else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1];
    while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1).trimEnd();
    kept[maxLines - 1] = `${last}…`;
    return kept;
  }
  return lines;
}

/** Shrink a font size until the text wraps into `maxLines` at `maxWidth`. */
function fitFont(ctx: Ctx, text: string, family: string, weight: number, start: number, min: number, maxWidth: number, maxLines: number): number {
  let size = start;
  while (size > min) {
    ctx.font = `${weight} ${size}px ${family}`;
    const lines = wrap(ctx, text, maxWidth, maxLines + 1);
    if (lines.length <= maxLines && !lines[lines.length - 1].endsWith("…")) return size;
    size -= 4;
  }
  return min;
}

/** Tracked uppercase label. `letterSpacing` is a newer canvas property —
 * where it is missing the label simply loses its tracking. */
function tracked(ctx: Ctx, str: string, x: number, y: number, font: string, color: string, spacingPx: number, align: CanvasTextAlign = "left"): void {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.letterSpacing = `${spacingPx}px`;
  ctx.fillText(str.toUpperCase(), x, y);
  ctx.letterSpacing = "0px";
  ctx.textAlign = "left";
}

/** `.label-eyebrow`: Chivo 600 11 px, 0.14 em, foreground/90. */
function labelEyebrow(ctx: Ctx, f: Fonts, str: string, x: number, y: number): void {
  const size = px(11);
  tracked(ctx, str, x, y, `600 ${size}px ${f.chivo}`, INK_90, size * 0.14);
}

/** The detail page's Section title: text-xs uppercase tracking-widest muted. */
function sectionTitle(ctx: Ctx, f: Fonts, str: string, x: number, y: number): void {
  const size = px(12);
  tracked(ctx, str, x, y, `400 ${size}px ${f.chivo}`, MUTED, size * 0.1);
}

/** The Stat cell label: text-[10px] uppercase tracking-widest muted, centred. */
function statLabel(ctx: Ctx, f: Fonts, str: string, cx: number, y: number): void {
  const size = px(10);
  tracked(ctx, str, cx, y, `400 ${size}px ${f.chivo}`, MUTED, size * 0.1, "center");
}

// StarRating's polygon (viewBox 24), drawn at the component's `sm` size (w-5).
const STAR_POINTS = [
  [12, 2], [15.09, 8.26], [22, 9.27], [17, 14.14], [18.18, 21.02],
  [12, 17.77], [5.82, 21.02], [7, 14.14], [2, 9.27], [8.91, 8.26],
] as const;

function starPath(ctx: Ctx, x: number, y: number, size: number): void {
  const k = size / 24;
  ctx.beginPath();
  STAR_POINTS.forEach(([sx, sy], i) => {
    if (i === 0) ctx.moveTo(x + sx * k, y + sy * k);
    else ctx.lineTo(x + sx * k, y + sy * k);
  });
  ctx.closePath();
}

/** `StarRating` readonly sm: five 20 px stars, gap-1; filled anthracite,
 * empty a 25 % stroke, half = the left half filled. Returns the row width. */
function paintStars(ctx: Ctx, rating: number, x: number, top: number): number {
  const size = px(20);
  const gap = px(4);
  for (let i = 0; i < 5; i++) {
    const sx = x + i * (size + gap);
    const fill = Math.max(0, Math.min(1, rating - i));
    starPath(ctx, sx, top, size);
    ctx.lineWidth = px(1.5) * (24 / 20);
    ctx.strokeStyle = STAR_EMPTY;
    ctx.stroke();
    if (fill >= 1) {
      starPath(ctx, sx, top, size);
      ctx.fillStyle = STAR_FILL;
      ctx.fill();
    } else if (fill > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(sx, top, size / 2, size);
      ctx.clip();
      starPath(ctx, sx, top, size);
      ctx.fillStyle = STAR_FILL;
      ctx.fill();
      ctx.restore();
    }
  }
  return 5 * size + 4 * gap;
}

async function loadFonts(f: Fonts): Promise<void> {
  if (typeof document === "undefined" || !("fonts" in document)) return;
  const faces = [
    `600 ${px(40)}px ${f.fraunces}`,
    `400 ${px(30)}px ${f.fraunces}`,
    `400 ${px(14)}px ${f.chivo}`,
    `500 ${px(14)}px ${f.chivo}`,
    `600 ${px(11)}px ${f.chivo}`,
    `500 ${px(18)}px ${f.mono}`,
    `400 ${px(14)}px ${f.mono}`,
  ];
  await Promise.all(faces.map((face) => document.fonts.load(face).catch(() => undefined)));
}

/** A text run the layout either measures or paints — one code path for both. */
interface Pen {
  paint: boolean;
  y: number;
}

function text(ctx: Ctx, pen: Pen, str: string, x: number, font: string, color: string, align: CanvasTextAlign = "left"): void {
  if (!pen.paint) return;
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.fillText(str, x, pen.y);
  ctx.textAlign = "left";
}

/** Panel 1 — brewer (Headline), recipe name, the four Stat cells, the grind.
 * Returns the panel height; with `paint` false nothing is drawn. */
function panelRecipe(ctx: Ctx, f: Fonts, card: BrewCardData, top: number, paint: boolean): number {
  const pad = px(16);
  const x = GUTTER + pad;
  const w = INNER_W - pad * 2;
  const pen: Pen = { paint, y: top + pad };

  // Headline: font-fraunces text-3xl leading-none.
  const headline = px(30);
  pen.y += headline;
  ctx.font = `400 ${headline}px ${f.fraunces}`;
  text(ctx, pen, wrap(ctx, card.method, w, 1)[0], x, `400 ${headline}px ${f.fraunces}`, INK);
  if (card.recipeName) {
    // text-light-foreground/80 text-sm mt-1.5 font-medium
    const sm = px(14);
    ctx.font = `500 ${sm}px ${f.chivo}`;
    const lines = wrap(ctx, card.recipeName, w, 1);
    pen.y += px(6);
    for (const l of lines) {
      pen.y += sm * 1.4;
      text(ctx, pen, l, x, `500 ${sm}px ${f.chivo}`, INK_80);
    }
  }
  pen.y += px(16);

  // Stat cells: Dose · Water · Ratio · Temp (gap-3).
  const cells: { label: string; value: string }[] = [
    { label: "Dose", value: `${card.doseG}g` },
    { label: card.iceG ? "Hot water" : "Water", value: `${card.waterG}g` },
    { label: "Ratio", value: card.ratio || "—" },
    { label: "Temp", value: `${card.tempC}°C` },
  ];
  const cellGap = px(12);
  const cellW = (w - cellGap * 3) / 4;
  const cellH = px(54);
  if (paint) {
    cells.forEach((c, i) => {
      const cx = x + i * (cellW + cellGap);
      statSurface(ctx, cx, pen.y, cellW, cellH);
      statLabel(ctx, f, c.label, cx + cellW / 2, pen.y + px(18));
      // font-mono-num text-lg font-medium
      ctx.font = `500 ${px(18)}px ${f.mono}`;
      ctx.fillStyle = INK;
      ctx.textAlign = "center";
      ctx.fillText(c.value, cx + cellW / 2, pen.y + px(41));
      ctx.textAlign = "left";
    });
  }
  pen.y += cellH;
  if (card.iceG) {
    pen.y += px(12) + px(14);
    text(ctx, pen, `Onto ${card.iceG}g of ice · ${card.waterG + card.iceG}g in the cup`, x, `400 ${px(14)}px ${f.chivo}`, MUTED);
  }

  // Grind — a Section of its own.
  pen.y += px(18);
  if (paint) sectionTitle(ctx, f, "Grind", x, pen.y);
  pen.y += px(10) + px(18);
  const grindLine = card.grind.grinder ? `${card.grind.value}  ${card.grind.grinder}` : card.grind.value;
  text(ctx, pen, grindLine, x, `500 ${px(18)}px ${f.mono}`, INK);
  if (card.grind.alsoOn) {
    pen.y += px(20);
    text(ctx, pen, `≈ ${card.grind.alsoOn}`, x, `400 ${px(13)}px ${f.mono}`, MUTED);
  }
  if (card.grind.description) {
    // text-light-foreground/75 text-sm leading-relaxed (the page's quote style)
    const sm = px(14);
    ctx.font = `400 ${sm}px ${f.chivo}`;
    pen.y += px(6);
    for (const l of wrap(ctx, card.grind.description, w, 2)) {
      pen.y += sm * 1.5;
      text(ctx, pen, l, x, `400 ${sm}px ${f.chivo}`, INK_75);
    }
    // Footnote: text-[12px] muted
    pen.y += px(8) + px(12);
    ctx.font = `400 ${px(12)}px ${f.chivo}`;
    const note = card.grind.descriptionSource === "author" ? "The recipe author's own words." : "Relative to a measured V60 setting on this grinder.";
    text(ctx, pen, wrap(ctx, note, w, 1)[0], x, `400 ${px(12)}px ${f.chivo}`, MUTED);
  }
  pen.y += pad;
  return pen.y - top;
}

/** Panel 2 — the steps. Sized to its rows inside `maxHeight`; the rows
 * shrink to 16 phone-px before any step is dropped. Returns the height. */
function panelSteps(ctx: Ctx, f: Fonts, card: BrewCardData, top: number, maxHeight: number): number {
  const pad = px(16);
  const headH = pad + px(12) + px(12);
  const available = maxHeight - headH - pad;
  const MIN_ROW = px(16);
  const MAX_ROW = px(22);
  const maxRows = Math.max(3, Math.floor(available / MIN_ROW));
  let rows = card.steps;
  if (rows.length > maxRows) {
    rows = [...rows.slice(0, maxRows - 1), { at: "", label: `+ ${rows.length - maxRows + 1} more steps`, detail: "" }];
  }
  const rowH = Math.max(MIN_ROW, Math.min(MAX_ROW, Math.floor(available / Math.max(1, rows.length))));
  const height = headH + rows.length * rowH + pad;
  cardSurface(ctx, GUTTER, top, INNER_W, height);
  let sy = top + pad + px(12);
  sectionTitle(ctx, f, `Steps · done at ${card.finish}`, GUTTER + pad, sy);
  sy += px(12);
  // Card title size (text-[15px] font-medium) on roomy rows, text-sm when tight.
  const fontPx = rowH >= px(22) ? px(15) : px(14);
  const colAt = GUTTER + pad;
  const colLabel = colAt + px(54);
  const right = GUTTER + INNER_W - pad;
  for (const s of rows) {
    sy += rowH;
    const base = sy - rowH * 0.3;
    ctx.font = `500 ${fontPx}px ${f.mono}`;
    ctx.fillStyle = MUTED;
    ctx.fillText(s.at, colAt, base);
    ctx.font = `400 ${fontPx}px ${f.mono}`;
    const detailW = s.detail ? ctx.measureText(s.detail).width + px(14) : 0;
    ctx.font = `500 ${fontPx}px ${f.chivo}`;
    ctx.fillStyle = INK;
    const labelX = s.at ? colLabel : colAt;
    ctx.fillText(wrap(ctx, s.label, right - labelX - detailW, 1)[0], labelX, base);
    if (s.detail) {
      ctx.font = `400 ${fontPx}px ${f.mono}`;
      ctx.fillStyle = MUTED;
      ctx.textAlign = "right";
      ctx.fillText(s.detail, right, base);
      ctx.textAlign = "left";
    }
  }
  return height;
}

/**
 * Render the card to a PNG. Resolves with the blob; rejects when the canvas
 * is unavailable (no 2D context) or the browser refuses `toBlob`.
 */
export async function renderBrewCard(card: BrewCardData, fieldZones: FieldZones | null | undefined): Promise<Blob> {
  const f = fontStacks();
  await loadFonts(f);
  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");

  paintField(ctx, fieldZones ?? DEFAULT_FIELD_ZONES);
  ctx.textBaseline = "alphabetic";

  // ── Hero: eyebrow (roaster), the coffee, origin ───────────────────────
  let y = px(44);
  if (card.roaster) {
    labelEyebrow(ctx, f, card.roaster, GUTTER, y);
    y += px(12); // mb-3
  }
  // font-fraunces font-semibold text-[40px] leading-[1.05] tracking-[-0.01em]
  const heroSize = fitFont(ctx, card.name, f.fraunces, 600, px(40), px(26), INNER_W, 2);
  ctx.font = `600 ${heroSize}px ${f.fraunces}`;
  ctx.fillStyle = INK;
  ctx.letterSpacing = `${-0.01 * heroSize}px`;
  const heroLines = wrap(ctx, card.name, INNER_W, 2);
  y += heroSize * 0.85;
  for (const l of heroLines) {
    ctx.fillText(l, GUTTER, y);
    y += heroSize * 1.05;
  }
  ctx.letterSpacing = "0px";
  y -= heroSize * 1.05;
  if (card.originLine) {
    // text-light-foreground/70 text-sm mt-1.5
    y += px(6) + px(14) * 1.4;
    ctx.font = `400 ${px(14)}px ${f.chivo}`;
    ctx.fillStyle = INK_70;
    ctx.fillText(wrap(ctx, card.originLine, INNER_W, 1)[0], GUTTER, y);
  }
  y += px(24);

  // ── Panel 1 (measure, surface, paint) ─────────────────────────────────
  const p1Top = y;
  const p1H = panelRecipe(ctx, f, card, p1Top, false);
  cardSurface(ctx, GUTTER, p1Top, INNER_W, p1H);
  panelRecipe(ctx, f, card, p1Top, true);
  y = p1Top + p1H + px(12); // gap-3 between cards

  // ── Footer geometry: stars row, two-line wordmark, date ───────────────
  const wordmarkSize = px(30); // font-fraunces text-3xl leading-[1.05]
  const footerH = px(20) + px(12) + wordmarkSize * 1.05 * 2 + px(4);
  const footerTop = CARD_H - px(28) - footerH;

  // ── Panel 2: the steps ────────────────────────────────────────────────
  panelSteps(ctx, f, card, y, footerTop - px(24) - y);

  // ── Footer ────────────────────────────────────────────────────────────
  let fy = footerTop;
  const starW = typeof card.rating === "number" ? paintStars(ctx, card.rating, GUTTER, fy) : 0;
  if (card.actualTime) {
    // text-light-muted-foreground text-xs (the page's "Actual time" line)
    ctx.font = `400 ${px(12)}px ${f.chivo}`;
    ctx.fillStyle = MUTED;
    ctx.fillText(`Brewed in ${card.actualTime}`, GUTTER + starW + (starW ? px(10) : 0), fy + px(14));
  }
  fy += px(20) + px(12) + wordmarkSize * 0.85;
  ctx.font = `400 ${wordmarkSize}px ${f.fraunces}`;
  ctx.fillStyle = INK;
  ctx.fillText("Better taste", GUTTER, fy);
  fy += wordmarkSize * 1.05;
  ctx.fillText("than sorry.", GUTTER, fy);
  // Date: text-light-foreground/70 text-xs, on the wordmark's last line.
  ctx.font = `400 ${px(12)}px ${f.chivo}`;
  ctx.fillStyle = INK_70;
  ctx.textAlign = "right";
  ctx.fillText(card.date, GUTTER + INNER_W, fy);
  ctx.textAlign = "left";

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))), "image/png");
  });
}
