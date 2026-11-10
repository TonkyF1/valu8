/**
 * Valu8 share card: a 1080x1350 PNG drawn client-side on a canvas (no server, no paid API).
 * Layout follows the approved mock-ups: wordmark, plate-v2 number plate, car, the free valuation
 * headline and the valu8.uk footer. The plate shows "VALU8" unless the owner chooses to show
 * their own registration. Never includes the report link, photos or anything from the paid report.
 */
export type ShareCardData = {
  car: string;            // "2017 Volkswagen Golf"
  meta?: string | null;   // "About 68,000 miles · Diesel"
  value: string;          // "£8,750" or "£3,000–£5,100"
  plate?: string | null;  // shown only when the owner opts in
};

export const CARD_W = 1080;
export const CARD_H = 1350;
const BG = "#111111", FG = "#F7F5F3", MUTED = "#ADADAD", TEAL = "#00D6C8", PLATE = "#FDE047";

/** "AB17CDE" -> "AB17 CDE" (current-style plates); other formats unchanged. */
export function plateText(reg?: string | null): string {
  const r = String(reg ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!r) return "VALU8";
  return /^[A-Z]{2}\d{2}[A-Z]{3}$/.test(r) ? `${r.slice(0, 4)} ${r.slice(4)}` : r;
}

/** Shrink a font size until the text fits the width. */
function fit(ctx: CanvasRenderingContext2D, text: string, font: (px: number) => string, start: number, maxW: number, min = 20): number {
  let px = start;
  ctx.font = font(px);
  while (px > min && ctx.measureText(text).width > maxW) { px -= 2; ctx.font = font(px); }
  return px;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawFlag(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = "#012169"; ctx.fillRect(x, y, w, h);
  const diag = (lw: number, col: string) => {
    ctx.strokeStyle = col; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y + h); ctx.moveTo(x + w, y); ctx.lineTo(x, y + h); ctx.stroke();
  };
  diag(h * 0.2, "#FFFFFF"); diag(h * 0.08, "#C8102E");
  ctx.fillStyle = "#FFFFFF"; ctx.fillRect(x + w / 2 - h * 0.17, y, h * 0.34, h); ctx.fillRect(x, y + h / 2 - h * 0.17, w, h * 0.34);
  ctx.fillStyle = "#C8102E"; ctx.fillRect(x + w / 2 - h * 0.1, y, h * 0.2, h); ctx.fillRect(x, y + h / 2 - h * 0.1, w, h * 0.2);
  ctx.restore();
}

export async function loadCardFonts(): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  await Promise.all([
    document.fonts.load("700 120px Inter"), document.fonts.load("500 28px Inter"), document.fonts.load("600 56px Inter"),
    document.fonts.load("80px UKNumberPlate"),
  ].map((p) => p.catch(() => undefined)));
}

export function drawShareCard(ctx: CanvasRenderingContext2D, d: ShareCardData) {
  const W = CARD_W, H = CARD_H, pad = 72;
  // Background with the soft teal glow from the mock-up.
  ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, 0, 0, W / 2, 0, W * 0.75);
  glow.addColorStop(0, "rgba(0,214,200,0.16)"); glow.addColorStop(1, "rgba(0,214,200,0)");
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
  const glow2 = ctx.createRadialGradient(W / 2, H, 0, W / 2, H, W * 0.6);
  glow2.addColorStop(0, "rgba(0,214,200,0.07)"); glow2.addColorStop(1, "rgba(0,214,200,0)");
  ctx.fillStyle = glow2; ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = "alphabetic";

  // Wordmark "Valu8" (8 in italic teal).
  ctx.textAlign = "left";
  ctx.font = "600 56px Inter, sans-serif"; ctx.fillStyle = FG;
  ctx.fillText("Valu", pad, pad + 52);
  const vw = ctx.measureText("Valu").width;
  ctx.font = "italic 700 64px Inter, sans-serif"; ctx.fillStyle = TEAL;
  ctx.fillText("8", pad + vw + 2, pad + 52);

  // Number plate (plate-v2: yellow, black border, UK flag badge).
  const pw = 640, ph = 132, px = (W - pw) / 2, py = 300;
  ctx.save();
  ctx.shadowColor = "rgba(255,204,0,0.35)"; ctx.shadowBlur = 36; ctx.shadowOffsetY = 10;
  const pg = ctx.createLinearGradient(0, py, 0, py + ph);
  pg.addColorStop(0, "#FFE14A"); pg.addColorStop(1, PLATE);
  ctx.fillStyle = pg; roundRect(ctx, px, py, pw, ph, 12); ctx.fill();
  ctx.restore();
  ctx.lineWidth = 5; ctx.strokeStyle = "#111111"; roundRect(ctx, px + 2.5, py + 2.5, pw - 5, ph - 5, 11); ctx.stroke();
  drawFlag(ctx, px + 20, py + 26, 60, 30);
  ctx.fillStyle = "#1F4FD8"; ctx.font = "700 29px Inter, Arial, sans-serif"; ctx.textAlign = "center";
  ctx.fillText("UK", px + 50, py + 100);
  const reg = plateText(d.plate);
  ctx.fillStyle = "#111111";
  fit(ctx, reg, (s) => `${s}px UKNumberPlate, "Arial Narrow", sans-serif`, 84, pw - 150, 40);
  ctx.fillText(reg, px + 95 + (pw - 110) / 2, py + ph / 2 + 30);

  // Car + meta.
  ctx.textAlign = "center"; ctx.fillStyle = "#EDE9E4";
  fit(ctx, d.car, (s) => `700 ${s}px Inter, sans-serif`, 62, W - pad * 2, 32);
  ctx.fillText(d.car, W / 2, 560);
  if (d.meta) { ctx.fillStyle = MUTED; fit(ctx, d.meta, (s) => `400 ${s}px Inter, sans-serif`, 30, W - pad * 2, 20); ctx.fillText(d.meta, W / 2, 612); }

  // Value card.
  const cx = pad, cy = 680, cw = W - pad * 2, ch = 360;
  ctx.save();
  ctx.shadowColor = "rgba(0,214,200,0.25)"; ctx.shadowBlur = 60;
  const cg = ctx.createLinearGradient(0, cy, 0, cy + ch);
  cg.addColorStop(0, "#171717"); cg.addColorStop(1, "#121212");
  ctx.fillStyle = cg; roundRect(ctx, cx, cy, cw, ch, 28); ctx.fill();
  ctx.restore();
  ctx.lineWidth = 2; ctx.strokeStyle = "rgba(0,214,200,0.3)"; roundRect(ctx, cx, cy, cw, ch, 28); ctx.stroke();
  ctx.fillStyle = MUTED; ctx.font = "500 30px Inter, sans-serif";
  ctx.fillText("Estimated private sale value", W / 2, cy + 78);
  ctx.save();
  ctx.shadowColor = "rgba(0,214,200,0.35)"; ctx.shadowBlur = 24;
  ctx.fillStyle = TEAL;
  fit(ctx, d.value, (s) => `700 ${s}px Inter, sans-serif`, 140, cw - 80, 48);
  ctx.fillText(d.value, W / 2, cy + 225);
  ctx.restore();
  // Chips.
  const chips = ["DVSA MOT history", "Similar UK adverts"];
  ctx.font = "500 25px Inter, sans-serif";
  const cwid = chips.map((c) => ctx.measureText(c).width + 40);
  let chx = W / 2 - (cwid[0] + cwid[1] + 14) / 2;
  chips.forEach((c, i) => {
    ctx.fillStyle = "rgba(0,214,200,0.1)"; roundRect(ctx, chx, cy + 268, cwid[i], 50, 25); ctx.fill();
    ctx.strokeStyle = "rgba(0,214,200,0.3)"; ctx.lineWidth = 1.5; roundRect(ctx, chx, cy + 268, cwid[i], 50, 25); ctx.stroke();
    ctx.fillStyle = TEAL; ctx.textAlign = "center"; ctx.fillText(c, chx + cwid[i] / 2, cy + 302);
    chx += cwid[i] + 14;
  });

  // Footer.
  ctx.textAlign = "left"; ctx.fillStyle = MUTED; ctx.font = "400 30px Inter, sans-serif";
  ctx.fillText("What's yours worth? Free valuation", pad, H - pad - 6);
  ctx.textAlign = "right"; ctx.font = "700 46px Inter, sans-serif";
  const uk = ".uk"; const ukw = ctx.measureText(uk).width;
  ctx.fillStyle = TEAL; ctx.fillText(uk, W - pad, H - pad);
  ctx.fillStyle = FG; ctx.fillText("valu8", W - pad - ukw, H - pad);
}

/** Renders the card and returns a PNG blob (null if canvas is unavailable). */
export async function renderShareCard(d: ShareCardData): Promise<Blob | null> {
  if (typeof document === "undefined") return null;
  await loadCardFonts();
  const canvas = document.createElement("canvas");
  canvas.width = CARD_W; canvas.height = CARD_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  drawShareCard(ctx, d);
  return await new Promise<Blob | null>((res) => canvas.toBlob((b) => res(b), "image/png"));
}

export const shareFileName = (car: string) => `valu8-${car.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.png`;
