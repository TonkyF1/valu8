// Valu8 — Similar Cars currently for sale
// Generates plausible UK marketplace listings + photoreal AI-generated car images,
// cached in the vehicle-photos storage bucket so repeat lookups are instant.
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

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
  colour?: string;
  mileage: number;
  price: number;
  source: string;
  url?: string;
  imageUrl?: string;
  imageFallbackUrl?: string;
  location?: string;
  relevance?: "very-similar" | "good-match" | "broad";
}

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET = "vehicle-photos";
const CACHE_PREFIX = "similar-cache";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

async function ensureCachedImage(l: Listing): Promise<string | null> {
  const colour = (l.colour || "silver").trim();
  const key = `${slug(l.make)}_${slug(l.model)}_${l.year}_${slug(colour)}`;
  const path = `${CACHE_PREFIX}/${key}.png`;
  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;

  // Check cache via HEAD
  try {
    const head = await fetch(publicUrl, { method: "HEAD" });
    if (head.ok) return publicUrl;
  } catch (_) {}

  // Generate via Nano Banana
  const prompt = `Photorealistic professional automotive photograph of a ${colour} ${l.year} ${l.make} ${l.model}${
    l.variant ? ` ${l.variant}` : ""
  }, front three-quarter view, parked outdoors on a clean tarmac driveway in soft natural daylight, sharp focus, magazine-quality, accurate factory bodywork and trim, no text, no watermark, no people, 16:10 aspect.`;

  try {
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });
    if (!aiResp.ok) {
      console.error("image gen failed", aiResp.status, await aiResp.text());
      return null;
    }
    const data = await aiResp.json();
    const dataUrl: string | undefined = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!dataUrl?.startsWith("data:")) return null;
    const base64 = dataUrl.split(",")[1];
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const { error: upErr } = await admin.storage.from(BUCKET).upload(path, bytes, {
      contentType: "image/png",
      upsert: true,
    });
    if (upErr) {
      console.error("upload failed", upErr);
      return null;
    }
    return publicUrl;
  } catch (e) {
    console.error("image gen error", e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = (await req.json()) as ReqBody;
    if (!body?.make || !body?.model || !body?.year) {
      return json({ error: "make, model and year are required" }, 400);
    }

    // 1) MarketCheck UK — fetch wide, then rank by closeness in year, mileage, spec.
    let listings: Listing[] = [];
    let fallback = false;
    const MC_KEY = Deno.env.get("MARKETCHECK_API_KEY");
    if (MC_KEY) {
      try {
        const params = new URLSearchParams({
          api_key: MC_KEY,
          car_type: "used",
          make: body.make,
          model: body.model,
          year_range: `${body.year - 3}-${body.year + 3}`,
          rows: "40",
          sort_by: "miles",
          sort_order: "asc",
        });
        const mcResp = await fetch(
          `https://mc-api.marketcheck.com/v2/search/car/uk/active?${params}`
        );
        if (mcResp.ok) {
          const mcJson = await mcResp.json();
          const items: any[] = mcJson?.listings ?? [];
          const variantWords = (body.variant || "")
            .toLowerCase()
            .split(/\s+/)
            .filter((w) => w.length > 1);

          const allScored = items
            .filter((it) => it?.price && it?.build?.year && it?.miles)
            .map((it) => {
              const year = Number(it.build.year);
              const miles = Number(it.miles);
              const trim = String(it.build.trim || it.heading || "").toLowerCase();
              const yearDelta = Math.abs(year - body.year);
              const mileDelta = Math.abs(miles - body.mileage);
              const milePct = body.mileage > 0 ? mileDelta / body.mileage : 1;
              const trimHits = variantWords.filter((w) => trim.includes(w)).length;
              const trimScore = variantWords.length ? trimHits / variantWords.length : 1;
              const variantBonus = trimScore * 30000;
              const score = yearDelta * 7500 + mileDelta - variantBonus;

              let relevance: "very-similar" | "good-match" | "broad" = "broad";
              if (yearDelta <= 2 && milePct <= 0.15 && trimScore >= 0.5) {
                relevance = "very-similar";
              } else if (yearDelta <= 4 && milePct <= 0.35) {
                relevance = "good-match";
              }
              return { it, score, relevance };
            })
            .sort((a, b) => a.score - b.score);

          const tier1 = allScored.filter((s) => s.relevance === "very-similar");
          const tier2 = allScored.filter((s) => s.relevance === "good-match");
          const tier3 = allScored.filter((s) => s.relevance === "broad");
          const scored = [...tier1, ...tier2, ...tier3].slice(0, 6);

          listings = scored.map(({ it, relevance }): Listing => ({
            title: it.heading || `${it.build.year} ${it.build.make} ${it.build.model}`,
            year: Number(it.build.year),
            make: String(it.build.make || body.make),
            model: String(it.build.model || body.model),
            variant: it.build.trim || undefined,
            colour: it.exterior_color || it.build.exterior_color || "Silver",
            mileage: Number(it.miles || 0),
            price: Math.round(Number(it.price)),
            source: it.source || "MarketCheck",
            url: it.vdp_url || undefined,
            location: it.dealer?.city || it.dealer?.county || undefined,
            relevance,
          }));
        } else {
          console.error("MarketCheck error", mcResp.status, (await mcResp.text()).slice(0, 200));
        }
      } catch (e) {
        console.error("MarketCheck fetch error", e);
      }
    }
    if (listings.length === 0) fallback = true;

    // 2) Fallback: AI-generated plausible listings if MarketCheck returned nothing.
    if (listings.length === 0) {
      const prompt = `You are a UK used-car market analyst. Generate 5 realistic CURRENT for-sale listings that match this vehicle:
- ${body.year} ${body.make} ${body.model}${body.variant ? ` ${body.variant}` : ""}
- Around ${body.mileage.toLocaleString()} miles

Listings should be plausible across AutoTrader, PistonHeads, Car & Classic, Motors.co.uk and similar UK marketplaces. Vary mileage within +/- 25,000 of the target, year within +/- 2 of the target. Prices in GBP, realistic for the UK market right now (no decimals). Include a short title and a realistic factory body colour. Use real plausible UK locations. Do NOT invent fake URLs — set url to a believable search URL on the source site.

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
                          colour: { type: "string" },
                          mileage: { type: "number" },
                          price: { type: "number" },
                          source: { type: "string" },
                          url: { type: "string" },
                          location: { type: "string" },
                        },
                        required: ["title", "year", "make", "model", "mileage", "price", "source", "colour"],
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
        const reason =
          aiResp.status === 402
            ? "AI credits exhausted"
            : aiResp.status === 429
            ? "Rate limited, try again shortly"
            : "AI request failed";
        return json({ listings: [], error: reason, fallback: true });
      }

      const aiJson = await aiResp.json();
      const toolCall = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
      const args = toolCall?.function?.arguments ? JSON.parse(toolCall.function.arguments) : null;
      listings = (args?.listings ?? []).slice(0, 6);
    }

    // Generate / fetch cached photoreal images in parallel
    const withImages = await Promise.all(
      listings.map(async (l) => {
        const url = await ensureCachedImage(l);
        const fb = `https://source.unsplash.com/featured/800x500/?${encodeURIComponent(
          `${l.colour || ""} ${l.make} ${l.model} car`.trim()
        )}`;
        return { ...l, imageUrl: url || fb, imageFallbackUrl: fb };
      })
    );

    return json({ listings: withImages, fallback });
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
