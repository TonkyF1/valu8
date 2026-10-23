import { useEffect } from "react";

import { SITE_URL } from "./site";
export { SITE_URL };

function setMeta(selector: string, attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) { el = document.createElement("meta"); el.setAttribute(attr, key); document.head.appendChild(el); }
  el.setAttribute("content", content);
}

/** Client-side title/description/canonical. Google renders JS so this is indexed;
 *  social crawlers that don't run JS still see index.html defaults. */
export function useSeo({ title, description, path, noindex = false }: { title: string; description: string; path: string; noindex?: boolean }) {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = title;
    setMeta('meta[name="description"]', "name", "description", description);
    setMeta('meta[property="og:title"]', "property", "og:title", title);
    setMeta('meta[property="og:description"]', "property", "og:description", description);
    setMeta('meta[property="og:url"]', "property", "og:url", SITE_URL + path);
    let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) { link = document.createElement("link"); link.rel = "canonical"; document.head.appendChild(link); }
    const prevCanon = link.href;
    link.href = SITE_URL + path;
    let robots: HTMLMetaElement | null = null;
    if (noindex) {
      robots = document.createElement("meta");
      robots.name = "robots"; robots.content = "noindex, follow";
      document.head.appendChild(robots);
    }
    return () => { document.title = prevTitle; if (link) link.href = prevCanon; robots?.remove(); };
  }, [title, description, path, noindex]);
}
