#!/usr/bin/env node
// Robots.txt-compliant Gumtree crawl (overnight breadth run). /search and multi-param URLs are disallowed in
// gumtree.com/robots.txt, so this only fetches /cars-vans-motorbikes/{cars|vans}/<make>/<model>[/uk/<town>]?seller_type=<x>
// (single query param, page 1 only). Emphasis: private sellers by town (cheap private cars). Dedupe by listing ID via merge().
import fs from "node:fs"; import path from "node:path"; import zlib from "node:zlib";
import { GT_MODELS, GT_MODELS_EXTRA, GT_VANS, parseGumtreePage, merge, readGz, toCsv, politeFetch } from "./collect.mjs";
import { PRIORITY_JOBS, jobUrl } from "./priority_jobs.mjs";
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const MASTER = path.join(ROOT, "data/listings/listings.csv.gz");
const START = +(process.env.START ?? 0), DELAY = +(process.env.DELAY_MS ?? 6000), MAX_MIN = +(process.env.MAX_MINUTES ?? 400), T0 = Date.now();
let STOP = false; for (const s of ["SIGTERM", "SIGINT"]) process.on(s, () => { STOP = true; });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TOWNS = (process.env.TOWNS ?? "london,manchester,birmingham,leeds,glasgow,liverpool,bristol,sheffield,edinburgh,cardiff,leicester,nottingham,newcastle,belfast,southampton,coventry,bradford,hull,stoke-on-trent,plymouth,wolverhampton,derby,swansea,aberdeen,norwich,portsmouth,reading,brighton,luton,sunderland,preston,blackpool,middlesbrough,bolton,milton-keynes,peterborough,northampton,oxford,cambridge,exeter,ipswich,york,dundee,doncaster,swindon").split(",");
const slug = (s) => s.replace(/ /g, "-");
let seed = 42; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const cars = [...GT_MODELS, ...GT_MODELS_EXTRA].flatMap(([mk, ms]) => ms.map((m) => [mk, m]));
const uniq = [...new Map(cars.map((x) => [x.join("|"), x])).values()];
const vans = GT_VANS.flatMap(([mk, ms]) => ms.map((m) => [mk, m]));
const jobs = [];
for (const [mk, m] of uniq) for (const s of ["private", "trade"]) jobs.push({ cat: "cars", mk, m, s, town: null }); // national
for (const [mk, m] of vans) for (const s of ["private", "trade"]) jobs.push({ cat: "vans", mk, m, s, town: null });
const local = [];
for (const [mk, m] of uniq) for (const t of TOWNS) local.push({ cat: "cars", mk, m, s: "private", town: t });
for (const [mk, m] of vans) for (const t of TOWNS.slice(0, 20)) local.push({ cat: "vans", mk, m, s: "private", town: t });
jobs.push(...shuffle(local));
const writeGz = (p, rows) => fs.writeFileSync(p, zlib.gzipSync(toCsv(rows), { level: 9 }));
let seen = [], used = 0, challenges = 0, totalNew = 0; const zeroModel = new Map();
const save = () => { const master = readGz(MASTER); const { rows, newBySource } = merge(master, seen); writeGz(MASTER, rows); totalNew += newBySource.gumtree ?? 0;
  console.log(new Date().toISOString(), "saved", { pages: used, job: START + used, batch: seen.length, new: newBySource, total: rows.length }); seen = []; };
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("page watchdog timeout")), ms))]);
// Coverage-gap jobs run first on every start until done; progress kept in state/priority_next.txt (PRIORITY=0 disables).
// They log as "qN/M" so autorun.sh's resume index (last ^pN/ line) is unaffected.
const PSTATE = path.join(ROOT, "state/priority_next.txt"); fs.mkdirSync(path.dirname(PSTATE), { recursive: true });
let pNext = fs.existsSync(PSTATE) ? +fs.readFileSync(PSTATE, "utf8") || 0 : 0; const pZero = new Map(); let pUsed = 0;
if (process.env.PRIORITY !== "0") for (; pNext < PRIORITY_JOBS.length; pNext++) {
  if (STOP || (Date.now() - T0) / 60000 > MAX_MIN || challenges >= 3) break;
  const j = PRIORITY_JOBS[pNext], zkey = `${j.mk}|${j.m}|${j.facet}`;
  if (j.m && (pZero.get(zkey) ?? 0) >= 3) { fs.writeFileSync(PSTATE, String(pNext + 1)); continue; }
  pUsed++; let html;
  try { html = await withTimeout(politeFetch(jobUrl(j)).then((r) => r.text()), 180000); } catch (e) { console.error("err", e.message); if (e.blocked) { challenges = 3; break; } await sleep(DELAY); continue; }
  if (/window\.rbzns|kramericaindustries/.test(html)) { if (++challenges >= 3) { console.error("bot challenge 3x - stopping"); break; } console.error("challenge - pause 10 min"); await sleep(600000); pNext--; continue; }
  const { ads, total } = parseGumtreePage(html);
  if (!ads.length) pZero.set(zkey, (pZero.get(zkey) ?? 0) + 1);
  seen.push(...ads); fs.writeFileSync(PSTATE, String(pNext + 1));
  if (pUsed % 25 === 0) console.log(`q${pNext + 1}/${PRIORITY_JOBS.length} prio ${j.mk} ${j.m || "*"} ${j.facet || "-"} ${j.s} ${j.town ?? "uk"} -> ${ads.length}/${total}`);
  if (pUsed % 150 === 0) save();
  await sleep(DELAY + Math.random() * DELAY * 0.6);
}
if (pUsed) { save(); console.log("priority pages", pUsed, "next", pNext, "/", PRIORITY_JOBS.length); }
if (challenges >= 3) STOP = true;
for (const [ji, j] of jobs.entries()) {
  if (ji < START) continue;
  if (STOP || (Date.now() - T0) / 60000 > MAX_MIN) break;
  const mkey = `${j.cat}|${j.mk}|${j.m}`; if ((zeroModel.get(mkey) ?? 0) >= 4) continue;
  const url = `https://www.gumtree.com/cars-vans-motorbikes/${j.cat}/${slug(j.mk)}/${slug(j.m)}${j.town ? "/uk/" + j.town : ""}?seller_type=${j.s}`;
  used++; let html; const pn = START + used;
  try { html = await withTimeout(politeFetch(url).then((r) => r.text()), 180000); } catch (e) { console.error("err", e.message); if (e.blocked) break; await sleep(DELAY); continue; }
  if (/window\.rbzns|kramericaindustries/.test(html)) { if (++challenges >= 3) { console.error("bot challenge 3x - stopping"); break; } console.error("challenge - pause 10 min"); await sleep(600000); continue; }
  const { ads, total } = parseGumtreePage(html);
  if (!ads.length) zeroModel.set(mkey, (zeroModel.get(mkey) ?? 0) + 1);
  seen.push(...ads);
  if (used % 25 === 0) console.log(`p${pn}/${jobs.length} ${j.cat} ${j.mk} ${j.m} ${j.s} ${j.town ?? "uk"} -> ${ads.length}/${total}`);
  if (used % 150 === 0) save();
  await sleep(DELAY + Math.random() * DELAY * 0.6);
}
save(); console.log("DONE pages", used, "newTotal", totalNew);
