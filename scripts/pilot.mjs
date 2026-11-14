// Extraits pilotes des finitions v3 (14/11/2026) : un rendu par lot, cumulés, sur le même épisode court et la même voix.
//   B = finition (transition mascottes ≥ 1 s, texte ajusté, flou de mouvement) + slogan, baseline et règle condensée
//   C = B + question colorée mot à mot au rythme de la voix, chrono lancé à la fin de la phrase
//   D = C + mascottes animées (respiration, clignement, clin d'œil, rebond à chaque mot)
// Usage : node scripts/pilot.mjs [--episode data/pilots/pilote-finitions.json] [--only B]   → out/pilote/pilote-<lot>.mp4
import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { argv, p, readJson, writeJson } from "./lib.mjs";

const ep = readJson(argv("episode", p("data/pilots/pilote-finitions.json")));
const only = argv("only", "");
const LOTS = { B: { finish: true }, C: { finish: true, sync: true }, D: { finish: true, sync: true, rig: true }, V2: ep.fx ?? {} };
mkdirSync(p("out/pilote"), { recursive: true });
for (const [lot, fx] of Object.entries(LOTS)) {
  if (only && only !== lot) continue;
  const props = p(`out/pilote/props-${lot}.json`);
  writeJson(props, { episode: { ...ep, fx } });
  console.log(`> pilote ${lot}`);
  execSync(`npx remotion render src/index.ts ${ep.template} "out/pilote/pilote-${lot}.mp4" --props="${props}" --log=error`, { cwd: p(), stdio: "inherit" });
}
