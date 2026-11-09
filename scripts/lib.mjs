import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export const ROOT = path.resolve(new URL(".", import.meta.url).pathname, "..");
export const p = (...x) => path.join(ROOT, ...x);
export const readJson = (f, fallback) => (existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : fallback);
export const writeJson = (f, obj) => {
  mkdirSync(path.dirname(f), { recursive: true });
  writeFileSync(f, JSON.stringify(obj, null, 1));
};

// Générateur pseudo-aléatoire déterministe (même date = même épisode).
export const rng = (seed) => {
  let h = 2166136261;
  for (const c of String(seed)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
export const shuffle = (arr, rand) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export const argv = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : def;
};

// Date du jour (Europe/Paris) au format YYYY-MM-DD.
export const todayParis = () => {
  const d = new Date();
  const fmt = new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" });
  return fmt.format(d);
};

// Liste noire : marques et personnages sous licence, jamais dans une vidéo.
export const BLACKLIST = readJson(p("data/blacklist.json"), []);
export const findBlacklisted = (text) => {
  const t = ` ${text.toLowerCase()} `;
  // mot entier (évite « mario » dans « mariage »)
  return BLACKLIST.filter((w) => new RegExp(`(^|[^\\p{L}])${w.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\p{L}]|$)`, "u").test(t));
};
