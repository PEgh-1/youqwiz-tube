// Vérifie les secrets YouTube sans rien publier : affiche la chaîne autorisée.
import { google } from "googleapis";

const { YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN } = process.env;
if (!(YT_CLIENT_ID && YT_CLIENT_SECRET && YT_REFRESH_TOKEN)) {
  console.log("secrets YT_* absents : mode simulation");
  process.exit(0);
}
const oauth = new google.auth.OAuth2(YT_CLIENT_ID, YT_CLIENT_SECRET);
oauth.setCredentials({ refresh_token: YT_REFRESH_TOKEN });
const yt = google.youtube({ version: "v3", auth: oauth });
const res = await yt.channels.list({ part: ["snippet", "statistics"], mine: true });
const ch = res.data.items?.[0];
if (!ch) throw new Error("aucune chaîne associée au jeton");
if (process.env.GITHUB_ACTIONS) console.log(`::notice title=YouTube::${ch.snippet.title} (${ch.id})`);
console.log(`chaîne autorisée : ${ch.snippet.title} (${ch.id}) — ${ch.statistics.subscriberCount} abonnés, ${ch.statistics.videoCount} vidéos`);
if (!/youqwiz/i.test(ch.snippet.title)) {
  console.error("ATTENTION : le jeton n'est pas celui de la chaîne YouQwiz");
  process.exit(1);
}
