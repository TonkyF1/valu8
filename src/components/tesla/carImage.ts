// Generic body-type renders for the homepage hero (public/cars/*.svg, each a small WebP on the brand backdrop).
// Purely decorative: never shows the visitor's actual car, make or badge.
export type BodyKey = "hatchback" | "hatch3" | "saloon" | "estate" | "suv" | "coupe" | "convertible" | "mpv" | "van" | "pickup";

const MODEL_HINTS: [BodyKey, RegExp][] = [
  ["pickup", /\b(hilux|ranger|l200|navara|d-?max|amarok|warrior|musso|gladiator|f-?150|x-class)\b/i],
  ["van", /\b(transit|sprinter|vivaro|trafic|transporter|caddy|crafter|ducato|boxer|relay|master|movano|vito|proace|doblo|nv200|nv300|primastar|expert|dispatch|jumpy|jumper|daily|custom|courier)\b/i],
  ["mpv", /\b(zafira|galaxy|s-?max|c-?max|b-?max|touran|sharan|scenic|picasso|spacetourer|alhambra|meriva|verso|note|tourneo|multivan|caravelle|grand c4|berlingo|rifter|kangoo|combo life|v-?class|carens)\b/i],
  ["convertible", /\b(mx-?5|boxster|z3|z4|slk|slc|cabrio|cabriolet|convertible|roadster|spider|spyder|eos|124)\b/i],
  ["coupe", /\b(tt|gt86|86|brz|mustang|rcz|scirocco|4 series|2 series coupe|cayman|911|370z|350z|supra|a5|e-?type|camaro|corvette|f-?type)\b/i],
  ["estate", /\b(touring|avant|estate|sportwagon|sports tourer|tourer|combi|variant|shooting brake|sw|allroad|v40 cross|v60|v70|v90)\b/i],
  ["suv", /\b(qashqai|kuga|tucson|sportage|x1|x2|x3|x4|x5|x6|x7|q2|q3|q5|q7|q8|range rover|discovery|evoque|velar|defender|freelander|kodiaq|karoq|kamiq|tiguan|t-?roc|t-?cross|touareg|juke|x-?trail|cr-?v|hr-?v|rav4|c-?hr|3008|5008|2008|captur|kadjar|koleos|duster|yeti|xc40|xc60|xc90|mokka|grandland|crossland|puma|ecosport|edge|kona|santa fe|niro|sorento|stonic|macan|cayenne|gla|glb|glc|gle|gls|ml|ateca|arona|tarraco|formentor|ix35|outlander|asx|eclipse cross|cx-?3|cx-?5|cx-?30|vitara|s-?cross|jimny|ignis|countryman|stelvio|e-?pace|f-?pace|i-?pace|bentayga|urus|ev6|ioniq 5|model y|xceed|tonale|wrangler|renegade|compass|cherokee|c5 aircross|c3 aircross|kamiq|enyaq|id\.?4|id\.?5)\b/i],
  ["saloon", /\b(3 series|5 series|7 series|a4|a6|a8|c[- ]?class|e[- ]?class|s[- ]?class|insignia|mondeo|passat|octavia|superb|arteon|jetta|xe|xf|xj|giulia|model 3|model s|accord|avensis|s60|s90|mazda6|i40|optima|stinger|a3 saloon|cla saloon|a-?class saloon|legacy|camry)\b/i],
];

/** Pick a generic body render from the lookup's body style, doors and model name. Sensible fallback: 5-door hatch. */
export function bodyKeyFor(v: { bodyStyle?: string | null; doors?: number | null; model?: string | null; make?: string | null }): BodyKey {
  const b = (v.bodyStyle ?? "").toLowerCase();
  const doors = Number(v.doors) || 0;
  if (b) {
    if (/pick ?-?up/.test(b)) return "pickup";
    if (/van|panel|box|chassis|minibus|light goods|lcv/.test(b)) return /mpv|combi|window/.test(b) ? "mpv" : "van";
    if (/mpv|people|multi/.test(b)) return "mpv";
    if (/convertible|cabrio|roadster|spider|open/.test(b)) return "convertible";
    if (/coup/.test(b)) return "coupe";
    if (/estate|wagon|tourer|touring/.test(b)) return "estate";
    if (/suv|4x4|crossover|off/.test(b)) return "suv";
    if (/saloon|sedan|limousine/.test(b)) return "saloon";
    if (/hatch/.test(b)) return doors > 0 && doors <= 3 ? "hatch3" : "hatchback";
  }
  const name = `${v.model ?? ""}`;
  for (const [k, re] of MODEL_HINTS) if (re.test(name)) return k;
  if (doors > 0 && doors <= 3) return "hatch3";
  return "hatchback";
}

export const carImageSrc = (k: BodyKey) => `/cars/${k}.svg`;
