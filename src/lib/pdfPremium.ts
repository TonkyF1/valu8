import type { ValuationReport } from "@/lib/valuation";
import { buildPdfFilename } from "@/lib/pdf";

interface VehicleInfo { make: string; model: string; year: number; mileage: number; registration: string | null; created_at: string }
const INK: [number, number, number] = [17, 17, 17];
const PAPER: [number, number, number] = [247, 245, 243];
const TEAL: [number, number, number] = [0, 214, 200];
const gbp = (n?: number) => (typeof n === "number" && isFinite(n) ? `£${Math.round(n).toLocaleString("en-GB")}` : "-");

/** Premium 2-page A4 PDF (design: promo/report-premium-v1). Used only when showPremiumReport() is true. */
export async function downloadPremiumPdf(v: VehicleInfo, r: ValuationReport): Promise<void> {
  const { default: JsPDF } = await import("jspdf");
  const doc = new JsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), m = 40;
  const bg = () => { doc.setFillColor(...PAPER); doc.rect(0, 0, W, H, "F"); };
  const foot = () => { doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(120, 120, 120); doc.text("Guidance only, not financial advice. valu8.uk", m, H - 24); };
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
  doc.setTextColor(200, 200, 200); doc.setFontSize(9); doc.text("PRIVATE SALE VALUE", m + 20, y + 28);
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(32); doc.text(gbp(val.privateSale), m + 20, y + 64);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(200, 200, 200);
  if (r.valueRange) doc.text(`Range ${gbp(r.valueRange.privateSaleLow)} - ${gbp(r.valueRange.privateSaleHigh)}${r.marketConfidence ? ` · ${r.marketConfidence} confidence` : ""}`, m + 20, y + 84);
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
    doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.text(gbp(n as number), x + 12, y + 42);
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
  if (r.sellerTip) box("SELLER TIP", r.sellerTip);
  const buf = r.recommendations?.negotiationBuffer ?? r.negotiationBuffer;
  box("LISTING PLAN", `List at ${gbp(r.recommendations?.recommendedAskingPrice ?? r.recommendations?.listingPrice)}${buf ? `, leaving about ${gbp(buf)} to negotiate` : ""}.`);
  foot();

  doc.addPage(); bg(); y = 56; doc.setTextColor(...INK);
  if (r.headline) { doc.setFont("helvetica", "bold"); y = para(r.headline, y, W - 2 * m, 14) + 6; doc.setFont("helvetica", "normal"); }
  y = head("Analysis", y); doc.setTextColor(...INK); y = para(r.honestAnalysis || "", y) + 8;
  if (r.marketContext) { y = head("Market context", y); y = para(r.marketContext, y) + 8; }
  if (r.marketConfidenceReason) { y = head("Confidence", y); y = para(r.marketConfidenceReason, y) + 8; }
  y = head("Strengths", y); y = bullets(r.strengths, y);
  y = head("Watch points", y); y = bullets(r.watchPoints, y);
  if (r.motNotice) { y = head("MOT", y); y = para(r.motNotice, y) + 8; }
  y = head("Documents to have ready", y); y = bullets(r.recommendations?.documents, y);
  y = head("Where to sell", y); bullets(r.recommendations?.whereToSell, y);
  foot();
  doc.save(buildPdfFilename(v).replace(/\.pdf$/i, "") + "-premium.pdf");
}
