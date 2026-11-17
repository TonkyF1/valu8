import { useEffect, useMemo, useState } from "react";
import type { ValuationReport } from "@/lib/valuation";
import type { Intent } from "@/lib/intent";
import { askingFor, saveAskingFor } from "@/lib/intent";
import { normaliseReportPricing } from "@/lib/askingPrice";
import { buyerGuide, compareAsking, diffLine, parseAsking, VERDICT_COPY } from "@/lib/buyerGuide";

const gbp = (n?: number) => (typeof n === "number" && isFinite(n) ? `£${Math.round(n).toLocaleString("en-GB")}` : "–");

/** Premium report summary (design: promo/report-premium-v1). Rendered only when showPremiumReport() is true. */
export function PremiumReport({ r, registration, intent = "selling", valuationId }: { r: ValuationReport; registration?: string | null; intent?: Intent; valuationId?: string }) {
  if (intent === "buying") return <BuyerPremiumReport r={r} registration={registration} valuationId={valuationId} />;
  const v = r.values;
  const lo = r.valueRange?.privateSaleLow, hi = r.valueRange?.privateSaleHigh;
  const span = Math.max(1, v.dealerRetail - v.dealerTradeIn);
  const pos = Math.min(100, Math.max(0, ((v.privateSale - v.dealerTradeIn) / span) * 100));
  const tiers = [
    { k: "Part-exchange", n: v.dealerTradeIn, hl: false },
    { k: "Private sale", n: v.privateSale, hl: true },
    { k: "Dealer retail", n: v.dealerRetail, hl: false },
  ];
  const comps = (r.comparableListings ?? []).slice(0, 6);
  return (
    <section data-testid="premium-report" className="mb-6 rounded-2xl overflow-hidden border border-[#111111]/10 bg-[#F7F5F3] font-[Inter,sans-serif] text-[#111111]">
      <div className="flex items-center justify-between px-5 py-3">
        <span className="font-bold text-lg">Valu<span className="italic text-[#00D6C8]">8</span> <span className="text-xs font-medium opacity-60 ml-1">Premium report</span></span>
        {registration && <span className="rounded bg-[#FFD500] px-2 py-0.5 font-bold tracking-wider text-sm">{registration}</span>}
      </div>
      <div className="bg-[#111111] text-white px-5 py-6">
        <p className="text-xs uppercase tracking-widest opacity-60">Private sale value</p>
        <p className="text-4xl font-bold mt-1">{gbp(v.privateSale)}</p>
        {lo && hi ? <p className="text-sm opacity-70 mt-1">Range {gbp(lo)} – {gbp(hi)}{r.marketConfidence ? ` · ${r.marketConfidence} confidence` : ""}</p> : null}
        <div className="mt-4 h-1.5 rounded-full bg-white/15 relative">
          <div className="absolute -top-1 h-3.5 w-3.5 rounded-full bg-[#00D6C8]" style={{ left: `calc(${pos}% - 7px)` }} />
        </div>
        <div className="flex justify-between text-[11px] opacity-60 mt-2"><span>Trade-in {gbp(v.dealerTradeIn)}</span><span>Retail {gbp(v.dealerRetail)}</span></div>
      </div>
      <div className="grid grid-cols-3 gap-3 p-5">
        {tiers.map((t) => (
          <div key={t.k} className={`rounded-xl p-3 ${t.hl ? "bg-[#00D6C8] text-[#111111]" : "bg-white"}`}>
            <p className="text-[11px] uppercase tracking-wide opacity-70">{t.k}</p>
            <p className="text-lg font-bold">{gbp(t.n)}</p>
          </div>
        ))}
      </div>
      {comps.length > 0 && (
        <div className="px-5 pb-4">
          <p className="text-sm font-semibold mb-2">Comparable UK adverts</p>
          <table className="w-full text-sm bg-white rounded-xl overflow-hidden">
            <tbody>
              {comps.map((c, i) => (
                <tr key={i} className="border-t border-[#111111]/5 first:border-0">
                  <td className="px-3 py-2">{c.year} {c.trim ?? ""}</td>
                  <td className="px-3 py-2 opacity-70">{c.mileage?.toLocaleString("en-GB")} mi</td>
                  <td className="px-3 py-2 text-right font-semibold">{gbp(c.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="grid sm:grid-cols-2 gap-3 px-5 pb-5">
        {r.sellerTip && <div className="rounded-xl bg-[#111111] text-white p-4"><p className="text-xs uppercase tracking-widest text-[#00D6C8]">Seller tip</p><p className="text-sm mt-1">{r.sellerTip}</p></div>}
        <div className="rounded-xl bg-[#111111] text-white p-4">
          <p className="text-xs uppercase tracking-widest text-[#00D6C8]">Listing plan</p>
          <p className="text-sm mt-1">List at {gbp(r.recommendations?.recommendedAskingPrice ?? r.recommendations?.listingPrice)}{(r.recommendations?.negotiationBuffer ?? r.negotiationBuffer) ? `, leaving about ${gbp(r.recommendations?.negotiationBuffer ?? r.negotiationBuffer)} to negotiate` : ""}.</p>
        </div>
      </div>
      <p className="px-5 pb-4 text-[11px] opacity-60">Guidance only, not financial advice.</p>
    </section>
  );
}

/** Buyer inputs from the report's own coherent figures (same numbers the seller view shows). */
export function buyerInputsFor(r: ValuationReport) {
  const p = normaliseReportPricing(r);
  return { privateSale: p.privateSale, privateLow: p.privateLow, privateHigh: p.privateHigh, tradeIn: p.tradeIn, retail: p.retail };
}

/** Buying view of the paid report: fair price, opening offer, negotiation range and the asking-price check. */
function BuyerPremiumReport({ r, registration, valuationId }: { r: ValuationReport; registration?: string | null; valuationId?: string }) {
  const [askText, setAskText] = useState(() => { const a = askingFor(valuationId); return a ? a.toLocaleString("en-GB") : ""; });
  const asking = parseAsking(askText);
  useEffect(() => { saveAskingFor(valuationId, asking); }, [valuationId, asking]);
  const g = useMemo(() => buyerGuide(buyerInputsFor(r), asking), [r, asking]);
  const c = g && asking ? compareAsking(asking, g) : null;
  const comps = (r.comparableListings ?? []).slice(0, 6);
  if (!g) return null;
  const lo = Math.min(g.rangeLow, g.privateLow) * 0.92;
  const hi = Math.max(asking ?? 0, g.dealerRetail ?? 0, g.rangeHigh) * 1.04;
  const at = (n: number) => `${Math.min(100, Math.max(0, ((n - lo) / (hi - lo)) * 100))}%`;
  const checks = (r.watchPoints ?? []).slice(0, 5);
  return (
    <section data-testid="premium-report-buying" className="mb-6 rounded-2xl overflow-hidden border border-[#111111]/10 bg-[#F7F5F3] font-[Inter,sans-serif] text-[#111111]">
      <div className="flex items-center justify-between px-5 py-3">
        <span className="font-bold text-lg">Valu<span className="italic text-[#00D6C8]">8</span> <span className="text-xs font-medium opacity-60 ml-1">Premium report · Buying</span></span>
        {registration && <span className="rounded bg-[#FFD500] px-2 py-0.5 font-bold tracking-wider text-sm">{registration}</span>}
      </div>
      <div className="bg-[#111111] text-white px-5 py-6">
        <p className="text-xs uppercase tracking-widest opacity-60">Estimated fair price · private sale</p>
        <p className="mt-1 text-[44px] leading-none tracking-tight" style={{ fontFamily: "Sora, Inter, sans-serif", fontWeight: 200 }}>{gbp(g.fairPrice)}</p>
        <p className="text-sm opacity-70 mt-2">Estimated range {gbp(g.privateLow)} – {gbp(g.privateHigh)}{r.marketConfidence ? ` · ${r.marketConfidence} confidence` : ""}</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-xl p-3" style={{ background: "rgba(0,214,200,.12)", border: "1px solid rgba(0,214,200,.4)" }}>
            <p className="text-[11px] uppercase tracking-wide text-[#1AFFF0]">Suggested opening offer</p>
            <p className="text-[17px] font-semibold mt-1 tabular-nums">{gbp(g.openingOffer)}</p>
          </div>
          <div className="rounded-xl p-3 border border-white/15">
            <p className="text-[11px] uppercase tracking-wide opacity-70">Negotiation range</p>
            <p className="text-[17px] font-semibold mt-1 tabular-nums leading-snug"><span className="whitespace-nowrap">{gbp(g.rangeLow)} –</span> <span className="whitespace-nowrap">{gbp(g.rangeHigh)}</span></p>
          </div>
        </div>
        {g.dealerRetail ? <p className="text-xs opacity-60 mt-3">Buying from a dealer? Typical dealer retail for this car is around {gbp(g.dealerRetail)}, so expect less room to negotiate.</p> : null}
      </div>

      <div className="px-5 pt-5">
        <label htmlFor="pr-asking" className="text-sm font-semibold">Advertised asking price</label>
        <div className="mt-2 flex items-center gap-2 rounded-xl bg-white border border-[#111111]/10 px-3 focus-within:border-[#00D6C8]">
          <span className="opacity-60">£</span>
          <input id="pr-asking" data-testid="report-asking" inputMode="numeric" placeholder="e.g. 8,495" value={askText}
            onChange={(e) => setAskText(e.target.value.replace(/[^\d,]/g, ""))}
            className="min-h-[46px] w-full bg-transparent text-base outline-none tabular-nums" />
        </div>
        <p className="text-xs opacity-60 mt-1.5">Optional. Add the price from the advert to see how it compares with this valuation.</p>
        {c && (
          <div className="mt-3 rounded-xl bg-[#111111] text-white p-4" data-testid="asking-compare">
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex h-6 shrink-0 items-center whitespace-nowrap rounded-full px-2.5 text-xs font-semibold" style={c.verdict === "in_line" ? { color: "#1AFFF0", background: "rgba(0,214,200,.1)", border: "1px solid rgba(0,214,200,.35)" } : { color: "#FDE047", background: "rgba(253,224,71,.08)", border: "1px solid rgba(253,224,71,.35)" }}>{VERDICT_COPY[c.verdict].label}</span>
              <span className="text-xs opacity-70 text-right">{diffLine(c)}</span>
            </div>
            <div className="relative h-2 rounded-full bg-white/15 mt-8 mb-7 mx-1" aria-hidden>
              <div className="absolute inset-y-0 rounded-full" style={{ left: at(g.rangeLow), width: `calc(${at(g.rangeHigh)} - ${at(g.rangeLow)})`, background: "linear-gradient(90deg,#00D6C8,#1AFFF0)", boxShadow: "0 0 12px rgba(26,255,240,.5)" }} />
              <div className="absolute -top-1.5 h-5 w-[3px] rounded bg-[#FDE047] transition-[left] duration-500" style={{ left: at(c.asking) }}>
                <span className="absolute bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-semibold text-[#FDE047]">Asking {gbp(c.asking)}</span>
              </div>
              <span className="absolute top-4 -translate-x-1/2 text-[10.5px] opacity-60 whitespace-nowrap" style={{ left: at(g.rangeLow) }}>{gbp(g.rangeLow)}</span>
              <span className="absolute top-4 -translate-x-1/2 text-[10.5px] opacity-60 whitespace-nowrap" style={{ left: at(g.rangeHigh) }}>{gbp(g.rangeHigh)}</span>
            </div>
            <p className="text-sm opacity-85">{VERDICT_COPY[c.verdict].tip}</p>
          </div>
        )}
      </div>

      {comps.length > 0 && (
        <div className="px-5 pt-5">
          <p className="text-sm font-semibold mb-2">Comparable UK adverts</p>
          <table className="w-full text-sm bg-white rounded-xl overflow-hidden">
            <tbody>
              {comps.map((cmp, i) => (
                <tr key={i} className="border-t border-[#111111]/5 first:border-0">
                  <td className="px-3 py-2">{cmp.year} {cmp.trim ?? ""}</td>
                  <td className="px-3 py-2 opacity-70">{cmp.mileage?.toLocaleString("en-GB")} mi</td>
                  <td className="px-3 py-2 text-right font-semibold">{gbp(cmp.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="grid sm:grid-cols-2 gap-3 px-5 pt-5 pb-5">
        <div className="rounded-xl bg-[#111111] text-white p-4">
          <p className="text-xs uppercase tracking-widest text-[#00D6C8]">Negotiation plan</p>
          <p className="text-sm mt-1">Open at {gbp(g.openingOffer)} and aim to agree within {gbp(g.rangeLow)} – {gbp(g.rangeHigh)}. Use the MOT advisories and anything you spot on the viewing to support your offer.</p>
        </div>
        <div className="rounded-xl bg-[#111111] text-white p-4">
          <p className="text-xs uppercase tracking-widest text-[#00D6C8]">What to check</p>
          {checks.length ? <ul className="text-sm mt-1 space-y-1">{checks.map((w) => <li key={w}>• {w}</li>)}</ul>
            : <p className="text-sm mt-1">Check the V5C logbook matches the seller and the car, and that the service history supports the mileage.</p>}
        </div>
      </div>
      <p className="px-5 pb-4 text-[11px] opacity-60">Estimates and guidance only, not guaranteed prices or financial advice. This is not a vehicle history check or a mechanical inspection.</p>
    </section>
  );
}
