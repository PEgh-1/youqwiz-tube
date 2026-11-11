import React from "react";
import { Composition, Still } from "remotion";
import { DevineEn3s } from "./DevineEn3s";
import { Thumbnail } from "./Thumbnail";
import { Mockup } from "./Mockups";
import { Avatar, Banner, TRAILER_FRAMES, Trailer, Watermark } from "./Channel";
import { Intrus } from "./Intrus";
import { MinuteCulture, minuteTimeline } from "./MinuteCulture";
import type { Minute } from "./MinuteCulture";
import { QuizQCM } from "./QuizQCM";
import { Versus } from "./Versus";
import cultureSample from "../data/episodes/sample-culture.json";
import intrusSample from "../data/episodes/sample-intrus.json";
import { SHORT_OPTS, buildTimeline } from "./timeline";
import type { Episode } from "./types";
import sample from "../data/episodes/sample-devine-animaux.json";

const FPS = 30;
const defaultEpisode = sample as unknown as Episode;
const intrusEpisode = intrusSample as unknown as Episode;
const cultureEpisode = cultureSample as unknown as Episode;
const SHORT = SHORT_OPTS;

export const RemotionRoot: React.FC = () => (
  <>
    {/* Vidéo longue 16:9 */}
    <Composition
      id="DevineEn3s"
      component={DevineEn3s}
      fps={FPS}
      width={1920}
      height={1080}
      durationInFrames={300}
      defaultProps={{ episode: defaultEpisode, vertical: false }}
      calculateMetadata={({ props }) => ({ durationInFrames: buildTimeline(props.episode, FPS).total })}
    />
    {/* Short 9:16 : les premiers items + appel vers la vidéo longue */}
    <Composition
      id="DevineShort"
      component={DevineEn3s}
      fps={FPS}
      width={1080}
      height={1920}
      durationInFrames={300}
      defaultProps={{ episode: defaultEpisode, vertical: true }}
      calculateMetadata={({ props }) => ({ durationInFrames: buildTimeline(props.episode, FPS, SHORT(props.episode)).total })}
    />
    {/* Intrus (pilier émojis) */}
    <Composition id="Intrus" component={Intrus} fps={FPS} width={1920} height={1080} durationInFrames={300} defaultProps={{ episode: intrusEpisode, vertical: false }} calculateMetadata={({ props }) => ({ durationInFrames: buildTimeline(props.episode, FPS).total })} />
    <Composition id="IntrusShort" component={Intrus} fps={FPS} width={1080} height={1920} durationInFrames={300} defaultProps={{ episode: intrusEpisode, vertical: true }} calculateMetadata={({ props }) => ({ durationInFrames: buildTimeline(props.episode, FPS, SHORT(props.episode)).total })} />
    {/* Versus (tu préfères) */}
    <Composition id="Versus" component={Versus} fps={FPS} width={1920} height={1080} durationInFrames={300} defaultProps={{ episode: defaultEpisode, vertical: false }} calculateMetadata={({ props }) => ({ durationInFrames: buildTimeline(props.episode, FPS).total })} />
    <Composition id="VersusShort" component={Versus} fps={FPS} width={1080} height={1920} durationInFrames={300} defaultProps={{ episode: defaultEpisode, vertical: true }} calculateMetadata={({ props }) => ({ durationInFrames: buildTimeline(props.episode, FPS, SHORT(props.episode)).total })} />
    {/* QCM (culture générale, générations) */}
    <Composition id="QuizQCM" component={QuizQCM} fps={FPS} width={1920} height={1080} durationInFrames={300} defaultProps={{ episode: cultureEpisode, vertical: false }} calculateMetadata={({ props }) => ({ durationInFrames: buildTimeline(props.episode, FPS).total })} />
    <Composition id="QuizQCMShort" component={QuizQCM} fps={FPS} width={1080} height={1920} durationInFrames={300} defaultProps={{ episode: cultureEpisode, vertical: true }} calculateMetadata={({ props }) => ({ durationInFrames: buildTimeline(props.episode, FPS, SHORT(props.episode)).total })} />
    {/* « La minute culture générale » : Short quotidien façon réclame des années 30-40 (pilote 11/11/2026) */}
    <Composition id="MinuteCulture" component={MinuteCulture} fps={FPS} width={1080} height={1920} durationInFrames={900} defaultProps={{ minute: { id: "exemple", hook: "Quel métal est liquide à température ambiante ?", choices: ["Le fer", "Le mercure", "L'or"], correct: 1, fact: "Très toxique, il a disparu de nos thermomètres. Prudence !" } as Minute }} calculateMetadata={({ props }) => ({ durationInFrames: minuteTimeline(props.minute, FPS).total })} />
    {/* Miniatures (2 variantes pour le test A/B YouTube) */}
    <Still id="ThumbA" component={Thumbnail} width={1280} height={720} defaultProps={{ episode: defaultEpisode, variant: 0 }} />
    <Still id="ThumbB" component={Thumbnail} width={1280} height={720} defaultProps={{ episode: defaultEpisode, variant: 1 }} />
    {[0, 1, 2].map((v) => (
      <Still key={v} id={`Mockup${v}`} component={Mockup} width={1920} height={1080} defaultProps={{ variant: v }} />
    ))}
        <Still id="Avatar0" component={Avatar} width={800} height={800} defaultProps={{ variant: 0 }} />
      <Still id="Avatar1" component={Avatar} width={800} height={800} defaultProps={{ variant: 1 }} />
      <Still id="Banner0" component={Banner} width={2560} height={1440} defaultProps={{ variant: 0 }} />
      <Still id="Banner1" component={Banner} width={2560} height={1440} defaultProps={{ variant: 1 }} />
      <Still id="Watermark" component={Watermark} width={150} height={150} />
      <Composition id="Trailer" component={Trailer} fps={FPS} width={1920} height={1080} durationInFrames={TRAILER_FRAMES(FPS)} />
</>
);
