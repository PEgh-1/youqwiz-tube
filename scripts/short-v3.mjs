// Shorts extraits v3 « Le quiz express » (11/11/2026) : 3 Shorts par épisode, 5 questions chacun en difficulté croissante
// (1 facile, 2 moyennes, 1 difficile, 1 « champions »), jamais deux fois la même question. Voix réclame (même traitement que la Minute).
// Usage : node scripts/short-v3.mjs --episode data/episodes/<id>.json [--only 1]   → out/short-v3/<id>-<n>.mp4 + <id>.json (titres)
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const arg = (k, d) => (process.argv.includes(`--${k}`) ? process.argv[process.argv.indexOf(`--${k}`) + 1] : d);
const ep = JSON.parse(readFileSync(arg("episode"), "utf8"));
const only = arg("only") ? Number(arg("only")) : null;
const KEY = process.env.ELEVENLABS_API_KEY, VOICE = process.env.ELEVENLABS_VOICE_ID;
const TAG = "[annonceur de réclame radio des années 30, voix nasillarde, très enjoué, débit rapide]";
const sh = (c) => execSync(c, { stdio: ["ignore", "pipe", "pipe"], timeout: 120_000 }).toString();
mkdirSync("out/short-v3", { recursive: true });
mkdirSync(`public/short-v3/${ep.id}`, { recursive: true });

// Nom lu et affiché après « Cinq … » ; consigne courte affichée au-dessus de la carte.
const bank = ep.bank ?? ep.id.split("-").slice(3).join("-");
const BANKS = {
  "pays-sans-voyelles": ["pays sans voyelles", "Quel est ce pays ?"], drapeaux: ["drapeaux", "Quel est ce pays ?"], animaux: ["animaux", "Quel est cet animal ?"],
  "fruits-legumes": ["fruits et légumes", "Qu'est-ce que c'est ?"], alphabet: ["défis de l'alphabet", "Trouvez-en un !"], maths: ["calculs de tête", "Combien ça fait ?"],
  "culture-generale": ["questions de culture générale", ""], vocabulaire: ["mots rares", ""], acronymes: ["sigles à décoder", ""], generations: ["souvenirs d'autrefois", ""], noel: ["questions de Noël", ""],
  "films-emojis": ["films en émojis", "Quel est ce film ?"], "mots-emojis": ["mots en émojis", "Quel mot se cache ici ?"], "tu-preferes": ["dilemmes", ""],
};
const [noun, question] = BANKS[bank] ?? ["questions", ep.question ?? ""];
const dilemma = ep.items[0].prompt.type === "choices";

// ---------- tirage : 3 séries disjointes de 5, du plus facile au plus dur ----------
const LV = ["facile", "moyen", "difficile", "impossible"];
const n = ep.items.length;
const levelOf = (i) => ep.items[i].level ?? LV[Math.min(3, Math.floor((i / n) * 4))];
const by = Object.fromEntries(LV.map((l) => [l, []]));
ep.items.forEach((_, i) => by[levelOf(i)].push(i));
const spread = (list, c) => Array.from({ length: c }, (_, j) => list[Math.min(list.length - 1, Math.floor(((j + 0.5) * list.length) / c))]);
const picks = { facile: spread(by.facile, 3), moyen: spread(by.moyen, 6), difficile: spread(by.difficile, 3), impossible: spread(by.impossible, 3) };
const sets = [0, 1, 2].map((k) => [[picks.facile[k], "facile"], [picks.moyen[2 * k], "moyen"], [picks.moyen[2 * k + 1], "moyen"], [picks.difficile[k], "difficile"], [picks.impossible[k], "impossible"]].filter(([i]) => i !== undefined));

// ---------- voix (ElevenLabs v3, timbre réclame ; sans clé : rendu muet aux durées par défaut) ----------
async function tts(text, model) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 60_000);
  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, { method: "POST", signal: ctl.signal, headers: { "xi-api-key": KEY, "content-type": "application/json" },
      body: JSON.stringify({ text: model === "eleven_v3" ? `${TAG} ${text}` : text, model_id: model, language_code: "fr", voice_settings: model === "eleven_v3" ? { stability: 0.5, similarity_boost: 0.8, style: 0.6, use_speaker_boost: true } : { stability: 0.4, similarity_boost: 0.75, style: 0.5, use_speaker_boost: true, speed: 1.1 } }) });
    if (!res.ok) throw new Error(`ElevenLabs ${res.status} : ${(await res.text()).slice(0, 160)}`);
    return Buffer.from(await res.arrayBuffer());
  } finally { clearTimeout(timer); }
}
const PITCH = 1.07;
const retro = `silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.04,areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.12,areverse,aresample=44100,asetrate=${Math.round(44100 * PITCH)},aresample=44100,atempo=${(1.06 / PITCH).toFixed(3)},highpass=f=380,lowpass=f=3300,equalizer=f=1400:t=q:w=1.2:g=8,equalizer=f=2700:t=q:w=2:g=3,acompressor=threshold=-22dB:ratio=3:attack=15:release=250:makeup=4,alimiter=limit=0.89`;
async function clip(text, file) {
  if (!KEY || !VOICE) return undefined;
  let buf, model = "eleven_v3";
  try { buf = await tts(text, model); } catch (e) { console.warn(`v3 : ${e.message} → multilingual_v2`); model = "eleven_multilingual_v2"; buf = await tts(text, model); }
  const raw = `public/short-v3/${ep.id}/${file}.raw.mp3`, out = `public/short-v3/${ep.id}/${file}.mp3`;
  writeFileSync(raw, buf);
  sh(`ffmpeg -y -nostdin -loglevel error -i "${raw}" -af "${retro}" -ar 44100 -b:a 128k "${out}"`);
  const sec = Number(sh(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${out}"`));
  console.log(`  ${file} (${model}) ${sec.toFixed(1)} s : ${text}`);
  return { src: `short-v3/${ep.id}/${file}.mp3`, sec, text };
}
const plain = (t) => t.replace(/\p{Extended_Pictographic}|️|‍/gu, "").replace(/\s+/g, " ").trim();
const lower = (t) => t.replace(/^[A-ZÉÈÀ]/, (c) => c.toLowerCase());
const NUM = ["Numéro un !", "Numéro deux !", "Numéro trois !", "Numéro quatre, ça se corse !", "Numéro cinq : pour les champions !"];
const NUMQ = ["Numéro un.", "Numéro deux.", "Numéro trois.", "Numéro quatre.", "Et pour les champions :"];
const BRAVO = ["{a} !", "{a}, naturellement !", "{a}, bien sûr !", "Eh oui : {a} !", "{a} ! Chapeau, si vous l'aviez !"];

const SLOTS = [
  { hour: "12 h", title: `5 ${noun}, de plus en plus durs : irez-vous jusqu'au bout ? 🧐 #Shorts` },
  { hour: "16 h", title: `Le quiz express ⏱️ 5 ${noun}, 3 secondes chacun #Shorts` },
  { hour: "19 h", title: `Seuls les champions ont le 5e 🏆 5 ${noun} #Shorts` },
];
const report = [];
for (const [k, set] of sets.entries()) {
  if (only && only !== k + 1) continue;
  const name = `${ep.id}-${k + 1}`;
  console.log(`▶ ${name} : questions ${set.map(([i]) => i + 1).join(", ")}`);
  const items = [];
  for (const [j, [i, level]] of set.entries()) {
    const src = ep.items[i], p = src.prompt, last = j === set.length - 1;
    const fact = last && src.fact && src.fact.length <= 110 ? src.fact : undefined;
    const qText = p.type === "qcm" ? `${NUMQ[j]} ${p.value}` : p.type === "choices" ? `${NUMQ[j]} ${plain(p.value[0])}, ou ${lower(plain(p.value[1]))} ?` : NUM[j];
    const aText = BRAVO[last ? 4 : (i + j) % 4].replace("{a}", src.answer) + (fact ? ` ${fact}` : "");
    items.push({ prompt: p, answer: src.answer, level, fact, voice: { q: await clip(qText, `${k + 1}-${j}-q`), a: dilemma ? undefined : await clip(aText, `${k + 1}-${j}-a`) } });
  }
  const hookText = dilemma ? `Cinq dilemmes ! De plus en plus durs à trancher. Lequel vous fera hésiter ?` : `Cinq ${noun} ! De plus en plus difficiles. Irez-vous jusqu'au bout ?`;
  const outroText = `${dilemma ? "Alors, vos cinq choix ?" : "Alors, combien sur cinq ?"} Dites-le en commentaire ! Le grand quiz complet vous attend sur la chaîne YouTube YouQwiz. Abonnez-vous !`;
  const reclame = { id: name, noun, question, dare: dilemma ? "Lequel vous fera hésiter ?" : "Irez-vous jusqu'au bout ?", items, outro: { head: dilemma ? "Vos 5 choix ?" : "Combien sur 5 ?", sub: "Dites-le en commentaire !" }, voice: { hook: await clip(hookText, `${k + 1}-hook`), outro: await clip(outroText, `${k + 1}-outro`) } };
  const props = `out/short-v3/${name}.json`;
  writeFileSync(props, JSON.stringify({ reclame }));
  execSync(`npx remotion render src/index.ts ShortReclame "out/short-v3/${name}.mp4" --props="${props}" ${process.env.SHORT_V3_FLAGS ?? ""} --log=error`, { stdio: "inherit" });
  const sec = Number(sh(`ffprobe -v error -show_entries format=duration -of csv=p=0 "out/short-v3/${name}.mp4"`));
  if (sec > 59) throw new Error(`${name} : ${sec.toFixed(1)} s > 59 s`);
  console.log(`  rendu : ${name}.mp4 (${sec.toFixed(1)} s)`);
  report.push({ slot: k + 1, hour: SLOTS[k].hour, file: `${name}.mp4`, seconds: sec, title: SLOTS[k].title.slice(0, 100), questions: set.map(([i, l]) => ({ n: i + 1, level: l, answer: ep.items[i].answer })) });
}
writeFileSync(`out/short-v3/${ep.id}.json`, JSON.stringify({ episode: ep.id, shorts: report }, null, 1) + "\n");
