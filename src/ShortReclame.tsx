// Shorts extraits v3 « Le quiz express » (11/11/2026) : même univers réclame que « La minute culture générale ».
// 5 questions de difficulté croissante tirées de l'épisode du jour, chaque réponse donnée (la dernière aussi), fin « Combien sur 5 ? ».
// Déroulé : accroche (titre + défi) → 5 × (question + décompte 3 s → réponse) → appel au commentaire et à la chaîne.
import React from "react";
import { AbsoluteFill, Audio, Img, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import audioManifest from "./audio.json";
import { FitText, Mascot, PromptView, Rich, Voice } from "./components";
import { BaselineBar, CREAM, FilmWear, Rays, Sepia, nb, poster } from "./MinuteCulture";
import { FONT_BODY, FONT_DISPLAY, THEMES, fontFaces } from "./theme";
import type { Level, Prompt, VoiceClip } from "./types";

const PAPER = "#EBD9AE", BROWN = "#2B1B12", RED = "#C8372D", MUSTARD = "#E0A526", TEAL = "#1F6F78";
const has = (k: string) => Boolean((audioManifest as Record<string, unknown>)[k]);
const THEME = { ...THEMES[0], accent: RED, soft: PAPER };

export type ReclameItem = { prompt: Prompt; answer: string; level: Level; /** anecdote dite après la réponse (dernière question) */ fact?: string; voice?: { q?: VoiceClip; a?: VoiceClip } };
export type Reclame = {
  id: string;
  /** « 5 pays sans voyelles » : chiffre + nom, affichés sur l'accroche */
  noun: string;
  /** consigne affichée au-dessus de la carte (« Quel est ce pays ? ») ; ignorée pour un QCM (la question est dans l'item) */
  question: string;
  dare: string;
  items: ReclameItem[];
  outro: { head: string; sub: string };
  voice?: { hook?: VoiceClip; outro?: VoiceClip };
};

const LEVEL: Record<Level, { label: string; bg: string; fg: string }> = {
  facile: { label: "Facile", bg: TEAL, fg: CREAM },
  moyen: { label: "Moyen", bg: MUSTARD, fg: BROWN },
  difficile: { label: "Difficile", bg: RED, fg: CREAM },
  impossible: { label: "Pour les champions", bg: BROWN, fg: MUSTARD },
};
const isDilemma = (it: ReclameItem) => it.prompt.type === "choices";

export const reclameTimeline = (r: Reclame, fps: number) => {
  const s = (x: number) => Math.round(x * fps);
  const hook = s((r.voice?.hook?.sec ?? 3.4) + 0.25);
  let t = hook;
  const items = r.items.map((it) => {
    const read = s((it.voice?.q?.sec ?? (it.prompt.type === "qcm" || isDilemma(it) ? 3 : 0.9)) + 0.15);
    const think = s(isDilemma(it) ? 2.5 : 3);
    const reveal = isDilemma(it) ? 0 : s(Math.max(1.6, (it.voice?.a?.sec ?? 1.3) + 0.45));
    const seg = { from: t, read, think, ask: read + think, reveal };
    t += read + think + reveal;
    return seg;
  });
  const outro = s((r.voice?.outro?.sec ?? 5) + 0.9);
  return { hook: { from: 0, dur: hook }, items, outro: { from: t, dur: outro }, total: t + outro };
};

const Masthead: React.FC = () => (
  <div style={{ position: "absolute", top: 150, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
    <div style={{ background: RED, color: CREAM, fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 62, letterSpacing: 4, padding: "6px 50px", border: `6px solid ${BROWN}`, boxShadow: `8px 8px 0 ${BROWN}`, transform: "rotate(-2deg)", textTransform: "uppercase", whiteSpace: "nowrap" }}>Le quiz express</div>
    <div style={{ fontFamily: FONT_BODY, fontWeight: 600, fontSize: 32, color: BROWN, fontStyle: "italic", marginTop: 6 }}>offert par <b style={{ color: RED, fontStyle: "normal" }}>YouQwiz.com</b></div>
  </div>
);

// ---------- accroche ----------
const Hook: React.FC<{ r: Reclame }> = ({ r }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = spring({ frame, fps, config: { damping: 11, stiffness: 170 } });
  const b = spring({ frame: frame - 8, fps, config: { damping: 10, stiffness: 160 } });
  const c = spring({ frame: frame - 18, fps, config: { damping: 9, stiffness: 160 } });
  const size = r.noun.length > 22 ? 96 : r.noun.length > 14 ? 116 : 140;
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", top: 362, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
        <div style={{ width: 340, height: 340, borderRadius: 200, background: MUSTARD, border: `10px solid ${BROWN}`, boxShadow: `12px 12px 0 ${BROWN}`, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${a}) rotate(${Math.sin(frame / 6) * 6}deg)` }}>
          <div style={{ ...poster(290, RED, BROWN), lineHeight: 1 }}>{r.items.length}</div>
        </div>
      </div>
      <div style={{ position: "absolute", top: 740, left: 60, right: 60, transform: `scale(${0.6 + 0.4 * b})`, opacity: b }}>
        <div style={{ background: CREAM, border: `8px solid ${BROWN}`, boxShadow: `14px 14px 0 ${BROWN}`, padding: "36px 30px", borderRadius: 18 }}>
          <div style={poster(size)}>{nb(r.noun)}</div>
        </div>
      </div>
      <div style={{ position: "absolute", top: 1090, left: 0, right: 0, display: "flex", justifyContent: "center", transform: `scale(${c}) rotate(-4deg)` }}>
        <div style={{ border: `8px double ${RED}`, color: RED, fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 62, padding: "4px 30px", letterSpacing: 4, background: "rgba(244,231,198,0.92)", borderRadius: 10, textTransform: "uppercase" }}>De plus en plus dur</div>
      </div>
      <div style={{ position: "absolute", top: 1230, left: 60, right: 60, opacity: c }}>
        <div style={{ ...poster(74, BROWN, MUSTARD), textTransform: "none" }}>{nb(r.dare)}</div>
      </div>
      <Sepia style={{ position: "absolute", left: 60, top: 1330 }}><Mascot which="poussin" size={220} mood="cheer" /></Sepia>
      <Sepia style={{ position: "absolute", right: 60, top: 1320 }}><Mascot which="chat" size={230} mood="dare" /></Sepia>
    </AbsoluteFill>
  );
};

// ---------- question / réponse ----------
const Lamps: React.FC<{ n: number; index: number; done: boolean }> = ({ n, index, done }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ position: "absolute", top: 348, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 26 }}>
      {Array.from({ length: n }, (_, i) => {
        const past = i < index || (i === index && done), cur = i === index && !done;
        return (
          <div key={i} style={{ width: 96, height: 96, borderRadius: 60, background: past ? TEAL : cur ? RED : PAPER, border: `7px solid ${BROWN}`, boxShadow: `6px 6px 0 ${BROWN}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 58, color: past || cur ? CREAM : "rgba(43,27,18,0.45)", transform: cur ? `scale(${1.12 + 0.05 * Math.sin(frame / 4)})` : undefined }}>{past ? "✓" : i + 1}</div>
        );
      })}
    </div>
  );
};
const count = (v: string) => [...new Intl.Segmenter("fr", { granularity: "grapheme" }).segment(v)].filter((g) => g.segment.trim()).length;
const PromptCard: React.FC<{ it: ReclameItem; revealed: boolean }> = ({ it, revealed }) => {
  const p = it.prompt;
  const box: React.CSSProperties = { background: CREAM, border: `8px solid ${BROWN}`, boxShadow: `14px 14px 0 ${BROWN}`, borderRadius: 22 };
  if (p.type === "qcm")
    return (
      <div style={{ position: "absolute", top: 690, left: 60, right: 60, display: "flex", flexDirection: "column", gap: 22 }}>
        {p.choices.map((c, i) => {
          const good = revealed && i === p.correct, bad = revealed && i !== p.correct;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 24, background: good ? RED : CREAM, border: `7px solid ${BROWN}`, boxShadow: `9px 9px 0 ${BROWN}`, borderRadius: 16, padding: "14px 26px", height: 116, opacity: bad ? 0.4 : 1, transform: `rotate(${i % 2 ? 0.8 : -0.8}deg)` }}>
              <div style={{ width: 78, height: 78, flexShrink: 0, borderRadius: 60, background: good ? CREAM : [TEAL, MUSTARD, RED, BROWN][i % 4], border: `5px solid ${BROWN}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 50, color: good ? RED : CREAM }}>{good ? "✓" : "ABCD"[i]}</div>
              <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: c.length > 26 ? 44 : c.length > 16 ? 54 : 66, color: good ? CREAM : BROWN, lineHeight: 1.05 }}>{c}</div>
            </div>
          );
        })}
      </div>
    );
  if (p.type === "choices")
    return (
      <div style={{ position: "absolute", top: 560, left: 60, right: 60, display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
        {p.value.map((v, i) => (
          <React.Fragment key={i}>
            {i > 0 && <div style={{ zIndex: 2, margin: "-26px 0", width: 130, height: 130, borderRadius: 80, background: RED, border: `8px solid ${BROWN}`, display: "flex", alignItems: "center", justifyContent: "center", ...poster(60, CREAM, BROWN) }}>ou</div>}
            <div style={{ ...box, width: "100%", height: 330, background: i ? PAPER : CREAM, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px 36px", transform: `rotate(${i ? 1 : -1}deg)`, fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: v.length > 44 ? 62 : v.length > 30 ? 72 : 86, color: BROWN, textAlign: "center", lineHeight: 1.08 }}>
              <div><Rich text={v} size={v.length > 44 ? 62 : v.length > 30 ? 72 : 86} /></div>
            </div>
          </React.Fragment>
        ))}
      </div>
    );
  const n = p.type === "emoji" ? count(p.value) : 1;
  return (
    <div style={{ position: "absolute", top: 640, left: 60, right: 60, height: 570, ...box, display: "flex", alignItems: "center", justifyContent: "center", transform: "rotate(-1deg)", overflow: "hidden" }}>
      {p.type === "text" ? <FitText text={p.value} big={330} W={860} H={470} color={BROWN} /> : p.type === "image" ? <Img src={staticFile(p.value)} style={{ maxWidth: 860, maxHeight: 480, borderRadius: 18 }} /> : <PromptView prompt={p} theme={THEME} big={p.type === "emoji" ? Math.min(400, 840 / (n * 1.13)) : 360} vertical maxW={840} maxH={470} />}
    </div>
  );
};
const Stage: React.FC<{ r: Reclame; index: number; revealed: boolean; read: number; think: number; dur: number }> = ({ r, index, revealed, read, think, dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const it = r.items[index];
  const pop = spring({ frame, fps, config: { damping: 12, stiffness: 180 } });
  const lv = LEVEL[it.level];
  const q = it.prompt.type === "qcm" ? it.prompt.value : isDilemma(it) ? "Vous préférez…" : r.question;
  const counting = !revealed && frame >= read;
  const left = Math.max(1, Math.ceil((read + think - frame) / fps));
  const withFact = revealed && !!it.fact;
  const dil = isDilemma(it);
  return (
    <AbsoluteFill>
      <Lamps n={r.items.length} index={index} done={revealed} />
      <div style={{ position: "absolute", top: dil ? 462 : 468, left: 50, right: 50, height: dil ? 90 : 160, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ ...poster(q.length > 70 ? 46 : q.length > 46 ? 54 : q.length > 30 ? 64 : 76), textTransform: "none", textShadow: `4px 4px 0 ${MUSTARD}` }}>{nb(q)}</div>
      </div>
      <div style={{ position: "absolute", inset: 0, transform: revealed ? undefined : `scale(${0.85 + 0.15 * pop})`, transformOrigin: "540px 920px", opacity: revealed ? 1 : pop }}>
        <PromptCard it={it} revealed={revealed} />
      </div>
      {/* niveau : tampon sur le coin de la carte */}
      {!dil && (
        <div style={{ position: "absolute", top: it.prompt.type === "qcm" ? 1250 : 606, right: it.prompt.type === "qcm" ? undefined : 40, left: it.prompt.type === "qcm" ? 60 : undefined, transform: "rotate(5deg)", background: lv.bg, color: lv.fg, border: `6px solid ${BROWN}`, boxShadow: `6px 6px 0 ${BROWN}`, fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 44, letterSpacing: 2, textTransform: "uppercase", padding: "2px 24px", borderRadius: 10, display: it.prompt.type === "qcm" && (counting || revealed) ? "none" : undefined }}>{lv.label}</div>
      )}
      {/* décompte « amorce de film » */}
      {counting && (
        <div style={{ position: "absolute", top: 1262, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
          <div style={{ width: 250, height: 250, borderRadius: 200, border: `10px solid ${BROWN}`, background: PAPER, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${1 + 0.06 * Math.sin(((frame - read) / fps) * Math.PI * 2)})` }}>
            <div style={{ position: "absolute", left: 0, right: 0, top: "50%", height: 4, background: "rgba(43,27,18,0.4)" }} />
            <div style={{ position: "absolute", top: 0, bottom: 0, left: "50%", width: 4, background: "rgba(43,27,18,0.4)" }} />
            <div style={{ position: "absolute", inset: 0, borderRadius: 200, background: `conic-gradient(rgba(200,55,45,0.55) ${(((frame - read) % fps) / fps) * 360}deg, transparent 0deg)` }} />
            <div style={{ ...poster(170, BROWN, CREAM), position: "relative" }}>{left}</div>
          </div>
        </div>
      )}
      {!revealed && !withFact && (
        <>
          <Sepia style={{ position: "absolute", left: 70, top: 1290 }}><Mascot which="poussin" size={210} mood="idle" /></Sepia>
          <Sepia style={{ position: "absolute", right: 70, top: 1280 }}><Mascot which="chat" size={220} mood={index === r.items.length - 1 ? "dare" : "idle"} /></Sepia>
        </>
      )}
      {/* réponse */}
      {revealed && !dil && (() => {
        const rp = spring({ frame: frame - (dur ? 0 : 0), fps, config: { damping: 9, stiffness: 190 } });
        const a = it.answer;
        return (
          <div style={{ position: "absolute", top: 1262, left: 50, right: 50, transform: `scale(${rp}) rotate(-2deg)` }}>
            <div style={{ background: RED, border: `8px solid ${BROWN}`, boxShadow: `12px 12px 0 ${BROWN}`, borderRadius: 18, padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "center", minHeight: withFact ? 150 : 230 }}>
              <div style={{ ...poster(a.length > 26 ? 66 : a.length > 16 ? 88 : withFact ? 108 : 128, CREAM, BROWN), textTransform: "none" }}>{nb(a)}</div>
            </div>
          </div>
        );
      })()}
      {withFact ? (
        <div style={{ position: "absolute", top: 1440, left: 60, right: 60, transform: "rotate(1deg)" }}>
          <div style={{ background: TEAL, border: `6px solid ${BROWN}`, boxShadow: `9px 9px 0 ${BROWN}`, borderRadius: 16, padding: "14px 26px", fontFamily: FONT_BODY, fontWeight: 600, fontSize: it.fact!.length > 90 ? 38 : 44, color: CREAM, lineHeight: 1.15, textAlign: "center" }}>{nb(it.fact!)}</div>
        </div>
      ) : (
        <BaselineBar />
      )}
    </AbsoluteFill>
  );
};

// ---------- fin ----------
const Outro: React.FC<{ r: Reclame }> = ({ r }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = spring({ frame, fps, config: { damping: 10, stiffness: 150 } });
  const b = spring({ frame: frame - 12, fps, config: { damping: 9, stiffness: 140 } });
  const c = spring({ frame: frame - 26, fps, config: { damping: 8, stiffness: 160 } });
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", top: 385, left: 50, right: 50, transform: `scale(${a}) rotate(-3deg)` }}>
        <div style={poster(r.outro.head.length > 16 ? 112 : 136, RED, BROWN)}>{nb(r.outro.head)}</div>
      </div>
      <div style={{ position: "absolute", top: 690, left: 70, right: 70, transform: `scale(${b})` }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 62, color: CREAM, background: TEAL, border: `7px solid ${BROWN}`, boxShadow: `9px 9px 0 ${BROWN}`, borderRadius: 60, padding: "16px 30px", textAlign: "center" }}>{nb(r.outro.sub)}</div>
      </div>
      <div style={{ position: "absolute", top: 880, left: 70, right: 70, opacity: b }}>
        <div style={{ fontFamily: FONT_BODY, fontWeight: 600, fontSize: 54, color: BROWN, textAlign: "center", lineHeight: 1.1 }}>Le grand quiz complet vous attend sur</div>
      </div>
      <div style={{ position: "absolute", top: 1010, left: 60, right: 60, transform: `scale(${c})` }}>
        <div style={{ background: CREAM, border: `9px solid ${BROWN}`, boxShadow: `14px 14px 0 ${RED}`, borderRadius: 20, padding: "22px 10px" }}>
          <div style={{ ...poster(100, BROWN, MUSTARD), textTransform: "none" }}>YouTube · YouQwiz</div>
        </div>
      </div>
      <div style={{ position: "absolute", top: 1205, left: 0, right: 0, display: "flex", justifyContent: "center", transform: `scale(${c}) rotate(-3deg)` }}>
        <div style={{ border: `8px double ${RED}`, color: RED, fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 54, padding: "2px 24px", letterSpacing: 4, background: "rgba(244,231,198,0.95)", borderRadius: 10 }}>ABONNEZ-VOUS</div>
      </div>
      <Sepia style={{ position: "absolute", left: 110, top: 1300 }}><Mascot which="chat" size={270} mood="cheer" /></Sepia>
      <Sepia style={{ position: "absolute", right: 110, top: 1330 }}><Mascot which="poussin" size={240} mood="cheer" /></Sepia>
    </AbsoluteFill>
  );
};

export const ShortReclame: React.FC<{ reclame: Reclame }> = ({ reclame: r }) => {
  const { fps } = useVideoConfig();
  const T = reclameTimeline(r, fps);
  return (
    <AbsoluteFill style={{ fontFamily: FONT_BODY }}>
      <style>{fontFaces()}</style>
      <Rays />
      {has("crackle") && <Audio src={staticFile("audio/crackle.mp3")} volume={0.5} loop />}
      <Sequence from={T.hook.from} durationInFrames={T.hook.dur} name="Accroche">
        {has("fanfare") && <Audio src={staticFile("audio/fanfare.mp3")} volume={0.25} />}
        <Voice clip={r.voice?.hook} from={3} />
        <Masthead />
        <Hook r={r} />
        <BaselineBar />
      </Sequence>
      {T.items.map((s, i) => (
        <React.Fragment key={i}>
          <Sequence from={s.from} durationInFrames={s.ask} name={`Q${i + 1}`}>
            {has("whoosh") && <Audio src={staticFile("audio/whoosh.mp3")} volume={0.35} />}
            <Voice clip={r.items[i].voice?.q} from={3} />
            {has("tick") && [0, 1, 2].map((k) => k * fps < s.think && (
              <Sequence key={k} from={s.read + k * fps} durationInFrames={fps} layout="none"><Audio src={staticFile("audio/tick.mp3")} volume={0.5} /></Sequence>
            ))}
            <Masthead />
            <Stage r={r} index={i} revealed={false} read={s.read} think={s.think} dur={s.ask} />
          </Sequence>
          {s.reveal > 0 && (
            <Sequence from={s.from + s.ask} durationInFrames={s.reveal} name={`R${i + 1}`}>
              {has("ding") && <Audio src={staticFile("audio/ding.mp3")} volume={0.5} />}
              <Voice clip={r.items[i].voice?.a} from={4} />
              <Masthead />
              <Stage r={r} index={i} revealed read={0} think={0} dur={0} />
            </Sequence>
          )}
        </React.Fragment>
      ))}
      <Sequence from={T.outro.from} durationInFrames={T.outro.dur} name="Fin">
        {has("pop") && <Audio src={staticFile("audio/pop.mp3")} volume={0.5} />}
        <Voice clip={r.voice?.outro} from={6} />
        <Masthead />
        <Outro r={r} />
        <BaselineBar />
      </Sequence>
      <FilmWear />
    </AbsoluteFill>
  );
};
