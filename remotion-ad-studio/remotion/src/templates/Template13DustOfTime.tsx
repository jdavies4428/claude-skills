import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { AdPhoto } from "../components/AdPhoto";
import { AdLogo } from "../components/AdLogo";
import { AdBadge } from "../components/AdBadge";
import { AdCta } from "../components/AdCta";
import { seededRandom } from "../helpers";
import type { AdReelProps } from "../schema";

const PARTICLES = Array.from({ length: 54 }, (_, index) => ({
  x: seededRandom(index * 17 + 11) * 980 + 40,
  y: seededRandom(index * 23 + 7) * 900 + 400,
  size: seededRandom(index * 29 + 13) * 10 + 4,
  speed: seededRandom(index * 31 + 5) * 3 + 1.4,
  opacity: seededRandom(index * 37 + 3) * 0.5 + 0.15,
}));

export const Template13DustOfTime: React.FC<AdReelProps> = ({
  copy,
  designTokens: dt,
  assets,
  brandContext,
}) => {
  const frame = useCurrentFrame();
  const revealOpacity = interpolate(frame, [20, 70], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const glowOpacity = interpolate(frame, [60, 100], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const logoOpacity = interpolate(frame, [90, 130], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const badgeOpacity = interpolate(frame, [150, 190], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const supportOpacity = interpolate(frame, [180, 220], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const ctaOpacity = interpolate(frame, [210, 260], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 35%, #2a1a0a 0%, #120902 60%, #080401 100%)", fontFamily: "Playfair Display, serif", color: "#efe7db" }}>
      <div style={{ position: "absolute", top: 140, left: 72, right: 72, height: 710, opacity: revealOpacity }}>
        <div style={{ position: "absolute", inset: -12, borderRadius: 28, boxShadow: `0 0 46px rgba(197,160,89,${glowOpacity * 0.45})`, opacity: glowOpacity }} />
        <AdPhoto photoUrl={assets.afterPhotoUrl} fallbackGradient={`linear-gradient(135deg, ${dt.gradient_from}, ${dt.gradient_to})`} style={{ width: "100%", height: "100%", borderRadius: 24 }} />
      </div>

      {PARTICLES.map((particle, index) => {
        const currentY = particle.y - frame * particle.speed;
        const opacity = currentY < 120 ? particle.opacity * Math.max(currentY / 120, 0) : particle.opacity;
        return (
          <div
            key={index}
            style={{
              position: "absolute",
              left: particle.x,
              top: ((currentY % 1500) + 1500) % 1500,
              width: particle.size,
              height: particle.size,
              borderRadius: "50%",
              background: index % 3 === 0 ? "#F5F0E0" : "#C5A059",
              opacity,
              filter: "blur(0.4px)",
            }}
          />
        );
      })}

      <div style={{ position: "absolute", bottom: 268, left: "50%", transform: "translateX(-50%)", opacity: logoOpacity }}>
        <AdLogo logoUrl={assets.logoUrl} brandName={brandContext.brandName} maxHeight={30} style={{ filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.55))" }} />
      </div>
      <div style={{ position: "absolute", top: 920, left: 70, right: 70, fontSize: 58, lineHeight: 1.26, fontWeight: 700, textAlign: "center" }}>
        {copy.headline.split(" ").map((word, index) => {
          const start = 120 + index * 10;
          const highlighted = copy.highlight && word.toLowerCase().includes(copy.highlight.toLowerCase().split(" ")[0]);
          return (
            <span
              key={`${word}-${index}`}
              style={{
                opacity: interpolate(frame, [start, start + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
                color: highlighted ? "#C5A059" : "#efe7db",
                textShadow: highlighted ? "0 0 16px rgba(197,160,89,0.45)" : "none",
                marginRight: 8,
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
      <div style={{ position: "absolute", top: 1110, left: "50%", transform: "translateX(-50%)", opacity: badgeOpacity }}>
        <AdBadge text={copy.badge} bgColor={dt.badge_bg} textColor={dt.badge_text} style={{ borderRadius: 999, padding: "8px 22px" }} fontSize={18} />
      </div>
      <div style={{ position: "absolute", left: 92, right: 92, bottom: 176, fontSize: 30, lineHeight: 1.55, textAlign: "center", fontStyle: "italic", color: "rgba(239,231,219,0.78)", opacity: supportOpacity }}>
        {copy.support}
      </div>
      <div style={{ position: "absolute", left: 60, right: 60, bottom: 70, opacity: ctaOpacity }}>
        <AdCta text={copy.cta} bgColor={dt.cta_bg} textColor={dt.cta_text} borderRadius={12} />
      </div>
    </AbsoluteFill>
  );
};
