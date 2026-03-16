import React from "react";
import { Composition, Folder } from "remotion";
import { AdReelSchema, DEFAULT_PROPS } from "./schema";
import { Template1Polaroid } from "./templates/Template1Polaroid";
import { Template2Slider } from "./templates/Template2Slider";
import { Template3Kinetic } from "./templates/Template3Kinetic";
import { Template4Magazine } from "./templates/Template4Magazine";
import { Template5Glitch } from "./templates/Template5Glitch";
import { Template6Peel } from "./templates/Template6Peel";
import { Template7Blinds } from "./templates/Template7Blinds";
import { Template8Orbit } from "./templates/Template8Orbit";
import { Template9Film } from "./templates/Template9Film";
import { Template10Mosaic } from "./templates/Template10Mosaic";

export const RemotionRoot: React.FC = () => (
  <>
    <Folder name="Ad Reels">
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
        durationInFrames={240}
        fps={30}
        width={1080}
        height={1920}
        schema={AdReelSchema}
        defaultProps={DEFAULT_PROPS}
      />
      <Composition
        id="TheGlitch"
        component={Template5Glitch}
        durationInFrames={210}
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
        id="TheOrbit"
        component={Template8Orbit}
        durationInFrames={300}
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
        id="MosaicAssemble"
        component={Template10Mosaic}
        durationInFrames={270}
        fps={30}
        width={1080}
        height={1920}
        schema={AdReelSchema}
        defaultProps={DEFAULT_PROPS}
      />
    </Folder>
  </>
);
