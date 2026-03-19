import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { AdLogo } from "../components/AdLogo";
import { AdPhoto } from "../components/AdPhoto";
import { AdBadge } from "../components/AdBadge";
import { AdCta } from "../components/AdCta";
import { seededRandom } from "../helpers";
import type { AdReelProps } from "../schema";

const SPARKS = Array.from({ length: 20 }, (_, index) => ({
  x: seededRandom(index * 11 + 99) * 100,
  y: (seededRandom(index * 13 + 7) - 0.5) * 20,
  size: seededRandom(index * 3 + 17) * 6 + 2,
}));

export const Template11ThroughGenerations: React.FC<AdReelProps> = ({
  copy,
  designTokens: dt,
  assets,
  brandContext,
}) => {
  const frame = useCurrentFrame();
  const leftOpacity = interpolate(frame, [20, 60], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const rightOpacity = interpolate(frame, [50, 90], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const bridgeWidth = interpolate(frame, [80, 130], [0, 156], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const logoOpacity = interpolate(frame, [120, 150], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const badgeOpacity = interpolate(frame, [120, 160], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const drift = interpolate(frame, [150, 200], [0, 26], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const headlineOpacity = interpolate(frame, [190, 240], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const supportOpacity = interpolate(frame, [230, 270], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const ctaOpacity = interpolate(frame, [260, 300], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const bridgePulse = frame >= 300 ? 1 + Math.sin((frame - 300) * 0.18) * 0.15 : 1;
  const leftPhoto = assets.beforePhotoUrl || assets.afterPhotoUrl;
  const rightPhoto = assets.afterPhotoUrl;

  return (
    <AbsoluteFill style={{ fontFamily: "Playfair Display, serif", color: "#efe7db", background: "radial-gradient(ellipse at 50% 40%, #1e1105 0%, #0d0802 60%, #050302 100%)" }}>
      <div style={{ position: "absolute", top: 72, left: 48, width: 410, height: 620, borderRadius: 24, border: `3px solid rgba(197,160,89,${interpolate(frame, [0, 30], [0, 0.45], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })})`, transform: `translateX(${drift}px)` }} />
      <div style={{ position: "absolute", top: 72, right: 48, width: 410, height: 620, borderRadius: 24, border: `3px solid rgba(197,160,89,${interpolate(frame, [0, 30], [0, 0.45], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })})`, transform: `translateX(${-drift}px)` }} />

      <div style={{ position: "absolute", top: 72, left: 48 + drift, width: 410, height: 620, opacity: leftOpacity }}>
        <AdPhoto
          photoUrl={leftPhoto}
          fallbackGradient="linear-gradient(135deg, #3a2510, #1e1008)"
          style={{ width: "100%", height: "100%", borderRadius: 24 }}
          imgStyle={{ filter: "sepia(0.75) blur(1.5px) brightness(0.85)" }}
        />
      </div>
      <div style={{ position: "absolute", top: 72, right: 48 - drift, width: 410, height: 620, opacity: rightOpacity }}>
        <AdPhoto photoUrl={rightPhoto} fallbackGradient={`linear-gradient(135deg, ${dt.gradient_from}, ${dt.gradient_to})`} style={{ width: "100%", height: "100%", borderRadius: 24 }} />
      </div>

      <div style={{ position: "absolute", top: 720, left: 48 + drift, width: 410, textAlign: "center", fontSize: 24, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(197,160,89,0.7)", opacity: interpolate(frame, [40, 70], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
        Then
      </div>
      <div style={{ position: "absolute", top: 720, right: 48 - drift, width: 410, textAlign: "center", fontSize: 24, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(197,160,89,0.7)", opacity: interpolate(frame, [70, 100], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
        Now
      </div>

      <div style={{ position: "absolute", top: 360, left: 462 + drift, width: 156, height: 12, opacity: interpolate(frame, [80, 105], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
        <div style={{ width: bridgeWidth * bridgePulse, height: 12, borderRadius: 999, background: "linear-gradient(90deg, rgba(197,160,89,0.15), rgba(255,220,120,0.9), rgba(197,160,89,0.15))", boxShadow: "0 0 14px rgba(197,160,89,0.45)" }} />
        {SPARKS.map((spark, index) => (
          <div
            key={index}
            style={{
              position: "absolute",
              left: (spark.x / 100) * Math.max(bridgeWidth, 1),
              top: 6 + spark.y + Math.sin(frame * 0.06 + index) * 4,
              width: spark.size,
              height: spark.size,
              borderRadius: "50%",
              background: "#fff",
              opacity: frame >= 80 ? 0.35 + Math.sin(frame * 0.08 + index) * 0.25 : 0,
            }}
          />
        ))}
      </div>

      <div style={{ position: "absolute", top: 30, left: "50%", transform: "translateX(-50%)", opacity: logoOpacity }}>
        <AdLogo logoUrl={assets.logoUrl} brandName={brandContext.brandName} maxHeight={28} style={{ filter: "drop-shadow(0 1px 6px rgba(0,0,0,0.6))" }} />
      </div>
      <div style={{ position: "absolute", top: 790, left: "50%", transform: "translateX(-50%)", opacity: badgeOpacity }}>
        <AdBadge text={copy.badge} bgColor={dt.badge_bg} textColor={dt.badge_text} style={{ borderRadius: 999, padding: "8px 22px" }} fontSize={20} />
      </div>
      <div style={{ position: "absolute", top: 870, left: 74, right: 74, fontSize: 58, lineHeight: 1.24, fontWeight: 700, textAlign: "center", opacity: headlineOpacity }}>
        {copy.headline.split(" ").map((word, index) => {
          const match = copy.highlight && word.replace(/[.,!?]/g, "").toLowerCase() === copy.highlight.replace(/[.,!?]/g, "").toLowerCase();
          return (
            <span key={`${word}-${index}`} style={{ color: match ? "#C5A059" : "#efe7db", textShadow: match ? "0 0 10px rgba(197,160,89,0.5)" : "none", marginRight: 8 }}>
              {word}
            </span>
          );
        })}
      </div>
      <div style={{ position: "absolute", top: 1042, left: 88, right: 88, fontSize: 34, lineHeight: 1.6, textAlign: "center", color: "rgba(239,231,219,0.65)", opacity: supportOpacity }}>
        {copy.support}
      </div>
      <div style={{ position: "absolute", left: 60, right: 60, bottom: 84, opacity: ctaOpacity, transform: `translateY(${interpolate(frame, [260, 300], [8, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}px)` }}>
        <AdCta text={copy.cta} bgColor={dt.cta_bg} textColor={dt.cta_text} borderRadius={999} style={{ boxShadow: "0 4px 24px rgba(197,160,89,0.25)" }} />
      </div>
    </AbsoluteFill>
  );
};
