// Jeton YouTube sans installation : fonctionne avec Node seul (pas de git, pas de npm).
//   node auth-standalone.mjs
// Le script demande l'ID client et le code secret, ouvre l'autorisation Google, puis affiche YT_REFRESH_TOKEN.
import http from "node:http";
import readline from "node:readline/promises";
import { exec } from "node:child_process";

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const clientId = (process.env.YT_CLIENT_ID || (await rl.question("ID client (…apps.googleusercontent.com) : "))).trim();
const clientSecret = (process.env.YT_CLIENT_SECRET || (await rl.question("Code secret du client (GOCSPX-…) : "))).trim();
rl.close();

const redirect = "http://localhost:8765";
const scopes = ["https://www.googleapis.com/auth/youtube.upload", "https://www.googleapis.com/auth/youtube", "https://www.googleapis.com/auth/youtube.force-ssl", "https://www.googleapis.com/auth/yt-analytics.readonly"].join(" ");
const url =
  "https://accounts.google.com/o/oauth2/v2/auth?" +
  new URLSearchParams({ client_id: clientId, redirect_uri: redirect, response_type: "code", access_type: "offline", prompt: "select_account consent", scope: scopes });

http
  .createServer(async (req, res) => {
    const code = new URL(req.url, redirect).searchParams.get("code");
    if (!code) return res.end("code manquant");
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirect, grant_type: "authorization_code" }),
    });
    const tokens = await r.json();
    if (!tokens.refresh_token) {
      res.end("Erreur, regarde la fenêtre PowerShell.");
      console.error("\nRéponse Google sans refresh_token :", tokens);
      process.exit(1);
    }
    res.end("<h1 style='font-family:sans-serif'>OK, tu peux fermer cet onglet et retourner dans PowerShell.</h1>");
    // Copie automatique dans le presse-papiers Windows : il ne reste qu'à coller (Ctrl+V) dans GitHub.
    const clip = exec("clip");
    clip.stdin.end(tokens.refresh_token);
    console.log("\n\nJeton obtenu et COPIÉ dans le presse-papiers. Retourne dans la fenêtre Playwright et fais Ctrl+V dans la case du secret YT_REFRESH_TOKEN.\n");
    setTimeout(() => process.exit(0), 500);
  })
  .listen(8765, () => {
    console.log("\nOuvre cette adresse dans ton navigateur (connexion avec le compte de la chaîne YouQwiz) :\n\n" + url + "\n");
    exec(`start "" "${url}"`);
  });
