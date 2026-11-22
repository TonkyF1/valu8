// Photo sanity checks (audit 21 Nov 2026: four photos of three different-coloured Fiestas all came back
// "value-add", scored 7.2/10, and the scuff the seller declared was ignored).
//
// Pure functions, no Deno/network APIs, so the edge function and the frontend tests share them.
// Rules:
//  1. The car in the photos must plausibly be the car on the DVLA record: paint colour family, and any
//     readable number plate.
//  2. All exterior photos must plausibly show ONE car (one colour family, the AI's sameCar answer, plates agree).
//  3. If either check fails, the photos are not used to move the price at all (no uplift, no deduction, no
//     condition score) and the seller gets a polite note instead of a boosted score.
//  4. Declared damage is honoured: photos can never add value or be marked "positive" with a "clean" claim when
//     the seller said the car has a scuff, dent, scratch, etc. The condition score is capped and the note says
//     we've allowed for what they told us.

export type ColourFamily = "black" | "white" | "silver" | "grey" | "blue" | "red" | "green" | "yellow" | "orange" | "brown" | "beige" | "gold" | "purple" | "pink" | "bronze";

const FAMILY_WORDS: [ColourFamily, RegExp][] = [
  ["silver", /\b(silver|chrome|platinum|titanium|aluminium|aluminum)\b/],
  ["grey", /\b(gr[ae]y|graphite|gunmetal|anthracite|charcoal|slate|magnetic|carbon|tungsten|moonstone|nardo)\b/],
  ["black", /\b(black|ebony|onyx|obsidian|panther|jet|sapphire black|night)\b/],
  ["white", /\b(white|ivory|pearl|alpine|glacier|polar|frozen white|snow|chalk|cream)\b/],
  ["blue", /\b(blue|navy|azure|cobalt|marine|ocean|teal|turquoise|aqua|cyan)\b/],
  ["red", /\b(red|maroon|burgundy|crimson|ruby|scarlet|cherry|claret|wine|flame)\b/],
  ["green", /\b(green|olive|khaki|lime|emerald|racing green)\b/],
  ["yellow", /\b(yellow|lemon)\b/],
  ["orange", /\b(orange|copper|amber|tangerine)\b/],
  ["bronze", /\b(bronze)\b/],
  ["gold", /\b(gold|champagne)\b/],
  ["brown", /\b(brown|chocolate|mocha|coffee|tan)\b/],
  ["beige", /\b(beige|sand|stone|taupe|cashmere)\b/],
  ["purple", /\b(purple|violet|lilac|plum|mauve|aubergine)\b/],
  ["pink", /\b(pink|rose)\b/],
];

/** DVLA/AI colour text -> family. Null for unknown, two-tone or multi-colour (never flag those). */
export function colourFamily(text: unknown): ColourFamily | null {
  const t = String(text ?? "").toLowerCase().trim();
  if (!t || /\b(multi|two[- ]?tone|various|unknown|not provided|n\/a|wrap(ped)?)\b/.test(t)) return null;
  for (const [fam, re] of FAMILY_WORDS) if (re.test(t)) return fam;
  return null;
}

/** Pairs a photo can easily confuse (lighting, shade, metallic flake). These never count as a mismatch. */
const CLOSE: Array<[ColourFamily, ColourFamily]> = [
  ["silver", "grey"], ["silver", "white"], ["grey", "black"], ["blue", "black"], ["grey", "blue"],
  ["green", "black"], ["red", "orange"], ["red", "purple"], ["red", "pink"], ["purple", "black"],
  ["brown", "bronze"], ["brown", "beige"], ["beige", "gold"], ["gold", "yellow"], ["gold", "bronze"],
  ["orange", "bronze"], ["beige", "white"], ["beige", "silver"], ["brown", "black"], ["orange", "yellow"],
];
export function coloursCompatible(a: ColourFamily | null, b: ColourFamily | null): boolean {
  if (!a || !b || a === b) return true;
  return CLOSE.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

export const normalisePlate = (s: unknown) => String(s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

/** Plate characters a photo read easily confuses (O/0, I/1, S/5, B/8, Z/2, G/6). */
const PLATE_LOOKALIKE: Record<string, string> = { O: "0", Q: "0", D: "0", I: "1", L: "1", S: "5", B: "8", Z: "2", G: "6" };
const plateShape = (p: string) => p.replace(/[A-Z]/g, (c) => PLATE_LOOKALIKE[c] ?? c);
/**
 * Two plate reads count as the same plate unless they clearly differ: equal after look-alike folding, at most one
 * other character wrong (same length), or one read is a partial of the other (a corner or glare hides characters).
 * A misread must never discard a genuine seller's photos.
 */
export function platesMatch(a: string, b: string): boolean {
  if (!a || !b) return true;
  const x = plateShape(a), y = plateShape(b);
  if (x === y || x.includes(y) || y.includes(x)) return true;
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i] && ++diff > 1) return false;
  return true;
}

export interface PhotoCar {
  photoIndex?: number;
  /** True when the photo shows the car's bodywork from outside (not interior, odometer or engine bay). */
  exterior?: boolean;
  colour?: string;
  /** Number plate text if clearly readable, else "". */
  plate?: string;
}

export interface PhotoCheckInput {
  photoCount: number;
  registration?: string | null;
  /** Colour on the DVLA record. */
  dvlaColour?: string | null;
  /** Per-photo car descriptions from the vision model. */
  photoCars?: PhotoCar[] | null;
  /** Vision model's own answer to "do all exterior photos show the same car?" (undefined = not answered). */
  aiSameCar?: boolean | null;
  /** Seller-written notes (service notes, modifications). */
  declaredText?: string | null;
}

export interface PhotoCheck {
  /** False when the photos can't be trusted to describe this car: they must not move the price. */
  trusted: boolean;
  colourMismatch: boolean;
  differentCars: boolean;
  plateMismatch: boolean;
  /** Damage words the seller declared (unnegated), e.g. ["scuff"]. */
  declaredDamage: string[];
  /** Short, polite notes for the seller (shown in the report). Empty when everything checks out. */
  notes: string[];
  /** Colour family seen in the photos (majority of exterior shots), for the record. */
  photoColour: ColourFamily | null;
}

const DAMAGE: [string, RegExp][] = [
  ["scuff", /\bscuff(s|ed)?\b/], ["scratch", /\bscratch(es|ed)?\b/], ["dent", /\bdent(s|ed)?\b/], ["ding", /\bdings?\b/],
  ["chip", /\b(stone ?)?chips?\b/], ["kerbed alloy", /\b(kerb(ed)?|curb(ed)?)\b/], ["crack", /\bcrack(s|ed)?\b/],
  ["rust", /\b(rust|rusty|corrosion)\b/], ["damage", /\bdamage(d)?\b/], ["tear", /(?<!wear and )\b(tear|torn|ripped)\b/],
  ["stain", /\bstain(s|ed)?\b/], ["paint fade", /\b(faded|peeling|lacquer)\b/],
];
const NEGATION = /\b(no|not|never|without|none|nothing|zero|nil|free of|free from)\b|n't\b/i;
const FIXED_AFTER = /^\W*(\w+\W+){0,4}?(repaired|fixed|sorted|rectified|removed|smart[- ]?repaired|touched[- ]?up|resprayed)\b/i;

/** Unnegated damage the seller mentioned ("small scuff on rear bumper" -> scuff; "no scratches" -> none). */
export function declaredDamage(text: unknown): string[] {
  const out = new Set<string>();
  for (const clause of String(text ?? "").toLowerCase().split(/[.;,!?\n]+|\bbut\b/)) {
    for (const [label, re] of DAMAGE) {
      const m = re.exec(clause);
      if (m && !NEGATION.test(clause.slice(0, m.index)) && !FIXED_AFTER.test(clause.slice(m.index + m[0].length))) out.add(label);
    }
  }
  return [...out];
}

const familyName = (f: ColourFamily) => f;

export function checkPhotos(i: PhotoCheckInput): PhotoCheck {
  const declared = declaredDamage(i.declaredText);
  const none: PhotoCheck = { trusted: true, colourMismatch: false, differentCars: false, plateMismatch: false, declaredDamage: declared, notes: [], photoColour: null };
  if (!(i.photoCount > 0)) return none;

  const cars = (i.photoCars ?? []).filter((c) => c && c.exterior !== false);
  const fams = cars.map((c) => colourFamily(c.colour)).filter((f): f is ColourFamily => !!f);
  // Majority colour among exterior photos.
  const counts = new Map<ColourFamily, number>();
  for (const f of fams) counts.set(f, (counts.get(f) ?? 0) + 1);
  const photoColour = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  // Different cars: two exterior photos in clearly different colours, two different readable plates,
  // or the model itself saying they're not the same car.
  let differentCars = i.aiSameCar === false;
  for (let a = 0; a < fams.length && !differentCars; a++) for (let b = a + 1; b < fams.length; b++) if (!coloursCompatible(fams[a], fams[b])) { differentCars = true; break; }
  const plates = [...new Set(cars.map((c) => normalisePlate(c.plate)).filter((p) => p.length >= 4))];
  if (plates.some((p, a) => plates.some((q, b) => b > a && !platesMatch(p, q)))) differentCars = true;

  const reg = normalisePlate(i.registration);
  const plateMismatch = !!reg && plates.length > 0 && !plates.some((p) => platesMatch(p, reg));
  const dvla = colourFamily(i.dvlaColour);
  // Only compare with DVLA when the photos agree among themselves (otherwise "different cars" says it all).
  const colourMismatch = !differentCars && !!dvla && !!photoColour && !coloursCompatible(dvla, photoColour);

  const notes: string[] = [];
  if (differentCars) {
    notes.push("Your photos look like they show more than one car, so we haven't used them to adjust the price. Add photos of just this car to get a condition check.");
  } else if (plateMismatch) {
    notes.push("The number plate in your photos doesn't match the registration you entered, so we haven't used the photos to adjust the price.");
  } else if (colourMismatch) {
    notes.push(`The car in your photos looks ${familyName(photoColour!)}, but the DVLA record says ${familyName(dvla!)}. If it's been resprayed or wrapped, that's fine. We just haven't used the photos to adjust the price.`);
  }
  const trusted = !differentCars && !plateMismatch && !colourMismatch;
  if (trusted && declared.length) {
    notes.push(`You mentioned ${declared.length === 1 ? `a ${declared[0]}` : declared.slice(0, -1).join(", ") + " and " + declared[declared.length - 1]}. We've allowed for it, even where it isn't visible in the photos.`);
  }
  return { trusted, colourMismatch, differentCars, plateMismatch, declaredDamage: declared, notes, photoColour };
}

type Insight = { observation?: string | null; severity?: string | null; priceImpact?: number | string | null; fixable?: boolean | null; fixCost?: number | null; [k: string]: unknown };

const CLEAN_CLAIM = /\b(clean|tidy|immaculate|excellent|pristine|flawless|spotless|no (visible|obvious|noticeable)?\s*(damage|marks?|scuffs?|scratch(es)?|dents?|issues?|wear)|free (of|from)|well[- ]kept|well[- ]maintained|good condition|great condition|showroom)\b/i;

/**
 * Apply the check to the vision line items:
 *  - untrusted photos: every £ impact removed, "positive" downgraded to "neutral" (observations kept as context);
 *  - declared damage: no uplift anywhere, and a "clean" claim can't be "positive" or carry value.
 */
export function applyPhotoCheck<T extends Insight>(items: T[] | null | undefined, check: PhotoCheck): T[] {
  const list = Array.isArray(items) ? items : [];
  if (check.trusted && !check.declaredDamage.length) return list;
  return list.map((raw) => {
    const it: T = { ...raw };
    const impact = Number(it.priceImpact);
    if (!check.trusted) {
      delete it.priceImpact; delete it.fixCost; it.fixable = false;
      if (String(it.severity) === "positive") it.severity = "neutral";
      return it;
    }
    // Declared damage, trusted photos.
    if (Number.isFinite(impact) && impact > 0) delete it.priceImpact;
    if (String(it.severity) === "positive" && CLEAN_CLAIM.test(String(it.observation ?? ""))) it.severity = "neutral";
    return it;
  });
}

/** Condition score allowed for pricing/reporting. Null = not scored (untrusted photos). Declared damage caps at 7.5. */
export function checkedConditionScore(score: number | null, check: PhotoCheck): number | null {
  if (score == null) return null;
  if (!check.trusted) return null;
  if (check.declaredDamage.length) return Math.min(score, 7.5);
  return score;
}

/** Vision-model instructions + JSON schema fragment for the per-photo car identity fields. */
export const PHOTO_IDENTITY_PROMPT = `
SAME-CAR CHECK (required when photos are attached):
- For EVERY photo, add an entry to photoCars: photoIndex, exterior (true only if the photo shows the car's bodywork from outside), colour (the paint colour you see, e.g. "dark blue", "silver"; "" for interior/odometer/engine shots), plate (the number plate text if clearly readable, else "").
- Set photosSameCar to false if the exterior photos show more than one car (different colours, body styles, wheels, trim or plates). Do not assume they are the same car just because the user sent them together.
- Never give a positive observation or priceImpact that contradicts damage the seller declared in the service notes (e.g. "no scuffs" when they said there is a scuff).`;

export const PHOTO_IDENTITY_SCHEMA = {
  photosSameCar: { type: "boolean", description: "False if the exterior photos show more than one car." },
  photoCars: {
    type: "array",
    maxItems: 18,
    items: {
      type: "object",
      properties: {
        photoIndex: { type: "number" },
        exterior: { type: "boolean" },
        colour: { type: "string" },
        plate: { type: "string" },
      },
      required: ["photoIndex", "exterior", "colour", "plate"],
      additionalProperties: false,
    },
  },
} as const;
