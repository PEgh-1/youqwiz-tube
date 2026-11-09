// Fusionne les faits bonus (data/facts/<banque>.json : [{key, fact}]) dans les banques (champ `fact` sur l'item).
// key = answer de l'item (banques devine/émojis) ou prompt.value (banques QCM). Les faits non trouvés sont listés.
// Usage : node scripts/merge-facts.mjs [banque…]
import { readdirSync } from "node:fs";
import { p, readJson, writeJson, findBlacklisted } from "./lib.mjs";

const dir = p("data/facts");
const banks = process.argv.slice(2).length ? process.argv.slice(2) : readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, ""));
const norm = (s) => String(s ?? "").trim().toLowerCase();
for (const name of banks) {
  const facts = readJson(`${dir}/${name}.json`, []);
  const file = p(`data/banks/${name}.json`);
  const bank = readJson(file);
  if (!bank) { console.warn(`${name} : banque introuvable`); continue; }
  const byAnswer = new Map(bank.items.map((it) => [norm(it.answer), it]));
  const byQuestion = new Map(bank.items.filter((it) => it.prompt?.type === "qcm").map((it) => [norm(it.prompt.value), it]));
  let ok = 0; const missing = [], bad = [];
  for (const { key, fact } of facts) {
    const it = byQuestion.get(norm(key)) ?? byAnswer.get(norm(key));
    if (!it) { missing.push(key); continue; }
    if (typeof fact !== "string" || fact.length < 20 || fact.length > 160 || /—/.test(fact)) { bad.push(key); continue; }
    if (findBlacklisted(fact).length) { bad.push(`${key} (liste noire)`); continue; }
    it.fact = fact.trim();
    ok++;
  }
  writeJson(file, bank);
  console.log(`${name} : ${ok} faits fusionnés sur ${bank.items.length} items${missing.length ? ` — introuvables : ${missing.slice(0, 5).join(" | ")}${missing.length > 5 ? "…" : ""}` : ""}${bad.length ? ` — rejetés : ${bad.length}` : ""}`);
}
