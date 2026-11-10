// Pousse vers youqwiz.com (POST signé HMAC-SHA256, même clé que les quiz du jour) :
//  - www/seo_pages_agent.json : landings « crée ton quiz » (/quiz-…)
//  - www/series/*.json        : séries culture générale jouables (/quiz-<sujet>)
//  - www/series-en/*.json     : séries anglaises (10/11/2026), corps séparé avec "lang": "en" → youqwiz.com/en/<chemin>
//    (chemins sans /en, lien "alt": {"fr": "/quiz-…"} vers la série française équivalente pour hreflang)
//  - www/seo_pages_agent_en.json (facultatif, absent pour l'instant) : pages anglaises, envoyées dans le même corps anglais
// Un POST remplace tout le fichier serveur de sa langue : le corps anglais porte toujours "lang": "en" (sinon il écraserait le français).
// Le serveur valide et assainit tout (données seules, jamais de code).
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { createHmac } from "node:crypto";
const { SITE_SYNC_KEY } = process.env;
if (!SITE_SYNC_KEY) { console.error("SITE_SYNC_KEY absente"); process.exit(1); }

const loadSeries = (dir, pages, check) => {
  const series = {};
  if (existsSync(dir)) for (const f of readdirSync(dir).filter(f => f.endsWith(".json")).sort()) {
    const s = JSON.parse(readFileSync(dir + "/" + f, "utf8"));
    if (!s.path || series[s.path] || pages[s.path]) { console.error("chemin manquant ou en double : " + dir + "/" + f); process.exit(1); }
    if (check && !check(s)) { console.error("série refusée : " + dir + "/" + f); process.exit(1); }
    series[s.path] = s;
  }
  return series;
};
const post = async (body) => {
  const sig = "sha256=" + createHmac("sha256", SITE_SYNC_KEY).update(body).digest("hex");
  const r = await fetch("https://youqwiz.com/api/episodes?seo=1", { method: "POST", headers: { "Content-Type": "application/json", "X-Youqwiz-Signature": sig }, body });
  const t = await r.text();
  console.log(r.status, t);
  if (!r.ok) process.exit(1);
};
const verify = async (publicPaths) => {
  let bad = 0;
  for (const p of publicPaths) {
    const g = await fetch("https://youqwiz.com" + p);
    console.log(g.status, p);
    if (g.status !== 200) bad++;
  }
  return bad;
};

// Français (inchangé)
const pages = JSON.parse(readFileSync("www/seo_pages_agent.json", "utf8"));
const series = loadSeries("www/series", pages);
const body = JSON.stringify({ series, pages });
await post(body);
let bad = await verify([...Object.keys(series), ...Object.keys(pages)]);

// Anglais : chemins internes sans /en ; « alt.fr » (si présent) doit viser une série française du dépôt.
const pagesEn = existsSync("www/seo_pages_agent_en.json") ? JSON.parse(readFileSync("www/seo_pages_agent_en.json", "utf8")) : null;
const seriesEn = loadSeries("www/series-en", pagesEn ?? {}, (s) =>
  /^\/[a-z0-9][a-z0-9-]{2,90}$/.test(s.path) && !s.path.startsWith("/en/") && (!s.alt?.fr || Boolean(series[s.alt.fr])));
if (Object.keys(seriesEn).length || pagesEn) {
  await post(JSON.stringify({ lang: "en", series: seriesEn, ...(pagesEn ? { pages: pagesEn } : {}) }));
  // Chemin public anglais : /en + chemin, /culture-generale/… → /en/trivia/… (YQ_PATH_MAP du site)
  const pub = (p) => "/en" + p.replace(/^\/culture-generale(?=\/|$)/, "/trivia");
  bad += await verify([...Object.keys(seriesEn), ...Object.keys(pagesEn ?? {})].map(pub));
}
if (bad) process.exit(1);
