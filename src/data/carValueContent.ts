// Node-safe content for the /car-values pages. Shared by the React pages and the
// build-time HTML (vite.config.ts) so crawlers get the same H1, copy, FAQ and JSON-LD
// without running JavaScript. Deliberately no prices: figures only come from a live valuation.
import { CAR_MODELS, SEGMENT_LABEL, SEGMENT_TIPS, type CarModelPage } from "./carModels";
import { SITE_URL } from "./routeMeta";
import { VALUE_SLUG_REGISTRY } from "./valueSlugRegistry";
import { joinMakeModel, valueModelPath, type ValueModel } from "./valueModels";
import { modelDisplayName } from "./modelDisplayName";

/** The matching /value/<make-model> page, when one has been published (registry: it stays served even if
 *  its price data drops out, so a matched /car-values page never flips back to a competing live page). */
export const carValueMatch = (m: CarModelPage): ValueModel | undefined => VALUE_SLUG_REGISTRY.find((p) => p.slug === `${m.makeSlug}-${m.slug}`);

export const carValueLinkText = (m: CarModelPage) => `Typical ${carName(m)} asking prices by year`;

export const carName = (m: CarModelPage) => joinMakeModel(m.make, m.model);
export const carPath = (m: CarModelPage) => `/car-values/${m.makeSlug}/${m.slug}`;

export function carIntro(m: CarModelPage): string {
  const name = carName(m);
  return `Get a free, honest valuation for your ${name} in a couple of minutes. We check the official DVSA MOT record, compare your car with real UK adverts for the same model in our database, and read your photos for condition, then give you a free private-sale estimate, with part-exchange and dealer figures in the £2.99 Premium Report.`;
}

/** "How we value a …" steps, from the model name alone (shared by /car-values and /value pages). */
export function modelSteps(name: string): string[] {
  return [
    `Find ${name}s for sale now across UK dealers, close to your year and mileage.`,
    "Adjust each listing for your car's age and mileage, then take the median.",
    "Adjust for your MOT history (advisories, failures, mileage consistency) and photos.",
    "Convert dealer prices into what you'd realistically get selling privately or part-exchanging.",
  ];
}

/** Valuation FAQ from the model name; segLabel (e.g. "supermini") is used when the segment is known. */
export function modelFaqs(name: string, segLabel?: string): { q: string; a: string }[] {
  const seg = segLabel ?? "car";
  return [
    { q: `How much is my ${name} worth?`, a: `It depends mostly on age, mileage, condition and spec. Valu8 compares your ${name} with similar cars currently for sale in the UK, corrects each one to your car's age and mileage, then adjusts for your MOT history and photos.` },
    { q: `Is a private sale better than part-exchange for a ${name}?`, a: "Usually you'll get more selling privately, because a dealer needs margin to resell. The £2.99 Premium Report shows both figures so you can decide whether the difference is worth the effort." },
    { q: "Does high mileage hurt the value?", a: `Yes. As a rule of thumb in our model, a car with double the mileage of an otherwise similar ${seg} is worth around 12% less, and very high mileage (over 140,000) carries an extra discount.` },
    { q: "Is Valu8 free?", a: "The valuation (Essentials) is free. The Full seller report is a one-off £2.99 — no subscription." },
  ];
}

export const carSteps = (m: CarModelPage): string[] => modelSteps(carName(m));
export const carFaqs = (m: CarModelPage): { q: string; a: string }[] => modelFaqs(carName(m), SEGMENT_LABEL[m.segment]);

/** Where internal links to a model should point: its /value page when one exists (the only indexable
 *  model page), otherwise the /car-values page. */
export const carHref = (m: CarModelPage): string => { const v = carValueMatch(m); return v ? valueModelPath(v) : carPath(m); };

/** Lovable hosting can't send a server-side 301, so old URLs use the strongest client-side equivalent Google
 *  documents: an instant meta refresh (read as a permanent redirect), a JS location.replace for browsers and
 *  renderers, and a canonical to the target (from routeMeta.ts). Deliberately no noindex: noindex alongside a
 *  canonical/redirect is a mixed signal and can stop ranking signals passing to the target. */
export function redirectHeadHtml(path: string): string {
  return `<meta http-equiv="refresh" content="0; url=${SITE_URL}${path}">\n`
    + `<script>location.replace(${JSON.stringify(path)}+location.search+location.hash)</script>`;
}

/** Matched /car-values pages are permanent redirects to /value: refresh tag and a one-link body
 *  (title and canonical come from carModelMeta in routeMeta.ts). */
export const carRedirectName = (v: ValueModel) => modelDisplayName(v);
export const carRedirectHeadHtml = (v: ValueModel) => redirectHeadHtml(valueModelPath(v));
export const carRedirectBodyHtml = (v: ValueModel) => `<p><a href="${valueModelPath(v)}">This page has moved to ${esc(carRedirectName(v))} prices and valuation</a></p>`;

/** The old /car-values hub redirects to /value, the hub of every model page (same job: pick a model). */
export const CAR_VALUES_HUB_TARGET = "/value";
export const carValuesHubHeadHtml = () => redirectHeadHtml(CAR_VALUES_HUB_TARGET);
export const carValuesHubBodyHtml = () => `<p><a href="${CAR_VALUES_HUB_TARGET}">This page has moved to car values by make and model</a></p>`;

export function carRelated(m: CarModelPage): CarModelPage[] {
  const sameMake = CAR_MODELS.filter((x) => x.make === m.make && x !== m);
  const sameSegment = CAR_MODELS.filter((x) => x.segment === m.segment && x !== m).slice(0, 6);
  return [...sameMake, ...sameSegment.filter((x) => !sameMake.includes(x))];
}

function esc(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Static body for crawlers; React replaces it on load. */
export function carModelBodyHtml(m: CarModelPage): string {
  const name = esc(carName(m));
  const seg = esc(SEGMENT_LABEL[m.segment]);
  return `<main id="main"><article>`
    + `<nav aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/value">Car values</a> / <span aria-current="page">${name}</span></nav>`
    + `<h1>What's my ${name} worth?</h1>`
    + `<p>${esc(carIntro(m))}</p>`
    + `<p><a href="/valuation/new">Value my ${esc(carName(m))} free</a> · <a href="/check">Check a ${esc(carName(m))} asking price</a></p>`
    + (carValueMatch(m) ? `<p><a href="/value/${carValueMatch(m)!.slug}">${esc(carValueLinkText(m))}</a></p>` : "")
    + `<h2>How we value a ${name}</h2><ol>${carSteps(m).map((s) => `<li>${esc(s)}</li>`).join("")}</ol>`
    + `<h2>What moves the value of a ${seg}</h2><ul>${SEGMENT_TIPS[m.segment].map((t) => `<li>${esc(t)}</li>`).join("")}</ul>`
    + `<h2>${name} valuation FAQ</h2>${carFaqs(m).map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join("")}`
    + `<h2>Related valuations</h2><ul>${carRelated(m).map((x) => `<li><a href="${carHref(x)}">${esc(carName(x))}</a></li>`).join("")}<li><a href="/value">All models</a></li></ul>`
    + `</article></main>`;
}

/** FAQPage + BreadcrumbList JSON-LD (escaped for inline <script>). */
export function carModelJsonLd(m: CarModelPage): string {
  return JSON.stringify([
    {
      "@context": "https://schema.org", "@type": "FAQPage",
      mainEntity: carFaqs(m).map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
    {
      "@context": "https://schema.org", "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
        { "@type": "ListItem", position: 2, name: "Car values", item: `${SITE_URL}/value` },
        { "@type": "ListItem", position: 3, name: carName(m), item: SITE_URL + carPath(m) },
      ],
    },
  ]).replace(/</g, "\\u003c");
}

