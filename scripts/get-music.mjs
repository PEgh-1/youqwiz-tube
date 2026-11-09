// Télécharge les pistes musicales au moment du rendu depuis une URL privée (secret GitHub MUSIC_URL).
// Les pistes ne sont pas versionnées dans le dépôt (public/audio/music*.mp3 est ignoré par git).
// MUSIC_URL : un .mp3 (écrit en public/audio/music.mp3) ou une archive .zip contenant des music*.mp3
// (extraits à plat dans public/audio/). Plusieurs URL possibles, séparées par des espaces ou des retours ligne.
// Sans MUSIC_URL : rien n'est fait, la vidéo est rendue sans musique de fond.
// Relancer ensuite `node scripts/prepare-assets.mjs` pour mettre à jour src/audio.json.
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { p } from "./lib.mjs";

const urls = (process.env.MUSIC_URL || "").split(/\s+/).filter(Boolean);
if (!urls.length) {
  console.log("musique : MUSIC_URL absente, rendu sans musique de fond");
  process.exit(0);
}

const audioDir = p("public/audio");
const tmp = p("out/music-dl");
rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });
mkdirSync(audioDir, { recursive: true });

const download = async (url) => {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url).catch((e) => ({ ok: false, status: e.message }));
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    if (attempt === 3) throw new Error(`musique : téléchargement impossible (${res.status})`);
    await new Promise((r) => setTimeout(r, 2000 * attempt));
  }
};

let n = 0;
for (const [i, url] of urls.entries()) {
  const buf = await download(url);
  const isZip = buf.subarray(0, 4).toString("binary") === "PK\x03\x04";
  if (isZip) {
    const zip = `${tmp}/pack-${i}.zip`;
    writeFileSync(zip, buf);
    execFileSync("unzip", ["-o", "-j", "-q", zip, "-d", `${tmp}/x-${i}`]);
    for (const f of readdirSync(`${tmp}/x-${i}`).filter((f) => /^music(-[\w-]+)?\.mp3$/.test(f))) {
      renameSync(`${tmp}/x-${i}/${f}`, `${audioDir}/${f}`);
      n++;
    }
  } else {
    writeFileSync(`${audioDir}/${i === 0 ? "music.mp3" : `music-${i}.mp3`}`, buf);
    n++;
  }
}
rmSync(tmp, { recursive: true, force: true });
console.log(`musique : ${n} piste(s) prête(s) dans public/audio`);
if (!n) throw new Error("musique : aucune piste music*.mp3 trouvée à l'URL fournie");
