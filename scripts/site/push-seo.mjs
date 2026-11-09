// Pousse vers youqwiz.com (POST signé HMAC-SHA256, même clé que les quiz du jour) :
//  - www/seo_pages_agent.json : landings « crée ton quiz » (/quiz-…)
//  - www/series/*.json        : séries culture générale jouables (/quiz-<sujet>)
// Le serveur valide et assainit tout (données seules, jamais de code).
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { createHmac } from "node:crypto";
const { SITE_SYNC_KEY } = process.env;
if (!SITE_SYNC_KEY) { console.error("SITE_SYNC_KEY absente"); process.exit(1); }
const pages = JSON.parse(readFileSync("www/seo_pages_agent.json", "utf8"));
const series = {};
if (existsSync("www/series")) for (const f of readdirSync("www/series").filter(f => f.endsWith(".json")).sort()) {
  const s = JSON.parse(readFileSync("www/series/" + f, "utf8"));
  if (!s.path || series[s.path] || pages[s.path]) { console.error("chemin manquant ou en double : " + f); process.exit(1); }
  series[s.path] = s;
}
const body = JSON.stringify({ series, pages });
const sig = "sha256=" + createHmac("sha256", SITE_SYNC_KEY).update(body).digest("hex");
const r = await fetch("https://youqwiz.com/api/episodes?seo=1", { method: "POST", headers: { "Content-Type": "application/json", "X-Youqwiz-Signature": sig }, body });
const t = await r.text();
console.log(r.status, t);
if (!r.ok) process.exit(1);
let bad = 0;
for (const p of [...Object.keys(series), ...Object.keys(pages)]) {
  const g = await fetch("https://youqwiz.com" + p);
  console.log(g.status, p);
  if (g.status !== 200) bad++;
}
if (bad) process.exit(1);
