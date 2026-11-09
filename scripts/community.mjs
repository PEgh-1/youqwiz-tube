// Communauté : commentaire « Dis ton score » sur chaque vidéo publiée, et champion de la semaine.
//   node scripts/community.mjs --post         : poste le commentaire sur les vidéos passées en public (≤ 36 h) sans commentaire
//   node scripts/community.mjs --leaderboard  : lit les commentaires des 7 derniers jours, élit le champion → data/state/leaderboard.json
// L'API ne sait pas épingler : l'épinglage est fait à la main / par Claude (navigateur).
// 08/11/2026 : le meilleur score de la veille est félicité dans le commentaire du jour + réponse à son commentaire.
import { google } from "googleapis";
import { p, readJson, todayParis, writeJson } from "./lib.mjs";

const { YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN } = process.env;
if (!(YT_CLIENT_ID && YT_CLIENT_SECRET && YT_REFRESH_TOKEN)) throw new Error("secrets YT_* absents");
const oauth = new google.auth.OAuth2(YT_CLIENT_ID, YT_CLIENT_SECRET);
oauth.setCredentials({ refresh_token: YT_REFRESH_TOKEN });
const yt = google.youtube({ version: "v3", auth: oauth });
const queue = readJson(p("data/state/queue.json"), { published: [] });
const now = Date.now();
const mode = process.argv.includes("--leaderboard") ? "leaderboard" : "post";

// Commentaire épinglé : trois formulations par pilier, tirées selon l'épisode (03/11/2026 : variation).
const COMMENT = (ep, champion) => {
  const isChoice = ep?.pillar === "choix";
  const h = [...String(ep?.id ?? "")].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const openers = isChoice
    ? ["🤔 Tes choix les plus difficiles ? Dis-les ici 👇", "😅 Lequel t'a fait hésiter le plus longtemps ? Raconte 👇", "👀 Tu as choisi quoi à la question 10 ? Dis-le ici 👇"]
    : ["🏆 TON SCORE ? Écris-le en commentaire (ex. « 3 400 pts ») 👇", "🧠 Combien de points ? Note ton score ici (ex. « 2 800 pts ») 👇", "⭐ Dis ton score en commentaire (ex. « 4 100 pts ») et ta question préférée 👇"];
  // 08/11/2026 : le meilleur score de la veille est félicité ici chaque jour ; le champion de la semaine reste cité dans la vidéo du lundi.
  const second = isChoice ? "Le choix le plus commenté de la semaine est cité dans la vidéo du lundi." : "Le meilleur score d'hier est félicité ici chaque jour, et le champion de la semaine est cité dans la vidéo du lundi, avec ton pseudo 👑";
  const crown = champion ? `👑 Champion d'hier : ${champion.name} avec ${champion.score.toLocaleString("fr-FR")} pts — bravo ! Qui fait mieux aujourd'hui ?` : null;
  const page = `https://youqwiz.com/quiz-du-jour/${ep?.id ?? ""}`;
  const ctas = [`🎮 Joue à ce quiz en version interactive et défie tes proches : ${page}`, `🎮 Le même quiz, jouable sur ton téléphone : ${page}`, `🎮 Compare ton score avec tes amis sur ${page}`];
  return [openers[h % openers.length], second, ...(crown ? ["", crown] : []), "", ctas[(h >> 3) % ctas.length], "🔔 Un nouveau quiz chaque jour à 17h30 — abonne-toi !"].join("\n");
};

// Scores valides trouvés dans les commentaires d'une liste de vidéos (hors « tu préfères », hors chaîne elle-même).
const scoreRe = /(\d{1,2}(?:[   .]\d{3})|\d{3,5})\s*(?:pts|points|pt|p\b)/i;
async function scanScores(records) {
  const candidates = [];
  for (const r of records) {
    const ep = readJson(p("data/episodes", `${r.id}.json`));
    if (ep?.pillar === "choix") continue;
    const max = (ep?.items ?? []).reduce((s, it) => s + ({ facile: 100, moyen: 200, difficile: 300, impossible: 500 }[it.level] ?? 100), 0) || 20000;
    let pageToken;
    do {
      const res = await yt.commentThreads.list({ part: ["snippet"], videoId: r.longId, maxResults: 100, textFormat: "plainText", pageToken });
      for (const th of res.data.items ?? []) {
        const c = th.snippet.topLevelComment.snippet;
        if (c.authorChannelId?.value === "UC8oMCBciJvAUmVtoz8WxZ9g") continue;
        const m = c.textDisplay.match(scoreRe);
        if (!m) continue;
        const score = Number(m[1].replace(/[^\d]/g, ""));
        if (score <= 0 || score > max) continue; // triche grossière
        candidates.push({ name: c.authorDisplayName.replace(/^@/, "").slice(0, 18), score, videoId: r.longId, episode: r.id, likes: c.likeCount, threadId: th.id });
      }
      pageToken = res.data.nextPageToken;
    } while (pageToken);
  }
  candidates.sort((a, b) => b.score - a.score || b.likes - a.likes);
  return candidates;
}

if (mode === "post") {
  let n = 0;
  // Champion de la veille (08/11/2026) : meilleur score commenté sur la ou les vidéos publiées il y a 20 à 44 h.
  const yesterday = queue.published.filter((r) => r.longId && now - Date.parse(r.publishAt) > 20 * 3600e3 && now - Date.parse(r.publishAt) < 44 * 3600e3);
  let daily = null;
  try {
    daily = (await scanScores(yesterday))[0] ?? null;
    console.log(daily ? `champion d'hier : ${daily.name} — ${daily.score} pts (${daily.episode})` : `aucun score hier (${yesterday.length} vidéo(s))`);
  } catch (e) {
    console.warn(`champion d'hier : ${e.message}`);
  }
  for (const r of queue.published) {
    if (!r.longId || r.commentId) continue;
    const t = Date.parse(r.publishAt);
    if (t > now || now - t > 36 * 3600e3) continue;
    const ep = readJson(p("data/episodes", `${r.id}.json`));
    try {
      const res = await yt.commentThreads.insert({ part: ["snippet"], requestBody: { snippet: { videoId: r.longId, topLevelComment: { snippet: { textOriginal: COMMENT(ep, ep?.pillar === "choix" ? null : daily) } } } } });
      r.commentId = res.data.id;
      r.commentAt = new Date().toISOString();
      n++;
      console.log(`${r.id} : commentaire posté (${r.commentId})`);
      // Félicitations au champion de la veille, en réponse à son commentaire (une seule fois).
      if (daily && ep?.pillar !== "choix") {
        const prev = queue.published.find((x) => x.id === daily.episode);
        if (prev && !prev.dailyChampion) {
          try {
            await yt.comments.insert({ part: ["snippet"], requestBody: { snippet: { parentId: daily.threadId, textOriginal: `🏆 Bravo ${daily.name}, meilleur score d'hier avec ${daily.score.toLocaleString("fr-FR")} pts ! Tu es félicité dans le commentaire épinglé du quiz du jour 👉 https://youtu.be/${r.longId}` } } });
            prev.dailyChampion = { name: daily.name, score: daily.score, congratulatedIn: r.id };
            console.log(`${daily.episode} : champion ${daily.name} félicité`);
          } catch (e) {
            console.warn(`réponse au champion : ${e.message}`);
          }
        }
      }
    } catch (e) {
      console.warn(`${r.id} : ${e.message}`);
    }
  }
  // Shorts : commentaire avec le lien vers la vidéo complète (le Short sort à 12 h, la longue à 17 h 30 : on poste après 17 h 30)
  for (const r of queue.published) {
    if (!r.shortId || !r.longId || r.shortCommentId) continue;
    const t = Date.parse(r.publishAt);
    if (t > now || now - t > 36 * 3600e3) continue;
    try {
      const res = await yt.commentThreads.insert({ part: ["snippet"], requestBody: { snippet: { videoId: r.shortId, topLevelComment: { snippet: { textOriginal: `🎬 La réponse + toutes les questions ici 👉 https://youtu.be/${r.longId}\n🎮 Joue au quiz complet : https://youqwiz.com/quiz-du-jour/${r.id}` } } } } });
      r.shortCommentId = res.data.id;
      n++;
    } catch (e) {
      console.warn(`${r.id} (short) : ${e.message}`);
    }
  }
  writeJson(p("data/state/queue.json"), queue);
  console.log(`${n} commentaire(s) posté(s)`);
  if (process.env.GITHUB_ACTIONS && n) console.log(`::notice title=Communauté::${n} commentaire(s) « dis ton score » posté(s) — à épingler`);
}

if (mode === "leaderboard") {
  // Vidéos publiées dans les 7 derniers jours (hors « tu préfères »).
  const recent = queue.published.filter((r) => r.longId && Date.parse(r.publishAt) < now && now - Date.parse(r.publishAt) < 7 * 86400e3);
  const candidates = await scanScores(recent);
  const champion = candidates[0] ?? null;
  const board = { week: todayParis(), champion, top: candidates.slice(0, 10), scanned: recent.length };
  writeJson(p("data/state/leaderboard.json"), board);
  console.log(champion ? `champion : ${champion.name} — ${champion.score} pts (${champion.episode})` : `aucun score trouvé sur ${recent.length} vidéo(s)`);
  if (process.env.GITHUB_ACTIONS) console.log(`::notice title=Champion::${champion ? `${champion.name} ${champion.score} pts` : "aucun score"}`);
}
