import React from "react";
import { AbsoluteFill } from "remotion";
import { Emoji, Flag, Fonts, Logo, Mascot, PromptView, flagCode, themeOf } from "./components";
import { FONT_DISPLAY, INK, LEVELS, WHITE } from "./theme";
import type { Episode, Item, Level } from "./types";
import { tr } from "./i18n";

// Miniature 1280×720 « choc » v2 (05/11/2026) — taux de clic :
//  - fond saturé de la charte + rayons, vignettage léger ;
//  - le VRAI contenu du quiz (drapeaux, calculs, réponses QCM, choix) à la place d'un émoji générique ;
//  - une mascotte CHOQUÉE sur chaque miniature (visage/émotion) ;
//  - 2 à 3 mots géants maximum, un seul sticker rouge ; pas de question QCM en toutes lettres.
//  - 2 variantes A/B : 0 = « échelle / grille », 1 = « gros plan ».
const YELLOW = "#FFE14D";
const RED = "#FF2D2D";
const ORDER: Level[] = ["facile", "moyen", "difficile", "impossible"];

const outline = (px: number, color = INK): React.CSSProperties => ({ WebkitTextStroke: `${px}px ${color}`, paintOrder: "stroke fill", textShadow: `${px * 0.9}px ${px * 0.9}px 0 ${color}` });

const pictos = (s: string) =>
  [...new Intl.Segmenter("fr", { granularity: "grapheme" }).segment(s)].map((g) => g.segment).filter((g) => /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(g));
const strip = (s: string) => s.replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}\p{Regional_Indicator}]/gu, "").replace(/\s+/g, " ").trim();

const byLevel = (ep: Episode): Record<Level, Item[]> => {
  const out: Record<Level, Item[]> = { facile: [], moyen: [], difficile: [], impossible: [] };
  ep.items.forEach((it, i) => out[it.level ?? ORDER[Math.min(3, Math.floor((i / ep.items.length) * 4))]].push(it));
  return out;
};
const pick = <T,>(arr: T[], seed: number) => arr[seed % Math.max(1, arr.length)];

const Bg: React.FC<{ ep: Episode; x?: string; y?: string }> = ({ ep, x = "50%", y = "40%" }) => (
  <>
    <div style={{ position: "absolute", inset: 0, background: themeOf(ep).bg }} />
    <div style={{ position: "absolute", inset: 0, background: `repeating-conic-gradient(from 0deg at ${x} ${y}, rgba(255,255,255,0.16) 0deg 9deg, rgba(255,255,255,0) 9deg 18deg)` }} />
    <div style={{ position: "absolute", inset: 0, boxShadow: "inset 0 0 140px rgba(26,16,48,0.45)" }} />
  </>
);

// Titre : 2-3 mots géants. line1 n'est gardée que si c'est une accroche en forme de question (« Nés avant 1975 ? »).
const Title: React.FC<{ ep: Episode; left: number; top: number; width: number; align?: "left" | "center"; max?: number; wrap?: boolean }> = ({ ep, left, top, width, align = "center", max = 150, wrap = false }) => {
  const t = ep.meta.thumbnail;
  const small = /\?$/.test(t.line1.trim()) ? t.line1 : "";
  const big = t.line2.toUpperCase();
  const longest = Math.max(...big.split(/\s+/).map((w) => w.length));
  // une seule ligne garantie : la taille est bornée par la largeur disponible (≈ 0,6 em par capitale Baloo)
  const size = Math.floor(Math.min(max, longest > 11 ? 104 : longest > 9 ? 122 : longest > 7 ? 142 : 164, width / ((wrap ? longest : big.length) * 0.6)));
  return (
    <div style={{ position: "absolute", left, top, width, textAlign: align, fontFamily: FONT_DISPLAY, fontWeight: 800, lineHeight: 0.92 }}>
      {small && <div style={{ fontSize: 68, color: WHITE, ...outline(7) }}>{small.toUpperCase()}</div>}
      <div style={{ fontSize: size, color: YELLOW, ...outline(9) }}>{big}</div>
    </div>
  );
};

const Sticker: React.FC<{ text: string; style: React.CSSProperties; size?: number }> = ({ text, style, size = 44 }) => (
  <div style={{ position: "absolute", zIndex: 6, fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: size, color: WHITE, background: RED, padding: "8px 26px", borderRadius: 18, border: `6px solid ${WHITE}`, boxShadow: `0 0 0 6px ${INK}, 10px 10px 0 6px ${INK}`, whiteSpace: "nowrap", ...style }}>
    {text}
  </div>
);

const Arrow: React.FC<{ style: React.CSSProperties; size?: number }> = ({ style, size = 200 }) => (
  <svg width={size} height={size} viewBox="0 0 200 200" style={{ position: "absolute", zIndex: 5, filter: `drop-shadow(6px 6px 0 ${INK})`, ...style }}>
    <path d="M20 30 C 90 20, 140 60, 150 130" fill="none" stroke={WHITE} strokeWidth={34} strokeLinecap="round" />
    <path d="M20 30 C 90 20, 140 60, 150 130" fill="none" stroke={RED} strokeWidth={22} strokeLinecap="round" />
    <path d="M108 118 L152 182 L188 110 Z" fill={RED} stroke={WHITE} strokeWidth={8} strokeLinejoin="round" />
  </svg>
);

const Ring: React.FC<{ style: React.CSSProperties; w: number; h: number }> = ({ style, w, h }) => (
  <div style={{ position: "absolute", zIndex: 5, width: w, height: h, borderRadius: "50%", border: `14px solid ${RED}`, boxShadow: `0 0 0 5px ${WHITE}, inset 0 0 0 5px ${WHITE}`, transform: "rotate(-8deg)", ...style }} />
);

// Mascotte choquée + émoji 😱 en bulle : le « visage » de chaque miniature.
// Visage de la miniature : variante A = « défi » malicieux, variante B = « choc » (test A/B au CTR, 05/11/2026)
const Shock: React.FC<{ which: "chat" | "poussin"; size: number; style: React.CSSProperties; flip?: boolean; bubble?: boolean; mood?: "dare" | "shock" }> = ({ which, size, style, flip, bubble = false, mood = "shock" }) => (
  <div style={{ position: "absolute", zIndex: 4, ...style }}>
    {/* la pose « défi » pointe vers la droite : on la retourne pour qu'elle désigne le contenu, à gauche */}
    <div style={{ transform: (mood === "dare") !== !!flip ? "scaleX(-1)" : undefined, filter: `drop-shadow(0 0 18px rgba(255,255,255,0.55))` }}>
      <Mascot which={which} size={size} mood={mood} />
    </div>
    {bubble && (
      <div style={{ position: "absolute", left: -size * 0.14, top: -size * 0.02, width: size * 0.42, height: size * 0.42, borderRadius: 999, background: WHITE, border: `7px solid ${INK}`, boxShadow: `7px 7px 0 ${INK}`, display: "flex", alignItems: "center", justifyContent: "center", transform: "rotate(10deg)" }}>
        <Emoji value="😱" size={size * 0.3} />
      </div>
    )}
  </div>
);

const ItemView: React.FC<{ it: Item; ep: Episode; w: number; h: number }> = ({ it, ep, w, h }) => {
  const p = it.prompt;
  if (p.type === "emoji") {
    const fc = flagCode(p.value);
    if (fc) return <Flag code={fc} size={Math.min(w / 1.5, h / 1.125) * 0.92} />;
    const n = pictos(p.value).length || 1;
    return <Emoji value={p.value} size={Math.min(h * 0.82, (w * 0.9) / n)} />;
  }
  return <PromptView prompt={p} theme={themeOf(ep)} big={h * 0.7} maxW={w * 0.92} maxH={h * 0.85} lang={ep.lang} />;
};

const Tile: React.FC<{ level: Level; children: React.ReactNode; w: number; h: number; style?: React.CSSProperties; glow?: boolean; label?: string }> = ({ level, children, w, h, style, glow, label }) => {
  const L = LEVELS[level];
  const band = level === "impossible" ? RED : L.color;
  return (
    <div style={{ position: "absolute", width: w, height: h, background: WHITE, borderRadius: 26, border: `8px solid ${INK}`, boxShadow: glow ? `0 0 0 8px ${RED}, 0 0 50px 14px ${RED}AA, 12px 12px 0 8px ${INK}` : `10px 10px 0 ${INK}`, overflow: "hidden", display: "flex", flexDirection: "column", ...style }}>
      <div style={{ background: band, color: WHITE, fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 32, textAlign: "center", padding: "3px 0", borderBottom: `6px solid ${INK}`, ...outline(3) }}>{label ?? L.label}</div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>{children}</div>
    </div>
  );
};

// ---------- Devinettes : échelle Facile → Impossible + mascotte choquée ----------
const DevineLadder: React.FC<{ ep: Episode; mood: "dare" | "shock" }> = ({ ep, mood }) => {
  const t = ep.meta.thumbnail;
  const lv = byLevel(ep);
  const W = 290, H = 330, gap = 18, x0 = 22;
  return (
    <>
      <Bg ep={ep} x="40%" y="30%" />
      <Title ep={ep} left={30} top={16} width={760} align="left" max={170} />
      {ORDER.map((l, i) => {
        const it = pick(lv[l].length ? lv[l] : ep.items, ep.id.length + i * 3);
        const imp = l === "impossible";
        return (
          <Tile key={l} level={l} w={W} h={H} glow={imp} label={tr(ep).levelLabel[l]} style={{ left: x0 + i * (W + gap), top: imp ? 360 : 378 + (i % 2) * 8, transform: `rotate(${imp ? 4 : (i % 2 ? 2 : -2)}deg) scale(${imp ? 1.1 : 1})`, zIndex: imp ? 5 : 2 }}>
            <ItemView it={it} ep={ep} w={W - 26} h={H - 66} />
          </Tile>
        );
      })}
      <Shock which="poussin" size={400} mood={mood} style={{ right: -30, top: -10 }} />
      <Sticker text={t.sticker ?? tr(ep).thumbSticker} size={46} style={{ left: 50, top: 214, transform: "rotate(-4deg)" }} />
    </>
  );
};

const DevineCloseup: React.FC<{ ep: Episode; mood: "dare" | "shock" }> = ({ ep, mood }) => {
  const t = ep.meta.thumbnail;
  const lv = byLevel(ep);
  const it = pick(lv.impossible.length ? lv.impossible : lv.difficile.length ? lv.difficile : ep.items, ep.id.length);
  return (
    <>
      <Bg ep={ep} x="30%" y="52%" />
      <div style={{ position: "absolute", left: 30, top: 110, width: 690, height: 560, background: WHITE, borderRadius: 40, border: `12px solid ${INK}`, boxShadow: `18px 18px 0 ${INK}`, transform: "rotate(-3deg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <ItemView it={it} ep={ep} w={610} h={460} />
      </div>
      <Ring w={780} h={650} style={{ left: -15, top: 65 }} />
      <Title ep={ep} left={740} top={30} width={530} max={130} wrap />
      <Shock which="chat" size={470} mood={mood} style={{ right: 0, bottom: -60 }} />
      <Sticker text={t.sticker ?? tr(ep).thumbSticker} size={42} style={{ left: 60, top: 36, transform: "rotate(-5deg)" }} />
    </>
  );
};

// ---------- Tu préfères : VS plein écran, mascottes partagées ----------
const choicePairs = (ep: Episode) =>
  ep.items
    .map((it) => (it.prompt.type === "choices" ? it.prompt.value : null))
    .filter((v): v is string[] => !!v && v.every((s) => pictos(s).length > 0))
    .map((v) => ({ v, len: v.reduce((a, s) => a + strip(s).length, 0) }))
    .sort((a, b) => a.len - b.len);

const Versus: React.FC<{ ep: Episode; variant: number; mood: "dare" | "shock" }> = ({ ep, variant, mood }) => {
  const pairs = choicePairs(ep);
  const pair = pairs[variant % Math.max(1, pairs.length)]?.v ?? ["😱", "🤯"];
  const sides = ["#1E6BFF", RED];
  return (
    <>
      <div style={{ position: "absolute", inset: 0, background: INK }} />
      {sides.map((c, i) => (
        <div key={i} style={{ position: "absolute", top: 0, bottom: 0, left: i === 0 ? -80 : 600, width: 760, background: `radial-gradient(circle at 50% 55%, ${c} 0%, ${c}DD 45%, ${c}99 100%)`, transform: "skewX(-8deg)", borderLeft: i === 1 ? `14px solid ${WHITE}` : undefined }} />
      ))}
      <div style={{ position: "absolute", inset: 0, background: "repeating-conic-gradient(from 0deg at 50% 50%, rgba(255,255,255,0.1) 0deg 9deg, rgba(255,255,255,0) 9deg 18deg)" }} />
      {pair.map((s, i) => {
        const label = strip(s).toUpperCase();
        const em = pictos(s).slice(-1)[0];
        const fs = label.length > 24 ? 50 : label.length > 16 ? 60 : 72;
        return (
          <React.Fragment key={i}>
            {/* émoji et libellé sur deux bandes fixes : aucun chevauchement possible */}
            <div style={{ position: "absolute", left: i === 0 ? 20 : 680, top: 118, width: 580, height: 300, display: "flex", alignItems: "center", justifyContent: "center", transform: `rotate(${i ? 6 : -6}deg)`, filter: `drop-shadow(10px 10px 0 ${INK})` }}>
              <Emoji value={em} size={290} />
            </div>
            <div style={{ position: "absolute", left: i === 0 ? 20 : 680, top: 428, width: 580, height: 160, display: "flex", alignItems: "flex-start", justifyContent: "center", fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: fs, lineHeight: 0.95, color: WHITE, textAlign: "center", ...outline(6) }}>{label}</div>
          </React.Fragment>
        );
      })}
      <div style={{ position: "absolute", left: 0, right: 0, top: 16, textAlign: "center", fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 104, color: YELLOW, ...outline(9) }}>{tr(ep).thumbVersusTitle}</div>
      <div style={{ position: "absolute", zIndex: 5, left: 640 - 85, top: 260, width: 170, height: 170, borderRadius: 999, background: YELLOW, border: `10px solid ${INK}`, boxShadow: `10px 10px 0 ${INK}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 84, color: INK, transform: "rotate(-8deg)" }}>{tr(ep).or}</div>
      <Shock which="chat" size={220} mood={mood} bubble={false} style={{ left: 640 - 200, bottom: -80 }} />
      <Shock which="poussin" size={200} mood={mood} bubble={false} flip style={{ left: 640 - 5, bottom: -70 }} />
    </>
  );
};

// ---------- QCM : 4 réponses courtes, pas de question, mascotte choquée ----------
const QcmCard: React.FC<{ ep: Episode; variant: number; mood: "dare" | "shock" }> = ({ ep, variant, mood }) => {
  const t = ep.meta.thumbnail;
  const lv = byLevel(ep);
  const ok = (it: Item) => it.prompt.type === "qcm" && it.prompt.choices.every((c) => c.length <= 12);
  const pool = (variant ? [...lv.difficile, ...lv.moyen] : [...lv.impossible, ...lv.difficile]).filter(ok);
  const all = ep.items.filter(ok);
  const it = pick(pool.length ? pool : all.length ? all : ep.items, ep.id.length);
  const q = it.prompt.type === "qcm" ? it.prompt : { value: "", choices: ["?", "?", "?", "?"], correct: 0 };
  const colors = ["#1E6BFF", "#FF8A00", "#19B36B", "#B04CFF"];
  const ringOn = (q.correct + 1 + variant) % 4; // cercle sur une réponse (pas forcément la bonne) : curiosité
  const bw = 410, bh = 132, gx = 20, gy = 30, x0 = 20, y0 = 296;
  return (
    <>
      <Bg ep={ep} x="35%" y="60%" />
      <Title ep={ep} left={20} top={14} width={860} max={126} />
      {q.choices.slice(0, 4).map((c, i) => (
        <div key={i} style={{ position: "absolute", left: x0 + (i % 2) * (bw + gx), top: y0 + Math.floor(i / 2) * (bh + gy), width: bw, height: bh, borderRadius: 24, background: colors[i], border: `7px solid ${INK}`, boxShadow: `9px 9px 0 ${INK}`, display: "flex", alignItems: "center", gap: 16, padding: "0 18px", fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: c.length > 10 ? 44 : c.length > 7 ? 54 : 66, color: WHITE, transform: `rotate(${i % 2 ? 1 : -1}deg)`, ...outline(4) }}>
          <span style={{ background: WHITE, color: INK, WebkitTextStroke: "0px", textShadow: "none", borderRadius: 14, width: 76, height: 76, flex: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", border: `5px solid ${INK}`, fontSize: 42 }}>{"ABCD"[i]}</span>
          <span style={{ whiteSpace: "nowrap", overflow: "hidden" }}>{c}</span>
        </div>
      ))}
      <Ring w={bw + 60} h={bh + 60} style={{ left: x0 - 30 + (ringOn % 2) * (bw + gx), top: y0 - 30 + Math.floor(ringOn / 2) * (bh + gy) }} />
      <div style={{ position: "absolute", zIndex: 3, left: 900, top: 240, width: 170, height: 170, borderRadius: 999, background: YELLOW, border: `10px solid ${INK}`, boxShadow: `10px 10px 0 ${INK}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 100, color: INK, transform: "rotate(10deg)" }}>?</div>
      <Shock which="poussin" size={430} mood={mood} bubble={false} style={{ right: -30, bottom: -60 }} />
      <Sticker text={t.sticker ?? (variant ? tr(ep).thumbQcmStickerB : tr(ep).thumbQcmStickerA)} size={40} style={{ right: 16, top: 140, transform: "rotate(6deg)" }} />
    </>
  );
};

// ---------- Trouve l'intrus ----------
const IntrusGrid: React.FC<{ ep: Episode; variant: number; mood: "dare" | "shock" }> = ({ ep, variant, mood }) => {
  const t = ep.meta.thumbnail;
  const lv = byLevel(ep);
  const pool = variant ? lv.impossible : lv.difficile.length ? lv.difficile : lv.moyen;
  const it = pick(pool.length ? pool : ep.items, ep.id.length);
  const cells = it.prompt.type === "emoji" ? pictos(it.prompt.value).slice(0, 12) : [];
  return (
    <>
      <Bg ep={ep} x="34%" y="55%" />
      <div style={{ position: "absolute", left: 26, top: 50, width: 670, height: 620, background: WHITE, borderRadius: 36, border: `12px solid ${INK}`, boxShadow: `16px 16px 0 ${INK}`, transform: "rotate(-2deg)", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", alignItems: "center", justifyItems: "center", padding: 24 }}>
        {cells.map((c, i) => <Emoji key={i} value={c} size={126} />)}
      </div>
      <Title ep={ep} left={720} top={50} width={550} max={136} wrap />
      <Shock which="chat" size={470} mood={mood} style={{ right: 0, bottom: -60 }} />
      <Sticker text={t.sticker ?? (variant ? tr(ep).thumbIntrusStickerB : tr(ep).thumbIntrusStickerA)} size={38} style={{ left: 60, top: 30, transform: "rotate(-5deg)" }} />
    </>
  );
};

export const Thumbnail: React.FC<{ episode: Episode; variant?: number }> = ({ episode: ep, variant = 0 }) => {
  const isChoice = ep.items.some((it) => it.prompt.type === "choices");
  const isQcm = ep.template === "QuizQCM";
  const isIntrus = ep.template === "Intrus";
  // A/B : la variante A montre la mascotte en « défi » (rassurant, joueur), la B en « choc » (enjeu) ; le CTR tranche (scripts/analytics.mjs)
  const mood: "dare" | "shock" = variant % 2 ? "shock" : "dare";
  return (
    <AbsoluteFill style={{ fontFamily: FONT_DISPLAY, overflow: "hidden" }}>
      <Fonts />
      {isChoice ? <Versus ep={ep} variant={variant} mood={mood} /> : isQcm ? <QcmCard ep={ep} variant={variant} mood={mood} /> : isIntrus ? <IntrusGrid ep={ep} variant={variant} mood={mood} /> : variant % 2 ? <DevineCloseup ep={ep} mood={mood} /> : <DevineLadder ep={ep} mood={mood} />}
      <div style={{ position: "absolute", zIndex: 7, left: 18, bottom: 14, background: WHITE, borderRadius: 999, border: `4px solid ${INK}`, padding: "2px 14px 0" }}>
        <Logo theme={themeOf(ep)} size={30} />
      </div>
    </AbsoluteFill>
  );
};
