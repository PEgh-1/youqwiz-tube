import React from "react";
import { AbsoluteFill, Audio, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { AUDIO, Background, Bubble, CommonSegment, Fonts, HookBanner, Karaoke, Logo, Mascot, MusicBed, Pill, Pop, Progress, Rich, ShortFx, Ticks, Voice, quipFor, shortMotion, styleOf, themeOf } from "./components";
import { FONT_BODY, FONT_DISPLAY, INK, WHITE } from "./theme";
import { SHORT_OPTS, buildTimeline } from "./timeline";
import type { Episode } from "./types";
import { tr } from "./i18n";

const has = (k: string) => AUDIO[k] === true;
export type VersusProps = { episode: Episode; vertical?: boolean };

// Gabarit « Versus » (Tu préfères…) : écran partagé en deux camps, barre de chrono centrale, mascottes qui s'opposent.
// Différent du gabarit Devine (carte blanche centrée) pour que les deux piliers ne se ressemblent pas.
export const Versus: React.FC<VersusProps> = ({ episode, vertical = false }) => {
  const { fps } = useVideoConfig();
  const theme = themeOf(episode);
  const style = styleOf(episode);
  const { segments } = buildTimeline(episode, fps, vertical ? SHORT_OPTS(episode) : {});
  // Compteur « x / n » : en Short, le nombre réel de questions de la timeline (jusqu'à 8, limité par les 58 s), pas shortItems.
  const n = vertical ? segments.filter((s) => s.kind === "question").length : episode.items.length;
  const lastQ = Math.max(...segments.filter((s) => s.kind === "question").map((s) => (s as { index: number }).index));
  return (
    <AbsoluteFill style={{ fontFamily: FONT_BODY, color: INK }}>
      <Fonts />
      <Background theme={theme} confetti={vertical ? 16 : 24} pattern={style.pattern} />
      <MusicBed episode={episode} />
      {segments.map((s, k) => {
        if (s.kind === "question")
          return (
            <Sequence key={k} from={s.from} durationInFrames={s.dur} name={`C${s.index + 1}`}>
              {vertical && <ShortFx index={s.index} last={s.index === lastQ} dur={s.dur} />}
              <Voice clip={episode.items[s.index].voice?.q} />
              {s.dur > 5 * fps && has("ding") && (
                <Sequence from={5 * fps} durationInFrames={s.dur - 5 * fps}>
                  <Audio src={staticFile("audio/ding.mp3")} volume={0.45} />
                </Sequence>
              )}
              <Ticks episode={episode} index={s.index} dur={s.dur} until={5 * fps} />
              <Duel episode={episode} index={s.index} total={n} dur={s.dur} vertical={vertical} />
            </Sequence>
          );
        if (s.kind === "reveal" || s.kind === "score") return null;
        return <CommonSegment key={k} index={k} s={s} episode={episode} vertical={vertical} />;
      })}
    </AbsoluteFill>
  );
};

const SIDE_COLORS = ["#FFE3EC", "#DDF6FF"];
const Duel: React.FC<{ episode: Episode; index: number; total: number; dur: number; vertical: boolean }> = ({ episode, index, total, dur, vertical }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const theme = themeOf(episode);
  const item = episode.items[index];
  const options = item.prompt.type === "choices" ? item.prompt.value : [item.answer, ""];
  const choiceFrames = 5 * fps;
  const askPhase = frame >= choiceFrames;
  const left = spring({ frame, fps, config: { damping: 13, stiffness: 120 } });
  const right = spring({ frame: frame - 4, fps, config: { damping: 13, stiffness: 120 } });
  const progress = Math.min(1, frame / choiceFrames);
  const secondsLeft = Math.max(0, Math.ceil((choiceFrames - frame) / fps));
  const hud = vertical ? 36 : 36;
  const T = tr(episode);
  const quipL = quipFor(episode, T.versusQuipsLeft, index);
  const quipR = quipFor(episode, T.versusQuipsRight, index * 7 + 1);
  const fontFor = (s: string) => {
    const n = s.length;
    const base = vertical ? 70 : 82;
    return n > 48 ? base * 0.66 : n > 34 ? base * 0.78 : n > 22 ? base * 0.9 : base;
  };
  const paneW = vertical ? width - 120 : width / 2 - 110;
  const paneH = vertical ? (height - 1000) / 2 : 520;
  const pane = (i: number) => {
    const s = i === 0 ? left : right;
    const shift = vertical ? `translateY(${(1 - s) * (i === 0 ? -300 : 300)}px)` : `translateX(${(1 - s) * (i === 0 ? -600 : 600)}px)`;
    return (
      <div key={i} style={{ width: paneW, height: paneH, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: fontFor(options[i]), color: INK, background: SIDE_COLORS[i], border: `9px solid ${INK}`, boxShadow: `14px 14px 0 ${INK}`, padding: "24px 36px", borderRadius: 34, textAlign: "center", lineHeight: 1.1, transform: `${shift} rotate(${i === 0 ? -1.2 : 1.2}deg)`, opacity: s, overflow: "hidden", overflowWrap: "anywhere" }}>
        <Rich text={options[i]} size={fontFor(options[i])} />
      </div>
    );
  };
  return (
    <AbsoluteFill style={{ alignItems: "center" }}>
      {vertical && (
        <div style={{ position: "absolute", top: index === 0 ? 40 : 70, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
          {index === 0 ? <HookBanner theme={theme} sticker={episode.meta.thumbnail.sticker} line={episode.meta.shortLine} n={total} until={dur - 6} lang={episode.lang} /> : <Logo theme={theme} size={78} />}
        </div>
      )}
      <div style={{ position: "absolute", top: vertical ? 190 : 34, left: 60, right: 60, display: "flex", alignItems: "center", gap: 24, justifyContent: "center" }}>
        <Pill size={hud}>{`🎯 ${index + 1} / ${total}`}</Pill>
        {!vertical && <Progress value={index / total} theme={theme} />}
        <Pill size={hud} bg={theme.accent} fg={WHITE}>{T.wouldYouRather}</Pill>
      </div>
      {vertical && item.voice?.q?.text && (
        <div style={{ position: "absolute", top: 278, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
          <Karaoke clip={item.voice.q} theme={theme} size={46} width={960} />
        </div>
      )}
      {!vertical && (
        <div style={{ position: "absolute", top: 118, left: 60 }}>
          <Logo theme={theme} size={48} />
        </div>
      )}

      {/* Les deux camps + le OU central */}
      <div style={{ position: "absolute", top: vertical ? 420 : 230, left: 0, right: 0, display: "flex", flexDirection: vertical ? "column" : "row", alignItems: "center", justifyContent: "center", gap: vertical ? 70 : 60, transform: shortMotion(frame, choiceFrames, askPhase, vertical) || undefined }}>
        {pane(0)}
        {pane(1)}
      </div>
      <div style={{ position: "absolute", top: vertical ? 420 + paneH + 10 : 230 + paneH / 2 - 50, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
        <Pop delay={6}>
          <div style={{ width: 120, height: 120, borderRadius: 999, background: theme.accent, border: `8px solid ${INK}`, boxShadow: `8px 8px 0 ${INK}`, color: WHITE, fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 56, display: "flex", alignItems: "center", justifyContent: "center", transform: `rotate(${Math.sin(frame / 6) * 6}deg)` }}>
            {T.or}
          </div>
        </Pop>
      </div>

      {/* Chrono : barre centrale qui se vide des deux côtés */}
      {!askPhase ? (
        <div style={{ position: "absolute", bottom: vertical ? 330 : 40, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
          <div style={{ width: vertical ? 900 : 860, height: 44, background: WHITE, border: `6px solid ${INK}`, borderRadius: 999, boxShadow: `6px 6px 0 ${INK}`, overflow: "hidden", position: "relative" }}>
            <div style={{ position: "absolute", left: `${progress * 50}%`, right: `${progress * 50}%`, top: 0, bottom: 0, background: secondsLeft <= 1 ? "#FF3B3B" : theme.accent }} />
          </div>
          <Pill size={40} bg={INK} fg={WHITE}>{T.pickFast(secondsLeft)}</Pill>
        </div>
      ) : (
        <div style={{ position: "absolute", bottom: vertical ? 330 : 60, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
          <Pop>
            <Pill size={vertical ? 44 : 52} bg={theme.accent} fg={WHITE} tilt={-2} style={{ whiteSpace: "normal", textAlign: "center", maxWidth: 1100 }}>{T.andYou}</Pill>
          </Pop>
        </div>
      )}

      {/* Mascottes : chacune défend son camp */}
      {!vertical && (
        <>
          <div style={{ position: "absolute", left: 40, bottom: 20, display: "flex", alignItems: "flex-end", gap: 8 }}>
            <Mascot which="chat" size={240} mood={askPhase ? "cheer" : "idle"} />
            <div style={{ marginBottom: 210 }}><Bubble size={30}>{askPhase ? T.soWhat : quipL}</Bubble></div>
          </div>
          <div style={{ position: "absolute", right: 40, bottom: 20, display: "flex", alignItems: "flex-end", flexDirection: "row-reverse", gap: 8 }}>
            <Mascot which="poussin" size={220} mood={askPhase ? "cheer" : "idle"} />
            <div style={{ marginBottom: 210 }}><Bubble size={30} tilt={2}>{askPhase ? T.iKnow : quipR}</Bubble></div>
          </div>
        </>
      )}
    </AbsoluteFill>
  );
};
