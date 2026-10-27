// Valu8 — email content builders (report-ready + follow-ups). Pure apart from token signing, so previews and
// email-dispatch render exactly the same thing. Prices are read-only: the report email shows the same coherent
// figures the report page shows (normaliseReportPricing mirror); nothing here changes pricing.
import { renderEmail, makeAnswerToken, answerUrl, gbp, miles, ukDate, SITE } from "./email.ts";
import { coherentPricing } from "./coherentPricing.ts";

export const carTitle = (v: { registration?: string | null; make: string; model: string }) =>
  v.registration?.trim() ? v.registration.trim().toUpperCase() : `${v.make} ${v.model}`;
const carName = (v: { year?: number | null; make: string; model: string; variant?: string | null }) =>
  [v.year, v.make, v.model, v.variant].filter((x) => x !== null && x !== undefined && String(x).trim() !== "").join(" ");
const carLine = (v: any, extra?: string | null) =>
  [carName(v), Number(v.mileage) > 0 ? miles(Number(v.mileage)) : null, extra].filter(Boolean).join(" · ");

/** Same as src/lib/askingPrice.ts normaliseReportPricing, so the email never disagrees with the report page. */
export function reportPricing(r: any) {
  const cp = coherentPricing({
    privateSale: Number(r?.values?.privateSale) || 0,
    tradeIn: Number(r?.values?.dealerTradeIn) || null,
    retail: Number(r?.values?.dealerRetail) || null,
    privateLow: r?.valueRange?.privateSaleLow ?? null,
    privateHigh: r?.valueRange?.privateSaleHigh ?? null,
    buffer: r?.negotiationBuffer || r?.recommendations?.negotiationBuffer || null,
  });
  const privateLow = Math.min(cp.privateLow, cp.privateSale);
  const privateHigh = Math.max(cp.privateHigh, cp.privateSale);
  const tradeIn = cp.tradeIn >= privateLow ? Math.max(0, privateLow - 50) : cp.tradeIn;
  return { ...cp, privateLow, privateHigh, tradeIn };
}

export function motFact(report: any, motExpiry?: string | null, now = Date.now()): string | null {
  const latest = Array.isArray(report?.motHistory) ? report.motHistory[0] : null;
  const expiry = latest?.expiryDate ?? motExpiry ?? null;
  const d = expiry ? ukDate(expiry) : null;
  const parts: string[] = [];
  if (d) parts.push(new Date(expiry).getTime() < now ? `MOT expired ${d}` : `MOT valid to ${d}`);
  if (latest && Array.isArray(latest.advisories)) {
    const n = latest.advisories.length;
    parts.push(n === 0 ? "no advisories at last test" : `${n} advisor${n === 1 ? "y" : "ies"} at last test`);
  }
  if (!parts.length) return null;
  const s = parts.join(", ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function conditionFact(report: any, photoUrls: unknown): string | null {
  const hasPhotos = Array.isArray(photoUrls) && photoUrls.length > 0;
  const score = Number(report?.conditionScore);
  if (!hasPhotos || !(score > 0 && score <= 10)) return null;
  return `Photo condition ${Math.round(score * 10) / 10}/10`;
}

export function buildReportEmail(kind: "valuation" | "advert", item: any, unsubscribe: string) {
  const name = carTitle(item);
  const subject = `Your Valu8 report for ${name} is ready`;
  if (kind === "valuation") {
    const r = item.report ?? {};
    const hasCoherent = Number(r?.values?.privateSale) > 0;
    const pr = hasCoherent ? reportPricing(r) : null;
    const price = pr ? pr.privateSale : Number(item.private_value) || 0;
    const low = pr ? pr.privateLow : Number(r?.valueRange?.privateSaleLow) || 0;
    const high = pr ? pr.privateHigh : Number(r?.valueRange?.privateSaleHigh) || 0;
    const stats = [
      ...(pr && pr.tradeIn > 0 ? [{ label: "Part-ex", value: gbp(pr.tradeIn) }] : []),
      ...(pr && pr.retail > 0 ? [{ label: "Dealer", value: gbp(pr.retail) }] : []),
    ];
    const { html, text } = renderEmail({
      preview: `${name}: ${gbp(price)} realistic private sale${low > 0 && high > 0 ? `, range ${gbp(low)}–${gbp(high)}` : ""}.`,
      heading: `Your report for ${name} is ready`,
      carLine: carLine(item),
      price: { label: "Realistic private sale", value: gbp(price), sub: low > 0 && high > 0 ? `Range ${gbp(low)} – ${gbp(high)}` : null },
      stats,
      facts: [motFact(r, item.mot_expiry), conditionFact(r, item.photo_urls)].filter(Boolean) as string[],
      buttons: [{ label: "View your full report", url: `${SITE}/valuation/${item.id}`, primary: true }],
      note: "Your report is saved in your Valu8 account.",
      unsubscribe,
    });
    return { subject, html, text };
  }
  const low = Number(item.estimate_dealer_low) || 0, high = Number(item.estimate_dealer_high) || 0;
  const { html, text } = renderEmail({
    preview: `Fair private price ${gbp(item.estimate_private)} vs asking ${gbp(item.asking_price)}.`,
    heading: `Your advert check for ${name} is ready`,
    carLine: carLine(item),
    price: { label: "Fair private price", value: gbp(item.estimate_private), sub: item.asking_price > 0 ? `Advertised at ${gbp(item.asking_price)}` : null },
    stats: low > 0 && high > 0 ? [{ label: "Dealer range", value: `${gbp(low)} – ${gbp(high)}` }] : [],
    buttons: [{ label: "View your check", url: `${SITE}/dashboard`, primary: true }],
    note: "Your check is saved in your Valu8 account.",
    unsubscribe,
  });
  return { subject, html, text };
}

export async function buildFollowupEmail(kind: "advert" | "valuation", item: any, unsubscribe: string) {
  if (kind === "advert") {
    const name = carName(item);
    const yesUrl = `${SITE}${item.user_id ? "/dashboard" : "/check"}`;
    const [still, no] = await Promise.all([
      makeAnswerToken({ k: "advert", i: item.id, a: "still_looking" }),
      makeAnswerToken({ k: "advert", i: item.id, a: "not_bought" }),
    ]);
    const { html, text } = renderEmail({
      preview: "One tap tells us how it went.",
      heading: `Did you buy the ${name}?`,
      carLine: carLine(item, item.asking_price > 0 ? `advertised at ${gbp(item.asking_price)}` : null),
      lines: ["You checked this car on Valu8. One tap tells us how it went — and what you paid helps keep every Valu8 price honest."],
      buttons: [
        { label: "Yes, I bought it", url: yesUrl, primary: true },
        { label: "Still looking", url: answerUrl(still) },
        { label: "Didn't buy it", url: answerUrl(no) },
      ],
      note: "“Yes” opens a quick form for the price you paid. “Still looking” and we'll check back in two weeks.",
      unsubscribe,
    });
    return { subject: `Did you buy the ${name}? What did you pay?`, html, text };
  }
  const name = carTitle(item);
  const cardUrl = `${SITE}/valuation/${item.id}#sale-feedback`;
  const notYet = await makeAnswerToken({ k: "valuation", i: item.id, a: "not_sold" });
  const { html, text } = renderEmail({
    preview: "One tap tells us how it went.",
    heading: `Did you sell or part-ex your ${name}?`,
    carLine: carLine(item),
    lines: ["You valued this car on Valu8. If it's gone, what you got helps keep every Valu8 valuation honest."],
    buttons: [
      { label: "Sold it", url: cardUrl, primary: true },
      { label: "Part-exchanged", url: cardUrl },
      { label: "Not sold yet", url: answerUrl(notYet) },
    ],
    note: "“Sold it” or “Part-exchanged” opens a quick form for the price. “Not sold yet” and we'll check back in two weeks.",
    unsubscribe,
  });
  return { subject: `Did you sell or part-ex your ${name}? What did you get?`, html, text };
}
