// Valide un fichier d'items (nouveaux ou banque complète) : schéma, émojis Twemoji disponibles,
// doublons (internes et contre la banque existante), liste noire, niveaux.
// Usage : node scripts/validate-bank.mjs <fichier.json> [--bank animaux] [--merge]
//   --bank  : banque existante à comparer (défaut : nom du fichier)
//   --merge : ajoute les items valides à data/banks/<bank>.json
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { argv, findBlacklisted, p, readJson, writeJson } from "./lib.mjs";

const file = process.argv[2];
if (!file) throw new Error("fichier manquant");
const bankName = argv("bank", path.basename(file, ".json").replace(/^new-/, ""));
const bankPath = p(`data/banks/${bankName}.json`);
const bank = readJson(bankPath);
if (!bank) throw new Error(`banque inconnue : ${bankName}`);
const raw = readJson(path.resolve(file));
const items = Array.isArray(raw) ? raw : raw.items;

const emojiDir = p("public/emoji");
const available = new Set(existsSync(emojiDir) ? readdirSync(emojiDir).map((f) => f.replace(/\.svg$/, "")) : []);
const code = (e) => {
  const hasZwj = e.includes("‍");
  return Array.from(hasZwj ? e : e.replace(/️/g, "")).map((c) => c.codePointAt(0).toString(16)).join("-");
};
const seg = new Intl.Segmenter("fr", { granularity: "grapheme" });
const graphemes = (s) => Array.from(seg.segment(s), (x) => x.segment);
const isEmoji = (g) => /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(g);
const LEVELS = ["facile", "moyen", "difficile", "impossible"];
const key = (it) => JSON.stringify(it.prompt);
const norm = (s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/^(le |la |les |l'|un |une |des )/, "").trim();

const existingKeys = new Set(bank.items.map(key));
const existingAnswers = new Set(bank.items.map((i) => norm(i.answer)).filter(Boolean));
const seenKeys = new Set();
const seenAnswers = new Set();
const errors = [];
const ok = [];

items.forEach((it, idx) => {
  const where = `#${idx + 1}`;
  const err = (m) => errors.push(`${where} ${m} — ${JSON.stringify(it).slice(0, 90)}`);
  if (!it?.prompt?.type) return err("prompt.type manquant");
  const t = it.prompt.type;
  if (!["emoji", "text", "choices", "qcm", "letter"].includes(t)) return err(`type inconnu ${t}`);
  if (t === "letter") {
    if (!/^[A-Z]$/.test(it.prompt.value ?? "")) return err("letter : une seule lettre majuscule");
    if (typeof it.prompt.category !== "string" || !it.prompt.category) return err("letter : category manquante (ex. « un animal »)");
    if (typeof it.answer !== "string" || it.answer.split(",").length < 2) return err("letter : answer = au moins 2 réponses acceptées séparées par des virgules");
  }
  if (bankName === "maths" && t === "text" && !/^[\d\s+\-−×÷=%?.,()½¼¾²³]+( de \d+)?$/.test(it.prompt.value ?? "")) return err("maths : expression uniquement chiffres et opérateurs");
  if (it.fact !== undefined && (typeof it.fact !== "string" || it.fact.length < 20 || it.fact.length > 160)) return err("fact : 20 à 160 caractères");
  if (t === "emoji") {
    if (typeof it.prompt.value !== "string" || !it.prompt.value) return err("value vide");
    const gs = graphemes(it.prompt.value);
    const bad = gs.filter((g) => !isEmoji(g) || !available.has(code(g)));
    if (bad.length) return err(`émoji absent de Twemoji : ${bad.join(" ")}`);
    if (bankName === "intrus") {
      if (gs.length !== 12) return err(`intrus : ${gs.length} émojis au lieu de 12`);
      const counts = {};
      gs.forEach((g) => (counts[g] = (counts[g] || 0) + 1));
      const odd = Object.entries(counts).filter(([, n]) => n === 1);
      if (Object.keys(counts).length !== 2 || odd.length !== 1) return err("intrus : il faut 11 identiques + 1 différent");
      const pos = gs.indexOf(odd[0][0]) + 1;
      if (it.answer !== `Case ${pos}`) return err(`intrus : réponse attendue « Case ${pos} »`);
    } else if (["animaux", "fruits-legumes", "drapeaux"].includes(bankName) && gs.length !== 1) return err("un seul émoji attendu");
  }
  if (t === "text" && (typeof it.prompt.value !== "string" || !it.prompt.value)) return err("value vide");
  if (bankName === "pays-sans-voyelles" && !/^[B-DF-HJ-NP-TV-Z_ \-']+$/.test(it.prompt.value)) return err("pays : majuscules sans voyelles, voyelles remplacées par _");
  if (t === "choices") {
    if (!Array.isArray(it.prompt.value) || it.prompt.value.length !== 2) return err("choices : 2 options attendues");
    if (it.prompt.value.some((v) => typeof v !== "string" || v.length > 60)) return err("choices : option vide ou > 60 caractères");
  }
  if (t === "qcm") {
    const q = it.prompt;
    if (typeof q.value !== "string" || q.value.length < 8 || q.value.length > 110) return err("qcm : question vide ou > 110 caractères");
    if (!Array.isArray(q.choices) || q.choices.length !== 4) return err("qcm : 4 choix attendus");
    if (q.choices.some((c) => typeof c !== "string" || !c || c.length > 40)) return err("qcm : choix vide ou > 40 caractères");
    if (new Set(q.choices.map(norm)).size !== 4) return err("qcm : choix en double");
    if (!Number.isInteger(q.correct) || q.correct < 0 || q.correct > 3) return err("qcm : correct doit être 0-3");
    if (norm(q.choices[q.correct]) !== norm(it.answer)) return err("qcm : answer ≠ choices[correct]");
  }
  if (t !== "choices" && (typeof it.answer !== "string" || !it.answer)) return err("answer manquante");
  if (it.level !== undefined && !LEVELS.includes(it.level)) return err(`niveau inconnu ${it.level}`);
  if (["culture-generale", "generations", "intrus", "mots-emojis", "maths", "vocabulaire", "films-emojis", "acronymes", "noel"].includes(bankName) && !it.level) return err("niveau obligatoire pour cette banque");
  const bad = findBlacklisted(`${JSON.stringify(it.prompt)} ${it.answer}`);
  if (bad.length) return err(`liste noire : ${bad.join(", ")}`);
  const k = key(it);
  if (existingKeys.has(k) || seenKeys.has(k)) return err("doublon (même question)");
  const a = norm(it.answer);
  if (a && t !== "qcm" && t !== "letter" && !["intrus", "maths"].includes(bankName) && (existingAnswers.has(a) || seenAnswers.has(a))) return err(`doublon (réponse déjà présente : ${it.answer})`);
  seenKeys.add(k);
  if (a) seenAnswers.add(a);
  ok.push(it);
});

const byLevel = {};
ok.forEach((i) => (byLevel[i.level ?? "—"] = (byLevel[i.level ?? "—"] || 0) + 1));
console.log(`${bankName} : ${ok.length} valides / ${items.length} — niveaux ${JSON.stringify(byLevel)}`);
if (errors.length) console.log(`${errors.length} rejetés :\n - ` + errors.slice(0, 40).join("\n - ") + (errors.length > 40 ? `\n - … (${errors.length - 40} de plus)` : ""));
if (process.argv.includes("--merge")) {
  bank.items.push(...ok);
  writeJson(bankPath, bank);
  console.log(`fusionné : ${bankName} compte maintenant ${bank.items.length} items`);
}
