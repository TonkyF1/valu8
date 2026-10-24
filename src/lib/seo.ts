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
    setMeta('meta[name="twitter:title"]', "name", "twitter:title", title);
    setMeta('meta[name="twitter:description"]', "name", "twitter:description", description);
    let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) { link = document.createElement("link"); link.rel = "canonical"; document.head.appendChild(link); }
    const prevCanon = link.href;
    link.href = SITE_URL + path;
    let robots = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (noindex) {
      if (!robots) { robots = document.createElement("meta"); document.head.appendChild(robots); }
      robots.name = "robots"; robots.content = "noindex, follow";
    } else if (robots && /\bnoindex\b/i.test(robots.content)) {
      robots.remove();
      robots = null;
    }
    return () => { document.title = prevTitle; if (link) link.href = prevCanon; if (noindex) robots?.remove(); };
  }, [title, description, path, noindex]);
}
