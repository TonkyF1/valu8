import type { ValuationReport } from "@/lib/valuation";

const gbp = (n?: number) => (typeof n === "number" && isFinite(n) ? `£${Math.round(n).toLocaleString("en-GB")}` : "—");

/** Premium report summary (design: promo/report-premium-v1). Rendered only when showPremiumReport() is true. */
export function PremiumReport({ r, registration }: { r: ValuationReport; registration?: string | null }) {
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
