// Valu8 — MotorSpecs API proxy (OAuth2 client credentials)
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const BASE = "https://staging.motorspecs.com";
const TOKEN_URL = `${BASE}/oauth`;

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.token;
  const clientId = Deno.env.get("MOTORSPECS_CLIENT_ID");
  const clientSecret = Deno.env.get("MOTORSPECS_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("MotorSpecs credentials not configured");

  // Try standard OAuth2 client_credentials form-encoded first
  const formBody = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });

  let resp = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: formBody,
  });

  // Fallback: JSON body
  if (!resp.ok) {
    console.log("MotorSpecs token form failed", resp.status, "— trying JSON body");
    resp = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret }),
    });
  }

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`MotorSpecs token error ${resp.status}: ${text.slice(0, 300)}`);
  }
  const json = await resp.json();
  const token = json.access_token ?? json.token ?? json.accessToken;
  const expiresIn = Number(json.expires_in ?? json.expiresIn ?? 3600);
  if (!token) throw new Error(`MotorSpecs token missing in response: ${JSON.stringify(json).slice(0, 300)}`);
  cachedToken = { token, expiresAt: Date.now() + expiresIn * 1000 };
  return token;
}

async function callEndpoint(path: string, vrm: string) {
  const token = await getToken();
  const url = `${BASE}${path}?vrm=${encodeURIComponent(vrm)}`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  const contentType = resp.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json") ? await resp.json() : await resp.text();
  return { status: resp.status, ok: resp.ok, body };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { registration, endpoints } = await req.json().catch(() => ({}));
    const reg = String(registration ?? "").replace(/\s+/g, "").toUpperCase();
    if (!reg || reg.length < 2 || reg.length > 8) {
      return new Response(JSON.stringify({ error: "Invalid registration" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Default: just identity. Pass `endpoints: ["identity","provenance","finance","specs","mot"]` for more.
    const list: string[] = Array.isArray(endpoints) && endpoints.length
      ? endpoints
      : ["identity"];

    const pathMap: Record<string, string> = {
      identity: "/v2/Identity",
      identityspecs: "/v2/IdentitySpecs",
      specs: "/v2/Specs",
      finance: "/v2/Finance",
      provenance: "/v2/Provenance",
      mot: "/v2/MOT",
    };

    const results: Record<string, unknown> = {};
    for (const name of list) {
      const path = pathMap[name.toLowerCase()];
      if (!path) { results[name] = { error: "Unknown endpoint" }; continue; }
      try {
        results[name] = await callEndpoint(path, reg);
      } catch (e: any) {
        results[name] = { error: e?.message ?? String(e) };
      }
    }

    return new Response(JSON.stringify({ registration: reg, results }, null, 2), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("motorspecs error", e);
    return new Response(JSON.stringify({ error: e?.message ?? "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
