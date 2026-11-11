// Exact-model renders for the homepage hero (public/cars/m/<id>.svg): one plain white, fully debadged studio render per
// model generation, same angle and framing as the body-type renders, recoloured to the DVSA colour by carPaint.ts.
// Matched on make + model + year; anything not listed (or outside a generation's years) keeps the body-type render.
// Iconic supercars and classics are deliberately not covered.

type Entry = { id: string; make: RegExp; model: RegExp; years: [number, number]; van?: boolean };

const NOW = 2100;
const FORD = /^ford\b/i, VW = /^(volkswagen|vw)\b/i, VAUX = /^(vauxhall|opel)\b/i, BMW = /^bmw\b/i, MB = /^mercedes/i;
const AUDI = /^audi\b/i, NISSAN = /^nissan\b/i, RENAULT = /^renault\b/i, TOYOTA = /^toyota\b/i, PEUGEOT = /^peugeot\b/i;
const CITROEN = /^citroen\b/i, KIA = /^kia\b/i, HYUNDAI = /^hyundai\b/i, SKODA = /^skoda\b/i, SEAT = /^seat\b/i;
const LR = /^land ?rover\b/i, MINI = /^(mini|bmw mini)\b/i, HONDA = /^honda\b/i;

// Order matters: the first entry whose make, model and year all match wins.
export const MODEL_RENDERS: Entry[] = [
  { id: "fiesta-mk7", make: FORD, model: /^fiesta\b/i, years: [2008, 2017] },
  { id: "fiesta-mk8", make: FORD, model: /^fiesta\b/i, years: [2018, 2023] },
  { id: "focus-mk2", make: FORD, model: /^focus\b/i, years: [2005, 2010] },
  { id: "focus-mk3", make: FORD, model: /^focus\b/i, years: [2011, 2018] },
  { id: "focus-mk4", make: FORD, model: /^focus\b/i, years: [2019, NOW] },
  { id: "kuga-mk2", make: FORD, model: /^kuga\b/i, years: [2013, 2019] },
  { id: "puma-2", make: FORD, model: /^puma\b/i, years: [2020, NOW] },
  { id: "transit-custom", make: FORD, model: /^transit custom\b/i, years: [2013, 2023], van: true },
  { id: "transit-mk8", make: FORD, model: /^transit\b(?!.*\b(connect|courier|custom)\b)/i, years: [2014, NOW], van: true },
  { id: "golf-mk6", make: VW, model: /^golf\b(?!.*\b(plus|sv)\b)/i, years: [2009, 2012] },
  { id: "golf-mk7", make: VW, model: /^golf\b(?!.*\b(plus|sv)\b)/i, years: [2013, 2019] },
  { id: "golf-mk8", make: VW, model: /^golf\b(?!.*\b(plus|sv)\b)/i, years: [2020, NOW] },
  { id: "polo-mk5", make: VW, model: /^polo\b/i, years: [2009, 2017] },
  { id: "polo-mk6", make: VW, model: /^polo\b/i, years: [2018, NOW] },
  { id: "tiguan-mk2", make: VW, model: /^tiguan\b(?!.*allspace)/i, years: [2016, 2023] },
  { id: "up-1", make: VW, model: /^up\b/i, years: [2012, 2023] },
  { id: "corsa-d", make: VAUX, model: /^corsa\b/i, years: [2006, 2014] },
  { id: "corsa-e", make: VAUX, model: /^corsa\b/i, years: [2015, 2019] },
  { id: "corsa-f", make: VAUX, model: /^corsa\b/i, years: [2020, NOW] },
  { id: "astra-k", make: VAUX, model: /^astra\b/i, years: [2016, 2021] },
  { id: "mokka-1", make: VAUX, model: /^mokka\b(?![- ]?e\b)/i, years: [2012, 2020] },
  { id: "clio-3", make: RENAULT, model: /^clio\b/i, years: [2006, 2012] },
  { id: "clio-4", make: RENAULT, model: /^clio\b/i, years: [2013, 2019] },
  { id: "clio-5", make: RENAULT, model: /^clio\b/i, years: [2020, NOW] },
  { id: "captur-mk1", make: RENAULT, model: /^captur\b/i, years: [2013, 2019] },
  { id: "qashqai-j11", make: NISSAN, model: /^qashqai\b(?!\s*\+\s*2)/i, years: [2014, 2021] },
  { id: "qashqai-j12", make: NISSAN, model: /^qashqai\b/i, years: [2022, NOW] },
  { id: "juke-f15", make: NISSAN, model: /^juke\b(?!.*nismo)/i, years: [2010, 2019] },
  { id: "juke-f16", make: NISSAN, model: /^juke\b/i, years: [2020, NOW] },
  { id: "micra-k13", make: NISSAN, model: /^micra\b/i, years: [2011, 2017] },
  { id: "3series-f30", make: BMW, model: /^(3 series|3\d{2}[a-z]*)\b(?!.*(touring|gran|gt|convertible|coupe))/i, years: [2012, 2018] },
  { id: "3series-g20", make: BMW, model: /^(3 series|3\d{2}[a-z]*)\b(?!.*(touring|gran|gt|convertible|coupe))/i, years: [2019, NOW] },
  { id: "1series-f20", make: BMW, model: /^(1 series|1\d{2}[a-z]*)\b(?!.*(convertible|coupe))/i, years: [2012, 2019] },
  { id: "1series-f40", make: BMW, model: /^(1 series|1\d{2}[a-z]*)\b/i, years: [2020, NOW] },
  { id: "x1-f48", make: BMW, model: /^x1\b/i, years: [2015, 2022] },
  { id: "x3-g01", make: BMW, model: /^x3\b(?!.*\bm\b(?! ?sport))/i, years: [2018, NOW] },
  { id: "a1-8x", make: AUDI, model: /^a1\b/i, years: [2011, 2018] },
  { id: "a3-8v", make: AUDI, model: /^a3\b(?!.*(saloon|cabrio|convertible))/i, years: [2013, 2020] },
  { id: "a4-b9", make: AUDI, model: /^a4\b(?!.*(avant|allroad|cabrio|convertible))/i, years: [2016, NOW] },
  { id: "q3-mk1", make: AUDI, model: /^q3\b(?!.*sportback)/i, years: [2012, 2018] },
  { id: "aclass-w176", make: MB, model: /^a[- ]?(class\b|\d{3}\b)/i, years: [2013, 2017] },
  { id: "aclass-w177", make: MB, model: /^a[- ]?(class\b|\d{3}\b)(?!.*saloon)/i, years: [2018, NOW] },
  { id: "cclass-w205", make: MB, model: /^c[- ]?(class\b|\d{3}\b)(?!.*(estate|coupe|cabrio|convertible))/i, years: [2014, 2021] },
  { id: "fiat500", make: /^fiat\b/i, model: /^500\b(?!\s*[lxc]\b)(?!.*(cabrio|convertible|abarth))/i, years: [2008, 2024] },
  { id: "yaris-xp130", make: TOYOTA, model: /^yaris\b(?!.*cross)/i, years: [2011, 2020] },
  { id: "aygo-mk2", make: TOYOTA, model: /^aygo\b(?!.*\bx\b)/i, years: [2014, 2022] },
  { id: "208-mk1", make: PEUGEOT, model: /^208\b/i, years: [2012, 2019] },
  { id: "2008-mk2", make: PEUGEOT, model: /^2008\b/i, years: [2020, NOW] },
  { id: "3008-mk2", make: PEUGEOT, model: /^3008\b/i, years: [2017, NOW] },
  { id: "c3-mk3", make: CITROEN, model: /^c3\b(?!.*(aircross|picasso))/i, years: [2017, NOW] },
  { id: "c1-2", make: CITROEN, model: /^c1\b/i, years: [2014, 2022] },
  { id: "sportage-ql", make: KIA, model: /^sportage\b/i, years: [2016, 2021] },
  { id: "picanto-3", make: KIA, model: /^picanto\b/i, years: [2017, NOW] },
  { id: "ceed-2", make: KIA, model: /^c'?ee'?d\b(?!.*(sw|estate|sportswagon|pro))/i, years: [2012, 2018] },
  { id: "tucson-3", make: HYUNDAI, model: /^tucson\b/i, years: [2015, 2020] },
  { id: "i10-2", make: HYUNDAI, model: /^i10\b/i, years: [2014, 2019] },
  { id: "i20-2", make: HYUNDAI, model: /^i20\b(?!.*(coupe|active))/i, years: [2015, 2020] },
  { id: "fabia-mk3", make: SKODA, model: /^fabia\b(?!.*estate)/i, years: [2015, 2021] },
  { id: "octavia-mk3", make: SKODA, model: /^octavia\b(?!.*estate)/i, years: [2013, 2020] },
  { id: "leon-mk3", make: SEAT, model: /^leon\b(?!.*(st\b|estate|sportstourer|x-?perience))/i, years: [2013, 2020] },
  { id: "ibiza-mk5", make: SEAT, model: /^ibiza\b/i, years: [2017, NOW] },
  { id: "evoque-mk1", make: LR, model: /^(range rover|r rover) evoque\b(?!.*convertible)/i, years: [2011, 2018] },
  { id: "rr-sport-l494", make: LR, model: /^(range rover|r rover) sport\b/i, years: [2013, 2022] },
  { id: "rangerover-l405", make: LR, model: /^(range rover|r rover)\b(?!.*\b(sport|evoque|velar)\b)/i, years: [2013, 2021] },
  { id: "disco-sport", make: LR, model: /^discovery sport\b/i, years: [2015, NOW] },
  { id: "countryman-f60", make: MINI, model: /^countryman\b|\bcountryman\b/i, years: [2017, 2023] },
  { id: "mini-f56", make: MINI, model: /^(cooper|one|mini|hatch)\b(?!.*(countryman|clubman|convertible|cabrio|paceman|coupe|roadster))/i, years: [2014, NOW] },
  { id: "civic-9", make: HONDA, model: /^civic\b(?!.*(type ?r|tourer))/i, years: [2012, 2017] },
  { id: "jazz-2", make: HONDA, model: /^jazz\b/i, years: [2008, 2015] },
  { id: "xc60-mk2", make: /^volvo\b/i, model: /^xc60\b/i, years: [2017, NOW] },
  { id: "swift-4", make: /^suzuki\b/i, model: /^swift\b/i, years: [2017, NOW] },
  { id: "cx5-mk2", make: /^mazda\b/i, model: /^cx-?5\b/i, years: [2017, NOW] },
  { id: "sandero-2", make: /^dacia\b/i, model: /^sandero\b/i, years: [2013, 2020] },
];

const NOT_THIS_SHAPE = /estate|wagon|touring|tourer|convertible|cabrio|roadster|coup|pick ?-?up|chassis|tipper|dropside|minibus|limousine/i;

/** `/cars/m/<id>.svg` for a known make, model and generation, else null (caller falls back to the body-type render). */
export function renderFor(v: { make?: string | null; model?: string | null; year?: number | null; bodyStyle?: string | null }): string | null {
  const make = (v.make ?? "").trim();
  const model = (v.model ?? "").split("·")[0].trim();
  const year = Number(v.year) || 0;
  if (!make || !model || !year) return null;
  const body = (v.bodyStyle ?? "").toLowerCase();
  for (const e of MODEL_RENDERS) {
    if (!e.make.test(make) || !e.model.test(model) || year < e.years[0] || year > e.years[1]) continue;
    if (!e.van && NOT_THIS_SHAPE.test(model)) return null;
    if (body && (e.van ? !/van|panel|box|window|combi|kombi|lcv|light goods/.test(body) : NOT_THIS_SHAPE.test(body) || /van|panel/.test(body))) return null;
    return `/cars/m/${e.id}.svg`;
  }
  return null;
}
