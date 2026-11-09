// Rend les visuels de chaîne : avatar, bannière, filigrane, bande-annonce, miniature du trailer.
import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { p } from "./lib.mjs";
mkdirSync(p("out/channel"), { recursive: true });
execSync("node scripts/prepare-assets.mjs", { cwd: p(), stdio: "inherit" });
const run = (c) => { console.log("> " + c); execSync(c, { cwd: p(), stdio: "inherit" }); };
run(`npx remotion still src/index.ts Avatar0 out/channel/Avatar0.png --log=error`);
run(`npx remotion still src/index.ts Banner1 out/channel/Banner1.png --log=error`);
run(`npx remotion still src/index.ts Watermark out/channel/watermark.png --image-format=png --log=error`);
run(`npx remotion render src/index.ts Trailer out/channel/trailer.mp4 --log=error`);
run(`npx remotion still src/index.ts Trailer out/channel/Banner1-thumb.png --frame=20 --log=error`);
