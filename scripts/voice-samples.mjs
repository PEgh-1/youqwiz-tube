// Échantillons de voix ElevenLabs pour choisir le ton (voix / réglages / modèle).
// Usage : node scripts/voice-samples.mjs --voices id1,id2 [--label test1]
// Écrit docs/voice-samples/<label>/<voice>-<variante>.mp3 + index.html (écoute dans le navigateur via GitHub).
import { mkdirSync, writeFileSync } from "node:fs";
import { argv, p } from "./lib.mjs";

const { ELEVENLABS_API_KEY } = process.env;
if (!ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY absent");
let voices = (argv("voices", "") || "").split(",").map((s) => s.trim()).filter(Boolean);
// --names Léo,Eric : résout les identifiants depuis « Mes voix » (préfixe du nom, insensible à la casse)
const names = (argv("names", "") || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
if (names.length) {
  const r = await fetch("https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": ELEVENLABS_API_KEY } });
  if (!r.ok) throw new Error(`voices ${r.status}`);
  const all = (await r.json()).voices || [];
  for (const n of names) {
    const v = all.find((x) => x.name.toLowerCase().startsWith(n));
    if (v) voices.push(v.voice_id); else console.warn(`voix « ${n} » absente de Mes voix`);
    if (v) console.log(`${v.name} → ${v.voice_id}`);
  }
}
if (!voices.length && process.env.ELEVENLABS_VOICE_ID) voices = [process.env.ELEVENLABS_VOICE_ID];
const label = argv("label", "test");
const dir = p("docs/voice-samples", label);
mkdirSync(dir, { recursive: true });

const TEXT = "Niveau difficile. Accroche-toi ! Quelle est la capitale de l'Australie ? Réponse : Canberra ! Et toi, combien de points ? Dis-le en commentaire !";
const TEXT_V3 = "[excited] Niveau difficile. Accroche-toi ! [curious] Quelle est la capitale de l'Australie ? [cheerful] Réponse : Canberra ! Et toi, combien de points ? Dis-le en commentaire !";

const VARIANTS = {
  "A-flash-actuel": { model_id: "eleven_flash_v2_5", text: TEXT, voice_settings: { stability: 0.45, similarity_boost: 0.75, style: 0.35, use_speaker_boost: true, speed: 1.05 } },
  "B-flash-pechu": { model_id: "eleven_flash_v2_5", text: TEXT, voice_settings: { stability: 0.25, similarity_boost: 0.8, style: 0.85, use_speaker_boost: true, speed: 1.12 } },
  "C-multilingual-expressif": { model_id: "eleven_multilingual_v2", text: TEXT, voice_settings: { stability: 0.3, similarity_boost: 0.8, style: 0.8, use_speaker_boost: true, speed: 1.1 } },
  "D-v3-tags": { model_id: "eleven_v3", text: TEXT_V3, voice_settings: { stability: 0.3, similarity_boost: 0.8, style: 0.7, use_speaker_boost: true } },
};

const rows = [];
for (const v of voices) {
  let name = v;
  try {
    const r = await fetch(`https://api.elevenlabs.io/v1/voices/${v}`, { headers: { "xi-api-key": ELEVENLABS_API_KEY } });
    if (r.ok) name = (await r.json()).name || v;
  } catch {}
  for (const [k, cfg] of Object.entries(VARIANTS)) {
    const body = { text: cfg.text, model_id: cfg.model_id, voice_settings: cfg.voice_settings };
    if (cfg.model_id !== "eleven_v3") body.language_code = "fr";
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${v}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": ELEVENLABS_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const file = `${v}-${k}.mp3`;
    if (!res.ok) {
      const msg = (await res.text()).slice(0, 160).replace(/sk_[A-Za-z0-9]+/g, "sk_***");
      rows.push({ voice: name, variant: k, file: null, error: `${res.status} ${msg}` });
      console.warn(`${name} ${k} : ${res.status} ${msg}`);
      continue;
    }
    writeFileSync(`${dir}/${file}`, Buffer.from(await res.arrayBuffer()));
    rows.push({ voice: name, variant: k, file });
    console.log(`${name} ${k} : ok`);
  }
}
const html = `<!doctype html><meta charset="utf-8"><title>Échantillons voix — ${label}</title>
<style>body{font-family:Arial;padding:30px;background:#f6f3ff}h2{color:#4a2fb8}div{background:#fff;border:3px solid #1a1030;border-radius:14px;padding:14px 20px;margin:12px 0;box-shadow:5px 5px 0 #1a1030}audio{width:100%}</style>
<h1>Échantillons voix YouQwiz — ${label}</h1><p>Texte : « ${TEXT} »</p>
${rows.map((r) => `<div><h2>${r.voice} — ${r.variant}</h2>${r.file ? `<audio controls preload="none" src="${r.file}"></audio>` : `<em>erreur : ${r.error}</em>`}</div>`).join("\n")}`;
writeFileSync(`${dir}/index.html`, html);
writeFileSync(`${dir}/index.json`, JSON.stringify(rows, null, 2));
if (process.env.GITHUB_ACTIONS) console.log(`::notice title=Voix::${rows.filter((r) => r.file).length}/${rows.length} échantillons dans docs/voice-samples/${label}`);
