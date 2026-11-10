import { useMemo, useState } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Header, TestModeBanner } from "@/components/Layout";
import { Footer } from "@/components/Footer";
import { useSeo } from "@/lib/seo";
import { getRouteMeta } from "@/data/routeMeta";
import { EMBED_INFO, embedSnippet } from "@/data/embedContent";

export default function EmbedInfo() {
  useSeo(getRouteMeta("/embed-info"));
  const [site, setSite] = useState("");
  const [light, setLight] = useState(false);
  const snippet = useMemo(() => embedSnippet(site, light), [site, light]);
  const copy = async () => {
    try { await navigator.clipboard.writeText(snippet); toast.success("Snippet copied", { description: "Paste it into your page's HTML." }); }
    catch { toast.error("Couldn't copy", { description: "Select the code and copy it by hand." }); }
  };
  return (
    <div className="min-h-screen flex flex-col">
      <TestModeBanner /><Header />
      <main id="main" className="flex-1 container max-w-3xl py-10 md:py-14 space-y-10">
        <header>
          <div className="text-xs uppercase tracking-widest text-primary font-semibold mb-2">For garages, blogs and car clubs</div>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-gradient mb-4">{EMBED_INFO.h1}</h1>
          <p className="text-base text-muted-foreground">{EMBED_INFO.intro}</p>
        </header>

        <section aria-labelledby="embed-preview-h">
          <h2 id="embed-preview-h" className="text-xl font-semibold mb-3">How it looks</h2>
          <iframe src={`/embed/?site=embed-info${light ? "&theme=light" : ""}`} title="Valu8 valuation box preview" width="100%" height="250" loading="lazy" className="block w-full max-w-[520px] border-0" />
        </section>

        <section aria-labelledby="embed-code-h" className="premium-card p-5 sm:p-6">
          <h2 id="embed-code-h" className="text-xl font-semibold mb-3">Add it to your site</h2>
          <label className="block text-sm font-medium" htmlFor="embed-site">Your website or club name</label>
          <input id="embed-site" value={site} onChange={(e) => setSite(e.target.value)} placeholder="e.g. smithsgarage.co.uk" className="mt-1 w-full min-h-[44px] rounded-lg border border-border bg-background px-3 text-sm" />
          <label className="mt-3 flex min-h-[44px] items-center gap-2 text-sm">
            <input type="checkbox" checked={light} onChange={(e) => setLight(e.target.checked)} className="h-4 w-4 accent-[#00D6C8]" /> Light version for pale backgrounds
          </label>
          <pre className="mt-3 whitespace-pre-wrap break-all rounded-lg border border-border bg-muted/30 p-3 text-xs"><code>{snippet}</code></pre>
          <button type="button" onClick={copy} className="mt-3 inline-flex min-h-[48px] items-center gap-2 rounded-xl px-5 font-semibold" style={{ background: "#00D6C8", color: "#111111" }}>
            <Copy className="h-4 w-4" aria-hidden /> Copy the code
          </button>
          <p className="mt-2 text-xs text-muted-foreground">Paste it where you want the box to appear. Most website builders have an "HTML" or "Embed" block for this.</p>
        </section>

        {EMBED_INFO.sections.map(([h, items]) => (
          <section key={h} aria-label={h}>
            <h2 className="text-xl font-semibold mb-3">{h}</h2>
            <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground leading-relaxed">
              {items.map((t) => <li key={t}>{t}</li>)}
            </ul>
          </section>
        ))}

        <section aria-labelledby="embed-faq-h">
          <h2 id="embed-faq-h" className="text-xl font-semibold mb-3">Questions</h2>
          <dl className="space-y-4 text-sm">
            {EMBED_INFO.faqs.map(([q, a]) => (<div key={q}><dt className="font-semibold">{q}</dt><dd className="text-muted-foreground mt-1">{a}</dd></div>))}
          </dl>
        </section>
      </main>
      <Footer />
    </div>
  );
}
