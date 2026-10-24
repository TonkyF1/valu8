# Lovable prompt — accuracy round 2 (DRAFT, NOT SENT — needs Tony's approval)

Please pull the latest main from GitHub first. It adds `_shared/motSignals.ts`, `_shared/aiAnchor.ts`, `_shared/ensemble.ts`, `_shared/priceModelBody.ts`
and a `resolveBody` export in `_shared/priceModel.ts` (all unit-tested). Do not edit those `_shared` files. Make ONLY the changes below.
Do NOT change any displayed price, trade/retail/range, ledger or `engineVersion` (it stays "v2.2-ledger"). Do NOT touch `PREMIUM_ENFORCED`,
pricing/Stripe code, MarketCheck settings or the own-comps/AI-cap logic. Do not add a deno.lock.

## 1. Frontend — src/pages/NewValuation.tsx
- Add `bodyStyle?: string;` and `firstRegistered?: string;` to the lookup result type (next to `engineCapacity?: number`) if missing.
- In the `supabase.functions.invoke("analyse-vehicle", { body: { ... } })` call, next to `engineCapacity: lookup?.engineCapacity || undefined`, add
  `bodyStyle: lookup?.bodyStyle || undefined,` and `firstRegistered: lookup?.firstRegistered || undefined,`. No UI changes.

## 2. analyse-vehicle/index.ts (then deploy analyse-vehicle)
a) Imports:
```ts
import { motSignals, motAdjustment } from "../_shared/motSignals.ts";
import { similarAdverts, anchorPrice, anchorBlock, anchorDeviation, anchorArm, DEVIATION_REASON_PROPERTY } from "../_shared/aiAnchor.ts";
import { ensemble } from "../_shared/ensemble.ts";
```
b) `AnalyseRequest`: add `bodyStyle?: string; firstRegistered?: string;`.

c) PRE-AI shadow figures — insert right AFTER `pricedMiles` is computed and BEFORE `userContent` is built, inside one try/catch that never
throws (on any error leave everything null):
```ts
let preAi: { pm: any; motAdj: any; pmWithMot: number | null; ocBase: any; similar: any[] } | null = null;
try {
  const pmIn = {
    make: body.make, model: body.model, variant: body.variant ?? null, year: body.year, mileage: pricedMiles,
    fuel: body.fuelType ?? null, gearbox: body.transmission ?? null, body: body.bodyStyle ?? null,
    engine_cc: Number(body.engineCapacity ?? (body.guestSave?.vehicle as any)?.engineCapacity) || null,
    desc: [body.serviceNotes, body.modifications].filter(Boolean).join(" ") || null,
  };
  const pm = pricePmBoth(pmIn);
  const motAdj = motAdjustment(motSignals(motEntries, { year: body.year }), pm.private.price);
  const ocBase = valueWithOwnComps({   // NO conditionScore/photoInsights: neutral base, computable before the AI
    make: body.make, model: body.model, variant: body.variant, year: body.year, mileage: pricedMiles,
    fuel: body.fuelType, gearbox: body.transmission, adText: body.variant, currentYear: CURRENT_YEAR,
  });
  const similar = similarAdverts({ make: body.make, model: body.model, variant: body.variant, year: body.year, mileage: pricedMiles,
    fuel: body.fuelType, gearbox: body.transmission }, 5);
  preAi = { pm, motAdj, pmWithMot: Math.round(pm.private.price * motAdj.factor / 50) * 50, ocBase, similar };
} catch (e) { console.warn("preAi shadow failed", e); preAi = null; }
```
d) AI anchor arm (prompt change is behind an env flag, default OFF = today's behaviour exactly):
```ts
const anchorMode = Deno.env.get("ANCHOR_MODE") || "off";   // off | split | on
const armKey = `${body.make}|${body.model}|${body.year}|${body.mileage}|${body.registration ?? ""}`;
const arm = preAi ? anchorArm(anchorMode, armKey) : "control";
let anchorInput: any = null;
if (arm === "anchor" && preAi) {
  const f = preAi.motAdj.factor;
  anchorInput = {
    pm: { private: preAi.pm.private.price * f, dealer: preAi.pm.dealer.price * f, low: preAi.pm.private.low * f, high: preAi.pm.private.high * f, known: preAi.pm.private.known },
    motAdjPct: preAi.motAdj.pct,
    ownComps: preAi.ocBase && !preAi.ocBase.unavailable ? { privatePrice: preAi.ocBase.privatePrice, low: preAi.ocBase.finalLow, high: preAi.ocBase.finalHigh,
      nComps: preAi.ocBase.nComps, level: preAi.ocBase.level, confidenceScore: preAi.ocBase.confidenceScore } : null,
    similar: preAi.similar,
  };
}
```
   - When `arm === "anchor"`: append `"\n\n" + anchorBlock(anchorInput)` to the END of the text part of `userContent` (after `${motBlock}`
     and the closing instructions), and send a copy of `TOOL` whose `function.parameters.properties` also includes `...DEVIATION_REASON_PROPERTY`.
     When `arm === "control"` the request must be byte-for-byte what it is today. Do not change SYSTEM_PROMPT. Still ONE AI call.

e) Existing pmShadow block: change `body: null` to `body: body.bodyStyle ?? null`, and add to the `pmShadow` object (keep all existing keys):
   `bodySource: resolveBody(body.make, body.model, body.bodyStyle ?? null).source` (import `resolveBody` from priceModel.ts),
   `motAdj: preAi ? { pct: preAi.motAdj.pct, band: preAi.motAdj.band, parts: preAi.motAdj.parts } : null`,
   `motSignals: preAi?.motAdj.signals ?? null`, `pmWithMot: preAi?.pmWithMot ?? null`, `firstRegistered: body.firstRegistered ?? null`.

f) Right AFTER the existing `aiSafetyCap` block (before the negotiation buffer), add the ensemble shadow (try/catch, never throws):
```ts
let ensembleShadow: Record<string, unknown> | null = null;
try {
  const pmE = preAi ? { private: preAi.pmWithMot ?? preAi.pm.private.price, low: preAi.pm.private.low * preAi.motAdj.factor, high: preAi.pm.private.high * preAi.motAdj.factor } : null;
  ensembleShadow = ensemble({ pm: pmE, ownComps: ownForCap, ai: dataSource === "ai_estimate" && !valuationUnavailable ? values.privateSale : null }) as any;
} catch (e) { console.warn("ensemble shadow failed", e); }
```
g) Report: next to `pmShadow,` add
```ts
ensembleShadow,
anchor: { mode: anchorMode, arm, price: anchorInput ? anchorPrice(anchorInput) : null,
  deviation: anchorInput && Number(ai.privateSaleValue) > 0 ? anchorDeviation(Number(ai.privateSaleValue), anchorPrice(anchorInput)) : null,
  deviationReason: arm === "anchor" ? (typeof (ai as any).deviationReason === "string" ? (ai as any).deviationReason.slice(0, 300) : "") : null },
```
   and the same objects under `debugInfo.ensemble` / `debugInfo.anchor`. `deviationReason` must never be shown in the UI.

h) Do NOT set the `ANCHOR_MODE` secret (leave it unset = "off"). Deploy analyse-vehicle. Reply with the list of files changed.
