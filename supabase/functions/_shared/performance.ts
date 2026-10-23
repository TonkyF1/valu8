// Performance / high-spec variant detection and like-for-like comp filtering.
// A Megane RS Trophy was being priced off GT Line / dCi comps (batch Megane
// 2026-10-23: mean -50%). Detect performance variants from variant / DVLA model
// / ad text and keep only comparables whose trim or listing URL matches.

export interface PerfRule {
  key: string;
  label: string;
  makes: RegExp;           // matched against normalised make
  detect: RegExp;          // matched against normalised car text
  specific?: { detect: RegExp; comp: RegExp; label: string }[]; // narrower tiers, most specific first
  comp?: RegExp;           // comp matcher (defaults to detect)
  includeMake?: boolean;   // the make itself is a performance brand (Abarth)
}

export function normText(s?: string | null): string {
  return String(s ?? "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// "Line"/"Design"/"Sport" packs are styling trims, never performance variants.
const NOT_LINE = String.raw`(?![- ]?(?:line|design|styling|look|pack|sport)\b)`;
const RX = (src: string) => new RegExp(src, "i");

const RS_RENAULT = String.raw`renault ?sport|renaultsport|\br\.?s\.?${NOT_LINE}(?=[\s\-\d]|$)|\brs ?(?:2[0-9]{2}|300)\b|\btrophy\b|\bcup\b`;

export const PERF_RULES: PerfRule[] = [
  { key: "renault-rs", label: "Renault Sport (RS)", makes: /renault/,
    detect: RX(RS_RENAULT),
    specific: [
      { label: "Trophy-R", detect: /trophy[- ]?r\b/i, comp: /trophy[- ]?r\b/i },
      { label: "Trophy", detect: /\btrophy\b/i, comp: /\btrophy\b/i },
    ] },
  { key: "vw-perf", label: "VW GTI/GTD/R/Clubsport", makes: /volkswagen|^vw$/,
    detect: RX(String.raw`\bgti\b|\bgtd\b|clubsport|\bgolf r\b${NOT_LINE}|(?:^|\s)r${NOT_LINE}(?=\s|$|\d)|\br ?[23]\d{2}\b|\br32\b`),
    specific: [
      { label: "R", detect: RX(String.raw`(?:^|\s)r${NOT_LINE}(?=\s|$)|\br32\b|golf r\b${NOT_LINE}`), comp: RX(String.raw`(?:^|[\s-])r${NOT_LINE}(?=[\s-]|$)|\br32\b`) },
      { label: "GTI", detect: /\bgti\b/i, comp: /\bgti\b/i },
      { label: "GTD", detect: /\bgtd\b/i, comp: /\bgtd\b/i },
    ] },
  { key: "ford-st-rs", label: "Ford ST/RS", makes: /ford/,
    detect: RX(String.raw`\bst${NOT_LINE}(?:[- ]?[1-3])?\b|\brs${NOT_LINE}\b`),
    specific: [{ label: "RS", detect: RX(String.raw`\brs${NOT_LINE}\b`), comp: RX(String.raw`\brs${NOT_LINE}\b`) }] },
  { key: "honda-type-r", label: "Type R", makes: /honda/, detect: /type[- ]?r\b/i },
  { key: "cupra", label: "Cupra", makes: /seat|cupra/, detect: RX(String.raw`\bcupra\b(?! ?born)(?=.*\b(?:r|vz\d?|\d{3})\b)|\bcupra r\b|\bvz\d?\b|\bcupra (?:2[0-9]{2}|300)\b|^cupra$`), comp: /cupra|\bvz\d?\b/i },
  { key: "amg", label: "Mercedes-AMG", makes: /mercedes|amg/, detect: RX(String.raw`\bamg${NOT_LINE}\b|\b[a-z]{1,3} ?(?:35|43|45|53|55|63|65)\b`), comp: RX(String.raw`\bamg${NOT_LINE}\b|\b[a-z]{1,3} ?(?:35|43|45|53|55|63|65)\b`) },
  { key: "bmw-m", label: "BMW M", makes: /bmw/, detect: RX(String.raw`\bm[2-8]${NOT_LINE}\b|\bx[3-6] ?m\b(?! ?sport)|\bm1\d0i\b|\bm[2-4]\d0[id]\b`),
    specific: [{ label: "M car", detect: RX(String.raw`\bm[2-8]${NOT_LINE}\b|\bx[3-6] ?m\b(?! ?sport)`), comp: RX(String.raw`\bm[2-8]${NOT_LINE}\b|\bx[3-6] ?m\b(?! ?sport)`) }] },
  { key: "audi-rs", label: "Audi RS", makes: /audi/, detect: RX(String.raw`\brs ?(?:q?\d|e-?tron)\b`), comp: RX(String.raw`\brs ?(?:q?\d|e-?tron)\b`) },
  { key: "vauxhall-vxr", label: "Vauxhall VXR/GSi", makes: /vauxhall|opel/, detect: RX(String.raw`\bvxr${NOT_LINE}\d?\b|\bgsi\b|\bopc\b`) },
  { key: "mini-jcw", label: "MINI JCW", makes: /mini/, detect: /\bjcw\b(?! ?(?:pack|trim|styling|sport))|john cooper works(?! ?(?:pack|trim|styling))/i, comp: /\bjcw\b|john cooper works/i },
  { key: "abarth", label: "Abarth", makes: /abarth|fiat/, detect: /abarth/i, includeMake: true },
  { key: "hyundai-n", label: "Hyundai N", makes: /hyundai/, detect: RX(String.raw`\b(?:i20|i30|kona|veloster|ioniq ?5|fastback)\b.*(?:^|\s)n${NOT_LINE}(?=\s|$)|(?:^|\s)n${NOT_LINE}(?= performance|\s*$)`), comp: RX(String.raw`(?:^|[\s-])n${NOT_LINE}(?=[\s-]|$)`) },
  { key: "peugeot-gti", label: "Peugeot GTi", makes: /peugeot/, detect: /\bgti\b|\bpse\b/i },
  { key: "skoda-vrs", label: "Skoda vRS", makes: /skoda/, detect: /\bv ?rs\b/i },
  { key: "toyota-gr", label: "Toyota GR", makes: /toyota/, detect: RX(String.raw`\bgr ?(?:yaris|86|supra|corolla)\b|\bgr${NOT_LINE}(?! ?sport)\b`) },
  { key: "subaru-sti", label: "Subaru STI", makes: /subaru/, detect: /\bsti\b/i },
  { key: "mitsubishi-evo", label: "Mitsubishi Evo", makes: /mitsubishi/, detect: /\bevo(?:lution)?\b/i },
  { key: "nissan-nismo", label: "Nismo/GT-R", makes: /nissan/, detect: /nismo|\bgt-?r\b/i },
  { key: "kia-gt", label: "Kia GT", makes: /kia/, detect: RX(String.raw`\bgt${NOT_LINE}\b`) },
];

export interface PerfVariant {
  key: string;
  label: string;        // e.g. "Renault Sport (RS) — Trophy"
  broad: RegExp;
  specific?: { label: string; comp: RegExp };
}

/**
 * Detects a performance variant. Variant + DVLA/model text are trusted first;
 * free ad text is only used when they carry no signal (and only its first
 * 160 chars, i.e. the title, to avoid "RS wheels fitted" false positives).
 */
export function detectPerformanceVariant(
  make?: string | null,
  model?: string | null,
  variant?: string | null,
  adText?: string | null,
): PerfVariant | null {
  const mk = normText(make);
  const sources = [normText(`${model ?? ""} ${variant ?? ""}`), normText(String(adText ?? "").slice(0, 160))];
  for (const text of sources) {
    if (!text) continue;
    for (const rule of PERF_RULES) {
      if (!rule.makes.test(mk) && !rule.makes.test(text.split(" ")[0])) continue;
      if (!rule.detect.test(rule.includeMake ? `${mk} ${text}` : text)) continue;
      const spec = rule.specific?.find((s) => s.detect.test(text));
      return {
        key: rule.key,
        label: spec ? `${rule.label} — ${spec.label}` : rule.label,
        broad: rule.comp ?? rule.detect,
        specific: spec ? { label: spec.label, comp: spec.comp } : undefined,
      };
    }
  }
  return null;
}

export const MIN_PERF_COMPS = 4;

function compText(c: { trim?: string; url?: string }): string {
  let path = "";
  try { path = c.url ? decodeURIComponent(new URL(c.url).pathname) : ""; } catch { path = c.url ?? ""; }
  return normText(`${c.trim ?? ""} ${path.replace(/[-/]+/g, " ")}`);
}

export function isPerformanceComp(perf: PerfVariant, c: { trim?: string; url?: string }, specific = false): boolean {
  const t = compText(c);
  return specific && perf.specific ? perf.specific.comp.test(t) : perf.broad.test(t);
}

export type PerfMatch = "specific" | "broad" | "fallback";

/** Keep like-for-like comps when >= MIN_PERF_COMPS exist; otherwise flag a fallback. */
export function filterCompsByPerformance<T extends { trim?: string; url?: string }>(
  comps: T[], perf: PerfVariant | null, min = MIN_PERF_COMPS,
): { comps: T[]; match: PerfMatch | null; matchedCount: number } {
  if (!perf) return { comps, match: null, matchedCount: 0 };
  if (perf.specific) {
    const s = comps.filter((c) => isPerformanceComp(perf, c, true));
    if (s.length >= min) return { comps: s, match: "specific", matchedCount: s.length };
  }
  const b = comps.filter((c) => isPerformanceComp(perf, c));
  if (b.length >= min) return { comps: b, match: "broad", matchedCount: b.length };
  return { comps, match: "fallback", matchedCount: b.length };
}

const ORDER = ["High", "Medium", "Low", "Very Low"] as const;
export function downgradeConfidence<C extends string>(c: C): C {
  const i = ORDER.indexOf(c as any);
  return (i >= 0 && i < ORDER.length - 1 ? ORDER[i + 1] : c) as C;
}
