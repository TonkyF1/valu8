// Valu8 — Resend email helpers: sending, signed unsubscribe tokens, simple HTML layout.
export const FROM = "Valu8 <reports@notify.valu8.uk>";
export const REPLY_TO = "hello@valu8.uk";
export const SITE = "https://valu8.uk";

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

export interface UnsubPayload { e: string; u?: string }

export async function makeUnsubToken(p: UnsubPayload): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify({ e: p.e.toLowerCase(), u: p.u })));
  return `${body}.${await hmac(body)}`;
}

export async function readUnsubToken(token: string): Promise<UnsubPayload | null> {
  if (typeof token !== "string" || token.length > 600) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expect = await hmac(body);
  if (expect.length !== sig.length) return null;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= expect.charCodeAt(i) ^ sig.charCodeAt(i);
  if (diff) return null;
  try {
    const p = JSON.parse(fromB64url(body));
    return typeof p?.e === "string" ? p : null;
  } catch { return null; }
}

export const unsubUrl = (token: string) => `${SITE}/unsubscribe?token=${encodeURIComponent(token)}`;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
export const gbp = (n: number) => "£" + Math.round(n).toLocaleString("en-GB");

export function layout(o: { preview: string; heading: string; lines: string[]; buttons: { label: string; url: string }[]; unsubscribe: string }): string {
  const btns = o.buttons.map((b) =>
    `<a href="${esc(b.url)}" style="display:inline-block;background:#14b8a6;color:#04211d;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:10px;margin:4px 6px 4px 0">${esc(b.label)}</a>`).join("");
  return `<!doctype html><html lang="en"><body style="margin:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
<span style="display:none;max-height:0;overflow:hidden">${esc(o.preview)}</span>
<div style="max-width:560px;margin:0 auto;padding:28px 24px">
<p style="font-weight:700;font-size:18px;color:#0d9488;margin:0 0 20px">Valu8</p>
<h1 style="font-size:22px;line-height:1.3;margin:0 0 14px">${esc(o.heading)}</h1>
${o.lines.map((l) => `<p style="font-size:15px;line-height:1.55;margin:0 0 12px">${esc(l)}</p>`).join("")}
<div style="margin:20px 0 28px">${btns}</div>
<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>
<p style="font-size:12px;color:#64748b;line-height:1.5;margin:0">You're getting this because you used Valu8. Questions? Just reply.<br/>
<a href="${esc(o.unsubscribe)}" style="color:#64748b">Unsubscribe from all Valu8 emails</a></p>
</div></body></html>`;
}

export async function sendEmail(o: { to: string; subject: string; html: string; unsubscribe: string; idempotencyKey: string }): Promise<{ ok: boolean; id?: string; error?: string }> {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return { ok: false, error: "RESEND_API_KEY missing" };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": o.idempotencyKey.slice(0, 256) },
    body: JSON.stringify({
      from: FROM, to: [o.to], reply_to: REPLY_TO, subject: o.subject, html: o.html,
      headers: { "List-Unsubscribe": `<${o.unsubscribe}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
    }),
  });
  const text = await res.text();
  if (!res.ok) { console.error(`Resend failed [${res.status}]: ${text}`); return { ok: false, error: `${res.status}: ${text}` }; }
  try { return { ok: true, id: JSON.parse(text)?.id }; } catch { return { ok: true }; }
}
