import React from "react";
import { AbsoluteFill, Audio, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { AUDIO, Background, Bubble, Burst, Card, CommonSegment, Countdown, FactCard, Fonts, HookBanner, LevelBadge, Logo, Mascot, MusicBed, Pill, Progress, Rich, ShortFx, Streak, Ticks, Voice, quipFor, shortHookOf, shortMotion, styleOf, themeOf, tiltFor, WipeLayer } from "./components";
import { Score } from "./DevineEn3s";
import { FONT_BODY, FONT_DISPLAY, INK, LEVELS, OK, WHITE } from "./theme";
import { tr } from "./i18n";
import { SHORT_OPTS, buildTimeline, factStart, levelOf, streakBreakIndex, totalPoints, VOICE_LEAD, sceneVariant, wipeScenes, fxFinish, questionDelay } from "./timeline";
import { FxContext } from "./fxContext";
import { Baseline, BlurIn, MascotTransitionLayer, SyncLines, fitLines, speechEnd, useFontsReady } from "./fx";
import type { Episode } from "./types";

const has = (k: string) => AUDIO[k] === true;
const LETTERS = ["A", "B", "C", "D"];
const GREY = "#D8D8E0";

export type QcmProps = { episode: Episode; vertical?: boolean };

// Gabarit « QCM » (culture générale, générations, vocabulaire…) : question + 4 réponses A/B/C/D, 16:9 ou Short 9:16.
export const QuizQCM: React.FC<QcmProps> = ({ episode, vertical = false }) => {
  const { fps } = useVideoConfig();
  const theme = themeOf(episode);
  const style = styleOf(episode);
  const { segments } = buildTimeline(episode, fps, vertical ? SHORT_OPTS(episode) : {});
  const frame = useCurrentFrame(); // vidéo longue v2 : variante de décor par scène
  // Compteur « x / n » : en Short, le nombre réel de questions de la timeline (jusqu'à 8, limité par les 58 s), pas shortItems.
  const n = vertical ? segments.filter((s) => s.kind === "question").length : episode.items.length;
  const lastQ = Math.max(...segments.filter((s) => s.kind === "question").map((s) => (s as { index: number }).index));
  const slow = !!episode.timing.slow;
  const k = slow ? 1.15 : 1; // typographie +15 % pour le pilier générations
  const fin = fxFinish(episode, vertical);
  const qd = Math.round(questionDelay(episode, vertical) * fps);
  useFontsReady();

  return (
    <FxContext.Provider value={vertical ? {} : episode.fx ?? {}}>
    <AbsoluteFill style={{ fontFamily: FONT_BODY, color: INK }}>
      <Fonts />
      <Background theme={theme} confetti={vertical ? 22 : 34} pattern={style.pattern} variant={vertical ? 0 : sceneVariant(segments, frame)} />
      <MusicBed episode={episode} />

      {segments.map((s, i) => {
        if (s.kind === "question")
          return (
            <Sequence key={i} from={s.from} durationInFrames={s.dur} name={`Q${s.index + 1}`}>
              {vertical && <ShortFx index={s.index} last={s.index === lastQ} dur={s.dur} />}
              <Voice clip={episode.items[s.index].voice?.q} from={qd} />
              <Ticks episode={episode} index={s.index} dur={s.dur} />
              <Stage episode={episode} index={s.index} total={n} reveal={false} dur={s.dur} vertical={vertical} k={k} />
            </Sequence>
          );
        if (s.kind === "reveal")
          return (
            <Sequence key={i} from={s.from} durationInFrames={s.dur} name={`R${s.index + 1}`}>
              <RevealAudio episode={episode} index={s.index} />
              <Stage episode={episode} index={s.index} total={n} reveal dur={s.dur} vertical={vertical} k={k} />
            </Sequence>
          );
        if (s.kind === "score")
          return (
            <Sequence key={i} from={s.from} durationInFrames={s.dur} name="Score">
              {has("fanfare") && <Audio src={staticFile("audio/fanfare.mp3")} volume={0.8} />}
              <Voice clip={episode.voice?.score} from={15} />
              <Score episode={episode} k={k} />
            </Sequence>
          );
        return <CommonSegment key={i} index={i} s={s} episode={episode} vertical={vertical} k={k} />;
      })}
      {!vertical && (fin ? <MascotTransitionLayer theme={theme} scenes={wipeScenes(segments, true)} lang={episode.lang} /> : <WipeLayer theme={theme} scenes={wipeScenes(segments)} />)}
    </AbsoluteFill>
    </FxContext.Provider>
  );
};

const RevealAudio: React.FC<{ episode: Episode; index: number }> = ({ episode, index }) => {
  const { fps } = useVideoConfig();
  const impossible = levelOf(episode, index) === "impossible";
  const delay = impossible ? Math.round(0.8 * fps) : 0;
  const it = episode.items[index];
  return (
    <>
      <Sequence from={delay}>
        {impossible && has("buzz") ? <Audio src={staticFile("audio/buzz.mp3")} volume={0.7} /> : has("ding") ? <Audio src={staticFile("audio/ding.mp3")} volume={0.45} /> : null}
        <Voice clip={it.voice?.a} from={Math.round(VOICE_LEAD * fps)} />
      </Sequence>
      {it.fact && it.voice?.f && <Voice clip={it.voice.f} from={Math.round(factStart(episode, index) * fps)} />}
    </>
  );
};

// ---------- Pastille de réponse ----------
const Answer: React.FC<{ letter: string; text: string; state: "idle" | "ok" | "grey"; size: number; width: number; height: number; accent: string; square: boolean }> = ({ letter, text, state, size, width, height, accent, square }) => {
  const bg = state === "ok" ? OK : state === "grey" ? GREY : WHITE;
  const fg = state === "ok" ? WHITE : state === "grey" ? "#8A8A9C" : INK;
  const circle = size * 1.45;
  return (
    <Pill bg={bg} fg={fg} size={size} style={{ width, height, boxSizing: "border-box", whiteSpace: "normal", borderRadius: square ? 18 : height / 2.4, padding: `0 ${size * 0.5}px 0 ${size * 0.35}px`, justifyContent: "flex-start", textAlign: "left", lineHeight: 1.05 }}>
      <div style={{ flex: "none", width: circle, height: circle, borderRadius: square ? 14 : 999, background: state === "ok" ? WHITE : state === "grey" ? "#B9B9C6" : accent, color: state === "ok" ? OK : WHITE, border: `${Math.max(4, size * 0.12)}px solid ${INK}`, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 1.05, fontFamily: FONT_DISPLAY }}>
        {letter}
      </div>
      <span style={{ flex: 1, minWidth: 0 }}>
        <Rich text={text} size={size} />
      </span>
    </Pill>
  );
};

// ---------- Scène question / révélation ----------
const Stage: React.FC<{ episode: Episode; index: number; total: number; reveal: boolean; dur: number; vertical: boolean; k: number }> = ({ episode, index, total, reveal, dur, vertical, k }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = themeOf(episode);
  const style = styleOf(episode);
  const item = episode.items[index];
  const prompt = item.prompt.type === "qcm" ? item.prompt : { type: "qcm" as const, value: item.answer, choices: [item.answer, "", "", ""], correct: 0 };
  const level = levelOf(episode, index);
  const impossible = level === "impossible";
  const fx = vertical ? {} : episode.fx ?? {};
  const fin = fxFinish(episode, vertical);
  const qd = Math.round(questionDelay(episode, vertical) * fps); // la question attend que la transition découvre l'écran
  const enter = spring({ frame: frame - qd, fps, config: { damping: 13, stiffness: 160 } });
  const qClip = item.voice?.q;
  // Lot C : le chrono ne démarre qu'à la fin réelle de la phrase lue (dernier mot horodaté).
  const chronoFrom = fx.sync && qClip ? Math.min(dur - fps, qd + Math.round((speechEnd(qClip) + 0.15) * fps)) : 0;
  const brk = streakBreakIndex(episode);
  const streak = index < brk ? index + (reveal ? 1 : 0) : index - brk + (reveal ? 1 : 0);
  const points = totalPoints(episode, index + (reveal ? 1 : 0));
  const slow = !!episode.timing.slow;
  const T = tr(episode);
  const quips = slow ? T.slowQuips : T.quips[level];
  const quip = quipFor(episode, quips, index);
  const delay = Math.round(0.8 * fps);
  const showAnswer = reveal && (!impossible || frame >= delay);
  const hud = vertical ? 34 : 36; // vertical : 3 pastilles sur une ligne (le niveau est sur le coin de la carte)
  const bannerOn = vertical && index === 0 && !reveal && frame <= dur - 6; // Shorts v2 : le bandeau d'accroche remplace le HUD sur la 1re question
  const factAt = Math.round(factStart(episode, index) * fps);
  const showFact = reveal && !vertical && !!item.fact && frame >= factAt;
  const square = style.card === "square";

  // Mise en page (9:16 : logo en haut, zone utile 0-1570 px pour rester au-dessus de l'interface Shorts)
  const qLen = prompt.value.length;
  const qBase = vertical ? (qLen > 70 ? 60 : 68) : qLen > 70 ? 56 : 66;
  let qSize = qBase * k * (qLen > 90 ? 0.9 : 1);
  // Lot B : taille mesurée avec la vraie police (1 à 3 lignes dans la carte), au lieu des seuils par nombre de caractères.
  const fit = fin ? fitLines(prompt.value, 1440, 200, 84 * k, 3) : null;
  if (fit) qSize = fit.size;
  const aSize = (vertical ? 50 : 44) * k;
  const cols = vertical ? 1 : 2;
  const gap = vertical ? 24 : 32;
  const gridW = vertical ? 960 : 1560;
  const aW = (gridW - gap * (cols - 1)) / cols;
  const aH = vertical ? 176 : 168;
  const gridTop = vertical ? 770 : 470;
  const gridLeft = (vertical ? 1080 : 1920) / 2 - gridW / 2;
  const tilt = tiltFor(episode, index, 0.5);
  const cx = (i: number) => gridLeft + (i % cols) * (aW + gap) + aW / 2;
  const cy = (i: number) => gridTop + Math.floor(i / cols) * (aH + gap) + aH / 2;
  const timerPos = vertical ? { position: "absolute" as const, left: 60, bottom: 120 } : { position: "absolute" as const, right: 60, bottom: 18 };

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      {vertical && (
        <div style={{ position: "absolute", top: index === 0 && !reveal ? 40 : 70, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
          {index === 0 && !reveal ? <HookBanner theme={theme} sticker={shortHookOf(episode).sticker} line={shortHookOf(episode).line} n={total} until={dur - 6} lang={episode.lang} /> : <Logo theme={theme} size={78} />}
        </div>
      )}
      {/* HUD */}
      <div style={{ position: "absolute", top: vertical ? 190 : 34, left: 60, right: 60, display: "flex", alignItems: "center", gap: 24, flexWrap: "nowrap", justifyContent: "center", opacity: bannerOn ? 0 : 1 }}>
        <Pill size={hud}>{`🎯 ${index + 1} / ${total}`}</Pill>
        {!vertical && <Progress value={(index + (reveal ? 1 : 0)) / total} theme={theme} />}
        {!vertical && <LevelBadge level={level} size={hud} lang={episode.lang} />}
        <Streak value={streak} size={hud} lang={episode.lang} />
        <Pill size={hud} bg={WHITE} fg={INK}>{`⭐ ${points}`}</Pill>
      </div>
      {!vertical && (
        <div style={{ position: "absolute", top: 114, left: 60, display: "flex", alignItems: "center", gap: 22 }}>
          <Logo theme={theme} size={48} />
          {episode.variants?.baseline && <Baseline text={episode.variants.baseline} size={26} />}
        </div>
      )}

      {/* Question */}
      <BlurIn on={fin && !reveal && frame >= qd && frame < qd + 10} frames={9999}>
      <div style={{ position: "absolute", top: vertical ? 300 : 175, left: vertical ? 60 : 180, right: vertical ? 60 : 180, transform: `scale(${reveal ? 1 : enter})${shortMotion(frame, dur, reveal, vertical)}` }}>
        <Card tilt={tilt} shape={style.card} style={{ height: vertical ? 420 : 250, padding: "20px 50px" }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: qSize, color: INK, textAlign: "center", lineHeight: 1.08 }}>
            {fit ? <SyncLines lines={fit.lines} size={qSize} clip={qClip} from={qd} accent={theme.accent} on={!!fx.sync && !reveal} /> : <Rich text={prompt.value} size={qSize} />}
          </div>
          <div style={{ position: "absolute", top: -34, right: -30 }}>
            <LevelBadge level={level} size={30} tilt={10} lang={episode.lang} />
          </div>
        </Card>
      </div>
      </BlurIn>

      {/* Réponses */}
      {prompt.choices.slice(0, 4).map((c, i) => {
        const state = !showAnswer ? "idle" : i === prompt.correct ? "ok" : "grey";
        const pop = reveal ? 1 : spring({ frame: frame - qd - 6 - i * 3, fps, config: { damping: 12, stiffness: 170 } });
        const good = showAnswer && i === prompt.correct;
        const wiggle = good ? 1 + 0.05 * Math.sin(frame / 2.5) * (frame < delay + 24 ? 1 : 0) : 1;
        const flip = good && style.reveal === "flip" ? `perspective(1000px) rotateX(${Math.max(0, 1 - (frame - delay) / 10) * 90}deg)` : "";
        return (
          <div key={i} style={{ position: "absolute", left: gridLeft + (i % cols) * (aW + gap), top: gridTop + Math.floor(i / cols) * (aH + gap), transform: `scale(${pop * wiggle}) ${flip}` }}>
            <Answer letter={LETTERS[i]} text={c} state={state} size={aSize} width={aW} height={aH} accent={theme.accent} square={square} />
          </div>
        );
      })}
      {showAnswer && frame < delay + 20 && <Burst theme={theme} x={cx(prompt.correct)} y={cy(prompt.correct)} n={44} />}
      {reveal && impossible && !showAnswer && (
        <div style={{ position: "absolute", top: vertical ? 1580 : 880, fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 56 * k, color: WHITE, textShadow: `5px 5px 0 ${INK}` }}>
          <Rich text={T.drumroll} size={56 * k} />
        </div>
      )}

      {/* Fait bonus */}
      {showFact && (
        <div style={{ position: "absolute", bottom: 40, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
          <Sequence from={factAt} layout="none">
            <FactCard text={item.fact!} theme={theme} lang={episode.lang} />
          </Sequence>
        </div>
      )}

      {/* Chrono */}
      {!reveal && (
        <div style={timerPos}>
          <Countdown frame={Math.max(0, frame - chronoFrom)} totalFrames={dur - chronoFrom} theme={theme} size={200} kind={vertical ? "ring" : "slider"} rider="poussin" width={620} />
        </div>
      )}
      {reveal && index === brk - 1 && !showFact && episode.items.length >= 12 && (
        <div style={{ position: "absolute", right: vertical ? 40 : 110, bottom: vertical ? 150 : 70 }}>
          <Pill size={34} bg="#FF3B3B" fg={WHITE} tilt={-6} style={vertical ? { whiteSpace: "normal", textAlign: "center", maxWidth: 620 } : undefined}>{T.streakLost}</Pill>
        </div>
      )}

      {/* Mascotte + bulle */}
      {!showFact && (
        <div style={vertical ? { position: "absolute", right: 150, bottom: 110, display: "flex", alignItems: "flex-end", gap: 10 } : { position: "absolute", left: 60, bottom: 30, display: "flex", alignItems: "flex-end", gap: 10 }}>
          <Mascot which={reveal ? "poussin" : "chat"} size={vertical ? 220 : 190} mood={reveal ? (impossible && !showAnswer ? "shock" : "cheer") : "idle"} talk={reveal ? undefined : qClip} talkFrom={qd} />
          {!vertical && (
            <div style={{ marginBottom: 90 }}>
              <Bubble size={32 * k}>{reveal ? (impossible ? T.admitIt : slow ? T.pointsWonSlow(LEVELS[level].points) : T.pointsWon(LEVELS[level].points)) : quip}</Bubble>
            </div>
          )}
        </div>
      )}
    </AbsoluteFill>
  );
};
