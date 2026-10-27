// Node-safe content for the /car-values pages. Shared by the React pages and the
// build-time HTML (vite.config.ts) so crawlers get the same H1, copy, FAQ and JSON-LD
// without running JavaScript. Deliberately no prices: figures only come from a live valuation.
import { CAR_MODELS, SEGMENT_LABEL, SEGMENT_TIPS, type CarModelPage } from "./carModels";
import { SITE_URL } from "./routeMeta";

export const carName = (m: CarModelPage) => `${m.make} ${m.model}`;
export const carPath = (m: CarModelPage) => `/car-values/${m.makeSlug}/${m.slug}`;

export function carIntro(m: CarModelPage): string {
  const name = carName(m);
  return `Get a free, honest valuation for your ${name} in a couple of minutes. We check the official DVSA MOT record, compare your car with real UK adverts for the same model in our database, and read your photos for condition, then give you private sale, part-exchange and dealer retail figures.`;
}

export function carSteps(m: CarModelPage): string[] {
  const name = carName(m);
  return [
    `Find ${name}s for sale now across UK dealers, close to your year and mileage.`,
    "Correct each listing to your car's exact age and mileage, then take the median.",
    "Adjust for your MOT history (advisories, failures, mileage consistency) and photos.",
    "Convert dealer prices into what you'd realistically get selling privately or part-exchanging.",
  ];
}

export function carFaqs(m: CarModelPage): { q: string; a: string }[] {
  const name = carName(m);
  const seg = SEGMENT_LABEL[m.segment];
  return [
    { q: `How much is my ${name} worth?`, a: `It depends mostly on age, mileage, condition and spec. Valu8 compares your ${name} with similar cars currently for sale in the UK, corrects each one to your car's age and mileage, then adjusts for your MOT history and photos.` },
    { q: `Is a private sale better than part-exchange for a ${name}?`, a: "Usually you'll get more selling privately, because a dealer needs margin to resell. Your report shows both figures so you can decide whether the difference is worth the effort." },
    { q: "Does high mileage hurt the value?", a: `Yes. As a rule of thumb in our model, a car with double the mileage of an otherwise similar ${seg} is worth around 12% less, and very high mileage (over 140,000) carries an extra discount.` },
    { q: "Is Valu8 free?", a: "Yes, during early access. Enter your registration and mileage to get a full report." },
  ];
}

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
    + `<nav aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/car-values">Car values</a> / <span aria-current="page">${name}</span></nav>`
    + `<h1>What's my ${name} worth?</h1>`
    + `<p>${esc(carIntro(m))}</p>`
    + `<p><a href="/valuation/new">Value my ${esc(m.model)} free</a> · <a href="/check">Check a ${esc(m.model)} asking price</a></p>`
    + `<h2>How we value a ${name}</h2><ol>${carSteps(m).map((s) => `<li>${esc(s)}</li>`).join("")}</ol>`
    + `<h2>What moves the value of a ${seg}</h2><ul>${SEGMENT_TIPS[m.segment].map((t) => `<li>${esc(t)}</li>`).join("")}</ul>`
    + `<h2>${name} valuation FAQ</h2>${carFaqs(m).map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join("")}`
    + `<h2>Related valuations</h2><ul>${carRelated(m).map((x) => `<li><a href="${carPath(x)}">${esc(carName(x))}</a></li>`).join("")}<li><a href="/car-values">All models</a></li></ul>`
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
        { "@type": "ListItem", position: 2, name: "Car values", item: `${SITE_URL}/car-values` },
        { "@type": "ListItem", position: 3, name: carName(m), item: SITE_URL + carPath(m) },
      ],
    },
  ]).replace(/</g, "\\u003c");
}

export const CAR_VALUES_H1 = "Car values by make and model";

export function carValuesIndexBodyHtml(): string {
  const makes = [...new Set(CAR_MODELS.map((m) => m.make))].sort();
  return `<main id="main"><h1>${CAR_VALUES_H1}</h1>`
    + `<p>Free, honest valuations for the UK's most popular used cars. Pick your model to see how we value it, or <a href="/valuation/new">value your car now</a>.</p>`
    + makes.map((make) => `<section><h2>${esc(make)}</h2><ul>${CAR_MODELS.filter((m) => m.make === make).map((m) => `<li><a href="${carPath(m)}">${esc(carName(m))} value</a></li>`).join("")}</ul></section>`).join("")
    + `</main>`;
}
