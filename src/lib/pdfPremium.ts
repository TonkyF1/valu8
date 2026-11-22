import type { ValuationReport } from "@/lib/valuation";
import { buildPdfFilename } from "@/lib/pdf";
import type { Intent } from "@/lib/intent";
import { askingFor } from "@/lib/intent";
import { normaliseReportPricing, displayPrivateRange } from "@/lib/askingPrice";
import { buyerGuide, compareAsking, diffLine, VERDICT_COPY, buyerChecks } from "@/lib/buyerGuide";
import { reportRef, sellerPlan } from "@/lib/premiumPlan";
import { analyseMileage, estimateUlez, estimateVed, summariseAdvisoryCosts } from "../../supabase/functions/_shared/insights";

interface VehicleInfo { id?: string; make: string; model: string; year: number; mileage: number; registration: string | null; created_at: string; photo_urls?: string[] }
type RGB = [number, number, number];
const INK: RGB = [17, 17, 17];
const NIGHT: RGB = [11, 11, 11];
const PAPER: RGB = [250, 249, 247];
const MUTED: RGB = [96, 96, 96];
const LINE: RGB = [226, 224, 220];
const TEAL: RGB = [0, 214, 200];
const AMBER: RGB = [180, 110, 0];
const gbp = (n?: number | null) => (typeof n === "number" && isFinite(n) && n > 0 ? `£${Math.round(n).toLocaleString("en-GB")}` : "-");
const pct = (n: number) => `${n > 0 ? "+" : n < 0 ? "-" : ""}${Math.abs(Math.round(n * 10) / 10)}%`;
const ukDate = (d: string | Date) => { const x = typeof d === "string" ? new Date(d) : d; return isNaN(x.getTime()) ? String(d) : x.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); };

/** Set the largest font size (max..min) at which `text` fits `maxW` points with the current font. Exported for tests. */
export function fitFontSize(doc: { setFontSize: (n: number) => unknown; getTextWidth: (t: string) => number }, text: string, maxW: number, max: number, min: number): number {
  let size = max;
  doc.setFontSize(size);
  while (size > min && doc.getTextWidth(text) > maxW) { size = Math.max(min, size - 1); doc.setFontSize(size); }
  return size;
}

/** Fetches an image as a data URL for the PDF; null on any failure or after `ms`. */
async function imageData(url: string, ms = 4000): Promise<string | null> {
  try {
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), ms);
    const res = await fetch(url, { signal: ctrl.signal }); clearTimeout(t);
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!/^image\/(jpe?g|png)/.test(blob.type)) return null;
    return await new Promise((ok) => { const fr = new FileReader(); fr.onload = () => ok(String(fr.result)); fr.onerror = () => ok(null); fr.readAsDataURL(blob); });
  } catch { return null; }
}

export interface PremiumPdfOpts {
  intent?: Intent; valuationId?: string;
  /** "What moved your price" rows, as shown on the report page. */
  movers?: { label: string; pct?: number | null }[];
  confidence?: string | null;
  issuedAt?: Date;
}

/** Premium Report PDF: a certificate-style A4 document. Used only when showPremiumReport() is true. */
export async function downloadPremiumPdf(v: VehicleInfo, r: ValuationReport, opts: PremiumPdfOpts = {}): Promise<void> {
  const buying = opts.intent === "buying";
  const p = normaliseReportPricing(r);
  const range = displayPrivateRange(r);
  const plan = sellerPlan(r);
  const asking = buying ? askingFor(opts.valuationId) : null;
  const guide = buying ? buyerGuide({ privateSale: p.privateSale, privateLow: p.privateLow, privateHigh: p.privateHigh, tradeIn: p.tradeIn, retail: p.retail }, asking) : null;
  const cmp = guide && asking ? compareAsking(asking, guide) : null;
  const ref = reportRef(v.id ?? opts.valuationId ?? "00000000");
  const issued = ukDate(opts.issuedAt ?? v.created_at);
  const conf = opts.confidence ?? r.marketConfidence ?? null;
  const { default: JsPDF } = await import("jspdf");
  const doc = new JsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), m = 40, cw = W - 2 * m;

  const font = (style: "normal" | "bold", size: number, c: RGB = INK) => { doc.setFont("helvetica", style); doc.setFontSize(size); doc.setTextColor(...c); };
  const page = () => {
    doc.setFillColor(...PAPER); doc.rect(0, 0, W, H, "F");
    doc.setFillColor(...NIGHT); doc.rect(0, 0, W, 64, "F");
    font("bold", 20, [255, 255, 255]); doc.text("Valu", m, 40);
    doc.setTextColor(...TEAL); doc.setFont("helvetica", "bolditalic"); doc.text("8", m + doc.getTextWidth("Valu"), 40);
    font("bold", 8, TEAL); doc.text("PREMIUM REPORT", W - m, 30, { align: "right" });
    font("normal", 8, [200, 200, 200]); doc.text(`Ref ${ref} · Valued ${issued}`, W - m, 44, { align: "right" });
  };
  const head = (t: string, y: number) => { font("bold", 8, MUTED); doc.text(t.toUpperCase(), m, y); doc.setDrawColor(...LINE); doc.setLineWidth(0.6); doc.line(m, y + 6, W - m, y + 6); return y + 22; };
  const para = (t: string, y: number, w = cw, size = 9.5, c: RGB = INK) => { font("normal", size, c); const l = doc.splitTextToSize(t, w); doc.text(l, m, y); return y + l.length * size * 1.35; };
  const need = (y: number, h: number) => { if (y + h <= H - 60) return y; doc.addPage(); page(); return 92; };

  // ---- Page 1: car, price, plan, reasons, comps
  page();
  let y = 98;
  font("bold", 18); doc.text(`${v.year} ${v.make} ${v.model}`.replace(/\s+/g, " ").trim(), m, y);
  if (v.registration) { doc.setFillColor(255, 213, 0); doc.roundedRect(W - m - 104, y - 17, 104, 24, 3, 3, "F"); font("bold", 13); doc.text(v.registration.toUpperCase(), W - m - 52, y, { align: "center" }); }
  const facts = [`${v.mileage.toLocaleString("en-GB")} miles`, r.vehicle?.fuelType, r.vehicle?.engineCapacity ? `${r.vehicle.engineCapacity.toLocaleString("en-GB")} cc` : null, r.vehicle?.firstRegistered ? `First registered ${ukDate(r.vehicle.firstRegistered)}` : null].filter(Boolean).join(" · ");
  font("normal", 9.5, MUTED); doc.text(facts, m, y + 18);
  y += 40;

  // Price block: the precise figure first, the range second.
  doc.setFillColor(...NIGHT); doc.roundedRect(m, y, cw, 150, 10, 10, "F");
  font("bold", 8, [190, 190, 190]); doc.text(buying ? "FAIR PRICE · PRIVATE SALE" : "PRIVATE SALE VALUE", m + 22, y + 28);
  const figure = gbp(p.privateSale);
  doc.setFont("helvetica", "normal"); doc.setTextColor(255, 255, 255); fitFontSize(doc, figure, cw - 44, 46, 22); doc.text(figure, m + 22, y + 72);
  if (buying) { font("normal", 9.5, [215, 215, 215]); doc.text(`Estimated range ${range.text}${conf ? ` · ${conf} confidence` : ""}`, m + 22, y + 94); }
  else {
    font("normal", 9.5, [190, 190, 190]); doc.text("Likely range", m + 22, y + 94);
    const lw = doc.getTextWidth("Likely range ");
    font("bold", 9.5, [255, 255, 255]); doc.text(range.text, m + 22 + lw, y + 94);
    if (conf) { const rw = doc.getTextWidth(range.text); font("normal", 9.5, [190, 190, 190]); doc.text(` · ${conf} confidence`, m + 22 + lw + rw, y + 94); }
  }
  const bx = m + 22, bw = cw - 44, span = Math.max(1, p.retail - p.tradeIn);
  doc.setFillColor(70, 70, 70); doc.rect(bx, y + 112, bw, 3, "F");
  doc.setFillColor(...TEAL); doc.circle(bx + bw * Math.min(1, Math.max(0, (p.privateSale - p.tradeIn) / span)), y + 113.5, 5, "F");
  font("normal", 8, [190, 190, 190]); doc.text(`Part-exchange ${gbp(p.tradeIn)}`, bx, y + 132); doc.text(`Dealer retail ${gbp(p.retail)}`, bx + bw, y + 132, { align: "right" });
  y += 172;

  // Plan tiles
  const tile = (x: number, w: number, label: string, value: string, accent: boolean) => {
    if (accent) { doc.setFillColor(224, 250, 247); doc.setDrawColor(...TEAL); } else { doc.setFillColor(255, 255, 255); doc.setDrawColor(...LINE); }
    doc.setLineWidth(0.8); doc.roundedRect(x, y, w, 58, 8, 8, "FD");
    font("bold", 7.5, accent ? [0, 120, 112] : MUTED); doc.text(label.toUpperCase(), x + 14, y + 20);
    doc.setFont("helvetica", "bold"); doc.setTextColor(...INK); fitFontSize(doc, value, w - 28, 20, 10); doc.text(value, x + 14, y + 44);
  };
  y = head(buying ? "Your buying plan" : "Your selling plan", y);
  const tw = (cw - 12) / 2;
  if (buying && guide) {
    tile(m, tw, "Opening offer", gbp(guide.openingOffer), true);
    tile(m + tw + 12, tw, "Aim to agree", `${gbp(guide.rangeLow)} – ${gbp(guide.rangeHigh)}`, false);
    y += 74;
    y = para(cmp ? `Advertised at ${gbp(cmp.asking)}: ${VERDICT_COPY[cmp.verdict].label.toLowerCase()} (${diffLine(cmp).toLowerCase()}). ${VERDICT_COPY[cmp.verdict].tip}` : "Add the advertised asking price in your online report to see how it compares.", y);
  } else {
    tile(m, tw, "Advertise at", gbp(plan.advertise), true);
    tile(m + tw + 12, tw, "Lowest offer to accept", gbp(plan.lowest), false);
    y += 74;
    y = para(`Advertise at the higher figure, leaving about ${gbp(plan.room)} to negotiate. Hold firm on anything at or above your lowest offer.`, y);
  }
  y += 10;

  // What moved the price
  const movers = (opts.movers ?? []).slice(0, 6);
  if (movers.length) {
    y = head("What moved your price", y);
    for (const mv of movers) {
      font("normal", 9.5); doc.text(doc.splitTextToSize(mv.label, cw - 70)[0], m, y);
      if (mv.pct != null) { font("bold", 9.5, mv.pct < 0 ? AMBER : [0, 140, 130]); doc.text(pct(mv.pct), W - m, y, { align: "right" }); }
      y += 15;
    }
    y += 8;
  }

  // Comparable adverts
  const comps = (r.comparableListings ?? []).filter((c) => c && c.price > 0).slice(0, 8);
  if (comps.length) {
    y = need(y, 40 + comps.length * 17);
    y = head(`UK adverts we compared (${comps.length})`, y);
    font("bold", 7.5, MUTED); doc.text("CAR", m, y); doc.text("MILES", m + 300, y); doc.text("ASKING", W - m, y, { align: "right" }); y += 13;
    for (const c of comps) {
      font("normal", 9.5); doc.text(`${c.year} ${c.trim ?? ""}`.trim().slice(0, 48), m, y);
      doc.text(c.mileage ? c.mileage.toLocaleString("en-GB") : "-", m + 300, y);
      font("bold", 9.5); doc.text(gbp(c.price), W - m, y, { align: "right" });
      doc.setDrawColor(...LINE); doc.setLineWidth(0.4); doc.line(m, y + 5, W - m, y + 5);
      y += 17;
    }
    font("normal", 8, MUTED); doc.text("Advertised prices. Cars usually sell for a little less than they're advertised at.", m, y + 4);
  }

  // ---- Page 2: MOT, mileage, tax/ULEZ, photos, checklist
  doc.addPage(); page(); y = 92;
  const mot = r.motSource === "dvsa" ? r.motHistory ?? [] : [];
  y = head("MOT history (DVSA)", y);
  if (mot.length) {
    font("bold", 7.5, MUTED); doc.text("DATE", m, y); doc.text("RESULT", m + 110, y); doc.text("MILEAGE", m + 190, y); doc.text("ADVISORIES / FAILURES", m + 290, y); y += 13;
    for (const t of mot.slice(0, 10)) {
      font("normal", 9.5); doc.text(ukDate(t.date), m, y);
      font("bold", 9.5, t.result === "Fail" ? AMBER : INK); doc.text(t.result === "Fail" ? "Fail" : "Pass", m + 110, y);
      font("normal", 9.5); doc.text(t.mileage > 0 ? t.mileage.toLocaleString("en-GB") : "-", m + 190, y);
      doc.text(`${t.advisories?.length ?? 0} / ${t.failures?.length ?? 0}`, m + 290, y);
      doc.setDrawColor(...LINE); doc.setLineWidth(0.4); doc.line(m, y + 5, W - m, y + 5);
      y += 16;
    }
    const exp = mot[0]?.expiryDate;
    if (exp) { y += 4; y = para(`MOT ${new Date(exp) < new Date() ? "expired" : "valid until"} ${ukDate(exp)}.`, y, cw, 9.5, new Date(exp) < new Date() ? AMBER : INK); }
    const costs = summariseAdvisoryCosts(mot[0]?.advisories ?? []);
    if (costs.items.length) {
      y += 6; font("bold", 9.5); doc.text(`Latest advisories${costs.high > 0 ? ` · indicative repairs ${gbp(costs.low)} – ${gbp(costs.high)}` : ""}`, m, y); y += 14;
      for (const it of costs.items.slice(0, 6)) {
        font("normal", 8.5, MUTED); const l = doc.splitTextToSize(it.text, cw - 110); doc.text(l, m, y);
        font("bold", 8.5); doc.text(it.band ? `${gbp(it.band.low)} – ${gbp(it.band.high)}` : "-", W - m, y, { align: "right" }); y += l.length * 11 + 3;
      }
    }
  } else y = para(r.motNotice || "No MOT records yet (cars under 3 years old have none).", y);
  y += 12;

  const mil = analyseMileage(mot.map((t) => ({ date: t.date, mileage: t.mileage })), v.mileage);
  const ved = estimateVed({ firstRegistered: r.vehicle?.firstRegistered, year: v.year, fuelType: r.vehicle?.fuelType, co2: r.vehicle?.co2Emissions, engineCc: r.vehicle?.engineCapacity });
  const ulez = estimateUlez({ fuelType: r.vehicle?.fuelType, year: v.year, firstRegistered: r.vehicle?.firstRegistered, euroStatus: r.vehicle?.euroStatus });
  y = need(y, 90);
  y = head("Mileage, tax and ULEZ", y);
  const third = (cw - 20) / 3;
  const cell = (i: number, label: string, value: string, note: string) => {
    const x = m + i * (third + 10);
    font("bold", 7.5, MUTED); doc.text(label.toUpperCase(), x, y);
    font("bold", 12); doc.text(value, x, y + 17);
    font("normal", 8, MUTED); doc.text(doc.splitTextToSize(note, third - 4).slice(0, 3), x, y + 30);
  };
  cell(0, "Mileage check", mil.status === "warning" ? "Check mileage" : mil.status === "ok" ? "Consistent" : "Not enough data", mil.avgMilesPerYear != null ? `About ${mil.avgMilesPerYear.toLocaleString("en-GB")} miles a year between MOTs.` : "Mileage readings from the MOT record.");
  cell(1, "Tax (VED)", ved.annual != null ? `${gbp(ved.annual)} a year` : "Can't estimate", "Estimate from DVLA details. Check GOV.UK.");
  cell(2, "ULEZ", ulez.status === "likely_compliant" ? "Likely compliant" : ulez.status === "likely_non_compliant" ? "Likely non-compliant" : "Check required", "Estimate. Check the TfL vehicle checker.");
  y += 70;

  // Photo thumbnails (best effort: skipped if images can't be fetched).
  const photoUrls = (v.photo_urls ?? []).slice(0, 4);
  if (photoUrls.length) {
    const imgs = (await Promise.all(photoUrls.map((u) => imageData(u)))).filter((x): x is string => !!x);
    if (imgs.length) {
      y = need(y, 120);
      y = head(`Photos${r.conditionLabel ? ` · condition ${r.conditionLabel}${r.conditionScore ? ` (${r.conditionScore}/10)` : ""}` : ""}`, y);
      const tw4 = (cw - 30) / 4, th = tw4 * 0.75;
      imgs.forEach((d, i) => { try { doc.addImage(d, d.startsWith("data:image/png") ? "PNG" : "JPEG", m + i * (tw4 + 10), y - 6, tw4, th); } catch { /* skip a bad image */ } });
      y += th + 14;
    }
  }

  y = need(y, 120);
  y = head(buying ? "Before you buy" : "Before you sell", y);
  const list = buying
    ? [...buyerChecks(r.watchPoints), "Check the V5C logbook matches the seller and the car.", "Check the service history supports the mileage on the MOT record.", "Check for outstanding safety recalls on GOV.UK."]
    : [...(r.recommendations?.highlights ?? []).slice(0, 3).map((h) => `Highlight: ${h}`), ...(r.recommendations?.documents ?? []).slice(0, 4).map((d) => `Have ready: ${d}`)];
  for (const b of list.slice(0, 8)) { y = need(y, 14); y = para(`•  ${b}`, y, cw, 9.5); }

  // Footer on every page
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setDrawColor(...LINE); doc.setLineWidth(0.6); doc.line(m, H - 44, W - m, H - 44);
    font("normal", 7.5, MUTED);
    doc.text(`Valu8 Premium Report · Ref ${ref} · valu8.uk`, m, H - 30);
    doc.text(`Page ${i} of ${n}`, W - m, H - 30, { align: "right" });
    doc.text(buying ? "Estimates and guidance only, not guaranteed prices or financial advice. Not a vehicle history check or inspection." : "Guidance only, not a guaranteed sale price or financial advice. Not a vehicle history check or inspection.", m, H - 19);
  }
  doc.save(buildPdfFilename(v).replace(/\.pdf$/i, "") + (buying ? "-premium-buying.pdf" : "-premium.pdf"));
}
