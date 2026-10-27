import { CAR_MODELS, type CarModelPage } from "./carModels";
import { GUIDES } from "./guides";

export const SITE_URL = "https://valu8.uk";

export type RouteMeta = {
  path: string;
  title: string;
  description: string;
  priority?: string;
  noindex?: boolean;
  inSitemap: boolean;
};

export const STATIC_ROUTES: RouteMeta[] = [
  { path: "/", title: "Valu8: what's my car worth? Free UK car valuation", description: "Free UK car valuation for private sellers. Thousands of real UK adverts, DVSA MOT history and photo checks give you a realistic private sale price and asking price.", priority: "1.0", inSitemap: true },
  { path: "/valuation/new", title: "New valuation — Valu8", description: "Enter a UK registration to get a free private sale valuation in minutes.", priority: "0.9", inSitemap: true },
  { path: "/check", title: "Is this used car a fair price? Free advert price checker | Valu8", description: "Enter a UK used car advert's make, model, year, mileage and asking price. We'll tell you if it's overpriced, fair or a bargain against UK market data.", priority: "0.8", inSitemap: true },
  { path: "/accuracy", title: "How accurate is Valu8? Predicted vs real sale prices", description: "We compare our car valuations with the prices people actually sell for, and will publish the results once enough owners report a sale.", priority: "0.6", inSitemap: true },
  { path: "/car-values", title: "Car values by make and model | Valu8", description: "Free valuations for the UK's most popular cars, from the Ford Fiesta to the Tesla Model 3.", priority: "0.8", inSitemap: true },
  { path: "/pricing", title: "Pricing — Valu8", description: "Valu8 is free during early access: valuations using UK market data from our advert database, MOT history, photo condition analysis and ready-to-post adverts.", priority: "0.6", inSitemap: true },
  { path: "/about", title: "About Valu8: who we are and how valuations work", description: "Valu8 is an independent UK car valuation service for private sellers and buyers. How our valuations work, and how to get in touch.", priority: "0.4", inSitemap: true },
  { path: "/contact", title: "Contact Valu8 — get in touch", description: "Get in touch with Valu8 about your UK car valuation, account or feedback.", priority: "0.3", inSitemap: true },
  { path: "/privacy", title: "Privacy Policy — Valu8", description: "How Valu8 collects, uses and protects your data under UK GDPR.", priority: "0.3", inSitemap: true },
  { path: "/terms", title: "Terms of Service — Valu8", description: "The terms for using Valu8 car valuations.", priority: "0.3", inSitemap: true },
  { path: "/disclaimers", title: "Disclaimers & Data Sources — Valu8", description: "What a Valu8 report is and is not: data sources, AI use and limitations.", priority: "0.3", inSitemap: true },
  { path: "/auth", title: "Sign in — Valu8", description: "Sign in or create a free Valu8 account to save your car valuations.", noindex: true, inSitemap: false },
  { path: "/reset-password", title: "Reset password — Valu8", description: "Set a new password for your Valu8 account using your password reset link.", noindex: true, inSitemap: false },
  { path: "/dashboard", title: "Dashboard — Valu8", description: "View and manage your saved Valu8 car valuations and reports.", noindex: true, inSitemap: false },
  { path: "/profile", title: "Profile — Valu8", description: "Manage your Valu8 profile, account details and sign-in settings.", noindex: true, inSitemap: false },
  { path: "/compare", title: "Compare cars — Valu8", description: "Compare two of your saved Valu8 car valuations side by side.", noindex: true, inSitemap: false },
  { path: "/bot", title: "Valu8Bot — Valu8", description: "What Valu8Bot is, how it re-checks advert links politely, and how to opt out.", noindex: true, inSitemap: false },
  { path: "/admin", title: "Admin — Valu8", description: "Valu8 administration and service statistics for authorised administrators.", noindex: true, inSitemap: false },
];

export function carModelMeta(m: CarModelPage): RouteMeta {
  const name = `${m.make} ${m.model}`;
  return {
    path: `/car-values/${m.makeSlug}/${m.slug}`,
    title: `What's my ${name} worth? Free ${name} valuation | Valu8`,
    description: `Free ${name} valuation using real UK adverts in our database, your MOT history and photos. See private sale, part-exchange and dealer values for your ${name}.`,
    priority: "0.7",
    inSitemap: true,
  };
}

export const CAR_MODEL_ROUTES = CAR_MODELS.map(carModelMeta);
export const GUIDE_ROUTES: RouteMeta[] = [
  { path: "/guides", title: "Car valuation, buying and selling guides | Valu8", description: "Free, plain-English UK guides to valuing, buying and selling a used car: part-exchange vs private sale, spotting an overpriced advert, selling safely and checking MOT history.", priority: "0.7", inSitemap: true },
  ...GUIDES.map((g): RouteMeta => ({ path: g.path, title: g.title, description: g.description, priority: "0.6", inSitemap: true })),
];
export const ALL_ROUTES = [...STATIC_ROUTES, ...GUIDE_ROUTES, ...CAR_MODEL_ROUTES];

/** Unknown paths must not silently inherit the homepage's metadata. */
export function getRouteMeta(path: string): RouteMeta {
  const pathname = path.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  const meta = ALL_ROUTES.find((route) => route.path === pathname);
  if (!meta) throw new Error(`Missing route metadata: ${pathname}`);
  return meta;
}