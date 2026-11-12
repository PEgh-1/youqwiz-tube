// Shorts extraits v3 (11/11/2026) : la mécanique de « La minute culture générale » appliquée à l'épisode du jour.
// 3 Shorts par épisode, 3 questions chacun (facile → difficile → champions), jamais deux fois la même question ; chaque question :
// dite tout de suite, 3 propositions lues une à une sur un ton interrogatif, décompte 3 s, réponse (+ anecdote d'une traite).
// Un habillage et un ton de voix par pilier : réclame (culture générale, comme la Minute), plateau (devine), pop (émojis), duel (choix).
// Usage : node scripts/short-v3.mjs --episode data/episodes/<id>.json [--only 1]   → out/short-v3/<id>-<n>.mp4 + <id>.json
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const arg = (k, d) => (process.argv.includes(`--${k}`) ? process.argv[process.argv.indexOf(`--${k}`) + 1] : d);
const ep = JSON.parse(readFileSync(arg("episode"), "utf8"));
const only = arg("only") ? Number(arg("only")) : null;
const KEY = process.env.ELEVENLABS_API_KEY, VOICE = process.env.ELEVENLABS_VOICE_ID;
const sh = (c) => execSync(c, { stdio: ["ignore", "pipe", "pipe"], timeout: 120_000 }).toString();
mkdirSync("out/short-v3", { recursive: true });
mkdirSync(`public/short-v3/${ep.id}`, { recursive: true });

const bank = ep.bank ?? ep.id.split("-").slice(3).join("-");
const dilemma = ep.items[0].prompt.type === "choices";
const skin = dilemma ? "duel" : ep.pillar === "emojis" || /emojis/.test(bank) ? "pop" : ep.pillar === "generations" ? "album" : ep.items[0].prompt.type === "qcm" ? "reclame" : "plateau";
// Textes LUS : orthographe phonétique voulue (« YouQwiz point com »), consigne de jeu en FRANÇAIS (sinon v3 prononce à l'anglaise).
const SKIN = {
  reclame: { tu: false, tag: "[annonceur de réclame radio des années 30, voix nasillarde, très enjoué, débit rapide]", title: "Le quiz express ! Aujourd'hui, scrolé va vous rendre plus malin !", retro: true },
  plateau: { tu: true, tag: "[animateur de jeu télévisé, très enjoué, dynamique, sourire dans la voix]", title: "Trois secondes chrono ! Aujourd'hui, scrolé va te rendre plus malin ! Sans propositions, trouve vite !" },
  pop: { tu: true, tag: "[ton joueur et complice, amusé, plein d'entrain]", title: "Décode si tu peux ! Devine ce qui se cache !" },
  duel: { tu: true, tag: "[ton malicieux et taquin, enjoué]", title: "Choisis ton camp ! Aujourd'hui, scrolé va te rendre plus malin ! Dis ton camp en commentaire !" },
  album: { tu: true, tag: "[ton chaleureux et complice, souriant, un peu nostalgique, débit posé]", title: "T'as connu ça ? Aujourd'hui, scrolé va te rendre plus malin ! Une seule bonne réponse !" },
}[skin];
// 11/11/2026 (nuit) : le pilier émojis (« Décode si tu peux ») est arrêté en Short extrait (« ne rend pas bien »).
if (skin === "pop") { console.log(`${ep.id} : pilier émojis, pas de Short extrait`); process.exit(0); }
const ASK = {
  "pays-sans-voyelles": "Quel est ce pays sans voyelles ?", drapeaux: "À quel pays appartient ce drapeau ?", animaux: "Quel est cet animal ?", "fruits-legumes": "Quel est ce fruit ou ce légume ?",
  maths: "Combien ça fait ?", "films-emojis": "Quel film se cache ici ?", "mots-emojis": "Quel mot se cache ici ?",
}[bank] ?? ep.question ?? "";
const NEXT = SKIN.tu ? ["", "Et celui-ci ?", "Et pour les champions ?"] : ["", "Et celui-ci ?", "Et pour les champions ?"];
const noun = { "pays-sans-voyelles": "pays sans voyelles", drapeaux: "drapeaux", animaux: "animaux", "fruits-legumes": "fruits et légumes", maths: "calculs de tête", alphabet: "défis de l'alphabet", "culture-generale": "questions de culture générale", vocabulaire: "mots rares", acronymes: "sigles", generations: "souvenirs d'autrefois", noel: "questions de Noël", "films-emojis": "films en émojis", "mots-emojis": "mots en émojis", "tu-preferes": "dilemmes" }[bank] ?? "questions";

// ---------- tirage : 3 séries disjointes (facile, difficile, champions) ----------
const LV = ["facile", "moyen", "difficile", "impossible"];
const n = ep.items.length;
const levelOf = (i) => ep.items[i].level ?? LV[Math.min(3, Math.floor((i / n) * 4))];
const by = Object.fromEntries(LV.map((l) => [l, []]));
ep.items.forEach((_, i) => by[levelOf(i)].push(i));
const spread = (list, c) => Array.from({ length: c }, (_, j) => list[Math.min(list.length - 1, Math.floor(((j + 0.5) * list.length) / c))]);
const P = { facile: spread(by.facile, 3), difficile: spread(by.difficile.length ? by.difficile : by.moyen, 3), impossible: spread(by.impossible.length ? by.impossible : by.difficile, 3) };
// 12/11/2026 : « T'as connu ça ? » (générations) passe à 2 questions par Short (54 s à 3 questions, trop près de la limite de 59 s).
const sets = [0, 1, 2].map((k) => [[P.facile[k], "facile"], [P.difficile[k], "difficile"], [P.impossible[k], "impossible"]].filter(([i]) => i !== undefined).slice(0, skin === "album" ? 2 : 3));

let seed = [...ep.id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const shuffle = (a) => a.map((v) => [rnd(), v]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);
// 3 propositions : la bonne + 2 fausses plausibles (autres réponses de l'épisode, de longueur voisine ; nombres proches en calcul).
const taken = new Set(); // une fausse proposition ne sert qu'une fois par épisode, et jamais une réponse des 3 Shorts
const setAnswers = new Set(sets.flat().map(([i]) => ep.items[i].answer));
const num = (a) => (/^-?[\d\s\u202f\u00a0]+([.,]\d+)?$/.test(a) ? Number(a.replace(/[\s\u202f\u00a0]/g, "").replace(",", ".")) : null);
const fmt = (v) => String(v).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, " ");
function propositions(i) {
  const it = ep.items[i], p = it.prompt;
  // 11/11/2026 (soir) : pas de propositions pour devine et émojis (elles rendent le jeu trop facile) : question, chrono, réponse.
  if (p.type === "choices" || p.type === "letter" || skin === "plateau" || skin === "pop") return {};
  let wrong;
  if (p.type === "qcm") wrong = shuffle(p.choices.filter((_, k) => k !== p.correct)).slice(0, 2);
  else if (num(it.answer) !== null) { const v = num(it.answer), d = v >= 1000 ? 100 : 10; wrong = shuffle([v + d, v - d, v + 1, v - 1, v + 2, v + d / 10 * 2].filter((w) => w !== v && w >= 0)).slice(0, 2).map(fmt); }
  else {
    const pool = [...new Set(ep.items.map((o) => o.answer))].filter((a) => a && a !== it.answer && !taken.has(a) && !setAnswers.has(a));
    wrong = shuffle(shuffle(pool).sort((a, b) => Math.abs(a.length - it.answer.length) - Math.abs(b.length - it.answer.length)).slice(0, 6)).slice(0, 2);
    wrong.forEach((w) => taken.add(w));
  }
  const right = p.type === "qcm" ? p.choices[p.correct] : it.answer;
  const choices = shuffle([right, ...wrong]);
  return { choices, correct: choices.indexOf(right) };
}

// ---------- voix (ElevenLabs v3, repli multilingual_v2 ; sans clé : rendu muet aux durées par défaut) ----------
async function tts(text, model) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 60_000);
  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, { method: "POST", signal: ctl.signal, headers: { "xi-api-key": KEY, "content-type": "application/json" },
      body: JSON.stringify({ text: model === "eleven_v3" ? `${SKIN.tag} ${text}` : text, model_id: model, language_code: "fr", voice_settings: model === "eleven_v3" ? { stability: 0.5, similarity_boost: 0.8, style: 0.6, use_speaker_boost: true } : { stability: 0.4, similarity_boost: 0.75, style: 0.5, use_speaker_boost: true, speed: 1.1 } }) });
    if (!res.ok) throw new Error(`ElevenLabs ${res.status} : ${(await res.text()).slice(0, 160)}`);
    return Buffer.from(await res.arrayBuffer());
  } finally { clearTimeout(timer); }
}
// Réglages repris de la Minute : silences rognés en douceur (seuil -50 dB, 0,12 s gardées en fin de phrase → pas de fin de mot mangée),
// pas de loudnorm (pompage sur clips courts = « coupures de micro »). Le timbre « TSF » nasillard n'est appliqué qu'à l'habillage réclame.
const TRIM = "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.04,areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.12,areverse,agate=threshold=0.025:ratio=4:attack=6:release=150:knee=4,aresample=44100";
const PITCH = 1.07;
const FILTER = SKIN.retro
  ? `${TRIM},asetrate=${Math.round(44100 * PITCH)},aresample=44100,atempo=${(1.06 / PITCH).toFixed(3)},highpass=f=380,lowpass=f=3300,equalizer=f=1400:t=q:w=1.2:g=8,equalizer=f=2700:t=q:w=2:g=3,acompressor=threshold=-22dB:ratio=3:attack=15:release=250:makeup=4,alimiter=limit=0.89`
  : `${TRIM},atempo=1.04,highpass=f=80,acompressor=threshold=-20dB:ratio=2.5:attack=15:release=250:makeup=3,alimiter=limit=0.89`;
async function clip(text, file) {
  if (!KEY || !VOICE) return undefined;
  let buf, model = "eleven_v3";
  try { buf = await tts(text, model); } catch (e) { console.warn(`v3 : ${e.message} → multilingual_v2`); model = "eleven_multilingual_v2"; buf = await tts(text, model); }
  const raw = `public/short-v3/${ep.id}/${file}.raw.mp3`, out = `public/short-v3/${ep.id}/${file}.mp3`;
  writeFileSync(raw, buf);
  sh(`ffmpeg -y -nostdin -loglevel error -i "${raw}" -af "${FILTER}" -ar 44100 -b:a 128k "${out}"`);
  const sec = Number(sh(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${out}"`));
  console.log(`  ${file} (${model}) ${sec.toFixed(1)} s : ${text}`);
  return { src: `short-v3/${ep.id}/${file}.mp3`, sec, text };
}
const plain = (t) => t.replace(/\p{Extended_Pictographic}|️|‍/gu, "").replace(/\s+/g, " ").trim();
const lower = (t) => (/^(Le |La |Les |L'|Un |Une |Des )/.test(t) ? t.replace(/^./, (c) => c.toLowerCase()) : t);
const ANS = SKIN.tu ? ["{a}, bien joué !", "{a}, évidemment !", "Eh oui : {a} !", "{a} ! Bravo si tu l'avais !"] : ["{a}, parfaitement !", "{a}, naturellement !", "{a}, bien sûr !", "Eh oui : {a} !"];
const outroText = SKIN.tu
  ? "Tu en veux encore ? Abonne-toi ! Chaque soir, le grand quiz t'attend sur la chaîne YouTube YouQwiz, et sur YouQwiz point com !"
  : "Vous en voulez encore ? Abonnez-vous ! Chaque soir, le grand quiz vous attend sur la chaîne YouTube YouQwiz, et sur YouQwiz point com !";

const N = sets[0].length, NTH = N === 2 ? "2e" : "3e";
const SLOTS = [
  { hour: "12 h", at: "12:00", title: dilemma ? `${N} dilemmes impossibles à trancher 🤯 Tu préfères… ? #Shorts` : `${N} ${noun}, de plus en plus durs : tu les as tous ? 🧐 #Shorts` },
  { hour: "16 h", at: "16:00", title: dilemma ? `Tu préfères… ? ${N} choix, 3 secondes ⏱️ #Shorts` : `${N} ${noun}, 3 secondes chacun ⏱️ #Shorts` },
  { hour: "19 h", at: "19:00", title: dilemma ? `Le ${NTH} dilemme divise tout le monde 😱 Tu préfères… ? #Shorts` : `Seuls les champions ont le ${NTH} 🏆 ${noun} #Shorts` },
];
const report = [];
for (const [k, set] of sets.entries()) {
  if (only && only !== k + 1) continue;
  const name = `${ep.id}-${k + 1}`;
  console.log(`▶ ${name} (${skin}) : questions ${set.map(([i]) => i + 1).join(", ")}`);
  const items = [];
  for (const [j, [i, level]] of set.entries()) {
    const src = ep.items[i], p = src.prompt, last = j === set.length - 1;
    const { choices, correct } = propositions(i);
    const fact = last && src.fact && src.fact.length <= 110 ? src.fact : undefined;
    const ask = p.type === "qcm" ? p.value : p.type === "letter" ? `Nomme ${p.category} en ${p.value} !` : ASK;
    const answer = p.type === "qcm" ? p.choices[p.correct] : src.answer;
    const voice = {};
    if (dilemma) voice.q = await clip(`${SKIN.tu ? "Tu préfères" : "Vous préférez"}… ${plain(p.value[0])}, ou ${lower(plain(p.value[1]))} ?`, `${k + 1}-${j}-q`);
    else {
      voice.q = await clip(p.type === "qcm" || p.type === "letter" || j === 0 ? ask : NEXT[j], `${k + 1}-${j}-q`);
      // Propositions dites une à une sur un ton interrogatif (« La peau ? Le foie ? Ou le cœur ? »).
      if (choices) voice.choices = await clip(`${choices[0]} ? ${choices[1]} ? Ou ${lower(choices[2])} ?`, `${k + 1}-${j}-choices`);
      // Réponse + anecdote enchaînées dans un même clip : pas de trou ni de changement de ton.
      voice.a = await clip(`${ANS[(i + j) % ANS.length].replace("{a}", answer.split(",")[0])}${fact ? ` ${fact}` : ""}`, `${k + 1}-${j}-a`);
    }
    items.push({ prompt: p, ask, choices, correct, answer: answer.split(",").slice(0, 2).join(","), level, fact, voice });
  }
  const extrait = { id: name, skin, items, voice: { title: await clip(SKIN.title, `${k + 1}-title`), outro: await clip(outroText, `${k + 1}-outro`) } };
  const props = `out/short-v3/${name}.json`;
  writeFileSync(props, JSON.stringify({ extrait }));
  execSync(`npx remotion render src/index.ts ShortExtrait "out/short-v3/${name}.mp4" --props="${props}" ${process.env.SHORT_V3_FLAGS ?? ""} --log=error`, { stdio: "inherit" });
  const sec = Number(sh(`ffprobe -v error -show_entries format=duration -of csv=p=0 "out/short-v3/${name}.mp4"`));
  if (sec > 59) throw new Error(`${name} : ${sec.toFixed(1)} s > 59 s`);
  console.log(`  rendu : ${name}.mp4 (${sec.toFixed(1)} s)`);
  report.push({ slot: k + 1, hour: SLOTS[k].hour, skin, file: `${name}.mp4`, seconds: sec, title: SLOTS[k].title.slice(0, 100), questions: items.map((it, j) => ({ n: set[j][0] + 1, level: it.level, choices: it.choices, answer: it.answer })) });
}
writeFileSync(`out/short-v3/${ep.id}.json`, JSON.stringify({ episode: ep.id, shorts: report }, null, 1) + "\n");
// Production (12/11/2026) : --date <AAAA-MM-JJ> écrit la fiche data/shorts/<date>.json lue par la tâche planifiée Claude de midi,
// qui programme les Shorts via Metricool (YouTube, Instagram, Facebook, TikTok), comme pour la Minute culture.
const date = arg("date");
if (date && !only && report.length) {
  const tags = ["quiz", "quizfrancais", "youqwiz", bank.replaceAll("-", ""), dilemma ? "tupreferes" : "culturegenerale"];
  mkdirSync("data/shorts", { recursive: true });
  writeFileSync(`data/shorts/${date}.json`, JSON.stringify({ date, episode: ep.id, longId: arg("long") || null, skin, shorts: report.map((r, k) => {
    const title = r.title.replace(/\s*#Shorts$/i, "");
    return { slot: r.slot, at: SLOTS[k].at, file: r.file, url: `https://github.com/PEgh-1/youqwiz-tube/releases/download/shorts-${date}/${r.file}`, seconds: Math.round(r.seconds), title,
      caption: arg("fallback") ? `${title}\n\nLe grand quiz du jour ce soir à 17 h 30 sur la chaîne YouTube YouQwiz 🎬 et sur youqwiz.com` : `${title}\n\nLe grand quiz complet (${ep.items.length} questions) ce soir à 17 h 30 sur la chaîne YouTube YouQwiz 🎬 et sur youqwiz.com`, hashtags: tags };
  }) }, null, 1) + "\n");
  console.log(`fiche : data/shorts/${date}.json`);
}
