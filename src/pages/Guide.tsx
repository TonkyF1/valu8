import { useEffect, type MouseEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Header, TestModeBanner } from "@/components/Layout";
import { Footer } from "@/components/Footer";
import { GUIDE_ARTICLE_JSONLD_ID, GUIDE_POPULAR_MODELS, findGuide, guideArticleJsonLd, guideBodyHtml, guideFaqJsonLd, type Guide as GuideData } from "@/data/guides";
import { POPULAR_MODELS_H2, popularModelLabel, popularValueModels } from "@/data/popularModels";
import { valueModelPath } from "@/data/valueModels";
import { useSeo } from "@/lib/seo";
import { getRouteMeta } from "@/data/routeMeta";
import NotFound from "./NotFound";

const ARTICLE_CLASSES = [
  "guide-body max-w-none text-foreground/85 leading-relaxed",
  "[&_h1]:text-3xl [&_h1]:font-semibold [&_h1]:tracking-tight [&_h1]:text-foreground [&_h1]:mb-6",
  "[&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:mt-10 [&_h2]:mb-3",
  "[&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-foreground [&_h3]:mt-6 [&_h3]:mb-2",
  "[&_p]:my-4 [&_strong]:text-foreground [&_strong]:font-semibold",
  "[&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-4 [&_li]:my-1.5",
  "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2",
  "[&_hr]:my-10 [&_hr]:border-border",
  "[&_.guide-table]:my-6 [&_.guide-table]:overflow-x-auto [&_.guide-table]:rounded-xl [&_.guide-table]:border [&_.guide-table]:border-border",
  "[&_table]:w-full [&_table]:text-sm [&_th]:text-left [&_th]:font-medium [&_th]:text-muted-foreground [&_th]:px-4 [&_th]:py-3 [&_td]:px-4 [&_td]:py-3 [&_tr]:border-b [&_tr]:border-border [&_tbody_tr:last-child]:border-0",
].join(" ");

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

  return (
    <div className="min-h-screen flex flex-col">
      <TestModeBanner />
      <Header />
      <main id="main" className="flex-1 container max-w-3xl py-10 md:py-14">
        <article className={ARTICLE_CLASSES} onClick={onClick} dangerouslySetInnerHTML={{ __html: guideBodyHtml(guide.markdown) }} />
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
      </main>
      <Footer />
    </div>
  );
}

export default function Guide() {
  const { slug } = useParams();
  const guide = findGuide(slug);
  if (!guide) return <NotFound />;
  return <GuideArticle key={guide.slug} guide={guide} />;
}
