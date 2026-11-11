// Suspend une vidéo programmée : privée, sans date de publication. Refuse de toucher une vidéo déjà publique.
// Usage : node scripts/hold-video.mjs <videoId>
import { google } from "googleapis";
const { YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN } = process.env;
if (!(YT_CLIENT_ID && YT_CLIENT_SECRET && YT_REFRESH_TOKEN)) throw new Error("secrets YT_* absents");
const id = process.argv[2];
if (!id) throw new Error("usage : hold-video.mjs <videoId>");
const oauth = new google.auth.OAuth2(YT_CLIENT_ID, YT_CLIENT_SECRET);
oauth.setCredentials({ refresh_token: YT_REFRESH_TOKEN });
const yt = google.youtube({ version: "v3", auth: oauth });
const get = async () => (await yt.videos.list({ id: [id], part: ["status", "snippet"] })).data.items?.[0];
const v = await get();
if (!v) throw new Error(`vidéo ${id} introuvable`);
if (v.status.privacyStatus !== "private") { console.log(`${id} (« ${v.snippet.title} ») : déjà ${v.status.privacyStatus}, non modifiée`); process.exit(0); }
const { publishAt, ...status } = v.status;
await yt.videos.update({ part: ["status"], requestBody: { id, status: { ...status, privacyStatus: "private" } } });
const after = await get();
console.log(`${id} (« ${v.snippet.title} ») : était programmée ${publishAt ?? "(sans date)"} → ${after.status.privacyStatus}, date ${after.status.publishAt ?? "retirée"}`);
if (after.status.publishAt) { console.log(`::error title=Suspension::${id} garde une date de publication`); process.exit(1); }
