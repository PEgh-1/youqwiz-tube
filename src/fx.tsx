// Finitions v3 (14/11/2026) — pilotes des lots B (finition), C (synchro voix) et D (mascottes animées).
// Paquets officiels Remotion : @remotion/layout-utils (texte ajusté à sa zone), @remotion/motion-blur (flou de mouvement).
import React from "react";
import { AbsoluteFill, Audio, Sequence, continueRender, delayRender, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { fitTextOnNLines } from "@remotion/layout-utils";
import { CameraMotionBlur } from "@remotion/motion-blur";
import { AUDIO, Burst, Emoji, Mascot, Pill, Rich } from "./components";
import { FONT_BODY, FONT_DISPLAY, INK, WHITE } from "./theme";
import type { Theme } from "./theme";
import type { VoiceClip } from "./types";
import { FX_TRANSITION } from "./timeline";
import type { Lang } from "./i18n";

const has = (k: string) => AUDIO[k] === true;
const ease = (x: number) => { const c = Math.min(1, Math.max(0, x)); return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2; };

// ---------- Polices prêtes avant toute mesure de texte ----------
let fontsReady = false;
export const useFontsReady = (): boolean => {
  const [ok, setOk] = React.useState(fontsReady);
  const [handle] = React.useState(() => (fontsReady ? null : delayRender("polices YouQwiz")));
  React.useEffect(() => {
    if (fontsReady || handle === null) return;
    const specs = ["800 40px 'Baloo 2'", "600 40px 'Baloo 2'", "600 40px 'Fredoka'", "400 40px 'Fredoka'"];
    Promise.all(specs.map((f) => document.fonts.load(f)))
      .catch(() => undefined)
      .then(() => { fontsReady = true; setOk(true); continueRender(handle); });
  }, [handle]);
  return ok;
};

// ---------- Lot B : texte ajusté à une boîte (1 à `maxLines` lignes), mesuré avec la vraie police ----------
// Remplace les seuils « plus de 70 caractères → plus petit » : la taille est la plus grande qui tient, sans jamais déborder.
export const fitLines = (text: string, W: number, H: number, max: number, maxLines = 3, weight = 800, family = "Baloo 2", lineHeight = 1.08): { size: number; lines: string[] } => {
  let best = { size: 0, lines: [text] };
  for (let n = 1; n <= maxLines; n++) {
    try {
      const r = fitTextOnNLines({ text, maxLines: n, maxBoxWidth: W, fontFamily: family, fontWeight: weight, maxFontSize: max, validateFontIsLoaded: false });
      const size = Math.min(r.fontSize, H / (r.lines.length * lineHeight));
      if (size > best.size * 1.02) best = { size, lines: r.lines };
    } catch { /* mesure impossible (police absente) : on garde le meilleur résultat */ }
  }
  return best.size > 0 ? best : { size: max * 0.7, lines: [text] };
};

// ---------- Lot C : mot en cours de lecture ----------
/** Index du dernier mot commencé à l'instant t (s), -1 avant le premier ; null sans horodatage. */
export const spokenIndex = (clip: VoiceClip | undefined, t: number): number | null => {
  if (!clip?.words?.length) return null;
  let cur = -1;
  for (let i = 0; i < clip.words.length; i++) { if (clip.words[i][1] <= t) cur = i; else break; }
  return cur;
};
/** Fin réelle de la phrase (s) : fin du dernier mot horodaté, sinon durée du clip. */
export const speechEnd = (clip: VoiceClip | undefined): number => (clip?.words?.length ? clip.words[clip.words.length - 1][2] : clip?.sec ?? 0);
const norm = (w: string) => w.toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "");

// Question affichée en entier dès le départ, puis colorée mot à mot au rythme de la voix (le mot en cours saute et prend la
// couleur d'accent, les mots déjà lus restent à l'encre, les suivants sont estompés). `lines` vient de fitLines.
export const SyncLines: React.FC<{ lines: string[]; size: number; clip?: VoiceClip; from?: number; accent: string; on: boolean }> = ({ lines, size, clip, from = 0, accent, on }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tokens = lines.map((l) => l.trim().split(/\s+/).filter(Boolean));
  const flat = tokens.flat();
  const words = clip?.words;
  // La voix lit parfois une amorce avant la question (« On continue. ») : on cale la fin des deux textes l'une sur l'autre.
  const offset = words ? words.length - flat.length : 0;
  const matched = on && !!words && offset >= 0 && flat.length > 0 && norm(words[words.length - 1][0]) === norm(flat[flat.length - 1]) && norm(words[offset][0]) === norm(flat[0]);
  const t = (frame - from) / fps;
  const cur = matched ? (spokenIndex(clip, t) ?? -1) - offset : flat.length;
  let k = 0;
  return (
    <>
      {tokens.map((line, li) => (
        <div key={li} style={{ whiteSpace: "nowrap" }}>
          {line.map((w, wi) => {
            const i = k++;
            const active = matched && i === cur && t < words![offset + i][2] + 0.12;
            const done = !matched || i < cur || (i === cur && !active);
            const since = matched && i <= cur ? frame - from - Math.round(words![offset + i][1] * fps) : 99;
            const hop = active ? -size * 0.07 * Math.max(0, 1 - since / 5) : 0;
            return (
              <React.Fragment key={wi}>
                {wi > 0 ? " " : null}
                <span style={{ display: "inline-block", color: active ? accent : INK, opacity: done || active ? 1 : 0.32, transform: `translateY(${hop}px)` }}>
                  <Rich text={w} size={size} />
                </span>
              </React.Fragment>
            );
          })}
        </div>
      ))}
    </>
  );
};

// ---------- Baseline de la chaîne, en permanence sous le logo ----------
export const Baseline: React.FC<{ text: string; size?: number }> = ({ text, size = 24 }) => (
  <div style={{ fontFamily: FONT_BODY, fontWeight: 600, fontSize: size, color: INK, background: WHITE, border: `3px solid ${INK}`, borderRadius: 999, padding: `${size * 0.18}px ${size * 0.7}px`, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: size * 0.35 }}>
    <Emoji value="💡" size={size * 0.95} />
    {text}
  </div>
);

// ---------- Lot B : transition mascottes (1,3 s) ----------
// Quatre mises en scène qui tournent : tope-là du chat et du poussin (rideaux qui se ferment, choc au centre, étoiles), clin d'œil
// du poussin, tope-là inversé, chat « défi ». L'écran reste couvert 0,55 s : assez pour voir le geste, et la scène change dessous.
const TOPE: Record<Lang, string[]> = { fr: ["Tope là !", "Tope là !", "Tope là !", "Tope là !"], en: ["High five!", "High five!", "High five!", "High five!"] };
const SOLO: Record<Lang, string[]> = { fr: ["Et hop !", "On enchaîne !", "Suivante !", "C'est reparti !"], en: ["Here we go!", "Keep going!", "Next one!", "Let's go!"] };
const TransitionScene: React.FC<{ theme: Theme; index: number; dur: number; lang?: Lang }> = ({ theme, index, dur, lang = "fr" }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const [c0, c1] = [Math.round(FX_TRANSITION.closed[0] * fps), Math.round(FX_TRANSITION.closed[1] * fps)];
  const close = ease(frame / c0);
  const open = ease((frame - c1) / (dur - c1));
  const kind = index % 4;
  const hit = frame - c0; // images depuis le choc
  const squash = hit >= 0 ? Math.max(0, 1 - hit / 6) : 0;
  const hop = hit >= 4 ? Math.abs(Math.sin(((hit - 4) / 9) * Math.PI)) * -46 * Math.max(0, 1 - (hit - 4) / 20) : 0;
  const label = ((index % 2 === 0 ? TOPE : SOLO)[lang] ?? (index % 2 === 0 ? TOPE : SOLO).fr)[Math.floor(index / 2) % 4];
  const pop = spring({ frame: hit, fps, config: { damping: 9, stiffness: 190 } });
  const out = 1 - open;

  if (kind === 0 || kind === 2) {
    // Rideaux : deux pans se rejoignent au centre, une mascotte sur chaque bord.
    const half = width / 2 + 30;
    const shift = (1 - close) * half + open * half;
    const swap = kind === 2;
    const colL = swap ? INK : theme.accent, colR = swap ? theme.accent : INK;
    const size = 380;
    const meet = 26 * squash; // les deux se penchent l'un vers l'autre au moment du choc
    const side = (left: boolean) => {
      const which: "chat" | "poussin" = left !== swap ? "chat" : "poussin";
      return (
        <div style={{ position: "absolute", top: height / 2 - size / 2 + 40 + hop, [left ? "right" : "left"]: 34 - meet, transform: `scale(${1 + squash * 0.1},${1 - squash * 0.12}) rotate(${(left ? 1 : -1) * (6 + squash * 10)}deg) ${which === "poussin" && left ? "scaleX(-1)" : ""} ${which === "chat" && !left ? "scaleX(-1)" : ""}`, transformOrigin: "bottom center" }}>
          <Mascot which={which} size={size} mood="idle" pose={which === "poussin" ? (hit >= 6 && hit < 16 ? "wink" : "open") : undefined} still />
        </div>
      );
    };
    return (
      <AbsoluteFill style={{ pointerEvents: "none" }}>
        <div style={{ position: "absolute", top: -20, bottom: -20, left: -30, width: half, background: colL, borderRight: `14px solid ${WHITE}`, transform: `translateX(${-shift}px)` }}>{side(true)}</div>
        <div style={{ position: "absolute", top: -20, bottom: -20, right: -30, width: half, background: colR, borderLeft: `14px solid ${WHITE}`, transform: `translateX(${shift}px)` }}>{side(false)}</div>
        {hit >= 0 && frame < c1 && (
          <>
            <Sequence from={c0} layout="none"><Burst theme={theme} x={width / 2} y={height / 2 + 40} n={40} /></Sequence>
            <div style={{ position: "absolute", top: height / 2 - 330, left: 0, right: 0, display: "flex", justifyContent: "center", transform: `scale(${pop}) rotate(-4deg)` }}>
              <Pill size={64} bg={theme.soft} tilt={0}>{label}</Pill>
            </div>
            {[-1, 1].map((s) => (
              <div key={s} style={{ position: "absolute", left: width / 2 - 45 + s * (70 + pop * 60), top: height / 2 - 150 - pop * 50, transform: `scale(${pop * Math.max(0, 1 - hit / 16)}) rotate(${s * 20}deg)` }}>
                <Emoji value="✨" size={90} />
              </div>
            ))}
          </>
        )}
      </AbsoluteFill>
    );
  }
  // Pan unique qui monte du bas, mascotte au centre : clin d'œil du poussin (1) ou chat « défi » (3).
  const y = (1 - close) * (height + 60) - open * (height + 60);
  const which: "chat" | "poussin" = kind === 1 ? "poussin" : "chat";
  const size = 460;
  const wink = hit >= 5 && hit < 15;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: -20, right: -20, top: -30, height: height + 60, background: kind === 1 ? theme.accent : INK, borderTop: `14px solid ${WHITE}`, borderBottom: `14px solid ${WHITE}`, transform: `translateY(${y}px)` }}>
        <div style={{ position: "absolute", left: width / 2 - size / 2 + 20, top: height / 2 - size / 2 + 50 + hop, transform: `scale(${(0.5 + pop * 0.5) * (1 + squash * 0.06)}) rotate(${Math.sin(frame / 3) * 3 * out}deg)`, transformOrigin: "bottom center" }}>
          <Mascot which={which} size={size} mood={which === "chat" ? "dare" : "idle"} pose={which === "poussin" ? (wink ? "wink" : "open") : undefined} still />
        </div>
        {which === "poussin" && wink && (
          <div style={{ position: "absolute", left: width / 2 + 110, top: height / 2 - 150, transform: `scale(${Math.sin(((hit - 5) / 10) * Math.PI) * 1.2}) rotate(15deg)` }}>
            <Emoji value="✨" size={120} />
          </div>
        )}
        {hit >= 0 && (
          <div style={{ position: "absolute", top: height / 2 - 330, left: 0, right: 0, display: "flex", justifyContent: "center", transform: `scale(${pop}) rotate(3deg)` }}>
            <Pill size={64} bg={WHITE} tilt={0}>{label}</Pill>
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

export const MascotTransition: React.FC<{ theme: Theme; index: number; dur: number; lang?: Lang }> = (props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const [c0, c1] = [Math.round(FX_TRANSITION.closed[0] * fps), Math.round(FX_TRANSITION.closed[1] * fps)];
  // Flou de mouvement seulement pendant la fermeture et l'ouverture (là où ça bouge vite) : net pendant le geste.
  const moving = frame < c0 || frame >= c1;
  return moving ? (
    <CameraMotionBlur shutterAngle={120} samples={12}>
      <TransitionScene {...props} />
    </CameraMotionBlur>
  ) : (
    <TransitionScene {...props} />
  );
};

// Calque des transitions v3 : une par changement de scène, posée à cheval sur la frontière (0,6 s avant, 0,7 s après).
export const MascotTransitionLayer: React.FC<{ theme: Theme; scenes: { from: number; index: number }[]; lang?: Lang }> = ({ theme, scenes, lang }) => {
  const { fps } = useVideoConfig();
  const dur = Math.round(FX_TRANSITION.total * fps);
  const before = Math.round(FX_TRANSITION.before * fps);
  const c0 = Math.round(FX_TRANSITION.closed[0] * fps), c1 = Math.round(FX_TRANSITION.closed[1] * fps);
  return (
    <>
      {scenes.map((w) => (
        <Sequence key={w.from} from={w.from - before} durationInFrames={dur} name={`Transition v3 ${w.index + 1}`} layout="none">
          {has("whoosh") && <Audio src={staticFile("audio/whoosh.mp3")} volume={0.5} />}
          <Sequence from={c0} layout="none">
            {has("pop") && <Audio src={staticFile("audio/pop.mp3")} volume={0.8} />}
            {w.index % 4 === 1 && has("ding") && <Sequence from={5} layout="none"><Audio src={staticFile("audio/ding.mp3")} volume={0.4} /></Sequence>}
          </Sequence>
          <Sequence from={c1} layout="none">{has("whoosh") && <Audio src={staticFile("audio/whoosh.mp3")} volume={0.35} />}</Sequence>
          <MascotTransition theme={theme} index={w.index} dur={dur} lang={lang} />
        </Sequence>
      ))}
    </>
  );
};

// ---------- Lot B : flou de mouvement sur une entrée (les `frames` premières images seulement) ----------
export const BlurIn: React.FC<{ on: boolean; frames?: number; children: React.ReactNode }> = ({ on, frames = 12, children }) => {
  const frame = useCurrentFrame();
  return on && frame < frames ? <CameraMotionBlur shutterAngle={120} samples={10}>{children}</CameraMotionBlur> : <>{children}</>;
};

export { interpolate };
