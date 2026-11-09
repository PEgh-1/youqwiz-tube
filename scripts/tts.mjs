// Voix off ElevenLabs pour l'épisode courant : questions, réponses, faits bonus, cartes de niveau, pré-roll, packshot, score, champion.
// Sans ELEVENLABS_API_KEY : ne fait rien (la vidéo reste muette, comme en V1).
// Lignes génériques mises en cache dans public/tts-cache/ (commitées) ; lignes de l'épisode dans public/tts/<id>/.
// 03/11/2026 : relances contextuelles (position, niveau, série), vraie question lue 1 fois sur 3 en Devine, amorce + fait bonus,
// formulations de réponse variées, textes variables de l'épisode (episode.variants).
// Usage : node scripts/tts.mjs [--episode data/episodes/x.json] [--dry]
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { argv, p, readJson, rng, writeJson } from "./lib.mjs";

const { ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID } = process.env;
// Décision du 02/11/2026 : Eleven v3 avec tags d'émotion (voix Nicolas, réglages « D » validés à l'écoute).
const MODEL = process.env.ELEVENLABS_MODEL || "eleven_v3";
const V3 = MODEL === "eleven_v3";
const SETTINGS = V3
  ? { stability: 0.3, similarity_boost: 0.8, style: 0.7, use_speaker_boost: true }
  : { stability: 0.45, similarity_boost: 0.75, style: 0.35, use_speaker_boost: true, speed: 1.05 };
// tag d'émotion v3 (ignoré par les autres modèles)
const tag = (t, text) => (V3 ? `[${t}] ${text}` : text);
const current = readJson(p("data/state/current.json"));
const file = argv("episode", current?.file);
const ep = readJson(file);
const V = readJson(p("data/variants.json"));
if (!ELEVENLABS_API_KEY || !ELEVENLABS_VOICE_ID) {
  console.log("voix off : ELEVENLABS_API_KEY / ELEVENLABS_VOICE_ID absents, épisode muet");
  process.exit(0);
}

const cacheDir = p("public/tts-cache");
const epDir = p("public/tts", ep.id);
mkdirSync(cacheDir, { recursive: true });
mkdirSync(epDir, { recursive: true });
const dry = process.argv.includes("--dry");
let chars = 0, calls = 0;
const rand = rng(`${ep.id}-voice`);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

const clean = (s) => String(s).replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, "").replace(/\s+/g, " ").trim();
const duration = (f) => Number(execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${f}"`).toString());

async function synth(text, outFile) {
  if (existsSync(outFile)) return;
  chars += text.length;
  calls++;
  if (dry) return writeFileSync(outFile, "");
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": ELEVENLABS_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ text, model_id: MODEL, ...(V3 ? {} : { language_code: "fr" }), voice_settings: SETTINGS }),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status} : ${(await res.text()).slice(0, 200)}`);
  writeFileSync(outFile, Buffer.from(await res.arrayBuffer()));
  trim(outFile);
}
// Coupe les silences de début/fin (v3 ajoute souvent 0,1-0,5 s) pour que la voix tombe pile sur l'image.
function trim(file) {
  const tmp = file.replace(/\.mp3$/, ".trim.mp3");
  try {
    execSync(`ffmpeg -y -loglevel error -i "${file}" -af "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.03,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.08,areverse" -ar 44100 -b:a 128k "${tmp}"`);
    execSync(`mv "${tmp}" "${file}"`);
  } catch (e) { console.warn(`trim ${file} : ${e.message.slice(0, 80)}`); }
}
// ligne générique : cache par hachage du texte (partagée entre tous les épisodes)
async function generic(text) {
  const h = createHash("sha1").update(`${ELEVENLABS_VOICE_ID}|${MODEL}|trim1|${text}`).digest("hex").slice(0, 16);
  const f = `${cacheDir}/${h}.mp3`;
  await synth(text, f);
  return { src: `tts-cache/${h}.mp3`, sec: dry ? 1.5 : duration(f) };
}
async function specific(text, name) {
  const f = `${epDir}/${name}.mp3`;
  await synth(text, f);
  return { src: `tts/${ep.id}/${name}.mp3`, sec: dry ? 2 : duration(f) };
}

// --- lignes par pilier ---
const isChoice = ep.timing.reveal <= 0;
const isQcm = ep.template === "QuizQCM";
const isIntrus = ep.template === "Intrus";
const R = V.relances;
const legacyPool = isIntrus
  ? ["Trouve l'intrus !", "Où est l'intrus ?", "Un seul est différent…", "Cherche bien !", "Il se cache où ?"]
  : /mots|films/.test(ep.id)
    ? ["Quel mot se cache ici ?", "Devine le mot !", "Et celui-ci ?", "Alors, ça te parle ?", "Quel titre se cache là ?", "Décode-moi ça."]
    : R.devine.generic;
const levelOf = (it, i) => it.level ?? ["facile", "moyen", "difficile", "impossible"][Math.min(3, Math.floor((i / ep.items.length) * 4))];
const LEVEL_TAG = { facile: "cheerful", moyen: "curious", difficile: "excited", impossible: "mischievously" };

// Relance en mode Devine / Intrus : première, dernière, jalon (10, 20…), niveau dur, vraie question (1 fois sur 3), sinon générique.
function devinePrompt(it, i) {
  const n = ep.items.length;
  const lv = levelOf(it, i);
  if (i === 0) return tag("excited", pick(R.devine.first)); // 08/11/2026 : début plus enjoué
  if (i === n - 1) return tag("excited", pick(R.devine.last));
  if (i > 0 && (i + 1) % 10 === 0 && rand() < 0.8) return tag("excited", pick(R.devine.milestone).replaceAll("{n}", String(i + 1)));
  if (ep.question && !isIntrus && rand() < (R.devine.question_share ?? 0.35)) {
    const q = clean(it.prompt.type === "letter" ? `Nomme ${it.prompt.category} qui commence par la lettre ${it.prompt.value}.` : ep.question);
    return tag(LEVEL_TAG[lv], q);
  }
  if (it.prompt.type === "letter") return tag(LEVEL_TAG[lv], `${it.prompt.category.replace(/^un |^une /, (m) => m.charAt(0).toUpperCase() + m.slice(1))}, lettre ${it.prompt.value}.`);
  if ((lv === "difficile" || lv === "impossible") && rand() < 0.5) return tag("mischievously", pick(R.devine.hard));
  return tag(LEVEL_TAG[lv], pick(legacyPool));
}
const answerLine = (a) => clean(pick(isQcm ? R.answerQcm : isIntrus ? R.answerIntrus : R.answerDevine).replaceAll("{a}", a));

// Toute erreur ElevenLabs (forfait, quota, réseau) → avertissement et épisode muet : la vidéo du jour sort quand même.
try {
for (let i = 0; i < ep.items.length; i++) {
  const it = ep.items[i];
  it.voice = {};
  if (isChoice) {
    const [a, b] = it.prompt.value.map(clean);
    const lead = i === 0 ? "Premier choix. " : (i + 1) % 10 === 0 ? `Choix numéro ${i + 1}. ` : "";
    it.voice.q = await specific(tag("curious", `${lead}Tu préfères… ${a}, ou ${b} ?`), `${i}-q`);
  } else if (isQcm) {
    const pre = rand() < (R.qcmPreShare ?? 0.3) ? `${pick(R.qcmPre)} ` : "";
    it.voice.q = await specific(tag(LEVEL_TAG[levelOf(it, i)], `${pre}${clean(it.prompt.value)}`), `${i}-q`);
    it.voice.a = await specific(tag("cheerful", answerLine(clean(it.answer))), `${i}-a`);
  } else if (isIntrus) {
    it.voice.q = await generic(devinePrompt(it, i));
    it.voice.a = await generic(tag("cheerful", answerLine(clean(it.answer))));
  } else {
    it.voice.q = await generic(devinePrompt(it, i));
    it.voice.a = await specific(tag("cheerful", answerLine(clean(it.answer))), `${i}-a`);
  }
  if (it.fact && !isChoice) it.voice.f = await specific(tag("curious", `${pick(R.factLead)} ${clean(it.fact)}`), `${i}-f`);
}
const vr = ep.variants ?? {};
const lvl = (l, fallback) => clean(vr.levels?.[l]?.voice ?? fallback);
ep.voice = {
  level_facile: await generic(tag("cheerful", lvl("facile", "Niveau facile. On s'échauffe !"))),
  level_moyen: await generic(tag("excited", lvl("moyen", "Niveau moyen. Ça se corse !"))),
  level_difficile: await generic(tag("excited", lvl("difficile", "Niveau difficile. Accroche-toi !"))),
  level_impossible: await generic(tag("mischievously", lvl("impossible", "Niveau impossible. Seuls les génies…"))),
  score: await generic(tag("excited", clean(vr.scoreVoice ?? "Alors, combien de points ? Dis-le en commentaire !"))),
  subscribe: await generic(tag("cheerful", clean(vr.subscribe?.voice ?? "Abonne-toi et active la cloche, pour être prévenu gratuitement du prochain quiz !"))),
  outro: await generic(tag("cheerful", clean(vr.outro?.voice ?? "Un nouveau quiz chaque jour. Abonne-toi, active la cloche, et à demain !"))),
  cliff: await generic(tag("excited", "La réponse est dans la vidéo complète, lien dans le commentaire épinglé !")),
};
// Pré-roll et packshot : voix variables de l'épisode (cache générique) ; sans variante, les mp3 statiques de public/audio servent.
if (vr.preroll?.voice) ep.voice.preroll = await generic(tag("excited", clean(vr.preroll.voice))); // 08/11/2026 : début plus enjoué
// 08/11/2026 : la carte d'intro est lue à voix haute (titre/accroche + relance), au lieu du jingle seul.
if (ep.intro?.hook) {
  const hook = clean(ep.intro.hook).replace(/\b([A-ZÉÈÀÇ]{3,})\b/g, (m) => m.charAt(0) + m.slice(1).toLowerCase());
  ep.voice.intro = await specific(tag("excited", `${hook.replace(/[!?.…]+$/, "")} ! ${pick(V.introVoiceTail ?? ["Prêt ? C'est parti !"])}`), "intro");
}
if (vr.packshot?.voice) ep.voice.packshot = await generic(tag("cheerful", clean(vr.packshot.voice)));
if (ep.champion) ep.voice.champion = await specific(tag("excited", `Bravo ${clean(ep.champion.name)}, champion de la semaine avec ${ep.champion.score} points !`), "champion");

writeJson(file, ep);
console.log(`voix off : ${calls} clips générés, ${chars} caractères (${dry ? "simulation" : MODEL})`);
if (process.env.GITHUB_ACTIONS) console.log(`::notice title=Voix::${calls} clips, ${chars} caractères`);
} catch (e) {
  const msg = (e.message || String(e)).replace(/sk_[A-Za-z0-9]+/g, "sk_***").slice(0, 300);
  for (const it of ep.items) delete it.voice;
  delete ep.voice;
  writeJson(file, ep);
  console.warn(`voix off indisponible, épisode muet : ${msg}`);
  if (process.env.GITHUB_ACTIONS) console.log(`::warning title=Voix::indisponible, épisode muet — ${msg}`);
}
