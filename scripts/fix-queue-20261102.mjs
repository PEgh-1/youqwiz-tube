// Réparation ponctuelle du 02/11 : deux envois du même épisode (3 nov.) placés les 5 et 6 nov. par erreur.
// → LsW6S_1ahic/xhCUR2KrLhk reprogrammés au 3 nov. ; 7qQfODvYUIo/KthE8zHZVR4 (doublon privé) supprimés.
import { google } from "googleapis";
import { p, readJson, writeJson } from "./lib.mjs";
const { YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN } = process.env;
const oauth = new google.auth.OAuth2(YT_CLIENT_ID, YT_CLIENT_SECRET);
oauth.setCredentials({ refresh_token: YT_REFRESH_TOKEN });
const yt = google.youtube({ version: "v3", auth: oauth });
const queue = readJson(p("data/state/queue.json"));
const keep = queue.published.find((r) => r.longId === "LsW6S_1ahic");
const dup = queue.published.find((r) => r.longId === "7qQfODvYUIo");
if (keep && keep.date !== "2026-11-03") {
  for (const [vid, at] of [[keep.longId, "2026-11-03T16:30:00.000Z"], [keep.shortId, "2026-11-03T11:00:00.000Z"]]) {
    await yt.videos.update({ part: ["status"], requestBody: { id: vid, status: { privacyStatus: "private", publishAt: at, selfDeclaredMadeForKids: false, embeddable: true } } });
    console.log(`${vid} → ${at}`);
  }
  keep.date = "2026-11-03"; keep.publishAt = "2026-11-03T16:30:00.000Z"; keep.shortPublishAt = "2026-11-03T11:00:00.000Z";
}
if (dup) {
  for (const vid of [dup.longId, dup.shortId]) {
    const info = (await yt.videos.list({ part: ["status"], id: [vid] })).data.items?.[0];
    if (info && info.status.privacyStatus === "private") { await yt.videos.delete({ id: vid }); console.log(`${vid} supprimée (doublon privé)`); }
  }
  queue.published = queue.published.filter((r) => r !== dup);
}
queue.published.sort((a, b) => a.date.localeCompare(b.date));
queue.lastScheduled = queue.published.at(-1).date;
writeJson(p("data/state/queue.json"), queue);
console.log("file :", queue.published.map((r) => `${r.date} ${r.id}`).join(" | "), "| dernier :", queue.lastScheduled);
