import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const BUCKET = "vehicle-photos";
const SIGN_EXPIRY = 60 * 60 * 24 * 7; // 7 days

function extractPath(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = String(value).trim();
  if (!v) return null;
  if (!v.startsWith("http")) return v.replace(/^\/+/, "");
  try {
    const u = new URL(v);
    const marker = `/${BUCKET}/`;
    const idx = u.pathname.indexOf(marker);
    if (idx === -1) return null;
    return decodeURIComponent(u.pathname.slice(idx + marker.length));
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    let id = url.searchParams.get("id");
    let guestToken: unknown = null;
    if (req.method !== "GET") {
      try { const body = await req.json(); id = id ?? body?.id ?? null; guestToken = body?.guestToken ?? null; } catch { /* ignore */ }
    }
    if (!id) {
      return new Response(JSON.stringify({ error: "missing id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await admin
      .from("valuations")
      .select("id, make, model, year, mileage, registration, mot_expiry, photo_urls, report, created_at, user_id, guest_token_hash")
      .eq("id", id)
      .maybeSingle();

    if (error || !data) {
      return new Response(JSON.stringify({ error: "not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sign photo URLs server-side so anonymous viewers can see them.
    const refs = Array.isArray(data.photo_urls) ? (data.photo_urls as string[]) : [];
    const paths = refs.map(extractPath).filter((p): p is string => !!p);
    let signed: string[] = [];
    if (paths.length > 0) {
      const { data: s } = await admin.storage.from(BUCKET).createSignedUrls(paths, SIGN_EXPIRY);
      const map = new Map<string, string>();
      for (const item of s ?? []) {
        if (item.path && item.signedUrl) map.set(item.path, item.signedUrl);
      }
      signed = refs.map((r) => {
        const p = extractPath(r);
        return p ? (map.get(p) ?? "") : "";
      });
    }

    // Share links always get Essentials only: strip paid Full Report fields server-side
    // so buyers cannot read asking/comps/condition/advert/repairs from the JSON.
    const stripSharedReport = (raw: unknown) => {
      if (!raw || typeof raw !== "object") return raw;
      const { saleFeedback: _sf, advert: _ad, photoInsights: _pi,
        recommendedAskingPrice: _rap, negotiationBuffer: _nb,
        conditionScore: _cs, conditionLabel: _cl,
        repairEstimate: _re, repairEstimates: _res, advisoryCosts: _ac,
        fixableUpside: _fu, ...rest } = raw as Record<string, unknown>;
      const out: Record<string, unknown> = { ...rest };
      if (Array.isArray(out.comparableListings)) {
        out.comparableListings = (out.comparableListings as unknown[])
          .filter((c: any) => c && c.price > 0)
          .slice(0, 3);
      }
      if (out.recommendations && typeof out.recommendations === "object") {
        const rec = { ...(out.recommendations as Record<string, unknown>) };
        delete rec.recommendedAskingPrice;
        delete rec.negotiationBuffer;
        delete rec.listingPrice;
        out.recommendations = rec;
      }
      return out;
    };

    // The guest who made this valuation (their token hashes to guest_token_hash) gets their own full
    // report back, exactly like a signed-in owner reading their row. The page still locks paid
    // sections until report-entitlement says paid; this just means a paying guest sees real figures.
    let isOwner = false;
    if (!data.user_id && data.guest_token_hash && typeof guestToken === "string" && /^[a-f0-9]{64}$/.test(guestToken)) {
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(guestToken));
      const hash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
      isOwner = hash === data.guest_token_hash;
    }
    const { user_id: _uid, guest_token_hash: _gth, ...row } = data as Record<string, unknown>;

    return new Response(
      JSON.stringify({
        ...row,
        report: isOwner ? data.report : stripSharedReport(data.report),
        photo_urls: signed,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
