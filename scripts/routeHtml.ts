import { SITE_URL, type RouteMeta } from "../src/data/routeMeta";

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function tagPattern(tag: "meta" | "link", attr: string, value: string): RegExp {
  return new RegExp(`<${tag}\\b(?=[^>]*\\b${attr}\\s*=\\s*(["'])${value}\\1)[^>]*>`, "gi");
}

function replaceRequired(html: string, pattern: RegExp, replacement: string, label: string): string {
  const matches = html.match(pattern);
  if (matches?.length !== 1) throw new Error(`Route HTML: expected exactly one ${label}, found ${matches?.length ?? 0}`);
  return html.replace(pattern, () => replacement);
}

/** Only edit the head: the emitted SPA body and asset URLs remain byte-identical. */
export function routeHtml(shell: string, meta: Pick<RouteMeta, "path" | "title" | "description" | "noindex">, notFound = false, extra?: { bodyHtml?: string; headHtml?: string }): string {
  const headPattern = /<head\b[^>]*>[\s\S]*?<\/head\s*>/gi;
  if (shell.match(headPattern)?.length !== 1) throw new Error("Route HTML: expected exactly one head");
  let out = shell.replace(headPattern, (originalHead) => {
    let head = replaceRequired(originalHead, /<title\b[^>]*>[\s\S]*?<\/title\s*>/gi, `<title>${escapeHtml(meta.title)}</title>`, "title");
    const url = escapeHtml(SITE_URL + meta.path);
    head = replaceRequired(head, tagPattern("link", "rel", "canonical"), notFound ? "" : `<link rel="canonical" href="${url}" />`, "canonical");
    const tags: ["name" | "property", string, string][] = [
      ["name", "description", meta.description],
      ["property", "og:url", SITE_URL + meta.path],
      ["property", "og:title", meta.title],
      ["property", "og:description", meta.description],
      ["name", "twitter:title", meta.title],
      ["name", "twitter:description", meta.description],
    ];
    for (const [attr, key, value] of tags) {
      head = replaceRequired(head, tagPattern("meta", attr, key), notFound && key === "og:url" ? "" : `<meta ${attr}="${key}" content="${escapeHtml(value)}" />`, key);
    }
    head = head.replace(tagPattern("meta", "name", "robots"), "");
    if (meta.noindex || notFound) head = head.replace(/<\/head\s*>/i, `<meta name="robots" content="${notFound ? "noindex" : "noindex, follow"}" />\n</head>`);
    if (extra?.headHtml) head = head.replace(/<\/head\s*>/i, () => `${extra.headHtml}\n</head>`);
    return head;
  });
  if (extra?.bodyHtml !== undefined) {
    const rootPattern = /<div id="root"><\/div>/g;
    if (out.match(rootPattern)?.length !== 1) throw new Error("Route HTML: expected exactly one empty root div");
    out = out.replace(rootPattern, () => `<div id="root">${extra.bodyHtml}</div>`);
  }
  return out;
}