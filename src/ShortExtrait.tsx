// Shorts extraits v3 (11/11/2026) : la mécanique de « La minute culture générale », appliquée aux épisodes du jour.
// Déroulé (codes de la Minute) : la question tout de suite (dite et affichée) → virgule sonore avec le titre de la rubrique →
// 3 propositions lues une à une + décompte 3 s → réponse (+ anecdote d'une traite) ; 3 questions de difficulté croissante ;
// fin « Vous en voulez encore ? ». Un habillage par pilier (skin) : réclame (culture générale, comme la Minute), plateau télé
// (devine), pop (émojis), duel (tu préfères). La mise en page est commune, seuls décor, couleurs, titres et ton changent.
import React from "react";
import { AbsoluteFill, Audio, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import audioManifest from "./audio.json";
import { Background, Countdown, FitText, Logo, Mascot, PromptView, Rich, Voice } from "./components";
import { BASELINE, FilmWear, Rays, nb } from "./MinuteCulture";
import { FONT_BODY, FONT_DISPLAY, THEMES, fontFaces } from "./theme";
import type { Level, Prompt, Style, VoiceClip } from "./types";
import type { Theme } from "./theme";

const has = (k: string) => Boolean((audioManifest as Record<string, unknown>)[k]);

export type SkinKey = "reclame" | "plateau" | "pop" | "duel" | "album";
type Skin = {
  title: string; // rubrique (bandeau du haut, virgule sonore)
  tagline: string; // bandeau du bas
  card: string; alt: string; ink: string; main: string; accent: string; second: string;
  /** couleur des textes posés directement sur le décor, et leur ombre */
  onBg: string; onBgShadow: string;
  tu: boolean; // tutoiement (chaîne) ou vouvoiement (réclame)
  sepia: boolean;
  /** identité YouQwiz « Pop sticker » (11/11/2026 soir) : palette de la charte, motif, forme des cartes, chrono et pastilles propres au pilier */
  theme?: Theme["name"]; pattern?: Style["pattern"]; timer?: Style["timer"]; radius: number; tilt: number; lamp: "round" | "square" | "star";
  /** mise en page propre au pilier : chrono (devine), sticker rond (émojis), deux camps (tu préfères), photo souvenir (générations) */
  layout?: "chrono" | "sticker" | "camps" | "photo";
  /** règle du jeu, affichée (et dite) sur le carton de titre */
  rule?: string;
};
// 11/11/2026 (nuit) : la baseline est dite et affichée dans chaque Short, quel que soit le pilier (« ça nous différencie »).
const TAG = "« Aujourd'hui, scroller va te rendre plus malin »";
// reclame = univers de la Minute culture, réservé à la culture générale. Les autres piliers restent dans l'identité de la chaîne
// (Pop sticker, mascottes, logo), chacun avec sa palette, son motif, sa forme de carte, son chrono et ses pastilles.
export const SKINS: Record<SkinKey, Skin> = {
  reclame: { title: "Le quiz express", tagline: `« ${BASELINE} »`, card: "#F4E7C6", alt: "#EBD9AE", ink: "#2B1B12", main: "#C8372D", accent: "#E0A526", second: "#1F6F78", onBg: "#2B1B12", onBgShadow: "#E0A526", tu: false, sepia: true, radius: 22, tilt: 1, lamp: "round" },
  plateau: { title: "3 secondes chrono", tagline: TAG, card: "#FFFFFF", alt: "#FFF3CC", ink: "#1A1030", main: "#FF4D8D", accent: "#FFD23F", second: "#1BB5A8", onBg: "#FFFFFF", onBgShadow: "#1A1030", tu: true, sepia: false, theme: "chaud", pattern: "confetti", timer: "digits", radius: 40, tilt: 1, lamp: "round", layout: "chrono", rule: "Sans propositions, trouve vite !" },
  pop: { title: "Décode si tu peux", tagline: TAG, card: "#FFFFFF", alt: "#EFE9FF", ink: "#1A1030", main: "#7B5CFF", accent: "#FFD23F", second: "#FF4D8D", onBg: "#FFFFFF", onBgShadow: "#1A1030", tu: true, sepia: false, theme: "violet", pattern: "stars", timer: "pie", radius: 100, tilt: 2.4, lamp: "star", layout: "sticker", rule: "Devine ce qui se cache !" },
  duel: { title: "Choisis ton camp", tagline: TAG, card: "#FFFFFF", alt: "#FFE0F2", ink: "#1A1030", main: "#E6399B", accent: "#FFD23F", second: "#7B5CFF", onBg: "#1A1030", onBgShadow: "#FFFFFF", tu: true, sepia: false, theme: "bonbon", pattern: "bubbles", timer: "ring", radius: 46, tilt: 1.4, lamp: "round", layout: "camps", rule: "Ton camp en commentaire !" },
  album: { title: "T'as connu ça ?", tagline: TAG, card: "#FFFDF4", alt: "#FFE8B5", ink: "#1A1030", main: "#C8553D", accent: "#FFD23F", second: "#2A9D8F", onBg: "#1A1030", onBgShadow: "#FFFFFF", tu: true, sepia: false, theme: "sepia", pattern: "stripes", timer: "ring", radius: 10, tilt: 0.6, lamp: "square", layout: "photo", rule: "Une seule bonne réponse !" },
};

export type ExtraitItem = {
  prompt: Prompt;
  /** question dite et affichée (« Quel est ce pays ? ») */
  ask: string;
  /** 3 propositions (absent : réponse libre, ou dilemme) */
  choices?: string[];
  correct?: number;
  answer: string;
  level: Level;
  fact?: string;
  voice?: { q?: VoiceClip; choices?: VoiceClip; a?: VoiceClip };
};
export type Extrait = { id: string; skin: SkinKey; /** variante du carton de titre : 0 ruban, 1 sticker géant, 2 typo plein écran */ sting?: number; items: ExtraitItem[]; voice?: { title?: VoiceClip; outro?: VoiceClip } };

const isDilemma = (it: ExtraitItem) => it.prompt.type === "choices";
const isQcm = (it: ExtraitItem) => it.prompt.type === "qcm";

export const extraitTimeline = (x: Extrait, fps: number) => {
  const s = (v: number) => Math.round(v * fps);
  let t = 0;
  const K = SKINS[x.skin];
  const sting = s(Math.max(K.rule ? 2.6 : 1.8, (x.voice?.title?.sec ?? 2.4) + 0.15));
  const stingFirst = K.layout === "chrono" || K.layout === "sticker";
  const items = x.items.map((it, i) => {
    const dil = isDilemma(it);
    const hook = dil ? 0 : s((it.voice?.q?.sec ?? 2.2) + 0.2);
    const stingDur = i === 0 ? sting : 0;
    const read = dil ? s((it.voice?.q?.sec ?? 3.4) + 0.15) : it.choices ? s((it.voice?.choices?.sec ?? 2.8) + 0.1) : s(0.2);
    const think = s(3);
    const reveal = dil ? s(1.3) : s(Math.max(1.6, (it.voice?.a?.sec ?? (it.fact ? 6 : 1.4)) + 0.45));
    // dilemme : pas d'accroche séparée, la virgule sonore ouvre la vidéo
    const seg = dil || stingFirst
      ? { sting: { from: t, dur: stingDur }, hook: { from: t + stingDur, dur: hook }, choices: { from: t + stingDur + hook, dur: read + think, read, think }, reveal: { from: t + stingDur + hook + read + think, dur: reveal } }
      : { hook: { from: t, dur: hook }, sting: { from: t + hook, dur: stingDur }, choices: { from: t + hook + stingDur, dur: read + think, read, think }, reveal: { from: t + hook + stingDur + read + think, dur: reveal } };
    t += hook + stingDur + read + think + reveal;
    return seg;
  });
  const outro = s((x.voice?.outro?.sec ?? 5) + 0.8);
  return { items, outro: { from: t, dur: outro }, total: t + outro };
};

// ---------- décors ----------
const themeOfSkin = (S: Skin): Theme => THEMES.find((t) => t.name === S.theme) ?? THEMES[0];
const Decor: React.FC<{ skin: SkinKey }> = ({ skin }) => { const S = SKINS[skin]; return S.theme ? <Background theme={themeOfSkin(S)} confetti={26} pattern={S.pattern} /> : <Rays />; };

// ---------- briques communes ----------
const title = (S: Skin, size: number, color = S.onBg, shadow = S.onBgShadow): React.CSSProperties => ({ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: size, color, lineHeight: 1.04, textShadow: `${Math.max(3, size / 22)}px ${Math.max(3, size / 22)}px 0 ${shadow}`, textAlign: "center" });
const box = (S: Skin, bg = S.card): React.CSSProperties => ({ background: bg, border: `8px solid ${S.ink}`, boxShadow: `12px 12px 0 ${S.ink}`, borderRadius: S.radius });
const Tint: React.FC<{ S: Skin; children: React.ReactNode; style?: React.CSSProperties }> = ({ S, children, style }) => <div style={{ filter: S.sepia ? "sepia(0.65) saturate(0.85) contrast(1.05)" : undefined, ...style }}>{children}</div>;
const Masthead: React.FC<{ S: Skin }> = ({ S }) => (
  <div style={{ position: "absolute", top: S.sepia ? 150 : 132, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
    {!S.sepia && <div style={{ marginBottom: 6 }}><Logo theme={themeOfSkin(S)} size={58} /></div>}
    <div style={{ background: S.main, color: S.card, fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: S.title.length > 16 ? 54 : 62, letterSpacing: 3, padding: "6px 46px", border: `6px solid ${S.ink}`, boxShadow: `8px 8px 0 ${S.sepia ? S.accent : S.ink}`, borderRadius: S.sepia ? 0 : Math.max(12, S.radius * 0.7), transform: `rotate(${-2 * S.tilt}deg)`, textTransform: "uppercase", whiteSpace: "nowrap" }}>{S.title}</div>
    {S.sepia && <div style={{ fontFamily: FONT_BODY, fontWeight: 600, fontSize: 32, color: S.onBg, fontStyle: "italic", marginTop: 8 }}><b style={{ color: S.main, fontStyle: "normal" }}>YouQwiz.com</b></div>}
  </div>
);
const Tagline: React.FC<{ S: Skin }> = ({ S }) => (
  <div style={{ position: "absolute", bottom: S.sepia ? 290 : 200, left: 50, right: 50, display: "flex", justifyContent: "center" }}>
    <div style={{ fontFamily: FONT_BODY, fontWeight: 600, fontStyle: "italic", fontSize: 34, color: S.card, background: S.ink, padding: "10px 30px", borderRadius: 40, border: `4px solid ${S.accent}`, textAlign: "center", whiteSpace: "nowrap" }}>{S.tagline}</div>
  </div>
);
const Lamps: React.FC<{ S: Skin; n: number; index: number; done: boolean }> = ({ S, n, index, done }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ position: "absolute", top: 338, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 30 }}>
      {Array.from({ length: n }, (_, i) => {
        const past = i < index || (i === index && done), cur = i === index && !done;
        return <div key={i} style={{ width: 84, height: 84, borderRadius: S.lamp === "square" ? 12 : 60, rotate: S.lamp === "star" ? `${[-8, 6, -4][i % 3]}deg` : S.lamp === "square" ? `${[-4, 3, -2][i % 3]}deg` : undefined, background: past ? S.second : cur ? S.main : S.alt, border: `6px solid ${S.ink}`, boxShadow: `5px 5px 0 ${S.ink}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 50, color: past || cur ? S.card : "rgba(0,0,0,0.4)", transform: cur ? `scale(${1.12 + 0.05 * Math.sin(frame / 4)})` : undefined }}>{past ? "✓" : i + 1}</div>;
      })}
    </div>
  );
};
const LEVEL_LABEL: Record<Level, string> = { facile: "Facile", moyen: "Moyen", difficile: "Difficile", impossible: "Pour les champions" };
const LevelStamp: React.FC<{ S: Skin; level: Level; top: number }> = ({ S, level, top }) => (
  <div style={{ position: "absolute", top, right: 36, transform: "rotate(5deg)", background: level === "facile" ? S.second : level === "impossible" ? S.ink : S.main, color: level === "impossible" ? S.accent : S.card, border: `6px solid ${S.ink}`, boxShadow: `6px 6px 0 ${S.ink}`, fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 42, letterSpacing: 2, textTransform: "uppercase", padding: "2px 22px", borderRadius: 10, zIndex: 3 }}>{LEVEL_LABEL[level]}</div>
);
const count = (v: string) => [...new Intl.Segmenter("fr", { granularity: "grapheme" }).segment(v)].filter((g) => g.segment.trim()).length;
const PromptBox: React.FC<{ S: Skin; p: Prompt; top: number; height: number; round?: boolean }> = ({ S, p, top, height, round }) => {
  const n = p.type === "emoji" ? count(p.value) : 1;
  const H = height - 70;
  if (round) {
    const d = height, w = d * 0.74;
    return (
      <div style={{ position: "absolute", top, left: (1080 - d) / 2, width: d, height: d, ...box(S), borderRadius: 9999, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        {p.type === "text" ? <FitText text={p.value} big={260} W={w} H={w * 0.6} color={S.ink} /> : p.type === "image" ? <Img src={staticFile(p.value)} style={{ maxWidth: w, maxHeight: w * 0.7, borderRadius: 18 }} /> : <PromptView prompt={p} theme={{ ...THEMES[0], accent: S.main, soft: S.alt }} big={p.type === "emoji" ? Math.min(d * 0.42, w / (n * 1.13)) : Math.min(300, d * 0.4)} vertical maxW={w} maxH={w} />}
      </div>
    );
  }
  return (
    <div style={{ position: "absolute", top, left: 60, right: 60, height, ...box(S), display: "flex", alignItems: "center", justifyContent: "center", transform: `rotate(${-S.tilt}deg)`, overflow: "hidden" }}>
      {p.type === "text" ? <FitText text={p.value} big={330} W={860} H={H} color={S.ink} /> : p.type === "image" ? <Img src={staticFile(p.value)} style={{ maxWidth: 860, maxHeight: H, borderRadius: 18 }} /> : <PromptView prompt={p} theme={{ ...THEMES[0], accent: S.main, soft: S.alt }} big={p.type === "emoji" ? Math.min(H * 0.82, 840 / (n * 1.13)) : Math.min(360, H * 0.8)} vertical maxW={840} maxH={H} />}
    </div>
  );
};
const ChoiceRows: React.FC<{ S: Skin; it: ExtraitItem; top: number; gap: number; h: number; revealed: boolean }> = ({ S, it, top, gap, h, revealed }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ position: "absolute", top, left: 70, right: 70, display: "flex", flexDirection: "column", gap }}>
      {it.choices!.slice(0, 3).map((c, i) => {
        const pop = revealed ? 1 : spring({ frame: frame - 4 - i * 7, fps, config: { damping: 12, stiffness: 170 } });
        const good = revealed && i === it.correct, bad = revealed && i !== it.correct;
        const wig = good && frame < 30 ? 1 + 0.05 * Math.sin(frame / 2) : 1;
        return (
          <div key={i} style={{ transform: `scale(${pop * wig}) rotate(${(i % 2 ? 1 : -1) * Math.min(1, S.tilt)}deg)`, opacity: bad ? 0.45 : 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 24, background: good ? S.main : S.card, border: `7px solid ${S.ink}`, boxShadow: `9px 9px 0 ${S.ink}`, borderRadius: Math.max(10, S.radius * 0.6), padding: "0 28px", height: h }}>
              <div style={{ width: h * 0.66, height: h * 0.66, flexShrink: 0, borderRadius: S.lamp === "square" ? 10 : 60, background: good ? S.card : [S.second, S.accent, S.main][i], border: `5px solid ${S.ink}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: h * 0.42, color: good ? S.main : i === 1 ? S.ink : S.card }}>{good ? "✓" : "ABC"[i]}</div>
              <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: (c.length > 26 ? 0.36 : c.length > 17 ? 0.44 : 0.54) * h, color: good ? S.card : S.ink, lineHeight: 1.05 }}>{c}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
// Décompte « amorce de film » de la Minute (cercle, croix, secteur qui tourne, chiffre).
const Leader: React.FC<{ S: Skin; top: number; size: number; elapsed: number; total: number }> = ({ S, top, size, elapsed, total }) => {
  const { fps } = useVideoConfig();
  const left = Math.max(1, Math.ceil((total - elapsed) / fps));
  if (S.theme) return <div style={{ position: "absolute", top, left: 0, right: 0, display: "flex", justifyContent: "center" }}><Countdown frame={elapsed} totalFrames={total} theme={themeOfSkin(S)} size={size} kind={S.timer} /></div>;
  return (
    <div style={{ position: "absolute", top, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
      <div style={{ width: size, height: size, borderRadius: 200, border: `10px solid ${S.ink}`, background: S.alt, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${1 + 0.06 * Math.sin((elapsed / fps) * Math.PI * 2)})` }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: "50%", height: 4, background: "rgba(0,0,0,0.3)" }} />
        <div style={{ position: "absolute", top: 0, bottom: 0, left: "50%", width: 4, background: "rgba(0,0,0,0.3)" }} />
        <div style={{ position: "absolute", inset: 0, borderRadius: 200, opacity: 0.55, background: `conic-gradient(${S.main} ${((elapsed % fps) / fps) * 360}deg, transparent 0deg)` }} />
        <div style={{ ...title(S, size * 0.68, S.ink, S.card), position: "relative", lineHeight: 1 }}>{left}</div>
      </div>
    </div>
  );
};
const FactCard: React.FC<{ S: Skin; text: string; top: number; at: number }> = ({ S, text, top, at }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame: frame - at, fps, config: { damping: 12, stiffness: 150 } });
  if (frame < at) return null;
  return (
    <div style={{ position: "absolute", top, left: 60, right: 60, transform: `scale(${pop}) rotate(-1deg)` }}>
      <div style={{ background: S.second, border: `7px solid ${S.ink}`, boxShadow: `10px 10px 0 ${S.ink}`, borderRadius: 18, padding: "18px 30px 22px" }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 40, color: S.accent, letterSpacing: 3, textTransform: "uppercase", textAlign: "center" }}>{S.tu ? "★ Le savais-tu ? ★" : "★ Le saviez-vous ? ★"}</div>
        <div style={{ fontFamily: FONT_BODY, fontWeight: 600, fontSize: text.length > 90 ? 40 : 46, color: "#FFFFFF", lineHeight: 1.16, textAlign: "center", marginTop: 6 }}>{nb(text)}</div>
      </div>
    </div>
  );
};

// ---------- briques des mises en page par pilier ----------
const TimeBar: React.FC<{ S: Skin; top: number; progress: number }> = ({ S, top, progress }) => (
  <div style={{ position: "absolute", top, left: 60, right: 60, height: 46, background: S.card, border: `7px solid ${S.ink}`, boxShadow: `7px 7px 0 ${S.ink}`, borderRadius: 30, overflow: "hidden" }}>
    <div style={{ width: `${(1 - progress) * 100}%`, height: "100%", background: progress > 0.66 ? "#FF3B3B" : S.accent, borderRight: progress < 1 ? `6px solid ${S.ink}` : undefined }} />
  </div>
);
const BigDigit: React.FC<{ S: Skin; top: number; size: number; elapsed: number; total: number }> = ({ S, top, size, elapsed, total }) => {
  const { fps } = useVideoConfig();
  const left = Math.max(1, Math.ceil((total - elapsed) / fps));
  const k = (elapsed % fps) / fps;
  return (
    <div style={{ position: "absolute", top, left: 0, right: 0, display: "flex", justifyContent: "center", transform: `scale(${1.25 - 0.25 * Math.min(1, k * 4)})` }}>
      <div style={{ ...title(S, size, left <= 1 ? "#FF3B3B" : S.accent, S.ink), lineHeight: 0.95, WebkitTextStroke: `8px ${S.ink}`, paintOrder: "stroke fill" }}>{left}</div>
    </div>
  );
};
const Polaroid: React.FC<{ S: Skin; top: number; height: number; text: string; n: number; size: number; cap: number; deg: number }> = ({ S, top, height, text, n, size, cap, deg }) => (
  <div style={{ position: "absolute", top, left: 80, right: 80, height, background: "#FFFFFF", border: `7px solid ${S.ink}`, boxShadow: `14px 14px 0 ${S.ink}`, transform: `rotate(${deg}deg)`, padding: "30px 30px 0", display: "flex", flexDirection: "column" }}>
    <div style={{ position: "absolute", top: -34, left: "50%", marginLeft: -110, width: 220, height: 58, background: "rgba(255,210,63,0.88)", border: `4px solid ${S.ink}`, transform: "rotate(-4deg)" }} />
    <div style={{ flex: 1, background: "linear-gradient(160deg,#FFE8B5 0%,#F7B267 100%)", border: `5px solid ${S.ink}`, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px 28px" }}>
      <div style={{ ...title(S, size, S.ink, "#FFFFFF"), textTransform: "uppercase" }}>{nb(text)}</div>
    </div>
    <div style={{ height: cap * 1.9, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_BODY, fontStyle: "italic", fontWeight: 600, fontSize: cap, color: S.main }}>Souvenir n° {n}</div>
  </div>
);

// ---------- scènes ----------
type Phase = "hook" | "choices" | "reveal";
const Stage: React.FC<{ x: Extrait; index: number; phase: Phase; read?: number; think?: number }> = ({ x, index, phase, read = 0, think = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const S = SKINS[x.skin];
  const it = x.items[index];
  const pop = spring({ frame, fps, config: { damping: 11, stiffness: 170 } });
  const revealed = phase === "reveal";
  const counting = phase === "choices" && frame >= read;
  const mascots = (top: number, size: number) => (
    <>
      <Tint S={S} style={{ position: "absolute", left: 60, top: top + 10 }}><Mascot which="poussin" size={size * 0.95} mood={revealed ? "cheer" : "idle"} /></Tint>
      <Tint S={S} style={{ position: "absolute", right: 60, top }}><Mascot which="chat" size={size} mood={revealed ? "cheer" : it.level === "impossible" ? "dare" : "idle"} /></Tint>
    </>
  );
  const askSize = (it.ask.length > 70 ? 50 : it.ask.length > 48 ? 58 : it.ask.length > 30 ? 66 : 78);

  // --- dilemme : deux cartes, décompte, « Et toi ? » ---
  if (isDilemma(it)) {
    const [a, b] = (it.prompt as { value: string[] }).value;
    const fs = (v: string) => (v.length > 44 ? 60 : v.length > 30 ? 70 : 84);
    if (S.layout === "camps") {
      const camps = [{ bg: "#1BB5A8", who: "poussin", name: "Team Poussin" }, { bg: "#FF4D8D", who: "chat", name: "Team Chat" }];
      return (
        <AbsoluteFill>
          <Lamps S={S} n={x.items.length} index={index} done={revealed} />
          <div style={{ position: "absolute", top: 428, left: 50, right: 50 }}><div style={title(S, 78)}>Tu préfères…</div></div>
          {[a, b].map((v, i) => {
            const inX = revealed ? 1 : spring({ frame: frame - 3 - i * 8, fps, config: { damping: 14, stiffness: 150 } });
            const tag: React.CSSProperties = i ? { bottom: -50, right: 90 } : { top: -50, left: 90 };
            return (
              <div key={i} style={{ position: "absolute", top: 580 + i * 500, left: -40, right: -40, height: 470, background: camps[i].bg, borderTop: `10px solid ${S.ink}`, borderBottom: `10px solid ${S.ink}`, transform: `translateX(${(1 - inX) * (i ? 1 : -1) * 1150}px) rotate(${i ? 1.5 : -1.5}deg)`, display: "flex", alignItems: "center", justifyContent: "center", padding: "50px 120px" }}>
                <div style={{ position: "absolute", ...tag, display: "flex", alignItems: "center", gap: 12, background: S.card, border: `6px solid ${S.ink}`, boxShadow: `6px 6px 0 ${S.ink}`, borderRadius: 60, padding: "6px 28px 6px 8px" }}>
                  <Img src={staticFile(`mascots/${camps[i].who}-head.png`)} style={{ width: 84, height: 84, objectFit: "contain" }} />
                  <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 44, color: S.ink, textTransform: "uppercase", whiteSpace: "nowrap" }}>{camps[i].name}</span>
                </div>
                <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: fs(v) + 8, color: "#FFFFFF", textAlign: "center", lineHeight: 1.08, textShadow: `4px 4px 0 ${S.ink}` }}><Rich text={v} size={fs(v) + 8} /></div>
              </div>
            );
          })}
          <div style={{ position: "absolute", top: 1065 - 110, left: 0, right: 0, height: 220, display: "flex", justifyContent: "center", alignItems: "center", zIndex: 3 }}>
            {revealed ? (
              <div style={{ ...box(S, S.accent), padding: "4px 60px", transform: `scale(${pop}) rotate(-3deg)`, ...title(S, 110, S.ink, S.card) }}>{nb("Et toi ?")}</div>
            ) : counting ? (
              <div style={{ width: 230, height: 230, borderRadius: 200, background: S.card, border: `8px solid ${S.ink}`, boxShadow: `8px 8px 0 ${S.ink}`, display: "flex", alignItems: "center", justifyContent: "center" }}><Countdown frame={frame - read} totalFrames={think} theme={themeOfSkin(S)} size={190} kind="ring" /></div>
            ) : (
              <div style={{ width: 170, height: 170, borderRadius: 100, background: S.accent, border: `8px solid ${S.ink}`, boxShadow: `8px 8px 0 ${S.ink}`, display: "flex", alignItems: "center", justifyContent: "center", ...title(S, 76, S.ink, S.card), textTransform: "uppercase", transform: `scale(${pop})` }}>ou</div>
            )}
          </div>
          <Tagline S={S} />
        </AbsoluteFill>
      );
    }
    return (
      <AbsoluteFill>
        <Lamps S={S} n={x.items.length} index={index} done={revealed} />
        <div style={{ position: "absolute", top: 446, left: 50, right: 50 }}><div style={title(S, 78)}>{S.tu ? "Tu préfères…" : "Vous préférez…"}</div></div>
        <div style={{ position: "absolute", top: 560, left: 60, right: 60, display: "flex", flexDirection: "column", alignItems: "center", transform: `scale(${0.85 + 0.15 * (revealed ? 1 : pop)})`, transformOrigin: "50% 40%" }}>
          {[a, b].map((v, i) => (
            <React.Fragment key={i}>
              {i > 0 && <div style={{ zIndex: 2, margin: "-28px 0", width: 132, height: 132, borderRadius: 80, background: S.accent, boxShadow: `6px 6px 0 ${S.ink}`, border: `8px solid ${S.ink}`, display: "flex", alignItems: "center", justifyContent: "center", ...title(S, 60, S.ink, S.card), textTransform: "uppercase" }}>ou</div>}
              <div style={{ ...box(S, i ? S.alt : S.card), width: "100%", height: 320, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px 36px", transform: `rotate(${i ? 1 : -1}deg)`, fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: fs(v), color: S.ink, textAlign: "center", lineHeight: 1.08 }}>
                <div><Rich text={v} size={fs(v)} /></div>
              </div>
            </React.Fragment>
          ))}
        </div>
        {counting && <Leader S={S} top={1310} size={230} elapsed={frame - read} total={think} />}
        {revealed && (
          <div style={{ position: "absolute", top: 1330, left: 0, right: 0, display: "flex", justifyContent: "center", transform: `scale(${pop}) rotate(-3deg)` }}>
            <div style={{ ...box(S, S.accent), padding: "10px 60px", ...title(S, 120, S.ink, S.card) }}>{nb(S.tu ? "Et toi ?" : "Et vous ?")}</div>
          </div>
        )}
        {mascots(1320, 200)}
        <Tagline S={S} />
      </AbsoluteFill>
    );
  }

  // --- QCM (pas d'image) : accroche et propositions exactement comme la Minute ---
  if (isQcm(it) && S.layout === "photo") {
    const L = it.ask.length;
    if (phase === "hook") return (
      <AbsoluteFill>
        <div style={{ position: "absolute", inset: 0, transform: `scale(${0.8 + 0.2 * pop})`, transformOrigin: "540px 880px", opacity: pop }}>
          <Polaroid S={S} top={450} height={860} text={it.ask} n={index + 1} size={L > 60 ? 80 : L > 40 ? 92 : 108} cap={58} deg={-3} />
          <LevelStamp S={S} level={it.level} top={420} />
        </div>
        {mascots(1380, 250)}
        <Tagline S={S} />
      </AbsoluteFill>
    );
    return (
      <AbsoluteFill>
        <Lamps S={S} n={x.items.length} index={index} done={revealed} />
        <Polaroid S={S} top={476} height={390} text={it.ask} n={index + 1} size={L > 60 ? 46 : L > 40 ? 54 : 64} cap={36} deg={-1.5} />
        <ChoiceRows S={S} it={it} top={920} gap={28} h={146} revealed={revealed} />
        {counting && <Leader S={S} top={1432} size={215} elapsed={frame - read} total={think} />}
        {!(revealed && it.fact) && mascots(1435, 215)}
        {revealed && it.fact && <FactCard S={S} text={it.fact} top={1432} at={Math.round(((it.voice?.a?.sec ?? 6) * (it.answer.length + 14)) / (it.answer.length + 14 + it.fact.length) * fps)} />}
        {!(revealed && it.fact) && <Tagline S={S} />}
      </AbsoluteFill>
    );
  }
  if (isQcm(it)) {
    if (phase === "hook") {
      const size = it.ask.length > 60 ? 84 : it.ask.length > 40 ? 96 : 110;
      return (
        <AbsoluteFill>
          <div style={{ position: "absolute", top: 380, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
            <div style={{ width: 330, height: 330, borderRadius: 200, background: S.accent, border: `10px solid ${S.ink}`, boxShadow: `12px 12px 0 ${S.ink}`, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${pop}) rotate(${Math.sin(frame / 6) * 8}deg)` }}>
              <div style={{ ...title(S, 250, S.main, S.ink), lineHeight: 1 }}>{index === 0 ? "?" : index + 1}</div>
            </div>
          </div>
          <div style={{ position: "absolute", top: 770, left: 70, right: 70, transform: `scale(${0.6 + 0.4 * pop})`, opacity: pop }}>
            <div style={{ ...box(S), padding: "44px 40px" }}><div style={{ ...title(S, size, S.ink, S.accent), textTransform: "uppercase" }}>{nb(it.ask)}</div></div>
          </div>
          <LevelStamp S={S} level={it.level} top={736} />
          {mascots(1290, 240)}
          <Tagline S={S} />
        </AbsoluteFill>
      );
    }
    return (
      <AbsoluteFill>
        <Lamps S={S} n={x.items.length} index={index} done={revealed} />
        <div style={{ position: "absolute", top: 450, left: 60, right: 60, height: 190, display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ ...title(S, it.ask.length > 60 ? 54 : 64), textTransform: "uppercase" }}>{nb(it.ask)}</div></div>
        <ChoiceRows S={S} it={it} top={670} gap={36} h={150} revealed={revealed} />
        {counting && <Leader S={S} top={1296} size={240} elapsed={frame - read} total={think} />}
        {!S.sepia && !(revealed && it.fact) && mascots(1300, 230)}
        {revealed && it.fact ? <FactCard S={S} text={it.fact} top={1270} at={Math.round(((it.voice?.a?.sec ?? 6) * (it.answer.length + 14)) / (it.answer.length + 14 + it.fact.length) * fps)} /> : <Tagline S={S} />}
      </AbsoluteFill>
    );
  }

  // --- image / émojis / texte : la carte d'abord (accroche), puis les 3 propositions dessous ---
  const hasChoices = !!it.choices;
  const small = phase !== "hook" && hasChoices;
  if (S.layout === "chrono" || S.layout === "sticker") {
    const round = S.layout === "sticker";
    const pH = round ? (small ? 440 : 780) : small ? 340 : 720;
    const rowsTop = round ? 1024 : 1000;
    const fact = revealed && !!it.fact;
    return (
      <AbsoluteFill>
        <Lamps S={S} n={x.items.length} index={index} done={revealed} />
        <div style={{ position: "absolute", top: 444, left: 50, right: 50, height: 96, display: "flex", alignItems: "center", justifyContent: "center" }}><div style={title(S, Math.min(askSize, 72))}>{nb(it.ask)}</div></div>
        <div style={{ position: "absolute", inset: 0, transform: phase === "hook" ? `scale(${0.8 + 0.2 * pop})` : undefined, transformOrigin: "540px 900px", opacity: phase === "hook" ? pop : 1 }}>
          <PromptBox S={S} p={it.prompt} top={562} height={pH} round={round} />
          <LevelStamp S={S} level={it.level} top={532} />
        </div>
        {!round && phase !== "hook" && <TimeBar S={S} top={small ? 926 : 1306} progress={counting ? Math.min(1, (frame - read) / think) : revealed ? 1 : 0} />}
        {small && <ChoiceRows S={S} it={it} top={rowsTop} gap={22} h={128} revealed={revealed} />}
        {counting && (round
          ? <div style={{ position: "absolute", top: 562 + pH - (small ? 190 : 250), left: 540 + pH / 2 - (small ? 150 : 210) }}><div style={{ borderRadius: 200, background: S.card, border: `8px solid ${S.ink}`, boxShadow: `8px 8px 0 ${S.ink}`, padding: 10 }}><Countdown frame={frame - read} totalFrames={think} theme={themeOfSkin(S)} size={small ? 200 : 240} kind="pie" /></div></div>
          : <BigDigit S={S} top={small ? 1440 : 1376} size={small ? 220 : 270} elapsed={frame - read} total={think} />)}
        {!fact && !(revealed && !hasChoices) && mascots(small ? 1452 : 1396, small ? 205 : 250)}
        {revealed && !hasChoices && (
          <div style={{ position: "absolute", top: round ? 1368 : 1384, left: 50, right: 50, transform: `scale(${pop}) rotate(-2deg)` }}>
            <div style={{ ...box(S, S.main), padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 230 }}><div style={title(S, it.answer.length > 26 ? 60 : it.answer.length > 16 ? 84 : 120, S.card, S.ink)}>{nb(it.answer)}</div></div>
          </div>
        )}
        {fact && hasChoices ? <FactCard S={S} text={it.fact!} top={1440} at={Math.round(((it.voice?.a?.sec ?? 6) * (it.answer.length + 14)) / (it.answer.length + 14 + it.fact!.length) * fps)} /> : <Tagline S={S} />}
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill>
      <Lamps S={S} n={x.items.length} index={index} done={revealed} />
      <div style={{ position: "absolute", top: 444, left: 50, right: 50, height: 96, display: "flex", alignItems: "center", justifyContent: "center" }}><div style={title(S, Math.min(askSize, 72))}>{nb(it.ask)}</div></div>
      <div style={{ position: "absolute", inset: 0, transform: phase === "hook" ? `scale(${0.8 + 0.2 * pop})` : undefined, transformOrigin: "540px 860px", opacity: phase === "hook" ? pop : 1 }}>
        <PromptBox S={S} p={it.prompt} top={566} height={small ? 330 : 640} />
        <LevelStamp S={S} level={it.level} top={532} />
      </div>
      {small && <ChoiceRows S={S} it={it} top={928} gap={24} h={112} revealed={revealed} />}
      {counting && <Leader S={S} top={hasChoices ? 1350 : 1296} size={hasChoices ? 200 : 240} elapsed={frame - read} total={think} />}
      {!small && !revealed && mascots(1300, 220)}
      {small && !S.sepia && !(revealed && it.fact) && mascots(1330, 230)}
      {revealed && !hasChoices && (
        <div style={{ position: "absolute", top: 1262, left: 50, right: 50, transform: `scale(${pop}) rotate(-2deg)` }}>
          <div style={{ ...box(S, S.main), padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 220 }}><div style={title(S, it.answer.length > 26 ? 60 : it.answer.length > 16 ? 84 : 120, S.card, S.ink)}>{nb(it.answer)}</div></div>
        </div>
      )}
      {revealed && it.fact && hasChoices ? <FactCard S={S} text={it.fact} top={1340} at={Math.round(((it.voice?.a?.sec ?? 6) * (it.answer.length + 14)) / (it.answer.length + 14 + it.fact.length) * fps)} /> : <Tagline S={S} />}
    </AbsoluteFill>
  );
};

// Carton de titre (11/11/2026 soir) : titre en lettres sticker, « YouQwiz.com », règle du jeu, mascottes.
// 3 variantes : 0 ruban en biais plein cadre, 1 sticker géant, 2 typo plein écran.
const fit = (w: string, max: number, W = 940) => Math.min(max, Math.floor(W / (Math.max(w.length, 2) * 0.62)));
const Sting: React.FC<{ S: Skin; dur: number; variant?: number }> = ({ S, dur, variant = 2 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sp = (d: number, damping = 11) => spring({ frame: frame - d, fps, config: { damping, stiffness: 150 } });
  const pop = sp(0, 12), pop2 = sp(8), pop3 = sp(14, 9), pop4 = sp(20, 10);
  const out = interpolate(frame, [dur - 6, dur], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const words = S.title.split(" ");
  const lines = [words.slice(0, -2).join(" "), words.at(-2) ?? "", words.at(-1) ?? ""].filter(Boolean);
  const brand = (top: number, size = 92) => (
    <div style={{ position: "absolute", top, left: 0, right: 0, display: "flex", justifyContent: "center", transform: `scale(${pop2}) rotate(2deg)`, zIndex: 4 }}>
      <div style={{ background: S.card, border: `8px solid ${S.ink}`, boxShadow: `10px 10px 0 ${S.ink}`, padding: "2px 50px", borderRadius: S.sepia ? 0 : 70, fontFamily: FONT_DISPLAY, fontSize: size, lineHeight: 1.25, whiteSpace: "nowrap" }}>
        <span style={{ fontWeight: 600, color: S.ink }}>You</span><span style={{ fontWeight: 800, color: S.main }}>Qwiz</span><span style={{ fontWeight: 600, color: S.ink }}>.com</span>
      </div>
    </div>
  );
  const rule = (top: number) => S.rule && (
    <div style={{ position: "absolute", top, left: 60, right: 60, display: "flex", justifyContent: "center", transform: `scale(${pop3})`, zIndex: 4 }}>
      <div style={{ background: S.ink, border: `7px solid ${S.accent}`, borderRadius: 40, padding: "12px 40px 20px", textAlign: "center" }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 36, color: S.accent, letterSpacing: 5 }}>LA RÈGLE</div>
        <div style={{ fontFamily: FONT_BODY, fontWeight: 600, fontSize: 62, color: "#FFFFFF", lineHeight: 1.14 }}>{nb(S.rule)}</div>
      </div>
    </div>
  );
  const pals = (top: number, size: number, inset: number) => !S.sepia && (
    <>
      <Tint S={S} style={{ position: "absolute", left: inset, top: top + 14, transform: `scale(${pop4})`, zIndex: 5 }}><Mascot which="poussin" size={size * 0.94} mood="cheer" /></Tint>
      <Tint S={S} style={{ position: "absolute", right: inset, top, transform: `scale(${pop4})`, zIndex: 5 }}><Mascot which="chat" size={size} mood="cheer" /></Tint>
    </>
  );
  if (variant === 1) {
    // sticker géant : carte blanche penchée, mots empilés en couleurs, mascottes posées sur les coins du bas
    const sizes = lines.map((l) => (l.length <= 2 ? 230 : fit(l, 190, 800)));
    const H = sizes.reduce((a, v) => a + v * 0.98, 0) + 150;
    const cols = [S.ink, S.main, S.second];
    return (
      <AbsoluteFill style={{ opacity: out }}>
        {brand(330, 84)}
        <div style={{ position: "absolute", top: 420, left: 70, right: 70, height: H, background: S.card, border: `12px solid ${S.ink}`, boxShadow: `22px 22px 0 ${S.main}, 22px 22px 0 12px ${S.ink}`, borderRadius: 80, transform: `scale(${pop}) rotate(-3deg)`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingTop: 50, textTransform: "uppercase" }}>
          {lines.map((l, i) => <div key={i} style={{ ...title(S, sizes[i], cols[(i + 3 - lines.length) % 3], S.accent), lineHeight: 0.98 }}>{l}</div>)}
        </div>
        {pals(420 + H - 150, 250, 20)}
        {rule(420 + H + 150)}
      </AbsoluteFill>
    );
  }
  if (variant === 2) {
    // typo plein écran : chaque mot remplit la largeur, entre par un côté, double ombre
    const sizes = lines.map((l) => (l.length <= 2 ? 300 : fit(l, 250, 1000)));
    let y = 480;
    const tops = sizes.map((v) => { const t = y; y += v * 0.92; return t; });
    return (
      <AbsoluteFill style={{ opacity: out }}>
        {lines.map((l, i) => {
          const inn = sp(i * 5, 13);
          return <div key={i} style={{ position: "absolute", top: tops[i], left: 0, right: 0, textAlign: "center", fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: sizes[i], lineHeight: 1, textTransform: "uppercase", color: i === lines.length - 1 ? S.accent : "#FFFFFF", WebkitTextStroke: `10px ${S.ink}`, paintOrder: "stroke fill", textShadow: `10px 10px 0 ${S.ink}, 20px 20px 0 ${S.second}`, transform: `translateX(${(1 - inn) * (i % 2 ? 1100 : -1100)}px) rotate(${i % 2 ? 2 : -3}deg)` }}>{l}</div>;
        })}
        {brand(y + 60)}
        {rule(y + 250)}
        {pals(215, 250, 150)}
      </AbsoluteFill>
    );
  }
  // 0 : ruban en biais plein cadre
  const sizes = lines.map((l) => (l.length <= 2 ? 190 : fit(l, 190, 900)));
  const H = sizes.reduce((a, v) => a + v * 0.98, 0) + 100;
  const top = S.rule ? 470 : 400;
  return (
    <AbsoluteFill style={{ opacity: out }}>
      <div style={{ position: "absolute", top: top + 26, left: -120, right: -120, height: H, background: S.accent, border: `10px solid ${S.ink}`, transform: `translateX(${(1 - pop) * 1300}px) rotate(-6deg)` }} />
      <div style={{ position: "absolute", top, left: -120, right: -120, height: H, background: S.main, border: `10px solid ${S.ink}`, transform: `translateX(${(1 - pop) * -1300}px) rotate(-6deg)`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textTransform: "uppercase" }}>
        {lines.map((l, i) => <div key={i} style={{ ...title(S, sizes[i], i === lines.length - 1 ? S.accent : S.card, S.ink), lineHeight: 0.98 }}>{l}</div>)}
      </div>
      {brand(top + H + 80)}
      {rule(top + H + 262)}
      {S.rule ? pals(top - 200, 240, 110) : pals(top + H + 270, 310, 150)}
    </AbsoluteFill>
  );
};
// Fin de la Minute, version « chaîne YouTube » : « Vous en voulez encore ? » + abonnement + rappel du site.
const Outro: React.FC<{ S: Skin }> = ({ S }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = spring({ frame, fps, config: { damping: 10, stiffness: 150 } });
  const b = spring({ frame: frame - 14, fps, config: { damping: 9, stiffness: 140 } });
  const c = spring({ frame: frame - 30, fps, config: { damping: 8, stiffness: 160 } });
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", top: 390, left: 60, right: 60, transform: `scale(${a}) rotate(-3deg)` }}>
        <div style={{ ...title(S, 108, S.sepia ? S.main : S.accent, S.ink), textTransform: "uppercase" }}>{nb(S.tu ? "Tu en veux encore ?" : "Vous en voulez encore ?")}</div>
      </div>
      <div style={{ position: "absolute", top: 660, left: 80, right: 80, opacity: a }}>
        <div style={{ fontFamily: FONT_BODY, fontWeight: 600, fontSize: 54, color: S.onBg, textAlign: "center", lineHeight: 1.15, textShadow: S.sepia ? undefined : `3px 3px 0 ${S.onBgShadow}` }}>Chaque soir à 17 h 30, le grand quiz sur</div>
      </div>
      <div style={{ position: "absolute", top: 830, left: 60, right: 60, transform: `scale(${b})` }}>
        <div style={{ background: S.card, border: `9px solid ${S.ink}`, boxShadow: `14px 14px 0 ${S.main === S.ink ? S.accent : S.main}`, borderRadius: 20, padding: "22px 10px" }}><div style={title(S, 100, S.ink, S.accent)}>YouTube · YouQwiz</div></div>
      </div>
      <div style={{ position: "absolute", top: 1030, left: 0, right: 0, display: "flex", justifyContent: "center", transform: `scale(${c}) rotate(-4deg)` }}>
        <div style={{ border: `8px double ${S.sepia ? S.main : S.ink}`, color: S.sepia ? S.main : S.ink, fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 60, padding: "2px 28px", letterSpacing: 4, background: S.sepia ? "rgba(244,231,198,0.95)" : S.accent, borderRadius: 10 }}>{S.tu ? "ABONNE-TOI" : "ABONNEZ-VOUS"}</div>
      </div>
      <div style={{ position: "absolute", top: 1170, left: 90, right: 90, opacity: c }}>
        <div style={{ fontFamily: FONT_BODY, fontWeight: 600, fontStyle: "italic", fontSize: 44, color: "#FFFFFF", background: S.second, border: `6px solid ${S.ink}`, borderRadius: 50, padding: "16px 30px", textAlign: "center" }}>Et tous nos quiz, gratuits, sur YouQwiz.com</div>
      </div>
      <Tint S={S} style={{ position: "absolute", left: 130, top: 1310 }}><Mascot which="chat" size={270} mood="cheer" /></Tint>
      <Tint S={S} style={{ position: "absolute", right: 130, top: 1330 }}><Mascot which="poussin" size={240} mood="cheer" /></Tint>
    </AbsoluteFill>
  );
};

export const ShortExtrait: React.FC<{ extrait: Extrait }> = ({ extrait: x }) => {
  const { fps } = useVideoConfig();
  const T = extraitTimeline(x, fps);
  const S = SKINS[x.skin];
  return (
    <AbsoluteFill style={{ fontFamily: FONT_BODY }}>
      <style>{fontFaces()}</style>
      <Decor skin={x.skin} />
      {S.sepia && has("crackle") && <Audio src={staticFile("audio/crackle.mp3")} volume={0.5} loop />}
      {T.items.map((s, i) => {
        const it = x.items[i], dil = isDilemma(it);
        return (
          <React.Fragment key={i}>
            {s.hook.dur > 0 && (
              <Sequence from={s.hook.from} durationInFrames={s.hook.dur} name={`Q${i + 1} accroche`}>
                {i > 0 && has("whoosh") && <Audio src={staticFile("audio/whoosh.mp3")} volume={0.35} />}
                <Voice clip={it.voice?.q} from={3} />
                <Masthead S={S} />
                <Stage x={x} index={i} phase="hook" />
              </Sequence>
            )}
            {s.sting.dur > 0 && (
              <Sequence from={s.sting.from} durationInFrames={s.sting.dur} name="Virgule">
                {has("fanfare") && <Audio src={staticFile("audio/fanfare.mp3")} volume={0.35} />}
                <Voice clip={x.voice?.title} from={4} />
                <Sting S={S} dur={s.sting.dur} variant={x.sting} />
                <Tagline S={S} />
              </Sequence>
            )}
            <Sequence from={s.choices.from} durationInFrames={s.choices.dur} name={`Q${i + 1} choix`}>
              <Voice clip={dil ? it.voice?.q : it.voice?.choices} from={3} />
              {has("tick") && [0, 1, 2].map((k) => (
                <Sequence key={k} from={s.choices.read + k * fps} durationInFrames={fps} layout="none"><Audio src={staticFile("audio/tick.mp3")} volume={0.5} /></Sequence>
              ))}
              <Masthead S={S} />
              <Stage x={x} index={i} phase="choices" read={s.choices.read} think={s.choices.think} />
            </Sequence>
            <Sequence from={s.reveal.from} durationInFrames={s.reveal.dur} name={`Q${i + 1} réponse`}>
              {has(dil ? "pop" : "ding") && <Audio src={staticFile(`audio/${dil ? "pop" : "ding"}.mp3`)} volume={0.5} />}
              <Voice clip={it.voice?.a} from={4} />
              <Masthead S={S} />
              <Stage x={x} index={i} phase="reveal" />
            </Sequence>
          </React.Fragment>
        );
      })}
      <Sequence from={T.outro.from} durationInFrames={T.outro.dur} name="Fin">
        {has("pop") && <Audio src={staticFile("audio/pop.mp3")} volume={0.5} />}
        <Voice clip={x.voice?.outro} from={6} />
        <Masthead S={S} />
        <Outro S={S} />
        <Tagline S={S} />
      </Sequence>
      {S.sepia && <FilmWear />}
    </AbsoluteFill>
  );
};
