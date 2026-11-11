// Shorts extraits v3 (11/11/2026) : la mécanique de « La minute culture générale », appliquée aux épisodes du jour.
// Déroulé (codes de la Minute) : la question tout de suite (dite et affichée) → virgule sonore avec le titre de la rubrique →
// 3 propositions lues une à une + décompte 3 s → réponse (+ anecdote d'une traite) ; 3 questions de difficulté croissante ;
// fin « Vous en voulez encore ? ». Un habillage par pilier (skin) : réclame (culture générale, comme la Minute), plateau télé
// (devine), pop (émojis), duel (tu préfères). La mise en page est commune, seuls décor, couleurs, titres et ton changent.
import React from "react";
import { AbsoluteFill, Audio, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import audioManifest from "./audio.json";
import { Background, FitText, Mascot, PromptView, Rich, Voice } from "./components";
import { BASELINE, FilmWear, Rays, nb } from "./MinuteCulture";
import { FONT_BODY, FONT_DISPLAY, THEMES, fontFaces } from "./theme";
import type { Level, Prompt, VoiceClip } from "./types";

const has = (k: string) => Boolean((audioManifest as Record<string, unknown>)[k]);

export type SkinKey = "reclame" | "plateau" | "pop" | "duel";
type Skin = {
  title: string; // rubrique (bandeau du haut, virgule sonore)
  tagline: string; // bandeau du bas
  card: string; alt: string; ink: string; main: string; accent: string; second: string;
  /** couleur des textes posés directement sur le décor, et leur ombre */
  onBg: string; onBgShadow: string;
  tu: boolean; // tutoiement (chaîne) ou vouvoiement (réclame)
  sepia: boolean;
};
export const SKINS: Record<SkinKey, Skin> = {
  reclame: { title: "Le quiz express", tagline: `« ${BASELINE} »`, card: "#F4E7C6", alt: "#EBD9AE", ink: "#2B1B12", main: "#C8372D", accent: "#E0A526", second: "#1F6F78", onBg: "#2B1B12", onBgShadow: "#E0A526", tu: false, sepia: true },
  plateau: { title: "Le défi du jour", tagline: "Chaque soir, le grand quiz sur la chaîne YouQwiz", card: "#FFFFFF", alt: "#E9ECFF", ink: "#0B0D2E", main: "#FF2E63", accent: "#FFD23F", second: "#08B8B5", onBg: "#FFFFFF", onBgShadow: "#0B0D2E", tu: true, sepia: false },
  pop: { title: "Décode les émojis", tagline: "Chaque soir, le grand quiz sur la chaîne YouQwiz", card: "#FFFFFF", alt: "#FFF3CC", ink: "#1A1030", main: "#E6399B", accent: "#FFD23F", second: "#1BB5A8", onBg: "#1A1030", onBgShadow: "#FFFFFF", tu: true, sepia: false },
  duel: { title: "Le dilemme du jour", tagline: "Chaque soir, le grand quiz sur la chaîne YouQwiz", card: "#FFFFFF", alt: "#FFF3CC", ink: "#1A1033", main: "#1A1033", accent: "#FFE14D", second: "#19C6B7", onBg: "#FFFFFF", onBgShadow: "#1A1033", tu: true, sepia: false },
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
export type Extrait = { id: string; skin: SkinKey; items: ExtraitItem[]; voice?: { title?: VoiceClip; outro?: VoiceClip } };

const isDilemma = (it: ExtraitItem) => it.prompt.type === "choices";
const isQcm = (it: ExtraitItem) => it.prompt.type === "qcm";

export const extraitTimeline = (x: Extrait, fps: number) => {
  const s = (v: number) => Math.round(v * fps);
  let t = 0;
  const sting = s(Math.max(1.8, (x.voice?.title?.sec ?? 2.4) + 0.15));
  const items = x.items.map((it, i) => {
    const dil = isDilemma(it);
    const hook = dil ? 0 : s((it.voice?.q?.sec ?? 2.2) + 0.2);
    const stingDur = i === 0 ? sting : 0;
    const read = dil ? s((it.voice?.q?.sec ?? 3.4) + 0.15) : it.choices ? s((it.voice?.choices?.sec ?? 2.8) + 0.1) : s(0.2);
    const think = s(3);
    const reveal = dil ? s(1.3) : s(Math.max(1.6, (it.voice?.a?.sec ?? (it.fact ? 6 : 1.4)) + 0.45));
    // dilemme : pas d'accroche séparée, la virgule sonore ouvre la vidéo
    const seg = dil
      ? { sting: { from: t, dur: stingDur }, hook: { from: t + stingDur, dur: 0 }, choices: { from: t + stingDur, dur: read + think, read, think }, reveal: { from: t + stingDur + read + think, dur: reveal } }
      : { hook: { from: t, dur: hook }, sting: { from: t + hook, dur: stingDur }, choices: { from: t + hook + stingDur, dur: read + think, read, think }, reveal: { from: t + hook + stingDur + read + think, dur: reveal } };
    t += hook + stingDur + read + think + reveal;
    return seg;
  });
  const outro = s((x.voice?.outro?.sec ?? 5) + 0.8);
  return { items, outro: { from: t, dur: outro }, total: t + outro };
};

// ---------- décors ----------
const Plateau: React.FC = () => {
  const frame = useCurrentFrame();
  const bulbs = Array.from({ length: 44 }, (_, i) => i);
  return (
    <AbsoluteFill style={{ background: "radial-gradient(circle at 50% 42%, #3A3FB8 0%, #1B1F5C 45%, #0B0D2E 100%)", overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 540 - 1600, top: 820 - 1600, width: 3200, height: 3200, transform: `rotate(${frame * 0.25}deg)`, background: "repeating-conic-gradient(rgba(255,255,255,0.07) 0deg 9deg, transparent 9deg 30deg)" }} />
      {bulbs.map((i) => {
        const side = i % 2, k = Math.floor(i / 2), on = (k + Math.floor(frame / 8)) % 3 === 0;
        return <div key={i} style={{ position: "absolute", left: side ? 1034 : 18, top: 60 + k * 82, width: 28, height: 28, borderRadius: 20, background: on ? "#FFD23F" : "#7A6420", boxShadow: on ? "0 0 22px 6px rgba(255,210,63,0.7)" : undefined }} />;
      })}
    </AbsoluteFill>
  );
};
const Duel: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: "#3C6BFF", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, background: "#FF5A3C", clipPath: `polygon(0 0, 100% 0, 100% ${40 + Math.sin(frame / 40) * 2}%, 0 ${56 + Math.sin(frame / 40) * 2}%)` }} />
      <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(115deg, rgba(255,255,255,0.07) 0 40px, transparent 40px 120px)", transform: `translateX(${(frame % 120) - 60}px)` }} />
      <AbsoluteFill style={{ boxShadow: "inset 0 0 240px 40px rgba(26,16,51,0.45)" }} />
    </AbsoluteFill>
  );
};
const POP_THEME = THEMES.find((t) => t.name === "bonbon") ?? THEMES[0];
const Decor: React.FC<{ skin: SkinKey }> = ({ skin }) => (skin === "reclame" ? <Rays /> : skin === "plateau" ? <Plateau /> : skin === "duel" ? <Duel /> : <Background theme={POP_THEME} confetti={26} pattern="stars" />);

// ---------- briques communes ----------
const title = (S: Skin, size: number, color = S.onBg, shadow = S.onBgShadow): React.CSSProperties => ({ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: size, color, lineHeight: 1.04, textShadow: `${Math.max(3, size / 22)}px ${Math.max(3, size / 22)}px 0 ${shadow}`, textAlign: "center" });
const box = (S: Skin, bg = S.card): React.CSSProperties => ({ background: bg, border: `8px solid ${S.ink}`, boxShadow: `12px 12px 0 ${S.ink}`, borderRadius: 22 });
const Tint: React.FC<{ S: Skin; children: React.ReactNode; style?: React.CSSProperties }> = ({ S, children, style }) => <div style={{ filter: S.sepia ? "sepia(0.65) saturate(0.85) contrast(1.05)" : undefined, ...style }}>{children}</div>;
const Masthead: React.FC<{ S: Skin }> = ({ S }) => (
  <div style={{ position: "absolute", top: 150, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
    <div style={{ background: S.main, color: S.card, fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: S.title.length > 16 ? 54 : 62, letterSpacing: 3, padding: "6px 46px", border: `6px solid ${S.ink}`, boxShadow: `8px 8px 0 ${S.accent === S.card ? S.ink : S.accent}`, transform: "rotate(-2deg)", textTransform: "uppercase", whiteSpace: "nowrap" }}>{S.title}</div>
    <div style={{ fontFamily: FONT_BODY, fontWeight: 600, fontSize: 32, color: S.onBg, fontStyle: "italic", marginTop: 8 }}>{S.tu ? "offert par " : "offert par "}<b style={{ color: S.sepia ? S.main : S.accent === "#FFD23F" && S.onBg !== "#FFFFFF" ? S.main : S.accent, fontStyle: "normal" }}>YouQwiz.com</b></div>
  </div>
);
const Tagline: React.FC<{ S: Skin }> = ({ S }) => (
  <div style={{ position: "absolute", bottom: 290, left: 50, right: 50, display: "flex", justifyContent: "center" }}>
    <div style={{ fontFamily: FONT_BODY, fontWeight: 600, fontStyle: "italic", fontSize: 34, color: S.card, background: S.ink, padding: "10px 30px", borderRadius: 40, border: `4px solid ${S.accent}`, textAlign: "center", whiteSpace: "nowrap" }}>{S.tagline}</div>
  </div>
);
const Lamps: React.FC<{ S: Skin; n: number; index: number; done: boolean }> = ({ S, n, index, done }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ position: "absolute", top: 338, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 30 }}>
      {Array.from({ length: n }, (_, i) => {
        const past = i < index || (i === index && done), cur = i === index && !done;
        return <div key={i} style={{ width: 84, height: 84, borderRadius: 60, background: past ? S.second : cur ? S.main : S.alt, border: `6px solid ${S.ink}`, boxShadow: `5px 5px 0 ${S.ink}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 50, color: past || cur ? S.card : "rgba(0,0,0,0.4)", transform: cur ? `scale(${1.12 + 0.05 * Math.sin(frame / 4)})` : undefined }}>{past ? "✓" : i + 1}</div>;
      })}
    </div>
  );
};
const LEVEL_LABEL: Record<Level, string> = { facile: "Facile", moyen: "Moyen", difficile: "Difficile", impossible: "Pour les champions" };
const LevelStamp: React.FC<{ S: Skin; level: Level; top: number }> = ({ S, level, top }) => (
  <div style={{ position: "absolute", top, right: 36, transform: "rotate(5deg)", background: level === "facile" ? S.second : level === "impossible" ? S.ink : S.main, color: level === "impossible" ? S.accent : S.card, border: `6px solid ${S.ink}`, boxShadow: `6px 6px 0 ${S.ink}`, fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 42, letterSpacing: 2, textTransform: "uppercase", padding: "2px 22px", borderRadius: 10, zIndex: 3 }}>{LEVEL_LABEL[level]}</div>
);
const count = (v: string) => [...new Intl.Segmenter("fr", { granularity: "grapheme" }).segment(v)].filter((g) => g.segment.trim()).length;
const PromptBox: React.FC<{ S: Skin; p: Prompt; top: number; height: number }> = ({ S, p, top, height }) => {
  const n = p.type === "emoji" ? count(p.value) : 1;
  const H = height - 70;
  return (
    <div style={{ position: "absolute", top, left: 60, right: 60, height, ...box(S), display: "flex", alignItems: "center", justifyContent: "center", transform: "rotate(-1deg)", overflow: "hidden" }}>
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
          <div key={i} style={{ transform: `scale(${pop * wig}) rotate(${i % 2 ? 1 : -1}deg)`, opacity: bad ? 0.45 : 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 24, background: good ? S.main : S.card, border: `7px solid ${S.ink}`, boxShadow: `9px 9px 0 ${S.ink}`, borderRadius: 16, padding: "0 28px", height: h }}>
              <div style={{ width: h * 0.66, height: h * 0.66, flexShrink: 0, borderRadius: 60, background: good ? S.card : [S.second, S.accent, S.main][i], border: `5px solid ${S.ink}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: h * 0.42, color: good ? S.main : i === 1 ? S.ink : S.card }}>{good ? "✓" : "ABC"[i]}</div>
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
    return (
      <AbsoluteFill>
        <Lamps S={S} n={x.items.length} index={index} done={revealed} />
        <div style={{ position: "absolute", top: 446, left: 50, right: 50 }}><div style={title(S, 78)}>{S.tu ? "Tu préfères…" : "Vous préférez…"}</div></div>
        <div style={{ position: "absolute", top: 560, left: 60, right: 60, display: "flex", flexDirection: "column", alignItems: "center", transform: `scale(${0.85 + 0.15 * (revealed ? 1 : pop)})`, transformOrigin: "50% 40%" }}>
          {[a, b].map((v, i) => (
            <React.Fragment key={i}>
              {i > 0 && <div style={{ zIndex: 2, margin: "-28px 0", width: 132, height: 132, borderRadius: 80, background: S.accent, border: `8px solid ${S.ink}`, display: "flex", alignItems: "center", justifyContent: "center", ...title(S, 60, S.ink, S.card), textTransform: "uppercase" }}>ou</div>}
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
        {revealed && it.fact ? <FactCard S={S} text={it.fact} top={1270} at={Math.round(((it.voice?.a?.sec ?? 6) * (it.answer.length + 14)) / (it.answer.length + 14 + it.fact.length) * fps)} /> : <Tagline S={S} />}
      </AbsoluteFill>
    );
  }

  // --- image / émojis / texte : la carte d'abord (accroche), puis les 3 propositions dessous ---
  const hasChoices = !!it.choices;
  const small = phase !== "hook" && hasChoices;
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
      {revealed && !hasChoices && (
        <div style={{ position: "absolute", top: 1262, left: 50, right: 50, transform: `scale(${pop}) rotate(-2deg)` }}>
          <div style={{ ...box(S, S.main), padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 220 }}><div style={title(S, it.answer.length > 26 ? 60 : it.answer.length > 16 ? 84 : 120, S.card, S.ink)}>{nb(it.answer)}</div></div>
        </div>
      )}
      {revealed && it.fact && hasChoices ? <FactCard S={S} text={it.fact} top={1340} at={Math.round(((it.voice?.a?.sec ?? 6) * (it.answer.length + 14)) / (it.answer.length + 14 + it.fact.length) * fps)} /> : <Tagline S={S} />}
    </AbsoluteFill>
  );
};

const Sting: React.FC<{ S: Skin; dur: number }> = ({ S, dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 9, stiffness: 150 } });
  const pop2 = spring({ frame: frame - 10, fps, config: { damping: 10, stiffness: 150 } });
  const out = interpolate(frame, [dur - 6, dur], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const pts = Array.from({ length: 36 }, (_, i) => { const a = (i / 36) * Math.PI * 2, rr = i % 2 ? 470 : 400; return `${540 + Math.cos(a) * rr},${800 + Math.sin(a) * rr}`; }).join(" ");
  const words = S.title.split(" ");
  const head = words.slice(0, -2).join(" "), mid = words.at(-2) ?? "", last = words.at(-1) ?? "";
  return (
    <AbsoluteFill style={{ opacity: out }}>
      <svg width="1080" height="1920" style={{ position: "absolute", inset: 0, transform: `scale(${pop}) rotate(${frame * 0.6}deg)`, transformOrigin: "540px 800px" }}>
        <polygon points={pts} fill={S.main} stroke={S.ink} strokeWidth="10" />
      </svg>
      <div style={{ position: "absolute", top: 580, left: 120, right: 120, transform: `scale(${pop}) rotate(-4deg)`, textTransform: "uppercase" }}>
        {head && <div style={title(S, 66, S.card, S.ink)}>{head}</div>}
        <div style={{ ...title(S, mid.length > 7 ? 112 : 136, S.card, S.ink), marginTop: 6 }}>{mid}</div>
        <div style={title(S, last.length > 7 ? 104 : 124, S.accent, S.ink)}>{last}</div>
      </div>
      <div style={{ position: "absolute", top: 1290, left: 0, right: 0, display: "flex", justifyContent: "center", transform: `scale(${pop2})` }}>
        <div style={{ background: S.card, border: `7px solid ${S.ink}`, boxShadow: `10px 10px 0 ${S.ink}`, padding: "14px 44px", transform: "rotate(2deg)" }}>
          <span style={{ fontFamily: FONT_BODY, fontStyle: "italic", fontWeight: 600, fontSize: 44, color: S.ink }}>offert par </span>
          <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 60, color: S.sepia ? S.main : S.second }}>YouQwiz.com</span>
        </div>
      </div>
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
                <Sting S={S} dur={s.sting.dur} />
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
