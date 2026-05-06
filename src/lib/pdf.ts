import jsPDF from "jspdf";
import type { ValuationReport } from "@/lib/valuation";
import { format } from "date-fns";

interface VehicleInfo {
  make: string; model: string; year: number; mileage: number;
  registration: string | null; created_at: string;
}

const TEAL: [number, number, number] = [0, 212, 200];
const DARK: [number, number, number] = [17, 17, 17];
const MUTED: [number, number, number] = [120, 120, 130];

export function downloadValuationPdf(v: VehicleInfo, r: ValuationReport) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  let y = margin;

  const ensureSpace = (need: number) => {
    if (y + need > pageH - margin) { doc.addPage(); y = margin; }
  };

  // Header band
  doc.setFillColor(...DARK);
  doc.rect(0, 0, pageW, 90, "F");
  doc.setTextColor(...TEAL);
  doc.setFont("helvetica", "bold"); doc.setFontSize(10);
  doc.text("VALU8 — VALUATION REPORT", margin, 38);
  doc.setTextColor(255, 255, 255); doc.setFontSize(20);
  doc.text(`${v.year} ${v.make} ${v.model}`, margin, 64);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(200, 200, 200);
  const meta = [`${v.mileage.toLocaleString()} miles`, v.registration, `Generated ${format(new Date(v.created_at), "d MMM yyyy")}`].filter(Boolean).join("  •  ");
  doc.text(meta, margin, 82);
  y = 120;

  // Condition + values
  doc.setTextColor(...DARK); doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text("CONDITION", margin, y);
  doc.setFontSize(28); doc.setTextColor(...TEAL);
  doc.text(`${r.conditionScore.toFixed(1)}/10`, margin, y + 30);
  doc.setFontSize(11); doc.setTextColor(...MUTED); doc.setFont("helvetica", "normal");
  doc.text(r.conditionLabel, margin, y + 46);

  // Three value tiers
  const tiers = [
    { label: "Dealer Trade-in", value: r.values.dealerTradeIn },
    { label: "Private Sale (Best)", value: r.values.privateSale, highlight: true },
    { label: "Dealer Retail", value: r.values.dealerRetail },
  ];
  const tierW = 150;
  const tierStart = pageW - margin - tierW * 3 - 20;
  tiers.forEach((t, i) => {
    const x = tierStart + i * (tierW + 10);
    if (t.highlight) {
      doc.setFillColor(...TEAL); doc.rect(x, y - 4, tierW, 60, "F");
      doc.setTextColor(...DARK);
    } else {
      doc.setDrawColor(220, 220, 225); doc.setLineWidth(0.5);
      doc.rect(x, y - 4, tierW, 60);
      doc.setTextColor(...MUTED);
    }
    doc.setFont("helvetica", "bold"); doc.setFontSize(8);
    doc.text(t.label.toUpperCase(), x + 10, y + 12);
    doc.setFontSize(18); doc.setTextColor(t.highlight ? 17 : 17, t.highlight ? 17 : 17, t.highlight ? 17 : 17);
    doc.text(`£${t.value.toLocaleString()}`, x + 10, y + 38);
  });
  y += 90;

  // Honest analysis
  y = section(doc, "HONEST ANALYSIS", y, margin, pageW);
  y = wrappedText(doc, r.honestAnalysis, margin, y, pageW - margin * 2, 11, 14);
  y += 10;

  if (r.photoObservations) {
    y = section(doc, "FROM YOUR PHOTOS", y, margin, pageW);
    y = wrappedText(doc, r.photoObservations, margin, y, pageW - margin * 2, 10, 13, MUTED);
    y += 10;
  }

  ensureSpace(80);
  y = section(doc, "MARKET POSITIONING", y, margin, pageW);
  y = wrappedText(doc, r.marketPositioning, margin, y, pageW - margin * 2, 11, 14);
  y += 10;

  // Strengths / watch points (2 col)
  ensureSpace(120);
  const colW = (pageW - margin * 2 - 20) / 2;
  const startY = y;
  y = section(doc, "STRENGTHS", y, margin, pageW);
  let yL = y;
  r.strengths.forEach(s => { yL = bullet(doc, s, margin, yL, colW, TEAL); });
  let yR = section(doc, "WATCH POINTS", startY, margin + colW + 20, pageW, true);
  r.watchPoints.forEach(s => { yR = bullet(doc, s, margin + colW + 20, yR, colW, [245, 158, 11]); });
  y = Math.max(yL, yR) + 10;

  // Recommendations
  ensureSpace(120);
  y = section(doc, "SELLER RECOMMENDATIONS", y, margin, pageW);
  doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(...MUTED);
  doc.text("RECOMMENDED LISTING PRICE", margin, y);
  doc.setFontSize(20); doc.setTextColor(...TEAL);
  doc.text(`£${r.recommendations.listingPrice.toLocaleString()}`, margin, y + 22);
  y += 36;
  y = subsection(doc, "Where to sell", y, margin);
  r.recommendations.whereToSell.forEach(s => { y = bullet(doc, s, margin, y, pageW - margin * 2, TEAL); });
  ensureSpace(60);
  y = subsection(doc, "What to highlight", y + 4, margin);
  r.recommendations.highlights.forEach(s => { y = bullet(doc, s, margin, y, pageW - margin * 2, TEAL); });
  ensureSpace(60);
  y = subsection(doc, "Documents to prepare", y + 4, margin);
  r.recommendations.documents.forEach(s => { y = bullet(doc, s, margin, y, pageW - margin * 2, TEAL); });
  y += 10;

  // HPI
  ensureSpace(80);
  y = section(doc, `HPI CHECK — ${r.hpi.status.toUpperCase()}`, y, margin, pageW);
  r.hpi.checks.forEach(c => { y = bullet(doc, c.label, margin, y, pageW - margin * 2, TEAL); });
  y += 10;

  // MOT
  if (r.motHistory.length > 0) {
    ensureSpace(60);
    y = section(doc, "MOT HISTORY", y, margin, pageW);
    r.motHistory.forEach(m => {
      ensureSpace(28);
      doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(...DARK);
      doc.text(format(new Date(m.date), "d MMM yyyy"), margin, y);
      const color: [number, number, number] = m.result === "Pass" ? TEAL : m.result === "Advisory" ? [245, 158, 11] : [220, 38, 38];
      doc.setTextColor(...color);
      doc.text(m.result, margin + 100, y);
      doc.setTextColor(...MUTED); doc.setFont("helvetica", "normal");
      doc.text(`${m.mileage.toLocaleString()} mi`, pageW - margin - 80, y);
      y += 13;
      y = wrappedText(doc, m.note, margin, y, pageW - margin * 2, 9, 12, MUTED);
      y += 6;
    });
  }

  // Footer disclaimer on each page
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8); doc.setTextColor(...MUTED); doc.setFont("helvetica", "normal");
    doc.text("AI-generated estimate. Not financial advice. valu8.app", margin, pageH - 20);
    doc.text(`${i} / ${pages}`, pageW - margin, pageH - 20, { align: "right" });
  }

  doc.save(`Valu8-${v.year}-${v.make}-${v.model}.pdf`.replace(/\s+/g, "-"));
}

function section(doc: jsPDF, title: string, y: number, x: number, pageW: number, inline = false) {
  doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(...TEAL);
  doc.text(title, x, y);
  if (!inline) {
    doc.setDrawColor(...TEAL); doc.setLineWidth(0.8);
    doc.line(x, y + 4, pageW - 48, y + 4);
  }
  return y + 18;
}
function subsection(doc: jsPDF, title: string, y: number, x: number) {
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...DARK);
  doc.text(title.toUpperCase(), x, y);
  return y + 14;
}
function wrappedText(doc: jsPDF, text: string, x: number, y: number, w: number, size: number, lh: number, color: [number, number, number] = DARK) {
  doc.setFont("helvetica", "normal"); doc.setFontSize(size); doc.setTextColor(...color);
  const lines = doc.splitTextToSize(text, w);
  lines.forEach((line: string) => { doc.text(line, x, y); y += lh; });
  return y;
}
function bullet(doc: jsPDF, text: string, x: number, y: number, w: number, color: [number, number, number]) {
  doc.setFillColor(...color);
  doc.circle(x + 3, y - 3, 1.8, "F");
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...DARK);
  const lines = doc.splitTextToSize(text, w - 16);
  lines.forEach((line: string, i: number) => { doc.text(line, x + 12, y + i * 13); });
  return y + lines.length * 13 + 2;
}
