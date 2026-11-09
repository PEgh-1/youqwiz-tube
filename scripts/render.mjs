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

// 2e Short (09/11/2026) : les 8 questions les plus dures de l'épisode (jamais celles du 1er Short, qui prend les premières),
// niveau explicité (sinon le quartile de position les rendrait « faciles »), accroche et sticker « niveau impossible ».
const hardCount = Math.min(8, Math.max(0, ep.items.length - (ep.meta.shortItems ?? 5) - 1));
const levelOf = (i) => ep.items[i].level ?? ["facile", "moyen", "difficile", "impossible"][Math.min(3, Math.floor((i / ep.items.length) * 4))];
const hardItems = ep.items.slice(ep.items.length - hardCount).map((it, k) => ({ ...it, level: levelOf(ep.items.length - hardCount + k) }));
const ep2 = hardCount >= 3 && ep.meta.short2
  ? { ...ep, items: hardItems, meta: { ...ep.meta, thumbnail: { ...ep.meta.thumbnail, sticker: ep.meta.short2.sticker }, shortHook: { sticker: ep.meta.short2.sticker, line: (ep.meta.short2.line ?? "").replace("8", String(hardCount)) }, shortLine: (ep.meta.short2.line ?? "").replace("8", String(hardCount)) || undefined, totalItems: ep.items.length } }
  : null;
const propsFile2 = `${outDir}/props-short2.json`;
if (ep2) writeJson(propsFile2, { episode: ep2 });
const props2 = `--props="${propsFile2}"`;
// 3e Short (16 h) : 8 questions du milieu, distinctes des deux autres Shorts (les 8 premières et les 8 dernières).
const midCount = Math.min(8, Math.max(0, ep.items.length - 16));
const midStart = Math.floor((ep.items.length - midCount) / 2);
const midItems = ep.items.slice(midStart, midStart + midCount).map((it, k) => ({ ...it, level: levelOf(midStart + k) }));
const ep3 = midCount >= 3 && ep.meta.short3
  ? { ...ep, items: midItems, meta: { ...ep.meta, thumbnail: { ...ep.meta.thumbnail, sticker: ep.meta.short3.sticker }, shortHook: { sticker: ep.meta.short3.sticker, line: (ep.meta.short3.line ?? "").replace("8", String(midCount)) }, shortLine: (ep.meta.short3.line ?? "").replace("8", String(midCount)) || undefined, totalItems: ep.items.length } }
  : null;
const propsFile3 = `${outDir}/props-short3.json`;
if (ep3) writeJson(propsFile3, { episode: ep3 });
const props3 = `--props="${propsFile3}"`;

// Durées attendues, telles que Remotion les calcule (source de vérité pour le contrôle qualité).
const listing = execSync(`npx remotion compositions src/index.ts ${props}`, { cwd: p(), stdio: ["ignore", "pipe", "ignore"] }).toString();
const expected = {};
for (const m of listing.matchAll(/^(\S+)\s+\d+\s+\d+x\d+\s+\d+ \(([\d.]+) sec\)/gm)) expected[m[1]] = Number(m[2]);
if (!expected[comp] || !expected[shortComp]) throw new Error(`durées introuvables pour ${comp}/${shortComp} : ${listing}`);
const shortDuration = (propsArg) => {
  const listing = execSync(`npx remotion compositions src/index.ts ${propsArg}`, { cwd: p(), stdio: ["ignore", "pipe", "ignore"] }).toString();
  const m = listing.match(new RegExp(`^${shortComp}\\s+\\d+\\s+\\d+x\\d+\\s+\\d+ \\(([\\d.]+) sec\\)`, "m"));
  return m ? Number(m[1]) : null;
};
const expectedShort2 = ep2 ? shortDuration(props2) : null;
const expectedShort3 = ep3 ? shortDuration(props3) : null;
console.log(`durées attendues : longue ${expected[comp]} s, Short ${expected[shortComp]} s${ep2 ? `, Short 2 ${expectedShort2} s` : ""}${ep3 ? `, Short 3 ${expectedShort3} s` : ""}`);
if (process.env.RENDER_DRY) { console.log("RENDER_DRY : pas de rendu"); process.exit(0); }

run(`npx remotion render src/index.ts ${comp} "${outDir}/long.mp4" ${props} --log=error`);
run(`npx remotion render src/index.ts ${shortComp} "${outDir}/short.mp4" ${props} --log=error`);
if (ep2) run(`npx remotion render src/index.ts ${shortComp} "${outDir}/short2.mp4" ${props2} --log=error`);
if (ep3) run(`npx remotion render src/index.ts ${shortComp} "${outDir}/short3.mp4" ${props3} --log=error`);
run(`npx remotion still src/index.ts ThumbA "${outDir}/thumbA.png" ${props} --log=error`);
run(`npx remotion still src/index.ts ThumbB "${outDir}/thumbB.png" ${props} --log=error`);

writeJson(`${outDir}/manifest.json`, {
  id: ep.id,
  title: ep.title,
  files: { long: `${outDir}/long.mp4`, short: `${outDir}/short.mp4`, ...(ep2 ? { short2: `${outDir}/short2.mp4` } : {}), ...(ep3 ? { short3: `${outDir}/short3.mp4` } : {}), thumbA: `${outDir}/thumbA.png`, thumbB: `${outDir}/thumbB.png` },
  expected: { long: expected[comp], short: expected[shortComp], ...(ep2 ? { short2: expectedShort2 } : {}), ...(ep3 ? { short3: expectedShort3 } : {}) },
  renderedAt: new Date().toISOString(),
});
console.log(`rendu terminé : ${outDir}`);
