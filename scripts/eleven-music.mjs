// Génère des musiques de fond candidates avec Eleven Music (instrumentales, ~2 min, 900 crédits/min environ)
// dans out/music-candidates/<slug>.mp3, à écouter avant d'en retenir dans public/audio/music-<slug>.mp3.
// Exécuté sur l'exécuteur GitHub (secret ELEVENLABS_API_KEY). Usage : node scripts/eleven-music.mjs [--only devine,choix] [--seconds 120]
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { argv, p } from "./lib.mjs";

const { ELEVENLABS_API_KEY } = process.env;
if (!ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY absent");
const seconds = Number(argv("seconds", "120"));
const only = argv("only", "").split(",").filter(Boolean);

// Un style par pilier, tous instrumentaux et bouclables (la vidéo lit la piste en boucle à faible volume).
const PROMPTS = {
  devine: "Upbeat playful ukulele and marimba pop, cheerful family quiz show background music, light percussion and hand claps, 118 BPM, bright and simple, loopable, instrumental",
  choix: "Fun bubbly electro-pop with synth plucks, bouncy bass and finger snaps, game show energy, 122 BPM, playful and modern, loopable, instrumental",
  culture: "Light curious pizzicato strings and glockenspiel, quiz show thinking music with a gentle groove, 100 BPM, warm, friendly and clever, loopable, instrumental",
  generations: "Warm nostalgic acoustic guitar, piano and soft brushed drums, 1960s-1970s French cafe mood, 95 BPM, gentle and cheerful, loopable, instrumental",
  emojis: "Quirky sneaky cartoon tune with xylophone, pizzicato, muted trumpet and woodblocks, mystery and fun, 110 BPM, playful, loopable, instrumental",
};
const outDir = p("out/music-candidates");
mkdirSync(outDir, { recursive: true });

for (const [slug, prompt] of Object.entries(PROMPTS)) {
  if (only.length && !only.includes(slug)) continue;
  const res = await fetch("https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128", {
    method: "POST",
    headers: { "xi-api-key": ELEVENLABS_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, music_length_ms: seconds * 1000, force_instrumental: true, model_id: "music_v2_5" }),
  });
  if (!res.ok) { console.warn(`${slug} : Eleven Music ${res.status} ${(await res.text()).slice(0, 200)}`); continue; }
  const raw = `${outDir}/${slug}.raw.mp3`;
  writeFileSync(raw, Buffer.from(await res.arrayBuffer()));
  const out = `${outDir}/${slug}.mp3`;
  // fondus courts pour une boucle propre, -3 dB
  execSync(`ffmpeg -y -loglevel error -i "${raw}" -af "afade=t=in:d=0.5,areverse,afade=t=in:d=0.8,areverse,volume=-3dB" -ar 44100 -ac 2 -b:a 128k "${out}"`);
  const dur = execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${out}"`).toString().trim();
  console.log(`${slug} : ${Number(dur).toFixed(0)} s → ${out}`);
}
