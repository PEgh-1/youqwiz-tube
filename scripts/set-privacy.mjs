// Change la visibilité d'une vidéo (public | unlisted | private) et note-le dans la file.
// Usage : node scripts/set-privacy.mjs --id <videoId> --status unlisted
import { google } from "googleapis";
import { argv, p, readJson, writeJson } from "./lib.mjs";
const { YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN } = process.env;
if (!(YT_CLIENT_ID && YT_CLIENT_SECRET && YT_REFRESH_TOKEN)) throw new Error("secrets YT_* absents");
const id = argv("id"), status = argv("status");
if (!id || !["public", "unlisted", "private"].includes(status)) throw new Error("usage : --id <videoId> --status public|unlisted|private");
const oauth = new google.auth.OAuth2(YT_CLIENT_ID, YT_CLIENT_SECRET);
oauth.setCredentials({ refresh_token: YT_REFRESH_TOKEN });
const yt = google.youtube({ version: "v3", auth: oauth });
const { data } = await yt.videos.list({ id: [id], part: ["status", "snippet"] });
const v = data.items?.[0];
if (!v) throw new Error(`vidéo ${id} introuvable`);
await yt.videos.update({ part: ["status"], requestBody: { id, status: { ...v.status, privacyStatus: status, publishAt: undefined } } });
const queue = readJson(p("data/state/queue.json"), { published: [] });
for (const r of queue.published) if (r.longId === id || r.shortId === id) { r.privacy = { ...(r.privacy ?? {}), [r.longId === id ? "long" : "short"]: status }; }
writeJson(p("data/state/queue.json"), queue);
console.log(`${id} (« ${v.snippet.title} ») → ${status}`);
if (process.env.GITHUB_ACTIONS) console.log(`::notice title=Visibilité::${id} → ${status}`);
