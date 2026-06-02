// Valu8 — Generates ready-to-post car adverts using Lovable AI
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { capturePosthogAiGeneration } from "../_shared/posthog.ts";


interface AdvertRequest {
  make: string;
  model: string;
  year: number;
  mileage: number;
  registration?: string;
  motExpiry?: string;
  location?: string;
  price: number;
  conditionScore: number;
  conditionLabel: string;
  honestAnalysis: string;
  strengths: string[];
  highlights?: string[];
}

const SYSTEM_PROMPT = `You are Valu8's expert UK car-advert copywriter. You write adverts for PRIVATE sellers that sound natural, enthusiastic but never overhyped or salesy. Honest, warm, confident. UK English. Use £ for prices.

You will be given vehicle data and must produce three versions:
- short: 40-70 words. For Facebook Marketplace / Gumtree. Punchy, scannable, key facts.
- medium: 110-160 words. Balanced detail, a few short paragraphs.
- full: 220-320 words. AutoTrader-style with sections: a quick intro, a "Highlights" bullet list (use • bullets), a paragraph on condition/history, and a closing call-to-action with viewing/contact line.

Rules:
- Always include: year, make, model, mileage, MOT info if provided, asking price, location if provided.
- Never invent service history, owners, accidents, or features not implied by the data.
- No emojis except optionally a single 🚗 or ✅ in the full version.
- End each version with a clear call-to-action (e.g. "Viewings welcome", "Serious enquiries only please").
- Write in first person ("I'm selling...") — it's a private seller.
- Always reply by calling the provided function. Never write JSON in plain text.`;

const TOOL = {
  type: "function",
  function: {
    name: "valu8_advert",
    description: "Return three advert versions for the vehicle.",
    parameters: {
      type: "object",
      properties: {
        short: { type: "string" },
        medium: { type: "string" },
        full: { type: "string" },
      },
      required: ["short", "medium", "full"],
      additionalProperties: false,
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = (await req.json()) as AdvertRequest;
    if (!body?.make || !body?.model || !body?.year || !body?.price) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const userText =
`Vehicle:
- ${body.year} ${body.make} ${body.model}
- Mileage: ${body.mileage.toLocaleString()} miles
- Registration: ${body.registration || "not provided"}
- MOT expiry: ${body.motExpiry || "not provided"}
- Location: ${body.location || "not provided"}
- Asking price: £${body.price.toLocaleString()}
- Condition: ${body.conditionLabel} (${body.conditionScore}/10)

Valu8 honest analysis:
${body.honestAnalysis}

Key strengths:
${body.strengths.map(s => `- ${s}`).join("\n")}
${body.highlights?.length ? `\nFeatures to highlight:\n${body.highlights.map(s => `- ${s}`).join("\n")}` : ""}

Generate the three advert versions now. Call valu8_advert.`;

    const aiStart = Date.now();
    const aiModel = "google/gemini-2.5-flash";
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: aiModel,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userText },
        ],
        tools: [TOOL],
        tool_choice: { type: "function", function: { name: "valu8_advert" } },
      }),
    });
    const aiLatency = Date.now() - aiStart;

    if (!aiResp.ok) {
      const txt = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, txt);
      capturePosthogAiGeneration({
        model: aiModel, latencyMs: aiLatency, httpStatus: aiResp.status,
        isError: true, errorMessage: txt.slice(0, 300), feature: "generate-advert",
        distinctId: (body as any).userId ?? null,
      });
      if (aiResp.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded — please try again shortly." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiResp.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ error: "AI generation failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await aiResp.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) throw new Error("AI did not return advert");
    const advert = JSON.parse(toolCall.function.arguments);

    capturePosthogAiGeneration({
      model: aiModel, latencyMs: aiLatency, httpStatus: 200,
      inputTokens: data?.usage?.prompt_tokens,
      outputTokens: data?.usage?.completion_tokens,
      totalTokens: data?.usage?.total_tokens,
      feature: "generate-advert",
      distinctId: (body as any).userId ?? null,
      extra: { make: body.make, model: body.model, year: body.year },
    });


    return new Response(JSON.stringify({ advert }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
    });
  } catch (e) {
    console.error("generate-advert error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
