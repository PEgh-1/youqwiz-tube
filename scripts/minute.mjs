// « La minute culture générale » : voix (ElevenLabs, timbre « vieux poste ») + rendu des pilotes listés dans data/minutes/pilotes.json.
// Usage : node scripts/minute.mjs [--only nom]   → out/minute/<nom>.mp4
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const conf = JSON.parse(readFileSync("data/minutes/pilotes.json", "utf8"));
const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : null;
const KEY = process.env.ELEVENLABS_API_KEY;
const VOICES = { A: process.env.ELEVENLABS_VOICE_ID, B: process.env.MINUTE_VOICE_B || "JBFqnCBsd6RMkjVDRZzb", C: process.env.MINUTE_VOICE_C || "IKne3meq5aSn9XLyUdCD", D: process.env.MINUTE_VOICE_D || "TX3LPaxmHKxFdv7VOQHJ" };
const TAG = process.env.MINUTE_TAG ?? "[very nasal, jolly, over-the-top cheerful 1930s French radio advertisement announcer, singsong, fast]";
const sh = (c, o = {}) => execSync(c, { stdio: ["ignore", "pipe", "pipe"], timeout: 120_000, ...o }).toString();
mkdirSync("out/minute", { recursive: true });
mkdirSync("public/minute", { recursive: true });

// Fond de craquements (disque / pellicule) + déclaration dans le manifeste audio.
if (!existsSync("public/audio/crackle.mp3")) sh(`ffmpeg -y -nostdin -loglevel error -f lavfi -i "anoisesrc=c=pink:a=0.05:d=20" -af "highpass=f=1200,lowpass=f=4500,volume=0.35" -b:a 96k public/audio/crackle.mp3`);
const manifest = JSON.parse(readFileSync("src/audio.json", "utf8"));
manifest.crackle = true;
writeFileSync("src/audio.json", JSON.stringify(manifest, null, 2) + "\n");

let STAB = 0.5;
async function tts(text, voiceId, model) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 60_000);
  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
      method: "POST", signal: ctl.signal,
      headers: { "xi-api-key": KEY, "content-type": "application/json" },
      body: JSON.stringify({ text: model === "eleven_v3" && TAG ? `${TAG} ${text}` : text, model_id: model, language_code: "fr", voice_settings: model === "eleven_v3" ? { stability: STAB, similarity_boost: 0.8, style: 0.6, use_speaker_boost: true } : { stability: 0.4, similarity_boost: 0.75, style: 0.5, use_speaker_boost: true, speed: 1.1 } }),
    });
    if (!res.ok) throw new Error(`ElevenLabs ${res.status} : ${(await res.text()).slice(0, 160)}`);
    return Buffer.from(await res.arrayBuffer());
  } finally { clearTimeout(timer); }
}
// Timbre « TSF » : bande passante de vieux poste, compression, léger débit accéléré.
// Timbre « réclame TSF » (11/11/2026, retour de Pierre-Éloi : voix nasillarde et enjouée, sans coupures) : bande étroite, bosse
// nasale vers 1,4 kHz, hauteur relevée (PITCH), débit un peu accéléré. Silences rognés en douceur (seuil -50 dB, 0,12 s gardées
// en fin de phrase) pour ne plus manger les fins de mots.
const PITCH = Number(process.env.MINUTE_PITCH || 1.07);
const retro = (pitch, nasal = 8) => `silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.04,areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.12,areverse,aresample=44100,asetrate=${Math.round(44100 * pitch)},aresample=44100,atempo=${(1.06 / pitch).toFixed(3)},highpass=f=${nasal > 9 ? 480 : 380},lowpass=f=${nasal > 9 ? 3000 : 3300},equalizer=f=1400:t=q:w=1.2:g=${nasal},equalizer=f=2700:t=q:w=2:g=3,acompressor=threshold=-22dB:ratio=3:attack=15:release=250:makeup=4,alimiter=limit=0.89`; // pas de loudnorm (pompage sur clips courts = « coupures de micro »)
async function clip(text, voiceKey, file, pitch = PITCH, nasal = 8) {
  if (!KEY || !VOICES[voiceKey]) return undefined;
  let buf, model = "eleven_v3";
  try { buf = await tts(text, VOICES[voiceKey], model); }
  catch (e) { console.warn(`v3 : ${e.message} → multilingual_v2`); model = "eleven_multilingual_v2"; buf = await tts(text, VOICES[voiceKey], model); }
  const raw = `public/minute/${file}.raw.mp3`, out = `public/minute/${file}.mp3`;
  writeFileSync(raw, buf);
  sh(`ffmpeg -y -nostdin -loglevel error -i "${raw}" -af "${retro(pitch, nasal)}" -ar 44100 -b:a 128k "${out}"`);
  const sec = Number(sh(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${out}"`));
  console.log(`  ${file} (${model}) ${sec.toFixed(1)} s`);
  return { src: `minute/${file}.mp3`, sec, text };
}

for (const j of conf.jobs) {
  if (only && j.name !== only) continue;
  console.log(`▶ ${j.name}`);
  try {
    const v = j.voice, n = j.name, pitch = j.pitch ?? PITCH, nz = j.nasal ?? 8;
    STAB = j.stability ?? 0.5;
    const outroText = j.cta === "youtube" ? conf.outroYoutube : conf.outro;
    // Phrases enchaînées dans un même clip (titre + baseline, réponse + anecdote) : plus de trous ni de changements de ton.
    const answer = await clip(`${j.answer} ${j.fact}`, v, `${n}-answer`, pitch, nz);
    const voice = {
      hook: await clip(j.hook, v, `${n}-hook`, pitch, nz),
      title: await clip(j.sayBaseline ? `${conf.title} ${conf.baseline}` : conf.title, v, `${n}-title`, pitch, nz),
      choices: await clip(`${j.choices[0]}, ${j.choices[1]}, ou ${j.choices[2]} ?`, v, `${n}-choices`, pitch, nz),
      answer,
      answerSplit: answer ? answer.sec * (j.answer.length + 2) / (j.answer.length + j.fact.length + 2) : undefined,
      outro: await clip(outroText, v, `${n}-outro`, pitch, nz),
    };
    const props = `out/minute/${n}.json`;
    writeFileSync(props, JSON.stringify({ minute: { id: n, hook: j.hook, choices: j.choices, correct: j.correct, fact: j.fact, sayBaseline: !!j.sayBaseline, comment: j.comment, cta: j.cta, voice: voice.hook ? voice : undefined } }));
    if (process.env.MINUTE_DRY) continue;
    execSync(`npx remotion render src/index.ts MinuteCulture "out/minute/${n}.mp4" --props="${props}" --log=error`, { stdio: "inherit" });
    console.log(`  rendu : out/minute/${n}.mp4 (${sh(`ffprobe -v error -show_entries format=duration -of csv=p=0 "out/minute/${n}.mp4"`).trim()} s)`);
  } catch (e) { console.warn(`  ÉCHEC ${j.name} : ${String(e.message).slice(0, 200)}`); }
}
