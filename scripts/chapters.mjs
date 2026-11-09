// Chapitres YouTube de l'épisode courant (après la voix off, avant le rendu) : calculés avec la timeline réelle de la vidéo longue
// (src/timeline.ts, importé tel quel : Node 22 efface les types), puis ajoutés à la description.
// Usage : node scripts/chapters.mjs [--episode data/episodes/x.json]
import { argv, p, readJson, writeJson } from "./lib.mjs";
import { chaptersOf } from "../src/timeline.ts";

const current = readJson(p("data/state/current.json"));
const file = argv("episode", current?.file);
const ep = readJson(file);
if (!ep) throw new Error("aucun épisode : lance d'abord `npm run generate`");

const FPS = 30;
const chapters = chaptersOf(ep, FPS);
const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const block = ["⏱️ Chapitres", ...chapters.map((c) => `${mmss(c.at)} ${c.title}`)].join("\n");
ep.meta.chapters = chapters;
ep.meta.description = ep.meta.description.replace(/\n*⏱️ Chapitres[\s\S]*$/, "").trimEnd() + "\n\n" + block;
writeJson(file, ep);
console.log(`chapitres : ${chapters.map((c) => `${mmss(c.at)} ${c.title}`).join(" · ")}`);
