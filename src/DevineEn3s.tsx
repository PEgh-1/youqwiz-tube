import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { AUDIO, Background, Bubble, Burst, Card, CommonSegment, Countdown, FactCard, Fonts, LevelBadge, Logo, Mascot, MusicBed, Pill, Pop, Progress, PromptView, Reveal, Rich, Streak, Ticks, Voice, quipFor, styleOf, themeOf, tiltFor } from "./components";
import { FONT_BODY, FONT_DISPLAY, INK, LEVELS, OK, QUIPS, RANKS, WHITE } from "./theme";
import { SHORT_OPTS, buildTimeline, factStart, levelOf, streakBreakIndex, totalPoints, VOICE_LEAD } from "./timeline";
import type { Episode } from "./types";

const has = (k: string) => AUDIO[k] === true;

export type DevineProps = { episode: Episode; vertical?: boolean };

// Gabarit « Devine » (et « Choix » en repli), vidéo longue 16:9 ou Short 9:16.
export const DevineEn3s: React.FC<DevineProps> = ({ episode, vertical = false }) => {
  const { fps } = useVideoConfig();
  const theme = themeOf(episode);
  const style = styleOf(episode);
  const { segments } = buildTimeline(episode, fps, vertical ? SHORT_OPTS(episode) : {});
  // Compteur « x / n » : en Short, le nombre réel de questions de la timeline (jusqu'à 8, limité par les 58 s), pas shortItems.
  const n = vertical ? segments.filter((s) => s.kind === "question").length : episode.items.length;
  const isChoice = episode.timing.reveal <= 0;

  return (
    <AbsoluteFill style={{ fontFamily: FONT_BODY, color: INK }}>
      <Fonts />
      <Background theme={theme} confetti={vertical ? 22 : 34} pattern={style.pattern} />
      <MusicBed episode={episode} />

      {segments.map((s, k) => {
        if (s.kind === "question")
          return (
            <Sequence key={k} from={s.from} durationInFrames={s.dur} name={`Q${s.index + 1}`}>
              <Voice clip={episode.items[s.index].voice?.q} />
              {isChoice && s.dur > 5 * fps && has("ding") && (
                <Sequence from={5 * fps} durationInFrames={s.dur - 5 * fps}>
                  <Audio src={staticFile("audio/ding.mp3")} volume={0.45} />
                </Sequence>
              )}
              <Ticks episode={episode} index={s.index} dur={s.dur} until={isChoice ? 5 * fps : undefined} />
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
    </AbsoluteFill>
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

// ---------- Scène question / révélation ----------
const Stage: React.FC<{ episode: Episode; index: number; total: number; reveal: boolean; dur: number; vertical: boolean }> = ({ episode, index, total, reveal, dur, vertical }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = themeOf(episode);
  const style = styleOf(episode);
  const item = episode.items[index];
  const level = levelOf(episode, index);
  const isChoice = item.prompt.type === "choices";
  const isLetter = item.prompt.type === "letter";
  const impossible = level === "impossible";
  const big = vertical ? 520 : 380;
  const enter = spring({ frame, fps, config: { damping: 13, stiffness: 160 } });
  const tilt = tiltFor(episode, index);
  const brk = streakBreakIndex(episode);
  const streak = index < brk ? index + (reveal ? 1 : 0) : index - brk + (reveal ? 1 : 0);
  const points = totalPoints(episode, index + (reveal ? 1 : 0));
  const CHOICE_QUIPS = ["Dur, hein ? 😅", "Choisis vite !", "Moi je sais 😏", "Les deux ? Interdit 😜", "Sans tricher 👀", "Ton cœur ou ta raison ? 💭", "Vite, ça compte ! ⏱️"];
  const quip = isChoice ? quipFor(episode, CHOICE_QUIPS, index) : quipFor(episode, QUIPS[level], index);
  const showAnswer = reveal && (!impossible || frame >= Math.round(0.8 * fps));
  const choiceFrames = 5 * fps; // choix : 5 s pour choisir, puis relance « Et toi ? »
  const askPhase = isChoice && frame >= choiceFrames;
  const hud = vertical ? 34 : 36; // vertical : 3 pastilles sur une ligne (le niveau est sur le coin de la carte)
  const factAt = Math.round(factStart(episode, index) * fps);
  const showFact = reveal && !vertical && !!item.fact && frame >= factAt;
  // Question affichée : pour l'alphabet, la catégorie est dans la carte ; la consigne reste générique.
  const question = isLetter ? "Nomme-en un qui commence par…" : episode.question;
  // 08/11/2026 : en 16:9, barre de temps « slider » chevauchée par la mascotte opposée à celle du bas gauche ; les Shorts gardent l'anneau.
  const timerPos = vertical ? { position: "absolute" as const, left: 60, bottom: 330 } : { position: "absolute" as const, right: 60, bottom: 18 };
  const rider: "chat" | "poussin" = askPhase ? "chat" : "poussin";

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: vertical ? "flex-start" : "center" }}>
      {vertical && (
        <div style={{ position: "absolute", top: 70 }}>
          <Logo theme={theme} size={78} />
        </div>
      )}
      {/* HUD */}
      <div style={{ position: "absolute", top: vertical ? 190 : 34, left: 60, right: 60, display: "flex", alignItems: "center", gap: 24, flexWrap: "nowrap", justifyContent: "center" }}>
        <Pill size={hud}>{`🎯 ${index + 1} / ${total}`}</Pill>
        {!vertical && <Progress value={(index + (reveal ? 1 : 0)) / total} theme={theme} />}
        {!isChoice && !vertical && <LevelBadge level={level} size={hud} />}
        {!isChoice && <Streak value={streak} size={hud} />}
        {!isChoice && <Pill size={hud} bg={WHITE} fg={INK}>{`⭐ ${points}`}</Pill>}
      </div>
      {!vertical && (
        <div style={{ position: "absolute", top: 118, left: 60 }}>
          <Logo theme={theme} size={48} />
        </div>
      )}

      {/* Question */}
      <div style={{ position: "absolute", top: vertical ? 290 : 128, left: 0, right: 0, textAlign: "center", fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: vertical ? 80 : 82, color: INK, textShadow: `5px 5px 0 ${WHITE}`, padding: "0 60px", lineHeight: 1.05 }}>
        <Rich text={question} size={vertical ? 80 : 82} />
      </div>

      {/* Carte */}
      <div style={{ transform: `scale(${reveal ? 1 + 0.04 * Math.sin(frame / 3) * (frame < 8 ? 1 : 0) : enter})`, marginTop: vertical ? 530 : showFact ? 70 : 110 }}>
        <Card tilt={tilt} shape={style.card} border={showAnswer ? OK : INK} style={{ width: vertical ? 980 : isChoice ? 1520 : 1100, height: vertical ? 880 : 560, gap: 24, padding: 40 }}>
          {!showAnswer || isChoice ? (
            <PromptView prompt={item.prompt} theme={theme} big={big} vertical={vertical} />
          ) : (
            <div style={{ display: "flex", flexDirection: vertical ? "column" : "row", alignItems: "center", gap: 50 }}>
              <div style={{ opacity: 0.9 }}>
                <PromptView prompt={item.prompt} theme={theme} big={big * 0.75} vertical={vertical} maxW={vertical ? 860 : 500} maxH={vertical ? 420 : 440} />
              </div>
              <Reveal kind={style.reveal}>
                <Pill bg={OK} fg={WHITE} size={vertical ? 76 : isLetter ? 56 : 84} tilt={2} style={{ whiteSpace: "normal", textAlign: "center", maxWidth: vertical ? 860 : 720, lineHeight: 1.05 }}>
                  {`✅ ${item.answer}`}
                </Pill>
              </Reveal>
            </div>
          )}
          {reveal && impossible && !showAnswer && (
            <div style={{ position: "absolute", bottom: 30, fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 56, color: theme.accent }}><Rich text="Alors… 🥁" size={56} /></div>
          )}
          {item.hint && !reveal && <Pill size={32} bg={theme.soft}>{`💡 ${item.hint}`}</Pill>}
          {!isChoice && (
            <div style={{ position: "absolute", top: -34, right: -40 }}>
              <LevelBadge level={level} size={30} tilt={10} />
            </div>
          )}
          {reveal && index === brk - 1 && !isChoice && (
            <div style={{ position: "absolute", bottom: -36, left: -40 }}>
              <Pill size={34} bg="#FF3B3B" fg={WHITE} tilt={-8}>💔 Série perdue ? Dis-le en commentaire</Pill>
            </div>
          )}
        </Card>
      </div>
      {showAnswer && frame < Math.round(0.8 * fps) + 20 && <Burst theme={theme} x={vertical ? 540 : 960} y={vertical ? 970 : 560} n={44} />}

      {/* Fait bonus */}
      {showFact && (
        <div style={{ position: "absolute", bottom: 54, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
          <Sequence from={factAt} layout="none">
            <FactCard text={item.fact!} theme={theme} />
          </Sequence>
        </div>
      )}

      {/* Chrono */}
      {!reveal && !isChoice && (
        <div style={timerPos}>
          <Countdown frame={frame} totalFrames={dur} theme={theme} size={vertical ? 220 : 230} kind={vertical ? "ring" : "slider"} rider={rider} width={780} />
        </div>
      )}
      {!reveal && isChoice && !askPhase && (
        <div style={timerPos}>
          <Countdown frame={frame} totalFrames={choiceFrames} theme={theme} size={vertical ? 220 : 230} kind={vertical ? "ring" : "slider"} rider={rider} width={780} />
        </div>
      )}
      {!reveal && isChoice && askPhase && (
        <div style={vertical ? { position: "absolute", bottom: 360, left: 60 } : { position: "absolute", bottom: 80, right: 110 }}>
          <Pop>
            <Pill size={vertical ? 44 : 48} bg={theme.accent} fg={WHITE} tilt={-3} style={vertical ? { whiteSpace: "normal", textAlign: "center", maxWidth: 700 } : undefined}>Et toi ? Dis-le en commentaire 👇</Pill>
          </Pop>
        </div>
      )}

      {/* Mascotte + bulle (cachée pendant le fait bonus) */}
      {!showFact && (
        <div style={vertical ? { position: "absolute", right: 150, bottom: 330, display: "flex", alignItems: "flex-end", gap: 10 } : { position: "absolute", left: 60, bottom: 40, display: "flex", alignItems: "flex-end", gap: 10 }}>
          <Mascot which={reveal || askPhase ? "poussin" : "chat"} size={vertical ? 230 : 260} mood={reveal ? (impossible && !showAnswer ? "shock" : "cheer") : askPhase ? "cheer" : "idle"} />
          {!vertical && (
            <div style={{ marginBottom: 170 }}>
              <Bubble size={34}>{reveal ? (impossible ? "Avoue, tu l'avais pas 😏" : `+${LEVELS[level].points} points 🎉`) : askPhase ? "Moi je sais ce que je prends 😏" : quip}</Bubble>
            </div>
          )}
        </div>
      )}
    </AbsoluteFill>
  );
};

// ---------- Score final ----------
export const Score: React.FC<{ episode: Episode; k?: number }> = ({ episode, k = 1 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = themeOf(episode);
  const max = totalPoints(episode);
  const shown = Math.round(interpolate(frame, [0, 2 * fps], [0, max], { extrapolateRight: "clamp" }));
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 30 }}>
      <Pop>
        <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 96 * k, color: WHITE, textShadow: `7px 7px 0 ${INK}` }}>Ton score ?</div>
      </Pop>
      <Pop delay={4}>
        <Pill size={120 * Math.min(k, 1.1)} bg={WHITE} fg={theme.accent} tilt={-2}>{`⭐ ${shown} / ${max}`}</Pill>
      </Pop>
      <Pop delay={10}>
        <div style={{ display: "flex", gap: 24 }}>
          {RANKS.map((r, i) => (
            <Pill key={i} size={34 * k} bg={i === RANKS.length - 1 ? theme.soft : WHITE} tilt={(i % 2 ? 1 : -1) * 2}>
              {`${r.emoji} ${r.label}${i > 0 ? ` ≥ ${Math.round(max * r.min)}` : ""}`}
            </Pill>
          ))}
        </div>
      </Pop>
      {frame < 25 && <Burst theme={theme} x={960} y={400} n={60} />}
      <div style={{ position: "absolute", left: 60, bottom: 30 }}>
        <Mascot which="chat" size={320} mood="cheer" />
      </div>
      <div style={{ position: "absolute", right: 60, bottom: 30 }}>
        <Mascot which="poussin" size={280} mood="cheer" />
      </div>
    </AbsoluteFill>
  );
};
