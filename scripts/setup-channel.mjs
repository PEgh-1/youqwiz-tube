// Paramétrage de la chaîne par l'API (idempotent) : description, mots-clés, pays, langue, bannière,
// filigrane, playlists par pilier, bande-annonce. Écrit data/state/channel.json (ids des playlists, trailer).
// Prérequis : out/channel/{Banner1.png,watermark.png,trailer.mp4} rendus (npm run channel:render).
import { createReadStream, existsSync } from "node:fs";
import { google } from "googleapis";
import { p, readJson, writeJson } from "./lib.mjs";

const { YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN } = process.env;
if (!(YT_CLIENT_ID && YT_CLIENT_SECRET && YT_REFRESH_TOKEN)) throw new Error("secrets YT_* absents");
const oauth = new google.auth.OAuth2(YT_CLIENT_ID, YT_CLIENT_SECRET);
oauth.setCredentials({ refresh_token: YT_REFRESH_TOKEN });
const yt = google.youtube({ version: "v3", auth: oauth });
const state = readJson(p("data/state/channel.json"), { playlists: {} });
const log = (m) => console.log(`• ${m}`);

const ch = (await yt.channels.list({ part: ["id", "snippet", "brandingSettings"], mine: true })).data.items[0];
if (!/youqwiz/i.test(ch.snippet.title)) throw new Error(`mauvaise chaîne : ${ch.snippet.title}`);
log(`chaîne ${ch.snippet.title} (${ch.id})`);

// 1. Playlists par pilier
const PLAYLISTS = {
  devine: { title: "Devine en 5 secondes 🐯🚩 (animaux, drapeaux, pays…)", description: "Un émoji, un drapeau, un pays sans voyelles… 5 secondes pour deviner. De facile à impossible, un nouveau quiz chaque semaine. Joue aussi sur https://youqwiz.com" },
  choix: { title: "Tu préfères… ? 🤔 Choix impossibles", description: "Des dilemmes impossibles à trancher en 5 secondes. Dis tes choix en commentaire et défie tes amis sur https://youqwiz.com" },
  culture: { title: "Culture générale 🧠 Quiz QCM", description: "Questions de culture générale à 4 réponses, de facile à impossible. Compte tes points ! Plus de quiz sur https://youqwiz.com" },
  emojis: { title: "Émojis 👀 Intrus & rébus", description: "Trouve l'intrus parmi 12 émojis, devine le mot caché derrière les émojis. Plus de quiz sur https://youqwiz.com" },
  generations: { title: "Quiz Générations 📼 Nés avant 1975 ?", description: "Souvenirs des années 60 à 90 : objets, école, télé, prix en francs… Tu as vécu ça ? Prouve-le ! https://youqwiz.com" },
  shorts: { title: "Shorts ⏱️ Quiz express", description: "Les extraits en 40 secondes. La vidéo complète est sur la chaîne. https://youqwiz.com" },
};
const existing = (await yt.playlists.list({ part: ["id", "snippet"], mine: true, maxResults: 50 })).data.items ?? [];
for (const [key, pl] of Object.entries(PLAYLISTS)) {
  const found = existing.find((x) => x.id === state.playlists[key]) ?? existing.find((x) => x.snippet.title === pl.title);
  if (found) {
    state.playlists[key] = found.id;
    continue;
  }
  const res = await yt.playlists.insert({ part: ["snippet", "status"], requestBody: { snippet: { title: pl.title, description: pl.description, defaultLanguage: "fr" }, status: { privacyStatus: "public" } } });
  state.playlists[key] = res.data.id;
  log(`playlist créée : ${pl.title}`);
}
writeJson(p("data/state/channel.json"), state);

// 2. Bande-annonce (publique, nécessaire pour l'écran d'accueil des non-abonnés)
const trailerFile = p("out/channel/trailer.mp4");
if (!state.trailerId && existsSync(trailerFile)) {
  const res = await yt.videos.insert({
    part: ["snippet", "status"],
    requestBody: {
      snippet: {
        title: "YouQwiz : un quiz par jour, de facile à impossible ⏱️ Bande-annonce",
        description: "Chaque jour à 17h30, un nouveau quiz : devine en 5 secondes, tu préfères, culture générale, émojis, générations. Compte tes points, dis ton score en commentaire et défie tes proches !\n\n🎮 Crée gratuitement tes propres quiz à partager avec tes amis : https://youqwiz.com\n🔔 Abonne-toi pour ne rien rater.\n\n#quiz #youqwiz #culturegenerale",
        tags: ["quiz", "quiz français", "youqwiz", "bande-annonce", "culture générale", "devinette"],
        categoryId: "24",
        defaultLanguage: "fr",
        defaultAudioLanguage: "fr",
      },
      status: { privacyStatus: "public", selfDeclaredMadeForKids: false, embeddable: true },
    },
    media: { body: createReadStream(trailerFile) },
  });
  state.trailerId = res.data.id;
  writeJson(p("data/state/channel.json"), state);
  log(`bande-annonce envoyée : ${state.trailerId}`);
  const thumb = p("out/channel/Banner1-thumb.png");
  if (existsSync(thumb)) {
    try { await yt.thumbnails.set({ videoId: state.trailerId, media: { body: createReadStream(thumb) } }); } catch (e) { log(`miniature trailer : ${e.message}`); }
  }
}

// 3. Bannière
let bannerUrl = state.bannerUrl;
const bannerFile = p("out/channel/Banner1.png");
if (!bannerUrl && existsSync(bannerFile)) {
  const res = await yt.channelBanners.insert({ media: { body: createReadStream(bannerFile) } });
  bannerUrl = state.bannerUrl = res.data.url;
  writeJson(p("data/state/channel.json"), state);
  log("bannière envoyée");
}

// 4. Branding : description, mots-clés, pays, langue, trailer, bannière
const description = [
  "YouQwiz, c'est un quiz par jour, à 17h30, de facile à IMPOSSIBLE ⏱️",
  "",
  "🐯 Devine en 5 secondes (animaux, drapeaux, pays sans voyelles…)",
  "🤔 Tu préfères… ? Des choix impossibles",
  "🧠 Culture générale en QCM",
  "👀 Trouve l'intrus et devine les mots en émojis",
  "📼 Quiz Générations : nés avant 1975 ?",
  "",
  "Compte tes points, dis ton score en commentaire et défie tes proches.",
  "🎮 Crée GRATUITEMENT tes propres quiz à partager avec tes amis sur https://youqwiz.com",
  "",
  "Contact : via youqwiz.com — une chaîne SARL Ad-Works.",
].join("\n");
const keywords = ["quiz", "quiz français", "quizz", "devinette", "culture générale", "tu préfères", "trouve l'intrus", "quiz émojis", "quiz animaux", "quiz drapeaux", "quiz famille", "jeu", "youqwiz"].map((k) => (k.includes(" ") ? `"${k}"` : k)).join(" ");
await yt.channels.update({
  part: ["brandingSettings"],
  requestBody: {
    id: ch.id,
    brandingSettings: {
      channel: {
        description,
        keywords,
        country: "FR",
        defaultLanguage: "fr",
        ...(state.trailerId ? { unsubscribedTrailer: state.trailerId } : {}),
      },
      ...(bannerUrl ? { image: { bannerExternalUrl: bannerUrl } } : {}),
    },
  },
});
log("description, mots-clés, pays, langue, bande-annonce, bannière appliqués");

// 5. Filigrane (bouton d'abonnement discret, dès le début de chaque vidéo)
const wm = p("out/channel/watermark.png");
if (existsSync(wm)) {
  try {
    await yt.watermarks.set({ channelId: ch.id, requestBody: { timing: { type: "offsetFromStart", offsetMs: 0 }, targetChannelId: ch.id }, media: { body: createReadStream(wm) } });
    log("filigrane posé");
  } catch (e) {
    log(`filigrane : ${e.message}`);
  }
}
console.log("terminé :", JSON.stringify(state));
