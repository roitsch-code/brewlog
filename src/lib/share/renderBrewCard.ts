/**
 * Paints the shareable brew card — one phone screen (1080 × 1920, 9:16) — on a
 * canvas and hands back a PNG blob. Client only (needs the DOM canvas and the
 * app's fonts).
 *
 * The background is the coffee's own Field, drawn from the SAME layer data the
 * app's background is composed from (`composeFieldLayers`), so the card wears
 * the bag's colours. On it ONE object: a cream Card (card-default, rounded-3xl)
 * holding a two-column list — label left, value right, the same grammar for
 * the numbers and for the steps — between the coffee's name above and the
 * wordmark below. No nested boxes, no uppercase labels, two type voices
 * (Fraunces for the names, Chivo for the rest; Geist Mono only for the
 * clock and the grams). Owner, 2026-11-08, on the first two layouts: "alles
 * wie Kraut und Rüben, unruhig" — calm is the brief.
 *
 * Sizes are the Light tokens at phone scale: an 844 pt screen drawn 1920 px
 * tall (× 2.27). Colours are the tokens of tailwind.config.ts as literals —
 * the canvas cannot read a class. Keep both in step.
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
const INK_70 = "hsl(0 0% 14% / 0.7)"; // text-light-foreground/70
const INK_15 = "hsl(0 0% 14% / 0.15)"; // border-light-foreground/15
const GLASS = "hsl(36 55% 96% / 0.55)"; // light-card-default

const GUTTER = px(20); // px-5
const INNER_W = CARD_W - GUTTER * 2;
const RADIUS_CARD = px(24); // rounded-3xl (Card)

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

async function loadFonts(f: Fonts): Promise<void> {
  if (typeof document === "undefined" || !("fonts" in document)) return;
  const faces = [
    `600 ${px(34)}px ${f.fraunces}`,
    `400 ${px(26)}px ${f.fraunces}`,
    `400 ${px(15)}px ${f.chivo}`,
    `500 ${px(15)}px ${f.chivo}`,
    `500 ${px(15)}px ${f.mono}`,
    `400 ${px(14)}px ${f.mono}`,
  ];
  await Promise.all(faces.map((face) => document.fonts.load(face).catch(() => undefined)));
}

/** One row of the list: a label on the left, a value on the right. */
interface Row {
  label: string;
  value: string;
  /** Numbers set in mono-num; words in Chivo. */
  mono: boolean;
  /** A clock position in front of the label (the steps). */
  at?: string;
}

/** The whole list the card shows, in order: the numbers, a rule, the steps. */
function rowsOf(card: BrewCardData): { numbers: Row[]; steps: Row[] } {
  const numbers: Row[] = [
    { label: "Dose", value: `${card.doseG}g`, mono: true },
    { label: card.iceG ? "Hot water" : "Water", value: `${card.waterG}g`, mono: true },
  ];
  if (card.iceG) numbers.push({ label: "Ice", value: `${card.iceG}g`, mono: true });
  numbers.push({ label: "Ratio", value: card.ratio || "—", mono: true });
  numbers.push({ label: "Temperature", value: `${card.tempC}°C`, mono: true });
  if (card.grind) numbers.push({ label: "Grind", value: `${card.grind.word}, ${card.grind.like}`, mono: false });
  const steps: Row[] = card.steps.map((s) => ({ at: s.at, label: s.label, value: s.detail, mono: true }));
  steps.push({ at: card.finish, label: "Done", value: "", mono: true });
  return { numbers, steps };
}

const ROW_H = px(30);
const CARD_PAD = px(20);

/** Measure the Card's height for its rows (header + rules + rows + padding). */
function cardHeight(ctx: Ctx, f: Fonts, card: BrewCardData, rows: ReturnType<typeof rowsOf>): number {
  let h = CARD_PAD;
  h += px(26); // brewer, Fraunces 3xl-ish on its own line
  if (card.subtitle) h += px(6) + px(15) * 1.4;
  h += px(18); // to the first rule
  h += px(12) + rows.numbers.length * ROW_H + px(12);
  h += px(12) + rows.steps.length * ROW_H;
  h += CARD_PAD;
  void ctx;
  void f;
  return h;
}

function rule(ctx: Ctx, x: number, y: number, w: number): void {
  ctx.fillStyle = INK_15;
  ctx.fillRect(x, Math.round(y), w, Math.max(1, Math.round(px(0.5))));
}

function paintRows(ctx: Ctx, f: Fonts, rows: Row[], x: number, top: number, w: number): number {
  let y = top;
  const atW = px(52);
  for (const r of rows) {
    const base = y + ROW_H * 0.68;
    let labelX = x;
    if (r.at !== undefined) {
      ctx.font = `400 ${px(14)}px ${f.mono}`;
      ctx.fillStyle = INK_70;
      ctx.fillText(r.at, x, base);
      labelX = x + atW;
    }
    ctx.font = r.mono ? `500 ${px(15)}px ${f.mono}` : `500 ${px(15)}px ${f.chivo}`;
    const valueW = r.value ? ctx.measureText(r.value).width : 0;
    if (r.value) {
      ctx.fillStyle = r.at !== undefined ? INK_70 : INK;
      ctx.textAlign = "right";
      ctx.fillText(r.value, x + w, base);
      ctx.textAlign = "left";
    }
    ctx.font = r.at !== undefined ? `500 ${px(15)}px ${f.chivo}` : `400 ${px(15)}px ${f.chivo}`;
    ctx.fillStyle = r.at !== undefined ? INK : INK_70;
    ctx.fillText(wrap(ctx, r.label, w - (labelX - x) - valueW - px(12), 1)[0], labelX, base);
    y += ROW_H;
  }
  return y;
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

  // ── Header: roaster, the coffee ───────────────────────────────────────
  let y = px(56);
  if (card.roaster) {
    ctx.font = `500 ${px(14)}px ${f.chivo}`;
    ctx.fillStyle = INK_70;
    ctx.fillText(wrap(ctx, card.roaster, INNER_W, 1)[0], GUTTER, y);
    y += px(10);
  }
  const nameSize = fitFont(ctx, card.name, f.fraunces, 600, px(34), px(24), INNER_W, 2);
  ctx.font = `600 ${nameSize}px ${f.fraunces}`;
  ctx.fillStyle = INK;
  ctx.letterSpacing = `${-0.01 * nameSize}px`;
  const nameLines = wrap(ctx, card.name, INNER_W, 2);
  y += nameSize * 0.85;
  for (const l of nameLines) {
    ctx.fillText(l, GUTTER, y);
    y += nameSize * 1.05;
  }
  ctx.letterSpacing = "0px";
  const headerBottom = y - nameSize * 1.05 + px(8);

  // ── Footer geometry ───────────────────────────────────────────────────
  const wordmarkSize = px(26);
  const footerH = wordmarkSize * 1.05 * 2;
  const footerTop = CARD_H - px(36) - footerH;

  // ── The Card, centred between header and footer ───────────────────────
  const rows = rowsOf(card);
  const maxH = footerTop - px(24) - (headerBottom + px(24));
  // Too many steps for one screen: keep the first ones and say how many follow.
  const maxStepRows = Math.max(3, Math.floor((maxH - cardHeight(ctx, f, card, { numbers: rows.numbers, steps: [] })) / ROW_H));
  if (rows.steps.length > maxStepRows) {
    const kept = rows.steps.slice(0, maxStepRows - 1);
    kept.push({ label: `${rows.steps.length - kept.length} more steps`, value: "", mono: false, at: "" });
    rows.steps = kept;
  }
  const cardH = Math.min(maxH, cardHeight(ctx, f, card, rows));
  const cardTop = Math.round(headerBottom + px(24) + (maxH - cardH) / 2);
  cardSurface(ctx, GUTTER, cardTop, INNER_W, cardH);

  const x = GUTTER + CARD_PAD;
  const w = INNER_W - CARD_PAD * 2;
  let cy = cardTop + CARD_PAD;
  // Brewer (Fraunces), the reference under it.
  cy += px(26) * 0.78;
  ctx.font = `400 ${px(26)}px ${f.fraunces}`;
  ctx.fillStyle = INK;
  ctx.fillText(wrap(ctx, card.method, w, 1)[0], x, cy);
  cy += px(26) * 0.22;
  if (card.subtitle) {
    cy += px(6) + px(15) * 1.4;
    ctx.font = `400 ${px(15)}px ${f.chivo}`;
    ctx.fillStyle = INK_70;
    ctx.fillText(wrap(ctx, card.subtitle, w, 1)[0], x, cy - px(15) * 0.3);
  }
  cy += px(18);
  rule(ctx, x, cy, w);
  cy += px(12);
  cy = paintRows(ctx, f, rows.numbers, x, cy, w);
  cy += px(12);
  rule(ctx, x, cy, w);
  cy += px(12);
  paintRows(ctx, f, rows.steps, x, cy, w);

  // ── Footer: the wordmark ──────────────────────────────────────────────
  let fy = footerTop + wordmarkSize * 0.85;
  ctx.font = `400 ${wordmarkSize}px ${f.fraunces}`;
  ctx.fillStyle = INK;
  ctx.fillText("Better taste", GUTTER, fy);
  fy += wordmarkSize * 1.05;
  ctx.fillText("than sorry.", GUTTER, fy);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))), "image/png");
  });
}
