import { vehicleTitle } from "../../supabase/functions/_shared/vehicle-text";
import { reportPriceRange, formatPriceRange } from "../../supabase/functions/_shared/cheapRange";
import { groupMotByYear, motYearSummary } from "@/lib/motGroups";
import { normaliseReportPricing } from "@/lib/askingPrice";
import type jsPDF from "jspdf";
import type { ValuationReport } from "@/lib/valuation";
import { format } from "date-fns";
import { explainValuation } from "@/lib/valuationExplainer";
import { cleanReportText } from "@/lib/reportText";

interface VehicleInfo {
  make: string; model: string; year: number; mileage: number;
  registration: string | null; created_at: string;
  photo_urls?: unknown;
}

const TEAL: [number, number, number] = [0, 212, 200];
const DARK: [number, number, number] = [17, 17, 17];
const MUTED: [number, number, number] = [120, 120, 130];

function sanitize(s: string) {
  return (s || "").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");
}

export function buildPdfFilename(v: VehicleInfo) {
  const date = format(new Date(), "dd-MM-yyyy");
  return `Valu8_${sanitize(v.make)}_${sanitize(v.model)}_${v.year}_${date}.pdf`;
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);
}

export async function downloadValuationPdf(v: VehicleInfo, r: ValuationReport, opts: { shareUrl?: string } = {}): Promise<void> {
  // Loaded on demand (download click) so jspdf stays out of the report bundle.
  const { default: JsPDF } = await import("jspdf");
  const doc = new JsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  let y = margin;
  const valuationUnavailable = !!r.valuationUnavailable;
  const isLiveListings = r.pricingSource === "marketcheck" || (!r.pricingSource && !!(r as any).marketBaseline);
  const isOwnComps = (r.pricingSource as string) === "valu8_comps";
  const isEstimate = !isLiveListings && !isOwnComps;
  const sourceLabel = isLiveListings ? "MarketCheck UK live listings" : isOwnComps ? "Comparable UK adverts (Valu8 data)" : "AI market estimate (live listings unavailable)";
  const limitedData = valuationUnavailable && isEstimate && !r.rareCarWarning;

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
  doc.text(vehicleTitle({ year: v.year, make: v.make, model: v.model, engineCapacity: (r as any)?.vehicle?.engineCapacity, fuelType: (r as any)?.vehicle?.fuelType }), margin, 64);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(200, 200, 200);
  const meta = [`${v.mileage.toLocaleString()} miles`, v.registration, `Generated ${format(new Date(v.created_at), "d MMM yyyy")}`].filter(Boolean).join("  •  ");
  doc.text(meta, margin, 82);
  y = 120;

  // Three value tiers (full-width row), then condition beneath so they never overlap
  if (!valuationUnavailable) {
    const tiers = [
      { label: "Dealer Trade-in", value: normaliseReportPricing(r).tradeIn },
      { label: "Private Sale (Best)", value: normaliseReportPricing(r).privateSale, highlight: true },
      { label: "Dealer Retail", value: normaliseReportPricing(r).retail },
    ];
    const tierW = (pageW - margin * 2 - 20) / 3;
    const tierStart = margin;
    tiers.forEach((t, i) => {
      const x = tierStart + i * (tierW + 10);
      if (t.highlight) {
        doc.setFillColor(...TEAL); doc.rect(x, y, tierW, 60, "F");
        doc.setTextColor(...DARK);
      } else {
        doc.setDrawColor(220, 220, 225); doc.setLineWidth(0.5);
        doc.rect(x, y, tierW, 60);
        doc.setTextColor(...MUTED);
      }
      doc.setFont("helvetica", "bold"); doc.setFontSize(8);
      doc.text(t.label.toUpperCase(), x + 10, y + 16);
      doc.setTextColor(t.highlight ? 17 : 17, t.highlight ? 17 : 17, t.highlight ? 17 : 17);
      // Under £5,000 the private sale tier is a range (see cheapRange.ts)
      const pr = t.highlight ? reportPriceRange(r, t.value) : null;
      doc.setFontSize(pr ? 13 : 18);
      doc.text(pr ? formatPriceRange(pr) : `£${t.value.toLocaleString()}`, x + 10, y + 42);
    });
    y += 84;
  }
  doc.setTextColor(...DARK); doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text(valuationUnavailable ? "VALUATION STATUS" : "CONDITION", margin, y);
  if (valuationUnavailable) {
    doc.setFontSize(22); doc.setTextColor(...DARK);
    doc.text(limitedData ? "Limited data for this car" : "Unable to value accurately", margin, y + 30);
    doc.setFontSize(11); doc.setTextColor(...MUTED); doc.setFont("helvetica", "normal");
    doc.text(limitedData ? "Live listings unavailable, try again later" : "Specialist appraisal recommended", margin, y + 46);
  } else {
    if (Array.isArray(v.photo_urls) && v.photo_urls.filter(Boolean).length > 0) {
      doc.setFontSize(28); doc.setTextColor(...TEAL);
      doc.text(`${r.conditionScore.toFixed(1)}/10`, margin, y + 30);
      doc.setFontSize(11); doc.setTextColor(...MUTED); doc.setFont("helvetica", "normal");
      doc.text(r.conditionLabel, margin, y + 46);
    } else {
      doc.setFontSize(14); doc.setTextColor(...DARK);
      doc.text("Not scored", margin, y + 26);
      doc.setFontSize(11); doc.setTextColor(...MUTED); doc.setFont("helvetica", "normal");
      doc.text("Add photos for a condition score", margin, y + 44);
    }
  }

  y += valuationUnavailable ? 90 : 72;

  if (valuationUnavailable) {
    y = wrappedText(doc, r.valueReasoning || r.honestAnalysis, margin, y, pageW - margin * 2, 10, 14, MUTED);
    y += 8;
  } else {
    if (isEstimate) {
      ensureSpace(40);
      doc.setFillColor(255, 243, 205); doc.rect(margin, y - 14, pageW - margin * 2, 30, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(120, 80, 0);
      doc.text("ESTIMATE", margin + 8, y + 4);
      doc.setFont("helvetica", "normal");
      doc.text("AI market estimate: live listings were unavailable for this car, so treat this as a guide.", margin + 62, y + 4);
      y += 34;
    }
  }
  if (!valuationUnavailable && (r.valueRange || r.valueReasoning)) {
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...MUTED);
    const cheap = reportPriceRange(r, normaliseReportPricing(r).privateSale);
    const low = cheap?.low ?? r.valueRange?.privateSaleLow ?? r.values.privateSale;
    const high = cheap?.high ?? r.valueRange?.privateSaleHigh ?? r.values.privateSale;
    doc.text(`PRIVATE SALE RANGE  £${low.toLocaleString()} – £${high.toLocaleString()}${r.marketConfidence ? `  •  ${r.marketConfidence.toUpperCase()} CONFIDENCE` : ""}`, margin, y - 8);
    if (r.valueReasoning) {
      y = wrappedText(doc, r.valueReasoning, margin, y + 8, pageW - margin * 2, 9, 12, MUTED);
      y += 6;
    }
  }

  // How we valued it (transparency)
  const ex = explainValuation(r, { year: v.year, mileage: v.mileage });
  if (ex) {
    ensureSpace(120);
    y = section(doc, "HOW WE VALUED YOUR CAR", y, margin, pageW);
    ex.steps.forEach((st) => {
      ensureSpace(50);
      y = subsection(doc, st.title, y, margin);
      y = wrappedText(doc, st.body, margin, y, pageW - margin * 2, 9, 12, MUTED);
      y += 4;
    });
    if (ex.comps.length) {
      ensureSpace(40);
      y = subsection(doc, "Example comparables (dealer asking price -> corrected to your car)", y + 2, margin);
      ex.comps.forEach((c) => {
        ensureSpace(20);
        y = bullet(doc, `${c.year}, ${c.mileage.toLocaleString("en-GB")} mi${c.trim ? `, ${c.trim}` : ""}: £${c.price.toLocaleString("en-GB")} -> £${c.adjustedPrice.toLocaleString("en-GB")}. ${c.why}.`, margin, y, pageW - margin * 2, TEAL);
      });
    }
    if (ex.adjustments.length) {
      ensureSpace(40);
      y = subsection(doc, "Adjustments for your car", y + 2, margin);
      ex.adjustments.forEach((a) => { ensureSpace(18); y = bullet(doc, a.plain, margin, y, pageW - margin * 2, TEAL); });
    }
    y += 10;
  }

  // Honest analysis
  y = section(doc, "HONEST ANALYSIS", y, margin, pageW);
  y = wrappedText(doc, r.honestAnalysis, margin, y, pageW - margin * 2, 11, 14);
  y += 10;

  if (r.photoObservations) {
    y = section(doc, "FROM YOUR PHOTOS", y, margin, pageW);
    y = wrappedText(doc, r.photoObservations, margin, y, pageW - margin * 2, 10, 13, MUTED);
    y += 10;
  }

  if (!valuationUnavailable) {
    ensureSpace(80);
    y = section(doc, "MARKET POSITIONING", y, margin, pageW);
    y = wrappedText(doc, r.marketPositioning, margin, y, pageW - margin * 2, 11, 14);
    y += 10;
  }

  // Strengths / watch points (2 col)
  if (!valuationUnavailable) {
    ensureSpace(120);
    const colW = (pageW - margin * 2 - 20) / 2;
    const startY = y;
    y = section(doc, "STRENGTHS", y, margin, pageW);
    let yL = y;
    r.strengths.forEach(s => { yL = bullet(doc, s, margin, yL, colW, TEAL); });
    let yR = section(doc, "WATCH POINTS", startY, margin + colW + 20, pageW, true);
    r.watchPoints.forEach(s => { yR = bullet(doc, s, margin + colW + 20, yR, colW, [245, 158, 11]); });
    y = Math.max(yL, yR) + 10;
  }

  // Recommendations
  if (!valuationUnavailable) {
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
  }


  // MOT
  if (r.motHistory.length > 0) {
    ensureSpace(60);
    y = section(doc, "MOT HISTORY", y, margin, pageW);
    groupMotByYear(r.motHistory).forEach(g => {
      ensureSpace(40);
      doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(...DARK);
      (doc.splitTextToSize(motYearSummary(g), pageW - margin * 2) as string[]).forEach(line => { doc.text(line, margin, y); y += 13; });
      y += 2;
      g.tests.forEach(m => {
        ensureSpace(28);
        doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...DARK);
        doc.text(format(new Date(m.date), "d MMM yyyy"), margin + 10, y);
        const color: [number, number, number] = m.result === "Fail" ? [220, 38, 38] : TEAL;
        doc.setTextColor(...color); doc.setFont("helvetica", "bold");
        doc.text(m.result === "Fail" ? "Fail" : "Pass", margin + 110, y);
        doc.setTextColor(...MUTED); doc.setFont("helvetica", "normal");
        doc.text(`${m.mileage.toLocaleString()} mi`, pageW - margin - 80, y);
        y += 12;
        if (m.note) y = wrappedText(doc, m.note, margin + 10, y, pageW - margin * 2 - 10, 9, 12, MUTED);
        y += 4;
      });
      y += 6;
    });
  }

  // Footer disclaimer on each page
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8); doc.setTextColor(...MUTED); doc.setFont("helvetica", "normal");
    doc.text(`Sources: ${sourceLabel}, DVSA MOT history. Not financial advice.  valu8.uk`, margin, pageH - 20);
    doc.text(`${i} / ${pages}`, pageW - margin, pageH - 20, { align: "right" });
  }

  if (opts.shareUrl) {
    doc.setPage(1);
    doc.setFontSize(9); doc.setTextColor(...TEAL); doc.setFont("helvetica", "normal");
    doc.textWithLink("View this report online", pageW - margin, 82, { url: opts.shareUrl, align: "right" } as never);
  }

  const filename = buildPdfFilename(v);
  const blob = doc.output("blob");

  // Native Capacitor (iOS/Android): open in a new window so the OS share sheet appears.
  try {
    const cap: any = (window as any).Capacitor;
    if (cap?.isNativePlatform?.()) {
      const dataUri = doc.output("dataurlstring");
      window.open(dataUri, "_blank");
      return;
    }
  } catch {
    /* fall through */
  }

  triggerBlobDownload(blob, filename);
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
