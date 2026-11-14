export type Level = "facile" | "moyen" | "difficile" | "impossible";
export type Pillar = "devine" | "culture" | "generations" | "choix" | "emojis" | "site";

export type Prompt =
  | { type: "emoji"; value: string } // un ou plusieurs émojis (rendu Twemoji)
  | { type: "text"; value: string } // texte à deviner (ex. mot sans voyelles, calcul)
  | { type: "image"; value: string } // fichier dans public/ (ex. "flags/fr.svg")
  | { type: "choices"; value: string[] } // « tu préfères » : 2 choix
  | { type: "letter"; value: string; category: string } // « nomme un animal qui commence par M »
  | { type: "qcm"; value: string; choices: string[]; correct: number }; // question + 4 choix + index de la bonne

export type VoiceClip = { src: string; sec: number; /** texte lu (sans tag d'émotion), pour les sous-titres karaoké des Shorts (09/11/2026) */ text?: string;
  /** Horodatage mot à mot (ElevenLabs « with-timestamps », 14/11/2026) : [mot, début s, fin s], recalé après la coupe des silences. */
  words?: [string, number, number][] };

/** Finitions v3 (14/11/2026, pilotes) : chaque lot s'active séparément tant qu'il n'est pas validé. */
export type Fx = {
  /** Lot B : transition mascottes d'au moins 1 s (tope-là / clin d'œil), texte ajusté à sa zone, flou de mouvement. */
  finish?: boolean;
  /** Lot C : la question se colore mot à mot au rythme de la voix, le chrono part à la fin de la phrase. */
  sync?: boolean;
  /** Lot D : mascottes animées (respiration, clignement, réaction à la voix, clin d'œil). */
  rig?: boolean;
  /** Première question avant 15 s : intro sans phase logo, règle affichée pendant la question 1, « abonne-toi » après la question 3. */
  fast?: boolean;
};

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

/** Intermède (vidéo longue v2, 09/11/2026) : toutes les 8 à 10 questions, une mini-question d'un autre type (vrai/faux ou 3 choix)
 *  suivie d'une anecdote, pour casser la monotonie (data/interludes/<banque>.json). Sans points. */
export type Interlude = {
  type: "vf" | "qcm3";
  q: string;
  /** vrai/faux */
  answer?: boolean;
  /** 3 choix */
  choices?: string[];
  correct?: number;
  fact: string;
  level?: Level;
  voice?: { q?: VoiceClip; a?: VoiceClip; f?: VoiceClip };
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
  preroll: { text: string; voice: string; /** phrase variable sous le slogan fixe (14/11/2026) */ line?: string };
  /** Baseline de la chaîne, affichée en permanence sous le logo et sur le pré-roll (14/11/2026). */
  baseline?: string;
  introCta: string;
  subscribe: { title: string; sub: string; voice: string };
  levels: Record<Level, { card: string; voice: string }>;
  scoreVoice: string;
  outro: { title: string; voice: string };
  packshot: { headline: string; sub: string; cta: string; voice: string };
  /** Vidéo longue v2 : règle du jeu lue et affichée sur la carte d'intro (ex. « Devine les 60 drapeaux… »). */
  rule?: string;
  /** Texte lu de la règle (peut différer du texte affiché). */
  ruleVoice?: string;
  /** Vidéo longue v2 : voix de la carte finale « Prochain quiz » (2 vidéos + S'abonner). */
  nextQuizVoice?: string;
};

export type Episode = {
  id: string;
  pillar: Pillar;
  template: "DevineEn3s" | "QuizQCM" | "Intrus" | "Versus";
  /** Langue des textes fixes des gabarits (src/i18n.ts) : absent = "fr" ; "en" pour la chaîne YouQwiz English. */
  lang?: "fr" | "en";
  theme: number; // index dans THEMES
  fx?: Fx;
  /** Extrait pilote : options de timeline forcées (ex. sans score ni packshot). */
  pilot?: Record<string, number | boolean>;
  style?: Style;
  variants?: Variants;
  title: string;
  question: string; // question affichée pour chaque item (ex. « Quel est cet animal ? »)
  intro: { hook: string; sub: string };
  items: Item[];
  /** Intermèdes (vidéo longue seulement), insérés toutes les 8 à 10 questions dans l'ordre du tableau. */
  interludes?: Interlude[];
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
    /** Accroche du Short (sticker rouge + ligne) : generate.mjs pour le Short 1, render.mjs pour les Shorts 2 et 3. */
    shortHook?: { sticker: string; line: string };
    /** Surcharges posées par scripts/render.mjs pour le rendu du 2e Short. */
    shortLine?: string;
    totalItems?: number;
    /** Relais Instagram / Facebook / TikTok (Metricool). */
    social?: { caption: string; hashtags: string[] };
    chapters?: { at: number; title: string }[];
  };
};
