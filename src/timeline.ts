// Timeline d'un épisode. Sans dépendance Remotion : importée aussi par scripts/chapters.mjs (Node 22, types effacés).
import { LEVEL_ORDER, LEVEL_POINTS, LEVEL_SECONDS, answerSeconds } from "./levels.ts";
import type { Episode, Level } from "./types.ts";
import { tr } from "./i18n.ts";

export type Segment =
  | { kind: "preroll"; from: number; dur: number }
  | { kind: "packshot"; from: number; dur: number }
  | { kind: "champion"; from: number; dur: number }
  | { kind: "subscribe"; from: number; dur: number }
  | { kind: "cliff"; from: number; dur: number; index: number }
  | { kind: "intro"; from: number; dur: number }
  | { kind: "level"; from: number; dur: number; level: Level }
  | { kind: "question"; from: number; dur: number; index: number }
  | { kind: "reveal"; from: number; dur: number; index: number }
  | { kind: "score"; from: number; dur: number }
  | { kind: "outro"; from: number; dur: number }
  /** Intermède (vidéo longue v2) : `ask` = durée de la phase question (frames), le reste révèle réponse + anecdote. */
  | { kind: "interlude"; from: number; dur: number; index: number; ask: number };

// Décalage de la voix de réponse après l'apparition de la réponse (s) — volontairement court pour rester calé sur l'image.
export const VOICE_LEAD = 0.1;
// Le fait bonus démarre après la voix de réponse (ou à 1,2 s sans voix) ; la révélation dure au moins la voix entière + une respiration.
export const FACT_GAP = 0.4;
const fitVoice = (minSec: number, voiceSec: number | undefined, startSec: number) => Math.max(minSec, voiceSec ? startSec + voiceSec + 0.35 : 0);

export { LEVEL_ORDER };

// Niveau d'un item : explicite, sinon par quartile de position.
export const levelOf = (ep: Episode, i: number): Level =>
  ep.items[i].level ?? LEVEL_ORDER[Math.min(3, Math.floor((i / ep.items.length) * 4))];

// Chrono calculé (08/11/2026) : remplace la grille fixe 5/5/6/7 s et la durée fixe des « tu préfères ».
export const questionSeconds = (ep: Episode, i: number, short = false): number => {
  // Vidéo longue : temps calculé (lecture + réflexion + geste, cf. levels.ts) ; Short : rythme rapide imposé par la limite de 60 s.
  const it = ep.items[i];
  const lv = it.prompt.type === "choices" ? "moyen" : levelOf(ep, i);
  const base = short ? 3 : answerSeconds(it.prompt, lv, ep.question ?? "") + (ep.timing.slow ? 1 : 0);
  const v = ep.items[i].voice?.q?.sec ?? 0; // la voix lit la question : on laisse 2 s (1 s en Short) de réflexion après
  return Math.max(base, Math.ceil((v + (short ? 1 : 2)) * 2) / 2) + (fxFinish(ep, short) ? 0.5 : 0);
};

// Instant (s) où le fait bonus apparaît pendant la révélation.
export const factStart = (ep: Episode, i: number): number => {
  const a = ep.items[i].voice?.a?.sec;
  const imp = levelOf(ep, i) === "impossible" ? 0.8 : 0;
  return imp + (a ? VOICE_LEAD + a + FACT_GAP : 1.2);
};

// Révélation : 2 s, + 0,8 s de pause dramatique sur les impossibles, + le fait bonus s'il existe (en vidéo longue seulement).
export const revealSeconds = (ep: Episode, i: number, short = false): number => {
  if (ep.timing.reveal <= 0) return 0;
  const base = short ? 1.2 : ep.timing.reveal + (levelOf(ep, i) === "impossible" ? 0.8 : 0);
  const v = ep.items[i].voice?.a?.sec ?? 0;
  let sec = Math.max(base, Math.ceil((v + VOICE_LEAD + 0.5 + (!short && levelOf(ep, i) === "impossible" ? 0.8 : 0)) * 2) / 2);
  if (!short && ep.items[i].fact) {
    const f = ep.items[i].voice?.f?.sec ?? 2.5;
    sec = Math.max(sec, Math.ceil((factStart(ep, i) + f + 0.6) * 2) / 2);
  }
  return sec + (fxFinish(ep, short) ? FX_TRANSITION.before : 0);
};

// Options du Short « explosif » : hook 1,5 s, 6 questions rapides + 1 cliffhanger sans réponse, carte finale 4 s.
// Shorts v2 (09/11/2026) : plus de carte d'accroche, la 1re question démarre tout de suite (accroche en bandeau sur Q1).
export const SHORT_OPTS = (ep: Episode) => ({ preroll: 0, packshot: 0, subscribe: 0, intro: 0, outro: 0, levelCard: 0, score: 0, maxItems: 8, short: true, cliff: 4, maxSeconds: 58, interludes: false });

// ---------- Vidéo longue v2 (09/11/2026, inspirée des quiz « à transitions ») ----------
// Transition « déchirure » entre deux scènes : 0,8 s à cheval sur la frontière (recouvre la fin de la scène sortante et le début
// de l'entrante), portée par une mascotte qui alterne. C'est un calque posé par-dessus la timeline : il n'allonge pas la vidéo.
export const WIPE_SECONDS = 0.8;
// Finitions v3 (14/11/2026) : transition mascottes de 1,3 s (tope-là / clin d'œil). Elle recouvre les 0,6 dernières secondes de
// la scène sortante et les 0,7 premières de l'entrante : la révélation et la question sont allongées d'autant, et la voix de la
// question attend que l'écran se découvre. Pas de transition entre une carte de niveau et sa première question (simple coupe).
export const FX_TRANSITION = { total: 1.3, before: 0.6, closed: [10 / 30, 27 / 30] as [number, number] };
export const fxFinish = (ep: Episode, short = false): boolean => !!ep.fx?.finish && !short;
/** Retard (s) de la voix et de l'apparition de la question sous la transition v3. */
export const questionDelay = (ep: Episode, short = false): number => (fxFinish(ep, short) ? 0.4 : 0);
// Scènes qui reçoivent une transition d'entrée : questions, cartes de niveau, intermèdes (jamais la toute première scène).
export const wipeScenes = (segments: Segment[], fx = false): { from: number; index: number }[] =>
  segments
    .filter((s, i) => (s.kind === "question" || s.kind === "level" || s.kind === "interlude") && s.from > 0 && !(fx && s.kind === "question" && segments[i - 1]?.kind === "level"))
    .map((s, i) => ({ from: s.from, index: i }));
// Variante de décor (angle du dégradé, position du motif) : change à chaque scène, sous la transition → jamais de saut visible.
export const sceneVariant = (segments: Segment[], frame: number): number => {
  let v = 0;
  for (const s of segments) {
    if (s.from > frame) break;
    if (s.kind === "question" || s.kind === "level" || s.kind === "interlude") v++;
  }
  return v;
};
// Intermèdes : un toutes les `step` questions (8 à 10 selon le nombre total, répartis régulièrement), jamais après la dernière.
export const interludeStep = (n: number): number => {
  if (n < 12) return 0;
  const count = Math.max(1, Math.round(n / 9));
  return Math.min(10, Math.max(8, Math.round(n / (count + 1))));
};
export const interludeAfter = (ep: Episode, i: number): number | null => {
  if (!ep.interludes?.length) return null;
  const step = interludeStep(ep.items.length);
  if (!step || i >= ep.items.length - 1 || (i + 1) % step !== 0) return null;
  const k = (i + 1) / step - 1;
  return k < ep.interludes.length ? k : null;
};
// Durées d'un intermède : question lue + 3 s de réflexion ; révélation = réponse lue + anecdote lue + respiration.
export const interludeSeconds = (ep: Episode, k: number): { ask: number; total: number } => {
  const it = ep.interludes![k];
  const ask = Math.max(5, Math.ceil(((it.voice?.q?.sec ?? 3) + 3) * 2) / 2);
  const a = it.voice?.a?.sec ?? 1.5, f = it.voice?.f?.sec ?? 4;
  const reveal = Math.max(4, Math.ceil((0.3 + a + 0.4 + f + 0.8) * 2) / 2);
  return { ask, total: ask + reveal };
};

// Question où la série « se perd » (une fois par vidéo, vers les deux tiers), pour relancer l'attention.
export const streakBreakIndex = (ep: Episode): number => Math.floor(ep.items.length * 0.62);

export const buildTimeline = (
  ep: Episode,
  fps: number,
  opts: { preroll?: number; intro?: number; outro?: number; packshot?: number; subscribe?: number; levelCard?: number; score?: number; maxItems?: number; short?: boolean; cliff?: number; maxSeconds?: number; interludes?: boolean } = {},
): { segments: Segment[]; total: number } => {
  if (ep.pilot && !opts.short) opts = { ...opts, ...(ep.pilot as typeof opts) };
  // Short : on retire des questions tant que la durée dépasse le plafond (60 s YouTube, marge 2 s).
  if (opts.maxSeconds) {
    const { maxSeconds, ...rest } = opts;
    let m = Math.min(ep.items.length, rest.maxItems ?? ep.items.length);
    let res = buildTimeline(ep, fps, { ...rest, maxItems: m });
    while (m > 3 && res.total > maxSeconds * fps) res = buildTimeline(ep, fps, { ...rest, maxItems: --m });
    return res;
  }
  const sec = (s: number) => Math.round(s * fps);
  const preroll = (opts.preroll ?? 3) > 0 ? sec(fitVoice(opts.preroll ?? 3, ep.voice?.preroll?.sec, 0.3)) : 0; // pré-roll variable (voix off générique)
  const fast = !!ep.fx?.fast && !opts.short;
  const intro = opts.short ? sec(opts.intro ?? 5) : sec(fitVoice(opts.intro ?? (fast ? 3.5 : 5), ep.voice?.intro?.sec, 10 / 30)); // 08/11/2026 : s'allonge si l'accroche lue dépasse
  const outro = (opts.outro ?? 5) > 0 ? sec(fitVoice(opts.outro ?? 5, ep.voice?.outro?.sec, 1 / 3)) : 0;
  const packshot = (opts.packshot ?? 10) > 0 ? sec(fitVoice(opts.packshot ?? 10, ep.voice?.packshot?.sec, 0.5)) : 0; // CTA site + zone écrans de fin YouTube
  const subscribe = (opts.subscribe ?? 3) > 0 ? sec(fitVoice(opts.subscribe ?? 3, ep.voice?.subscribe?.sec, 4 / 30)) : 0; // « Abonne-toi et active la cloche » après l'accroche
  const short = !!opts.short;
  const cliff = (opts.cliff ?? 0) > 0 ? sec(fitVoice(opts.cliff ?? 0, ep.voice?.cliff?.sec, 6 / 30)) : 0;
  const score = (opts.score ?? 5) > 0 ? sec(fitVoice(opts.score ?? 5, ep.voice?.score?.sec, 0.5)) : 0;
  const levelCard = sec(opts.levelCard ?? 1.5);
  const n = Math.min(ep.items.length, opts.maxItems ?? ep.items.length);

  const segments: Segment[] = [];
  let t = 0;
  if (preroll > 0) {
    segments.push({ kind: "preroll", from: t, dur: preroll });
    t += preroll;
  }
  if (intro > 0) {
    segments.push({ kind: "intro", from: t, dur: intro });
    t += intro;
  }
  if (ep.champion && preroll > 0) {
    segments.push({ kind: "champion", from: t, dur: sec(4) });
    t += sec(4);
  }
  if (subscribe > 0 && !fast) {
    segments.push({ kind: "subscribe", from: t, dur: subscribe });
    t += subscribe;
  }
  let lastLevel: Level | null = null;
  for (let i = 0; i < n; i++) {
    const lv = levelOf(ep, i);
    if (lv !== lastLevel && levelCard > 0) {
      const lc = Math.max(levelCard, sec(fitVoice(0, ep.voice?.[`level_${lv}`]?.sec, 8 / 30))) + (fxFinish(ep, short) ? sec(0.7) : 0);
      segments.push({ kind: "level", from: t, dur: lc, level: lv });
      t += lc;
      lastLevel = lv;
    }
    const q = sec(questionSeconds(ep, i, short));
    segments.push({ kind: "question", from: t, dur: q, index: i });
    t += q;
    if (short && cliff > 0 && i === n - 1) {
      // Short : la dernière question reste sans réponse → carte « la suite dans la vidéo complète »
      segments.push({ kind: "cliff", from: t, dur: cliff, index: i });
      t += cliff;
      break;
    }
    const r = sec(revealSeconds(ep, i, short));
    if (r > 0) {
      segments.push({ kind: "reveal", from: t, dur: r, index: i });
      t += r;
    }
    // fx.fast : « abonne-toi » après la 3e réponse (le spectateur a déjà joué), plus avant la 1re question.
    if (fast && subscribe > 0 && i === 2 && n > 3) {
      segments.push({ kind: "subscribe", from: t, dur: subscribe });
      t += subscribe;
    }
    // Intermède (vidéo longue, hors « tu préfères ») toutes les 8 à 10 questions.
    const k = !short && ep.timing.reveal > 0 && (opts.interludes ?? true) ? interludeAfter(ep, i) : null;
    if (k !== null) {
      const d = interludeSeconds(ep, k);
      segments.push({ kind: "interlude", from: t, dur: sec(d.total), index: k, ask: sec(d.ask) });
      t += sec(d.total);
    }
  }
  if (score > 0 && ep.timing.reveal > 0) {
    segments.push({ kind: "score", from: t, dur: score });
    t += score;
  }
  if (outro > 0) {
    segments.push({ kind: "outro", from: t, dur: outro });
    t += outro;
  }
  if (packshot > 0) {
    segments.push({ kind: "packshot", from: t, dur: packshot });
    t += packshot;
  }
  return { segments, total: t };
};

export const totalPoints = (ep: Episode, upTo = ep.items.length): number =>
  ep.items.slice(0, upTo).reduce((s, _, i) => s + LEVEL_POINTS[levelOf(ep, i)], 0);

// Chapitres YouTube (secondes → titre) déduits de la timeline de la vidéo longue : intro, un par niveau, score.
export const chaptersOf = (ep: Episode, fps: number): { at: number; title: string }[] => {
  const { segments } = buildTimeline(ep, fps);
  const T = tr(ep);
  const out: { at: number; title: string }[] = [{ at: 0, title: T.chapterIntro }];
  const names: Record<Level, string> = T.chapterLevel;
  const choice = ep.timing.reveal <= 0;
  let count = 0;
  for (const s of segments) {
    if (s.kind === "level") out.push({ at: s.from / fps, title: names[s.level] });
    if (choice && s.kind === "question") {
      if (count % 10 === 0) out.push({ at: s.from / fps, title: T.chapterChoices(count + 1, Math.min(count + 10, ep.items.length)) });
      count++;
    }
    if (s.kind === "score") out.push({ at: s.from / fps, title: T.chapterScore });
    if (s.kind === "packshot") out.push({ at: s.from / fps, title: ep.variants?.nextQuizVoice ? T.chapterNext : T.chapterPackshot });
  }
  // YouTube exige des chapitres d'au moins 10 s : on fusionne les trop courts avec le précédent.
  return out.filter((c, i) => i === 0 || c.at - out[i - 1].at >= 10);
};
