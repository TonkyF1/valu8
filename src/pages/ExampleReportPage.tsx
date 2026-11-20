import { Header, TestModeBanner } from "@/components/Layout";
import { Footer } from "@/components/Footer";
import { HomeLink } from "@/components/HomeLink";
import { Link } from "react-router-dom";
import { useSeo } from "@/lib/seo";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ExampleReport, PremiumSection } from "@/components/home/BuyerSellerSections";

// Titles for new pages are set here until they are added to routeMeta (owned by Marketing).
const META = { path: "/example-report", title: "Example Valu8 car valuation report | Valu8", description: "See what a Valu8 car valuation report looks like: the private-sale estimate, the buyer and seller guidance in the £2.99 report, and how the figures are set out." };

export default function ExampleReportPage() {
  useSeo(META);
  return (
    <div className="min-h-screen flex flex-col">
      <TestModeBanner /><Header />
      <main id="main" className="flex-1">
        <header className="container max-w-3xl pt-12 md:pt-16 pb-2">
          <div className="text-xs uppercase tracking-widest text-primary font-semibold mb-2">Example report</div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gradient mb-4">Example Valu8 car valuation report</h1>
          <p className="text-base text-muted-foreground">An illustrative report for a made-up car, showing the buying and selling guidance the £2.99 report adds to the free valuation.</p>
        </header>
        <div className="bs">
          <ExampleReport />
          <div className="bs-rule" />
          <PremiumSection />
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
