// Valu8 — Similar Cars currently for sale
// Uses Lovable AI Gateway to generate plausible UK marketplace listings
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

interface ReqBody {
  make: string;
  model: string;
  variant?: string;
  year: number;
  mileage: number;
}

interface Listing {
  title: string;
  year: number;
  make: string;
  model: string;
  variant?: string;
  mileage: number;
  price: number;
  source: string;
  url?: string;
  imageUrl?: string;
  location?: string;
}

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = (await req.json()) as ReqBody;
    if (!body?.make || !body?.model || !body?.year) {
      return json({ error: "make, model and year are required" }, 400);
    }

    const prompt = `You are a UK used-car market analyst. Generate 5 realistic CURRENT for-sale listings that match this vehicle:
- ${body.year} ${body.make} ${body.model}${body.variant ? ` ${body.variant}` : ""}
- Around ${body.mileage.toLocaleString()} miles

Listings should be plausible across AutoTrader, PistonHeads, Car & Classic, Motors.co.uk and similar UK marketplaces. Vary mileage within +/- 25,000 of the target, year within +/- 2 of the target. Prices in GBP, realistic for the UK market right now (no decimals). Include a short title like "${body.year} ${body.make} ${body.model} ${body.variant ?? ""} – Full History". Use real plausible UK locations. Do NOT invent fake URLs — set url to a believable search URL on the source site (e.g. "https://www.autotrader.co.uk/car-search?make=${encodeURIComponent(body.make)}&model=${encodeURIComponent(body.model)}").

Return ONLY a JSON object: { "listings": Listing[] }.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        tools: [
          {
            type: "function",
            function: {
              name: "return_listings",
              description: "Return similar car listings",
              parameters: {
                type: "object",
                properties: {
                  listings: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        year: { type: "number" },
                        make: { type: "string" },
                        model: { type: "string" },
                        variant: { type: "string" },
                        mileage: { type: "number" },
                        price: { type: "number" },
                        source: { type: "string" },
                        url: { type: "string" },
                        location: { type: "string" },
                      },
                      required: ["title", "year", "make", "model", "mileage", "price", "source"],
                    },
                  },
                },
                required: ["listings"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_listings" } },
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI error", aiResp.status, t);
      if (aiResp.status === 429) return json({ error: "Rate limited, try again shortly" }, 429);
      if (aiResp.status === 402) return json({ error: "AI credits exhausted" }, 402);
      return json({ error: "AI request failed" }, 500);
    }

    const aiJson = await aiResp.json();
    const toolCall = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
    const args = toolCall?.function?.arguments ? JSON.parse(toolCall.function.arguments) : null;
    const listings: Listing[] = (args?.listings ?? []).slice(0, 6);

    // Attach a real photo via loremflickr (Flickr-sourced, tag-matched, no auth needed)
    const enriched = listings.map((l, idx) => {
      const tags = [l.make, l.model, "car"]
        .map((t) => t.toLowerCase().replace(/[^a-z0-9]+/g, ""))
        .filter(Boolean)
        .join(",");
      return {
        ...l,
        imageUrl: l.imageUrl || `https://loremflickr.com/640/400/${tags}?lock=${idx + 1}`,
      };
    });

    return json({ listings: enriched });
  } catch (err) {
    console.error(err);
    return json({ error: (err as Error).message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
