/**
 * Paints the shareable brew card — one phone screen (1080 × 1920, 9:16) — on a
 * canvas and hands back a PNG blob. Client only (needs the DOM canvas and the
 * vendored fonts from src/app/fonts.css).
 *
 * The background is the coffee's own Field, drawn from the SAME layer data the
 * app's background is composed from (`composeFieldLayers`), so the card wears
 * the bag's colours. Text sits on the cream glass the app uses (card-default,
 * 55 %), anthracite on cream — the Light tokens, as numbers.
 */

import { composeFieldLayers, fieldBlobColors } from "@/lib/field/composeGradient";
import { DEFAULT_FIELD_ZONES } from "@/lib/field/defaultZones";
import type { FieldZones } from "@/lib/field/types";
import type { BrewCardData } from "./brewCard";

export const CARD_W = 1080;
export const CARD_H = 1920;

// Light tokens (tailwind.config.ts `light.*`) as literal colours — the canvas
// cannot read CSS classes. Keep in step with the config.
const INK = "hsl(0 0% 14%)";
const INK_MUTED = "hsl(0 0% 16% / 0.62)";
const INK_FAINT = "hsl(0 0% 16% / 0.4)";
const GLASS = "hsl(36 55% 96% / 0.55)";
const GLASS_BORDER = "hsl(0 0% 14% / 0.15)";

const FRAUNCES = '"__btts_Fraunces", Georgia, serif';
const CHIVO = '"__btts_Chivo", system-ui, sans-serif';
const MONO = '"__btts_JetBrains_Mono", ui-monospace, monospace';

const GUTTER = 72;
const INNER_W = CARD_W - GUTTER * 2;

type Ctx = CanvasRenderingContext2D;

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

function glass(ctx: Ctx, x: number, y: number, w: number, h: number, r = 40): void {
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = GLASS;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = GLASS_BORDER;
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

function eyebrow(ctx: Ctx, text: string, x: number, y: number, color = INK_MUTED): void {
  ctx.font = `500 26px ${CHIVO}`;
  ctx.fillStyle = color;
  ctx.letterSpacing = "4px";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(text.toUpperCase(), x, y);
  ctx.letterSpacing = "0px";
}

function star(ctx: Ctx, cx: number, cy: number, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const px = cx + Math.cos(a) * rad;
    const py = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function paintStars(ctx: Ctx, rating: number, x: number, cy: number, size: number): number {
  const gap = size * 0.5;
  for (let i = 0; i < 5; i++) {
    const cx = x + i * (size + gap) + size / 2;
    const fill = Math.max(0, Math.min(1, rating - i));
    star(ctx, cx, cy, size / 2);
    ctx.fillStyle = INK_FAINT;
    ctx.fill();
    if (fill > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(cx - size / 2, cy - size, size * fill, size * 2);
      ctx.clip();
      star(ctx, cx, cy, size / 2);
      ctx.fillStyle = INK;
      ctx.fill();
      ctx.restore();
    }
  }
  return 5 * size + 4 * gap;
}

async function loadFonts(): Promise<void> {
  if (typeof document === "undefined" || !("fonts" in document)) return;
  const faces = [
    `600 96px ${FRAUNCES}`,
    `500 44px ${FRAUNCES}`,
    `400 36px ${FRAUNCES}`,
    `400 36px ${CHIVO}`,
    `500 26px ${CHIVO}`,
    `600 36px ${CHIVO}`,
    `500 48px ${MONO}`,
    `400 32px ${MONO}`,
  ];
  await Promise.all(faces.map((f) => document.fonts.load(f).catch(() => undefined)));
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

/** Panel 1 — brewer, recipe name, the four numbers, the grind. Returns the
 * panel height; with `paint` false nothing is drawn (the measuring pass). */
function panelRecipe(ctx: Ctx, card: BrewCardData, top: number, paint: boolean): number {
  const pad = 48;
  const x = GUTTER + pad;
  const w = INNER_W - pad * 2;
  const pen: Pen = { paint, y: top + pad };

  pen.y += 54;
  ctx.font = `600 64px ${FRAUNCES}`;
  text(ctx, pen, wrap(ctx, card.method, w, 1)[0], x, `600 64px ${FRAUNCES}`, INK);
  if (card.recipeName) {
    ctx.font = `400 32px ${CHIVO}`;
    for (const l of wrap(ctx, card.recipeName, w, 2)) {
      pen.y += 42;
      text(ctx, pen, l, x, `400 32px ${CHIVO}`, INK_MUTED);
    }
  }
  pen.y += 44;

  const cells: { label: string; value: string }[] = [
    { label: "Dose", value: `${card.doseG} g` },
    { label: card.iceG ? "Hot water" : "Water", value: `${card.waterG} g` },
    { label: "Ratio", value: card.ratio || "—" },
    { label: "Temp", value: `${card.tempC} °C` },
  ];
  const cellGap = 20;
  const cellW = (w - cellGap * 3) / 4;
  const cellH = 128;
  if (paint) {
    cells.forEach((c, i) => {
      const cx = x + i * (cellW + cellGap);
      glass(ctx, cx, pen.y, cellW, cellH, 28);
      ctx.textAlign = "center";
      eyebrow(ctx, c.label, cx + cellW / 2, pen.y + 44);
      ctx.font = `500 44px ${MONO}`;
      ctx.fillStyle = INK;
      ctx.fillText(c.value, cx + cellW / 2, pen.y + 100);
      ctx.textAlign = "left";
    });
  }
  pen.y += cellH;
  if (card.iceG) {
    pen.y += 34;
    text(ctx, pen, `Onto ${card.iceG} g of ice · ${card.waterG + card.iceG} g in the cup`, x, `400 32px ${CHIVO}`, INK_MUTED);
  }

  pen.y += 56;
  if (paint) eyebrow(ctx, "Grind", x, pen.y);
  pen.y += 52;
  const grindLine = card.grind.grinder ? `${card.grind.value}  ${card.grind.grinder}` : card.grind.value;
  text(ctx, pen, grindLine, x, `500 44px ${MONO}`, INK);
  if (card.grind.alsoOn) {
    pen.y += 42;
    text(ctx, pen, `≈ ${card.grind.alsoOn}`, x, `400 30px ${MONO}`, INK_MUTED);
  }
  if (card.grind.description) {
    ctx.font = `400 34px ${FRAUNCES}`;
    for (const l of wrap(ctx, card.grind.description, w, 3)) {
      pen.y += 44;
      text(ctx, pen, l, x, `400 34px ${FRAUNCES}`, INK);
    }
    pen.y += 34;
    text(
      ctx,
      pen,
      card.grind.descriptionSource === "author" ? "The recipe author's own words." : "Relative to a measured V60 pour-over setting on the same grinder.",
      x,
      `400 24px ${CHIVO}`,
      INK_MUTED,
    );
  }
  pen.y += pad;
  return pen.y - top;
}

/** Panel 2 — the steps. Sized to its rows inside `maxHeight`; the rows
 * shrink to 44 px before any step is dropped. Returns the painted height. */
function panelSteps(ctx: Ctx, card: BrewCardData, top: number, maxHeight: number): number {
  const pad = 48;
  const headH = pad + 20 + 30;
  const available = maxHeight - headH - pad;
  const MIN_ROW = 44;
  const maxRows = Math.max(3, Math.floor(available / MIN_ROW));
  let rows = card.steps;
  if (rows.length > maxRows) {
    rows = [...rows.slice(0, maxRows - 1), { at: "", label: `+ ${rows.length - maxRows + 1} more steps`, detail: "" }];
  }
  const rowH = Math.max(MIN_ROW, Math.min(68, Math.floor(available / Math.max(1, rows.length))));
  const height = headH + rows.length * rowH + pad;
  glass(ctx, GUTTER, top, INNER_W, height);
  let sy = top + pad + 20;
  eyebrow(ctx, `Steps · done at ${card.finish}`, GUTTER + pad, sy);
  sy += 30;
  const fontPx = rowH >= 64 ? 36 : rowH >= 56 ? 32 : 28;
  const colAt = GUTTER + pad;
  const colLabel = colAt + 150;
  const right = GUTTER + INNER_W - pad;
  for (const s of rows) {
    sy += rowH;
    const base = sy - rowH * 0.3;
    ctx.font = `500 ${fontPx}px ${MONO}`;
    ctx.fillStyle = INK_MUTED;
    ctx.fillText(s.at, colAt, base);
    ctx.font = `400 ${fontPx - 2}px ${MONO}`;
    const detailW = s.detail ? ctx.measureText(s.detail).width + 40 : 0;
    ctx.font = `600 ${fontPx}px ${CHIVO}`;
    ctx.fillStyle = INK;
    const labelX = s.at ? colLabel : colAt;
    ctx.fillText(wrap(ctx, s.label, right - labelX - detailW, 1)[0], labelX, base);
    if (s.detail) {
      ctx.font = `400 ${fontPx - 2}px ${MONO}`;
      ctx.fillStyle = INK_MUTED;
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
  await loadFonts();
  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");

  paintField(ctx, fieldZones ?? DEFAULT_FIELD_ZONES);
  ctx.textBaseline = "alphabetic";

  // ── Header: roaster, coffee, origin ───────────────────────────────────
  let y = 150;
  if (card.roaster) {
    eyebrow(ctx, card.roaster, GUTTER, y, INK);
    y += 44;
  }
  const nameSize = fitFont(ctx, card.name, FRAUNCES, 600, 96, 56, INNER_W, 2);
  ctx.font = `600 ${nameSize}px ${FRAUNCES}`;
  ctx.fillStyle = INK;
  y += nameSize * 0.92;
  for (const l of wrap(ctx, card.name, INNER_W, 2)) {
    ctx.fillText(l, GUTTER, y);
    y += nameSize * 1.05;
  }
  y -= nameSize * 1.05;
  if (card.originLine) {
    y += 54;
    ctx.font = `400 36px ${CHIVO}`;
    ctx.fillStyle = INK_MUTED;
    ctx.fillText(wrap(ctx, card.originLine, INNER_W, 1)[0], GUTTER, y);
  }
  y += 56;

  // ── Panel 1 (measure, glass, paint) ───────────────────────────────────
  const p1Top = y;
  const p1H = panelRecipe(ctx, card, p1Top, false);
  glass(ctx, GUTTER, p1Top, INNER_W, p1H);
  panelRecipe(ctx, card, p1Top, true);
  y = p1Top + p1H + 40;

  // ── Panel 2: the steps ────────────────────────────────────────────────
  const footerTop = CARD_H - 200;
  panelSteps(ctx, card, y, footerTop - 40 - y);

  // ── Footer: rating, actual time, wordmark ─────────────────────────────
  let fy = footerTop + 50;
  let tx = GUTTER;
  if (typeof card.rating === "number") {
    tx += paintStars(ctx, card.rating, GUTTER, fy - 12, 36) + 28;
  }
  if (card.actualTime) {
    ctx.font = `400 30px ${CHIVO}`;
    ctx.fillStyle = INK_MUTED;
    ctx.fillText(`Brewed in ${card.actualTime}`, tx, fy);
  }
  fy += 76;
  ctx.font = `500 44px ${FRAUNCES}`;
  ctx.fillStyle = INK;
  ctx.fillText("Better taste than sorry.", GUTTER, fy);
  ctx.font = `400 26px ${CHIVO}`;
  ctx.fillStyle = INK_MUTED;
  ctx.textAlign = "right";
  ctx.fillText(card.date, GUTTER + INNER_W, fy);
  ctx.textAlign = "left";

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))), "image/png");
  });
}
