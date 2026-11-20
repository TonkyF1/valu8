import { Header, TestModeBanner } from "@/components/Layout";
import { Footer } from "@/components/Footer";
import { HomeLink } from "@/components/HomeLink";
import { Link } from "react-router-dom";
import { useSeo } from "@/lib/seo";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Faq, FAQS } from "@/components/home/BuyerSellerSections";

// Titles for new pages are set here until they are added to routeMeta (owned by Marketing).
const META = { path: "/faq", title: "Car valuation FAQs: your questions answered | Valu8", description: "Answers to common questions about Valu8 car valuations: how accurate they are, what the £2.99 report includes, where the data comes from and who can see your valuation." };

export default function FaqPage() {
  useSeo(META);
  return (
    <div className="min-h-screen flex flex-col">
      <TestModeBanner /><Header />
      <main id="main" className="flex-1">
        <header className="container max-w-3xl pt-12 md:pt-16 pb-2">
          <div className="text-xs uppercase tracking-widest text-primary font-semibold mb-2">FAQ</div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gradient mb-4">Car valuation FAQs</h1>
          <p className="text-base text-muted-foreground">Straight answers about how Valu8 values a car, what is free and what the £2.99 report adds.</p>
        </header>
        <div className="bs">
          <Faq cta={false} />
        </div>
        <section className="container max-w-3xl pb-16 pt-2 text-center">
          <h2 className="text-xl font-semibold tracking-tight mb-3">Ready to value your car?</h2>
          <HomeLink focusReg className={cn(buttonVariants({ variant: "hero", size: "lg" }))}>Value a car · Free</HomeLink>
          <p className="mt-4 text-sm"><Link to="/pricing" className="text-primary hover:underline">Pricing</Link> · <Link to="/guides" className="text-primary hover:underline">Guides</Link> · <Link to="/faq" className="text-primary hover:underline">FAQ</Link></p>
        </section>
      </main>
      <Footer />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org", "@type": "FAQPage",
        mainEntity: FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      }) }} />
    </div>
  );
}
