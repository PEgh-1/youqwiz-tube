import React from "react";
import { AbsoluteFill, Audio, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { emojiToCode, splitEmojis } from "./emoji";
import { DEFAULT_STYLE, FONT_BODY, FONT_DISPLAY, INK, LEVELS, OK, STREAK, THEMES, Theme, WHITE, fontFaces } from "./theme";
import type { Episode, Level, Prompt, Style, VoiceClip } from "./types";
import { tr, type Lang } from "./i18n";
import { WIPE_SECONDS } from "./timeline";
import { useFx } from "./fxContext";
import type { Segment } from "./timeline";
import mascots from "./mascots.json";
import audioManifest from "./audio.json";

const MASCOTS: Record<string, boolean> = mascots;
export const AUDIO: Record<string, boolean | string[]> = audioManifest as Record<string, boolean | string[]>;
const has = (k: string) => AUDIO[k] === true;
const hash = (s: string) => Array.from(s).reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

export const Fonts: React.FC = () => <style>{fontFaces()}</style>;
export const themeOf = (ep: Episode): Theme => THEMES[ep.theme % THEMES.length];
export const styleOf = (ep: Episode): Style => ({ ...DEFAULT_STYLE, ...(ep.style ?? {}) });

// Piste musicale de l'épisode : public/audio/music.mp3 ou music-<n>.mp3 (liste dans audio.json, écrite par prepare-assets).
export const musicFile = (ep: Episode): string | null => {
  const list = Array.isArray(AUDIO.musics) ? (AUDIO.musics as string[]) : has("music") ? ["music.mp3"] : [];
  if (!list.length) return null;
  return `audio/${list[(styleOf(ep).music ?? 0) % list.length]}`;
};

// ---------- Fond : dégradé de la palette + motif (confettis, pois, rayures, bulles, étoiles) ----------
// `variant` (vidéo longue v2) : à chaque scène, l'angle du dégradé tourne et le motif se déplace — le changement se fait sous la transition.
export const Background: React.FC<{ theme: Theme; confetti?: number; pattern?: Style["pattern"]; variant?: number }> = ({ theme, confetti = 18, pattern = "confetti", variant = 0 }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const step = Math.floor(frame / 60);
  const bg = variant ? theme.bg.replace(/^linear-gradient\(\d+deg/, `linear-gradient(${(135 + variant * 47) % 360}deg`) : theme.bg;
  const shift = variant * 131;
  const n = pattern === "dots" ? confetti * 3 : pattern === "stripes" ? 14 : confetti;
  // Shorts v2 (09/11/2026) : en vertical, le décor dérive lentement (sinus, sans décalage cumulé) pour un fond vivant.
  const vertical = height > width;
  const drift = vertical ? `translate(${Math.sin(frame / 110) * 22}px, ${Math.cos(frame / 140) * 16}px) scale(1.06)` : undefined;
  return (
    <AbsoluteFill style={{ background: bg }}>
      <AbsoluteFill style={{ transform: drift }}>
      {pattern === "stripes"
        ? Array.from({ length: n }).map((_, i) => (
            <div key={i} style={{ position: "absolute", left: -200 + i * (width / 6), top: -200, width: 70, height: height + 400, background: theme.confetti[i % theme.confetti.length], opacity: 0.16, transform: `rotate(-18deg) translateX(${(step % 2) * 4}px)` }} />
          ))
        : Array.from({ length: n }).map((_, i) => {
            const x = ((i * 977 + shift) % 1000) / 1000, y = ((i * 613 + shift * 3) % 1000) / 1000;
            const c = theme.confetti[i % theme.confetti.length];
            if (pattern === "dots") return <div key={i} style={{ position: "absolute", left: x * width, top: y * height, width: 14 + (i % 3) * 6, height: 14 + (i % 3) * 6, borderRadius: 999, background: c, opacity: 0.45 }} />;
            if (pattern === "bubbles") {
              const s = 60 + (i % 5) * 40;
              return <div key={i} style={{ position: "absolute", left: x * width, top: y * height - (step % 3) * 3, width: s, height: s, borderRadius: 999, border: `6px solid ${c}`, opacity: 0.35 }} />;
            }
            if (pattern === "stars") {
              const s = 28 + (i % 4) * 14;
              return (
                <div key={i} style={{ position: "absolute", left: x * width, top: y * height, width: s, height: s, color: c, opacity: 0.75, fontSize: s, lineHeight: 1, transform: `rotate(${(i * 37 + step * 4) % 360}deg)` }}>
                  ★
                </div>
              );
            }
            return <div key={i} style={{ position: "absolute", left: x * width + (step % 2) * 6, top: y * height, width: 16 + (i % 3) * 8, height: 9 + (i % 4) * 5, background: c, borderRadius: i % 2 ? 999 : 4, transform: `rotate(${(i * 37) % 360}deg)`, opacity: 0.8 }} />;
          })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ---------- Shorts v2 (09/11/2026) : sous-titres karaoké, bandeau d'accroche, effets sonores ----------
// Sous-titres de la voix off, mot à mot : le mot en cours est coloré et grossi, les suivants sont estompés. Le minutage
// est proportionnel au nombre de caractères (pas de timestamps ElevenLabs) ; au-delà de 9 mots, fenêtre glissante.
export const Karaoke: React.FC<{ clip?: VoiceClip; theme: Theme; size?: number; width?: number; from?: number }> = ({ clip, theme, size = 56, width = 960, from = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!clip?.text) return null;
  const raw = clip.text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  // la ponctuation isolée (« ! », « ? », « … ») reste collée au mot précédent
  const words: string[] = [];
  for (const w of raw) { if (/^[!?…:;.,]+$/.test(w) && words.length) words[words.length - 1] += `\u202f${w}`; else words.push(w); }
  if (!words.length) return null;
  const weights = words.map((w) => w.replace(/[^\p{L}\p{N}]/gu, "").length + 1.2);
  const total = weights.reduce((a, b) => a + b, 0);
  const t = Math.max(0, (frame - from) / fps);
  let acc = 0, cur = -1;
  for (let i = 0; i < words.length; i++) { acc += weights[i]; if (t < (acc / total) * clip.sec) { cur = i; break; } }
  if (cur < 0) cur = t >= clip.sec ? words.length - 1 : 0;
  const win = 9;
  const start = words.length > win ? Math.min(Math.max(0, cur - 3), words.length - win) : 0;
  const shown = words.slice(start, start + win);
  return (
    <div style={{ display: "block", maxWidth: width, padding: "0 20px", fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: size, lineHeight: 1.15, textAlign: "center", wordSpacing: `${size * 0.12}px` }}>
      {shown.map((w, k) => {
        const i = start + k;
        const on = i === cur, done = i < cur;
        return (
          <React.Fragment key={i}>
            {k > 0 ? " " : null}
            {/* pas de scale() : agrandi, le mot courant chevauchait ses voisins ; on le fait juste « sauter » */}
            <span style={{ color: on ? theme.accent : WHITE, opacity: done || on ? 1 : 0.45, textShadow: `5px 5px 0 ${INK}`, transform: `translateY(${on ? -6 : 0}px)`, display: "inline-block", whiteSpace: "nowrap" }}>{w}</span>
          </React.Fragment>
        );
      })}
    </div>
  );
};

// Bandeau d'accroche affiché sur la première question d'un Short (remplace l'ancienne carte d'accroche de 1,5 s) :
// autocollant + ligne, entre en rebond puis sort vers le haut après `until` images.
export const HookBanner: React.FC<{ theme: Theme; sticker?: string; line?: string; n: number; until?: number; lang?: Lang }> = ({ theme, sticker: st, line, n, until = 75, lang }) => {
  const T = tr({ lang });
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sticker = st ?? T.shortSticker;
  const pop = spring({ frame, fps, config: { damping: 9, stiffness: 150 } });
  const out = interpolate(frame, [until - 10, until], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  if (frame > until) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, transform: `translateY(${(1 - pop) * -120 - out * 320}px) scale(${0.7 + pop * 0.3})`, opacity: 1 - out }}>
      <div style={{ background: "#FF3B3B", color: WHITE, fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: sticker.length > 14 ? 58 : 72, padding: "10px 32px", borderRadius: 24, border: `8px solid ${INK}`, boxShadow: `10px 10px 0 ${INK}`, lineHeight: 1, whiteSpace: "nowrap", transform: "rotate(-2deg)" }}>
        {sticker}
      </div>
      <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 44, color: WHITE, textShadow: `5px 5px 0 ${INK}`, textAlign: "center", padding: "0 40px", lineHeight: 1.05 }}>
        <Rich text={line ?? T.nthQuestion(n)} size={44} />
      </div>
    </div>
  );
};

// Accroche du Short : paire (sticker, ligne) posée par generate.mjs (meta.shortHook) ou par render.mjs pour les Shorts 2 et 3.
export const shortHookOf = (ep: Episode): { sticker?: string; line?: string } => ep.meta.shortHook ?? { sticker: ep.meta.thumbnail.sticker, line: ep.meta.shortLine };

// Effets sonores d'un Short, par question : jingle discret sur la 1re, « pop » d'entrée, montée de tension sur la dernière.
export const ShortFx: React.FC<{ index: number; last: boolean; dur: number }> = ({ index, last, dur }) => {
  const { fps } = useVideoConfig();
  const riserFrames = Math.round(1.6 * fps);
  return (
    <>
      {index === 0 && has("jingle") && <Audio src={staticFile("audio/jingle.mp3")} volume={0.3} />}
      {has("pop") && <Audio src={staticFile("audio/pop.mp3")} volume={0.5} />}
      {last && has("riser") && dur > riserFrames && (
        <Sequence from={dur - riserFrames} durationInFrames={riserFrames}>
          <Audio src={staticFile("audio/riser.mp3")} volume={0.55} />
        </Sequence>
      )}
    </>
  );
};

// Zoom lent pendant la question (vertical) et secousse à la révélation : à appliquer sur le conteneur de la carte.
export const shortMotion = (frame: number, dur: number, reveal: boolean, vertical: boolean): string => {
  if (!vertical) return "";
  if (reveal) return frame < 8 ? ` translate(${Math.sin(frame * 7) * 7}px, ${Math.cos(frame * 5) * 5}px)` : "";
  return ` scale(${1 + 0.05 * Math.min(1, frame / Math.max(1, dur))})`;
};

// ---------- Explosion de confettis (révélation, score) ----------
export const Burst: React.FC<{ theme: Theme; x: number; y: number; n?: number }> = ({ theme, x, y, n = 36 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  return (
    <>
      {Array.from({ length: n }).map((_, i) => {
        const a = (i / n) * Math.PI * 2 + (i % 2) * 0.3;
        const v = 900 + (i % 5) * 160;
        const px = x + Math.cos(a) * v * t;
        const py = y + Math.sin(a) * v * t + 1400 * t * t;
        const op = Math.max(0, 1 - t * 1.4);
        return <div key={i} style={{ position: "absolute", left: px, top: py, width: 18, height: 12, background: theme.confetti[i % theme.confetti.length], borderRadius: i % 2 ? 999 : 3, transform: `rotate(${i * 50 + frame * 9}deg)`, opacity: op }} />;
      })}
    </>
  );
};

// ---------- Émoji Twemoji ----------
export const Emoji: React.FC<{ value: string; size: number; style?: React.CSSProperties }> = ({ value, size, style }) => {
  const parts = splitEmojis(value).filter((g) => g.trim() !== "");
  return (
    <div style={{ display: "flex", gap: size * 0.12, alignItems: "center", justifyContent: "center", ...style }}>
      {parts.map((e, i) => (
        <Img key={i} src={staticFile(`emoji/${emojiToCode(e)}.svg`)} style={{ width: size, height: size }} />
      ))}
    </div>
  );
};

// ---------- Texte riche : les émojis d'une chaîne deviennent des images Twemoji ----------
const EMOJI_RE = /\p{Extended_Pictographic}/u;
export const Rich: React.FC<{ text: string; size: number }> = ({ text, size }) => {
  const parts = splitEmojis(text);
  const out: React.ReactNode[] = [];
  let buf = "";
  parts.forEach((g, i) => {
    if (EMOJI_RE.test(g)) {
      if (buf) out.push(<span key={`t${i}`}>{buf}</span>);
      buf = "";
      out.push(<Img key={`e${i}`} src={staticFile(`emoji/${emojiToCode(g)}.svg`)} style={{ width: size, height: size, verticalAlign: "-0.15em", display: "inline-block" }} />);
    } else buf += g;
  });
  if (buf) out.push(<span key="end">{buf}</span>);
  return <>{out}</>;
};
const rich = (children: React.ReactNode, size: number) => (typeof children === "string" ? <Rich text={children} size={size} /> : children);

// ---------- Pastille « sticker » (contour encre + ombre dure) ----------
export const Pill: React.FC<{ children: React.ReactNode; bg?: string; fg?: string; size?: number; style?: React.CSSProperties; tilt?: number }> = ({ children, bg = WHITE, fg = INK, size = 34, style, tilt = 0 }) => (
  <div
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: size * 0.3,
      fontFamily: FONT_DISPLAY,
      fontWeight: 800,
      fontSize: size,
      lineHeight: 1,
      padding: `${size * 0.32}px ${size * 0.75}px`,
      borderRadius: 999,
      background: bg,
      color: fg,
      border: `${Math.max(4, size * 0.14)}px solid ${INK}`,
      boxShadow: `${size * 0.18}px ${size * 0.18}px 0 ${INK}`,
      whiteSpace: "nowrap",
      transform: `rotate(${tilt}deg)`,
      ...style,
    }}
  >
    {rich(children, size)}
  </div>
);

export const LevelBadge: React.FC<{ level: Level; size?: number; tilt?: number; lang?: Lang }> = ({ level, size = 34, tilt = 0, lang }) => {
  const l = LEVELS[level];
  return (
    <Pill bg={l.color} fg={WHITE} size={size} tilt={tilt}>
      <Emoji value={l.emoji} size={size} />
      {tr({ lang }).levelLabel[level]}
    </Pill>
  );
};

// ---------- Barre de progression ----------
export const Progress: React.FC<{ value: number; theme: Theme; height?: number }> = ({ value, theme, height = 26 }) => (
  <div style={{ flex: 1, height, background: WHITE, borderRadius: 999, border: `5px solid ${INK}`, boxShadow: `5px 5px 0 ${INK}`, overflow: "hidden" }}>
    <div style={{ width: `${Math.round(value * 100)}%`, height: "100%", background: `linear-gradient(90deg, ${theme.accent}, ${theme.soft})` }} />
  </div>
);

// ---------- Chrono : anneau (défaut), barre, chiffres géants ou camembert ----------
export const Countdown: React.FC<{ frame: number; totalFrames: number; theme: Theme; size?: number; kind?: Style["timer"]; rider?: "chat" | "poussin"; width?: number }> = ({ frame, totalFrames, theme, size = 230, kind = "ring", rider = "chat", width }) => {
  const { fps } = useVideoConfig();
  const progress = Math.min(1, frame / totalFrames);
  const secondsLeft = Math.max(0, Math.ceil((totalFrames - frame) / fps));
  const last = secondsLeft <= 1;
  const color = last ? "#FF3B3B" : theme.accent;
  const pulse = 1 + 0.1 * Math.max(0, 1 - ((frame % fps) / fps) * 3);
  if (kind === "slider") {
    // 08/11/2026 : barre de temps qui se vide de droite à gauche, chevauchée par la tête souriante de la mascotte
    // (celle qui n'est pas affichée en bas à gauche) ; les secondes dans une bulle qui court devant la tête.
    const w = width ?? 780, h = 62, head = 160, pillW = 108;
    const pillAhead = progress > 0.14; // la bulle court devant la tête, sauf au tout début (elle sortirait du cadre)
    const x = head / 2 + (1 - progress) * w; // centre de la tête (px depuis la gauche du conteneur)
    const wobble = Math.sin(frame / 3) * 7; // la tête dodeline en avançant
    const bump = Math.abs(Math.sin(frame / 5)) * -8;
    const headSrc = MASCOTS[`${rider}-head`] ? `mascots/${rider}-head.png` : MASCOTS[rider] ? `mascots/${rider}.png` : null;
    const segs = Math.max(1, Math.round(totalFrames / fps));
    return (
      <div style={{ position: "relative", width: w + head, height: head + 10 }}>
        <div style={{ position: "absolute", left: head / 2, width: w, top: (head - h) / 2 + 5, height: h, background: WHITE, borderRadius: 999, border: `6px solid ${INK}`, boxShadow: `6px 6px 0 ${INK}`, overflow: "hidden" }}>
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${(1 - progress) * 100}%`, background: `repeating-linear-gradient(135deg, ${color} 0 26px, ${color}CC 26px 52px)` }} />
          {Array.from({ length: segs - 1 }, (_, i) => (
            <div key={i} style={{ position: "absolute", top: 0, bottom: 0, left: `${((i + 1) / segs) * 100}%`, width: 4, background: `${INK}33` }} />
          ))}
        </div>
        <div style={{ position: "absolute", left: pillAhead ? x + head / 2 + 8 : x - head / 2 - 8 - pillW, top: (head - 56) / 2 + 5, height: 56, minWidth: pillW, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 16px", background: color, color: WHITE, border: `5px solid ${INK}`, boxShadow: `4px 4px 0 ${INK}`, borderRadius: 999, fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 38, whiteSpace: "nowrap", transform: `scale(${last ? pulse : 1})` }}>
          {secondsLeft} s
        </div>
        <div style={{ position: "absolute", left: x, top: 5, transform: `translateX(-50%) translateY(${bump}px) rotate(${wobble}deg)`, width: head, height: head, borderRadius: 999, background: WHITE, border: `7px solid ${INK}`, boxShadow: `6px 6px 0 ${INK}`, overflow: "hidden" }}>
          {headSrc ? <Img src={staticFile(headSrc)} style={{ width: "100%", height: "100%", objectFit: "cover", transform: rider === "poussin" ? "scale(1.08)" : "scale(1.15) translateY(6px)" }} /> : <Emoji value={rider === "chat" ? "🐱" : "🐥"} size={head * 0.7} />}
        </div>
      </div>
    );
  }
  if (kind === "bar") {
    const w = size * 2.2, h = size * 0.34;
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 18, transform: `scale(${1 + (pulse - 1) * 0.4})` }}>
        <div style={{ width: w, height: h, background: WHITE, borderRadius: 999, border: `6px solid ${INK}`, boxShadow: `6px 6px 0 ${INK}`, overflow: "hidden" }}>
          <div style={{ width: `${(1 - progress) * 100}%`, height: "100%", background: color, transition: "none" }} />
        </div>
        <Pill size={size * 0.26} bg={color} fg={WHITE}>{`⏱️ ${secondsLeft}`}</Pill>
      </div>
    );
  }
  if (kind === "digits") {
    return (
      <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: size * 0.9, color: WHITE, textShadow: `8px 8px 0 ${INK}`, lineHeight: 1, transform: `scale(${pulse})`, display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ color }}>{secondsLeft}</span>
        <span style={{ fontSize: size * 0.3, color: WHITE }}>s</span>
      </div>
    );
  }
  const r = size / 2 - 14;
  const c = 2 * Math.PI * r;
  if (kind === "pie") {
    const a = (1 - progress) * 360;
    return (
      <div style={{ position: "relative", width: size, height: size, transform: `scale(${pulse})` }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: 999, border: `${size * 0.06}px solid ${INK}`, boxShadow: `6px 6px 0 ${INK}`, background: `conic-gradient(${color} ${a}deg, ${WHITE} ${a}deg)` }} />
        <div style={{ position: "absolute", inset: size * 0.28, borderRadius: 999, background: WHITE, border: `5px solid ${INK}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: size * 0.3, color }}>
          {secondsLeft}
        </div>
      </div>
    );
  }
  return (
    <div style={{ position: "relative", width: size, height: size, transform: `scale(${pulse})` }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke={INK} strokeWidth={size * 0.07 + 10} fill={WHITE} />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={size * 0.07} fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * progress} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: size * 0.55, color }}>
        {secondsLeft}
      </div>
    </div>
  );
};

// ---------- Carte scène (forme selon l'habillage : arrondie, carrée, penchée) ----------
export const Card: React.FC<{ children: React.ReactNode; style?: React.CSSProperties; tilt?: number; border?: string; shape?: Style["card"] }> = ({ children, style, tilt = 0, border = INK, shape = "round" }) => (
  <div
    style={{
      background: WHITE,
      borderRadius: shape === "square" ? 14 : 40,
      border: `10px solid ${border}`,
      boxShadow: shape === "square" ? `12px 12px 0 ${INK}` : `18px 18px 0 ${INK}`,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      transform: `rotate(${shape === "tilt" ? tilt * 2.2 : tilt}deg)`,
      position: "relative",
      ...style,
    }}
  >
    {children}
  </div>
);

// ---------- Animation d'apparition de la réponse : pop (ressort), flip, slide, zoom ----------
export const useRevealTransform = (kind: Style["reveal"], delay = 0): { transform: string; opacity: number } => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping: 11, stiffness: 170 } });
  if (kind === "flip") return { transform: `perspective(1200px) rotateX(${(1 - s) * 90}deg)`, opacity: s };
  if (kind === "slide") return { transform: `translateY(${(1 - s) * 220}px)`, opacity: s };
  if (kind === "zoom") return { transform: `scale(${2.2 - 1.2 * s})`, opacity: s };
  return { transform: `scale(${s})`, opacity: interpolate(s, [0, 1], [0, 1]) };
};
export const Reveal: React.FC<{ kind: Style["reveal"]; delay?: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ kind, delay = 0, children, style }) => {
  const t = useRevealTransform(kind, delay);
  return <div style={{ ...t, ...style }}>{children}</div>;
};

// ---------- Drapeau détaillé (flag-icons, MIT) au lieu de l'émoji Twemoji simplifié ----------
export const flagCode = (v: string): string | null => {
  const cps = Array.from(v.trim()).map((c) => c.codePointAt(0)!);
  if (cps.length !== 2 || cps.some((c) => c < 0x1f1e6 || c > 0x1f1ff)) return null;
  return cps.map((c) => String.fromCharCode(c - 0x1f1e6 + 97)).join("");
};
export const Flag: React.FC<{ code: string; size: number }> = ({ code, size }) => {
  const frame = useCurrentFrame();
  const w = size * 1.5, h = w * 0.75;
  const sway = Math.sin(frame / 18) * 1.2;
  return (
    <div style={{ width: w, height: h, borderRadius: size * 0.06, overflow: "hidden", border: `${Math.max(4, size * 0.025)}px solid ${INK}`, boxShadow: `${size * 0.04}px ${size * 0.04}px 0 ${INK}`, transform: `rotate(${sway}deg)`, position: "relative", background: "#fff" }}>
      <Img src={staticFile(`flags/${code}.svg`)} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(115deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 35%, rgba(0,0,0,0.06) 100%)" }} />
    </div>
  );
};

// ---------- Texte ajusté à une boîte (1 à 3 lignes) ----------
export const FitText: React.FC<{ text: string; big: number; W: number; H: number; color?: string; spacing?: number }> = ({ text, big, W, H, color = INK, spacing = 0.12 }) => {
  const tokens = text.split(/(?<=[ -])/);
  const layout = (n: number) => {
    const target = text.length / n;
    const out: string[] = [""];
    for (const t of tokens) {
      const cur = out[out.length - 1];
      if (cur && (cur + t).trim().length > target * 1.15 && out.length < n) out.push(t);
      else out[out.length - 1] = cur + t;
    }
    return out.map((l) => l.trim()).filter(Boolean);
  };
  let best = { lines: [text], size: 0 };
  for (const n of [1, 2, 3]) {
    if (n > tokens.length) break;
    const lines = layout(n);
    const longest = Math.max(...lines.map((l) => l.length));
    const size = Math.min(big * 0.72, W / (longest * (0.66 + spacing)), H / (lines.length * 1.1));
    if (size > best.size * 1.05) best = { lines, size };
  }
  const { lines, size } = best;
  return (
    <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: size, color, letterSpacing: size * spacing, textAlign: "center", lineHeight: 1.08, maxWidth: W }}>
      {lines.map((l, i) => <div key={i} style={{ whiteSpace: "nowrap" }}>{l}</div>)}
    </div>
  );
};

// ---------- Rendu d'un prompt ----------
export const PromptView: React.FC<{ prompt: Prompt; theme: Theme; big: number; vertical?: boolean; maxW?: number; maxH?: number; lang?: Lang }> = ({ prompt, theme, big, vertical = false, maxW, maxH, lang }) => {
  if (prompt.type === "emoji") {
    const fc = flagCode(prompt.value);
    if (fc) return <Flag code={fc} size={Math.min(big, maxW ? maxW / 1.5 : big, maxH ? maxH / 1.125 : big)} />;
    return <Emoji value={prompt.value} size={big} />;
  }
  if (prompt.type === "image") return <Img src={staticFile(prompt.value)} style={{ maxWidth: big * 2.2, maxHeight: big * 1.4, borderRadius: 24 }} />;
  if (prompt.type === "text") return <FitText text={prompt.value} big={big} W={maxW ?? (vertical ? 860 : 1000)} H={maxH ?? (vertical ? 760 : 440)} />;
  if (prompt.type === "letter") {
    // « Nomme un animal qui commence par… » : lettre géante sur pastille + catégorie
    const s = Math.min(big, maxH ? maxH * 0.72 : big);
    return (
      <div style={{ display: "flex", flexDirection: vertical ? "column" : "row", alignItems: "center", gap: s * 0.18 }}>
        <div style={{ width: s, height: s, borderRadius: 999, background: theme.accent, border: `10px solid ${INK}`, boxShadow: `12px 12px 0 ${INK}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: s * 0.66, color: WHITE, transform: "rotate(-4deg)" }}>
          {prompt.value}
        </div>
        {/* Vignettes de miniature (maxW < 500) : la catégorie ne tient pas à côté de la lettre, elle débordait de la case (09/11/2026). */}
        {(!maxW || maxW >= 500) && <Pill size={Math.min(52, s * 0.16)} bg={theme.soft} tilt={2}>{prompt.category}</Pill>}
      </div>
    );
  }
  if (prompt.type !== "choices") return null;
  // Deux options de taille FIXE qui tiennent dans la carte (1520×560 en 16:9, 920×880 en 9:16), police adaptée à la longueur.
  const boxW = vertical ? 860 : 600;
  const boxH = vertical ? 330 : 400;
  const fontFor = (s: string) => {
    const n = s.length;
    const base = vertical ? 66 : 74;
    return n > 48 ? base * 0.68 : n > 34 ? base * 0.8 : n > 22 ? base * 0.9 : base;
  };
  return (
    <div style={{ display: "flex", flexDirection: vertical ? "column" : "row", gap: vertical ? 18 : 30, alignItems: "center", justifyContent: "center" }}>
      {prompt.value.map((v, i) => (
        <React.Fragment key={i}>
          {i > 0 && <Pill bg={theme.accent} fg={WHITE} size={40} tilt={-6}>{tr({ lang }).or}</Pill>}
          <div style={{ width: boxW, height: boxH, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: fontFor(v), color: INK, background: i === 0 ? "#E3F7F5" : "#FFF3CC", border: `7px solid ${INK}`, boxShadow: `9px 9px 0 ${INK}`, padding: "18px 28px", borderRadius: 30, textAlign: "center", lineHeight: 1.12, transform: `rotate(${i === 0 ? -1.5 : 1.5}deg)`, overflow: "hidden", overflowWrap: "anywhere" }}>
            <Rich text={v} size={fontFor(v)} />
          </div>
        </React.Fragment>
      ))}
    </div>
  );
};

// ---------- Apparition ressort ----------
export const Pop: React.FC<{ delay?: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ delay = 0, children, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping: 11, stiffness: 170 } });
  return <div style={{ transform: `scale(${s})`, opacity: interpolate(s, [0, 1], [0, 1]), ...style }}>{children}</div>;
};

// ---------- Mascotte PNG (public/mascots) avec repli émoji ----------
// Lot D (14/11/2026, fx.rig) : mascotte animée par le code à partir du dessin existant — respiration (étirement / écrasement),
// clignement du poussin (poses « yeux ouverts » et « yeux fermés » tirées du dessin d'origine), clin d'œil quand il fête une bonne
// réponse, et petit rebond à chaque mot quand la mascotte « dit » la phrase (`talk` = clip horodaté, `talkFrom` = son départ).
// `pose` force une pose du poussin (transitions) ; `still` coupe le balancement de base (la scène anime déjà la mascotte).
export const Mascot: React.FC<{ which: "chat" | "poussin"; size: number; mood?: "idle" | "cheer" | "shock" | "dare"; style?: React.CSSProperties; talk?: VoiceClip; talkFrom?: number; pose?: "open" | "wink" | "blink"; still?: boolean }> = ({ which, size, mood = "idle", style, talk, talkFrom = 0, pose, still = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rig = !!useFx().rig;
  const bob = still ? 0 : mood === "cheer" ? Math.abs(Math.sin(frame / 4)) * -26 : Math.sin(frame / 12) * 8;
  const rot = still ? 0 : mood === "shock" ? Math.sin(frame / 2) * 6 : Math.sin(frame / 20) * 4;
  const fallback = which === "chat" ? "🐱" : "🐥";
  let file: string = (mood === "shock" || mood === "dare") && MASCOTS[`${which}-${mood}`] ? `${which}-${mood}` : which;
  let sx = 1, sy = 1, lift = 0, tilt = 0;
  const poses = which === "poussin" && file === "poussin" && MASCOTS["poussin-open"] && MASCOTS["poussin-blink"];
  if (poses && pose) file = pose === "wink" ? "poussin" : `poussin-${pose}`;
  if (rig && !still) {
    // respiration : la mascotte s'étire et s'écrase très légèrement, pieds fixes
    const b = Math.sin(frame / 9 + (which === "chat" ? 0 : 1.7));
    sy += 0.02 * b; sx -= 0.012 * b;
    // saut de joie : écrasement à l'appui, étirement en l'air
    if (mood === "cheer") { const a = Math.abs(Math.sin(frame / 4)); sy += 0.06 * a - 0.04 * (1 - a); sx -= 0.04 * a - 0.03 * (1 - a); }
    // parole : un rebond par mot (horodatage), sinon un rebond régulier pendant la durée du clip
    if (talk) {
      const t = (frame - talkFrom) / fps;
      let pulse = 0;
      if (talk.words?.length) { for (const w of talk.words) { const d = t - w[1]; if (d >= 0 && d < 0.3) pulse = Math.max(pulse, 1 - d / 0.3); } }
      else if (t >= 0 && t < talk.sec) pulse = Math.abs(Math.sin(t * 9)) * 0.7;
      sy += 0.06 * pulse; sx -= 0.03 * pulse; lift -= 9 * pulse; tilt += Math.sin(t * 5) * 2.5 * Math.min(1, pulse * 2);
    }
    // poussin : yeux ouverts au repos, clignement toutes les 2 à 3 s, clin d'œil au début d'une célébration
    if (poses && !pose) {
      const period = 71 + (size % 13);
      const ph = (frame + 23) % period;
      file = mood === "cheer" ? (frame >= 8 && frame < 24 ? "poussin" : "poussin-open") : ph < 3 ? "poussin-blink" : "poussin-open";
    }
  }
  return (
    <div style={{ transform: `translateY(${bob + lift}px) rotate(${rot + tilt}deg) scale(${sx},${sy})`, transformOrigin: "bottom center", ...style }}>
      {/* 05/11/2026 : pose « choquée » dédiée (Gemini, même style) quand elle existe */}
      {MASCOTS[which] ? <Img src={staticFile(`mascots/${file}.png`)} style={{ width: size, height: size, objectFit: "contain" }} /> : <Emoji value={fallback} size={size} />}
    </div>
  );
};

// ---------- Bulle de la mascotte ----------
export const Bubble: React.FC<{ children: React.ReactNode; size?: number; tilt?: number; wrap?: number }> = ({ children, size = 36, tilt = -2, wrap }) => (
  <div style={{ fontFamily: FONT_BODY, fontWeight: 600, fontSize: size, color: INK, background: WHITE, border: `6px solid ${INK}`, boxShadow: `8px 8px 0 ${INK}`, padding: `${size * 0.45}px ${size * 0.8}px`, borderRadius: 28, borderBottomLeftRadius: 6, transform: `rotate(${tilt}deg)`, whiteSpace: wrap ? "normal" : "nowrap", maxWidth: wrap, lineHeight: 1.15 }}>
    {rich(children, size)}
  </div>
);

// ---------- Fait bonus (après la réponse) ----------
export const FactCard: React.FC<{ text: string; theme: Theme; vertical?: boolean; lang?: Lang }> = ({ text, theme, vertical = false, lang }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 12, stiffness: 150 } });
  const size = vertical ? 38 : 40;
  return (
    <div style={{ transform: `translateY(${(1 - s) * 80}px) rotate(-1deg)`, opacity: s, display: "flex", alignItems: "center", gap: 18, maxWidth: vertical ? 940 : 1280 }}>
      <Pill size={size * 0.9} bg={theme.accent} fg={WHITE} tilt={-6}>{tr({ lang }).didYouKnow}</Pill>
      <div style={{ fontFamily: FONT_BODY, fontWeight: 600, fontSize: size, color: INK, background: WHITE, border: `6px solid ${INK}`, boxShadow: `8px 8px 0 ${INK}`, padding: `${size * 0.4}px ${size * 0.7}px`, borderRadius: 24, lineHeight: 1.18, whiteSpace: "normal" }}>
        <Rich text={text} size={size} />
      </div>
    </div>
  );
};

// ---------- Logo-titre ----------
export const Logo: React.FC<{ theme: Theme; size?: number }> = ({ theme, size = 60 }) => (
  <div style={{ display: "flex", alignItems: "baseline", fontFamily: FONT_DISPLAY, fontSize: size, lineHeight: 1, textShadow: `3px 3px 0 ${WHITE}` }}>
    <span style={{ fontWeight: 600, color: INK }}>You</span>
    <span style={{ fontWeight: 800, color: WHITE, textShadow: `3px 3px 0 ${INK}` }}>Qwiz</span>
    <span style={{ marginLeft: size * 0.15, display: "inline-block" }}>
      <Emoji value="💬" size={size * 0.75} />
    </span>
  </div>
);

export const Streak: React.FC<{ value: number; size?: number; lang?: Lang }> = ({ value, size = 34, lang }) => (
  <Pill bg={INK} fg={STREAK} size={size}>
    <Emoji value="🔥" size={size} />
    {tr({ lang }).streak(value)}
  </Pill>
);

// ---------- Pré-roll (3 s, texte variable) ----------
// Voix off : clip générique de l'épisode (episode.voice.preroll) ; à défaut public/audio/preroll.mp3.
export const Preroll: React.FC<{ theme: Theme; text?: string; vertical?: boolean; lang?: Lang; baseline?: string; line?: string }> = ({ theme, text: textProp, vertical = false, lang, baseline, line }) => {
  const text = textProp ?? tr({ lang }).prerollDefault;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 9, stiffness: 140 } });
  const slide = spring({ frame: frame - 6, fps, config: { damping: 12, stiffness: 90 } });
  const wave = Math.sin(frame / 4) * 6;
  const size = text.length > 26 ? 76 : 96;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "absolute", left: (vertical ? 20 : 120) - (1 - slide) * 400, bottom: 40, transform: `rotate(${wave}deg)`, transformOrigin: "bottom center" }}>
        <Mascot which="chat" size={vertical ? 300 : 420} mood="cheer" />
      </div>
      <div style={{ position: "absolute", right: (vertical ? 20 : 120) + (1 - slide) * 400, bottom: 40, transform: `rotate(${-wave}deg)`, transformOrigin: "bottom center" }}>
        <Mascot which="poussin" size={vertical ? 260 : 360} mood="cheer" />
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 36, transform: `translateY(${baseline ? -130 : 0}px) scale(${0.6 + pop * 0.4})`, opacity: pop, padding: "0 80px" }}>
        <Logo theme={theme} size={120} />
        <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: size, color: WHITE, textShadow: `7px 7px 0 ${INK}`, textAlign: "center", lineHeight: 1.05, maxWidth: 1500 }}>
          <Rich text={text} size={size} />
        </div>
        {line && (
          <div style={{ marginTop: -14, opacity: interpolate(frame, [22, 32], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: vertical ? 48 : 62, color: theme.soft, textShadow: `5px 5px 0 ${INK}`, textAlign: "center", lineHeight: 1.05, maxWidth: 1500 }}>
            <Rich text={line} size={vertical ? 48 : 62} />
          </div>
        )}
        {baseline && (
          <div style={{ opacity: interpolate(frame, [10, 22], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), transform: `translateY(${interpolate(frame, [10, 22], [30, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}px) rotate(-1.5deg)`, fontFamily: FONT_BODY, fontWeight: 600, fontSize: vertical ? 40 : 52, color: INK, background: WHITE, border: `6px solid ${INK}`, boxShadow: `8px 8px 0 ${INK}`, borderRadius: 999, padding: "12px 40px", whiteSpace: "nowrap" }}>
            <Rich text={`💡 ${baseline}`} size={vertical ? 40 : 52} />
          </div>
        )}
      </div>
      <Burst theme={theme} x={960} y={420} n={30} />
    </AbsoluteFill>
  );
};

// ---------- Packshot final (10 s) : CTA site variable + zone libre pour les écrans de fin YouTube ----------
// Le tiers droit reste vide (hors mascotte) : YouTube y placera « vidéo suivante » et « s'abonner ».
// Packshot final (16:9). Les écrans de fin sont posés avec le 1er modèle YouTube « 1 vidéo + 1 élément S'abonner » :
// vidéo suggérée en BAS À GAUCHE (≈ 32 % de la largeur, x 44→665, y 570→913) et bouton S'abonner en BAS À DROITE
// (rond ≈ 300 px, x 1580→1880, y 585→885) — mesuré sur une vidéo publiée le 09/11/2026. Le packshot laisse donc ces deux
// zones vides (gabarits pointillés) : textes en haut, appel à l'action et mascotte dans la bande libre du milieu-bas.
const END_SCREEN = { video: { left: 44, top: 570, width: 621, height: 349 }, subscribe: { left: 1580, top: 585, size: 300 } };
export const Packshot: React.FC<{ theme: Theme; headline?: string; sub?: string; cta?: string; lang?: Lang }> = ({ theme, headline: h, sub: s, cta: c, lang }) => {
  const T = tr({ lang });
  const headline = h ?? T.packshotHeadline, sub = s ?? T.packshotSub, cta = c ?? T.packshotCta;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 10, stiffness: 120 } });
  const pulse = 1 + Math.sin(frame / 6) * 0.03;
  const hop = Math.abs(Math.sin(frame / 7)) * 18;
  const words = headline.split(" ");
  const strong = words.find((w) => w.length > 3 && w === w.toUpperCase() && /[A-ZÉ]/.test(w));
  const hsize = headline.length > 40 ? 66 : 84;
  const { video, subscribe } = END_SCREEN;
  const midLeft = video.left + video.width + 40, midRight = subscribe.left - 40; // bande libre entre les deux éléments YouTube
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 90, top: 48, display: "flex", flexDirection: "column", gap: 24, width: 1740, opacity: pop, transform: `translateY(${(1 - pop) * 40}px)` }}>
        <Logo theme={theme} size={78} />
        <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: hsize, color: WHITE, textShadow: `6px 6px 0 ${INK}`, lineHeight: 1.02, maxWidth: 1380 }}>
          {words.map((w, i) => (
            <span key={i} style={w === strong ? { color: theme.accent, textShadow: `6px 6px 0 ${INK}` } : undefined}>
              {w}{i < words.length - 1 ? " " : ""}
            </span>
          ))}
        </div>
        <div style={{ fontFamily: FONT_BODY, fontWeight: 600, fontSize: 40, color: INK, background: WHITE, borderRadius: 24, padding: "12px 26px", alignSelf: "flex-start", border: `5px solid ${INK}`, boxShadow: `8px 8px 0 ${INK}`, maxWidth: 1380, whiteSpace: "normal", lineHeight: 1.15 }}>
          <Rich text={sub} size={40} />
        </div>
      </div>
      <div style={{ position: "absolute", right: 70, top: 60 + hop / 2 }}>
        <Mascot which="chat" size={320} mood="cheer" />
      </div>
      <div style={{ position: "absolute", left: midLeft, top: video.top + 40, width: midRight - midLeft, display: "flex", justifyContent: "center", transform: `scale(${pulse})` }}>
        <Pill size={60} bg={theme.accent} fg={WHITE} tilt={-2}>{cta}</Pill>
      </div>
      <div style={{ position: "absolute", left: (midLeft + midRight) / 2 - 150, bottom: 10 - hop }}>
        <Mascot which="poussin" size={300} mood="cheer" />
      </div>
      <div style={{ position: "absolute", left: video.left, top: video.top, width: video.width, height: video.height, borderRadius: 24, border: `4px dashed rgba(255,255,255,0.35)` }} />
      <div style={{ position: "absolute", left: subscribe.left, top: subscribe.top, width: subscribe.size, height: subscribe.size, borderRadius: subscribe.size / 2, border: `4px dashed rgba(255,255,255,0.35)` }} />
    </AbsoluteFill>
  );
};

// ---------- Vidéo longue v2 (09/11/2026) : transition « déchirure » portée par une mascotte ----------
// Un pan de couleur de la palette, au bord déchiré, balaie l'écran (0,4 s pour couvrir, 0,4 s pour découvrir) ; au milieu, la
// mascotte (chat / poussin en alternance) surgit au centre. Calque posé à cheval sur la frontière de deux scènes (cf. timeline.ts).
const TEAR = Array.from({ length: 13 }, (_, i) => ((i * 7919) % 100) / 100); // dents pseudo-aléatoires, stables d'un rendu à l'autre
export const Wipe: React.FC<{ theme: Theme; index: number; dur: number }> = ({ theme, index, dur }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const p = Math.min(1, frame / dur);
  const ltr = index % 2 === 0;
  const which: "chat" | "poussin" = ltr ? "chat" : "poussin";
  const color = index % 2 === 0 ? theme.accent : INK; // couleurs franches : la mascotte ressort, pas de pan délavé
  const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  // bord avant (recouvre) : -10 % → 110 % sur la 1re moitié ; bord arrière (découvre) : -10 % → 110 % sur la 2e moitié
  const lead = -0.12 + ease(Math.min(1, p * 2)) * 1.24;
  const trail = p < 0.5 ? -0.12 : -0.12 + ease((p - 0.5) * 2) * 1.24;
  const edge = (x: number, amp: number) => TEAR.map((t, i) => `${((ltr ? x : 1 - x) * 100 + (t - 0.5) * amp * 100).toFixed(2)}% ${(i / (TEAR.length - 1)) * 100}%`);
  const right = edge(lead, 0.06), left = edge(trail, 0.06).reverse();
  const poly = `polygon(${[...right, ...left].join(",")})`;
  const mid = spring({ frame: frame - dur * 0.28, fps, config: { damping: 9, stiffness: 160 } });
  const out = p > 0.72 ? 1 - (p - 0.72) / 0.28 : 1;
  const bob = Math.sin(frame / 2) * 6;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", inset: -20, background: color, clipPath: poly, boxShadow: `0 0 0 12px ${INK}` }} />
      {/* liseré blanc du bord avant */}
      <div style={{ position: "absolute", inset: -20, background: WHITE, opacity: 0.35, clipPath: `polygon(${[...edge(lead + (ltr ? 0.012 : -0.012), 0.06), ...edge(lead, 0.06).reverse()].join(",")})` }} />
      <div style={{ position: "absolute", left: width / 2 - 170, top: height / 2 - 190, transform: `scale(${mid * out}) rotate(${(ltr ? -1 : 1) * (8 - mid * 8) + bob}deg)`, opacity: Math.max(0, out) }}>
        <Mascot which={which} size={340} mood="cheer" />
      </div>
    </AbsoluteFill>
  );
};
// Toutes les transitions d'un gabarit (16:9) : une Sequence par changement de scène, à cheval sur la frontière.
export const WipeLayer: React.FC<{ theme: Theme; scenes: { from: number; index: number }[] }> = ({ theme, scenes }) => {
  const { fps } = useVideoConfig();
  const dur = Math.round(WIPE_SECONDS * fps);
  return (
    <>
      {scenes.map((w) => (
        <Sequence key={w.from} from={w.from - Math.round(dur / 2)} durationInFrames={dur} name={`Transition ${w.index + 1}`} layout="none">
          {has("whoosh") && <Audio src={staticFile("audio/whoosh.mp3")} volume={0.5} />}
          {has("pop") && (
            <Sequence from={Math.round(dur * 0.3)} layout="none">
              <Audio src={staticFile("audio/pop.mp3")} volume={0.6} />
            </Sequence>
          )}
          <Wipe theme={theme} index={w.index} dur={dur} />
        </Sequence>
      ))}
    </>
  );
};

// ---------- Vidéo longue v2 : intermède (vrai/faux ou 3 choix + anecdote), sans points ----------
export const InterludeCard: React.FC<{ episode: Episode; k: number; ask: number; dur: number }> = ({ episode, k, ask, dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = themeOf(episode);
  const T = tr(episode);
  const it = episode.interludes![k];
  const reveal = frame >= ask;
  const rf = frame - ask;
  const showAnswer = reveal && rf >= Math.round(0.3 * fps);
  const factAt = ask + Math.round((0.3 + (it.voice?.a?.sec ?? 1.5) + 0.4) * fps);
  const showFact = frame >= factAt;
  const enter = spring({ frame, fps, config: { damping: 12, stiffness: 150 } });
  const vf = it.type === "vf";
  const choices = vf ? [T.interludeTrue, T.interludeFalse] : (it.choices ?? []).slice(0, 3);
  const correct = vf ? (it.answer ? 0 : 1) : it.correct ?? 0;
  const qSize = it.q.length > 70 ? 58 : 66;
  const pillW = vf ? 520 : 540, gap = 36;
  const rowW = choices.length * pillW + (choices.length - 1) * gap;
  return (
    <AbsoluteFill style={{ alignItems: "center" }}>
      <div style={{ position: "absolute", top: 40, left: 60 }}>
        <Logo theme={theme} size={48} />
      </div>
      <div style={{ position: "absolute", top: 44, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 26, transform: `scale(${enter})` }}>
        <Pill size={40} bg={INK} fg={WHITE} tilt={-2}>{T.interludeTitle}</Pill>
        <Pill size={40} bg={theme.accent} fg={WHITE} tilt={2}>{vf ? T.interludeVf : T.interludeChoice}</Pill>
      </div>
      <div style={{ position: "absolute", top: 150, left: 200, right: 200, transform: `scale(${enter})` }}>
        <Card shape="round" style={{ minHeight: 250, padding: "28px 60px" }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: qSize, color: INK, textAlign: "center", lineHeight: 1.08 }}>
            <Rich text={it.q} size={qSize} />
          </div>
        </Card>
      </div>
      <div style={{ position: "absolute", top: showFact ? 450 : 470, left: (1920 - rowW) / 2, display: "flex", gap }}>
        {choices.map((c, i) => {
          const pop = spring({ frame: frame - 8 - i * 4, fps, config: { damping: 12, stiffness: 170 } });
          const good = showAnswer && i === correct;
          const grey = showAnswer && i !== correct;
          const bg = good ? OK : grey ? "#D8D8E0" : vf ? (i === 0 ? "#DFF8E8" : "#FFE1E1") : WHITE;
          const fg = good ? WHITE : grey ? "#8A8A9C" : INK;
          const wiggle = good ? 1 + 0.05 * Math.sin(frame / 2.5) * (rf < 30 ? 1 : 0) : 1;
          return (
            <div key={i} style={{ transform: `scale(${pop * wiggle})` }}>
              <Pill bg={bg} fg={fg} size={vf ? 60 : 44} style={{ width: pillW, height: vf ? 150 : 140, boxSizing: "border-box", justifyContent: "center", whiteSpace: "normal", textAlign: "center", lineHeight: 1.05 }}>
                {vf ? `${i === 0 ? "✅" : "❌"} ${c}` : `${["A", "B", "C"][i]} · ${c}`}
              </Pill>
            </div>
          );
        })}
      </div>
      {showAnswer && rf < 28 && <Burst theme={theme} x={(1920 - rowW) / 2 + correct * (pillW + gap) + pillW / 2} y={540} n={44} />}
      {showFact && (
        <div style={{ position: "absolute", bottom: 60, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
          <Sequence from={factAt} layout="none">
            <FactCard text={it.fact} theme={theme} lang={episode.lang} />
          </Sequence>
        </div>
      )}
      {!reveal && (
        <div style={{ position: "absolute", right: 60, bottom: 18 }}>
          <Countdown frame={frame} totalFrames={ask} theme={theme} size={200} kind="slider" rider="poussin" width={620} />
        </div>
      )}
      {!showFact && (
        <div style={{ position: "absolute", left: 60, bottom: 30, display: "flex", alignItems: "flex-end", gap: 10 }}>
          <Mascot which={reveal ? "chat" : "poussin"} size={220} mood={reveal ? "cheer" : "idle"} />
          <div style={{ marginBottom: 120 }}>
            <Bubble size={32}>{reveal ? T.interludeBack : T.interludeNoPoints}</Bubble>
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};

// ---------- Vidéo longue v2 : carte finale « Prochain quiz » (2 vidéos + S'abonner, modèle YouTube « 2 vidéos + élément S'abonner ») ----------
// Géométrie à vérifier en posant l'écran de fin dans YouTube Studio ; les gabarits pointillés guident l'œil vers les éléments.
// Mesuré dans YouTube Studio le 10/11/2026 : modèle « 2 vidéos » (éléments remontés en haut de la zone autorisée, y 141→490)
// + élément « S'abonner » ajouté et glissé en bas au centre (rond de 296 px, y 619→915). Zone autorisée par YouTube : y 141→915.
// Pose : scripts/endscreen-v2.playwright.js.
export const NEXT_SCREEN = { videos: [{ left: 45, top: 141, width: 619, height: 349 }, { left: 1014, top: 141, width: 619, height: 349 }], subscribe: { left: 813, top: 619, size: 296 } };
export const NextQuizCard: React.FC<{ theme: Theme; lang?: Lang }> = ({ theme, lang }) => {
  const T = tr({ lang });
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 10, stiffness: 120 } });
  const hop = Math.abs(Math.sin(frame / 7)) * 14;
  const point = Math.sin(frame / 8) * 6;
  const { videos, subscribe } = NEXT_SCREEN;
  const gapTop = videos[0].top + videos[0].height; // 490 : bande libre entre les vidéos et le rond S'abonner (490→619)
  return (
    <AbsoluteFill>
      {/* Bandeau du haut (0→141) : logo + titre sur une ligne */}
      <div style={{ position: "absolute", top: 22, left: 0, right: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 40, opacity: pop, transform: `translateY(${(1 - pop) * 30}px)` }}>
        <Logo theme={theme} size={56} />
        <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 92, color: WHITE, textShadow: `7px 7px 0 ${INK}`, lineHeight: 1, letterSpacing: 2 }}>{T.nextQuiz}</div>
      </div>
      {videos.map((v, i) => (
        <div key={i} style={{ position: "absolute", left: v.left, top: v.top, width: v.width, height: v.height, borderRadius: 24, border: `5px dashed rgba(255,255,255,0.55)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontSize: 90, opacity: 0.5, transform: `scale(${1 + Math.sin(frame / 6 + i) * 0.05})` }}>▶️</div>
        </div>
      ))}
      {/* Bande du milieu (490→619) : consigne */}
      <div style={{ position: "absolute", top: gapTop + 28, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
        <Pill size={38} bg={theme.accent} fg={WHITE} tilt={-1}>{T.nextQuizSub}</Pill>
      </div>
      <div style={{ position: "absolute", left: subscribe.left, top: subscribe.top, width: subscribe.size, height: subscribe.size, borderRadius: subscribe.size / 2, border: `5px dashed rgba(255,255,255,0.55)` }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: subscribe.top + subscribe.size + 18, display: "flex", justifyContent: "center" }}>
        <Pill size={30} tilt={1}>{T.nextQuizSubscribe}</Pill>
      </div>
      {/* Mascottes de part et d'autre du rond, dans la bande du bas, sans toucher les éléments YouTube */}
      <div style={{ position: "absolute", left: 300, top: 640 - hop, transform: `rotate(${point}deg)`, transformOrigin: "bottom center" }}>
        <Mascot which="chat" size={300} mood="cheer" />
      </div>
      <div style={{ position: "absolute", right: 300, top: 660 - hop, transform: `rotate(${-point}deg)`, transformOrigin: "bottom center" }}>
        <Mascot which="poussin" size={270} mood="cheer" />
      </div>
    </AbsoluteFill>
  );
};

// ---------- Voix off : clip optionnel ----------
export const Voice: React.FC<{ clip?: VoiceClip; from?: number; volume?: number }> = ({ clip, from = 0, volume = 1 }) => {
  if (!clip) return null;
  return (
    <Sequence from={from}>
      <Audio src={staticFile(clip.src)} volume={volume} />
    </Sequence>
  );
};

// ---------- Champion de la semaine (4 s après l'intro) ----------
export const ChampionCard: React.FC<{ theme: Theme; name: string; score: number; lang?: Lang }> = ({ theme, name, score, lang }) => {
  const T = tr({ lang });
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 9, stiffness: 140 } });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 28 }}>
      <div style={{ transform: `scale(${0.7 + pop * 0.3})`, opacity: pop, display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
        <Pill size={44} bg={INK} fg={STREAK} tilt={-2}>{T.championTitle}</Pill>
        <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 120, color: WHITE, textShadow: `8px 8px 0 ${INK}`, lineHeight: 1 }}>{name}</div>
        <Pill size={56} bg={theme.accent} fg={WHITE} tilt={2}>{T.championPoints(score)}</Pill>
        <Pill size={36}>{T.championCta}</Pill>
      </div>
      <div style={{ position: "absolute", left: 80, bottom: 30 }}><Mascot which="chat" size={320} mood="cheer" /></div>
      <div style={{ position: "absolute", right: 80, bottom: 30 }}><Mascot which="poussin" size={280} mood="cheer" /></div>
      <Burst theme={theme} x={960} y={400} n={40} />
    </AbsoluteFill>
  );
};

// ---------- Abonnement (3 s, texte variable) : bouton + cloche qui sonne ----------
export const SubscribeCard: React.FC<{ theme: Theme; vertical?: boolean; title?: string; sub?: string; lang?: Lang }> = ({ theme, vertical = false, title: t, sub: s, lang }) => {
  const T = tr({ lang });
  const title = t ?? T.subscribeTitle, sub = s ?? T.subscribeSub;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 9, stiffness: 150 } });
  const click = spring({ frame: frame - 20, fps, config: { damping: 8, stiffness: 200 } });
  const ring = frame > 30 ? Math.sin((frame - 30) / 1.5) * 18 * Math.max(0, 1 - (frame - 30) / 45) : 0;
  const sc = vertical ? 0.8 : 1;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 34 * sc }}>
      <div style={{ display: "flex", alignItems: "center", gap: 30 * sc, transform: `scale(${0.7 + pop * 0.3})`, opacity: pop }}>
        <div style={{ background: click > 0.5 ? "#8E8E8E" : "#FF0033", color: WHITE, fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 64 * sc, padding: `${18 * sc}px ${44 * sc}px`, borderRadius: 999, border: `6px solid ${INK}`, boxShadow: `8px 8px 0 ${INK}`, transform: `scale(${1 - (click > 0.5 && click < 0.9 ? 0.08 : 0)})` }}>
          {click > 0.5 ? T.subscribedButton : T.subscribeButton}
        </div>
        <div style={{ transform: `rotate(${ring}deg)`, transformOrigin: "top center" }}>
          <Emoji value="🔔" size={120 * sc} />
        </div>
      </div>
      <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 68 * sc, color: WHITE, textShadow: `6px 6px 0 ${INK}`, textAlign: "center", lineHeight: 1.05, maxWidth: vertical ? 900 : 1500, opacity: pop }}>
        <Rich text={title} size={68 * sc} />
      </div>
      <Pill size={38 * sc} bg={theme.accent} fg={WHITE} tilt={-2} style={{ whiteSpace: "normal", textAlign: "center", maxWidth: vertical ? 900 : 1400 }}>{sub}</Pill>
      <div style={{ position: "absolute", left: 60, bottom: 30 }}><Mascot which="chat" size={vertical ? 220 : 300} mood="cheer" /></div>
    </AbsoluteFill>
  );
};

// ---------- Carte de niveau (texte variable par épisode) ----------
export const LevelCard: React.FC<{ episode: Episode; level: Level; vertical?: boolean; k?: number }> = ({ episode, level, vertical = false, k = 1 }) => {
  const T = tr(episode);
  const card = episode.variants?.levels?.[level]?.card ?? T.levelCard[level];
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 36 }}>
      <Pop>
        <LevelBadge level={level} size={(vertical ? 64 : 80) * k} tilt={-3} lang={episode.lang} />
      </Pop>
      <Pop delay={5}>
        <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: (vertical ? 80 : 96) * k * (card.length > 24 ? 0.8 : 1), color: WHITE, textShadow: `6px 6px 0 ${INK}`, textAlign: "center", padding: "0 60px", lineHeight: 1.05 }}>
          <Rich text={card} size={(vertical ? 80 : 96) * k * (card.length > 24 ? 0.8 : 1)} />
        </div>
      </Pop>
      <Pop delay={10}>
        <Pill size={(vertical ? 36 : 44) * k}>{T.levelTime(LEVELS[level].points)}</Pill>
      </Pop>
    </AbsoluteFill>
  );
};

// ---------- Short : accroche 1,5 s ----------
// 2e Short (09/11/2026) : `line` remplace « à la Ne question » (ex. « aux 8 questions les plus dures 🔥 »).
export const ShortHook: React.FC<{ theme: Theme; hook: string; n: number; sticker?: string; line?: string; lang?: Lang }> = ({ theme, hook, n, sticker: st, line, lang }) => {
  const T = tr({ lang });
  const sticker = st ?? T.shortSticker;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 7, stiffness: 220 } });
  return (
    <AbsoluteFill style={{ alignItems: "center" }}>
      <div style={{ position: "absolute", top: 150, transform: `scale(${0.7 + pop * 0.3})` }}>
        <Logo theme={theme} size={150} />
      </div>
      <div style={{ position: "absolute", top: 440, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 36, padding: "0 50px" }}>
        <div style={{ transform: `scale(${0.5 + pop * 0.5}) rotate(-3deg)`, background: "#FF3B3B", color: WHITE, fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: sticker.length > 14 ? 84 : 108, padding: "20px 44px", borderRadius: 30, border: `9px solid ${INK}`, boxShadow: `14px 14px 0 ${INK}`, textAlign: "center", lineHeight: 1, whiteSpace: "nowrap" }}>
          {sticker}
        </div>
        <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 88, color: WHITE, textShadow: `7px 7px 0 ${INK}`, textAlign: "center", lineHeight: 1.05, opacity: pop, maxWidth: 960 }}>
          <Rich text={line ?? T.nthQuestion(n)} size={line && line.length > 26 ? 72 : 88} />
        </div>
        <Pill size={46} tilt={2}>{T.secondsPerQuestion}</Pill>
      </div>
      <div style={{ position: "absolute", bottom: 380, display: "flex", gap: 40, alignItems: "flex-end" }}>
        <Mascot which="chat" size={320} mood="shock" />
        <Mascot which="poussin" size={280} mood="shock" />
      </div>
    </AbsoluteFill>
  );
};

// ---------- Short : cliffhanger (4 s) ----------
export const CliffCard: React.FC<{ theme: Theme; total: number; isChoice?: boolean; lang?: Lang }> = ({ theme, total, isChoice = false, lang }) => {
  const T = tr({ lang });
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 9, stiffness: 160 } });
  const pulse = 1 + Math.sin(frame / 5) * 0.04;
  return (
    <AbsoluteFill style={{ alignItems: "center" }}>
      <div style={{ position: "absolute", top: 150 }}>
        <Logo theme={theme} size={120} />
      </div>
      <div style={{ position: "absolute", top: 400, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 34, padding: "0 50px" }}>
        <div style={{ transform: `scale(${0.6 + pop * 0.4})`, fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 110, color: WHITE, textShadow: `8px 8px 0 ${INK}`, textAlign: "center", lineHeight: 1 }}>
          <Rich text={isChoice ? T.cliffAndYou : T.cliffAnswer} size={110} />
        </div>
        <Pill size={50} bg={theme.accent} fg={WHITE} tilt={-2} style={{ whiteSpace: "normal", textAlign: "center", maxWidth: 940, lineHeight: 1.15 }}>
          {isChoice ? T.cliffBodyChoice(total) : T.cliffBody(total)}
        </Pill>
        <div style={{ transform: `scale(${pulse})` }}>
          <Pill size={48} bg={INK} fg={WHITE} tilt={1} style={{ whiteSpace: "normal", textAlign: "center", maxWidth: 940 }}>{T.cliffLink}</Pill>
        </div>
        <Pill size={40} tilt={-1} style={{ whiteSpace: "normal", textAlign: "center", maxWidth: 940 }}>{T.cliffCreate}</Pill>
      </div>
      <div style={{ position: "absolute", bottom: 380, left: 60 }}><Mascot which="poussin" size={280} mood="shock" /></div>
      <div style={{ position: "absolute", bottom: 380, right: 60 }}><Mascot which="chat" size={300} mood="cheer" /></div>
    </AbsoluteFill>
  );
};

// ---------- Intro commune : jingle logo (2 s) puis hook + CTA variable ----------
export const IntroCard: React.FC<{ episode: Episode; vertical: boolean; k?: number }> = ({ episode, vertical, k = 1 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = themeOf(episode);
  const fast = !!useFx().fast && !vertical; // première question avant 15 s : pas de phase logo (le logo vient de passer au pré-roll), règle reportée sur la question 1
  const logoPhase = frame < 2 * fps && !vertical && !fast;
  const sc = vertical ? 0.78 : 1;
  const bounce = spring({ frame, fps, config: { damping: 8, stiffness: 120 } });
  if (logoPhase)
    return (
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ transform: `scale(${1 + bounce * 1.2})` }}>
          <Logo theme={theme} size={110} />
        </div>
        <Burst theme={theme} x={960} y={540} n={40} />
      </AbsoluteFill>
    );
  const f = vertical || fast ? frame : frame - 2 * fps;
  const rule = fast ? undefined : episode.variants?.rule;
  const hookSize = (vertical ? 108 : 140) * sc * (k > 1 ? 0.9 : 1) * (episode.intro.hook.length > 34 ? 0.82 : 1) * (rule ? 0.82 : 1);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 30 * sc, padding: 80 }}>
      <div style={{ position: "absolute", top: 40, left: 60 }}>
        <Logo theme={theme} size={54} />
      </div>
      <Pop delay={vertical || fast ? 0 : 2 * fps}>
        <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: hookSize, textAlign: "center", lineHeight: 1, color: WHITE, textShadow: `8px 8px 0 ${INK}`, maxWidth: vertical ? 920 : 1600 }}>
          <Rich text={episode.intro.hook} size={hookSize} />
        </div>
      </Pop>
      {/* Vidéo longue v2 : la règle du jeu (lue par la voix) remplace le sous-titre quand l'épisode en a une. */}
      {rule && !vertical ? (
        <Pop delay={2 * fps + 6}>
          <div style={{ fontFamily: FONT_BODY, fontWeight: 600, fontSize: 42 * k, color: INK, background: WHITE, border: `6px solid ${INK}`, boxShadow: `8px 8px 0 ${INK}`, padding: "16px 34px", borderRadius: 26, textAlign: "center", lineHeight: 1.2, maxWidth: 1380, whiteSpace: "normal" }}>
            <Rich text={rule} size={42 * k} />
          </div>
        </Pop>
      ) : (
        <Pop delay={(vertical || fast ? 0 : 2 * fps) + 6}>
          <Pill size={(vertical ? 44 : 56) * sc * k} tilt={-2} bg={theme.soft} style={{ whiteSpace: "normal", textAlign: "center" }}>
            {episode.intro.sub}
          </Pill>
        </Pop>
      )}
      <Pop delay={(vertical || fast ? 0 : 2 * fps) + 12}>
        <Pill size={(vertical ? 36 : 44) * sc * k} tilt={2} style={{ whiteSpace: "normal", textAlign: "center" }}>
          {episode.variants?.introCta ?? tr(episode).introCtaDefault}
        </Pill>
      </Pop>
      <div style={{ position: "absolute", left: 50, bottom: 30 }}>
        <Mascot which="chat" size={vertical ? 240 : 340} mood="cheer" />
      </div>
      <div style={{ position: "absolute", right: 50, bottom: 30 }}>
        <Mascot which="poussin" size={vertical ? 220 : 300} mood="cheer" />
      </div>
      {f >= 0 && f < 18 && <Burst theme={theme} x={vertical ? 540 : 960} y={400} n={30} />}
    </AbsoluteFill>
  );
};

// ---------- Outro commune (titre variable) ----------
export const OutroCard: React.FC<{ episode: Episode; vertical: boolean; isChoice?: boolean; k?: number }> = ({ episode, vertical, isChoice = false, k = 1 }) => {
  const frame = useCurrentFrame();
  const theme = themeOf(episode);
  const sc = vertical ? 0.8 : 1;
  const pulse = 1 + Math.sin(frame / 6) * 0.03;
  const T = tr(episode);
  const title = episode.variants?.outro?.title ?? (isChoice ? T.outroChoices : T.outroScore);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 40 * sc, padding: 80 }}>
      <Pop>
        <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 104 * sc * k * (title.length > 30 ? 0.78 : 1), color: WHITE, textShadow: `7px 7px 0 ${INK}`, textAlign: "center", lineHeight: 1.05, maxWidth: 1600 }}>
          <Rich text={title} size={104 * sc * k * (title.length > 30 ? 0.78 : 1)} />
        </div>
      </Pop>
      <Pop delay={8}>
        <Pill size={44 * sc * k} tilt={-2} style={{ whiteSpace: "normal", textAlign: "center" }}>{vertical ? T.outroShort : T.outroSubscribe}</Pill>
      </Pop>
      <Pop delay={16}>
        <div style={{ transform: `scale(${pulse})` }}>
          <Pill size={56 * sc * k} bg={theme.accent} fg={WHITE} tilt={2} style={{ whiteSpace: "normal", textAlign: "center" }}>{episode.cta.text}</Pill>
        </div>
      </Pop>
      <div style={{ position: "absolute", left: 60, bottom: 30 }}>
        <Mascot which="chat" size={vertical ? 230 : 320} mood="cheer" />
      </div>
      <div style={{ position: "absolute", right: 60, bottom: 30 }}>
        <Mascot which="poussin" size={vertical ? 210 : 280} mood="cheer" />
      </div>
    </AbsoluteFill>
  );
};

// ---------- Segments communs à tous les gabarits (pré-roll, packshot, champion, abonnement, cliff, intro, niveau, outro) ----------
// Les gabarits ne gardent que question / révélation / score. Retourne null pour les segments qu'ils rendent eux-mêmes.
export const CommonSegment: React.FC<{ s: Segment; episode: Episode; vertical: boolean; k?: number; index: number }> = ({ s, episode, vertical, k = 1, index }) => {
  const theme = themeOf(episode);
  const v = episode.variants;
  const isChoice = episode.timing.reveal <= 0;
  if (s.kind === "preroll")
    return (
      <Sequence key={index} from={s.from} durationInFrames={s.dur} name="Pré-roll">
        {episode.voice?.preroll ? <Voice clip={episode.voice.preroll} from={8} /> : has("preroll") && <Audio src={staticFile("audio/preroll.mp3")} volume={1} />}
        <Preroll theme={theme} text={v?.preroll?.text} vertical={vertical} lang={episode.lang} baseline={v?.baseline} line={v?.preroll?.line} />
      </Sequence>
    );
  if (s.kind === "packshot")
    return (
      <Sequence key={index} from={s.from} durationInFrames={s.dur} name="Packshot">
        {episode.voice?.nextQuiz ? <Voice clip={episode.voice.nextQuiz} from={14} /> : episode.voice?.packshot ? <Voice clip={episode.voice.packshot} from={14} /> : has("packshot") && <Audio src={staticFile("audio/packshot.mp3")} volume={1} />}
        {has("fanfare") && <Audio src={staticFile("audio/fanfare.mp3")} volume={0.5} />}
        {/* Vidéo longue v2 : carte « Prochain quiz » (2 vidéos + S'abonner) dès que l'épisode porte sa voix ; sinon l'ancien packshot site. */}
        {episode.voice?.nextQuiz || episode.variants?.nextQuizVoice ? <NextQuizCard theme={theme} lang={episode.lang} /> : <Packshot theme={theme} headline={v?.packshot?.headline} sub={v?.packshot?.sub} cta={v?.packshot?.cta} lang={episode.lang} />}
      </Sequence>
    );
  if (s.kind === "interlude")
    return (
      <Sequence key={index} from={s.from} durationInFrames={s.dur} name={`Intermède ${s.index + 1}`}>
        <InterludeAudio episode={episode} k={s.index} ask={s.ask} />
        <InterludeCard episode={episode} k={s.index} ask={s.ask} dur={s.dur} />
      </Sequence>
    );
  if (s.kind === "champion")
    return (
      <Sequence key={index} from={s.from} durationInFrames={s.dur} name="Champion">
        {has("fanfare") && <Audio src={staticFile("audio/fanfare.mp3")} volume={0.5} />}
        <Voice clip={episode.voice?.champion} />
        <ChampionCard theme={theme} name={episode.champion!.name} score={episode.champion!.score} lang={episode.lang} />
      </Sequence>
    );
  if (s.kind === "subscribe")
    return (
      <Sequence key={index} from={s.from} durationInFrames={s.dur} name="Abonnement">
        {has("ding") && <Audio src={staticFile("audio/ding.mp3")} volume={0.6} />}
        <Voice clip={episode.voice?.subscribe} from={4} />
        <SubscribeCard theme={theme} vertical={vertical} title={v?.subscribe?.title} sub={v?.subscribe?.sub} lang={episode.lang} />
      </Sequence>
    );
  if (s.kind === "cliff")
    return (
      <Sequence key={index} from={s.from} durationInFrames={s.dur} name="Cliffhanger">
        {has("whoosh") && <Audio src={staticFile("audio/whoosh.mp3")} volume={0.7} />}
        <Voice clip={episode.voice?.cliff} from={6} />
        <CliffCard theme={theme} total={episode.meta.totalItems ?? episode.items.length} isChoice={isChoice} lang={episode.lang} />
      </Sequence>
    );
  if (s.kind === "intro")
    return (
      <Sequence key={index} from={s.from} durationInFrames={s.dur} name="Intro">
        {has("jingle") && <Audio src={staticFile("audio/jingle.mp3")} volume={episode.voice?.intro ? 0.45 : 0.8} />}
        {!vertical && <Voice clip={episode.voice?.intro} from={10} />}
        {vertical ? <ShortHook theme={theme} hook={episode.intro.hook} n={Math.min(8, episode.items.length)} sticker={episode.meta.thumbnail.sticker} line={episode.meta.shortLine} lang={episode.lang} /> : <IntroCard episode={episode} vertical={vertical} k={k} />}
      </Sequence>
    );
  if (s.kind === "level")
    return (
      <Sequence key={index} from={s.from} durationInFrames={s.dur} name={`Niveau ${s.level}`}>
        {has("whoosh") && <Audio src={staticFile("audio/whoosh.mp3")} volume={0.6} />}
        <Voice clip={episode.voice?.[`level_${s.level}`]} from={8} />
        <LevelCard episode={episode} level={s.level} vertical={vertical} k={k} />
      </Sequence>
    );
  if (s.kind === "outro")
    return (
      <Sequence key={index} from={s.from} durationInFrames={s.dur} name="Outro">
        <Voice clip={episode.voice?.outro} from={10} />
        <OutroCard episode={episode} vertical={vertical} isChoice={isChoice} k={k} />
      </Sequence>
    );
  return null;
};

// ---------- Musique de fond + tic-tac de la question (communs) ----------
export const MusicBed: React.FC<{ episode: Episode }> = ({ episode }) => {
  const m = musicFile(episode);
  return m ? <Audio src={staticFile(m)} volume={0.16} loop /> : null;
};
export const Ticks: React.FC<{ episode: Episode; index: number; dur: number; until?: number }> = ({ episode, index, dur, until }) => {
  const { fps } = useVideoConfig();
  if (!has("tick")) return null;
  const voiced = Math.ceil(episode.items[index].voice?.q?.sec ?? 0);
  const limit = Math.min(dur, until ?? dur);
  return (
    <>
      {Array.from({ length: Math.ceil(limit / fps) }).map((_, sec) =>
        sec >= voiced ? (
          <Sequence key={sec} from={sec * fps} durationInFrames={Math.min(fps, dur - sec * fps)}>
            <Audio src={staticFile("audio/tick.mp3")} volume={episode.items[index].voice?.q ? 0.25 : 0.45} />
          </Sequence>
        ) : null,
      )}
    </>
  );
};
// Son d'un intermède : question lue, tic-tac après la lecture, ding + réponse lue à la révélation, puis l'anecdote.
export const InterludeAudio: React.FC<{ episode: Episode; k: number; ask: number }> = ({ episode, k, ask }) => {
  const { fps } = useVideoConfig();
  const v = episode.interludes?.[k]?.voice;
  const start = Math.ceil((v?.q?.sec ?? 0) + 0.2);
  return (
    <>
      <Voice clip={v?.q} from={6} />
      {has("tick") &&
        Array.from({ length: Math.max(0, Math.ceil(ask / fps) - start) }).map((_, i) => (
          <Sequence key={i} from={(start + i) * fps} durationInFrames={Math.min(fps, ask - (start + i) * fps)}>
            <Audio src={staticFile("audio/tick.mp3")} volume={0.25} />
          </Sequence>
        ))}
      <Sequence from={ask} layout="none">
        {has("ding") && <Audio src={staticFile("audio/ding.mp3")} volume={0.45} />}
        <Voice clip={v?.a} from={Math.round(0.3 * fps)} />
      </Sequence>
      <Voice clip={v?.f} from={ask + Math.round((0.3 + (v?.a?.sec ?? 1.5) + 0.4) * fps)} />
    </>
  );
};
export const quipFor = (ep: Episode, pool: string[], index: number): string => pool[hash(ep.id + "q" + index) % pool.length];
export const tiltFor = (ep: Episode, index: number, step = 0.9): number => ((hash(ep.id + index) % 5) - 2) * step;
