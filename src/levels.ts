// Grille des niveaux (chrono / points), sans dépendance Remotion : partagée entre le rendu et les scripts Node (chapitres, durée).
import type { Level } from "./types.ts";

export const LEVEL_ORDER: Level[] = ["facile", "moyen", "difficile", "impossible"];

// Chrono adaptatif (31/10/2026 : 5 s minimum) : facile 5 s, moyen 5 s, difficile 6 s, impossible 7 s.
export const LEVEL_SECONDS: Record<Level, number> = { facile: 5, moyen: 5, difficile: 6, impossible: 7 };
export const LEVEL_POINTS: Record<Level, number> = { facile: 100, moyen: 200, difficile: 300, impossible: 500 };
export const LEVEL_LABEL: Record<Level, string> = { facile: "FACILE", moyen: "MOYEN", difficile: "DIFFICILE", impossible: "IMPOSSIBLE" };

// Temps de réponse calculé (08/11/2026), même équation que youqwiz.com (assets/js/episodes.js) — plus de durée arbitraire :
//   T = caractères à lire (question + tous les choix) / 14 car./s + réflexion (2,5 / 3,5 / 5 / 6,5 s selon le niveau ; +1,5 s si image/émoji à observer) + 1 s de geste,
//   borné entre 6 et 30 s, arrondi à la demi-seconde. LEVEL_SECONDS ne sert plus qu'aux Shorts (rythme imposé par la limite de 60 s).
export const READ_CPS = 14;
export const THINK_SECONDS: Record<Level, number> = { facile: 2.5, moyen: 3.5, difficile: 5, impossible: 6.5 };
type PromptLike = { type: string; value?: unknown; choices?: string[]; category?: string };
export const answerSeconds = (prompt: PromptLike, level: Level, questionText = ""): number => {
  let txt = questionText;
  let visual = false;
  if (prompt.type === "qcm") txt += " " + String(prompt.value ?? "") + " " + (prompt.choices ?? []).join(" ");
  else if (prompt.type === "choices") txt += " " + (Array.isArray(prompt.value) ? prompt.value.join(" ") : "");
  else if (prompt.type === "text" || prompt.type === "letter") txt += " " + String(prompt.value ?? "") + " " + (prompt.category ?? "");
  else visual = true; // emoji, image : on observe
  const chars = txt.replace(/\s+/g, " ").trim().length;
  const t = chars / READ_CPS + THINK_SECONDS[level] + (visual ? 1.5 : 0) + 1;
  return Math.min(30, Math.max(6, Math.round(t * 2) / 2));
};
