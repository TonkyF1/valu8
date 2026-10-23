import { vehicleTitle } from "../../supabase/functions/_shared/vehicle-text";
// Branded 1200x630 share image for a report, drawn client-side on a canvas.
// (Per-report OG tags for link previews need server rendering, which this SPA host
// doesn't provide; this gives users an image they can post or send instead.)
import type { ValuationReport } from "@/lib/valuation";

const gbp = (n: number) => `£${Math.round(n).toLocaleString("en-GB")}`;

export function drawShareCard(v: { year: number; make: string; model: string; mileage: number }, r: ValuationReport): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 1200; c.height = 630;
  const g = c.getContext("2d");
  if (!g) throw new Error("Canvas unsupported");
  const bg = g.createLinearGradient(0, 0, 1200, 630);
  bg.addColorStop(0, "#0b0b0d"); bg.addColorStop(1, "#13201f");
  g.fillStyle = bg; g.fillRect(0, 0, 1200, 630);
  g.fillStyle = "#00d4c8"; g.fillRect(0, 0, 1200, 8);
  g.font = "600 30px system-ui, -apple-system, Segoe UI, sans-serif"; g.fillText("VALU8", 72, 92);
  g.fillStyle = "#ffffff"; g.font = "700 60px system-ui, -apple-system, Segoe UI, sans-serif";
  g.fillText(vehicleTitle({ year: v.year, make: v.make, model: v.model, engineCapacity: (r as any)?.vehicle?.engineCapacity, fuelType: (r as any)?.vehicle?.fuelType }).slice(0, 32), 72, 200);
  g.fillStyle = "#a1a1aa"; g.font = "400 30px system-ui, -apple-system, Segoe UI, sans-serif";
  g.fillText(`${v.mileage.toLocaleString("en-GB")} miles`, 72, 250);
  if (!r.valuationUnavailable && r.values) {
    const tiers: [string, number][] = [["Part-exchange", r.values.dealerTradeIn], ["Private sale", r.values.privateSale], ["Dealer retail", r.values.dealerRetail]];
    tiers.forEach(([label, val], i) => {
      const x = 72 + i * 360, y = 330, hi = i === 1;
      g.fillStyle = hi ? "rgba(0,212,200,0.16)" : "rgba(255,255,255,0.05)";
      g.strokeStyle = hi ? "#00d4c8" : "rgba(255,255,255,0.15)"; g.lineWidth = 2;
      g.beginPath(); g.roundRect?.(x, y, 330, 160, 20); if (!g.roundRect) g.rect(x, y, 330, 160); g.fill(); g.stroke();
      g.fillStyle = "#a1a1aa"; g.font = "500 26px system-ui, sans-serif"; g.fillText(label, x + 28, y + 52);
      g.fillStyle = hi ? "#00d4c8" : "#ffffff"; g.font = "700 54px system-ui, sans-serif"; g.fillText(gbp(val), x + 28, y + 122);
    });
  } else {
    g.fillStyle = "#ffffff"; g.font = "600 40px system-ui, sans-serif"; g.fillText("Specialist appraisal recommended", 72, 400);
  }
  g.fillStyle = "#71717a"; g.font = "400 22px system-ui, sans-serif";
  g.fillText("Estimate based on live UK listings, DVSA MOT history and photos · valu8.uk", 72, 570);
  return c;
}

export async function shareReportImage(v: Parameters<typeof drawShareCard>[0], r: ValuationReport, url: string): Promise<"shared" | "downloaded"> {
  const canvas = drawShareCard(v, r);
  const blob: Blob = await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("toBlob failed"))), "image/png"));
  const name = `Valu8_${v.make}_${v.model}_${v.year}.png`.replace(/\s+/g, "-");
  const file = new File([blob], name, { type: "image/png" });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try { await nav.share({ files: [file], title: `${vehicleTitle({ year: v.year, make: v.make, model: v.model })} — Valu8`, url }); return "shared"; } catch { /* fall back */ }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  return "downloaded";
}
