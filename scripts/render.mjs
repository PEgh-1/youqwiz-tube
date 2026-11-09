// Rend la vidéo longue, le Short et les deux miniatures de l'épisode courant.
// Usage : node scripts/render.mjs [--episode data/episodes/x.json]
import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { argv, p, readJson, writeJson } from "./lib.mjs";

const current = readJson(p("data/state/current.json"));
const file = argv("episode", current?.file);
if (!file) throw new Error("aucun épisode : lance d'abord `npm run generate`");
const ep = readJson(file);
const outDir = p("out", ep.id);
mkdirSync(outDir, { recursive: true });

execSync("node scripts/prepare-assets.mjs", { cwd: p(), stdio: "inherit" });

const run = (cmd) => {
  console.log(`> ${cmd}`);
  execSync(cmd, { cwd: p(), stdio: "inherit" });
};
// Les compositions attendent { episode, vertical } : on enveloppe l'épisode (sinon Remotion rend l'exemple par défaut).
const propsFile = `${outDir}/props.json`;
writeJson(propsFile, { episode: ep });
const props = `--props="${propsFile}"`;
const comp = ep.template;
const shortComp = comp === "DevineEn3s" ? "DevineShort" : `${comp}Short`;

// Durées attendues, telles que Remotion les calcule (source de vérité pour le contrôle qualité).
const listing = execSync(`npx remotion compositions src/index.ts ${props}`, { cwd: p(), stdio: ["ignore", "pipe", "ignore"] }).toString();
const expected = {};
for (const m of listing.matchAll(/^(\S+)\s+\d+\s+\d+x\d+\s+\d+ \(([\d.]+) sec\)/gm)) expected[m[1]] = Number(m[2]);
if (!expected[comp] || !expected[shortComp]) throw new Error(`durées introuvables pour ${comp}/${shortComp} : ${listing}`);
console.log(`durées attendues : longue ${expected[comp]} s, Short ${expected[shortComp]} s`);

run(`npx remotion render src/index.ts ${comp} "${outDir}/long.mp4" ${props} --log=error`);
run(`npx remotion render src/index.ts ${shortComp} "${outDir}/short.mp4" ${props} --log=error`);
run(`npx remotion still src/index.ts ThumbA "${outDir}/thumbA.png" ${props} --log=error`);
run(`npx remotion still src/index.ts ThumbB "${outDir}/thumbB.png" ${props} --log=error`);

writeJson(`${outDir}/manifest.json`, {
  id: ep.id,
  title: ep.title,
  files: { long: `${outDir}/long.mp4`, short: `${outDir}/short.mp4`, thumbA: `${outDir}/thumbA.png`, thumbB: `${outDir}/thumbB.png` },
  expected: { long: expected[comp], short: expected[shortComp] },
  renderedAt: new Date().toISOString(),
});
console.log(`rendu terminé : ${outDir}`);
