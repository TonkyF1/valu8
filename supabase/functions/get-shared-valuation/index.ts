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
    if (!id && req.method !== "GET") {
      try { const body = await req.json(); id = body?.id ?? null; } catch { /* ignore */ }
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
      .select("id, make, model, year, mileage, registration, mot_expiry, photo_urls, report, created_at")
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

    return new Response(
      JSON.stringify({ ...data, photo_urls: signed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
