import { useEffect, useRef, useState, type MouseEvent } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Header, TestModeBanner } from "@/components/Layout";
import { Footer } from "@/components/Footer";
import { GUIDE_ARTICLE_CLASSES, GUIDE_ARTICLE_JSONLD_ID, GUIDE_POPULAR_MODELS, findGuide, guideArticleJsonLd, guideBodyHtml, guideFaqJsonLd, type Guide as GuideData } from "@/data/guides";
import { POPULAR_MODELS_H2, popularModelLabel, popularValueModels } from "@/data/popularModels";
import { valueModelPath } from "@/data/valueModels";
import { useSeo } from "@/lib/seo";
import { getRouteMeta } from "@/data/routeMeta";
import NotFound from "./NotFound";

const ARTICLE_CLASSES = GUIDE_ARTICLE_CLASSES;

function GuideArticle({ guide }: { guide: GuideData }) {
  useSeo(getRouteMeta(guide.path));
  const navigate = useNavigate();

  useEffect(() => {
    let el = document.getElementById("guide-faq-jsonld") as HTMLScriptElement | null;
    if (!el) {
      el = document.createElement("script");
      el.type = "application/ld+json";
      el.id = "guide-faq-jsonld";
      document.head.appendChild(el);
    }
    el.textContent = guideFaqJsonLd(guide);
    let art = document.getElementById(GUIDE_ARTICLE_JSONLD_ID) as HTMLScriptElement | null;
    if (!art) {
      art = document.createElement("script");
      art.type = "application/ld+json";
      art.id = GUIDE_ARTICLE_JSONLD_ID;
      document.head.appendChild(art);
    }
    art.textContent = guideArticleJsonLd(guide);
    return () => {
      document.getElementById("guide-faq-jsonld")?.remove();
      document.getElementById(GUIDE_ARTICLE_JSONLD_ID)?.remove();
    };
  }, [guide]);

  const onClick = (e: MouseEvent<HTMLElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as HTMLElement).closest("a");
    const href = a?.getAttribute("href");
    if (!a || !href || !href.startsWith("/") || href.startsWith("//") || a.target) return;
    e.preventDefault();
    navigate(href);
  };

  // "In this guide" for the laptop rail: read the article's own h2s after render (ids added if missing). No copy added.
  const articleRef = useRef<HTMLElement>(null);
  const [toc, setToc] = useState<{ id: string; label: string }[]>([]);
  useEffect(() => {
    const hs = Array.from(articleRef.current?.querySelectorAll("h2") ?? []);
    setToc(hs.map((h, i) => {
      if (!h.id) h.id = (h.textContent || `section-${i}`).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || `section-${i}`;
      return { id: h.id, label: (h.textContent || "").trim() };
    }).filter((t) => t.label));
  }, [guide]);

  return (
    <div className="min-h-screen flex flex-col">
      <TestModeBanner />
      <Header />
      <main id="main" className="flex-1 container max-w-3xl lg:max-w-6xl py-10 md:py-14">
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start lg:gap-14">
        <div className="min-w-0 lg:max-w-[720px]">
        <article ref={articleRef} className={ARTICLE_CLASSES} onClick={onClick} dangerouslySetInnerHTML={{ __html: guideBodyHtml(guide.markdown) }} />
        <section className="mt-12 border-t border-border pt-8" aria-labelledby="popular-models">
          <h2 id="popular-models" className="text-xl font-semibold mb-3">{POPULAR_MODELS_H2}</h2>
          <ul className="flex flex-wrap gap-2 text-sm">
            {popularValueModels(GUIDE_POPULAR_MODELS).map((v) => (
              <li key={v.slug}>
                <Link to={valueModelPath(v)} className="inline-flex min-h-[44px] items-center rounded-full border border-border px-4 hover:border-primary/50">{popularModelLabel(v)}</Link>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm"><Link to="/value" className="text-primary hover:underline">See typical prices for all models</Link></p>
        </section>
        </div>
        <GuideRail toc={toc} />
        </div>
      </main>
      <Footer />
    </div>
  );
}

/** Laptop-only sticky rail: the free valuation CTA plus jump links to the guide's own headings (data-decor). */
function GuideRail({ toc }: { toc: { id: string; label: string }[] }) {
  return (
    <aside className="hidden lg:block lg:sticky lg:top-24" data-decor="" aria-label="Guide tools">
      <div className="rounded-3xl border border-border bg-card/70 p-6">
        <p className="text-lg font-semibold tracking-tight text-foreground">What's your car worth?</p>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">Enter your reg for a free valuation based on your car's year, mileage and MOT history.</p>
        <Button asChild variant="hero" size="lg" className="mt-5 w-full"><Link to="/">Value my car free <ArrowRight className="h-4 w-4" aria-hidden /></Link></Button>
      </div>
      {toc.length > 1 && (
        <nav aria-label="In this guide" className="mt-4 rounded-2xl border border-border p-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">In this guide</p>
          <ul className="max-h-[50vh] space-y-0.5 overflow-y-auto text-sm">
            {toc.map((t) => (
              <li key={t.id}><a href={`#${t.id}`} className="flex min-h-[36px] items-center rounded-lg px-2 py-1.5 leading-snug text-foreground/80 hover:bg-muted/50 hover:text-foreground">{t.label}</a></li>
            ))}
          </ul>
        </nav>
      )}
    </aside>
  );
}

export default function Guide() {
  const { slug } = useParams();
  const guide = findGuide(slug);
  if (!guide) return <NotFound />;
  return <GuideArticle key={guide.slug} guide={guide} />;
}
