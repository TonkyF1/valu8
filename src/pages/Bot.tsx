import { useSeo } from "@/lib/seo";
import { getRouteMeta } from "@/data/routeMeta";
import { Header, TestModeBanner } from "@/components/Layout";
import { Footer } from "@/components/Footer";

export default function Bot() {
  useSeo(getRouteMeta("/bot"));
  return (
    <div className="min-h-screen flex flex-col">
      <TestModeBanner />
      <Header />
      <main id="main" className="flex-1 container max-w-2xl py-10 space-y-4 text-sm text-muted-foreground">
        <h1 className="text-2xl font-semibold text-foreground">Valu8Bot</h1>
        <p>Valu8Bot (<code>Valu8Bot/1.0 (+https://valu8.uk/bot)</code>) occasionally revisits a car advert that one of our users asked us to price-check, to see whether it is still listed and whether the asking price has changed. This helps us measure how accurate our prices are.</p>
        <p>It visits each advert at most four times, no more than once a week, and only between 7 and 60 days after the check. It reads and obeys your <code>robots.txt</code> (for <code>Valu8Bot</code>, otherwise <code>*</code>), honours <code>Crawl-delay</code>, and skips your site if robots.txt can't be read. It makes at most one request to a site per day (a small number, well spaced, for very large classifieds sites).</p>
        <p>We keep only whether the advert is still live and the price shown in the page's structured data. We never store page content, seller names, phone numbers or locations.</p>
        <p>To opt out, block <code>Valu8Bot</code> in your robots.txt or email <a href="mailto:hello@valu8.uk" className="text-primary hover:underline">hello@valu8.uk</a> and we'll stop visiting your site.</p>
      </main>
      <Footer />
    </div>
  );
}
