// Récupère la musique de fond depuis une URL (WAV/MP3), la convertit en MP3 128 k avec fondu
// de boucle, et l'écrit dans public/audio/music.mp3 (non versionnée : à déposer ensuite derrière l'URL privée MUSIC_URL).
// Usage : node scripts/fetch-music.mjs --url https://… [--gain -3]
// Exécuté sur l'exécuteur GitHub (accès internet libre), pas depuis le conteneur Claude.
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { argv, p } from "./lib.mjs";

const url = argv("url");
if (!url) throw new Error("--url manquant");
const gain = Number(argv("gain", "-3"));
const tmp = p("out/music-src");
mkdirSync(p("out"), { recursive: true });
mkdirSync(p("public/audio"), { recursive: true });

const res = await fetch(url);
if (!res.ok) throw new Error(`téléchargement ${res.status}`);
writeFileSync(tmp, Buffer.from(await res.arrayBuffer()));
const out = p("public/audio/music.mp3");
// fondu d'entrée/sortie court pour une boucle propre, normalisation douce
execSync(`ffmpeg -y -loglevel error -i "${tmp}" -af "afade=t=in:d=0.5,areverse,afade=t=in:d=0.8,areverse,volume=${gain}dB" -ar 44100 -ac 2 -b:a 128k "${out}"`, { stdio: "inherit" });
const dur = execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${out}"`).toString().trim();
console.log(`musique : ${out} (${Number(dur).toFixed(1)} s)`);
if (process.env.GITHUB_ACTIONS) console.log(`::notice title=Musique::public/audio/music.mp3 écrite, ${Number(dur).toFixed(1)} s`);
