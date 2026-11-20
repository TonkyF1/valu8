import { Header, TestModeBanner } from "@/components/Layout";
import { Footer } from "@/components/Footer";
import { HomeLink } from "@/components/HomeLink";
import { Link } from "react-router-dom";
import { useSeo } from "@/lib/seo";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { HowItWorks, ValuationContext, WhyValu8 } from "@/components/home/BuyerSellerSections";

// Titles for new pages are set here until they are added to routeMeta (owned by Marketing).
const META = { path: "/how-it-works", title: "How Valu8 works: free car valuation by reg | Valu8", description: "How Valu8 turns a UK number plate into a free car valuation: comparable adverts, age and mileage, official MOT history and optional photos." };

export default function HowItWorksPage() {
  useSeo(META);
  return (
    <div className="min-h-screen flex flex-col">
      <TestModeBanner /><Header />
      <main id="main" className="flex-1">
        <header className="container max-w-3xl pt-12 md:pt-16 pb-2">
          <div className="text-xs uppercase tracking-widest text-primary font-semibold mb-2">How it works</div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gradient mb-4">How Valu8 works</h1>
          <p className="text-base text-muted-foreground">Enter a UK number plate and get a free private-sale estimate built from comparable adverts, adjusted for age and mileage and backed by official MOT history.</p>
        </header>
        <div className="bs">
          <HowItWorks />
          <div className="bs-rule" />
          <ValuationContext />
          <div className="bs-rule" />
          <WhyValu8 />
        </div>
        <section className="container max-w-3xl pb-16 pt-2 text-center">
          <h2 className="text-xl font-semibold tracking-tight mb-3">Ready to value your car?</h2>
          <HomeLink focusReg className={cn(buttonVariants({ variant: "hero", size: "lg" }))}>Value a car · Free</HomeLink>
          <p className="mt-4 text-sm"><Link to="/pricing" className="text-primary hover:underline">Pricing</Link> · <Link to="/guides" className="text-primary hover:underline">Guides</Link> · <Link to="/faq" className="text-primary hover:underline">FAQ</Link></p>
        </section>
      </main>
      <Footer />

    </div>
  );
}
