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
import { Template9Film } from "./templates/Template9Film";
import { Template11MemoryReturns } from "./templates/Template11MemoryReturns";
import { Template12LegacyUnlocked } from "./templates/Template12LegacyUnlocked";
import { Template13ThroughGenerations } from "./templates/Template13ThroughGenerations";
import { Template14FaceReturns } from "./templates/Template14FaceReturns";
import { Template15DustOfTime } from "./templates/Template15DustOfTime";
import { Template16WarmthReturns } from "./templates/Template16WarmthReturns";
import { Template17OpeningAlbum } from "./templates/Template17OpeningAlbum";
import { Template18FaceToFace } from "./templates/Template18FaceToFace";
import { Template19TripleRestore } from "./templates/Template19TripleRestore";
import { Template20PassageOfTime } from "./templates/Template20PassageOfTime";

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
        component={Template9Film}
        durationInFrames={270}
        fps={30}
        width={1080}
        height={1920}
        schema={AdReelSchema}
        defaultProps={DEFAULT_PROPS}
      />
      <Composition
        id="MemoryReturns"
        component={Template11MemoryReturns}
        durationInFrames={300}
        fps={30}
        width={1080}
        height={1920}
        schema={AdReelSchema}
        defaultProps={DEFAULT_PROPS}
      />
      <Composition
        id="LegacyUnlocked"
        component={Template12LegacyUnlocked}
        durationInFrames={270}
        fps={30}
        width={1080}
        height={1920}
        schema={AdReelSchema}
        defaultProps={DEFAULT_PROPS}
      />
      <Composition
        id="ThroughGenerations"
        component={Template13ThroughGenerations}
        durationInFrames={330}
        fps={30}
        width={1080}
        height={1920}
        schema={AdReelSchema}
        defaultProps={DEFAULT_PROPS}
      />
      <Composition
        id="FaceReturns"
        component={Template14FaceReturns}
        durationInFrames={300}
        fps={30}
        width={1080}
        height={1920}
        schema={AdReelSchema}
        defaultProps={DEFAULT_PROPS}
      />
      <Composition
        id="DustOfTime"
        component={Template15DustOfTime}
        durationInFrames={300}
        fps={30}
        width={1080}
        height={1920}
        schema={AdReelSchema}
        defaultProps={DEFAULT_PROPS}
      />
      <Composition
        id="WarmthReturns"
        component={Template16WarmthReturns}
        durationInFrames={300}
        fps={30}
        width={1080}
        height={1920}
        schema={AdReelSchema}
        defaultProps={DEFAULT_PROPS}
      />
      <Composition
        id="OpeningTheAlbum"
        component={Template17OpeningAlbum}
        durationInFrames={330}
        fps={30}
        width={1080}
        height={1920}
        schema={AdReelSchema}
        defaultProps={DEFAULT_PROPS}
      />
      <Composition
        id="FaceToFace"
        component={Template18FaceToFace}
        durationInFrames={270}
        fps={30}
        width={1080}
        height={1920}
        schema={AdReelSchema}
        defaultProps={DEFAULT_PROPS}
      />
      <Composition
        id="TripleRestore"
        component={Template19TripleRestore}
        durationInFrames={330}
        fps={30}
        width={1080}
        height={1920}
        schema={AdReelSchema}
        defaultProps={DEFAULT_PROPS}
      />
      <Composition
        id="PassageOfTime"
        component={Template20PassageOfTime}
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
