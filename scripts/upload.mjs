// Met en ligne la vidéo longue (programmée) + miniature + playlist, puis le Short.
// Chaque exécution prend le prochain créneau libre : relancer plusieurs fois = file tampon.
// Secrets attendus : YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN (voir scripts/auth.mjs).
// Sans secrets : mode simulation (rien n'est envoyé).
import { createReadStream } from "node:fs";
import { google } from "googleapis";
import { p, readJson, todayParis, writeJson } from "./lib.mjs";

const rotation = readJson(p("data/rotation.json"));
const current = readJson(p("data/state/current.json"));
const ep = readJson(current.file);
const manifest = readJson(p("out", ep.id, "manifest.json"));
const qc = readJson(p("out", ep.id, "qc.json"));
if (!qc?.ok) throw new Error("QC non validé, pas d'envoi");

// --- créneau de publication ---
const addDays = (d, n) => {
  const x = new Date(`${d}T12:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};
const parisToUtc = (date, hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  const guess = new Date(Date.UTC(...date.split("-").map(Number).map((v, i) => (i === 1 ? v - 1 : v)), h, m));
  const parisStr = new Intl.DateTimeFormat("en-US", { timeZone: rotation.timezone, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(guess);
  const get = (t) => Number(parisStr.find((x) => x.type === t).value);
  const asParis = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"));
  return new Date(guess.getTime() - (asParis - guess.getTime())).toISOString();
};
const queue = readJson(p("data/state/queue.json"), { lastScheduled: null, published: [] });
// La date de l'épisode EST la date de publication visée (voir generate.mjs) ; garde-fous : jamais avant demain,
// jamais avant le dernier créneau déjà pris.
const today = todayParis();
let nextDate = current.date > today ? current.date : addDays(today, 1);
// Rattrapage le jour même (épisode ré-utilisé dont la longue doit sortir ce soir)
if (process.env.SAME_DAY === "1" && current.date === today) nextDate = today;
const taken = new Set((queue.published ?? []).map((r) => r.date));
// La date de l'épisode est libre (trou dans la file) → on la garde ; sinon on prend le lendemain du dernier créneau.
if (taken.has(nextDate) && !queue.pending?.[ep.id]) nextDate = addDays(queue.lastScheduled ?? today, 1);
while (taken.has(nextDate)) nextDate = addDays(nextDate, 1);
const publishAt = parisToUtc(nextDate, rotation.publishHour);
const shortPublishAt = parisToUtc(nextDate, rotation.shortPublishHour);
// 2e Short (09/11/2026) : les questions les plus dures, en soirée (rotation.shortPublishHour2, 19 h par défaut).
const short2PublishAt = parisToUtc(nextDate, rotation.shortPublishHour2 ?? "19:00");
const short3PublishAt = parisToUtc(nextDate, rotation.shortPublishHour3 ?? "16:00"); // 3e Short : questions du milieu

const { YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN } = process.env;
const channel = readJson(p("data/state/channel.json"), { playlists: {} });
const YT_PLAYLIST_ID = channel.playlists?.[ep.pillar] ?? process.env.YT_PLAYLIST_ID;
const SHORTS_PLAYLIST_ID = channel.playlists?.shorts;
const dry = !(YT_CLIENT_ID && YT_CLIENT_SECRET && YT_REFRESH_TOKEN);
console.log(`${dry ? "[simulation] " : ""}programmation : longue ${publishAt} · short ${shortPublishAt}${manifest.files.short2 ? ` · short 2 ${short2PublishAt}` : ""}${manifest.files.short3 ? ` · short 3 ${short3PublishAt}` : ""}`);

const result = { id: ep.id, date: nextDate, publishAt, shortPublishAt, ...(manifest.files.short2 ? { short2PublishAt } : {}), ...(manifest.files.short3 ? { short3PublishAt } : {}), dry };
// Reprise : si un run précédent a déjà envoyé la longue (puis planté), on ne la renvoie pas.
queue.pending ??= {};
const pending = queue.pending[ep.id] ?? {};
const savePending = () => { queue.pending[ep.id] = { ...pending }; writeJson(p("data/state/queue.json"), queue); };
if (!dry) {
  const oauth = new google.auth.OAuth2(YT_CLIENT_ID, YT_CLIENT_SECRET);
  oauth.setCredentials({ refresh_token: YT_REFRESH_TOKEN });
  const yt = google.youtube({ version: "v3", auth: oauth });

  const insert = async (file, { title, description, tags, publishAt }) => {
    const res = await yt.videos.insert({
      part: ["snippet", "status"],
      requestBody: {
        snippet: { title, description, tags, categoryId: "24", defaultLanguage: ep.lang ?? "fr", defaultAudioLanguage: ep.lang ?? "fr" },
        status: { privacyStatus: "private", publishAt, selfDeclaredMadeForKids: false, embeddable: true },
      },
      media: { body: createReadStream(file) },
    });
    return res.data.id;
  };

  if (pending.longId) {
    console.log(`reprise : longue déjà envoyée (${pending.longId}), mise à jour de la programmation`);
    await yt.videos.update({ part: ["status"], requestBody: { id: pending.longId, status: { privacyStatus: "private", publishAt, selfDeclaredMadeForKids: false, embeddable: true } } });
    result.longId = pending.longId;
  } else {
    result.longId = pending.longId = await insert(manifest.files.long, { title: ep.title, description: ep.meta.description, tags: ep.meta.tags, publishAt });
    savePending();
  }
  // Miniature : non bloquante (exige une chaîne vérifiée par téléphone ; sinon YouTube garde l'image auto).
  try {
    // Style de miniature : gagnant connu (data/state/thumbnails.json) sinon alternance A/B un jour sur deux ; 1 vidéo sur 4 explore l'autre style.
    const thumbs = readJson(p("data/state/thumbnails.json"), {});
    const dayIdx = Math.round(Date.parse(nextDate) / 86400000);
    let variant = thumbs.winner ?? (dayIdx % 2 === 0 ? "A" : "B");
    if (thumbs.winner && dayIdx % 4 === 0) variant = thumbs.winner === "A" ? "B" : "A";
    result.thumbVariant = variant;
    await yt.thumbnails.set({ videoId: result.longId, media: { body: createReadStream(variant === "A" ? manifest.files.thumbA : manifest.files.thumbB) } });
    result.thumbnail = true;
  } catch (e) {
    result.thumbnail = false;
    console.warn(`miniature non posée : ${e.message}`);
    if (process.env.GITHUB_ACTIONS) console.log(`::warning title=Miniature::${e.message} — vérifier la chaîne sur youtube.com/verify puis relancer scripts/fix-thumbnails.mjs`);
  }
  if (YT_PLAYLIST_ID && !pending.playlist) {
    await yt.playlistItems.insert({ part: ["snippet"], requestBody: { snippet: { playlistId: YT_PLAYLIST_ID, resourceId: { kind: "youtube#video", videoId: result.longId } } } });
    pending.playlist = true;
    savePending();
  }
  // 11/11/2026 : rotation.shortsPaused = Shorts extraits suspendus (refonte v3 « réclame ») : la longue part seule.
  if (!rotation.shortsPaused) {
  // Titre et description du Short variables (03/11/2026) : tirés dans generate.mjs, repli sur l'ancienne formule.
  const shortTitle = (ep.meta.shortTitle ?? `99 % échouent à la 8e 😱 ${ep.intro.hook} #Shorts`).slice(0, 100); // repli FR (épisodes d'avant le 03/11/2026)
  const shortDescription = (ep.meta.shortDescription ?? `La réponse + {n} questions dans la vidéo complète 🎬 {url}\n🎮 Crée gratuitement tes quiz à partager : https://youqwiz.com\n#shorts #quiz #youqwiz`)
    .replaceAll("{n}", String(ep.items.length))
    .replaceAll("{url}", `https://youtu.be/${result.longId}`);
  result.shortId = pending.shortId ??= await insert(manifest.files.short, {
    title: shortTitle,
    description: shortDescription,
    tags: ["shorts", "quiz", "youqwiz", ...(ep.meta.tags ?? []).slice(4, 7)],
    publishAt: shortPublishAt,
  });
  if (SHORTS_PLAYLIST_ID && !pending.shortPlaylist) {
    try {
      await yt.playlistItems.insert({ part: ["snippet"], requestBody: { snippet: { playlistId: SHORTS_PLAYLIST_ID, resourceId: { kind: "youtube#video", videoId: result.shortId } } } });
      pending.shortPlaylist = true;
      savePending();
    } catch (e) { console.warn(`playlist shorts : ${e.message}`); }
  }
  if (manifest.files.short2 && ep.meta.short2) {
    savePending();
    result.shortId2 = pending.shortId2 ??= await insert(manifest.files.short2, {
      title: ep.meta.short2.title.slice(0, 100),
      description: ep.meta.short2.description.replaceAll("{n}", String(ep.items.length)).replaceAll("{url}", `https://youtu.be/${result.longId}`),
      tags: ["shorts", "quiz", "youqwiz", "impossible", ...(ep.meta.tags ?? []).slice(7, 10)],
      publishAt: short2PublishAt,
    });
    if (SHORTS_PLAYLIST_ID) {
      try { await yt.playlistItems.insert({ part: ["snippet"], requestBody: { snippet: { playlistId: SHORTS_PLAYLIST_ID, resourceId: { kind: "youtube#video", videoId: result.shortId2 } } } }); } catch (e) { console.warn(`playlist shorts (2) : ${e.message}`); }
    }
  }
  if (manifest.files.short3 && ep.meta.short3) {
    savePending();
    result.shortId3 = pending.shortId3 ??= await insert(manifest.files.short3, {
      title: ep.meta.short3.title.slice(0, 100),
      description: ep.meta.short3.description.replaceAll("{n}", String(ep.items.length)).replaceAll("{url}", `https://youtu.be/${result.longId}`),
      tags: ["shorts", "quiz", "youqwiz", ...(ep.meta.tags ?? []).slice(4, 7)],
      publishAt: short3PublishAt,
    });
    if (SHORTS_PLAYLIST_ID) {
      try { await yt.playlistItems.insert({ part: ["snippet"], requestBody: { snippet: { playlistId: SHORTS_PLAYLIST_ID, resourceId: { kind: "youtube#video", videoId: result.shortId3 } } } }); } catch (e) { console.warn(`playlist shorts (3) : ${e.message}`); }
    }
  }
  } else console.log("Shorts extraits suspendus (rotation.shortsPaused) : aucun Short envoyé");
  console.log(`envoyé : longue ${result.longId} · short ${result.shortId}${result.shortId2 ? ` · short 2 ${result.shortId2}` : ""}${result.shortId3 ? ` · short 3 ${result.shortId3}` : ""}`);
}

queue.lastScheduled = queue.lastScheduled && queue.lastScheduled > nextDate ? queue.lastScheduled : nextDate;
queue.published.push(result);
delete queue.pending[ep.id];
writeJson(p("data/state/queue.json"), queue);
