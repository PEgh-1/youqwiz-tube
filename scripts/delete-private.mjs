// Supprime des vidéos UNIQUEMENT si elles sont privées (jamais une vidéo publique), et nettoie la file.
// Usage : node scripts/delete-private.mjs --ids a,b [--pending clé]
import { google } from "googleapis";
import { argv, p, readJson, writeJson } from "./lib.mjs";
const ids = argv("ids", "").split(",").filter(Boolean);
const pendingKey = argv("pending");
const oauth = new google.auth.OAuth2(process.env.YT_CLIENT_ID, process.env.YT_CLIENT_SECRET);
oauth.setCredentials({ refresh_token: process.env.YT_REFRESH_TOKEN });
const yt = google.youtube({ version: "v3", auth: oauth });
const items = (await yt.videos.list({ part: ["status"], id: ids })).data.items ?? [];
for (const v of items) if (v.status.privacyStatus !== "private") throw new Error(`${v.id} n'est pas privée : rien n'est supprimé`);
for (const id of ids) {
  if (!items.find((v) => v.id === id)) { console.log(`${id} : déjà absente`); continue; }
  await yt.videos.delete({ id });
  console.log(`${id} : supprimée`);
  if (process.env.GITHUB_ACTIONS) console.log(`::notice title=Suppression::${id} (privée) supprimée`);
}
if (pendingKey) {
  const q = readJson(p("data/state/queue.json"));
  if (q.pending?.[pendingKey]) { delete q.pending[pendingKey]; writeJson(p("data/state/queue.json"), q); console.log(`file : pending ${pendingKey} retiré`); }
}
