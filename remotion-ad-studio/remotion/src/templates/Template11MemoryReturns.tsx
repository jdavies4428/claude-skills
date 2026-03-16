import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { AdBackground } from "../components/AdBackground";
import { AdLogo } from "../components/AdLogo";
import { AdPhoto } from "../components/AdPhoto";
import { AdBadge } from "../components/AdBadge";
import { AdCta } from "../components/AdCta";
import { splitHighlight, seededRandom } from "../helpers";
import type { AdReelProps } from "../schema";

const DUST = Array.from({ length: 35 }, (_, index) => ({
  x: seededRandom(index * 11 + 1) * 900 + 90,
  y: seededRandom(index * 17 + 2) * 220 - 80,
  size: seededRandom(index * 5 + 3) * 6 + 2,
  speed: seededRandom(index * 19 + 4) * 2.5 + 1.2,
  opacity: seededRandom(index * 23 + 5) * 0.45 + 0.2,
}));

export const Template11MemoryReturns: React.FC<AdReelProps> = ({
  copy,
  designTokens: dt,
  assets,
  brandContext,
}) => {
  const frame = useCurrentFrame();
  const photoOpacity = interpolate(frame, [20, 45], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const blurPx = interpolate(frame, [20, 60], [20, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const glowSize = interpolate(frame, [50, 90], [0, 40], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const logoOpacity = interpolate(frame, [80, 110], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const badgeScale = interpolate(frame, [140, 170], [0.9, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const badgeOpacity = interpolate(frame, [140, 158], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const supportOpacity = interpolate(frame, [170, 210], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const ctaOpacity = interpolate(frame, [210, 245], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const ctaY = interpolate(frame, [210, 250], [10, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const vignetteOpacity = interpolate(frame, [260, 300], [0, 0.55], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const segments = splitHighlight(copy.headline, copy.highlight);

  return (
    <AbsoluteFill style={{ fontFamily: "Georgia, serif", color: "#efe7db" }}>
      <AdBackground gradientFrom="#150d05" gradientTo="#0a0603" angle="180deg" />
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 35%, rgba(42,26,10,0.95) 0%, transparent 55%)" }} />
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 40%, transparent 32%, rgba(0,0,0,0.85) 100%)", opacity: vignetteOpacity }} />

      {DUST.map((particle, index) => {
        const fadeStart = 50 + (index % 5) * 8;
        const fadeOut = index % 3 === 0
          ? interpolate(frame, [fadeStart, fadeStart + 30], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
          : 1;
        return (
          <div
            key={index}
            style={{
              position: "absolute",
              left: particle.x,
              top: ((particle.y + frame * particle.speed) % 640) - 20,
              width: particle.size,
              height: particle.size,
              borderRadius: "50%",
              background: "#C5A059",
              opacity: interpolate(frame, [0, 10], [0, particle.opacity], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) * fadeOut,
            }}
          />
        );
      })}

      <div style={{ position: "absolute", top: 32, left: 56, right: 56, height: 700, opacity: photoOpacity }}>
        <div
          style={{
            position: "absolute",
            inset: -12,
            borderRadius: 30,
            boxShadow: `0 0 ${glowSize}px rgba(197,160,89,${glowSize / 90})`,
          }}
        />
        <AdPhoto
          photoUrl={assets.afterPhotoUrl}
          fallbackGradient={`linear-gradient(135deg, ${dt.gradient_from}, ${dt.gradient_to})`}
          style={{
            width: "100%",
            height: "100%",
            borderRadius: 24,
          }}
          imgStyle={{
            filter: `blur(${blurPx}px)`,
          }}
        />
      </div>

      <div style={{ position: "absolute", top: 28, left: "50%", transform: "translateX(-50%)", opacity: logoOpacity }}>
        <AdLogo logoUrl={assets.logoUrl} brandName={brandContext.brandName} maxHeight={30} style={{ filter: "drop-shadow(0 1px 6px rgba(0,0,0,0.6))" }} />
      </div>

      <div style={{ position: "absolute", top: 780, left: 56, right: 56, fontSize: 62, fontWeight: 700, lineHeight: 1.16, textAlign: "center" }}>
        {segments.map((segment, index) => {
          const wordStart = 110 + index * 10;
          const opacity = interpolate(frame, [wordStart, wordStart + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <span
              key={`${segment.text}-${index}`}
              style={{
                color: segment.isHighlight ? "#C5A059" : "#efe7db",
                opacity,
                position: "relative",
                display: "inline",
                marginRight: 8,
              }}
            >
              {segment.text}
            </span>
          );
        })}
        {copy.highlight ? (
          <div style={{ marginTop: 10, opacity: interpolate(frame, [137, 143], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
            <div
              style={{
                margin: "0 auto",
                width: `${interpolate(frame, [138, 168], [0, 240], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}px`,
                height: 5,
                borderRadius: 999,
                background: "#C5A059",
              }}
            />
          </div>
        ) : null}
      </div>

      <div style={{ position: "absolute", top: 1040, left: "50%", transform: `translateX(-50%) scale(${badgeScale})`, opacity: badgeOpacity }}>
        <AdBadge text={copy.badge} bgColor={dt.badge_bg} textColor={dt.badge_text} style={{ borderRadius: 999, padding: "8px 24px" }} fontSize={22} />
      </div>

      <div style={{ position: "absolute", top: 1120, left: 70, right: 70, fontSize: 34, lineHeight: 1.55, textAlign: "center", color: "rgba(239,231,219,0.72)", opacity: supportOpacity }}>
        {copy.support}
      </div>

      <div style={{ position: "absolute", left: 60, right: 60, bottom: 84, opacity: ctaOpacity, transform: `translateY(${ctaY}px)` }}>
        <AdCta text={copy.cta} bgColor={dt.cta_bg} textColor={dt.cta_text} borderRadius={999} style={{ boxShadow: "0 4px 24px rgba(197,160,89,0.3)" }} />
      </div>
    </AbsoluteFill>
  );
};
