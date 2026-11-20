import { getRouteMeta } from "@/data/routeMeta";

type Meta = ReturnType<typeof getRouteMeta>;

/** Uses the route's entry in routeMeta. Until those entries are on this branch (they arrive with the SEO follow-up),
 *  falls back to the same wording so the page never throws. */
export function newPageMeta(path: string, fallback: { title: string; description: string }): Pick<Meta, "path" | "title" | "description"> {
  try { return getRouteMeta(path); } catch { return { path, ...fallback }; }
}

/** Create or update a JSON-LD script by id, and return a cleanup that removes it (same pattern as Guide.tsx). */
export function setJsonLd(id: string, data: unknown): () => void {
  let el = document.getElementById(id) as HTMLScriptElement | null;
  if (!el) { el = document.createElement("script"); el.type = "application/ld+json"; el.id = id; document.head.appendChild(el); }
  el.textContent = JSON.stringify(data);
  return () => { document.getElementById(id)?.remove(); };
}
