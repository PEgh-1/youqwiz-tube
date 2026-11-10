// Construit l'épisode du jour : data/episodes/<date>-<slug>.json
// Usage : node scripts/generate.mjs [--date 2026-11-03] [--pillar devine] [--bank animaux] [--items 60]
// 03/11/2026 : habillage, textes (pré-roll, cartes, packshot), titre, description, miniature et durée tirés par épisode
// dans data/variants.json et data/rotation.json, pour que chaque vidéo ait son propre habillage et ses propres textes.
import { existsSync, readdirSync } from "node:fs";
import { BLACKLIST, argv, findBlacklisted, p, readJson, rng, shuffle, todayParis, writeJson } from "./lib.mjs";
import { LEVEL_ORDER, answerSeconds } from "../src/levels.ts";
import { interludeStep } from "../src/timeline.ts";

const rotation = readJson(p("data/rotation.json"));
const V = readJson(p("data/variants.json"));
const LEVEL_RANK = { facile: 0, moyen: 1, difficile: 2, impossible: 3 };
// Ré-utiliser un épisode existant tel quel (même contenu que son Short déjà public) : REUSE_EPISODE=<id>
if (process.env.REUSE_EPISODE) {
  const id = process.env.REUSE_EPISODE;
  const file = p("data/episodes", `${id}.json`);
  const ep = readJson(file);
  if (!ep) throw new Error(`épisode ${id} introuvable`);
  for (const it of ep.items) delete it.voice;
  for (const it of ep.interludes ?? []) delete it.voice;
  delete ep.voice;
  // Ré-ordonnancement par difficulté (rank) si la banque en fournit un (ex. drapeaux par population, 06/11/2026) :
  // on recolle d'abord le rank de la banque (les épisodes générés avant le reclassement n'en ont pas).
  const bankFile = p("data/banks", `${ep.bank ?? id.split("-").slice(3).join("-")}.json`);
  const bank = existsSync(bankFile) ? readJson(bankFile) : null;
  if (bank?.items?.some((b) => typeof b.rank === "number")) {
    const byAnswer = new Map(bank.items.map((b) => [String(b.answer).trim().toLowerCase(), b.rank]));
    for (const it of ep.items) { const r = byAnswer.get(String(it.answer).trim().toLowerCase()); if (typeof r === "number") it.rank = r; }
  }
  if (ep.items.some((it) => typeof it.rank === "number")) ep.items.sort((x, y) => (LEVEL_RANK[x.level] ?? 0) - (LEVEL_RANK[y.level] ?? 0) || (x.rank ?? 1e9) - (y.rank ?? 1e9));
  // 08/11/2026 : textes de voix rafraîchis depuis les banques de variantes actuelles (pré-roll plus enjoué, score → champion du lendemain, outro).
  const V0 = readJson(p("data/variants.json"));
  const r0 = rng(`${id}-refresh`);
  const pick0 = (arr) => arr[Math.floor(r0() * arr.length)];
  ep.variants ??= {};
  const samePre = V0.preroll.find((x) => x.text.replace(/\{[a-z]+\}/g, "") && ep.variants.preroll?.text && ep.variants.preroll.text.startsWith(x.text.split("{")[0]));
  if (samePre && ep.variants.preroll) {
    // on garde le texte affiché (déjà rempli) et on reprend la nouvelle voix, en recopiant les valeurs déjà résolues ({theme}, {weekday})
    const vals = {}; const re = new RegExp("^" + samePre.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\{([a-z]+)\\\}/g, "(?<$1>.+)") + "$");
    const m = ep.variants.preroll.text.match(re); if (m?.groups) Object.assign(vals, m.groups);
    // {theme} absent du texte affiché (ex. « Bon mardi ! ») → sujet de la banque (le 10/11/2026, la voix disait « Au programme : Bon mardi ! »)
    const themeLbl = (bank?.subject ?? bank?.noun ?? "").toLowerCase().replace(/^(les |des )/, "") || "le quiz du jour";
    ep.variants.preroll.voice = samePre.voice.replace(/\{([a-z]+)\}/g, (_, k) => vals[k] ?? (k === "theme" ? themeLbl : k === "n" ? String(ep.items.length) : ep.variants.preroll.text));
  }
  ep.variants.scoreVoice = pick0(V0.score);
  if (ep.pillar !== "choix") ep.variants.outro = pick0(V0.outro);
  // Vidéo longue v2 (09/11/2026) : règle lue à l'intro et carte finale « Prochain quiz » aussi pour un épisode ré-utilisé.
  if (V0.rules) {
    const slug = ep.bank ?? id.split("-").slice(3).join("-");
    const kind = ep.template === "QuizQCM" ? (ep.pillar === "generations" ? "generations" : "qcm") : ep.template === "Versus" ? "versus" : ep.template === "Intrus" ? "intrus" : "devine";
    const rules = V0.rules[slug] ?? V0.rules[kind] ?? V0.rules.devine;
    const r = pick0(rules);
    const lbl = (bank?.subject ?? bank?.noun ?? "").toLowerCase().replace(/^(les |des )/, "");
    const fill0 = (t) => t.replaceAll("{n}", String(ep.items.length)).replaceAll("{theme}", lbl);
    ep.variants.rule = fill0(r.text);
    ep.variants.ruleVoice = fill0(r.voice);
  }
  if (V0.nextQuiz) ep.variants.nextQuizVoice = pick0(V0.nextQuiz);
  if (ep.meta?.description) ep.meta.description = ep.meta.description.replace("Compte tes points et dis ton score en commentaire 👇", "Compte tes points et dis ton score en commentaire 👇 Le meilleur score est félicité dès le lendemain 🏆");
  // Shorts v2 (3 par jour) et relais réseaux : un épisode généré avant le 09/11/2026 n'a pas short2/short3/shortHook/social →
  // les 10-12 nov. refaits dans la nuit du 09 au 10 n'ont eu qu'un seul Short. On complète ici ce qui manque.
  {
    const lbl = (bank?.subject ?? bank?.noun ?? "").toLowerCase().replace(/^(les |des )/, "");
    const n = String(ep.items.length);
    const fillM = (t) => String(t).replaceAll("{theme}", lbl).replaceAll("{subject}", bank?.subject ?? bank?.noun ?? "").replaceAll("{n}", n).replaceAll("{noun}", bank?.noun ?? "").replaceAll("{noun1}", (bank?.noun ?? "").toLowerCase().replace(/s$/, "")).replaceAll("{hook}", ep.intro?.hook ?? "").replaceAll("{emoji}", bank?.emoji ?? "");
    ep.meta ??= {};
    if (!ep.meta.shortHook && V0.shortHooks) ep.meta.shortHook = pick0(V0.shortHooks);
    if (!ep.meta.short2 && V0.shortTitlesHard && ep.pillar !== "choix") ep.meta.short2 = { title: fillM(pick0(V0.shortTitlesHard)).slice(0, 100), description: fillM(pick0(V0.shortDescriptions)), ...pick0(V0.shortHardHooks) };
    if (!ep.meta.short3 && V0.shortTitlesMid && ep.pillar !== "choix") ep.meta.short3 = { title: fillM(pick0(V0.shortTitlesMid)).slice(0, 100), description: fillM(pick0(V0.shortDescriptions)), ...pick0(V0.shortMidHooks) };
    if (!ep.meta.social && V0.socialCaptions) ep.meta.social = { caption: fillM(pick0(V0.socialCaptions)), hashtags: [...new Set([...(V0.socialHashtags ?? []), (bank?.slug ?? "").replace(/-/g, "")])].filter(Boolean).slice(0, 10) };
  }
  writeJson(file, ep);
  writeJson(p("data/state/current.json"), { id: ep.id, file, date: ep.date ?? id.slice(0, 10), pillar: ep.pillar, bank: ep.bank });
  console.log(`épisode ré-utilisé : ${id}`);
  process.exit(0);
}
// Date de l'épisode = date de publication visée : le lendemain du dernier créneau pris, au plus tôt demain.
const addDays = (d, n) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const queue = readJson(p("data/state/queue.json"), { lastScheduled: null });
const tomorrow = addDays(todayParis(), 1);
// Premier trou dans la file (épisode supprimé/raté) sinon le lendemain du dernier créneau.
const firstGap = () => {
  if (!queue.lastScheduled) return null;
  const have = new Set((queue.published ?? []).map((r) => r.date));
  for (let d = tomorrow; d <= queue.lastScheduled; d = addDays(d, 1)) if (!have.has(d)) return d;
  return null;
};
const date = argv("date", firstGap() ?? (queue.lastScheduled && queue.lastScheduled >= tomorrow ? addDays(queue.lastScheduled, 1) : tomorrow));
// File tampon pleine (bufferDays jours d'avance) : on s'arrête proprement (le workflow saute les étapes suivantes).
if (!argv("date") && (Date.parse(date) - Date.parse(todayParis())) / 86400000 > (rotation.bufferDays ?? 7)) {
  console.log(`file tampon pleine : dernier créneau ${queue.lastScheduled}, rien à produire aujourd'hui`);
  if (process.env.GITHUB_OUTPUT) (await import("node:fs")).appendFileSync(process.env.GITHUB_OUTPUT, "skip=true\n");
  process.exit(0);
}
const state = readJson(p("data/state/used.json"), { items: {}, banks: {} });
const rand = rng(date);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
// Textes de generate.mjs propres à la langue (09/11/2026) : surchargés par variants.json → "strings" (chaîne anglaise).
const S = {
  lang: "fr",
  weekdays: ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"],
  subChoice: ["Choisis vite, sans réfléchir 🤔", "5 secondes par choix, pas une de plus ⏱️", "Ton cœur ou ta raison ? 💭"],
  subGenerations: ["Tu as vécu ça ? Prouve-le 😏", "Teste ta mémoire, pas tes enfants 📺", "Si tu t'en souviens, tu as tout bon 🥰"],
  subQcm: ["4 réponses, une seule bonne 🧠", "Une seule bonne réponse sur quatre 🎯", "Compte tes points, niveau par niveau ⭐"],
  subIntrus: ["Un seul est différent 👀", "Trouve-le avant la fin du chrono ⏱️", "Ouvre l'œil, et le bon 👁️"],
  subDevine: ["en 5 secondes ⏱️ de facile à impossible", "5 secondes par question, sans pause ⏱️", "Du facile à l'impossible, en 5 secondes 🔥"],
  levelNames: { facile: "facile", moyen: "moyen", difficile: "difficile", impossible: "impossible" },
  levelPlural: true, // « 12 moyens », « 8 difficiles » (pas de pluriel en anglais)
  levelLine: "Niveaux : {list}.",
  extraFacts: "{facts} anecdotes « le savais-tu » glissées après les réponses.",
  extraChoice: "Dis tes choix en commentaire, on compare.",
  extraScore: "Compte tes points et dis ton score en commentaire 👇 Le meilleur score est félicité dès le lendemain 🏆",
  ctaTexts: ["Défie tes proches sur youqwiz.com", "Crée ton quiz gratuit sur youqwiz.com", "Le même quiz en version jouable : youqwiz.com"],
  quizPath: "https://youqwiz.com/quiz-du-jour/",
  hashtags: { generations: " #nostalgie", choice: " #tupreferes", default: " #quizfrancais" },
  tags: { base: ["quiz", "quiz français", "quizz", "youqwiz"], choice: ["tu préfères", "dilemme"], devine: ["devinette", "facile à impossible"], generations: "nostalgie", culture: "culture générale", tail: ["quiz en français", "jeu"] },
  thumbWeek: "de la semaine",
  thumbIntrus: "l'intrus",
  stickerNotForChoice: "ÉCHOUENT|TOUT BON|GÉNIE|PERSONNE", // autocollants de miniature sans sens pour un « tu préfères »
  siteHook: "Les {n} QUESTIONS de la SEMAINE sur youqwiz.com",
  siteNoun: "QUESTIONS",
  ...(V.strings ?? {}),
};
const WEEKDAYS = S.weekdays;

// 1. Pilier du jour (ou forcé), avec repli si le gabarit n'est pas encore livré.
const dow = new Date(`${date}T12:00:00Z`).getUTCDay();
let pillar = argv("pillar", rotation.week[String(dow)].pillar);
const visited = [];
while (rotation.pillars[pillar].banks.length === 0) {
  visited.push(pillar);
  pillar = rotation.pillars[pillar].fallback;
  if (!pillar || visited.includes(pillar)) throw new Error("aucun pilier disponible");
}
let conf = rotation.pillars[pillar];

// Pilier « site » (samedi) : les quiz du jour de la semaine sur youqwiz.com, via export JSON signé.
// Format attendu : { "quizzes": [ { "date": "2026-11-01", "title": "…", "questions": [ { "question": "…", "choices": ["a","b","c","d"], "correct": 2, "level": "moyen" } ] } ] }
let siteBank = null;
if (pillar === "site") {
  const url = process.env.YOUQWIZ_EXPORT_URL;
  try {
    if (!url) throw new Error("YOUQWIZ_EXPORT_URL absent");
    const res = await fetch(`${url}${url.includes("?") ? "&" : "?"}until=${date}&days=7`);
    if (!res.ok) throw new Error(`export ${res.status}`);
    const data = await res.json();
    const items = (data.quizzes ?? []).flatMap((q) => (q.questions ?? []).map((x) => ({ prompt: { type: "qcm", value: x.question, choices: x.choices, correct: x.correct }, answer: x.choices[x.correct], level: x.level ?? "moyen", source: q.title })));
    if (items.length < 20) throw new Error(`seulement ${items.length} questions`);
    siteBank = { slug: "youqwiz-semaine", question: "", hook: S.siteHook, emoji: "🎮🧠📅", noun: S.siteNoun, timing: { question: 5, reveal: 2 }, items };
    console.log(`export youqwiz.com : ${items.length} questions (${data.quizzes.length} quiz)`);
  } catch (e) {
    console.warn(`pilier site indisponible (${e.message}) → repli sur ${conf.fallback}`);
    if (process.env.GITHUB_ACTIONS) console.log(`::warning title=Site::export youqwiz.com indisponible : ${e.message} — repli ${conf.fallback}`);
    pillar = conf.fallback;
    conf = rotation.pillars[pillar];
  }
}

// 2. Durée cible variable (10 à 20 min par défaut, par pilier si précisé) → nombre d'items, estimé avec la même grille que src/timeline.ts.
const range = conf.targetSeconds ?? rotation.targetSeconds ?? { min: 600, max: 1200 };
const MIN_SECONDS = typeof range === "number" ? range : range.min;
const TARGET = typeof range === "number" ? range : Math.round(range.min + rand() * (range.max - range.min));
const MAX_SECONDS = rotation.maxSeconds ?? 2400;
// Durée moyenne d'un item, calculée sur les items de la banque avec le vrai chrono (src/levels.ts answerSeconds) :
// un QCM lu avec ses 4 choix prend ~15-18 s, un « devine » ~12 s, un « tu préfères » ~10 s. L'ancienne grille forfaitaire
// (~11 s pour tous) sous-estimait les QCM de 40 % → épisodes de 31 min (15/11/2026) et disque plein au rendu.
// Calibré le 09/11/2026 sur 6 rendus réels (écart < 5 %).
const avgItemSeconds = (bank) => {
  const { items, timing, question = "" } = bank;
  if (!items?.length) return 12;
  const per = items.map((it, i) => {
    if (timing?.fixed) return 10 + (timing?.reveal ?? 0);
    const lv = it.prompt.type === "choices" ? "moyen" : it.level ?? LEVEL_ORDER[Math.min(3, Math.floor((i / items.length) * 4))];
    const q = answerSeconds(it.prompt, lv, question) + (timing?.slow ? 1 : 0) + (lv === "impossible" ? 0.8 : 0);
    const r = (timing?.reveal ?? 2) > 0 ? Math.max(timing?.reveal ?? 2, 3) + (it.fact ? 4 : 0) : 0; // la voix de réponse impose ~3 s, +4 s par fait bonus
    return q + r;
  });
  return per.reduce((a, b) => a + b, 0) / per.length;
};
const OVERHEAD = 3 + 12 + 4 * 1.5 + 5 + 5 + 10; // pré-roll, intro (+ règle lue, v2), cartes de niveau, score, outro, packshot
// Vidéo longue v2 : un intermède (~15 s) toutes les ~9 questions, soit ~1,7 s de plus par item (hors « tu préfères »).
const INTERLUDE_PER_ITEM = 15 / 9;
const perItem = (bank) => avgItemSeconds(bank) + ((bank.timing?.reveal ?? 2) > 0 && existsSync(p(`data/interludes/${bank.slug}.json`)) ? INTERLUDE_PER_ITEM : 0);
const neededFor = (bank, target = TARGET) => Math.ceil((target - OVERHEAD) / perItem(bank));
const maxFor = (bank) => Math.floor((MAX_SECONDS - OVERHEAD) / perItem(bank));

// 3. Banque : la moins utilisée récemment, pondérée (saison incluse) ; on écarte celles trop petites pour la durée cible.
const mmdd = date.slice(5);
const inSeason = (bk) => !bk.season || (bk.season.from <= bk.season.to ? mmdd >= bk.season.from && mmdd <= bk.season.to : mmdd >= bk.season.from || mmdd <= bk.season.to);
let bankName = argv("bank");
if (siteBank) bankName = siteBank.slug;
else if (!bankName) {
  const info = Object.fromEntries(conf.banks.map((b) => { const bk = readJson(p(`data/banks/${b}.json`)); return [b, { n: bk.items.length, need: neededFor(bk, MIN_SECONDS), season: inSeason(bk), seasonal: !!bk.season }]; }));
  const open = conf.banks.filter((b) => info[b].season);
  const eligible = open.filter((b) => info[b].n >= info[b].need);
  if (eligible.length < open.length) console.warn(`banques trop courtes pour ${MIN_SECONDS} s : ${open.filter((b) => !eligible.includes(b)).map((b) => `${b} (${info[b].n}/${info[b].need})`).join(", ")}`);
  const scored = (eligible.length ? eligible : open).map((b) => {
    const last = state.banks[b] ?? "2000-01-01";
    const daysSince = (Date.parse(date) - Date.parse(last)) / 86400000;
    const seasonBoost = info[b].seasonal ? 3 : 1; // une banque de saison passe devant pendant sa fenêtre
    return { b, score: (conf.weights?.[b] ?? 1) * seasonBoost * Math.min(daysSince, 60) * (0.8 + 0.4 * rand()) };
  });
  scored.sort((a, b) => b.score - a.score);
  bankName = scored[0].b;
}
const bank = siteBank ?? readJson(p(`data/banks/${bankName}.json`));
if (!bank) throw new Error(`banque introuvable : ${bankName}`);

// 4. Items : assez pour la durée cible (ou le max de la banque), jamais plus que 40 min ; d'abord ceux jamais publiés.
const need = neededFor(bank);
const n = Math.min(Number(argv("items", Math.max(conf.itemsPerEpisode, need))), bank.items.length, maxFor(bank));
if (n < need) console.warn(`ATTENTION : ${bankName} n'a que ${bank.items.length} items, épisode sous la cible (${n}/${need})`);
const key = (it) => JSON.stringify(it.prompt);
const fresh = bank.items.filter((it) => !state.items[`${bankName}:${key(it)}`]);
const pool = fresh.length >= n ? fresh : [...fresh, ...shuffle(bank.items.filter((it) => !fresh.includes(it)), rand)];
const items = shuffle(pool, rand)
  .slice(0, n)
  .map((it) => ({ ...it }))
  // niveaux explicites : on remonte du facile vers l'impossible ; à niveau égal, rank croissant quand la banque en donne un
  // (drapeaux : par population décroissante, décision du 06/11/2026 — les premiers drapeaux doivent être les plus connus)
  .sort((a, b) => (LEVEL_RANK[a.level] ?? 0) - (LEVEL_RANK[b.level] ?? 0) || (a.rank ?? 1e9) - (b.rank ?? 1e9));
// Faits bonus : au plus 1 item sur 3 dans l'épisode (le reste est retiré pour garder le rythme), jamais deux de suite.
let lastFact = -5;
items.forEach((it, i) => {
  if (!it.fact) return;
  if (i - lastFact < 3 || rand() > 0.85) delete it.fact;
  else lastFact = i;
});
const count = items.length;
const facts = items.filter((i) => i.fact).length;

// 5. Habillage : palette du pilier, motif, chrono, révélation, carte, musique (tirés par épisode).
const THEME_INDEX = { chaud: 0, menthe: 1, violet: 2, nuit: 3, sepia: 4, bonbon: 5 };
const PS = V.pillarStyle?.[pillar] ?? rotation.pillars[pillar].style ?? {};
const styleDefaults = {
  devine: { themes: ["chaud", "menthe", "nuit"], patterns: ["confetti", "stars"], timers: ["ring", "digits"], reveals: ["pop", "zoom", "slide"], cards: ["round", "tilt"] },
  choix: { themes: ["bonbon", "violet", "chaud"], patterns: ["bubbles", "confetti"], timers: ["bar"], reveals: ["pop"], cards: ["round", "square"] },
  culture: { themes: ["menthe", "nuit", "violet"], patterns: ["dots", "stripes"], timers: ["bar", "ring"], reveals: ["flip", "pop"], cards: ["square", "round"] },
  generations: { themes: ["sepia", "chaud"], patterns: ["stripes", "dots"], timers: ["digits", "ring"], reveals: ["slide", "pop"], cards: ["square", "tilt"] },
  emojis: { themes: ["violet", "bonbon", "nuit"], patterns: ["stars", "bubbles"], timers: ["pie", "ring"], reveals: ["zoom", "flip"], cards: ["round", "tilt"] },
  site: { themes: ["menthe", "bonbon"], patterns: ["dots", "confetti"], timers: ["bar"], reveals: ["pop"], cards: ["square"] },
}[pillar];
const sd = { ...styleDefaults, ...PS };
// Éviter de reprendre exactement l'habillage de l'épisode précédent du même pilier.
const previous = readdirSync(p("data/episodes")).filter((f) => /^\d{4}-\d{2}-\d{2}-/.test(f) && f < `${date}-`).sort().slice(-14).map((f) => readJson(p("data/episodes", f))).filter(Boolean);
const prevSame = previous.filter((e) => e.pillar === pillar).at(-1);
const choose = (arr, avoid) => { const opts = arr.length > 1 && avoid !== undefined ? arr.filter((x) => x !== avoid) : arr; return pick(opts); };
const themeName = choose(sd.themes, previous.at(-1) ? Object.keys(THEME_INDEX)[previous.at(-1).theme] : undefined);
const musics = readdirSync(p("public/audio")).filter((f) => /^music(-[\w-]+)?\.mp3$/.test(f)).sort();
const style = {
  pattern: choose(sd.patterns, prevSame?.style?.pattern),
  timer: choose(sd.timers, prevSame?.style?.timer),
  reveal: choose(sd.reveals, prevSame?.style?.reveal),
  card: choose(sd.cards, prevSame?.style?.card),
  music: musics.length ? (Math.floor(rand() * musics.length) + (previous.at(-1)?.style?.music ?? 0) + 1) % musics.length : 0,
};

// 6. Textes variables (pré-roll, intro, abonnement, cartes de niveau, score, outro, packshot).
const themeLabel = (bank.subject ?? bank.noun).toLowerCase().replace(/^(les |des )/, "");
const subject = bank.subject ?? bank.noun;
const fill = (s) => s.replaceAll("{theme}", themeLabel).replaceAll("{subject}", subject).replaceAll("{n}", String(count)).replaceAll("{noun}", bank.noun).replaceAll("{noun1}", bank.noun.toLowerCase().replace(/s$/, "")).replaceAll("{weekday}", WEEKDAYS[dow]).replaceAll("{hook}", bank.hook.replace("{n}", String(count))).replaceAll("{emoji}", bank.emoji);
const isChoice = pillar === "choix";
const prerollV = choose(V.preroll, prevSame ? V.preroll.find((x) => x.text === prevSame.variants?.preroll?.text) : undefined);
const outroPool = isChoice ? V.outroChoice : V.outro;
const packPool = [...(V.packshot.byPillar[pillar] ?? []), ...V.packshot.generic];
const variants = {
  preroll: { text: fill(prerollV.text), voice: fill(prerollV.voice) },
  introCta: pick(V.introCta),
  subscribe: choose(V.subscribe, prevSame ? V.subscribe.find((x) => x.title === prevSame.variants?.subscribe?.title) : undefined),
  levels: Object.fromEntries(["facile", "moyen", "difficile", "impossible"].map((l) => [l, pick(V.levels[l])])),
  scoreVoice: pick(V.score),
  outro: pick(outroPool),
  packshot: choose(packPool, prevSame ? packPool.find((x) => x.headline === prevSame.variants?.packshot?.headline) : undefined),
};
// Vidéo longue v2 (09/11/2026) : règle du jeu (carte d'intro, lue après l'accroche) et voix de la carte finale « Prochain quiz ».
{
  const kind = isChoice ? "versus" : conf.templates?.[bankName] === "Intrus" ? "intrus" : (conf.templates?.[bankName] ?? conf.template) === "QuizQCM" ? (pillar === "generations" ? "generations" : "qcm") : "devine";
  const r = pick(V.rules?.[bank.slug] ?? V.rules?.[kind] ?? V.rules?.devine ?? [{ text: "", voice: "" }]);
  if (r.text) { variants.rule = fill(r.text); variants.ruleVoice = fill(r.voice); }
  if (V.nextQuiz) variants.nextQuizVoice = pick(V.nextQuiz);
}
// Intermèdes (vidéo longue v2) : toutes les 8 à 10 questions, en alternant vrai/faux et 3 choix, d'abord ceux jamais publiés.
let interludes;
{
  const step = isChoice ? 0 : interludeStep(count);
  const file = p(`data/interludes/${bank.slug}.json`);
  if (step && existsSync(file)) {
    const want = Math.floor((count - 1) / step);
    const all = readJson(file)?.items ?? [];
    const ikey = (it) => `interlude:${bank.slug}:${it.q}`;
    const byType = (t) => { const xs = all.filter((it) => it.type === t); const fresh = xs.filter((it) => !state.items[ikey(it)]); return shuffle(fresh.length ? fresh : xs, rand).concat(shuffle(xs.filter((it) => !fresh.includes(it)), rand)); };
    const vf = byType("vf"), q3 = byType("qcm3");
    interludes = [];
    for (let i = 0; i < want; i++) { const src = i % 2 === 0 ? vf : q3; const it = src.shift() ?? (i % 2 === 0 ? q3 : vf).shift(); if (it) interludes.push({ ...it }); }
    for (const it of interludes) state.items[ikey(it)] = date;
    if (!interludes.length) interludes = undefined;
  }
}

// 7. Titre (formule par pilier, jamais identique à un titre déjà produit), description, tags, miniature.
const hook = bank.hook.replace("{n}", String(count));
const isQcm = siteBank ? true : conf.templates?.[bankName] === "QuizQCM" || (!conf.templates && conf.template === "QuizQCM");
const isSite = !!siteBank;
const isIntrus = conf.templates?.[bankName] === "Intrus";
const titlePool = V.titles[isSite ? "site" : pillar] ?? V.titles.devine;
const usedTitles = new Set(readdirSync(p("data/episodes")).filter((f) => f.endsWith(".json")).map((f) => readJson(p("data/episodes", f))?.title).filter(Boolean));
const titleCandidates = shuffle(titlePool, rand).map(fill).map((t) => t.replace(/\s+/g, " ").trim());
const title = titleCandidates.find((t) => !usedTitles.has(t) && t.length <= 100) ?? `${titleCandidates[0]} (${WEEKDAYS[dow]})`.slice(0, 100);
const sub = isChoice ? pick(S.subChoice) : isQcm ? (pillar === "generations" ? pick(S.subGenerations) : pick(S.subQcm)) : isIntrus ? pick(S.subIntrus) : pick(S.subDevine);
const byLevel = ["facile", "moyen", "difficile", "impossible"].map((l) => [l, items.filter((i) => (i.level ?? "facile") === l).length]).filter(([, c]) => c > 0);
const levelLine = byLevel.length > 1 ? S.levelLine.replace("{list}", byLevel.map(([l, c]) => `${c} ${S.levelNames[l]}${S.levelPlural && c > 1 && l !== "facile" && l !== "impossible" ? "s" : ""}`).join(", ")) : "";
const intro = fill(pick(V.descriptionIntro[isSite ? "site" : pillar] ?? V.descriptionIntro.devine));
const extra = facts ? S.extraFacts.replace("{facts}", String(facts)) : isChoice ? S.extraChoice : S.extraScore;
// Champion de la semaine (vidéo du lundi) : issu de scripts/community.mjs --leaderboard
const board = readJson(p("data/state/leaderboard.json"));
const champion = dow === 1 && board?.champion && (Date.parse(date) - Date.parse(board.week)) / 86400000 < 8 ? { name: board.champion.name, score: board.champion.score } : undefined;
const stickerPool = V.thumbStickers.filter((s) => (isChoice ? !new RegExp(S.stickerNotForChoice).test(s) : true));
const sticker = fill(choose(stickerPool, prevSame?.meta?.thumbnail?.sticker));
const layouts = shuffle([0, 1, 2, 3], rand).slice(0, 2);
const line1 = pick(V.thumbLine1[isSite ? "site" : pillar] ?? V.thumbLine1.devine);
const template = isSite ? "QuizQCM" : conf.templates?.[bankName] ?? conf.template;

const episode = {
  id: `${date}-${bank.slug}`,
  pillar,
  template,
  theme: THEME_INDEX[themeName] ?? 0,
  style,
  variants,
  title,
  question: bank.question,
  intro: { hook: hook.replace(/\s+/g, " "), sub },
  items,
  ...(interludes ? { interludes } : {}),
  timing: bank.timing ?? { question: 3, reveal: 2 },
  ...(champion ? { champion } : {}),
  ...(S.lang !== "fr" ? { lang: S.lang } : {}),
  cta: { url: "youqwiz.com", text: pick(S.ctaTexts) },
  meta: {
    description: [intro, levelLine, extra].filter(Boolean).join(" ") + "\n\n" + [pick(V.descriptionCta).replace("https://youqwiz.com", `${S.quizPath}${date}-${bank.slug}`), pick(V.descriptionSub)].join("\n") + "\n\n" + `#quiz #${bank.slug.replace(/-/g, "")} #youqwiz` + (pillar === "generations" ? S.hashtags.generations : isChoice ? S.hashtags.choice : S.hashtags.default),
    tags: [...new Set([...S.tags.base, bank.slug.replace(/-/g, " "), ...(bank.tags ?? []), ...(isChoice ? S.tags.choice : S.tags.devine), pillar === "generations" ? S.tags.generations : S.tags.culture, ...S.tags.tail])].slice(0, 20),
    thumbnail: { line1, line2: isSite ? S.thumbWeek : isIntrus ? S.thumbIntrus : `${count} ${bank.noun}`, emoji: (() => { const gs = [...new Intl.Segmenter("fr", { granularity: "grapheme" }).segment(bank.emoji)].map((s) => s.segment).filter((s) => /\p{Extended_Pictographic}/u.test(s)); return gs[Math.floor(rand() * gs.length)] ?? "🧠"; })(), sticker, layouts },
    shortItems: isChoice ? 4 : 5,
    shortTitle: fill(pick(V.shortTitles)).slice(0, 100),
    shortDescription: fill(pick(V.shortDescriptions)),
    // Accroche du Short 1 (bandeau sur la 1re question) : paire sticker + ligne cohérente.
    shortHook: pick(V.shortHooks ?? [{ sticker: "99 % ÉCHOUENT", line: "à la 8e question 😱" }]),
    // 2e Short quotidien (09/11/2026) : les questions les plus dures de l'épisode, publié à 19 h, titre et accroche distincts.
    short2: { title: fill(pick(V.shortTitlesHard)).slice(0, 100), description: fill(pick(V.shortDescriptions)), ...pick(V.shortHardHooks) },
    // 3e Short (16 h, 09/11/2026) : les 8 questions du milieu (moyen-difficile).
    short3: { title: fill(pick(V.shortTitlesMid)).slice(0, 100), description: fill(pick(V.shortDescriptions)), ...pick(V.shortMidHooks) },
    // Relais Instagram / Facebook / TikTok (Metricool) : légende et hashtags prêts à l'emploi pour la tâche quotidienne.
    social: { caption: fill(pick(V.socialCaptions)), hashtags: [...new Set([...V.socialHashtags, bank.slug.replace(/-/g, ""), ...(bank.tags ?? []).slice(0, 3).map((t) => t.replace(/[^\p{L}\p{N}]/gu, "").toLowerCase())])].filter(Boolean).slice(0, 10) },
  },
};

// 8. Garde-fou liste noire.
const bad = findBlacklisted([episode.title, episode.meta.description, ...items.map((i) => `${JSON.stringify(i.prompt)} ${i.answer} ${i.fact ?? ""}`), ...(interludes ?? []).map((i) => `${i.q} ${(i.choices ?? []).join(" ")} ${i.fact}`)].join(" "));
if (bad.length) throw new Error(`termes interdits dans l'épisode : ${bad.join(", ")}`);

// 9. Écriture + état.
const out = p(`data/episodes/${episode.id}.json`);
writeJson(out, episode);
for (const it of items) state.items[`${bankName}:${key(it)}`] = date;
state.banks[bankName] = date;
writeJson(p("data/state/used.json"), state);
writeJson(p("data/state/current.json"), { id: episode.id, file: out, date, pillar, bank: bankName });
console.log(`épisode : ${episode.id} — ${count} items (${facts} faits, ${interludes?.length ?? 0} intermèdes), cible ${TARGET} s, ${themeName}/${style.pattern}/${style.timer}/${style.reveal} — ${title}`);
