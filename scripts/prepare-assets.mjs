// Prépare public/ : polices, émojis Twemoji, sons synthétiques, manifestes.
// Lancé automatiquement après `npm install` (postinstall) et avant chaque rendu.
import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

const root = path.resolve(new URL(".", import.meta.url).pathname, "..");
const pub = path.join(root, "public");
mkdirSync(pub, { recursive: true });

// 1. Polices (latin uniquement)
const fonts = {
  "baloo-2-800.woff2": "@fontsource/baloo-2/files/baloo-2-latin-800-normal.woff2",
  "baloo-2-600.woff2": "@fontsource/baloo-2/files/baloo-2-latin-600-normal.woff2",
  "fredoka-600.woff2": "@fontsource/fredoka/files/fredoka-latin-600-normal.woff2",
  "fredoka-400.woff2": "@fontsource/fredoka/files/fredoka-latin-400-normal.woff2",
  "lilita-one.woff2": "@fontsource/lilita-one/files/lilita-one-latin-400-normal.woff2",
  "luckiest-guy.woff2": "@fontsource/luckiest-guy/files/luckiest-guy-latin-400-normal.woff2",
};
mkdirSync(path.join(pub, "fonts"), { recursive: true });
for (const [dst, src] of Object.entries(fonts)) cpSync(path.join(root, "node_modules", src), path.join(pub, "fonts", dst));

// 2. Émojis Twemoji (SVG, licence CC-BY 4.0)
const emojiDir = path.join(pub, "emoji");
if (!existsSync(emojiDir) || readdirSync(emojiDir).length < 3000) {
  cpSync(path.join(root, "node_modules/@twemoji/svg"), emojiDir, { recursive: true, filter: (s) => s.endsWith(".svg") || !s.includes(".") });
}

// 3. Sons : tick, ding, whoosh synthétisés avec ffmpeg (la musique de fond n'est pas versionnée :
//    scripts/get-music.mjs la télécharge au rendu depuis le secret MUSIC_URL).
const audioDir = path.join(pub, "audio");
mkdirSync(audioDir, { recursive: true });
const hasFfmpeg = (() => {
  try {
    execSync("ffmpeg -version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();
const synth = {
  "tick.mp3": `-f lavfi -i "sine=frequency=1200:duration=0.06" -af "volume=0.8,afade=t=out:st=0.02:d=0.04"`,
  "ding.mp3": `-f lavfi -i "sine=frequency=880:duration=0.45" -f lavfi -i "sine=frequency=1320:duration=0.45" -filter_complex "[0][1]amix=inputs=2,afade=t=out:st=0.1:d=0.35,volume=0.9"`,
  "whoosh.mp3": `-f lavfi -i "anoisesrc=color=pink:duration=0.5:amplitude=0.6" -af "lowpass=f=1500,afade=t=in:d=0.1,afade=t=out:st=0.2:d=0.3"`,
  "buzz.mp3": `-f lavfi -i "sine=frequency=110:duration=0.6" -f lavfi -i "sine=frequency=165:duration=0.6" -filter_complex "[0][1]amix=inputs=2,tremolo=f=30:d=0.8,afade=t=out:st=0.3:d=0.3,volume=0.9"`,
  // Shorts v2 (09/11/2026) : montée de tension avant le cliffhanger et « pop » de transition entre questions
  "riser.mp3": `-f lavfi -i "anoisesrc=color=white:duration=1.6:amplitude=0.5" -f lavfi -i "sine=frequency=220:duration=1.6" -filter_complex "[1]aeval=val(0)*1:c=same[s];[0]highpass=f=600,afade=t=in:d=1.4[nz];[nz][s]amix=inputs=2,volume=2.2*t/1.6:eval=frame,afade=t=out:st=1.45:d=0.15"`,
  "pop.mp3": `-f lavfi -i "sine=frequency=520:duration=0.12" -af "afade=t=out:st=0.02:d=0.1,volume=0.9"`,
  // jingle logo : 4 notes (do mi sol do) ; fanfare : accord montant
  "jingle.mp3": `-f lavfi -i "sine=frequency=523:duration=0.25" -f lavfi -i "sine=frequency=659:duration=0.25" -f lavfi -i "sine=frequency=784:duration=0.25" -f lavfi -i "sine=frequency=1047:duration=0.7" -filter_complex "[0]afade=t=out:st=0.15:d=0.1[a];[1]afade=t=out:st=0.15:d=0.1[b];[2]afade=t=out:st=0.15:d=0.1[c];[3]afade=t=out:st=0.3:d=0.4[d];[a][b][c][d]concat=n=4:v=0:a=1,volume=0.8"`,
  "fanfare.mp3": `-f lavfi -i "sine=frequency=523:duration=0.18" -f lavfi -i "sine=frequency=659:duration=0.18" -f lavfi -i "sine=frequency=784:duration=0.18" -f lavfi -i "sine=frequency=1047:duration=0.18" -f lavfi -i "sine=frequency=1319:duration=0.9" -filter_complex "[0][1][2][3][4]concat=n=5:v=0:a=1,afade=t=out:st=1.0:d=0.6,volume=0.8"`,
};
if (hasFfmpeg) {
  for (const [name, args] of Object.entries(synth)) {
    const out = path.join(audioDir, name);
    if (!existsSync(out)) execSync(`ffmpeg -y -loglevel error ${args} -ar 44100 -b:a 128k "${out}"`, { stdio: "inherit" });
  }
}

// 4. Manifestes (ce qui existe vraiment dans public/)
const audioManifest = Object.fromEntries(
  ["tick", "ding", "whoosh", "buzz", "riser", "pop", "jingle", "fanfare", "music", "preroll", "packshot"].map((k) => [k, existsSync(path.join(audioDir, `${k}.mp3`))]),
);
// Pistes musicales en rotation (03/11/2026) : music.mp3 + music-*.mp3 (fournies par scripts/get-music.mjs).
audioManifest.musics = readdirSync(audioDir).filter((f) => /^music(-[\w-]+)?\.mp3$/.test(f)).sort();
writeFileSync(path.join(root, "src/audio.json"), JSON.stringify(audioManifest, null, 2));
const mascots = Object.fromEntries(["chat", "poussin", "chat-shock", "poussin-shock", "chat-dare", "poussin-dare", "chat-head", "poussin-head", "poussin-open", "poussin-blink"].map((k) => [k, existsSync(path.join(pub, "mascots", `${k}.png`))]));
writeFileSync(path.join(root, "src/mascots.json"), JSON.stringify(mascots, null, 2));
console.log("assets prêts :", { fonts: Object.keys(fonts).length, emoji: readdirSync(emojiDir).length, audio: audioManifest, mascots });
