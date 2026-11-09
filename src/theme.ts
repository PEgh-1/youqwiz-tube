import { staticFile } from "remotion";
import type { Level, Pillar, Style } from "./types";
import { LEVEL_LABEL, LEVEL_POINTS, LEVEL_SECONDS } from "./levels";
import { STRINGS } from "./i18n";

// Charte « Pop sticker » (30/10/2026) — encre commune ; 03/11/2026 : six palettes, chaque pilier a les siennes.
export const INK = "#1A1030";
export const WHITE = "#FFFFFF";
export const OK = "#2ECC71";
export const BAD = "#FF3B3B";
export const STREAK = "#FFB800";

export type Theme = {
  name: "chaud" | "menthe" | "violet" | "nuit" | "sepia" | "bonbon";
  bg: string; // dégradé de fond
  accent: string; // couleur du mot-clé, du chrono, du logo
  soft: string; // seconde couleur (ombres de texte, pastilles secondaires)
  confetti: string[];
};

export const THEMES: Theme[] = [
  { name: "chaud", bg: "linear-gradient(135deg,#FFD23F 0%,#FF7A59 45%,#FF4D8D 100%)", accent: "#FF4D8D", soft: "#FFD23F", confetti: ["#1BB5A8", "#FFFFFF", "#1A1030", "#7CF0E3"] },
  { name: "menthe", bg: "linear-gradient(135deg,#7CF0E3 0%,#1BB5A8 55%,#FFD23F 100%)", accent: "#0E8C82", soft: "#7CF0E3", confetti: ["#FF4D8D", "#FFFFFF", "#1A1030", "#FFD23F"] },
  { name: "violet", bg: "linear-gradient(135deg,#7B5CFF 0%,#FF4D8D 55%,#FFB800 100%)", accent: "#7B5CFF", soft: "#FFB800", confetti: ["#7CF0E3", "#FFFFFF", "#1A1030", "#FFD23F"] },
  { name: "nuit", bg: "linear-gradient(135deg,#2B2A6E 0%,#1E6FD9 55%,#19C2C8 100%)", accent: "#19C2C8", soft: "#9BE8FF", confetti: ["#FFD23F", "#FFFFFF", "#FF4D8D", "#7CF0E3"] },
  { name: "sepia", bg: "linear-gradient(135deg,#FFE8B5 0%,#F7B267 55%,#E07A5F 100%)", accent: "#C8553D", soft: "#FFE8B5", confetti: ["#2A9D8F", "#FFFFFF", "#1A1030", "#F4A261"] },
  { name: "bonbon", bg: "linear-gradient(135deg,#FF9AD5 0%,#8ED6FF 55%,#C3F58C 100%)", accent: "#E6399B", soft: "#C3F58C", confetti: ["#7B5CFF", "#FFFFFF", "#1A1030", "#FFD23F"] },
];
export const themeIndex = (name: Theme["name"]): number => Math.max(0, THEMES.findIndex((t) => t.name === name));

// Identité par pilier : palettes autorisées, motif de fond, type de chrono (03/11/2026, « la variation protège »).
export const PILLAR_STYLE: Record<Pillar, { themes: Theme["name"][]; patterns: Style["pattern"][]; timers: Style["timer"][]; reveals: Style["reveal"][]; cards: Style["card"][] }> = {
  devine: { themes: ["chaud", "menthe", "nuit"], patterns: ["confetti", "stars"], timers: ["ring", "digits"], reveals: ["pop", "zoom", "slide"], cards: ["round", "tilt"] },
  choix: { themes: ["bonbon", "violet", "chaud"], patterns: ["bubbles", "confetti"], timers: ["bar"], reveals: ["pop"], cards: ["round", "square"] },
  culture: { themes: ["menthe", "nuit", "violet"], patterns: ["dots", "stripes"], timers: ["bar", "ring"], reveals: ["flip", "pop"], cards: ["square", "round"] },
  generations: { themes: ["sepia", "chaud"], patterns: ["stripes", "dots"], timers: ["digits", "ring"], reveals: ["slide", "pop"], cards: ["square", "tilt"] },
  emojis: { themes: ["violet", "bonbon", "nuit"], patterns: ["stars", "bubbles"], timers: ["pie", "ring"], reveals: ["zoom", "flip"], cards: ["round", "tilt"] },
  site: { themes: ["menthe", "bonbon"], patterns: ["dots", "confetti"], timers: ["bar"], reveals: ["pop"], cards: ["square"] },
};
export const DEFAULT_STYLE: Style = { pattern: "confetti", timer: "ring", reveal: "pop", card: "round", music: 0 };

// label et card : textes français de référence (src/i18n.ts) ; les gabarits affichent tr(episode).levelLabel / levelCard selon la langue.
export const LEVELS: Record<Level, { label: string; color: string; emoji: string; seconds: number; points: number; card: string }> = {
  facile: { label: LEVEL_LABEL.facile, color: "#2ECC71", emoji: "😎", seconds: LEVEL_SECONDS.facile, points: LEVEL_POINTS.facile, card: STRINGS.fr.levelCard.facile },
  moyen: { label: LEVEL_LABEL.moyen, color: "#F39C12", emoji: "🤔", seconds: LEVEL_SECONDS.moyen, points: LEVEL_POINTS.moyen, card: STRINGS.fr.levelCard.moyen },
  difficile: { label: LEVEL_LABEL.difficile, color: "#FF4D8D", emoji: "😰", seconds: LEVEL_SECONDS.difficile, points: LEVEL_POINTS.difficile, card: STRINGS.fr.levelCard.difficile },
  impossible: { label: LEVEL_LABEL.impossible, color: "#1A1030", emoji: "🤯", seconds: LEVEL_SECONDS.impossible, points: LEVEL_POINTS.impossible, card: STRINGS.fr.levelCard.impossible },
};

// Rangs du score : seuils et émojis ; libellés affichés via tr(episode).ranks (ici le français de référence).
export const RANKS = [
  { min: 0, label: STRINGS.fr.ranks[0], emoji: "🐣" },
  { min: 0.4, label: STRINGS.fr.ranks[1], emoji: "😎" },
  { min: 0.7, label: STRINGS.fr.ranks[2], emoji: "🧠" },
  { min: 0.9, label: STRINGS.fr.ranks[3], emoji: "👑" },
];

export const FONT_DISPLAY = "'Baloo 2', 'Fredoka', sans-serif";
export const FONT_LOGO = "'Lilita One', 'Baloo 2', sans-serif";
export const FONT_BODY = "'Fredoka', 'Baloo 2', sans-serif";

// Répliques de la mascotte (par niveau) : désormais dans src/i18n.ts (quips), par langue ; alias français conservé.
export const QUIPS: Record<Level, string[]> = STRINGS.fr.quips;

export const fontFaces = () => `
@font-face { font-family: 'Baloo 2'; font-weight: 800; src: url(${staticFile("fonts/baloo-2-800.woff2")}) format('woff2'); }
@font-face { font-family: 'Baloo 2'; font-weight: 600; src: url(${staticFile("fonts/baloo-2-600.woff2")}) format('woff2'); }
@font-face { font-family: 'Fredoka'; font-weight: 600; src: url(${staticFile("fonts/fredoka-600.woff2")}) format('woff2'); }
@font-face { font-family: 'Lilita One'; font-weight: 400; src: url(${staticFile("fonts/lilita-one.woff2")}) format('woff2'); }
@font-face { font-family: 'Luckiest Guy'; font-weight: 400; src: url(${staticFile("fonts/luckiest-guy.woff2")}) format('woff2'); }
@font-face { font-family: 'Fredoka'; font-weight: 400; src: url(${staticFile("fonts/fredoka-400.woff2")}) format('woff2'); }
`;
