// Envoie l'épisode du jour à youqwiz.com (page jouable /quiz-du-jour/<id>, visible à l'heure de la vidéo).
// POST signé HMAC-SHA256 vers SITE_SYNC_URL (défaut https://youqwiz.com/api/episodes.php) avec SITE_SYNC_KEY.
// Non bloquant : une erreur est signalée (warning) mais ne fait pas échouer la publication YouTube.
// Usage : node scripts/publish-site.mjs [--id <episode>]  (défaut : épisode courant) · --all : renvoie toute la file publiée
import { createHmac } from "node:crypto";
import { existsSync } from "node:fs";
import { argv, p, readJson } from "./lib.mjs";

const { SITE_SYNC_KEY, SITE_SYNC_URL: _u } = process.env;
const SITE_SYNC_URL = _u || "https://youqwiz.com/api/episodes";
if (!SITE_SYNC_KEY) {
  console.log("site : SITE_SYNC_KEY absente, envoi ignoré");
  process.exit(0);
}
const queue = readJson(p("data/state/queue.json"), { published: [] });
const current = readJson(p("data/state/current.json"), {});
const ids = process.argv.includes("--all") ? queue.published.map((r) => r.id) : String(argv("id", current.id) ?? "").split(",").filter(Boolean);

// --remove <id>[,<id>] (13/11/2026) : retire un épisode du site. L'API n'a pas de suppression : on remplace sa fiche par une
// fiche vide (items: []), que le site ignore partout (page 404, absent de l'index, du sitemap et des listes).
const post = async (body) => {
  const sig = "sha256=" + createHmac("sha256", SITE_SYNC_KEY).update(body).digest("hex");
  let res, txt;
  for (let attempt = 1; attempt <= 3; attempt++) {
    res = await fetch(SITE_SYNC_URL, { method: "POST", headers: { "Content-Type": "application/json", "X-YouQwiz-Signature": sig }, body });
    txt = await res.text();
    if (res.ok || (res.status !== 503 && res.status !== 502 && res.status !== 429)) break;
    await new Promise((r) => setTimeout(r, 20_000 * attempt));
  }
  if (!res.ok) throw new Error(`${res.status} ${txt.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").slice(0, 160)}`);
  return txt;
};
const removeIds = process.argv.includes("--remove") ? String(argv("remove", "")).split(",").filter(Boolean) : [];
let removed = 0;
for (const id of removeIds) {
  if (queue.published.some((r) => r.id === id)) { console.warn(`${id} : encore dans la file, retrait refusé`); continue; }
  try {
    await post(JSON.stringify({ episode: { id, title: "", items: [] }, longId: "", shortId: "", publishAt: "2000-01-01T00:00:00.000Z" }));
    console.log(`${id} : retiré du site`);
    removed++;
  } catch (e) {
    console.warn(`${id} : échec du retrait — ${e.message}`);
    if (process.env.GITHUB_ACTIONS) console.log(`::error title=Site::${id} non retiré de youqwiz.com : ${e.message}`);
    process.exitCode = 1;
  }
}
if (removeIds.length && !process.argv.includes("--id") && !process.argv.includes("--all")) ids.length = 0;

let ok = 0, ko = 0;
for (const id of ids) {
  const r = queue.published.find((x) => x.id === id);
  const f = p("data/episodes", `${id}.json`);
  if (!r || !r.longId || !existsSync(f)) { console.log(`${id} : pas encore publié ou épisode introuvable, ignoré`); continue; }
  const ep = readJson(f);
  for (const it of ep.items) delete it.voice;
  delete ep.voice; delete ep.variants;
  const body = JSON.stringify({ episode: ep, longId: r.longId, shortId: r.shortId ?? "", publishAt: r.publishAt });
  const sig = "sha256=" + createHmac("sha256", SITE_SYNC_KEY).update(body).digest("hex");
  try {
    // 3 tentatives : l'hébergeur (o2switch) renvoie parfois un 503 HTML passager
    let res, txt;
    for (let attempt = 1; attempt <= 3; attempt++) {
      res = await fetch(SITE_SYNC_URL, { method: "POST", headers: { "Content-Type": "application/json", "X-YouQwiz-Signature": sig }, body });
      txt = await res.text();
      if (res.ok || (res.status !== 503 && res.status !== 502 && res.status !== 429)) break;
      console.log(`${id} : ${res.status}, nouvelle tentative dans ${20 * attempt} s`);
      await new Promise((r) => setTimeout(r, 20_000 * attempt));
    }
    if (!res.ok) throw new Error(`${res.status} ${txt.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").slice(0, 160)}`);
    console.log(`${id} : envoyé → ${JSON.parse(txt).url}`);
    ok++;
  } catch (e) {
    ko++;
    console.warn(`${id} : échec envoi site — ${e.message}`);
  }
}
if (process.env.GITHUB_ACTIONS) {
  if (ko) console.log(`::warning title=Site::${ko} épisode(s) non envoyé(s) à youqwiz.com (relancer : node scripts/publish-site.mjs --all)`);
  else if (ok) console.log(`::notice title=Site::${ok} épisode(s) en ligne sur youqwiz.com/quiz-du-jour`);
}
