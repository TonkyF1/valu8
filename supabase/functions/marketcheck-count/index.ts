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
      // UK endpoint (matches analyse-vehicle); the previous US endpoint +
      // country=UK returned US inventory counts or nothing.
      year_range: `${year - 1}-${year + 1}`,
      rows: '1',
      api_key: apiKey,
    });

    const r = await fetch(`https://mc-api.marketcheck.com/v2/search/car/uk/active?${params}`);
    if (!r.ok) {
      console.error('marketcheck-count upstream error', r.status, (await r.text()).slice(0, 200));
      throw new Error(`marketcheck ${r.status}`);
    }
    const data = await r.json();
    const totalCount = Number(data?.num_found ?? data?.total ?? 0);

    return new Response(JSON.stringify({ totalCount }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ totalCount: 0, error: 'Market count unavailable' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
