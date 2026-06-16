// Diagnostic: try multiple MotorSpecs OAuth variants and report each result.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const clientId = Deno.env.get("MOTORSPECS_CLIENT_ID") ?? "";
  const clientSecret = Deno.env.get("MOTORSPECS_CLIENT_SECRET") ?? "";

  const urls = [
    "https://staging.motorspecs.com/oauth",
    "https://api.motorspecs.com/oauth",
    "https://motorspecs.com/oauth",
    "https://staging.motorspecs.com/oauth/token",
    "https://api.motorspecs.com/oauth/token",
  ];

  const basic = `Basic ${btoa(`${clientId}:${clientSecret}`)}`;

  const variants = (url: string) => ([
    {
      name: "basic+form",
      url,
      init: {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
          Authorization: basic,
        },
        body: new URLSearchParams({ grant_type: "client_credentials" }).toString(),
      } as RequestInit,
    },
    {
      name: "form-body-only",
      url,
      init: {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: clientId,
          client_secret: clientSecret,
        }).toString(),
      } as RequestInit,
    },
    {
      name: "basic+empty",
      url,
      init: {
        method: "POST",
        headers: { Accept: "application/json", Authorization: basic },
      } as RequestInit,
    },
    {
      name: "json-body",
      url,
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          grant_type: "client_credentials",
          client_id: clientId,
          client_secret: clientSecret,
        }),
      } as RequestInit,
    },
    {
      name: "json-no-grant",
      url,
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
      } as RequestInit,
    },
  ]);

  const results: any[] = [];
  for (const url of urls) {
    for (const v of variants(url)) {
      try {
        const resp = await fetch(v.url, v.init);
        const text = await resp.text();
        results.push({
          url,
          variant: v.name,
          status: resp.status,
          ok: resp.ok,
          contentType: resp.headers.get("content-type"),
          body: text.slice(0, 400),
        });
      } catch (e: any) {
        results.push({ url, variant: v.name, error: e?.message });
      }
    }
  }

  return new Response(
    JSON.stringify(
      {
        credentialMeta: {
          idLen: clientId.length,
          secretLen: clientSecret.length,
          idTrimmedLen: clientId.trim().length,
          secretTrimmedLen: clientSecret.trim().length,
          secretFirst3: clientSecret.slice(0, 3),
          secretLast3: clientSecret.slice(-3),
          secretHasPlus: clientSecret.includes("+"),
          secretHasWhitespace: /\s/.test(clientSecret),
        },
        results,
      },
      null,
      2,
    ),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
