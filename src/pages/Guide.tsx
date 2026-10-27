import { useEffect, type MouseEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Header, TestModeBanner } from "@/components/Layout";
import { Footer } from "@/components/Footer";
import { findGuide, guideBodyHtml, guideFaqJsonLd, type Guide as GuideData } from "@/data/guides";
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
    return () => { document.getElementById("guide-faq-jsonld")?.remove(); };
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
