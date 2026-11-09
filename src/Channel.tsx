import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { AUDIO, Background, Emoji, Fonts, LevelBadge, Logo, Mascot, Packshot, Pill, Pop, Rich } from "./components";
import { FONT_BODY, FONT_DISPLAY, INK, THEMES, WHITE } from "./theme";

const theme = THEMES[0];

// ---------- Avatar 800×800 : rond, mascotte chat + bulle, lisible en 48 px ----------
export const Avatar: React.FC<{ variant?: number }> = ({ variant = 0 }) => (
  <AbsoluteFill style={{ fontFamily: FONT_DISPLAY }}>
    <Fonts />
    <Background theme={theme} confetti={10} />
    {variant === 0 ? (
      <>
        {/* chat centré dans le cercle de recadrage (rayon 400), bulle « ? » à l'intérieur du cercle */}
        <div style={{ position: "absolute", left: 400 - 295, top: 400 - 255 }}>
          <Mascot which="chat" size={560} mood="cheer" />
        </div>
        <div style={{ position: "absolute", left: 535, top: 125, transform: "rotate(8deg)" }}>
          <div style={{ background: WHITE, border: `9px solid ${INK}`, borderRadius: 34, padding: "10px 24px", boxShadow: `9px 9px 0 ${INK}`, fontSize: 78, fontWeight: 800, color: INK, lineHeight: 1 }}>?</div>
        </div>
      </>
    ) : (
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "baseline", fontSize: 230, lineHeight: 1 }}>
          <span style={{ fontWeight: 800, color: WHITE, textShadow: `12px 12px 0 ${INK}` }}>Q</span>
        </div>
        <div style={{ position: "absolute", left: 40, bottom: 20 }}>
          <Mascot which="poussin" size={300} mood="cheer" />
        </div>
        <div style={{ position: "absolute", right: 40, bottom: 20 }}>
          <Mascot which="chat" size={330} mood="idle" />
        </div>
      </div>
    )}
  </AbsoluteFill>
);

// ---------- Bannière 2560×1440 : zone sûre 1546×423 centrée (tous écrans) ----------
export const Banner: React.FC<{ variant?: number }> = ({ variant = 0 }) => {
  const safeW = 1546, safeH = 423;
  const left = (2560 - safeW) / 2, top = (1440 - safeH) / 2;
  return (
    <AbsoluteFill style={{ fontFamily: FONT_DISPLAY }}>
      <Fonts />
      <Background theme={theme} confetti={60} />
      {/* mascottes dans la bande visible sur ordinateur (2560×423 centrée), de part et d'autre de la zone sûre mobile */}
      <div style={{ position: "absolute", left: 70, top: 720 - 190, transform: "rotate(-6deg)" }}><Mascot which="chat" size={380} mood="cheer" /></div>
      <div style={{ position: "absolute", right: 80, top: 720 - 175, transform: "rotate(6deg)" }}><Mascot which="poussin" size={350} mood="cheer" /></div>
      {["🐯", "🇧🇷", "🧠", "🍕", "👀", "⏱️", "🔥", "🏆"].map((e, i) => (
        <div key={e} style={{ position: "absolute", left: 200 + i * 290, top: i % 2 ? 150 : 1120, transform: `rotate(${(i % 3) * 8 - 8}deg)`, opacity: 0.9 }}>
          <Emoji value={e} size={120} />
        </div>
      ))}
      {/* zone sûre */}
      <div style={{ position: "absolute", left, top, width: safeW, height: safeH, display: "flex", flexDirection: variant === 0 ? "row" : "column", alignItems: "center", justifyContent: "center", gap: variant === 0 ? 36 : 14 }}>
        <Logo theme={theme} size={variant === 0 ? 120 : 120} />
        <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: variant === 0 ? "flex-start" : "center" }}>
          <div style={{ fontWeight: 800, fontSize: variant === 0 ? 52 : 56, color: WHITE, textShadow: `5px 5px 0 ${INK}`, lineHeight: 1.05, whiteSpace: "nowrap" }}>Un quiz par jour · de facile à impossible</div>
          <div style={{ display: "flex", gap: 14 }}>
            <Pill size={30} tilt={-2}>⏱️ 5 secondes</Pill>
            <Pill size={30} bg={theme.accent} fg={WHITE} tilt={2}>🔔 Nouveau quiz à 17h30</Pill>
            <Pill size={30} tilt={-1}>🎮 youqwiz.com</Pill>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------- Filigrane 150×150 (bouton d'abonnement discret) ----------
export const Watermark: React.FC = () => (
  <AbsoluteFill style={{ fontFamily: FONT_DISPLAY, background: "transparent", alignItems: "center", justifyContent: "center" }}>
    <Fonts />
    <div style={{ width: 136, height: 136, borderRadius: 999, background: WHITE, border: `6px solid ${INK}`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `5px 5px 0 ${INK}` }}>
      <span style={{ fontWeight: 800, fontSize: 88, color: INK, lineHeight: 1 }}>Q</span>
    </div>
  </AbsoluteFill>
);

// ---------- Bande-annonce 30 s ----------
const PILLARS = [
  { emoji: "🐯", title: "Devine en 5 secondes", sub: "Animaux, drapeaux, pays…" },
  { emoji: "🤔", title: "Tu préfères… ?", sub: "Des choix impossibles" },
  { emoji: "🧠", title: "Culture générale", sub: "4 réponses, une seule bonne" },
  { emoji: "👀", title: "Trouve l'intrus", sub: "11 pareils, 1 différent" },
  { emoji: "📼", title: "Quiz Générations", sub: "Nés avant 1975 ?" },
];

export const Trailer: React.FC = () => {
  const { fps } = useVideoConfig();
  const introDur = 4 * fps, cardDur = Math.round(2.8 * fps), packDur = 10 * fps;
  let t = 0;
  const seq: { from: number; dur: number; node: React.ReactNode; name: string }[] = [];
  seq.push({ from: t, dur: introDur, name: "Accroche", node: <Hook /> });
  t += introDur;
  PILLARS.forEach((p, i) => {
    seq.push({ from: t, dur: cardDur, name: p.title, node: <PillarCard {...p} index={i} /> });
    t += cardDur;
  });
  seq.push({ from: t, dur: 2 * fps, name: "Rythme", node: <Rhythm /> });
  t += 2 * fps;
  seq.push({ from: t, dur: packDur, name: "Packshot", node: <Packshot theme={theme} /> });
  return (
    <AbsoluteFill style={{ fontFamily: FONT_BODY, color: INK }}>
      <Fonts />
      <Background theme={theme} confetti={34} />
      {AUDIO.music && <Audio src={staticFile("audio/music.mp3")} volume={0.18} loop />}
      {seq.map((s, i) => (
        <Sequence key={i} from={s.from} durationInFrames={s.dur} name={s.name}>
          {i === 0 && AUDIO.jingle && <Audio src={staticFile("audio/jingle.mp3")} volume={0.8} />}
          {i > 0 && i <= PILLARS.length && AUDIO.whoosh && <Audio src={staticFile("audio/whoosh.mp3")} volume={0.5} />}
          {s.name === "Packshot" && AUDIO.packshot && <Audio src={staticFile("audio/packshot.mp3")} volume={1} />}
          {s.name === "Packshot" && AUDIO.fanfare && <Audio src={staticFile("audio/fanfare.mp3")} volume={0.5} />}
          {s.node}
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
export const TRAILER_FRAMES = (fps: number) => 4 * fps + 5 * Math.round(2.8 * fps) + 2 * fps + 10 * fps;

const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 9, stiffness: 140 } });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 30 }}>
      <div style={{ transform: `scale(${0.6 + pop * 0.4})`, opacity: pop }}>
        <Logo theme={theme} size={150} />
      </div>
      <Pop delay={12}>
        <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 110, color: WHITE, textShadow: `8px 8px 0 ${INK}`, textAlign: "center", lineHeight: 1 }}>
          <Rich text="Tu te crois fort ? 😏" size={110} />
        </div>
      </Pop>
      <Pop delay={24}>
        <Pill size={50} bg={theme.accent} fg={WHITE} tilt={-2}>Un nouveau quiz chaque jour à 17h30</Pill>
      </Pop>
      <div style={{ position: "absolute", left: 80, bottom: 30 }}><Mascot which="chat" size={340} mood="idle" /></div>
      <div style={{ position: "absolute", right: 80, bottom: 30 }}><Mascot which="poussin" size={300} mood="cheer" /></div>
    </AbsoluteFill>
  );
};

const PillarCard: React.FC<{ emoji: string; title: string; sub: string; index: number }> = ({ emoji, title, sub, index }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const th = THEMES[index % THEMES.length];
  const enter = spring({ frame, fps, config: { damping: 12, stiffness: 150 } });
  const tilt = (index % 2 ? 1 : -1) * 2;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ transform: `translateY(${(1 - enter) * 300}px) rotate(${tilt}deg)`, background: WHITE, border: `8px solid ${INK}`, borderRadius: 48, boxShadow: `16px 16px 0 ${INK}`, padding: "50px 80px", display: "flex", alignItems: "center", gap: 60 }}>
        <Emoji value={emoji} size={260} />
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 96, color: INK, lineHeight: 1 }}>{title}</div>
          <div style={{ fontFamily: FONT_BODY, fontWeight: 600, fontSize: 48, color: th.accent }}>{sub}</div>
          <div style={{ display: "flex", gap: 12 }}>
            <LevelBadge level="facile" size={30} />
            <LevelBadge level="impossible" size={30} tilt={2} />
          </div>
        </div>
      </div>
      <div style={{ position: "absolute", top: 40, left: 60 }}><Logo theme={theme} size={54} /></div>
      <div style={{ position: "absolute", top: 40, right: 60 }}><Pill size={36}>{`${index + 1} / ${PILLARS.length}`}</Pill></div>
    </AbsoluteFill>
  );
};

const Rhythm: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = interpolate(frame % fps, [0, fps], [1.15, 1]);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 30 }}>
      <div style={{ transform: `scale(${s})`, fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 150, color: WHITE, textShadow: `9px 9px 0 ${INK}` }}>
        <Rich text="⏱️ 5 secondes" size={150} />
      </div>
      <Pill size={54} tilt={-2}>Compte tes points · dis ton score en commentaire 👇</Pill>
    </AbsoluteFill>
  );
};
