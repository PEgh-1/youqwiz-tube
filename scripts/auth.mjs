// Obtention unique du refresh token YouTube (à lancer sur un ordinateur avec navigateur) :
//   YT_CLIENT_ID=... YT_CLIENT_SECRET=... node scripts/auth.mjs
// Prérequis : projet Google Cloud, API « YouTube Data API v3 » activée, identifiant OAuth
// de type « Application de bureau », redirection http://localhost:8765.
import http from "node:http";
import { google } from "googleapis";

const { YT_CLIENT_ID, YT_CLIENT_SECRET } = process.env;
if (!YT_CLIENT_ID || !YT_CLIENT_SECRET) throw new Error("YT_CLIENT_ID et YT_CLIENT_SECRET requis");
const oauth = new google.auth.OAuth2(YT_CLIENT_ID, YT_CLIENT_SECRET, "http://localhost:8765");
const url = oauth.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",
  scope: ["https://www.googleapis.com/auth/youtube.upload", "https://www.googleapis.com/auth/youtube", "https://www.googleapis.com/auth/youtube.force-ssl", "https://www.googleapis.com/auth/yt-analytics.readonly"],
});
console.log("\nOuvre cette adresse dans le navigateur connecté au compte YouTube de la chaîne :\n\n" + url + "\n");

http
  .createServer(async (req, res) => {
    const code = new URL(req.url, "http://localhost:8765").searchParams.get("code");
    if (!code) return res.end("code manquant");
    const { tokens } = await oauth.getToken(code);
    res.end("OK, tu peux fermer cet onglet.");
    console.log("\nYT_REFRESH_TOKEN=" + tokens.refresh_token + "\n\nÀ coller dans les secrets GitHub du dépôt.");
    process.exit(0);
  })
  .listen(8765);
