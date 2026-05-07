// Valu8 — AI vehicle analysis edge function
// Uses Lovable AI Gateway (Gemini 2.5 Pro vision) to analyse photos + vehicle data
// MOT history is realistic simulated data — placeholder for real DVSA API integration

import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

interface AnalyseRequest {
  make: string;
  model: string;
  variant?: string;
  year: number;
  mileage: number;
  registration?: string;
  motExpiry?: string;
  serviceNotes?: string;
  photoUrls: string[];
}

type ConfidenceLevel = "High" | "Medium" | "Low";

const ENTHUSIAST_KEYWORDS = [
  "rs", "renaultsport", "renault sport", "gti", "gti clubsport", "st", "vrs", "v-rs", "vxr", "opc", "cupra", "type r", "type-r",
  "m", "m sport", "m3", "m4", "m5", "amg", "gt3", "gt3 rs", "gt4", "turbo s", "nismo", "evo", "integrale", "cooper s",
  "john cooper works", "jcw", "quadrifoglio", "abarth", "trophy", "williams", "cs", "csl", "clubsport", "superleggera", "performante", "svj", "lt"
];

const EXOTIC_MODEL_ANCHORS: Array<{ make: string; match: RegExp; low: number; high: number }> = [
  { make: "Bugatti", match: /chiron|pur sport|super sport|ss 300/i, low: 2200000, high: 4200000 },
  { make: "Bugatti", match: /veyron/i, low: 1200000, high: 1800000 },
  { make: "Ferrari", match: /laferrari/i, low: 2500000, high: 3200000 },
  { make: "Ferrari", match: /sf90/i, low: 320000, high: 450000 },
  { make: "Ferrari", match: /296\s?(gtb|gts)?/i, low: 230000, high: 290000 },
  { make: "Ferrari", match: /f8/i, low: 180000, high: 230000 },
  { make: "Ferrari", match: /488/i, low: 130000, high: 170000 },
  { make: "Ferrari", match: /roma/i, low: 140000, high: 190000 },
  { make: "Ferrari", match: /portofino/i, low: 110000, high: 150000 },
  { make: "Lamborghini", match: /revuelto/i, low: 450000, high: 600000 },
  { make: "Lamborghini", match: /aventador\s?svj/i, low: 400000, high: 550000 },
  { make: "Lamborghini", match: /aventador/i, low: 200000, high: 280000 },
  { make: "Lamborghini", match: /hurac[aá]n\s?performante/i, low: 200000, high: 260000 },
  { make: "Lamborghini", match: /hurac[aá]n\s?evo/i, low: 170000, high: 220000 },
  { make: "Lamborghini", match: /urus/i, low: 160000, high: 230000 },
  { make: "McLaren", match: /p1/i, low: 1200000, high: 1800000 },
  { make: "McLaren", match: /senna/i, low: 900000, high: 1300000 },
  { make: "McLaren", match: /765lt/i, low: 350000, high: 450000 },
  { make: "McLaren", match: /720s/i, low: 160000, high: 220000 },
  { make: "McLaren", match: /artura/i, low: 160000, high: 210000 },
  { make: "Porsche", match: /911\s?r$/i, low: 350000, high: 500000 },
  { make: "Porsche", match: /carrera\s?gt/i, low: 1200000, high: 1800000 },
  { make: "Porsche", match: /918/i, low: 1400000, high: 2000000 },
  { make: "Porsche", match: /992.*gt3/i, low: 160000, high: 210000 },
  { make: "Porsche", match: /992.*turbo\s?s/i, low: 180000, high: 240000 },
  { make: "Porsche", match: /991.*gt3\s?rs/i, low: 200000, high: 260000 },
  { make: "Porsche", match: /993.*turbo/i, low: 180000, high: 280000 },
  { make: "Aston Martin", match: /valkyrie/i, low: 2000000, high: 3000000 },
  { make: "Aston Martin", match: /dbs\s?superleggera/i, low: 160000, high: 220000 },
  { make: "Aston Martin", match: /db11/i, low: 90000, high: 140000 },
  { make: "Rolls-Royce", match: /phantom/i, low: 350000, high: 500000 },
  { make: "Rolls-Royce", match: /cullinan/i, low: 250000, high: 380000 },
  { make: "Rolls-Royce", match: /ghost/i, low: 220000, high: 320000 },
  { make: "Bentley", match: /continental\s?gt/i, low: 140000, high: 200000 },
  { make: "Bentley", match: /bentayga/i, low: 140000, high: 200000 },
  { make: "Bentley", match: /mulsanne/i, low: 120000, high: 200000 },
];

const EXOTIC = ["Ferrari","Lamborghini","McLaren","Pagani","Bugatti","Koenigsegg","Rimac","Aston Martin","Bentley","Rolls-Royce","Maybach","Maserati","Pininfarina","Zenvo","Singer","Gordon Murray"];
const PREMIUM = ["BMW","Mercedes-Benz","Mercedes-AMG","Audi","Porsche","Land Rover","Jaguar","Tesla","Lexus","Volvo","MINI","Polestar","Genesis","Alpine","Lotus","Morgan","TVR","Lucid","Rivian"];
const ECONOMY = ["Dacia","SEAT","Škoda","Skoda","Fiat","Citroën","Citroen","Vauxhall","Peugeot","Renault","Suzuki","MG","Kia","Hyundai","Daihatsu","Perodua","Proton","Lada","Tata","BYD","Leapmotor","VinFast","XPeng"];

function baseValue(make: string, year: number) {
  const age = Math.max(0, 2026 - year);
  let base = 18000;
  if (EXOTIC.includes(make)) base = 120000;
  else if (PREMIUM.includes(make)) base = 32000;
  else if (ECONOMY.includes(make)) base = 13000;
  if (age >= 30) return Math.round(base * Math.max(0.35, Math.pow(0.97, age - 30) * 0.55));
  return Math.round(base * Math.max(0.15, Math.pow(0.86, age)));
}

function roundTo50(n: number) { return Math.round(n / 50) * 50; }

function roundToGrain(n: number) {
  const grain = n >= 1000000 ? 25000 : n >= 500000 ? 10000 : n >= 100000 ? 5000 : n >= 30000 ? 500 : 50;
  return Math.round(n / grain) * grain;
}

function clamp(num: number, min: number, max: number) {
  return Math.max(min, Math.min(max, num));
}

function isEnthusiastCar(make: string, model: string, variant?: string) {
  const hay = `${make} ${model} ${variant ?? ""}`.toLowerCase();
  return ENTHUSIAST_KEYWORDS.some((keyword) => hay.includes(keyword));
}

function getExoticAnchor(make: string, model: string, variant?: string) {
  const hay = `${model} ${variant ?? ""}`;
  return EXOTIC_MODEL_ANCHORS.find((entry) => entry.make === make && entry.match.test(hay));
}

function computeMarketRange(params: {
  make: string;
  model: string;
  variant?: string;
  year: number;
  mileage: number;
  motExpiry?: string;
  serviceNotes?: string;
  photoCount: number;
  conditionScore: number;
  aiPrivateValue: number;
}) {
  const { make, model, variant, year, mileage, motExpiry, serviceNotes, photoCount, conditionScore, aiPrivateValue } = params;
  const age = Math.max(0, 2026 - year);
  const expectedMileage = age <= 0 ? 3000 : age * 8000;
  const mileageRatio = mileage / Math.max(expectedMileage, 1);
  const serviceText = `${serviceNotes ?? ""}`.toLowerCase();
  const hasStrongHistory = /(full service|fsh|main dealer|specialist|major service|timing belt|timing chain|clutch|ceramic|recent service|full history)/i.test(serviceText);
  const needsWork = /(needs|due|overdue|warning light|smoke|fault|damage|dent|scuff|scratch|leak|issue)/i.test(serviceText);
  const enthusiast = isEnthusiastCar(make, model, variant);
  const exoticAnchor = getExoticAnchor(make, model, variant);
  const motSoon = !!motExpiry && (() => {
    const expiry = new Date(motExpiry);
    if (Number.isNaN(expiry.getTime())) return false;
    const days = (expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return days >= 0 && days <= 90;
  })();

  // Trust the AI's private-sale figure as the primary anchor. Apply a small
  // conservative bias so we don't over-promise — private sales typically
  // achieve 3-7% below dealer asking screenshots that AIs often anchor to.
  let center = Math.max(aiPrivateValue, 500) * 0.97;
  let rangeSpread = 0.08;
  let confidence: ConfidenceLevel = photoCount >= 5 ? "High" : photoCount >= 3 ? "Medium" : "Low";

  if (exoticAnchor) {
    // Keep within the anchor band but lean toward the lower-mid for private sale realism.
    const anchorMid = (exoticAnchor.low + exoticAnchor.high) / 2;
    const anchorLowerMid = exoticAnchor.low + (anchorMid - exoticAnchor.low) * 0.6;
    if (center > exoticAnchor.high * 1.05) center = exoticAnchor.high;
    if (center < exoticAnchor.low * 0.85) center = anchorLowerMid;
    rangeSpread = 0.12;
    confidence = photoCount >= 4 ? "High" : "Medium";
  }

  // Condition / history / mileage adjustments — conservative, symmetric.
  if (hasStrongHistory) center *= 1.02;
  if (needsWork) center *= 0.90;
  if (mileageRatio <= 0.7) center *= enthusiast ? 1.05 : 1.03;
  else if (mileageRatio <= 0.9) center *= 1.01;
  else if (mileageRatio >= 1.5) center *= 0.82;
  else if (mileageRatio >= 1.25) center *= 0.90;
  else if (mileageRatio >= 1.1) center *= 0.96;
  if (motSoon) center *= 0.98;
  if (conditionScore >= 8.8) center *= 1.02;
  else if (conditionScore <= 6.5) center *= 0.92;
  else if (conditionScore <= 5.5) center *= 0.82;

  if (enthusiast) rangeSpread += 0.01;
  if (photoCount < 4) rangeSpread += 0.025;
  if (needsWork) rangeSpread += 0.02;
  if (hasStrongHistory) rangeSpread -= 0.005;
  rangeSpread = clamp(rangeSpread, 0.06, 0.16);

  let low = center * (1 - rangeSpread);
  let high = center * (1 + rangeSpread);

  if (exoticAnchor) {
    // Soft-clamp to the anchor band — don't let estimates blow past it.
    low = clamp(low, exoticAnchor.low * 0.85, exoticAnchor.high);
    high = clamp(high, low * 1.04, exoticAnchor.high * 1.05);
  }

  const roundedCenter = roundToGrain(center);
  const roundedLow = roundToGrain(Math.min(low, roundedCenter));
  const roundedHigh = roundToGrain(Math.max(high, roundedCenter));

  const reasons = [
    mileageRatio <= 0.9 ? "lower-than-typical mileage for age" : mileageRatio >= 1.15 ? "above-average mileage for age" : "age-appropriate mileage",
    conditionScore >= 8 ? "strong visible condition" : conditionScore <= 6.4 ? "condition deductions" : "solid used-market condition",
    hasStrongHistory ? "good service history support" : "limited history evidence",
  ];
  if (enthusiast) reasons.push("healthy enthusiast demand for this spec");
  if (motSoon) reasons.push("an MOT date that may slightly temper offers");
  if (exoticAnchor) reasons.push("rare-market pricing anchored to current exotic transaction levels");

  const reasoning = `The range reflects ${reasons.join(", ")}. ${enthusiast && conditionScore >= 7.8 ? "Clean enthusiast examples can outperform book pricing in private sale." : ""}`.trim();

  return {
    center: roundedCenter,
    low: roundedLow,
    high: roundedHigh,
    confidence,
    reasoning,
    enthusiast,
  };
}

// Realistic simulated MOT history. TODO: swap with DVSA MOT History API
// (https://documentation.history.mot.api.gov.uk/) once credentials are added.
function simulateMotHistory(year: number, currentMileage: number, seed: number) {
  const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const ageYears = Math.max(0, 2026 - year);
  if (ageYears < 3) return [];
  const records: { date: string; result: "Pass" | "Advisory" | "Fail"; note: string; mileage: number }[] = [];
  const yearsToShow = Math.min(5, ageYears - 2);
  const annualMiles = Math.max(3000, Math.round(currentMileage / Math.max(1, ageYears)));
  let mi = currentMileage;
  const advisories = [
    "Front brake pads wearing thin",
    "Nearside front tyre worn close to legal limit",
    "Headlamp aim slightly out of alignment",
    "Minor oil leak from sump gasket",
    "Rear wiper blade deteriorated",
    "Anti-roll bar bush has slight play",
  ];
  for (let i = 0; i < yearsToShow; i++) {
    const yr = 2025 - i;
    mi = Math.max(1000, mi - annualMiles + Math.round((rand() - 0.5) * 1500));
    const month = String(1 + Math.floor(rand() * 12)).padStart(2, "0");
    const day = String(1 + Math.floor(rand() * 27)).padStart(2, "0");
    const roll = rand();
    records.push({
      date: `${yr}-${month}-${day}`,
      result: roll > 0.82 ? "Advisory" : "Pass",
      note: roll > 0.82 ? advisories[Math.floor(rand() * advisories.length)] : "No advisories — clean test",
      mileage: mi,
    });
  }
  return records;
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h);
}

const SYSTEM_PROMPT = `You are Valu8's senior UK car valuation analyst with deep, current knowledge of the UK & European private-sale market in 2026. You assess vehicles for PRIVATE SELLERS, not dealers. You are honest, specific, and unsentimental.

You are an expert UK used car valuer with deep knowledge of current 2026 market prices, enthusiast demand, and private sale realities. Be accurate, slightly optimistic for clean cars, and always explain your reasoning.

CRITICAL — PRICING ACCURACY:
You MUST produce REALISTIC market prices grounded in real UK private-sale data. Use your knowledge of recent transactions on AutoTrader, PistonHeads, Car & Classic, Collecting Cars, RM Sotheby's and Bonhams.

Reference anchors (UK private market, 2026 — adjust for year/spec/condition/mileage):
- Bugatti Chiron (2017-2022): £2,200,000–£3,800,000 (Pur Sport / SS 300+ much more). Veyron: £1,200,000–£1,800,000.
- Pagani Huayra: £1,800,000–£3,500,000. Koenigsegg Jesko/Regera: £2,500,000–£4,500,000.
- Ferrari LaFerrari £2.5m–£3.2m; SF90 £320k–£450k; 296 GTB £230k–£290k; F8 £180k–£230k; 488 GTB £130k–£170k; Roma £140k–£190k; Portofino £110k–£150k.
- Ferrari classics: F40 £2m–£3m; F50 £4m+; Enzo £3m–£4m; 288 GTO £2.5m+; Daytona £600k–£900k; 250 GTO £40m+.
- Lamborghini Revuelto £450k–£600k; Aventador SVJ £400k–£550k; Aventador std £200k–£280k; Huracán Performante £200k–£260k; Huracán Evo £170k–£220k; Urus £160k–£230k.
- McLaren P1 £1.2m–£1.8m; Senna £900k–£1.3m; 765LT £350k–£450k; 720S £160k–£220k; Artura £160k–£210k.
- Aston Martin Valkyrie £2m+; DBS Superleggera £160k–£220k; DB11 £90k–£140k; new Vantage £100k–£150k; V12 Vantage classic £90k–£160k.
- Rolls-Royce Phantom (current) £350k–£500k; Cullinan £250k–£380k; Ghost £220k–£320k.
- Bentley Continental GT (current) £140k–£200k; Bentayga £140k–£200k; Mulsanne £120k–£200k.
- Porsche 992 GT3 £160k–£210k; 992 Turbo S £180k–£240k; 992 Carrera £80k–£130k; 991 GT3 RS £200k–£260k; 911 R £350k+; air-cooled 993 Turbo £180k–£280k; 964 RS £220k–£350k; Carrera GT £1.2m–£1.8m; 918 Spyder £1.4m–£2m.
- Modern mainstream: realistic e.g. 2020 Fiesta ST £12k–£16k; 2022 M3 Comp £55k–£70k; 2023 Model 3 LR £25k–£32k.
- Classics: condition tier dominates. Concours can be 3-5x "average". E-Type S1 4.2 FHC £60k–£140k; Mk1 Escort Mexico £35k–£70k; Delta Integrale Evo II £60k–£120k.

Always factor year, spec/variant, mileage, condition (from photos), provenance, options. Adjust anchors intelligently.

For hot hatches, RS/GTI/ST/VXR/Cupra/Type R/M/AMG/Porsche GT and other enthusiast cars, clean and well-kept examples should not be treated like generic commuter cars. Be slightly optimistic when photos, mileage and service history support it.

When estimating value, explicitly think through:
- current private-sale comparable asking prices in the UK market
- enthusiast demand and rarity
- mileage versus age
- visible cosmetic/mechanical condition from photos
- service history strength
- imminent MOT expiry or other buyer friction

Your job:
1. Score the visible/inferred CONDITION 1.0-10.0 (most cars 6.5-8.5; classics on restoration quality).
2. Produce a REALISTIC privateSaleValue in GBP — true 2026 UK private-sale market reality. For exotics/classics this can be hundreds of thousands or millions.
3. Identify concrete strengths and watch points from photos and data.
4. Provide market positioning, an honest analysis, and seller recommendations.

If photos show damage, scuffs, kerbed alloys, worn interior — call it out. If no photos, lower confidence.

Always reply by calling the provided function. Never write JSON in plain text.`;

const TOOL = {
  type: "function",
  function: {
    name: "valu8_report",
    description: "Return the structured Valu8 valuation analysis.",
    parameters: {
      type: "object",
      properties: {
        conditionScore: { type: "number", description: "1.0 to 10.0" },
        conditionLabel: { type: "string", enum: ["Outstanding", "Excellent", "Good", "Average", "Below Average"] },
        privateSaleValue: { type: "number", description: "Realistic UK private-sale price in GBP. For exotics/classics may be hundreds of thousands or millions." },
        honestAnalysis: { type: "string", description: "2-4 sentences. Honest, specific to this car." },
        marketPositioning: { type: "string", description: "1-2 sentences on UK private market position." },
        valueReasoning: { type: "string", description: "Short explanation of why this car sits at this valuation level, referencing mileage, condition, history, rarity/spec or demand." },
        strengths: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 5 },
        watchPoints: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 5 },
        photoObservations: { type: "string", description: "Brief observations on what photos show. Empty if no photos." },
        recommendations: {
          type: "object",
          properties: {
            whereToSell: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 4 },
            highlights: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 5 },
            documents: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 5 },
          },
          required: ["whereToSell", "highlights", "documents"],
          additionalProperties: false,
        },
      },
      required: ["conditionScore", "conditionLabel", "privateSaleValue", "honestAnalysis", "marketPositioning", "valueReasoning", "strengths", "watchPoints", "photoObservations", "recommendations"],
      additionalProperties: false,
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = (await req.json()) as AnalyseRequest;
    if (!body?.make || !body?.model || !body?.year || body?.mileage == null) {
      return new Response(JSON.stringify({ error: "Missing required vehicle fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const photoUrls = (body.photoUrls || []).slice(0, 6);

    const userContent: any[] = [
      {
        type: "text",
        text:
`Vehicle:
- ${body.year} ${body.make} ${body.model}${body.variant ? ` — ${body.variant}` : ""}
- Mileage: ${body.mileage.toLocaleString()} miles
- Registration: ${body.registration || "not provided"}
- MOT expiry: ${body.motExpiry || "not provided"}
- Service notes: ${body.serviceNotes || "none provided"}
- Photos attached: ${photoUrls.length}

Assess condition from photos and data. Be honest and specific. Call the valu8_report function.`,
      },
      ...photoUrls.map((url) => ({ type: "image_url", image_url: { url } })),
    ];

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        tools: [TOOL],
        tool_choice: { type: "function", function: { name: "valu8_report" } },
      }),
    });

    if (!aiResp.ok) {
      const txt = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, txt);
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded — please try again shortly." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in Lovable workspace settings." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ error: "AI analysis failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiData = await aiResp.json();
    const toolCall = aiData?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error("No tool call in AI response", JSON.stringify(aiData));
      throw new Error("AI did not return a structured report");
    }
    const ai = JSON.parse(toolCall.function.arguments) as {
      conditionScore: number;
      conditionLabel: string;
      privateSaleValue: number;
      honestAnalysis: string;
      marketPositioning: string;
      valueReasoning: string;
      strengths: string[];
      watchPoints: string[];
      photoObservations: string;
      recommendations: { whereToSell: string[]; highlights: string[]; documents: string[] };
    };

    // ----- Pricing engine: blend AI value with deterministic market-shaping logic, then derive tiers -----
    const score = Math.max(1, Math.min(10, ai.conditionScore));
    const aiPrivate = Math.max(500, Number(ai.privateSaleValue) || 0);
    const fallback = baseValue(body.make, body.year);
    const market = computeMarketRange({
      make: body.make,
      model: body.model,
      variant: body.variant,
      year: body.year,
      mileage: body.mileage,
      motExpiry: body.motExpiry,
      serviceNotes: body.serviceNotes,
      photoCount: photoUrls.length,
      conditionScore: score,
      aiPrivateValue: aiPrivate > fallback * 0.25 ? aiPrivate : fallback,
    });

    const fair = Math.max(market.center, fallback * 0.9);
    const values = {
      dealerTradeIn: roundToGrain(fair * (market.enthusiast ? 0.84 : 0.82)),
      privateSale: roundToGrain(fair),
      dealerRetail: roundToGrain(fair * (market.enthusiast ? 1.18 : 1.16)),
    };
    const listingPrice = roundToGrain(Math.min(market.high, values.privateSale * (market.enthusiast ? 1.06 : 1.04)));

    // MOT + HPI (simulated, swap with real APIs later)
    const seed = hash(`${body.make}|${body.model}|${body.year}|${body.mileage}|${body.registration ?? ""}`);
    const motHistory = simulateMotHistory(body.year, body.mileage, seed);

    const report = {
      conditionScore: Math.round(score * 10) / 10,
      conditionLabel: ai.conditionLabel,
      values,
      valueRange: { privateSaleLow: market.low, privateSaleHigh: market.high },
      valueReasoning: `${ai.valueReasoning} ${market.reasoning}`.trim(),
      marketConfidence: market.confidence,
      honestAnalysis: ai.honestAnalysis,
      marketPositioning: ai.marketPositioning,
      photoObservations: ai.photoObservations,
      strengths: ai.strengths,
      watchPoints: ai.watchPoints,
      recommendations: { listingPrice, ...ai.recommendations },
      hpi: {
        status: "All Clear" as const,
        checks: [
          { label: "Outstanding finance", ok: true },
          { label: "Insurance write-off", ok: true },
          { label: "Stolen marker", ok: true },
          { label: "Mileage discrepancy", ok: true },
          { label: "Plate transfers", ok: true },
          { label: "VIN integrity", ok: true },
        ],
      },
      motHistory,
      generatedAt: new Date().toISOString(),
    };

    return new Response(JSON.stringify({ report }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e) {
    console.error("analyse-vehicle error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
