export type Level = "facile" | "moyen" | "difficile" | "impossible";
export type Pillar = "devine" | "culture" | "generations" | "choix" | "emojis" | "site";

export type Prompt =
  | { type: "emoji"; value: string } // un ou plusieurs émojis (rendu Twemoji)
  | { type: "text"; value: string } // texte à deviner (ex. mot sans voyelles, calcul)
  | { type: "image"; value: string } // fichier dans public/ (ex. "flags/fr.svg")
  | { type: "choices"; value: string[] } // « tu préfères » : 2 choix
  | { type: "letter"; value: string; category: string } // « nomme un animal qui commence par M »
  | { type: "qcm"; value: string; choices: string[]; correct: number }; // question + 4 choix + index de la bonne

export type VoiceClip = { src: string; sec: number; /** texte lu (sans tag d'émotion), pour les sous-titres karaoké des Shorts (09/11/2026) */ text?: string };

export type Item = {
  /** Voix off (optionnelle) : question lue au début, réponse lue à la révélation, fait bonus après la réponse. */
  voice?: { q?: VoiceClip; a?: VoiceClip; f?: VoiceClip };
  prompt: Prompt;
  answer: string; // réponse révélée (vide pour un « tu préfères »)
  hint?: string; // indice affiché sous la question
  level?: Level;
  /** Fait bonus « le savais-tu » (1 item sur 4 environ), lu et affiché après la réponse. */
  fact?: string;
};

/** Habillage tiré par épisode (03/11/2026) : motif de fond, chrono, animation de révélation, forme des cartes, piste musicale. */
export type Style = {
  pattern: "confetti" | "dots" | "stripes" | "bubbles" | "stars";
  timer: "ring" | "bar" | "digits" | "pie" | "slider";
  reveal: "pop" | "flip" | "slide" | "zoom";
  card: "round" | "square" | "tilt";
  music: number; // index dans la liste des pistes (public/audio/music*.mp3)
};

/** Textes variables (pré-roll, cartes, packshot…) tirés par épisode dans data/variants.json. */
export type Variants = {
  preroll: { text: string; voice: string };
  introCta: string;
  subscribe: { title: string; sub: string; voice: string };
  levels: Record<Level, { card: string; voice: string }>;
  scoreVoice: string;
  outro: { title: string; voice: string };
  packshot: { headline: string; sub: string; cta: string; voice: string };
};

export type Episode = {
  id: string;
  pillar: Pillar;
  template: "DevineEn3s" | "QuizQCM" | "Intrus" | "Versus";
  /** Langue des textes fixes des gabarits (src/i18n.ts) : absent = "fr" ; "en" pour la chaîne YouQwiz English. */
  lang?: "fr" | "en";
  theme: number; // index dans THEMES
  style?: Style;
  variants?: Variants;
  title: string;
  question: string; // question affichée pour chaque item (ex. « Quel est cet animal ? »)
  intro: { hook: string; sub: string };
  items: Item[];
  // question = durée de base (facile) ; fixed = même durée partout (choix) ; slow = +1 s (générations)
  timing: { question: number; reveal: number; fixed?: boolean; slow?: boolean };
  /** Lignes génériques (cartes de niveau, relances, score) : clé → clip. */
  voice?: Record<string, VoiceClip>;
  champion?: { name: string; score: number };
  cta: { url: string; text: string };
  meta: {
    description: string;
    tags: string[];
    thumbnail: { line1: string; line2: string; emoji: string; sticker?: string; layouts?: [number, number] };
    shortItems?: number;
    shortTitle?: string;
    shortDescription?: string;
    /** 2e Short quotidien (09/11/2026) : questions les plus dures, 19 h. */
    short2?: { title: string; description: string; sticker: string; line: string };
    /** 3e Short quotidien (16 h) : questions du milieu (moyen-difficile). */
    short3?: { title: string; description: string; sticker: string; line: string };
    /** Surcharges posées par scripts/render.mjs pour le rendu du 2e Short. */
    shortLine?: string;
    totalItems?: number;
    /** Relais Instagram / Facebook / TikTok (Metricool). */
    social?: { caption: string; hashtags: string[] };
    chapters?: { at: number; title: string }[];
  };
};
