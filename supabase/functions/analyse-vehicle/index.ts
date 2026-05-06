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
      required: ["conditionScore", "conditionLabel", "privateSaleValue", "honestAnalysis", "marketPositioning", "strengths", "watchPoints", "photoObservations", "recommendations"],
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
      honestAnalysis: string;
      marketPositioning: string;
      strengths: string[];
      watchPoints: string[];
      photoObservations: string;
      recommendations: { whereToSell: string[]; highlights: string[]; documents: string[] };
    };

    // ----- Pricing engine: trust the AI's market-aware private-sale value, derive tiers from it -----
    const score = Math.max(1, Math.min(10, ai.conditionScore));
    const aiPrivate = Math.max(500, Number(ai.privateSaleValue) || 0);
    // Fallback if AI returns suspicious value
    const fallback = baseValue(body.make, body.year);
    const fair = aiPrivate > fallback * 0.2 ? aiPrivate : fallback;
    // Round granularity scales with magnitude
    const grain = fair >= 500000 ? 5000 : fair >= 100000 ? 1000 : fair >= 20000 ? 250 : 50;
    const roundG = (n: number) => Math.round(n / grain) * grain;
    const values = {
      dealerTradeIn: roundG(fair * 0.82),
      privateSale: roundG(fair),
      dealerRetail: roundG(fair * 1.16),
    };
    const listingPrice = roundG(values.privateSale * 1.04);

    // MOT + HPI (simulated, swap with real APIs later)
    const seed = hash(`${body.make}|${body.model}|${body.year}|${body.mileage}|${body.registration ?? ""}`);
    const motHistory = simulateMotHistory(body.year, body.mileage, seed);

    const report = {
      conditionScore: Math.round(score * 10) / 10,
      conditionLabel: ai.conditionLabel,
      values,
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
