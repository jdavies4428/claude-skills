import React from "react";
import { Composition, Folder } from "remotion";
import { loadFont } from "@remotion/google-fonts/PlayfairDisplay";

loadFont("normal", { weights: ["400", "700", "800"] });
import { AdReelSchema, DEFAULT_PROPS } from "./schema";
import { Template1Polaroid } from "./templates/Template1Polaroid";
import { Template2Slider } from "./templates/Template2Slider";
import { Template3Kinetic } from "./templates/Template3Kinetic";
import { Template4Magazine } from "./templates/Template4Magazine";
import { Template5Glitch } from "./templates/Template5Glitch";
import { Template6Peel } from "./templates/Template6Peel";
import { Template7Blinds } from "./templates/Template7Blinds";
import { Template8Film } from "./templates/Template8Film";
import { Template9MemoryReturns } from "./templates/Template9MemoryReturns";
import { Template10LegacyUnlocked } from "./templates/Template10LegacyUnlocked";
import { Template11ThroughGenerations } from "./templates/Template11ThroughGenerations";
import { Template12FaceReturns } from "./templates/Template12FaceReturns";
import { Template13DustOfTime } from "./templates/Template13DustOfTime";
import { Template14WarmthReturns } from "./templates/Template14WarmthReturns";
import { Template15OpeningAlbum } from "./templates/Template15OpeningAlbum";
import { Template16FaceToFace } from "./templates/Template16FaceToFace";
import { Template17TripleRestore } from "./templates/Template17TripleRestore";
import { Template18PassageOfTime } from "./templates/Template18PassageOfTime";

export const RemotionRoot: React.FC = () => (
  <>
    <Folder name="Ad-Reels">
      <Composition
        id="PolaroidDrop"
        component={Template1Polaroid}
        durationInFrames={240}
        fps={30}
        width={1080}
        height={1920}
        schema={AdReelSchema}
        defaultProps={DEFAULT_PROPS}
      />
      <Composition
        id="SliderReveal"
        component={Template2Slider}
        durationInFrames={300}
        fps={30}
        width={1080}
        height={1920}
        schema={AdReelSchema}
        defaultProps={DEFAULT_PROPS}
      />
      <Composition
        id="KineticType"
        component={Template3Kinetic}
        durationInFrames={270}
        fps={30}
        width={1080}
        height={1920}
        schema={AdReelSchema}
        defaultProps={DEFAULT_PROPS}
      />
      <Composition
        id="MagazineCover"
        component={Template4Magazine}
        durationInFrames={260}
        fps={30}
        width={1080}
        height={1920}
        schema={AdReelSchema}
        defaultProps={DEFAULT_PROPS}
      />
      <Composition
        id="TheGlitch"
        component={Template5Glitch}
        durationInFrames={290}
        fps={30}
        width={1080}
        height={1920}
        schema={AdReelSchema}
        defaultProps={DEFAULT_PROPS}
      />
      <Composition
        id="PeelAway"
        component={Template6Peel}
        durationInFrames={270}
        fps={30}
        width={1080}
        height={1920}
        schema={AdReelSchema}
        defaultProps={DEFAULT_PROPS}
      />
      <Composition
        id="VenetianBlinds"
        component={Template7Blinds}
        durationInFrames={240}
        fps={30}
        width={1080}
        height={1920}
        schema={AdReelSchema}
        defaultProps={DEFAULT_PROPS}
      />
      <Composition
        id="Filmstrip"
        component={Template8Film}
        durationInFrames={270}
        fps={30}
        width={1080}
        height={1920}
        schema={AdReelSchema}
        defaultProps={DEFAULT_PROPS}
      />
      <Composition
        id="MemoryReturns"
        component={Template9MemoryReturns}
        durationInFrames={300}
        fps={30}
        width={1080}
        height={1920}
        schema={AdReelSchema}
        defaultProps={DEFAULT_PROPS}
      />
      <Composition
        id="LegacyUnlocked"
        component={Template10LegacyUnlocked}
        durationInFrames={270}
        fps={30}
        width={1080}
        height={1920}
        schema={AdReelSchema}
        defaultProps={DEFAULT_PROPS}
      />
      <Composition
        id="ThroughGenerations"
        component={Template11ThroughGenerations}
        durationInFrames={330}
        fps={30}
        width={1080}
        height={1920}
        schema={AdReelSchema}
        defaultProps={DEFAULT_PROPS}
      />
      <Composition
        id="FaceReturns"
        component={Template12FaceReturns}
        durationInFrames={300}
        fps={30}
        width={1080}
        height={1920}
        schema={AdReelSchema}
        defaultProps={DEFAULT_PROPS}
      />
      <Composition
        id="DustOfTime"
        component={Template13DustOfTime}
        durationInFrames={300}
        fps={30}
        width={1080}
        height={1920}
        schema={AdReelSchema}
        defaultProps={DEFAULT_PROPS}
      />
      <Composition
        id="WarmthReturns"
        component={Template14WarmthReturns}
        durationInFrames={300}
        fps={30}
        width={1080}
        height={1920}
        schema={AdReelSchema}
        defaultProps={DEFAULT_PROPS}
      />
      <Composition
        id="OpeningTheAlbum"
        component={Template15OpeningAlbum}
        durationInFrames={330}
        fps={30}
        width={1080}
        height={1920}
        schema={AdReelSchema}
        defaultProps={DEFAULT_PROPS}
      />
      <Composition
        id="FaceToFace"
        component={Template16FaceToFace}
        durationInFrames={270}
        fps={30}
        width={1080}
        height={1920}
        schema={AdReelSchema}
        defaultProps={DEFAULT_PROPS}
      />
      <Composition
        id="TripleRestore"
        component={Template17TripleRestore}
        durationInFrames={330}
        fps={30}
        width={1080}
        height={1920}
        schema={AdReelSchema}
        defaultProps={DEFAULT_PROPS}
      />
      <Composition
        id="PassageOfTime"
        component={Template18PassageOfTime}
        durationInFrames={360}
        fps={30}
        width={1080}
        height={1920}
        schema={AdReelSchema}
        defaultProps={DEFAULT_PROPS}
      />
    </Folder>
  </>
);
