import type { ValuationReport } from "@/lib/valuation";
import { buildPdfFilename } from "@/lib/pdf";
import type { Intent } from "@/lib/intent";
import { askingFor } from "@/lib/intent";
import { normaliseReportPricing, displayPrivateRange } from "@/lib/askingPrice";
import { buyerGuide, compareAsking, diffLine, VERDICT_COPY, buyerChecks } from "@/lib/buyerGuide";

interface VehicleInfo { make: string; model: string; year: number; mileage: number; registration: string | null; created_at: string }
const INK: [number, number, number] = [17, 17, 17];
const PAPER: [number, number, number] = [247, 245, 243];
const TEAL: [number, number, number] = [0, 214, 200];
const gbp = (n?: number) => (typeof n === "number" && isFinite(n) ? `£${Math.round(n).toLocaleString("en-GB")}` : "-");

/** Set the largest font size (max..min) at which `text` fits `maxW` points with the current font. Exported for tests. */
export function fitFontSize(doc: { setFontSize: (n: number) => unknown; getTextWidth: (t: string) => number }, text: string, maxW: number, max: number, min: number): number {
  let size = max;
  doc.setFontSize(size);
  while (size > min && doc.getTextWidth(text) > maxW) { size = Math.max(min, size - 1); doc.setFontSize(size); }
  return size;
}

/** Premium 2-page A4 PDF (design: promo/report-premium-v1). Used only when showPremiumReport() is true. */
export async function downloadPremiumPdf(v: VehicleInfo, r: ValuationReport, opts: { intent?: Intent; valuationId?: string } = {}): Promise<void> {
  const buying = opts.intent === "buying";
  const p = normaliseReportPricing(r);
  const guide = buying ? buyerGuide({ privateSale: p.privateSale, privateLow: p.privateLow, privateHigh: p.privateHigh, tradeIn: p.tradeIn, retail: p.retail }, askingFor(opts.valuationId)) : null;
  const asking = buying ? askingFor(opts.valuationId) : null;
  const cmp = guide && asking ? compareAsking(asking, guide) : null;
  const { default: JsPDF } = await import("jspdf");
  const doc = new JsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), m = 40;
  const bg = () => { doc.setFillColor(...PAPER); doc.rect(0, 0, W, H, "F"); };
  const foot = () => { doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(120, 120, 120); doc.text(buying ? "Estimates and guidance only, not guaranteed prices or financial advice. Not a vehicle history check or inspection. valu8.uk" : "Guidance only, not financial advice. valu8.uk", m, H - 24); };
  const para = (t: string, y: number, w = W - 2 * m, size = 10) => { doc.setFontSize(size); const l = doc.splitTextToSize(t, w); doc.text(l, m, y); return y + l.length * size * 1.35; };
  const head = (t: string, y: number) => { doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(...INK); doc.text(t, m, y); doc.setFont("helvetica", "normal"); return y + 16; };
  const bullets = (l: string[] | undefined, y: number) => { doc.setTextColor(...INK); for (const b of (l ?? []).slice(0, 6)) y = para(`• ${b}`, y, W - 2 * m, 10); return y + 6; };

  bg();
  doc.setFont("helvetica", "bold"); doc.setFontSize(20); doc.setTextColor(...INK); doc.text("Valu", m, 50);
  doc.setTextColor(...TEAL); doc.setFont("helvetica", "bolditalic"); doc.text("8", m + doc.getTextWidth("Valu") + 0, 50);
  if (v.registration) { doc.setFillColor(255, 213, 0); doc.roundedRect(W - m - 110, 32, 110, 26, 3, 3, "F"); doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(...INK); doc.text(v.registration, W - m - 55, 50, { align: "center" }); }
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(90, 90, 90); doc.text(`${v.year} ${v.make} ${v.model} · ${v.mileage.toLocaleString("en-GB")} miles`, m, 72);

  const val = r.values; let y = 90;
  doc.setFillColor(...INK); doc.roundedRect(m, y, W - 2 * m, 130, 10, 10, "F");
  doc.setTextColor(200, 200, 200); doc.setFontSize(9); doc.text(buying ? "ESTIMATED FAIR PRICE · PRIVATE SALE" : "PRIVATE SALE VALUE", m + 20, y + 28);
  // One range everywhere: the Report page's headline range when it applies, else the comps band (see displayPrivateRange).
  const range = displayPrivateRange(r), conf = r.marketConfidence ? ` · ${r.marketConfidence} confidence` : "";
  const headline = !buying && range.headline ? range.text : gbp(val.privateSale);
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); fitFontSize(doc, headline, W - 2 * m - 40, 32, 14); doc.text(headline, m + 20, y + 64);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(200, 200, 200);
  if (!buying && range.headline) doc.text(`Realistic private sale ${gbp(range.mid)}${conf}`, m + 20, y + 84);
  else if (range.low > 0 && range.high > 0) doc.text(`${buying ? "Estimated range" : "Range"} ${range.text}${conf}`, m + 20, y + 84);
  const bx = m + 20, bw = W - 2 * m - 40, span = Math.max(1, val.dealerRetail - val.dealerTradeIn);
  doc.setFillColor(70, 70, 70); doc.rect(bx, y + 100, bw, 4, "F");
  doc.setFillColor(...TEAL); doc.circle(bx + bw * Math.min(1, Math.max(0, (val.privateSale - val.dealerTradeIn) / span)), y + 102, 6, "F");
  doc.setFontSize(8); doc.text(`Trade-in ${gbp(val.dealerTradeIn)}`, bx, y + 120); doc.text(`Retail ${gbp(val.dealerRetail)}`, bx + bw, y + 120, { align: "right" });
  y += 150;

  const cw = (W - 2 * m - 20) / 3;
  [["PART-EXCHANGE", val.dealerTradeIn, false], ["PRIVATE SALE", val.privateSale, true], ["DEALER RETAIL", val.dealerRetail, false]].forEach(([k, n, hl], i) => {
    const x = m + i * (cw + 10);
    if (hl) doc.setFillColor(...TEAL); else doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, y, cw, 56, 8, 8, "F");
    doc.setTextColor(...INK); doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.text(String(k), x + 12, y + 20);
    doc.setFont("helvetica", "bold"); fitFontSize(doc, gbp(n as number), cw - 24, 16, 8); doc.text(gbp(n as number), x + 12, y + 42);
  });
  y += 80;

  const comps = (r.comparableListings ?? []).slice(0, 6);
  if (comps.length) {
    y = head("Comparable UK adverts", y);
    doc.setFontSize(10);
    for (const c of comps) { doc.setFillColor(255, 255, 255); doc.rect(m, y - 11, W - 2 * m, 18, "F"); doc.setTextColor(...INK); doc.text(`${c.year} ${c.trim ?? ""}`.trim(), m + 8, y + 2); doc.text(`${(c.mileage ?? 0).toLocaleString("en-GB")} mi`, m + 260, y + 2); doc.setFont("helvetica", "bold"); doc.text(gbp(c.price), W - m - 8, y + 2, { align: "right" }); doc.setFont("helvetica", "normal"); y += 20; }
    y += 12;
  }
  const box = (title: string, body: string) => {
    doc.setFontSize(10); const l = doc.splitTextToSize(body, W - 2 * m - 32); const h = 34 + l.length * 13.5;
    doc.setFillColor(...INK); doc.roundedRect(m, y, W - 2 * m, h, 8, 8, "F");
    doc.setTextColor(...TEAL); doc.setFontSize(8); doc.text(title, m + 16, y + 18);
    doc.setTextColor(255, 255, 255); doc.setFontSize(10); doc.text(l, m + 16, y + 34); y += h + 10;
  };
  if (guide) {
    box("BUYING STRATEGY", `Estimated fair price ${gbp(guide.fairPrice)} (private sale). Suggested opening offer ${gbp(guide.openingOffer)}. Indicative negotiation range ${gbp(guide.rangeLow)} - ${gbp(guide.rangeHigh)}.${guide.dealerRetail ? ` From a dealer, expect prices nearer ${gbp(guide.dealerRetail)}.` : ""}`);
    if (cmp) box("ASKING PRICE CHECK", `Advertised at ${gbp(cmp.asking)}: ${VERDICT_COPY[cmp.verdict].label.toLowerCase()} (${diffLine(cmp).toLowerCase()}). ${VERDICT_COPY[cmp.verdict].tip}`);
    else box("ASKING PRICE CHECK", "Add the advertised asking price in your online report to see how it compares with this valuation.");
  } else {
    if (r.sellerTip) box("SELLER TIP", r.sellerTip);
    const buf = r.recommendations?.negotiationBuffer ?? r.negotiationBuffer;
    box("LISTING PLAN", `List at ${gbp(r.recommendations?.recommendedAskingPrice ?? r.recommendations?.listingPrice)}${buf ? `, leaving about ${gbp(buf)} to negotiate` : ""}.`);
  }
  foot();

  doc.addPage(); bg(); y = 56; doc.setTextColor(...INK);
  if (r.headline) { doc.setFont("helvetica", "bold"); y = para(r.headline, y, W - 2 * m, 14) + 6; doc.setFont("helvetica", "normal"); }
  y = head("Analysis", y); doc.setTextColor(...INK); y = para(r.honestAnalysis || "", y) + 8;
  if (r.marketContext) { y = head("Market context", y); y = para(r.marketContext, y) + 8; }
  if (r.marketConfidenceReason) { y = head("Confidence", y); y = para(r.marketConfidenceReason, y) + 8; }
  y = head("Strengths", y); y = bullets(r.strengths, y);
  y = head(buying ? "What to check" : "Watch points", y); y = bullets(buying ? buyerChecks(r.watchPoints) : r.watchPoints, y);
  if (r.motNotice) { y = head("MOT", y); y = para(r.motNotice, y) + 8; }
  if (buying) {
    y = head("Before you buy", y);
    bullets(["Check the V5C logbook matches the seller and the car.", "Check the service history supports the mileage on the MOT record.", "Check for outstanding safety recalls on GOV.UK.", "Use the MOT advisories and anything you spot on the viewing to support your offer."], y);
  } else {
    y = head("Documents to have ready", y); y = bullets(r.recommendations?.documents, y);
    y = head("Where to sell", y); bullets(r.recommendations?.whereToSell, y);
  }
  foot();
  doc.save(buildPdfFilename(v).replace(/\.pdf$/i, "") + (buying ? "-premium-buying.pdf" : "-premium.pdf"));
}
