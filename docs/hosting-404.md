# Real 404 status for unknown URLs (valu8.uk)

## What happens today
- valu8.uk is served by **Lovable hosting** (A record 185.158.133.1). Lovable's edge (it uses Cloudflare internally,
  which is why responses say `server: cloudflare`) serves the SPA shell `index.html` with **HTTP 200 for every
  path that has no file**. There is no setting, `_redirects` or `404.html` support on Lovable hosting to change that.
  The build already writes `dist/404.html`, but Lovable never serves it.
- DNS for valu8.uk is on **Google Cloud DNS** (ns-cloud-e*.googledomains.com), not on a Cloudflare account we
  control, so there is no "Cloudflare rule" we can add today.

## What the site does instead (live, and kept in this PR)
- An inline script in `index.html` runs before anything renders. For any path that is not a real page (unknown
  routes, made-up `/value/:slug`, out-of-range `/value/:slug/:year`, unknown `/car-values/:make/:model`) it removes
  the homepage canonical/og:url, adds `<meta name="robots" content="noindex">` and sets the title to
  "Page not found". The React `NotFound` page does the same on client-side navigation.
- Google renders JavaScript, sees `noindex`, and drops those URLs (they show in Search Console as
  "Excluded by 'noindex' tag" rather than "Soft 404"). That is the best available on Lovable hosting.

## Options for a true HTTP 404 (each needs Tony)
1. **Cloudflare in front (recommended if wanted).** Move valu8.uk's DNS to a free Cloudflare account, keep the
   A record pointing at Lovable (proxied), and deploy the Worker below on `valu8.uk/*`. Cost: free plan.
   Needs: Tony to create the Cloudflare account and change nameservers at the registrar. Check Lovable's custom
   domain still verifies after the switch.
2. **Host the static build elsewhere** (Cloudflare Pages, Netlify or Vercel), which all serve `404.html` with a
   404 status when no file matches and support SPA rewrites only for known routes. Bigger change: deploys would
   no longer go through Lovable's Publish button.
3. **Do nothing more.** `noindex` already keeps junk URLs out of Google.

## Worker (option 1)
Prerendered pages carry their own canonical; the SPA fallback shell carries the homepage canonical. So: a non-`/`
path that comes back with the homepage canonical, and isn't an app route, is a 404.

```js
// Cloudflare Worker: route valu8.uk/*
const APP = [/^\/(auth|reset-password|dashboard|profile|compare|admin|unsubscribe|email-answer|bot|buyer|check-an-advert|valuation\/new)\/?$/,
  /^\/valuation\/[^/]+(\/(analysing|edit))?\/?$/, /^\/shared\/[^/]+\/?$/, /^\/embed\//];
export default {
  async fetch(req) {
    const res = await fetch(req);
    const url = new URL(req.url);
    const type = res.headers.get("content-type") || "";
    if (req.method !== "GET" || url.pathname === "/" || !type.includes("text/html") || res.status !== 200) return res;
    if (APP.some((r) => r.test(url.pathname))) return res;
    const html = await res.text();
    const isShell = /<link rel="canonical" href="https:\/\/valu8\.uk\/"\s*\/?>/.test(html);
    return new Response(html, { status: isShell ? 404 : 200, headers: res.headers });
  },
};
```
