// Remplace la miniature de toutes les vidéos longues de la file (gabarit « choc » v5 du 05/11/2026 : A = mascotte défi, B = mascotte choc, alternance par jour comme upload.mjs).
// Usage (workflow maintenance, script=retheme-thumbnails.mjs).
import { execSync } from "node:child_process";
import { createReadStream, existsSync, mkdirSync } from "node:fs";
import { google } from "googleapis";
import { p, readJson, writeJson } from "./lib.mjs";
const { YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN } = process.env;
if (!(YT_CLIENT_ID && YT_CLIENT_SECRET && YT_REFRESH_TOKEN)) throw new Error("secrets YT_* absents");
const oauth = new google.auth.OAuth2(YT_CLIENT_ID, YT_CLIENT_SECRET);
oauth.setCredentials({ refresh_token: YT_REFRESH_TOKEN });
const yt = google.youtube({ version: "v3", auth: oauth });
const VERSION = "choc2";
const queue = readJson(p("data/state/queue.json"));
const thumbs = readJson(p("data/state/thumbnails.json"), {});
for (const r of queue.published) {
  if (!r.longId || r.thumbVersion === VERSION) continue;
  const epFile = p("data/episodes", `${r.id}.json`);
  if (!existsSync(epFile)) { console.log(`${r.id} : épisode introuvable`); continue; }
  const ep = readJson(epFile);
  for (const it of ep.items) delete it.voice;
  delete ep.voice;
  mkdirSync(p("out", r.id), { recursive: true });
  const dayIdx = Math.round(Date.parse(r.date ?? r.id.slice(0, 10)) / 86400000);
  const variant = thumbs.winner ?? (dayIdx % 2 === 0 ? "A" : "B");
  writeJson(p("out", r.id, "props-thumb.json"), { episode: ep, variant: variant === "A" ? 0 : 1 });
  const f = p("out", r.id, "thumb-choc.png");
  execSync(`npx remotion still src/index.ts ThumbA "${f}" --props="${p("out", r.id, "props-thumb.json")}" --log=error`, { cwd: p(), stdio: "inherit" });
  await yt.thumbnails.set({ videoId: r.longId, media: { body: createReadStream(f) } });
  r.thumbnail = true;
  r.thumbVariant = variant;
  r.thumbVersion = VERSION;
  console.log(`${r.id} (${r.longId}) : miniature ${variant} posée`);
  writeJson(p("data/state/queue.json"), queue);
}
console.log(`::notice title=Miniatures::${queue.published.filter((r) => r.thumbVersion === VERSION).length} miniatures ${VERSION} posées`);
