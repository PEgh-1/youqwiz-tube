// « La minute culture générale, offerte par YouQwiz.com » (pilote du 11/11/2026) : Short 9:16 quotidien façon réclame des
// années 30-40. Déroulé : accroche (la question, tout de suite) → virgule sonore avec le titre → 3 choix + décompte « amorce de
// film » → réponse + anecdote → « Ça vous a plu ? … YouQwiz.com ». Habillage : papier crème, rayons, grain, rayures, vignette.
import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import audioManifest from "./audio.json";
import { Mascot, Voice } from "./components";
import { FONT_BODY, FONT_DISPLAY, fontFaces } from "./theme";
import type { VoiceClip } from "./types";

export type Minute = {
  id: string;
  hook: string;
  choices: string[];
  correct: number;
  fact: string;
  /** baseline dite à voix haute après le titre (sinon seulement en bandeau) */
  sayBaseline?: boolean;
  comment?: string;
  voice?: { hook?: VoiceClip; title?: VoiceClip; choices?: VoiceClip; answer?: VoiceClip; fact?: VoiceClip; outro?: VoiceClip };
};

const has = (k: string) => Boolean((audioManifest as Record<string, unknown>)[k]);
const CREAM = "#F4E7C6", PAPER = "#EBD9AE", BROWN = "#2B1B12", RED = "#C8372D", MUSTARD = "#E0A526", TEAL = "#1F6F78";
export const BASELINE = "Aujourd'hui, scroller va vous rendre plus malin";

export const minuteTimeline = (m: Minute, fps: number) => {
  const s = (x: number) => Math.round(x * fps);
  const v = m.voice ?? {};
  const hook = s((v.hook?.sec ?? 3) + 0.35);
  const sting = s(Math.max(1.8, (v.title?.sec ?? 2.6) + 0.25));
  const read = s((v.choices?.sec ?? 2.6) + 0.2);
  const think = s(3);
  const answerAt = s(0.25);
  const factAt = answerAt + s((v.answer?.sec ?? 1.6) + 0.35);
  const reveal = factAt + s((v.fact?.sec ?? 5) + 0.6);
  const outro = s((v.outro?.sec ?? 4.5) + 0.9);
  const t0 = 0, t1 = hook, t2 = t1 + sting, t3 = t2 + read + think, t4 = t3 + reveal;
  return { hook: { from: t0, dur: hook }, sting: { from: t1, dur: sting }, choices: { from: t2, dur: read + think, read, think }, reveal: { from: t3, dur: reveal, answerAt, factAt }, outro: { from: t4, dur: outro }, total: t4 + outro };
};

// ---------- décor ----------
const Rays: React.FC = () => {
  const frame = useCurrentFrame();
  const n = 24;
  return (
    <AbsoluteFill style={{ background: CREAM, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 540 - 1500, top: 860 - 1500, width: 3000, height: 3000, transform: `rotate(${frame * 0.12}deg)`, background: `repeating-conic-gradient(${PAPER} 0deg ${360 / n / 2}deg, ${CREAM} ${360 / n / 2}deg ${360 / n}deg)` }} />
      <AbsoluteFill style={{ background: "radial-gradient(circle at 50% 45%, rgba(244,231,198,0.0) 30%, rgba(90,55,25,0.55) 100%)" }} />
    </AbsoluteFill>
  );
};
// Grain, rayures verticales, poussières et scintillement de vieux film (au-dessus de tout).
const FilmWear: React.FC = () => {
  const frame = useCurrentFrame();
  const r = (k: number) => { const x = Math.sin((Math.floor(frame / 2) + 1) * 12.9898 * (k + 1)) * 43758.5453; return x - Math.floor(x); };
  const flick = 0.04 + r(1) * 0.05;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <svg width="1080" height="1920" style={{ position: "absolute", inset: 0, opacity: 0.2, mixBlendMode: "multiply" }}>
        <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={Math.floor(frame / 2) % 40} /><feColorMatrix type="saturate" values="0" /></filter>
        <rect width="1080" height="1920" filter="url(#grain)" />
      </svg>
      {[2, 3, 4].map((k) => r(k) > 0.45 && <div key={k} style={{ position: "absolute", top: 0, bottom: 0, left: r(k + 10) * 1080, width: r(k + 20) > 0.6 ? 3 : 2, background: "rgba(43,27,18,0.28)" }} />)}
      {[5, 6, 7, 8, 9].map((k) => r(k) > 0.55 && <div key={k} style={{ position: "absolute", left: r(k + 30) * 1040, top: r(k + 40) * 1880, width: 6 + r(k + 50) * 14, height: 6 + r(k + 60) * 10, borderRadius: 20, background: "rgba(43,27,18,0.35)" }} />)}
      <AbsoluteFill style={{ background: BROWN, opacity: flick }} />
      <AbsoluteFill style={{ boxShadow: "inset 0 0 260px 70px rgba(30,15,5,0.75)" }} />
    </AbsoluteFill>
  );
};
const poster = (size: number, color = BROWN, shadow = MUSTARD): React.CSSProperties => ({ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: size, color, lineHeight: 1.02, textTransform: "uppercase", letterSpacing: 1, textShadow: `5px 5px 0 ${shadow}`, textAlign: "center" });
// Bandeau permanent du haut : le titre de la rubrique.
const Masthead: React.FC<{ big?: number }> = () => (
  <div style={{ position: "absolute", top: 150, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
    <div style={{ background: RED, color: CREAM, fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 50, letterSpacing: 3, padding: "8px 44px", border: `6px solid ${BROWN}`, boxShadow: `8px 8px 0 ${BROWN}`, transform: "rotate(-2deg)", textTransform: "uppercase", whiteSpace: "nowrap" }}>La minute culture générale</div>
    <div style={{ fontFamily: FONT_BODY, fontWeight: 600, fontSize: 32, color: BROWN, fontStyle: "italic", marginTop: 6 }}>offerte par <b style={{ color: RED, fontStyle: "normal" }}>YouQwiz.com</b></div>
  </div>
);
const BaselineBar: React.FC = () => (
  <div style={{ position: "absolute", bottom: 290, left: 60, right: 60, display: "flex", justifyContent: "center" }}>
    <div style={{ fontFamily: FONT_BODY, fontWeight: 600, fontStyle: "italic", fontSize: 34, color: CREAM, background: BROWN, padding: "10px 30px", borderRadius: 40, border: `4px solid ${MUSTARD}`, textAlign: "center" }}>{`«\u00a0${BASELINE}\u00a0»`}</div>
  </div>
);
const nb = (t: string) => t.replace(/ ([?!:;»])/g, "\u00a0$1").replace(/« /g, "«\u00a0");
const Sepia: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => <div style={{ filter: "sepia(0.65) saturate(0.85) contrast(1.05)", ...style }}>{children}</div>;

// ---------- scènes ----------
const Hook: React.FC<{ m: Minute }> = ({ m }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 11, stiffness: 170 } });
  const size = m.hook.length > 60 ? 84 : m.hook.length > 40 ? 96 : 110;
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", top: 380, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
        <div style={{ width: 330, height: 330, borderRadius: 200, background: MUSTARD, border: `10px solid ${BROWN}`, boxShadow: `12px 12px 0 ${BROWN}`, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${pop}) rotate(${Math.sin(frame / 6) * 8}deg)` }}>
          <div style={{ ...poster(250, RED, BROWN), lineHeight: 1 }}>?</div>
        </div>
      </div>
      <div style={{ position: "absolute", top: 770, left: 70, right: 70, transform: `scale(${0.6 + 0.4 * pop})`, opacity: pop }}>
        <div style={{ background: CREAM, border: `8px solid ${BROWN}`, boxShadow: `14px 14px 0 ${BROWN}`, padding: "44px 40px", borderRadius: 18 }}>
          <div style={poster(size)}>{nb(m.hook)}</div>
        </div>
      </div>
      <Sepia style={{ position: "absolute", left: 150, top: 1290 }}><Mascot which="poussin" size={240} mood="idle" /></Sepia>
      <Sepia style={{ position: "absolute", right: 150, top: 1280 }}><Mascot which="chat" size={250} mood="idle" /></Sepia>
    </AbsoluteFill>
  );
};
const Sting: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 9, stiffness: 150 } });
  const pop2 = spring({ frame: frame - 10, fps, config: { damping: 10, stiffness: 150 } });
  const out = interpolate(frame, [dur - 6, dur], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const pts = Array.from({ length: 36 }, (_, i) => { const a = (i / 36) * Math.PI * 2, rr = i % 2 ? 470 : 400; return `${540 + Math.cos(a) * rr},${800 + Math.sin(a) * rr}`; }).join(" ");
  return (
    <AbsoluteFill style={{ opacity: out }}>
      <svg width="1080" height="1920" style={{ position: "absolute", inset: 0, transform: `scale(${pop}) rotate(${frame * 0.6}deg)`, transformOrigin: "540px 800px" }}>
        <polygon points={pts} fill={RED} stroke={BROWN} strokeWidth="10" />
      </svg>
      <div style={{ position: "absolute", top: 560, left: 120, right: 120, transform: `scale(${pop}) rotate(-4deg)` }}>
        <div style={{ ...poster(64, CREAM, BROWN) }}>La minute</div>
        <div style={{ ...poster(128, CREAM, BROWN), marginTop: 6 }}>Culture</div>
        <div style={{ ...poster(104, MUSTARD, BROWN) }}>générale</div>
      </div>
      <div style={{ position: "absolute", top: 1290, left: 0, right: 0, display: "flex", justifyContent: "center", transform: `scale(${pop2})` }}>
        <div style={{ background: CREAM, border: `7px solid ${BROWN}`, boxShadow: `10px 10px 0 ${BROWN}`, padding: "14px 44px", transform: "rotate(2deg)" }}>
          <span style={{ fontFamily: FONT_BODY, fontStyle: "italic", fontWeight: 600, fontSize: 44, color: BROWN }}>offerte par </span>
          <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 60, color: RED }}>YouQwiz.com</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
const Choices: React.FC<{ m: Minute; read: number; think: number; revealed?: boolean; local?: number }> = ({ m, read, think, revealed }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const size = m.hook.length > 60 ? 58 : 68;
  const left = Math.max(0, Math.ceil((read + think - frame) / fps));
  const counting = !revealed && frame >= read;
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", top: 370, left: 70, right: 70 }}>
        <div style={{ ...poster(size), textShadow: `4px 4px 0 ${MUSTARD}` }}>{nb(m.hook)}</div>
      </div>
      <div style={{ position: "absolute", top: 650, left: 80, right: 80, display: "flex", flexDirection: "column", gap: 40 }}>
        {m.choices.slice(0, 3).map((c, i) => {
          const pop = revealed ? 1 : spring({ frame: frame - 4 - i * 7, fps, config: { damping: 12, stiffness: 170 } });
          const good = revealed && i === m.correct, bad = revealed && i !== m.correct;
          const wig = good && frame < 30 ? 1 + 0.05 * Math.sin(frame / 2) : 1;
          return (
            <div key={i} style={{ transform: `scale(${pop * wig}) rotate(${i % 2 ? 1 : -1}deg)`, opacity: bad ? 0.45 : 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 26, background: good ? RED : CREAM, border: `7px solid ${BROWN}`, boxShadow: `10px 10px 0 ${BROWN}`, borderRadius: 16, padding: "24px 30px", minHeight: 136 }}>
                <div style={{ width: 92, height: 92, flexShrink: 0, borderRadius: 60, background: good ? CREAM : [TEAL, MUSTARD, RED][i], border: `6px solid ${BROWN}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 58, color: good ? RED : CREAM }}>{good ? "✓" : ["A", "B", "C"][i]}</div>
                <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: c.length > 18 ? 60 : 74, color: good ? CREAM : BROWN, lineHeight: 1.05 }}>{c}</div>
              </div>
            </div>
          );
        })}
      </div>
      {counting && (
        <div style={{ position: "absolute", top: 1290, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
          {/* amorce de film : cercle, croix et chiffre */}
          <div style={{ width: 250, height: 250, borderRadius: 200, border: `10px solid ${BROWN}`, background: PAPER, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${1 + 0.06 * Math.sin((frame - read) / fps * Math.PI * 2)})` }}>
            <div style={{ position: "absolute", left: 0, right: 0, top: "50%", height: 4, background: "rgba(43,27,18,0.4)" }} />
            <div style={{ position: "absolute", top: 0, bottom: 0, left: "50%", width: 4, background: "rgba(43,27,18,0.4)" }} />
            <div style={{ position: "absolute", inset: 0, borderRadius: 200, background: `conic-gradient(rgba(200,55,45,0.55) ${(((frame - read) % fps) / fps) * 360}deg, transparent 0deg)` }} />
            <div style={{ ...poster(170, BROWN, CREAM), position: "relative" }}>{left}</div>
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
const Reveal: React.FC<{ m: Minute; factAt: number }> = ({ m, factAt }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame: frame - factAt, fps, config: { damping: 12, stiffness: 150 } });
  return (
    <AbsoluteFill>
      <Choices m={m} read={0} think={0} revealed />
      {frame >= factAt && (
        <div style={{ position: "absolute", top: 1265, left: 60, right: 60, transform: `scale(${pop}) rotate(-1deg)` }}>
          <div style={{ background: TEAL, border: `7px solid ${BROWN}`, boxShadow: `12px 12px 0 ${BROWN}`, borderRadius: 18, padding: "26px 34px 30px" }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 46, color: MUSTARD, letterSpacing: 3, textTransform: "uppercase", textAlign: "center" }}>★ Le saviez-vous ? ★</div>
            <div style={{ fontFamily: FONT_BODY, fontWeight: 600, fontSize: m.fact.length > 100 ? 46 : 54, color: CREAM, lineHeight: 1.18, textAlign: "center", marginTop: 8 }}>{nb(m.fact)}</div>
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
const Outro: React.FC<{ m: Minute }> = ({ m }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = spring({ frame, fps, config: { damping: 10, stiffness: 150 } });
  const b = spring({ frame: frame - 14, fps, config: { damping: 9, stiffness: 140 } });
  const c = spring({ frame: frame - 30, fps, config: { damping: 8, stiffness: 160 } });
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", top: 400, left: 60, right: 60, transform: `scale(${a}) rotate(-3deg)` }}>
        <div style={poster(124, RED, BROWN)}>Ça vous a plu ?</div>
      </div>
      <div style={{ position: "absolute", top: 640, left: 80, right: 80, opacity: a }}>
        <div style={{ fontFamily: FONT_BODY, fontWeight: 600, fontSize: 52, color: BROWN, textAlign: "center", lineHeight: 1.15 }}>Retrouvez nos derniers quiz sur</div>
      </div>
      <div style={{ position: "absolute", top: 800, left: 60, right: 60, transform: `scale(${b})` }}>
        <div style={{ background: CREAM, border: `9px solid ${BROWN}`, boxShadow: `14px 14px 0 ${RED}`, borderRadius: 20, padding: "22px 10px" }}>
          <div style={{ ...poster(128, BROWN, MUSTARD), textTransform: "none" }}>YouQwiz.com</div>
        </div>
      </div>
      <div style={{ position: "absolute", top: 730, right: 50, transform: `scale(${c}) rotate(14deg)` }}>
        <div style={{ border: `8px double ${RED}`, color: RED, fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 58, padding: "2px 22px", letterSpacing: 4, background: "rgba(244,231,198,0.92)", borderRadius: 10 }}>GRATUIT</div>
      </div>
      <div style={{ position: "absolute", top: 1110, left: 90, right: 90, opacity: c }}>
        <div style={{ fontFamily: FONT_BODY, fontWeight: 600, fontStyle: "italic", fontSize: 44, color: CREAM, background: TEAL, border: `6px solid ${BROWN}`, borderRadius: 50, padding: "16px 30px", textAlign: "center" }}>{nb(m.comment ?? "Vous le saviez ? Dites-le en commentaire !")}</div>
      </div>
      <Sepia style={{ position: "absolute", left: 110, top: 1270 }}><Mascot which="chat" size={300} mood="cheer" /></Sepia>
      <Sepia style={{ position: "absolute", right: 110, top: 1290 }}><Mascot which="poussin" size={270} mood="cheer" /></Sepia>
    </AbsoluteFill>
  );
};

export const MinuteCulture: React.FC<{ minute: Minute }> = ({ minute: m }) => {
  const { fps } = useVideoConfig();
  const T = minuteTimeline(m, fps);
  const v = m.voice ?? {};
  return (
    <AbsoluteFill style={{ fontFamily: FONT_BODY }}>
      <style>{fontFaces()}</style>
      <Rays />
      {has("crackle") && <Audio src={staticFile("audio/crackle.mp3")} volume={0.5} loop />}
      <Sequence from={T.hook.from} durationInFrames={T.hook.dur} name="Accroche">
        <Voice clip={v.hook} from={3} />
        <Masthead />
        <Hook m={m} />
        <BaselineBar />
      </Sequence>
      <Sequence from={T.sting.from} durationInFrames={T.sting.dur} name="Virgule">
        {has("fanfare") && <Audio src={staticFile("audio/fanfare.mp3")} volume={0.35} />}
        <Voice clip={v.title} from={4} />
        <Sting dur={T.sting.dur} />
        <BaselineBar />
      </Sequence>
      <Sequence from={T.choices.from} durationInFrames={T.choices.dur} name="Choix">
        <Voice clip={v.choices} from={3} />
        {has("tick") && [0, 1, 2].map((i) => (
          <Sequence key={i} from={T.choices.read + i * fps} durationInFrames={fps} layout="none"><Audio src={staticFile("audio/tick.mp3")} volume={0.5} /></Sequence>
        ))}
        <Masthead />
        <Choices m={m} read={T.choices.read} think={T.choices.think} />
        <BaselineBar />
      </Sequence>
      <Sequence from={T.reveal.from} durationInFrames={T.reveal.dur} name="Réponse">
        {has("ding") && <Audio src={staticFile("audio/ding.mp3")} volume={0.5} />}
        <Voice clip={v.answer} from={T.reveal.answerAt} />
        <Voice clip={v.fact} from={T.reveal.factAt} />
        <Masthead />
        <Reveal m={m} factAt={T.reveal.factAt} />
      </Sequence>
      <Sequence from={T.outro.from} durationInFrames={T.outro.dur} name="Fin">
        {has("pop") && <Audio src={staticFile("audio/pop.mp3")} volume={0.5} />}
        <Voice clip={v.outro} from={6} />
        <Masthead />
        <Outro m={m} />
      </Sequence>
      <FilmWear />
    </AbsoluteFill>
  );
};
