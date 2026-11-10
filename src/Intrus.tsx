import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { AUDIO, Background, Bubble, Burst, Card, CommonSegment, Countdown, Emoji, Fonts, HookBanner, Karaoke, LevelBadge, Logo, Mascot, MusicBed, Pill, Pop, Progress, Rich, ShortFx, Streak, Ticks, Voice, quipFor, shortHookOf, shortMotion, styleOf, themeOf, tiltFor, WipeLayer } from "./components";
import { Score } from "./DevineEn3s";
import { emojiToCode, splitEmojis } from "./emoji";
import { FONT_BODY, FONT_DISPLAY, BAD, INK, LEVELS, OK, WHITE } from "./theme";
import { tr } from "./i18n";
import { SHORT_OPTS, buildTimeline, levelOf, streakBreakIndex, totalPoints, VOICE_LEAD, sceneVariant, wipeScenes } from "./timeline";
import type { Episode } from "./types";

const has = (k: string) => AUDIO[k] === true;

export type IntrusProps = { episode: Episode; vertical?: boolean };

// Grille : 4×3 en 16:9, 3×4 en 9:16. Dimensions de la carte et des cases.
const layout = (vertical: boolean) => {
  const cols = vertical ? 3 : 4;
  const rows = vertical ? 4 : 3;
  const cardW = vertical ? 960 : 1180;
  const cardH = vertical ? 940 : 600;
  const pad = 30;
  const cellW = (cardW - 20 - pad * 2) / cols;
  const cellH = (cardH - 20 - pad * 2) / rows;
  const emoji = Math.floor(Math.min(cellW, cellH) * 0.82);
  const marginTop = vertical ? 100 : 110;
  return { cols, rows, cardW, cardH, pad, cellW, cellH, emoji, marginTop };
};

// Émojis de la grille + position (0-based) de l'intrus = l'émoji présent une seule fois.
export const parseGrid = (value: string): { cells: string[]; odd: number } => {
  const cells = splitEmojis(value).filter((g) => g.trim() !== "");
  const count: Record<string, number> = {};
  cells.forEach((c) => (count[emojiToCode(c)] = (count[emojiToCode(c)] ?? 0) + 1));
  const odd = cells.findIndex((c) => count[emojiToCode(c)] === 1);
  return { cells, odd: Math.max(0, odd) };
};

// Gabarit « Intrus » : grille d'émojis identiques sauf un, 16:9 ou Short 9:16.
export const Intrus: React.FC<IntrusProps> = ({ episode, vertical = false }) => {
  const { fps } = useVideoConfig();
  const theme = themeOf(episode);
  const style = styleOf(episode);
  const { segments } = buildTimeline(episode, fps, vertical ? SHORT_OPTS(episode) : {});
  const frame = useCurrentFrame(); // vidéo longue v2 : variante de décor par scène
  // Compteur « x / n » : en Short, le nombre réel de questions de la timeline (jusqu'à 8, limité par les 58 s), pas shortItems.
  const n = vertical ? segments.filter((s) => s.kind === "question").length : episode.items.length;
  const lastQ = Math.max(...segments.filter((s) => s.kind === "question").map((s) => (s as { index: number }).index));

  return (
    <AbsoluteFill style={{ fontFamily: FONT_BODY, color: INK }}>
      <Fonts />
      <Background theme={theme} confetti={vertical ? 22 : 34} pattern={style.pattern} variant={vertical ? 0 : sceneVariant(segments, frame)} />
      <MusicBed episode={episode} />

      {segments.map((s, k) => {
        if (s.kind === "question")
          return (
            <Sequence key={k} from={s.from} durationInFrames={s.dur} name={`Q${s.index + 1}`}>
              {vertical && <ShortFx index={s.index} last={s.index === lastQ} dur={s.dur} />}
              <Voice clip={episode.items[s.index].voice?.q} />
              <Ticks episode={episode} index={s.index} dur={s.dur} />
              <Stage episode={episode} index={s.index} total={n} reveal={false} dur={s.dur} vertical={vertical} />
            </Sequence>
          );
        if (s.kind === "reveal")
          return (
            <Sequence key={k} from={s.from} durationInFrames={s.dur} name={`R${s.index + 1}`}>
              <RevealAudio episode={episode} index={s.index} />
              <Stage episode={episode} index={s.index} total={n} reveal dur={s.dur} vertical={vertical} />
            </Sequence>
          );
        if (s.kind === "score")
          return (
            <Sequence key={k} from={s.from} durationInFrames={s.dur} name="Score">
              {has("fanfare") && <Audio src={staticFile("audio/fanfare.mp3")} volume={0.8} />}
              <Voice clip={episode.voice?.score} from={15} />
              <Score episode={episode} />
            </Sequence>
          );
        return <CommonSegment key={k} index={k} s={s} episode={episode} vertical={vertical} />;
      })}
      {!vertical && <WipeLayer theme={theme} scenes={wipeScenes(segments)} />}
    </AbsoluteFill>
  );
};

const RevealAudio: React.FC<{ episode: Episode; index: number }> = ({ episode, index }) => {
  const { fps } = useVideoConfig();
  const impossible = levelOf(episode, index) === "impossible";
  const delay = impossible ? Math.round(0.8 * fps) : 0;
  return (
    <Sequence from={delay}>
      {impossible && has("buzz") ? <Audio src={staticFile("audio/buzz.mp3")} volume={0.7} /> : has("ding") ? <Audio src={staticFile("audio/ding.mp3")} volume={0.45} /> : null}
      <Voice clip={episode.items[index].voice?.a} from={Math.round(VOICE_LEAD * fps)} />
    </Sequence>
  );
};

// ---------- Scène question / révélation ----------
const Stage: React.FC<{ episode: Episode; index: number; total: number; reveal: boolean; dur: number; vertical: boolean }> = ({ episode, index, total, reveal, dur, vertical }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const theme = themeOf(episode);
  const style = styleOf(episode);
  const item = episode.items[index];
  const level = levelOf(episode, index);
  const impossible = level === "impossible";
  const sc = vertical ? 0.8 : 1;
  const L = layout(vertical);
  const karaoke = reveal ? item.voice?.a : item.voice?.q; // Shorts v2 : voix off mot à mot à la place de la consigne
  const enter = spring({ frame, fps, config: { damping: 13, stiffness: 160 } });
  const tilt = tiltFor(episode, index, 0.35);
  const brk = streakBreakIndex(episode);
  const streak = index < brk ? index + (reveal ? 1 : 0) : index - brk + (reveal ? 1 : 0);
  const points = totalPoints(episode, index + (reveal ? 1 : 0));
  const T = tr(episode);
  const quip = quipFor(episode, T.quips[level], index);
  const delay = Math.round(0.8 * fps);
  const showAnswer = reveal && (!impossible || frame >= delay);
  const hud = vertical ? 30 : 36;
  const value = item.prompt.type === "emoji" ? item.prompt.value : "";
  const { cells, odd } = parseGrid(value);

  // Centre de la case de l'intrus dans l'image (pour les confettis).
  const cardCx = width / 2;
  const cardCy = height / 2 + L.marginTop / 2;
  const gx = cardCx - (L.cols * L.cellW) / 2 + ((odd % L.cols) + 0.5) * L.cellW;
  const gy = cardCy - (L.rows * L.cellH) / 2 + (Math.floor(odd / L.cols) + 0.5) * L.cellH;
  const ringT = spring({ frame: frame - (impossible ? delay : 0), fps, config: { damping: 9, stiffness: 150 } });
  const ringSize = L.emoji * 1.3;

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      {/* HUD */}
      <div style={{ position: "absolute", top: vertical ? 60 : 34, left: 60, right: 60, display: "flex", alignItems: "center", gap: 24, flexWrap: "nowrap", justifyContent: "center" }}>
        <Pill size={hud}>{`🎯 ${index + 1} / ${total}`}</Pill>
        {!vertical && <Progress value={(index + (reveal ? 1 : 0)) / total} theme={theme} />}
        {!vertical && <LevelBadge level={level} size={hud} lang={episode.lang} />}
        <Streak value={streak} size={hud} lang={episode.lang} />
        <Pill size={hud} bg={WHITE} fg={INK}>{`⭐ ${points}`}</Pill>
      </div>
      {!vertical && (
        <div style={{ position: "absolute", top: 118, left: 60 }}>
          <Logo theme={theme} size={48} />
        </div>
      )}

      {/* Question */}
      <div style={{ position: "absolute", top: vertical ? (index === 0 && !reveal ? 160 : 240) : 128, left: 0, right: 0, display: "flex", justifyContent: "center", textAlign: "center", fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: (vertical ? 70 : 82) * sc, color: INK, textShadow: `5px 5px 0 ${WHITE}`, padding: "0 80px" }}>
        {vertical && index === 0 && !reveal ? (
          <HookBanner theme={theme} sticker={shortHookOf(episode).sticker} line={shortHookOf(episode).line} n={total} until={dur - 6} lang={episode.lang} />
        ) : vertical && karaoke?.text ? (
          <Karaoke clip={karaoke} theme={theme} size={56} width={960} from={reveal ? Math.round((impossible ? 0.8 : 0) * fps) + Math.round(VOICE_LEAD * fps) : 0} />
        ) : (
          <Rich text={episode.question} size={(vertical ? 70 : 82) * sc} />
        )}
      </div>

      {/* Carte : grille d'émojis */}
      <div style={{ transform: `scale(${reveal ? 1 : enter})${shortMotion(frame, dur, reveal, vertical)}`, marginTop: L.marginTop }}>
        <Card tilt={tilt} shape={style.card} border={showAnswer ? OK : INK} style={{ boxSizing: "border-box", width: L.cardW, height: L.cardH, padding: L.pad }}>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${L.cols}, ${L.cellW}px)`, gridTemplateRows: `repeat(${L.rows}, ${L.cellH}px)` }}>
            {cells.map((c, i) => {
              const isOdd = i === odd;
              return (
                <div key={i} style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", opacity: showAnswer && !isOdd ? 0.3 : 1 }}>
                  <Emoji value={c} size={L.emoji} />
                  {showAnswer && isOdd && (
                    <div
                      style={{
                        position: "absolute",
                        width: ringSize,
                        height: ringSize,
                        borderRadius: "50%",
                        border: `${vertical ? 16 : 14}px solid ${BAD}`,
                        boxShadow: `0 0 0 5px ${WHITE}, 0 0 0 9px ${INK}, inset 0 0 0 4px ${INK}`,
                        transform: `scale(${interpolate(ringT, [0, 1], [2.4, 1])}) rotate(${(1 - ringT) * -40}deg)`,
                        opacity: Math.min(1, ringT * 2),
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
          {item.hint && !reveal && (
            <div style={{ position: "absolute", bottom: -34, left: 40 }}>
              <Pill size={30 * sc} bg={theme.soft}>{`💡 ${item.hint}`}</Pill>
            </div>
          )}
          {reveal && impossible && !showAnswer && (
            <div style={{ position: "absolute", bottom: -52, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
              <Pill size={52 * sc} bg={theme.accent} fg={WHITE} tilt={-3}>{T.drumroll}</Pill>
            </div>
          )}
          {showAnswer && (
            <div style={{ position: "absolute", bottom: vertical ? -50 : -54, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
              <Pop>
                <Pill bg={BAD} fg={WHITE} size={vertical ? 62 : 68} tilt={-3}>{`🎯 ${item.answer}`}</Pill>
              </Pop>
            </div>
          )}
          {/* sticker de niveau collé sur la carte */}
          <div style={{ position: "absolute", top: -34, right: -40 }}>
            <LevelBadge level={level} size={30} tilt={10} lang={episode.lang} />
          </div>
          {reveal && index === brk - 1 && (
            <div style={{ position: "absolute", top: -36, left: -40 }}>
              <Pill size={30} bg={BAD} fg={WHITE} tilt={-8}>{T.streakLost}</Pill>
            </div>
          )}
        </Card>
      </div>
      {showAnswer && frame < (impossible ? delay : 0) + 20 && <Burst theme={theme} x={gx} y={gy} n={44} />}

      {/* Chrono */}
      {!reveal && (
        <div style={{ position: "absolute", right: vertical ? 50 : 60, bottom: vertical ? 230 : 18 }}>
          <Countdown frame={frame} totalFrames={dur} theme={theme} size={vertical ? 190 : 230} kind={vertical ? "ring" : "slider"} rider="poussin" width={780} />
        </div>
      )}

      {/* Mascotte + bulle */}
      <div style={{ position: "absolute", left: vertical ? 30 : 60, bottom: vertical ? 200 : 40, display: "flex", alignItems: "flex-end", gap: 10 }}>
        <Mascot which={reveal ? "poussin" : "chat"} size={vertical ? 210 : 260} mood={reveal ? (impossible && !showAnswer ? "shock" : "cheer") : "idle"} />
        {!vertical && (
          <div style={{ marginBottom: 6 }}>
            <Bubble size={34}>{reveal ? (impossible ? T.admitIt : T.pointsWon(LEVELS[level].points)) : quip}</Bubble>
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

