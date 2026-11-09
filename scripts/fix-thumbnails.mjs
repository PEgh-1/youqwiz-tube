// Repose les miniatures manquantes (après vérification de la chaîne) : épisodes publiés + bande-annonce.
// Re-rend la miniature depuis data/episodes/<id>.json si le PNG n'est plus là. Usage : node scripts/fix-thumbnails.mjs
import { execSync } from "node:child_process";
import { createReadStream, existsSync, mkdirSync } from "node:fs";
import { google } from "googleapis";
import { p, readJson, writeJson } from "./lib.mjs";
const { YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN } = process.env;
if (!(YT_CLIENT_ID && YT_CLIENT_SECRET && YT_REFRESH_TOKEN)) throw new Error("secrets YT_* absents");
const oauth = new google.auth.OAuth2(YT_CLIENT_ID, YT_CLIENT_SECRET);
oauth.setCredentials({ refresh_token: YT_REFRESH_TOKEN });
const yt = google.youtube({ version: "v3", auth: oauth });
const run = (c) => execSync(c, { cwd: p(), stdio: "inherit" });
const setThumb = async (videoId, file) => { await yt.thumbnails.set({ videoId, media: { body: createReadStream(file) } }); console.log(`${videoId} : miniature posée`); };

const queue = readJson(p("data/state/queue.json"));
for (const r of queue.published) {
  if (r.thumbnail || !r.longId) continue;
  const f = p("out", r.id, "thumbA.png");
  if (!existsSync(f)) {
    const epFile = p("data/episodes", `${r.id}.json`);
    if (!existsSync(epFile)) { console.log(`${r.id} : épisode introuvable, à poser à la main`); continue; }
    mkdirSync(p("out", r.id), { recursive: true });
    writeJson(p("out", r.id, "props.json"), { episode: readJson(epFile) });
    run(`npx remotion still src/index.ts ThumbA "${f}" --props="${p("out", r.id, "props.json")}" --log=error`);
  }
  await setThumb(r.longId, f);
  r.thumbnail = true;
}
writeJson(p("data/state/queue.json"), queue);

const channel = readJson(p("data/state/channel.json"), {});
if (channel.trailerId && !channel.trailerThumbnail) {
  const f = p("out/channel/trailer-thumb.png");
  mkdirSync(p("out/channel"), { recursive: true });
  run(`npx remotion still src/index.ts Trailer "${f}" --frame=20 --log=error`);
  await setThumb(channel.trailerId, f);
  channel.trailerThumbnail = true;
  writeJson(p("data/state/channel.json"), channel);
}
