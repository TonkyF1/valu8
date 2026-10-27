import { Link } from "react-router-dom";
import { Header, TestModeBanner } from "@/components/Layout";
import { Footer } from "@/components/Footer";
import { GUIDES, GUIDES_INDEX_H1 } from "@/data/guides";
import { useSeo } from "@/lib/seo";
import { getRouteMeta } from "@/data/routeMeta";

export default function GuidesIndex() {
  useSeo(getRouteMeta("/guides"));
  return (
    <div className="min-h-screen flex flex-col">
      <TestModeBanner />
      <Header />
      <main id="main" className="flex-1 container max-w-3xl py-10 md:py-14">
        <h1 className="text-3xl font-semibold tracking-tight mb-6">{GUIDES_INDEX_H1}</h1>
        <ul className="space-y-5">
          {GUIDES.map((g) => (
            <li key={g.slug}>
              <Link className="inline-flex min-h-[44px] items-center text-lg font-medium text-primary hover:underline" to={g.path}>{g.h1}</Link>
              <p className="text-sm text-muted-foreground">{g.description}</p>
            </li>
          ))}
        </ul>
      </main>
      <Footer />
    </div>
  );
}
