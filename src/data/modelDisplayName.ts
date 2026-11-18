// The one helper for showing a model's name on /value pages, year pages, the /value hub, /car-values redirect
// pages, related links, breadcrumbs and JSON-LD. Display only: slugs, URLs, data keys and the sitemap never use it.
import { joinMakeModel } from "./valueModels";
import { VALUE_SLUG_REGISTRY } from "./valueSlugRegistry";

type NameRef = { slug: string; make: string; model: string };

/** Spellings the advert data gets wrong, keyed by slug. Add overrides only; everything else uses make + model. */
export const DISPLAY_NAME_OVERRIDES: Record<string, string> = {
  "mercedes-benz-a-class": "Mercedes-Benz A-Class",
  "mercedes-benz-b-class": "Mercedes-Benz B-Class",
  "mercedes-benz-c-class": "Mercedes-Benz C-Class",
  "mercedes-benz-e-class": "Mercedes-Benz E-Class",
  "ds-ds-3": "DS 3",
  "ds-ds-4": "DS 4",
};

/** Display name from a model ref, or from a published /value slug (falls back to the slug if unknown). */
export function modelDisplayName(ref: NameRef | string): string {
  const r = typeof ref === "string" ? VALUE_SLUG_REGISTRY.find((x) => x.slug === ref) : ref;
  const slug = typeof ref === "string" ? ref : ref.slug;
  if (DISPLAY_NAME_OVERRIDES[slug]) return DISPLAY_NAME_OVERRIDES[slug];
  return r ? joinMakeModel(r.make, r.model) : slug;
}
