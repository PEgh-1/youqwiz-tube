import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { Emoji, Flag, Fonts, Mascot, flagCode } from "./components";
import type { Episode, Item, Level } from "./types";
import { tr } from "./i18n";

// Miniature 1280×720 « une idée » v4 (15/11/2026) — le CTR des gabarits « choc » plafonnait à 1-2 % :
//  - UNE seule idée par miniature : 3-4 mots géants (Anton) ou un nombre énorme, lisibles en taille mobile ;
//  - un visuel concret reconnu en une demi-seconde (objets 3D de public/objects, drapeaux, émojis du quiz) ;
//  - fond saturé + rayons ; plus de boutons QCM, de pastille, de cercle ni de logo ;
//  - mascotte petite, en bas à gauche (le bas à droite est couvert par la durée de la vidéo) ;
//  - aucun chevauchement de texte ; rien d'important sous y = 640 à droite de x = 1090.
//  - variante A/B : 0 = chat, 1 = poussin (le reste est identique).
const INK = "#14102B";
const WHITE = "#FFFFFF";
const YELLOW = "#FFE21A";
const RED = "#FF1F2D";
const FONT = "'Anton', 'Baloo 2', sans-serif";
const ORDER: Level[] = ["facile", "moyen", "difficile", "impossible"];

const TXT = {
  fr: { culture: ["CULTURE", "GÉNÉRALE"], questions: "QUESTIONS", remember: "TU TE SOUVIENS ?", born: ["NÉS AVANT", "1975 ?"], level: ["AS-TU LE", "NIVEAU"], flagsBand: ["TU LES CONNAIS", "TOUS ?"], which: "QUEL PAYS ?", found: "TU TROUVES ?", intrus: ["TROUVE", "L'INTRUS"] },
  en: { culture: ["GENERAL", "KNOWLEDGE"], questions: "QUESTIONS", remember: "DO YOU REMEMBER?", born: ["BORN BEFORE", "1975?"], level: ["ARE YOU SMARTER", "THAN"], flagsBand: ["CAN YOU NAME", "THEM ALL?"], which: "WHICH COUNTRY?", found: "CAN YOU GUESS?", intrus: ["SPOT THE", "ODD ONE"] },
};
const txt = (ep: Episode) => TXT[(ep as { lang?: string }).lang === "en" ? "en" : "fr"];

const pictos = (s: string) =>
  [...new Intl.Segmenter("fr", { granularity: "grapheme" }).segment(s)].map((g) => g.segment).filter((g) => /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(g));
const strip = (s: string) => s.replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}\p{Regional_Indicator}]/gu, "").replace(/\s+/g, " ").trim();
const byLevel = (ep: Episode): Record<Level, Item[]> => {
  const out: Record<Level, Item[]> = { facile: [], moyen: [], difficile: [], impossible: [] };
  ep.items.forEach((it, i) => out[it.level ?? ORDER[Math.min(3, Math.floor((i / ep.items.length) * 4))]].push(it));
  return out;
};
const pick = <T,>(arr: T[], seed: number) => arr[seed % Math.max(1, arr.length)];
const seedOf = (ep: Episode) => [...ep.id].reduce((a, c) => a + c.charCodeAt(0), 0);
// Anton en capitales : ≈ 0,48 em par caractère (espaces compris) — taille bornée par la largeur disponible
const fit = (s: string, width: number, max: number) => Math.floor(Math.min(max, width / (Math.max(1, s.length) * 0.48)));
const stroke = (px: number): React.CSSProperties => ({ WebkitTextStroke: `${px}px ${INK}`, paintOrder: "stroke fill", textShadow: `0 ${Math.round(px * 0.7)}px 0 ${INK}` });
// « 94 QUESTIONS » → { n: "94", noun: "QUESTIONS" }
const split = (ep: Episode) => {
  const l2 = strip(ep.meta.thumbnail.line2).toUpperCase();
  const m = l2.match(/^(\d+)\s*(.*)$/);
  return { n: m ? m[1] : String(ep.items.length), noun: (m ? m[2] : l2) || txt(ep).questions };
};

const Bg: React.FC<{ a: string; b: string; y?: string }> = ({ a, b, y = "55%" }) => (
  <>
    <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 50% ${y}, ${a}, ${b})` }} />
    <div style={{ position: "absolute", inset: 0, background: `repeating-conic-gradient(from 0deg at 50% ${y}, rgba(255,255,255,0.13) 0deg 8deg, rgba(255,255,255,0) 8deg 16deg)` }} />
    <div style={{ position: "absolute", inset: 0, boxShadow: "inset 0 0 160px rgba(0,0,0,0.45)" }} />
  </>
);

const Big: React.FC<{ children: React.ReactNode; size: number; color?: string; px?: number; style?: React.CSSProperties }> = ({ children, size, color = WHITE, px = 14, style }) => (
  <div style={{ position: "absolute", fontFamily: FONT, fontSize: size, lineHeight: 0.95, color, whiteSpace: "nowrap", textTransform: "uppercase", ...stroke(px), ...style }}>{children}</div>
);

// Bandeau du haut : 2 à 4 mots, la fin en jaune
const Band: React.FC<{ parts: string[]; bg?: string; border?: string }> = ({ parts, bg = RED, border = INK }) => {
  const size = fit(parts.join(" "), 1200, 118);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 150, background: bg, borderBottom: `10px solid ${border}`, display: "flex", alignItems: "center", justifyContent: "center", gap: size * 0.28, fontFamily: FONT, fontSize: size, letterSpacing: 2, whiteSpace: "nowrap", textTransform: "uppercase", WebkitTextStroke: `8px ${INK}`, paintOrder: "stroke fill" }}>
      <span style={{ color: WHITE }}>{parts[0]}</span>
      {parts[1] && <span style={{ color: YELLOW }}>{parts[1]}</span>}
    </div>
  );
};

const Obj: React.FC<{ name: string; h: number; rot?: number; style: React.CSSProperties }> = ({ name, h, rot = 0, style }) => (
  <Img src={staticFile(`objects/${name}.png`)} style={{ position: "absolute", height: h, width: "auto", transform: `rotate(${rot}deg)`, filter: "drop-shadow(0 10px 0 rgba(20,16,43,0.5))", ...style }} />
);

// Mascotte de marque : petite, en bas à gauche, pose « défi » tournée vers le contenu
const Corner: React.FC<{ variant: number; size?: number; style?: React.CSSProperties }> = ({ variant, size = 180, style }) => (
  <div style={{ position: "absolute", zIndex: 6, left: 26, bottom: 14, filter: "drop-shadow(0 6px 0 rgba(20,16,43,0.5))", ...style }}>
    <Mascot which={variant % 2 ? "poussin" : "chat"} size={size} mood="dare" still />
  </div>
);

// Texte géant du bas, calé à droite de la mascotte et au-dessus de la pastille de durée
const Bottom: React.FC<{ text: string; color?: string; max?: number }> = ({ text, color = YELLOW, max = 172 }) => (
  <Big size={fit(text, 1030, max)} color={color} style={{ left: 215, right: 20, top: 462, textAlign: "center" }}>{text}</Big>
);

// ---------- Quiz à questions (culture générale, vocabulaire…) : un nombre énorme ----------
const OBJ_SETS = [["globe", "cerveau", "eiffel"], ["livres", "ampoule", "trophee"], ["cerveau", "trophee", "globe"], ["ampoule", "livres", "eiffel"]];
const NumberCard: React.FC<{ ep: Episode; variant: number }> = ({ ep, variant }) => {
  const { n, noun } = split(ep);
  const o = pick(OBJ_SETS, seedOf(ep));
  return (
    <>
      <Bg a="#1E9BFF" b="#0A3FD0" />
      <Band parts={txt(ep).culture} />
      <Obj name={o[0]} h={230} rot={-8} style={{ left: 40, top: 185 }} />
      <Obj name={o[1]} h={220} rot={8} style={{ right: 40, top: 180 }} />
      {/* troisième objet : au-dessus de la pastille de durée YouTube (bas droit) */}
      <Obj name={o[2]} h={175} rot={5} style={{ right: 80, top: 395 }} />
      <Big size={n.length > 2 ? 360 : 400} color={YELLOW} px={22} style={{ left: 0, right: 0, top: n.length > 2 ? 160 : 140, textAlign: "center" }}>{n}</Big>
      <Big size={fit(noun, 760, 165)} style={{ left: 230, right: 290, top: 535, textAlign: "center" }}>{noun}</Big>
      <Corner variant={variant} size={190} />
    </>
  );
};

// ---------- Nostalgie / générations : trois objets cultes ----------
const Nostalgie: React.FC<{ ep: Episode; variant: number }> = ({ ep, variant }) => {
  const t = ep.meta.thumbnail;
  const l1 = strip(t.line1).toUpperCase();
  const born = /\d{4}/.test(l1);
  const parts = born ? [l1.replace(/\s*\d{4}.*$/, ""), (l1.match(/\d{4}.*$/) ?? [""])[0]] : txt(ep).born;
  return (
    <>
      <Bg a="#FF9A1F" b="#E8320F" />
      <Band parts={parts} bg={INK} border={YELLOW} />
      <Obj name="vhs" h={230} rot={-7} style={{ left: 60, top: 185 }} />
      <Obj name="telephone" h={250} rot={5} style={{ left: 500, top: 170 }} />
      <Obj name="tele" h={270} rot={-4} style={{ right: 50, top: 165 }} />
      <Bottom text={born ? txt(ep).remember : strip(t.line2).toUpperCase()} />
      <Corner variant={variant} size={175} />
    </>
  );
};

// ---------- Quiz par classe : « AS-TU LE NIVEAU 6e ? » ----------
const Classe: React.FC<{ ep: Episode; variant: number }> = ({ ep, variant }) => {
  const lvl = strip(ep.meta.thumbnail.line2).replace(/\?/g, "").trim();
  const m = lvl.match(/^(\d+)(.*)$/);
  const [a, b] = txt(ep).level;
  return (
    <>
      <Bg a="#17B36A" b="#06693C" y="50%" />
      <Big size={fit(a, 560, 210)} style={{ left: 50, top: 30 }}>{a}</Big>
      <Big size={fit(b, 560, 210)} style={{ left: 50, top: 250 }}>{b}</Big>
      <Big size={m ? 440 : fit(lvl, 520, 300)} color={YELLOW} px={22} style={{ left: 600, top: m ? 150 : 220, transform: "rotate(-4deg)" }}>
        {m ? m[1] : lvl}
        {m && <span style={{ fontSize: 250, verticalAlign: "top", position: "relative", top: 34, textTransform: "none" }}>{m[2].trim()}</span>}
        <span style={{ color: RED }}>?</span>
      </Big>
      <Obj name="crayon" h={185} rot={-6} style={{ left: 215, top: 500 }} />
      <Obj name="equerre" h={175} rot={6} style={{ left: 395, top: 510 }} />
      <Corner variant={variant} size={180} />
    </>
  );
};

// ---------- Drapeaux : trois vrais drapeaux du quiz ----------
const Flags: React.FC<{ ep: Episode; variant: number }> = ({ ep, variant }) => {
  const { n, noun } = split(ep);
  const flags = ep.items.filter((it) => it.prompt.type === "emoji" && flagCode(it.prompt.value));
  const at = (f: number) => flagCode((flags[Math.min(flags.length - 1, Math.floor(flags.length * f))].prompt as { value: string }).value)!;
  return (
    <>
      <Bg a="#8A4DFF" b="#3B12B8" />
      <Band parts={txt(ep).flagsBand} />
      {[0.04, 0.4, 0.8].map((f, i) => (
        <div key={i} style={{ position: "absolute", left: 60 + i * 405, top: 185 + (i % 2) * 14, transform: `rotate(${[-5, 3, -3][i]}deg)` }}>
          <Flag code={at(f)} size={225} />
        </div>
      ))}
      <Bottom text={`${n} ${noun}`} />
      <Corner variant={variant} size={175} />
    </>
  );
};

// ---------- Devinettes en texte (pays sans voyelles…) : UN mot à trous, jouable dès la miniature ----------
const Masked: React.FC<{ ep: Episode; variant: number }> = ({ ep, variant }) => {
  const { noun } = split(ep);
  const texts = ep.items.slice(0, Math.max(12, Math.floor(ep.items.length / 4))).filter((it) => it.prompt.type === "text");
  const short = texts.filter((it) => { const v = (it.prompt as { value: string }).value; return v.length >= 5 && v.length <= 6 && /^[A-Za-z]/.test(v) && !/\s/.test(v); });
  const word = ((pick(short.length ? short : texts, seedOf(ep))?.prompt as { value: string } | undefined)?.value ?? "?").toUpperCase();
  const size = fit(word, 880, 250);
  return (
    <>
      <Bg a="#00B8D9" b="#0B5FA8" />
      <Band parts={[noun]} />
      <Big size={size} color={YELLOW} px={20} style={{ left: 0, right: 0, top: 160 + (250 - size) / 2, textAlign: "center", letterSpacing: size * 0.05 }}>{word}</Big>
      <Bottom text={/PAYS|COUNTR/.test(noun) ? txt(ep).which : txt(ep).found} color={WHITE} max={150} />
      <Corner variant={variant} size={175} />
    </>
  );
};

// ---------- Mots en émojis : une énigme simple, « = ? » ----------
const EmojiRiddle: React.FC<{ ep: Episode; variant: number }> = ({ ep, variant }) => {
  const { noun } = split(ep);
  const pool = ep.items.filter((it) => it.prompt.type === "emoji" && pictos(it.prompt.value).length === 2);
  const it = pick(pool.length ? pool.slice(0, Math.max(3, Math.floor(pool.length / 3))) : ep.items, seedOf(ep));
  const em = it.prompt.type === "emoji" ? pictos(it.prompt.value).slice(0, 2) : ["❓", "❓"];
  return (
    <>
      <Bg a="#FF5CA8" b="#C2186B" />
      <Band parts={[noun]} />
      <div style={{ position: "absolute", left: 215, right: 20, top: 215, height: 380, display: "flex", alignItems: "center", justifyContent: "center", gap: 26, fontFamily: FONT, fontSize: 230, color: WHITE, ...stroke(16) }}>
        <Emoji value={em[0]} size={270} style={{ filter: "drop-shadow(0 10px 0 rgba(20,16,43,0.5))" }} />
        <span>+</span>
        <Emoji value={em[1] ?? em[0]} size={270} style={{ filter: "drop-shadow(0 10px 0 rgba(20,16,43,0.5))" }} />
        <span style={{ color: YELLOW }}>= ?</span>
      </div>
      <Corner variant={variant} size={180} />
    </>
  );
};

// ---------- Trouve l'intrus : la grille du quiz, en grand ----------
const Intrus: React.FC<{ ep: Episode; variant: number }> = ({ ep, variant }) => {
  const lv = byLevel(ep);
  const it = pick(lv.moyen.length ? lv.moyen : ep.items, seedOf(ep));
  const cells = it.prompt.type === "emoji" ? pictos(it.prompt.value).slice(0, 12) : [];
  return (
    <>
      <Bg a="#FFB21F" b="#F0600F" />
      <Band parts={txt(ep).intrus} />
      <div style={{ position: "absolute", left: 225, top: 185, width: 1035, height: 430, display: "grid", gridTemplateColumns: "repeat(6, 1fr)", alignItems: "center", justifyItems: "center" }}>
        {cells.map((c, i) => <Emoji key={i} value={c} size={152} style={{ filter: "drop-shadow(0 8px 0 rgba(20,16,43,0.5))" }} />)}
      </div>
      <Corner variant={variant} size={185} />
    </>
  );
};

// ---------- Tu préfères : deux émojis face à face ----------
const choicePairs = (ep: Episode) =>
  ep.items
    .map((it) => (it.prompt.type === "choices" ? it.prompt.value : null))
    .filter((v): v is string[] => !!v && v.every((s) => pictos(s).length > 0))
    .map((v) => ({ v, len: v.reduce((a, s) => a + strip(s).length, 0) }))
    .sort((a, b) => a.len - b.len);

const Versus: React.FC<{ ep: Episode; variant: number }> = ({ ep, variant }) => {
  const pair = choicePairs(ep)[0]?.v ?? ["😱", "🤯"];
  const sides = ["#1E6BFF", RED];
  const title = tr(ep).thumbVersusTitle.toUpperCase();
  return (
    <>
      <div style={{ position: "absolute", inset: 0, background: INK }} />
      {sides.map((c, i) => (
        <div key={i} style={{ position: "absolute", top: 0, bottom: 0, left: i === 0 ? -80 : 600, width: 760, background: `radial-gradient(circle at 50% 55%, ${c} 0%, ${c}DD 45%, ${c}99 100%)`, transform: "skewX(-8deg)", borderLeft: i === 1 ? `14px solid ${WHITE}` : undefined }} />
      ))}
      <div style={{ position: "absolute", inset: 0, background: "repeating-conic-gradient(from 0deg at 50% 50%, rgba(255,255,255,0.1) 0deg 9deg, rgba(255,255,255,0) 9deg 18deg)" }} />
      <Big size={fit(title, 1100, 150)} color={YELLOW} style={{ left: 0, right: 0, top: 14, textAlign: "center" }}>{title}</Big>
      {pair.map((s, i) => (
        <div key={i} style={{ position: "absolute", left: i === 0 ? 110 : 690, top: 200, width: 480, height: 420, display: "flex", alignItems: "center", justifyContent: "center", transform: `rotate(${i ? 6 : -6}deg)`, filter: `drop-shadow(0 12px 0 ${INK})` }}>
          <Emoji value={pictos(s).slice(-1)[0]} size={380} />
        </div>
      ))}
      <div style={{ position: "absolute", zIndex: 5, left: 640 - 95, top: 320, width: 190, height: 190, borderRadius: 999, background: YELLOW, border: `10px solid ${INK}`, boxShadow: `0 10px 0 ${INK}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT, fontSize: 96, color: INK }}>VS</div>
      <Corner variant={variant} size={170} />
    </>
  );
};

export const Thumbnail: React.FC<{ episode: Episode; variant?: number }> = ({ episode: ep, variant = 0 }) => {
  const t = ep.meta.thumbnail;
  const first = ep.items[0]?.prompt;
  const body = ep.items.some((it) => it.prompt.type === "choices") ? <Versus ep={ep} variant={variant} />
    : ep.template === "Intrus" ? <Intrus ep={ep} variant={variant} />
    : /^as-tu le niveau/i.test(strip(t.line1)) || String(ep.pillar).startsWith("classe") ? <Classe ep={ep} variant={variant} />
    : ep.pillar === "generations" ? <Nostalgie ep={ep} variant={variant} />
    : ep.template === "QuizQCM" ? <NumberCard ep={ep} variant={variant} />
    : first?.type === "emoji" ? (flagCode(first.value) ? <Flags ep={ep} variant={variant} /> : <EmojiRiddle ep={ep} variant={variant} />)
    : first?.type === "text" ? <Masked ep={ep} variant={variant} />
    : <NumberCard ep={ep} variant={variant} />;
  return (
    <AbsoluteFill style={{ fontFamily: FONT, overflow: "hidden" }}>
      <Fonts />
      <style>{`@font-face { font-family: 'Anton'; font-weight: 400; src: url(${staticFile("objects/anton.woff2")}) format('woff2'); }`}</style>
      {body}
    </AbsoluteFill>
  );
};
