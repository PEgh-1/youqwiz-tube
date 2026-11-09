// Bilan hebdo YouTube Analytics (lundi) : vues, durée moyenne, impressions, CTR par vidéo et par style de miniature.
// Écrit data/state/analytics.json et data/state/thumbnails.json (gagnant A/B quand l'écart est net).
// Nécessite le scope yt-analytics.readonly sur le jeton (sinon : avertissement, rien ne casse).
import { google } from "googleapis";
import { p, readJson, todayParis, writeJson } from "./lib.mjs";

const { YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN } = process.env;
if (!(YT_CLIENT_ID && YT_CLIENT_SECRET && YT_REFRESH_TOKEN)) throw new Error("secrets YT_* absents");
const oauth = new google.auth.OAuth2(YT_CLIENT_ID, YT_CLIENT_SECRET);
oauth.setCredentials({ refresh_token: YT_REFRESH_TOKEN });
const ya = google.youtubeAnalytics({ version: "v2", auth: oauth });
const queue = readJson(p("data/state/queue.json"), { published: [] });
const end = todayParis();
const start = new Date(Date.parse(end) - 28 * 86400000).toISOString().slice(0, 10);

let rows = [];
try {
  const res = await ya.reports.query({
    ids: "channel==MINE",
    startDate: start,
    endDate: end,
    metrics: "views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,subscribersGained,likes,comments,shares",
    dimensions: "video",
    sort: "-views",
    maxResults: 200,
  });
  rows = res.data.rows ?? [];
} catch (e) {
  const msg = e.message ?? String(e);
  console.warn(`analytics indisponible : ${msg}`);
  if (process.env.GITHUB_ACTIONS) console.log(`::warning title=Analytics::${msg.includes("insufficient") || msg.includes("403") ? "le jeton n'a pas le droit yt-analytics.readonly : relancer auth-standalone.mjs et recoller YT_REFRESH_TOKEN" : msg}`);
  process.exit(0);
}
// Impressions / CTR : rapport séparé (dimension video, métriques d'impressions disponibles au propriétaire)
let imp = {};
try {
  const res = await ya.reports.query({ ids: "channel==MINE", startDate: start, endDate: end, metrics: "views,impressions,impressionClickThroughRate", dimensions: "video", sort: "-views", maxResults: 200 });
  for (const r of res.data.rows ?? []) imp[r[0]] = { impressions: r[2], ctr: r[3] };
} catch (e) {
  console.warn(`impressions indisponibles : ${e.message}`);
}

const byId = Object.fromEntries(queue.published.map((r) => [r.longId, r]));
const videos = rows.map((r) => {
  const q = byId[r[0]];
  return { videoId: r[0], episode: q?.id, pillar: q?.id?.split("-").slice(3).join("-"), thumbVariant: q?.thumbVariant, views: r[1], minutes: r[2], avgSec: r[3], avgPct: r[4], subs: r[5], likes: r[6], comments: r[7], shares: r[8], ...(imp[r[0]] ?? {}) };
});
const agg = (list) => {
  const n = list.length;
  if (!n) return null;
  const s = (k) => list.reduce((a, v) => a + (v[k] ?? 0), 0);
  return { n, views: s("views"), ctr: list.filter((v) => v.ctr != null).length ? +(list.reduce((a, v) => a + (v.ctr ?? 0), 0) / list.filter((v) => v.ctr != null).length).toFixed(2) : null, avgPct: +(s("avgPct") / n).toFixed(1) };
};
const report = {
  week: end,
  period: { start, end },
  totals: agg(videos),
  byVariant: { A: agg(videos.filter((v) => v.thumbVariant === "A")), B: agg(videos.filter((v) => v.thumbVariant === "B")) },
  byPillar: Object.fromEntries([...new Set(videos.map((v) => v.pillar).filter(Boolean))].map((k) => [k, agg(videos.filter((v) => v.pillar === k))])),
  videos,
};
writeJson(p("data/state/analytics.json"), report);

// Gagnant A/B : au moins 6 vidéos par style, écart de CTR ≥ 15 % relatif.
const A = report.byVariant.A, B = report.byVariant.B;
const thumbs = readJson(p("data/state/thumbnails.json"), {});
if (A?.ctr != null && B?.ctr != null && A.n >= 6 && B.n >= 6) {
  const [hi, lo] = A.ctr >= B.ctr ? ["A", "B"] : ["B", "A"];
  const gap = (report.byVariant[hi].ctr - report.byVariant[lo].ctr) / Math.max(report.byVariant[lo].ctr, 0.01);
  if (gap >= 0.15) {
    thumbs.winner = hi;
    thumbs.decidedAt = end;
    thumbs.ctr = report.byVariant;
    writeJson(p("data/state/thumbnails.json"), thumbs);
    console.log(`miniatures : style ${hi} retenu (CTR ${report.byVariant[hi].ctr} % vs ${report.byVariant[lo].ctr} %)`);
  }
}
console.log(`analytics : ${videos.length} vidéos, ${report.totals?.views ?? 0} vues sur 28 j ; CTR A ${A?.ctr ?? "—"} / B ${B?.ctr ?? "—"}`);
if (process.env.GITHUB_ACTIONS) console.log(`::notice title=Analytics::${videos.length} vidéos · ${report.totals?.views ?? 0} vues · CTR A ${A?.ctr ?? "—"} % / B ${B?.ctr ?? "—"} %${thumbs.winner ? ` · style retenu ${thumbs.winner}` : ""}`);
