// Coverage-gap priority jobs for collect_robots.mjs (robots-compliant: path facets + single ?seller_type= param, page 1 only).
// Gaps (Oct 24 harvest, 24.9k rows): MG 8 rows, smart 7, Abarth 0, Porsche 142; private >£20k 169; >£40k 151; dealer <£2k 172.
// Gumtree ignores ?price= on these pages and min/max_price is robots-disallowed, so price gaps are targeted by model choice.
// make-level pages (/cars/<make>[/<facet>]) return ads for all models of the make; facets are path slugs seen on Gumtree's make pages.
const TOWNS = "london,manchester,birmingham,leeds,glasgow,liverpool,bristol,sheffield,edinburgh,cardiff,leicester,nottingham,newcastle,belfast,southampton,coventry,bradford,hull,stoke-on-trent,plymouth,wolverhampton,derby,swansea,aberdeen,norwich,portsmouth,reading,brighton,luton,sunderland,preston,blackpool,middlesbrough,bolton,milton-keynes,peterborough,northampton,oxford,cambridge,exeter,ipswich,york,dundee,doncaster,swindon".split(",");
const FACETS = ["", "automatic", "manual", "black", "white", "silver", "grey", "blue", "red", "hatchback", "coupe", "convertible", "suv", "estate"];
const GAP_MAKES = ["mg", "smart", "abarth", "porsche"];
// models with the most >£20k / >£40k listings in the harvest (private supply is the gap)
const HI = [["porsche", "911"], ["porsche", "cayenne"], ["porsche", "macan"], ["porsche", "boxster"], ["land rover", "defender"], ["land rover", "range rover"],
  ["land rover", "range rover sport"], ["land rover", "range rover velar"], ["bmw", "x5"], ["bmw", "m4"], ["bmw", "m3"], ["volkswagen", "touareg"],
  ["mercedes-benz", "v class"], ["audi", "rs6"], ["audi", "q7"], ["tesla", "model y"], ["tesla", "model 3"], ["tesla", "model s"], ["volvo", "xc90"],
  ["volvo", "xc60"], ["cupra", "formentor"], ["toyota", "land cruiser"], ["ford", "ranger"], ["land rover", "discovery"]];
// models with the most sub-£2k listings (dealer supply is the gap)
const LO = [["ford", "fiesta"], ["ford", "focus"], ["volkswagen", "golf"], ["peugeot", "207"], ["volkswagen", "polo"], ["renault", "clio"], ["ford", "ka"],
  ["nissan", "micra"], ["toyota", "yaris"], ["honda", "jazz"], ["vauxhall", "corsa"], ["vauxhall", "astra"], ["peugeot", "107"], ["nissan", "note"], ["fiat", "500"]];
let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const J = (mk, m, s, town = null, facet = "") => ({ cat: "cars", mk, m, s, town, facet, prio: true });
const g1 = [], g2 = [], g3 = [];
for (const mk of GAP_MAKES) for (const f of FACETS) for (const s of ["private", "trade"]) g1.push(J(mk, "", s, null, f));
for (const mk of GAP_MAKES) for (const t of TOWNS) for (const s of ["private", "trade"]) g1.push(J(mk, "", s, t));
for (const [mk, m] of HI) { for (const f of ["", "automatic", "black", "white", "grey"]) g2.push(J(mk, m, "private", null, f)); g2.push(J(mk, m, "trade"));
  for (const t of TOWNS.slice(0, 12)) g2.push(J(mk, m, "private", t)); }
for (const [mk, m] of LO) { g3.push(J(mk, m, "trade", null, "manual")); for (const t of TOWNS.slice(0, 20)) g3.push(J(mk, m, "trade", t)); }
// national make-level pages first (highest yield), then round-robin the rest so every gap moves early
const head = g1.filter((j) => !j.town && !j.facet), rest = [shuffle(g1.filter((j) => j.town || j.facet)), shuffle(g2), shuffle(g3)];
export const PRIORITY_JOBS = [...head];
for (let i = 0; rest.some((r) => i < r.length); i++) for (const r of rest) if (i < r.length) PRIORITY_JOBS.push(r[i]);
export const jobUrl = (j) => { const sl = (s) => s.replace(/ /g, "-");
  return `https://www.gumtree.com/cars-vans-motorbikes/${j.cat}/${sl(j.mk)}${j.m ? "/" + sl(j.m) : ""}${j.facet ? "/" + j.facet : ""}${j.town ? "/uk/" + j.town : ""}?seller_type=${j.s}`; };
