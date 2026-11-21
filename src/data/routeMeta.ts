import { CAR_MODELS, type CarModelPage } from "./carModels";
import { GUIDES } from "./guides";
import { joinMakeModel } from "./valueModels";
import { modelDisplayName } from "./modelDisplayName";
import { VALUE_SLUG_REGISTRY } from "./valueSlugRegistry";

export const SITE_URL = "https://valu8.uk";

export type RouteMeta = {
  path: string;
  title: string;
  description: string;
  priority?: string;
  noindex?: boolean;
  inSitemap: boolean;
  /** When set, build HTML + client SEO emit this URL as rel=canonical (and og:url). */
  canonicalPath?: string;
  /** Sitemap <lastmod> (YYYY-MM-DD). Otherwise taken from PAGE_LASTMOD (pageLastmod.ts). */
  lastmod?: string;
};

export const STATIC_ROUTES: RouteMeta[] = [
  { path: "/", title: "Free Car Valuation Online by Reg | Value My Car UK | Valu8", description: "Value your car free by registration: an instant UK private-sale estimate with official DVSA MOT history. Buying? Check any advert. Full report £2.99.", priority: "1.0", inSitemap: true },
  { path: "/valuation/new", title: "New valuation | Valu8", description: "Enter a UK registration to get a free private sale valuation in minutes.", inSitemap: false, canonicalPath: "/" },
  { path: "/check", title: "Car price check: is this used car a fair price? | Valu8", description: "Free used car price checker. Enter any UK advert's make, model, year, mileage and asking price to see if it's overpriced, fair or a bargain.", priority: "0.8", inSitemap: true },
  { path: "/accuracy", title: "How accurate is Valu8? Predicted vs real sale prices", description: "We compare our car valuations with the prices people actually sell for, and will publish the results once enough owners report a sale.", noindex: true, inSitemap: false },
  { path: "/car-values", title: "Car values by make and model | Valu8", description: "Free online car valuation by registration, plus typical UK asking prices by year for the most popular models. See what your car is worth to sell.", priority: "0.8", inSitemap: true },
  { path: "/pricing", title: "Pricing | Valu8", description: "Essentials valuations are free. The Full seller report is a one-off £2.99, no subscription. Pay by card, Apple Pay or Google Pay.", priority: "0.6", inSitemap: true },
  { path: "/how-it-works", title: "How Valu8 works: free car valuation by reg | Valu8", description: "How Valu8 turns a UK number plate into a free car valuation: comparable adverts, age and mileage, official MOT history and optional photos.", priority: "0.6", inSitemap: true },
  { path: "/faq", title: "Car valuation FAQs: your questions answered | Valu8", description: "Straight answers on Valu8 car valuations: what's free, what the £2.99 report adds, how prices are worked out and who can see your valuation.", priority: "0.5", inSitemap: true },
  { path: "/example-report", title: "Example Valu8 car valuation report | Valu8", description: "See an illustrative £2.99 Valu8 report for a 2018 Ford Fiesta: private-sale, part-exchange and dealer figures, plus buying and selling guidance.", priority: "0.5", inSitemap: true },
  { path: "/about", title: "About Valu8: who we are and how valuations work", description: "Valu8 is an independent UK car valuation service for private sellers and buyers. How our valuations work, and how to get in touch.", priority: "0.4", inSitemap: true },
  { path: "/contact", title: "Contact Valu8 — get in touch", description: "Get in touch with Valu8 about your UK car valuation, account or feedback.", priority: "0.3", inSitemap: true },
  { path: "/privacy", title: "Privacy Policy — Valu8", description: "How Valu8 collects, uses and protects your data under UK GDPR.", priority: "0.3", inSitemap: true },
  { path: "/terms", title: "Terms of Service — Valu8", description: "The terms for using Valu8 car valuations.", priority: "0.3", inSitemap: true },
  { path: "/disclaimers", title: "Disclaimers & Data Sources — Valu8", description: "What a Valu8 report is and is not: data sources, AI use and limitations.", priority: "0.3", inSitemap: true },
  { path: "/embed-info", title: "Free car valuation box for your website | Valu8", description: "Add a free \"What's my car worth?\" number plate box to your garage, blog or car club site. One line of code, no fee, no sign-up.", priority: "0.5", inSitemap: true },
  { path: "/auth", title: "Sign in — Valu8", description: "Sign in or create a free Valu8 account to save your car valuations.", noindex: true, inSitemap: false },
  { path: "/reset-password", title: "Reset password — Valu8", description: "Set a new password for your Valu8 account using your password reset link.", noindex: true, inSitemap: false },
  { path: "/dashboard", title: "Dashboard — Valu8", description: "View and manage your saved Valu8 car valuations and reports.", noindex: true, inSitemap: false },
  { path: "/profile", title: "Profile — Valu8", description: "Manage your Valu8 profile, account details and sign-in settings.", noindex: true, inSitemap: false },
  { path: "/compare", title: "Compare cars — Valu8", description: "Compare two of your saved Valu8 car valuations side by side.", noindex: true, inSitemap: false },
  { path: "/bot", title: "Valu8Bot — Valu8", description: "What Valu8Bot is, how it re-checks advert links politely, and how to opt out.", noindex: true, inSitemap: false },
  { path: "/admin", title: "Admin — Valu8", description: "Valu8 administration and service statistics for authorised administrators.", noindex: true, inSitemap: false },
  { path: "/check-an-advert", title: "Used car advert price check | Valu8", description: "Check whether a UK used car advert's asking price is fair with Valu8's free advert price checker.", noindex: true, inSitemap: false, canonicalPath: "/check" },
  { path: "/buyer", title: "Used car price check for buyers | Valu8", description: "Buying a used car? Check whether the advert's asking price is fair with Valu8's free advert price checker.", noindex: true, inSitemap: false, canonicalPath: "/check" },
  { path: "/unsubscribe", title: "Unsubscribe — Valu8", description: "Stop Valu8 emails with one click. No sign-in needed.", noindex: true, inSitemap: false },
  { path: "/email-answer", title: "Thanks for your answer — Valu8", description: "Your reply to a Valu8 follow-up email has been recorded.", noindex: true, inSitemap: false },
];

export function carModelMeta(m: CarModelPage): RouteMeta {
  const name = joinMakeModel(m.make, m.model);
  // /value/<make-model> is the only indexable model page. A /car-values/* page with a /value match is a
  // permanent redirect there (noindex, canonical + refresh to /value; built in scripts/routePages.ts).
  const valueSlug = `${m.makeSlug}-${m.slug}`;
  const valueMatch = VALUE_SLUG_REGISTRY.find((v) => v.slug === valueSlug);
  return {
    path: `/car-values/${m.makeSlug}/${m.slug}`,
    title: valueMatch ? `${modelDisplayName(valueMatch)} prices and valuation | Valu8` : `What's my ${name} worth? Free ${name} valuation | Valu8`,
    description: `Free ${name} valuation using real UK adverts in our database, your MOT history and photos. See an estimated private-sale value for your ${name}.`,
    priority: "0.7",
    inSitemap: !valueMatch,
    ...(valueMatch ? { canonicalPath: `/value/${valueSlug}`, noindex: true } : {}),
  };
}

export const CAR_MODEL_ROUTES = CAR_MODELS.map(carModelMeta);
export const GUIDE_ROUTES: RouteMeta[] = [
  { path: "/guides", title: "Car valuation, buying and selling guides | Valu8", description: "Free, plain-English UK guides to valuing, buying and selling a used car: part-exchange vs private sale, spotting an overpriced advert, selling safely and checking MOT history.", priority: "0.7", inSitemap: true },
  ...GUIDES.map((g): RouteMeta => ({ path: g.path, title: g.title, description: g.description, priority: "0.6", inSitemap: true })),
];
/** Everything except the /value/* price pages. Those live in valueRoutes.ts (with the price tables) so the
 *  main bundle stays small; build-time code (vite.config.ts, sitemap, IndexNow) uses ALL_ROUTES from allRoutes.ts. */
export const BASE_ROUTES = [...STATIC_ROUTES, ...GUIDE_ROUTES, ...CAR_MODEL_ROUTES];

/** Unknown paths must not silently inherit the homepage's metadata. */
export function getRouteMeta(path: string): RouteMeta {
  const pathname = path.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  const meta = BASE_ROUTES.find((route) => route.path === pathname);
  if (!meta) throw new Error(`Missing route metadata: ${pathname}`);
  return meta;
}
