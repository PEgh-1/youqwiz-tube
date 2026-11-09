// Contrôle qualité avant mise en ligne : durée, pistes, taille, liste noire, 3 images de contrôle.
import { execSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { findBlacklisted, p, readJson, writeJson } from "./lib.mjs";

const current = readJson(p("data/state/current.json"));
const ep = readJson(current.file);
const outDir = p("out", ep.id);
const manifest = readJson(`${outDir}/manifest.json`);
const errors = [];

const probe = (f) => JSON.parse(execSync(`ffprobe -v error -print_format json -show_streams -show_format "${f}"`).toString());
const expectedLong = manifest.expected?.long;
const expectedShort = manifest.expected?.short;
if (!expectedLong) errors.push("manifest sans durée attendue (rendu incomplet ?)");

for (const [k, f] of Object.entries(manifest.files)) {
  if (!existsSync(f)) {
    errors.push(`fichier manquant : ${k}`);
    continue;
  }
  if (statSync(f).size < 20_000) errors.push(`fichier trop petit : ${k}`);
  if (f.endsWith(".mp4")) {
    const info = probe(f);
    const dur = Number(info.format.duration);
    const hasVideo = info.streams.some((s) => s.codec_type === "video");
    const hasAudio = info.streams.some((s) => s.codec_type === "audio");
    if (!hasVideo) errors.push(`${k} : pas de piste vidéo`);
    if (!hasAudio) errors.push(`${k} : pas de piste audio`);
    if (k === "long" && expectedLong && Math.abs(dur - expectedLong) > 2) errors.push(`long : durée ${dur.toFixed(1)} s, attendu ${expectedLong.toFixed(1)} s`);
    if (k === "short" && expectedShort && Math.abs(dur - expectedShort) > 2) errors.push(`short : durée ${dur.toFixed(1)} s, attendu ${expectedShort.toFixed(1)} s`);
    if (k === "short" && dur > 60) errors.push(`short : ${dur.toFixed(1)} s > 60 s`);
    if (k === "short2" && manifest.expected?.short2 && Math.abs(dur - manifest.expected.short2) > 2) errors.push(`short2 : durée ${dur.toFixed(1)} s, attendu ${manifest.expected.short2.toFixed(1)} s`);
    if (k === "short2" && dur > 60) errors.push(`short2 : ${dur.toFixed(1)} s > 60 s`);
    if (k === "long" && dur < 60) errors.push(`long : ${dur.toFixed(1)} s, trop court pour une vidéo longue`);
    if (k === "long" && dur < 600 && process.env.GITHUB_ACTIONS) console.log(`::warning title=Durée::${dur.toFixed(0)} s, sous la cible de 10 min (banque trop petite)`);
    if (k === "long" && dur > 2400) errors.push(`long : ${dur.toFixed(0)} s > 40 min`);
  }
}

const bad = findBlacklisted(`${ep.title} ${ep.meta.description} ${ep.items.map((i) => i.answer).join(" ")}`);
if (bad.length) errors.push(`liste noire : ${bad.join(", ")}`);
if (ep.title.length > 100) errors.push(`titre trop long (${ep.title.length} > 100)`);
if (ep.meta?.short2 && ep.meta.short2.title === ep.meta.shortTitle) errors.push("les deux Shorts ont le même titre");
if (new Set(ep.items.map((i) => JSON.stringify(i.prompt))).size !== ep.items.length) errors.push("doublons dans les items");

// Anti-répétition (03/11/2026) : l'épisode est comparé aux 30 précédents.
const previous = readdirSync(p("data/episodes"))
  .filter((f) => /^\d{4}-\d{2}-\d{2}-/.test(f) && !f.startsWith(ep.id))
  .sort()
  .slice(-30)
  .map((f) => readJson(p("data/episodes", f)))
  .filter(Boolean);
const words = (s) => new Set(String(s ?? "").toLowerCase().replace(/[^\p{L}\p{N} ]+/gu, " ").split(/\s+/).filter((w) => w.length > 3));
const jaccard = (a, b) => { const A = words(a), B = words(b); const inter = [...A].filter((w) => B.has(w)).length; return inter / (A.size + B.size - inter || 1); };
const descBody = (e) => String(e.meta?.description ?? "").replace(/⏱️ Chapit(re|er)s[\s\S]*$/, "").replace(/https?:\S+/g, "").replace(/#\w+/g, "");
for (const e of previous) {
  if (e.title === ep.title) errors.push(`titre identique à ${e.id}`);
  if (jaccard(descBody(e), descBody(ep)) > 0.85) errors.push(`description quasi identique à ${e.id}`);
}
const last = previous.at(-1);
if (last?.variants && ep.variants) {
  const same = ["preroll", "subscribe", "packshot", "outro"].filter((k) => JSON.stringify(last.variants[k]) === JSON.stringify(ep.variants[k]));
  if (same.length >= 3) console.warn(`habillage proche de l'épisode précédent (${same.join(", ")} identiques)`);
  if (last.theme === ep.theme && last.style?.pattern === ep.style?.pattern && last.pillar === ep.pillar) errors.push(`même palette et même motif que ${last.id}`);
}
if (ep.items.length > 3 && !ep.meta?.chapters?.length && process.env.GITHUB_ACTIONS) console.log("::warning title=Chapitres::aucun chapitre (scripts/chapters.mjs non lancé ?)");

// Images de contrôle (début, milieu, fin) jointes au récap.
if (existsSync(manifest.files.long)) {
  const dur = Number(probe(manifest.files.long).format.duration);
  for (const [name, t] of [["start", 4], ["mid", dur / 2], ["end", dur - 3]]) {
    execSync(`ffmpeg -y -loglevel error -ss ${t} -i "${manifest.files.long}" -frames:v 1 -vf scale=640:-1 "${outDir}/check-${name}.jpg"`);
  }
}

writeJson(`${outDir}/qc.json`, { ok: errors.length === 0, errors, expectedLong, checkedAt: new Date().toISOString() });
if (errors.length) {
  console.error("QC ÉCHOUÉ :\n - " + errors.join("\n - "));
  if (process.env.GITHUB_ACTIONS) console.log(`::error title=QC::${errors.join(" | ")}`);
  process.exit(1);
}
console.log("QC OK");
if (process.env.GITHUB_ACTIONS) console.log(`::notice title=QC::OK — ${ep.id} (${expectedLong} s)`);
