// Voix off ElevenLabs pour l'épisode courant : questions, réponses, faits bonus, cartes de niveau, pré-roll, packshot, score, champion.
// Sans ELEVENLABS_API_KEY : ne fait rien (la vidéo reste muette, comme en V1).
// Lignes génériques mises en cache dans public/tts-cache/ (commitées) ; lignes de l'épisode dans public/tts/<id>/.
// 03/11/2026 : relances contextuelles (position, niveau, série), vraie question lue 1 fois sur 3 en Devine, amorce + fait bonus,
// formulations de réponse variées, textes variables de l'épisode (episode.variants).
// Usage : node scripts/tts.mjs [--episode data/episodes/x.json] [--dry]
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { argv, p, readJson, rng, writeJson } from "./lib.mjs";

const { ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID } = process.env;
// Décision du 02/11/2026 : Eleven v3 avec tags d'émotion (voix Nicolas, réglages « D » validés à l'écoute).
// 09/11/2026 (respirations audibles, ton qui saute d'une phrase à l'autre) : stabilité v3 « naturelle » (0,5) au lieu de
// « créative » (0,3), palette de tags réduite à deux registres (cheerful partout, excited sur intro/score/relances-clés),
// contexte previous_text/next_text entre question et réponse, puis porte anti-souffle + normalisation de niveau (ffmpeg).
// 09/11/2026 soir : v3 répond parfois en 60-90 s par clip (run de 2 h 20 sans fin) → au-delà de 25 s de moyenne sur les
// premiers clips, tout l'épisode est refait avec le modèle de secours (ELEVENLABS_FALLBACK_MODEL, eleven_multilingual_v2).
let MODEL = process.env.ELEVENLABS_MODEL || "eleven_v3";
const FALLBACK = process.env.ELEVENLABS_FALLBACK_MODEL || "eleven_multilingual_v2";
const SLOW_SECONDS = Number(process.env.ELEVENLABS_SLOW_SECONDS || 25);
let V3 = MODEL === "eleven_v3";
const settingsFor = (v3) => (v3
  ? { stability: 0.5, similarity_boost: 0.8, style: 0.5, use_speaker_boost: true }
  : { stability: 0.45, similarity_boost: 0.75, style: 0.35, use_speaker_boost: true, speed: 1.05 });
let SETTINGS = settingsFor(V3);
class SlowError extends Error {}
// tag d'émotion v3 (ignoré par les autres modèles) — « curious » et « mischievously » rabattus sur « cheerful » : un seul ton de base
const TAG_MAP = { curious: "cheerful", mischievously: "cheerful" };
const tag = (t, text) => (V3 ? `[${TAG_MAP[t] ?? t}] ${text}` : text);
const untag = (t) => String(t).replace(/^\[[a-z]+\]\s*/i, "");
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
const duration = (f) => Number(execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${f}"`, { timeout: 30_000, stdio: ["ignore", "pipe", "pipe"] }).toString());

async function synth(text, outFile, ctx = {}) {
  if (existsSync(outFile)) return;
  chars += text.length;
  calls++;
  if (dry) return writeFileSync(outFile, "");
  if (calls <= 3 || process.env.TTS_VERBOSE) console.log(`clip ${calls} (${MODEL}) : ${text.length} car. → ${outFile.split("/").slice(-2).join("/")}`);
  // previous_text / next_text : la phrase voisine (sans tag) donne la continuité de ton entre question et réponse.
  // (refusé par eleven_v3 : « unsupported_model », 09/11/2026 → seulement pour les autres modèles)
  const context = V3 ? {} : { ...(ctx.prev ? { previous_text: untag(ctx.prev) } : {}), ...(ctx.next ? { next_text: untag(ctx.next) } : {}) };
  // 09/11/2026 : délai de 90 s par appel et 3 tentatives (un run est resté 2 h bloqué sur une connexion muette).
  const t0 = Date.now();
  let res, lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}?output_format=mp3_44100_128`, {
        method: "POST",
        headers: { "xi-api-key": ELEVENLABS_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ text, model_id: MODEL, ...(V3 ? {} : { language_code: V.tts?.languageCode ?? "fr" }), voice_settings: SETTINGS, ...context }),
        signal: AbortSignal.timeout(90_000),
      });
      if (res.status === 429 || res.status >= 500) throw new Error(`ElevenLabs ${res.status}`);
      break;
    } catch (e) {
      lastErr = e; res = undefined;
      console.warn(`ElevenLabs tentative ${attempt}/3 : ${e.message.slice(0, 80)}`);
      await new Promise((r) => setTimeout(r, 5000 * attempt));
    }
  }
  if (!res) throw lastErr;
  if (!res.ok) throw new Error(`ElevenLabs ${res.status} : ${(await res.text()).slice(0, 200)}`);
  writeFileSync(outFile, Buffer.from(await res.arrayBuffer()));
  if (calls <= 3 || process.env.TTS_VERBOSE) console.log(`  reçu ${(Date.now() - t0) / 1000} s, ${res.headers.get("content-length") ?? "?"} octets, ffmpeg…`);
  trim(outFile);
  if (calls <= 3 || process.env.TTS_VERBOSE) console.log(`  coupé`);
  // Journal de progression et détection de lenteur (bascule sur le modèle de secours).
  const sec = (Date.now() - t0) / 1000;
  slow.push(sec);
  if (sec > 20) console.warn(`ElevenLabs lent (${MODEL}) : ${sec.toFixed(0)} s pour ${text.length} caractères`);
  if (calls % 10 === 0) console.log(`voix off : ${calls} clips, ${((Date.now() - T0) / 60000).toFixed(1)} min écoulées`);
  if (V3 && FALLBACK && FALLBACK !== MODEL && slow.length >= 3 && slow.slice(-3).reduce((a, b) => a + b, 0) / 3 > SLOW_SECONDS) throw new SlowError(`ElevenLabs ${MODEL} trop lent (${(slow.slice(-3).reduce((a, b) => a + b, 0) / 3).toFixed(0)} s par clip)`);
}
const T0 = Date.now();
let slow = [];
// Coupe les silences de début/fin (v3 ajoute souvent 0,1-0,5 s) pour que la voix tombe pile sur l'image, atténue les
// respirations (porte : tout ce qui est sous -32 dB entre les mots est ramené vers le silence) et égalise le niveau entre
// les clips (loudnorm -16 LUFS) pour que la voix garde le même volume d'une phrase à l'autre.
function trim(file) {
  const tmp = file.replace(/\.mp3$/, ".trim.mp3");
  try {
    // 09/11/2026 : -nostdin, délai de 60 s et entrée standard fermée (un run est resté bloqué sans rien produire).
    execSync(`ffmpeg -y -nostdin -loglevel error -i "${file}" -af "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.03,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.08,areverse,agate=threshold=0.025:ratio=4:attack=6:release=150:knee=4,loudnorm=I=-16:TP=-1.5:LRA=7" -ar 44100 -b:a 128k "${tmp}"`, { timeout: 60_000, stdio: ["ignore", "pipe", "pipe"] });
    execSync(`mv "${tmp}" "${file}"`);
  } catch (e) { console.warn(`trim ${file} : ${e.message.slice(0, 80)}`); }
}
// ligne générique : cache par hachage du texte (partagée entre tous les épisodes)
async function generic(text) {
  const h = createHash("sha1").update(`${ELEVENLABS_VOICE_ID}|${MODEL}|trim2|${text}`).digest("hex").slice(0, 16); // trim2 = réglages du 09/11/2026
  const f = `${cacheDir}/${h}.mp3`;
  await synth(text, f);
  return { src: `tts-cache/${h}.mp3`, sec: dry ? 1.5 : duration(f), text: untag(text) };
}
async function specific(text, name, ctx) {
  const f = `${epDir}/${name}.mp3`;
  await synth(text, f, ctx);
  return { src: `tts/${ep.id}/${name}.mp3`, sec: dry ? 2 : duration(f), text: untag(text) };
}

// --- lignes par pilier ---
const isChoice = ep.timing.reveal <= 0;
const isQcm = ep.template === "QuizQCM";
const isIntrus = ep.template === "Intrus";
const R = V.relances;
// Textes propres à la langue (09/11/2026) : surchargés par variants.json → "tts" (chaîne anglaise).
const T = {
  intrusPool: ["Trouve l'intrus !", "Où est l'intrus ?", "Un seul est différent…", "Cherche bien !", "Il se cache où ?"],
  rebusPool: ["Quel mot se cache ici ?", "Devine le mot !", "Et celui-ci ?", "Alors, ça te parle ?", "Quel titre se cache là ?", "Décode-moi ça."],
  rebusIds: "mots|films|words|movies",
  letterQuestion: "Nomme {cat} qui commence par la lettre {letter}.",
  letterLine: "{cat}, lettre {letter}.",
  letterArticle: "^un |^une |^an |^a ",
  choiceFirst: "Premier choix. ",
  choiceMilestone: "Choix numéro {n}. ",
  choiceQuestion: "Tu préfères… {a}, ou {b} ?",
  levels: { facile: "Niveau facile. On s'échauffe !", moyen: "Niveau moyen. Ça se corse !", difficile: "Niveau difficile. Accroche-toi !", impossible: "Niveau impossible. Seuls les génies…" },
  score: "Alors, combien de points ? Dis-le en commentaire !",
  subscribe: "Abonne-toi et active la cloche, pour être prévenu gratuitement du prochain quiz !",
  outro: "Un nouveau quiz chaque jour. Abonne-toi, active la cloche, et à demain !",
  cliff: "La réponse est dans la vidéo complète, lien dans le commentaire épinglé !",
  introTail: ["Prêt ? C'est parti !"],
  champion: "Bravo {name}, champion de la semaine avec {score} points !",
  ...(V.tts ?? {}),
};
const legacyPool = isIntrus ? T.intrusPool : new RegExp(T.rebusIds).test(ep.id) ? T.rebusPool : R.devine.generic;
const levelOf = (it, i) => it.level ?? ["facile", "moyen", "difficile", "impossible"][Math.min(3, Math.floor((i / ep.items.length) * 4))];
const LEVEL_TAG = { facile: "cheerful", moyen: "cheerful", difficile: "cheerful", impossible: "excited" }; // 09/11/2026 : un ton de base, l'excitation réservée aux moments-clés

// Relance en mode Devine / Intrus : première, dernière, jalon (10, 20…), niveau dur, vraie question (1 fois sur 3), sinon générique.
function devinePrompt(it, i) {
  const n = ep.items.length;
  const lv = levelOf(it, i);
  if (i === 0) return tag("excited", pick(R.devine.first)); // 08/11/2026 : début plus enjoué
  if (i === n - 1) return tag("excited", pick(R.devine.last));
  if (i > 0 && (i + 1) % 10 === 0 && rand() < 0.8) return tag("excited", pick(R.devine.milestone).replaceAll("{n}", String(i + 1)));
  if (ep.question && !isIntrus && rand() < (R.devine.question_share ?? 0.35)) {
    const q = clean(it.prompt.type === "letter" ? T.letterQuestion.replace("{cat}", it.prompt.category).replace("{letter}", it.prompt.value) : ep.question);
    return tag(LEVEL_TAG[lv], q);
  }
  if (it.prompt.type === "letter") return tag(LEVEL_TAG[lv], T.letterLine.replace("{cat}", it.prompt.category.replace(new RegExp(T.letterArticle), (m) => m.charAt(0).toUpperCase() + m.slice(1))).replace("{letter}", it.prompt.value));
  if ((lv === "difficile" || lv === "impossible") && rand() < 0.5) return tag("mischievously", pick(R.devine.hard));
  return tag(LEVEL_TAG[lv], pick(legacyPool));
}
const answerLine = (a) => clean(pick(isQcm ? R.answerQcm : isIntrus ? R.answerIntrus : R.answerDevine).replaceAll("{a}", a));

// Toute erreur ElevenLabs (forfait, quota, réseau) → avertissement et épisode muet : la vidéo du jour sort quand même.
// Modèle trop lent (SlowError) → on repart de zéro avec le modèle de secours (les clips déjà faits sont jetés : une seule voix par vidéo).
async function generateAll() {
for (let i = 0; i < ep.items.length; i++) {
  const it = ep.items[i];
  it.voice = {};
  if (isChoice) {
    const [a, b] = it.prompt.value.map(clean);
    const lead = i === 0 ? T.choiceFirst : (i + 1) % 10 === 0 ? T.choiceMilestone.replace("{n}", String(i + 1)) : "";
    it.voice.q = await specific(tag("curious", `${lead}${T.choiceQuestion.replace("{a}", a).replace("{b}", b)}`), `${i}-q`);
  } else if (isQcm) {
    const pre = rand() < (R.qcmPreShare ?? 0.3) ? `${pick(R.qcmPre)} ` : "";
    const qText = tag(LEVEL_TAG[levelOf(it, i)], `${pre}${clean(it.prompt.value)}`), aText = tag("cheerful", answerLine(clean(it.answer)));
    it.voice.q = await specific(qText, `${i}-q`, { next: aText });
    it.voice.a = await specific(aText, `${i}-a`, { prev: qText });
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
  level_facile: await generic(tag("cheerful", lvl("facile", T.levels.facile))),
  level_moyen: await generic(tag("excited", lvl("moyen", T.levels.moyen))),
  level_difficile: await generic(tag("excited", lvl("difficile", T.levels.difficile))),
  level_impossible: await generic(tag("mischievously", lvl("impossible", T.levels.impossible))),
  score: await generic(tag("excited", clean(vr.scoreVoice ?? T.score))),
  subscribe: await generic(tag("cheerful", clean(vr.subscribe?.voice ?? T.subscribe))),
  outro: await generic(tag("cheerful", clean(vr.outro?.voice ?? T.outro))),
  cliff: await generic(tag("excited", T.cliff)),
};
// Pré-roll et packshot : voix variables de l'épisode (cache générique) ; sans variante, les mp3 statiques de public/audio servent.
if (vr.preroll?.voice) ep.voice.preroll = await generic(tag("excited", clean(vr.preroll.voice))); // 08/11/2026 : début plus enjoué
// 08/11/2026 : la carte d'intro est lue à voix haute (titre/accroche + relance), au lieu du jingle seul.
// Vidéo longue v2 (09/11/2026) : accroche, puis la règle du jeu expliquée posément, puis la relance.
if (ep.intro?.hook) {
  const hook = clean(ep.intro.hook).replace(/\b([A-ZÉÈÀÇ]{3,})\b/g, (m) => m.charAt(0) + m.slice(1).toLowerCase());
  const rule = vr.ruleVoice ? ` ${clean(vr.ruleVoice)}` : "";
  ep.voice.intro = await specific(tag("excited", `${hook.replace(/[!?.…]+$/, "")} !${rule} ${pick(V.introVoiceTail ?? T.introTail)}`), "intro");
}
if (vr.packshot?.voice) ep.voice.packshot = await generic(tag("cheerful", clean(vr.packshot.voice)));
// Carte finale « Prochain quiz » (2 vidéos + S'abonner) : remplace la voix du packshot quand l'épisode la porte.
if (vr.nextQuizVoice) ep.voice.nextQuiz = await generic(tag("cheerful", clean(vr.nextQuizVoice)));
// Intermèdes : amorce + question lue, réponse lue, anecdote (clips propres à l'épisode).
const I = V.interludes ?? {};
for (let k = 0; k < (ep.interludes?.length ?? 0); k++) {
  const it = ep.interludes[k];
  const lead = pick(I.lead ?? ["Petite pause !"]);
  const qText = it.type === "vf"
    ? `${lead} ${(I.vfRead ?? "Vrai ou faux : {q}").replace("{q}", clean(it.q))}`
    : `${lead} ${(I.qcm3Read ?? "{q} {a}, {b}, ou {c} ?").replace("{q}", clean(it.q).replace(/\s*\?$/, " :")).replace("{a}", clean(it.choices?.[0] ?? "")).replace("{b}", clean(it.choices?.[1] ?? "")).replace("{c}", clean(it.choices?.[2] ?? ""))}`;
  const aText = it.type === "vf" ? pick(it.answer ? I.vfTrue ?? ["C'est vrai !"] : I.vfFalse ?? ["C'est faux !"]) : pick(I.answer3 ?? ["C'est {a} !"]).replaceAll("{a}", clean(it.choices?.[it.correct ?? 0] ?? ""));
  it.voice = {};
  it.voice.q = await specific(tag("cheerful", qText), `i${k}-q`, { next: aText });
  it.voice.a = await specific(tag("cheerful", aText), `i${k}-a`, { prev: qText });
  it.voice.f = await specific(tag("cheerful", `${pick(R.factLead)} ${clean(it.fact)}`), `i${k}-f`, { prev: aText });
}
if (ep.champion) ep.voice.champion = await specific(tag("excited", T.champion.replace("{name}", clean(ep.champion.name)).replace("{score}", String(ep.champion.score))), "champion");

}
try {
  try {
    await generateAll();
  } catch (e) {
    if (!(e instanceof SlowError)) throw e;
    console.warn(`${e.message} → bascule sur ${FALLBACK} pour tout l'épisode`);
    if (process.env.GITHUB_ACTIONS) console.log(`::warning title=Voix::${e.message} — épisode refait avec ${FALLBACK}`);
    MODEL = FALLBACK; V3 = false; SETTINGS = settingsFor(false); slow = [];
    rmSync(epDir, { recursive: true, force: true }); mkdirSync(epDir, { recursive: true });
    for (const it of ep.items) delete it.voice;
    for (const it of ep.interludes ?? []) delete it.voice;
    await generateAll();
  }
writeJson(file, ep);
console.log(`voix off : ${calls} clips générés, ${chars} caractères (${dry ? "simulation" : MODEL})`);
if (process.env.GITHUB_ACTIONS) console.log(`::notice title=Voix::${calls} clips, ${chars} caractères (${MODEL})`);
} catch (e) {
  const msg = (e.message || String(e)).replace(/sk_[A-Za-z0-9]+/g, "sk_***").slice(0, 300);
  for (const it of ep.items) delete it.voice;
  for (const it of ep.interludes ?? []) delete it.voice;
  delete ep.voice;
  writeJson(file, ep);
  console.warn(`voix off indisponible, épisode muet : ${msg}`);
  if (process.env.GITHUB_ACTIONS) console.log(`::warning title=Voix::indisponible, épisode muet — ${msg}`);
}
