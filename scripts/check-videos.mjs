// Lecture seule : statut YouTube d'une liste de vidéos. Usage : node scripts/check-videos.mjs --ids a,b,c
import { google } from "googleapis";
import { argv } from "./lib.mjs";
const ids = argv("ids", "").split(",").filter(Boolean);
const oauth = new google.auth.OAuth2(process.env.YT_CLIENT_ID, process.env.YT_CLIENT_SECRET);
oauth.setCredentials({ refresh_token: process.env.YT_REFRESH_TOKEN });
const yt = google.youtube({ version: "v3", auth: oauth });
const items = (await yt.videos.list({ part: ["status", "snippet", "contentDetails"], id: ids })).data.items ?? [];
for (const id of ids) {
  const v = items.find((x) => x.id === id);
  const line = v ? `${id} ${v.status.privacyStatus} publishAt=${v.status.publishAt ?? "-"} ${v.contentDetails.duration} « ${v.snippet.title.slice(0, 60)} »` : `${id} ABSENTE`;
  console.log(line);
  if (process.env.GITHUB_ACTIONS) console.log(`::notice title=Vidéo::${line}`);
}
