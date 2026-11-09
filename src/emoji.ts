// Nom de fichier Twemoji pour un émoji (même règle que twemoji.js : on retire
// les sélecteurs de variante FE0F sauf en présence d'un ZWJ).
export const emojiToCode = (emoji: string): string => {
  const hasZwj = emoji.includes("‍");
  const chars = Array.from(hasZwj ? emoji : emoji.replace(/️/g, ""));
  return chars.map((c) => c.codePointAt(0)!.toString(16)).join("-");
};

// Découpe une chaîne en émojis individuels (graphèmes).
export const splitEmojis = (s: string): string[] => {
  const seg = new (Intl as any).Segmenter("fr", { granularity: "grapheme" });
  return Array.from(seg.segment(s), (x: any) => x.segment).filter((g: string, _i: number, arr: string[]) => arr.length === 1 || g !== "\u200b");
};
