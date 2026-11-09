// Refaire un épisode déjà envoyé mais pas encore publié : supprime la longue + le Short sur YouTube
// (vidéos privées programmées), retire l'entrée de la file ; le run continue avec generate --date <date>.
// Usage : node scripts/redo-episode.mjs --id 2026-11-03-tu-preferes
import { google } from "googleapis";
import { argv, p, readJson, writeJson } from "./lib.mjs";

const id = argv("id");
if (!id) throw new Error("--id manquant");
const queue = readJson(p("data/state/queue.json"));
const r = queue.published.find((x) => x.id === id);
if (!r) throw new Error(`épisode ${id} absent de la file`);
if (Date.parse(r.publishAt) < Date.now()) throw new Error(`${id} est déjà public : on ne supprime pas une vidéo publiée`);

const { YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN } = process.env;
const oauth = new google.auth.OAuth2(YT_CLIENT_ID, YT_CLIENT_SECRET);
oauth.setCredentials({ refresh_token: YT_REFRESH_TOKEN });
const yt = google.youtube({ version: "v3", auth: oauth });
// Vérifie TOUTES les vidéos avant de supprimer quoi que ce soit (sinon une longue privée part alors que le Short est déjà public).
const ids = [r.longId, r.shortId].filter(Boolean);
const infos = (await yt.videos.list({ part: ["status"], id: ids })).data.items ?? [];
for (const info of infos) if (info.status.privacyStatus !== "private") throw new Error(`${info.id} n'est pas privée (${info.status.privacyStatus}) : rien n'a été supprimé`);
for (const vid of ids) {
  if (!infos.find((x) => x.id === vid)) { console.log(`${vid} : déjà absent`); continue; }
  await yt.videos.delete({ id: vid });
  console.log(`${vid} : supprimée (privée, programmée ${r.publishAt})`);
}
queue.published = queue.published.filter((x) => x.id !== id);
delete queue.pending?.[id];
writeJson(p("data/state/queue.json"), queue);
console.log(`file : ${id} retiré ; relancer generate --date ${r.date}`);
