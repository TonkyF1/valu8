// Valu8 — Resend email helpers: sending, signed tokens (unsubscribe + one-tap answers), premium table-based layout.
// Layout rules: tables + inline styles only (Gmail/Outlook/Apple Mail), dark header band so the logo works in light
// and dark mode, colour-scheme meta + prefers-color-scheme overrides, and a plain-text part for every email.
export const FROM = "Valu8 <reports@notify.valu8.uk>";
export const REPLY_TO = "hello@valu8.uk";
export const SITE = "https://valu8.uk";
export const LOGO_URL = `${SITE}/email-logo.png`; // 300x126 PNG on #0b1111, shown at 120x50
export const LEGAL_LINE = "Tony Fisher trading as Valu8";

const enc = new TextEncoder();
const b64url = (buf: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (s: string) => atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));

async function hmac(data: string): Promise<string> {
  const secret = Deno.env.get("EMAIL_UNSUB_SECRET");
  if (!secret) throw new Error("EMAIL_UNSUB_SECRET missing");
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

// Domain-separated signing: an unsubscribe token can never be replayed as an answer token and vice versa.
async function sign(purpose: string, payload: unknown): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify(payload)));
  return `${body}.${await hmac(purpose === "unsub" ? body : `${purpose}.${body}`)}`;
}
async function verify(purpose: string, token: string): Promise<any | null> {
  if (typeof token !== "string" || token.length > 600) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expect = await hmac(purpose === "unsub" ? body : `${purpose}.${body}`);
  if (expect.length !== sig.length) return null;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= expect.charCodeAt(i) ^ sig.charCodeAt(i);
  if (diff) return null;
  try { return JSON.parse(fromB64url(body)); } catch { return null; }
}

export interface UnsubPayload { e: string; u?: string }

export async function makeUnsubToken(p: UnsubPayload): Promise<string> {
  return sign("unsub", { e: p.e.toLowerCase(), u: p.u });
}

export async function readUnsubToken(token: string): Promise<UnsubPayload | null> {
  const p = await verify("unsub", token);
  return typeof p?.e === "string" ? p : null;
}

// One-tap follow-up answers that need no price. k = kind, i = item id, a = answer, t = issued (ms).
export type AnswerAction = "still_looking" | "not_bought" | "not_sold";
export interface AnswerPayload { k: "advert" | "valuation"; i: string; a: AnswerAction; t: number }
export const ANSWER_MAX_AGE_MS = 120 * 86400_000;

export async function makeAnswerToken(p: Omit<AnswerPayload, "t">): Promise<string> {
  return sign("answer", { ...p, t: Date.now() });
}
export async function readAnswerToken(token: string): Promise<AnswerPayload | null> {
  const p = await verify("answer", token);
  if (!p || !["advert", "valuation"].includes(p.k) || !["still_looking", "not_bought", "not_sold"].includes(p.a)) return null;
  if (typeof p.i !== "string" || typeof p.t !== "number" || Date.now() - p.t > ANSWER_MAX_AGE_MS) return null;
  return p;
}
// Lands on a page that records the answer with a POST, so link scanners/prefetchers can't answer for the user.
export const answerUrl = (token: string) => `${SITE}/email-answer?t=${encodeURIComponent(token)}`;

export const unsubUrl = (token: string) => `${SITE}/unsubscribe?token=${encodeURIComponent(token)}`;
// RFC 8058 one-click target: mail clients POST here directly, so it must be the edge function, not the SPA page.
export const unsubPostUrl = (pageUrl: string) => {
  const base = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/+$/, "");
  if (!base) return pageUrl;
  const token = new URL(pageUrl).searchParams.get("token") ?? "";
  return `${base}/functions/v1/email-unsubscribe?token=${encodeURIComponent(token)}`;
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
export const gbp = (n: number) => "£" + Math.round(n).toLocaleString("en-GB");
export const miles = (n: number) => `${Math.round(n).toLocaleString("en-GB")} miles`;
export const ukDate = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
};

export interface EmailButton { label: string; url: string; primary?: boolean }
export interface EmailContent {
  preview: string;
  heading: string;
  carLine?: string | null;            // "2017 MINI Cooper · 82,167 miles"
  price?: { label: string; value: string; sub?: string | null } | null;
  stats?: { label: string; value: string }[]; // small row, e.g. Part-ex / Dealer
  facts?: string[];                   // one line joined with " · " (MOT, condition)
  lines?: string[];
  buttons: EmailButton[];
  buttonsIntro?: string | null;
  note?: string | null;               // small grey text under the buttons
  unsubscribe: string;
}

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const C = { band: "#0b1111", page: "#f3f5f5", card: "#ffffff", ink: "#0f172a", muted: "#5b6b73", line: "#e3e8ea", teal: "#14b8a6", tealDeep: "#0f766e", tint: "#f0fbf9" };

function buttonHtml(b: EmailButton): string {
  const bg = b.primary ? C.teal : C.card;
  const fg = b.primary ? "#04211d" : C.tealDeep;
  const border = b.primary ? C.teal : "#9fd9d0";
  return `<tr><td style="padding:0 0 10px 0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td align="center" bgcolor="${bg}" class="${b.primary ? "btn-p" : "btn-s"}" style="background:${bg};border:1px solid ${border};border-radius:10px">
<a href="${esc(b.url)}" class="${b.primary ? "btn-p-a" : "btn-s-a"}" style="display:block;padding:14px 18px;font-family:${FONT};font-size:16px;font-weight:700;line-height:20px;color:${fg};text-decoration:none;border-radius:10px">${esc(b.label)}</a>
</td></tr></table></td></tr>`;
}

export function renderEmail(o: EmailContent): { html: string; text: string } {
  const p = (t: string, extra = "") => `<p class="ink" style="margin:0 0 12px 0;font-family:${FONT};font-size:15px;line-height:23px;color:${C.ink};${extra}">${esc(t)}</p>`;
  const priceBlock = o.price ? `
<tr><td class="px" style="padding:4px 32px 0 32px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="tint" style="background:${C.tint};border-radius:12px" bgcolor="${C.tint}"><tr><td style="padding:20px 22px">
<p class="muted" style="margin:0 0 4px 0;font-family:${FONT};font-size:12px;letter-spacing:0.08em;text-transform:uppercase;font-weight:700;color:${C.tealDeep}">${esc(o.price.label)}</p>
<p class="ink" style="margin:0;font-family:${FONT};font-size:40px;line-height:46px;font-weight:800;letter-spacing:-0.02em;color:${C.ink}">${esc(o.price.value)}</p>
${o.price.sub ? `<p class="muted" style="margin:6px 0 0 0;font-family:${FONT};font-size:14px;line-height:20px;color:${C.muted}">${esc(o.price.sub)}</p>` : ""}
${o.stats?.length ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;border-top:1px solid ${C.line}" class="rule"><tr>
${o.stats.map((s, i) => `<td width="${Math.floor(100 / o.stats!.length)}%" valign="top" style="padding:14px ${i === o.stats!.length - 1 ? 0 : 12}px 0 0">
<p class="muted" style="margin:0;font-family:${FONT};font-size:12px;line-height:16px;color:${C.muted}">${esc(s.label)}</p>
<p class="ink" style="margin:2px 0 0 0;font-family:${FONT};font-size:18px;line-height:24px;font-weight:700;color:${C.ink}">${esc(s.value)}</p></td>`).join("")}
</tr></table>` : ""}
</td></tr></table></td></tr>` : "";
  const facts = o.facts?.filter(Boolean) ?? [];
  const factsBlock = facts.length ? `<tr><td class="px" style="padding:14px 32px 0 32px"><p class="muted" style="margin:0;font-family:${FONT};font-size:13px;line-height:20px;color:${C.muted}">${facts.map(esc).join(" &nbsp;·&nbsp; ")}</p></td></tr>` : "";
  const lines = (o.lines ?? []).length ? `<tr><td class="px" style="padding:18px 32px 0 32px">${o.lines!.map((l) => p(l)).join("")}</td></tr>` : "";
  const btns = `<tr><td class="px" style="padding:${o.lines?.length ? 6 : 22}px 32px 0 32px">
${o.buttonsIntro ? p(o.buttonsIntro, "font-weight:600;") : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${o.buttons.map(buttonHtml).join("")}</table>
${o.note ? `<p class="muted" style="margin:4px 0 0 0;font-family:${FONT};font-size:13px;line-height:19px;color:${C.muted}">${esc(o.note)}</p>` : ""}
</td></tr>`;

  const html = `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark">
<title>${esc(o.heading)}</title>
<style>
:root{color-scheme:light dark;supported-color-schemes:light dark}
body{margin:0;padding:0;-webkit-text-size-adjust:100%}
a{text-decoration:none}
@media (max-width:620px){.wrap{width:100%!important}.px{padding-left:20px!important;padding-right:20px!important}}
@media (prefers-color-scheme:dark){
 .page{background:#050707!important}.card{background:#141c1c!important;border-color:#233030!important}
 .ink{color:#f1f5f4!important}.muted{color:#a3b3b1!important}.tint{background:#0f2522!important}
 .rule{border-color:#2a3a38!important}.btn-s{background:#141c1c!important;border-color:#2f6b63!important}.btn-s-a{color:#5eead4!important}
 .foot a{color:#a3b3b1!important}
}
[data-ogsc] .ink{color:#f1f5f4!important}[data-ogsc] .muted{color:#a3b3b1!important}
</style></head>
<body class="page" style="margin:0;padding:0;background:${C.page}" bgcolor="${C.page}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">${esc(o.preview)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="page" style="background:${C.page}" bgcolor="${C.page}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" class="wrap" style="width:560px;max-width:560px">
<tr><td align="left" bgcolor="${C.band}" style="background:${C.band};border-radius:14px 14px 0 0;padding:20px 28px">
<a href="${SITE}" style="text-decoration:none"><img src="${LOGO_URL}" width="120" height="50" alt="Valu8" style="display:block;border:0;outline:none;width:120px;height:50px;color:#f1f5f4;font-family:${FONT};font-size:24px;font-weight:700"></a>
</td></tr>
<tr><td class="card" bgcolor="${C.card}" style="background:${C.card};border:1px solid ${C.line};border-top:0;border-radius:0 0 14px 14px;padding:0 0 28px 0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td class="px" style="padding:28px 32px 0 32px">
<h1 class="ink" style="margin:0;font-family:${FONT};font-size:24px;line-height:31px;font-weight:800;letter-spacing:-0.01em;color:${C.ink}">${esc(o.heading)}</h1>
${o.carLine ? `<p class="muted" style="margin:6px 0 0 0;font-family:${FONT};font-size:15px;line-height:22px;color:${C.muted}">${esc(o.carLine)}</p>` : ""}
</td></tr>
${o.price ? `<tr><td style="height:14px;line-height:14px;font-size:0">&nbsp;</td></tr>` : ""}
${priceBlock}
${factsBlock}
${lines}
${btns}
</table></td></tr>
<tr><td class="foot" style="padding:22px 28px 8px 28px;font-family:${FONT};font-size:12px;line-height:19px;color:${C.muted}" align="center">
<p class="muted" style="margin:0 0 6px 0;color:${C.muted}">You're getting this because you used Valu8. Questions? Just reply.</p>
<p class="muted" style="margin:0 0 6px 0;color:${C.muted}">${esc(LEGAL_LINE)} &nbsp;·&nbsp; <a href="${SITE}" style="color:${C.muted};text-decoration:underline">valu8.uk</a></p>
<p style="margin:0"><a href="${esc(o.unsubscribe)}" style="color:${C.muted};text-decoration:underline">Unsubscribe from all Valu8 emails</a></p>
</td></tr>
</table></td></tr></table></body></html>`;

  const t: string[] = ["VALU8", "", o.heading];
  if (o.carLine) t.push(o.carLine);
  t.push("");
  if (o.price) { t.push(`${o.price.label}: ${o.price.value}`); if (o.price.sub) t.push(o.price.sub); }
  if (o.stats?.length) t.push(o.stats.map((s) => `${s.label}: ${s.value}`).join("  |  "));
  if (facts.length) t.push(facts.join(" · "));
  if (o.price || o.stats?.length || facts.length) t.push("");
  for (const l of o.lines ?? []) t.push(l);
  if (o.lines?.length) t.push("");
  if (o.buttonsIntro) t.push(o.buttonsIntro);
  for (const b of o.buttons) t.push(`${b.label}: ${b.url}`);
  if (o.note) t.push("", o.note);
  t.push("", "--", "You're getting this because you used Valu8. Questions? Just reply.", `${LEGAL_LINE} · ${SITE}`, `Unsubscribe: ${o.unsubscribe}`);
  return { html, text: t.join("\n") };
}

export async function sendEmail(o: { to: string; subject: string; html: string; text?: string; unsubscribe: string; idempotencyKey: string }): Promise<{ ok: boolean; id?: string; error?: string }> {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return { ok: false, error: "RESEND_API_KEY missing" };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": o.idempotencyKey.slice(0, 256) },
    body: JSON.stringify({
      from: FROM, to: [o.to], reply_to: REPLY_TO, subject: o.subject, html: o.html, ...(o.text ? { text: o.text } : {}),
      headers: { "List-Unsubscribe": `<${unsubPostUrl(o.unsubscribe)}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
    }),
  });
  const text = await res.text();
  if (!res.ok) { console.error(`Resend failed [${res.status}]: ${text}`); return { ok: false, error: `${res.status}: ${text}` }; }
  try { return { ok: true, id: JSON.parse(text)?.id }; } catch { return { ok: true }; }
}
