import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { Emoji, Fonts } from "./components";

// Trois directions visuelles pour la charte, rendues en image fixe (1920x1080).
// variant 0 = Arcade néon · 1 = Pop sticker · 2 = Plateau TV
export const Mockup: React.FC<{ variant: number }> = ({ variant }) => {
  const d = DIRECTIONS[variant];
  return (
    <AbsoluteFill style={{ fontFamily: "'Baloo 2', sans-serif", background: d.bg, overflow: "hidden" }}>
      <Fonts />
      {d.decor}
      {/* HUD commun : progression, score, série, niveau */}
      <div style={{ position: "absolute", top: 34, left: 60, right: 60, display: "flex", alignItems: "center", gap: 30 }}>
        <div style={{ ...pill(d), fontSize: 36 }}>🎯 12 / 60</div>
        <div style={{ flex: 1, height: 22, background: d.trackBg, borderRadius: 999, overflow: "hidden", boxShadow: d.inset }}>
          <div style={{ width: "20%", height: "100%", background: d.progress, borderRadius: 999 }} />
        </div>
        <div style={{ ...pill(d), fontSize: 36, background: d.levelBg, color: "#fff" }}>😰 DIFFICILE</div>
        <div style={{ ...pill(d), fontSize: 36, background: d.streakBg, color: d.streakFg }}>🔥 SÉRIE ×5</div>
      </div>

      {/* Question */}
      <div style={{ position: "absolute", top: 130, left: 0, right: 0, textAlign: "center", fontWeight: 800, fontSize: 84, color: d.fg, textShadow: d.textShadow, letterSpacing: variant === 0 ? 1 : 0 }}>
        Quel est cet animal ?
      </div>

      {/* Carte */}
      <div style={{ position: "absolute", top: 260, left: 410, width: 1100, height: 560, borderRadius: d.radius, background: d.card, border: d.cardBorder, boxShadow: d.cardShadow, display: "flex", alignItems: "center", justifyContent: "center", transform: `rotate(${d.tilt}deg)` }}>
        <Emoji value="🦦" size={380} />
        {variant === 1 && <div style={{ position: "absolute", top: -34, right: -30, transform: "rotate(12deg)", ...sticker("#FF4D8D") }}>DIFFICILE 😰</div>}
        {variant === 2 && <div style={{ position: "absolute", bottom: -30, ...sticker("#F5B700", "#1A1206") }}>500 points 💰</div>}
      </div>

      {/* Chrono */}
      <div style={{ position: "absolute", right: 110, bottom: 90, width: 230, height: 230, borderRadius: 999, background: d.timerBg, border: `16px solid ${d.timerRing}`, boxShadow: d.timerGlow, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 130, color: d.timerFg }}>
        4
      </div>
      <div style={{ position: "absolute", right: 80, bottom: 40, fontWeight: 700, fontSize: 30, color: d.fg, opacity: 0.8 }}>5 secondes · niveau difficile</div>

      {/* Mascotte + bulle */}
      <div style={{ position: "absolute", left: 90, bottom: 60, display: "flex", alignItems: "flex-end", gap: 20 }}>
        <Emoji value="🐱" size={240} />
        <div style={{ ...bubble(d), marginBottom: 150 }}>Facile… non ? 👀</div>
      </div>

      {/* Logo */}
      <div style={{ position: "absolute", left: 60, top: 120, display: "flex", alignItems: "baseline", fontSize: 54 }}>
        <span style={{ fontWeight: 600, color: d.fg }}>You</span>
        <span style={{ fontWeight: 800, color: d.logoAccent }}>Qwiz</span>
      </div>
      <div style={{ position: "absolute", left: 60, bottom: 10, fontSize: 24, color: d.fg, opacity: 0.6, fontWeight: 600 }}>{d.name}</div>
    </AbsoluteFill>
  );
};

const pill = (d: Dir): React.CSSProperties => ({ fontWeight: 800, padding: "10px 26px", borderRadius: 999, background: d.pillBg, color: d.pillFg, boxShadow: d.pillShadow, whiteSpace: "nowrap" });
const sticker = (bg: string, fg = "#fff"): React.CSSProperties => ({ fontWeight: 800, fontSize: 40, padding: "12px 30px", borderRadius: 999, background: bg, color: fg, border: "6px solid #fff", boxShadow: "0 8px 0 rgba(0,0,0,0.15)" });
const bubble = (d: Dir): React.CSSProperties => ({ fontWeight: 700, fontSize: 38, padding: "18px 30px", borderRadius: 30, background: d.bubbleBg, color: d.bubbleFg, boxShadow: d.pillShadow });

type Dir = {
  name: string; bg: string; fg: string; card: string; cardBorder: string; cardShadow: string; radius: number; tilt: number;
  pillBg: string; pillFg: string; pillShadow: string; levelBg: string; streakBg: string; streakFg: string; trackBg: string; progress: string; inset: string;
  timerBg: string; timerRing: string; timerFg: string; timerGlow: string; bubbleBg: string; bubbleFg: string; logoAccent: string; textShadow: string; decor: React.ReactNode;
};

const Confetti: React.FC<{ colors: string[]; n?: number }> = ({ colors, n = 40 }) => (
  <>
    {Array.from({ length: n }).map((_, i) => {
      const x = (i * 97) % 1920, y = (i * 211) % 1080, r = (i * 37) % 360;
      return <div key={i} style={{ position: "absolute", left: x, top: y, width: 18 + (i % 3) * 8, height: 10 + (i % 4) * 6, background: colors[i % colors.length], borderRadius: i % 2 ? 999 : 4, transform: `rotate(${r}deg)`, opacity: 0.85 }} />;
    })}
  </>
);

const DIRECTIONS: Dir[] = [
  {
    name: "A · Arcade néon",
    bg: "radial-gradient(ellipse at 50% 20%, #2A1F5E 0%, #120C2E 60%, #0A0718 100%)",
    fg: "#FFFFFF", card: "linear-gradient(180deg,#1E1650,#15103A)", cardBorder: "6px solid #3DF2E4", cardShadow: "0 0 60px rgba(61,242,228,0.55), 0 0 120px rgba(255,61,230,0.25)", radius: 40, tilt: 0,
    pillBg: "rgba(255,255,255,0.08)", pillFg: "#fff", pillShadow: "0 0 24px rgba(61,242,228,0.35)", levelBg: "#FF3DE6", streakBg: "#FFB800", streakFg: "#1A1206", trackBg: "rgba(255,255,255,0.1)", progress: "linear-gradient(90deg,#3DF2E4,#FF3DE6)", inset: "inset 0 0 12px rgba(0,0,0,0.5)",
    timerBg: "#120C2E", timerRing: "#FF3DE6", timerFg: "#3DF2E4", timerGlow: "0 0 50px rgba(255,61,230,0.8)", bubbleBg: "#3DF2E4", bubbleFg: "#0A0718", logoAccent: "#3DF2E4", textShadow: "0 0 30px rgba(61,242,228,0.8)",
    decor: (
      <>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(61,242,228,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(61,242,228,0.08) 1px, transparent 1px)", backgroundSize: "80px 80px", transform: "perspective(600px) rotateX(55deg) translateY(300px)", transformOrigin: "50% 100%" }} />
        <Confetti colors={["#3DF2E4", "#FF3DE6", "#FFB800"]} n={24} />
      </>
    ),
  },
  {
    name: "B · Pop sticker",
    bg: "linear-gradient(135deg,#FFD23F 0%,#FF7A59 45%,#FF4D8D 100%)",
    fg: "#1A1030", card: "#FFFFFF", cardBorder: "10px solid #1A1030", cardShadow: "18px 18px 0 #1A1030", radius: 36, tilt: -2,
    pillBg: "#FFFFFF", pillFg: "#1A1030", pillShadow: "6px 6px 0 #1A1030", levelBg: "#FF4D8D", streakBg: "#1A1030", streakFg: "#FFD23F", trackBg: "#FFFFFF", progress: "#1BB5A8", inset: "4px 4px 0 #1A1030",
    timerBg: "#FFFFFF", timerRing: "#1A1030", timerFg: "#FF4D8D", timerGlow: "10px 10px 0 #1A1030", bubbleBg: "#FFFFFF", bubbleFg: "#1A1030", logoAccent: "#FFFFFF", textShadow: "4px 4px 0 #FFFFFF",
    decor: <Confetti colors={["#1BB5A8", "#FFFFFF", "#1A1030", "#7CF0E3"]} n={36} />,
  },
  {
    name: "C · Plateau TV",
    bg: "radial-gradient(ellipse at 50% 0%, #1E3A8A 0%, #0B1A4A 55%, #050B24 100%)",
    fg: "#FFFFFF", card: "linear-gradient(180deg,#F8FAFF,#DDE6FF)", cardBorder: "8px solid #F5B700", cardShadow: "0 30px 80px rgba(0,0,0,0.6), inset 0 -10px 0 #B8C4EC", radius: 28, tilt: 0,
    pillBg: "linear-gradient(180deg,#2B4BB8,#1B347F)", pillFg: "#fff", pillShadow: "0 6px 0 #0B1A4A", levelBg: "#D62828", streakBg: "#F5B700", streakFg: "#1A1206", trackBg: "#0B1A4A", progress: "linear-gradient(90deg,#F5B700,#FFD866)", inset: "inset 0 2px 8px rgba(0,0,0,0.6)",
    timerBg: "#0B1A4A", timerRing: "#F5B700", timerFg: "#fff", timerGlow: "0 0 40px rgba(245,183,0,0.7)", bubbleBg: "#F5B700", bubbleFg: "#1A1206", logoAccent: "#F5B700", textShadow: "0 6px 0 rgba(0,0,0,0.5)",
    decor: (
      <>
        {[200, 500, 1400, 1700].map((x, i) => (
          <div key={i} style={{ position: "absolute", left: x - 300, top: -200, width: 600, height: 1400, background: "linear-gradient(180deg, rgba(245,183,0,0.18), transparent 70%)", transform: `rotate(${i % 2 ? 18 : -18}deg)`, filter: "blur(10px)" }} />
        ))}
      </>
    ),
  },
];
