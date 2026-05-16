import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    let make = url.searchParams.get('make');
    let model = url.searchParams.get('model');
    let year = Number(url.searchParams.get('year'));
    if ((!make || !model || !year) && req.method !== 'GET') {
      try {
        const body = await req.json();
        make = make || body?.make;
        model = model || body?.model;
        year = year || Number(body?.year);
      } catch { /* ignore */ }
    }
    const apiKey = Deno.env.get('MARKETCHECK_API_KEY');

    if (!make || !model || !year || !apiKey) {
      return new Response(JSON.stringify({ totalCount: 0, error: 'missing params' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const params = new URLSearchParams({
      make,
      model,
      year_min: String(year - 1),
      year_max: String(year + 1),
      country: 'UK',
      rows: '1',
      api_key: apiKey,
    });

    const r = await fetch(`https://mc-api.marketcheck.com/v2/search/car/active?${params}`);
    if (!r.ok) throw new Error(`marketcheck ${r.status}`);
    const data = await r.json();
    const totalCount = Number(data?.num_found ?? data?.total ?? 0);

    return new Response(JSON.stringify({ totalCount }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ totalCount: 0, error: String(e) }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
