import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { AdLogo } from "../components/AdLogo";
import { AdPhoto } from "../components/AdPhoto";
import { AdCta } from "../components/AdCta";
import { seededRandom } from "../helpers";
import type { AdReelProps } from "../schema";

const PARTICLES = Array.from({ length: 20 }, (_, index) => ({
  x: 10 + seededRandom(index * 9 + 18) * 80,
  y: 60 + seededRandom(index * 11 + 22) * 30,
  size: 3 + seededRandom(index * 13 + 31) * 5,
  vx: (seededRandom(index * 17 + 7) - 0.5) * 0.8,
  vy: -0.6 - seededRandom(index * 19 + 9) * 0.8,
  phase: seededRandom(index * 21 + 3) * Math.PI * 2,
  color: ["rgba(197,160,89,0.6)", "rgba(212,168,75,0.5)", "rgba(245,240,224,0.4)"][index % 3],
}));

export const Template16FaceToFace: React.FC<AdReelProps> = ({
  copy,
  designTokens: dt,
  assets,
  brandContext,
}) => {
  const frame = useCurrentFrame();
  const sliver = interpolate(frame, [15, 50], [45, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const blurPx = interpolate(frame, [15, 50], [20, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const scale = interpolate(frame, [70, 120], [1.5, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const logoOpacity = interpolate(frame, [110, 150], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const supportOpacity = interpolate(frame, [170, 210], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const ctaOpacity = interpolate(frame, [200, 240], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const vignetteOpacity = interpolate(frame, [240, 270], [0, 0.6], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const highlightIndex = copy.highlight ? copy.headline.toLowerCase().indexOf(copy.highlight.toLowerCase()) : -1;

  return (
    <AbsoluteFill style={{ background: "#000", color: "#F5F0E0", fontFamily: "Playfair Display, serif" }}>
      <div style={{ position: "absolute", inset: 0, clipPath: `inset(${sliver}% 0 ${sliver}% 0)`, filter: `blur(${blurPx}px)`, transform: `scale(${scale})`, transformOrigin: "center center", opacity: frame < 15 ? interpolate(frame, [0, 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1 }}>
        <AdPhoto photoUrl={assets.afterPhotoUrl} fallbackGradient={`linear-gradient(135deg, ${dt.surface}, ${dt.gradient_to})`} style={{ width: "100%", height: "100%" }} />
      </div>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 50%, transparent 45%, rgba(0,0,0,0.7) 100%)", opacity: vignetteOpacity }} />

      {PARTICLES.map((particle, index) => {
        const activeFrame = Math.max(0, frame - 240);
        const x = particle.x + particle.vx * activeFrame + Math.sin(activeFrame * 0.06 + particle.phase) * 0.8;
        const y = particle.y + particle.vy * activeFrame;
        const opacity = activeFrame > 0 ? Math.max(0, Math.min(1, activeFrame / 15)) * 0.7 : 0;
        return (
          <div
            key={index}
            style={{
              position: "absolute",
              left: `${x}%`,
              top: `${y}%`,
              width: particle.size,
              height: particle.size,
              borderRadius: "50%",
              background: particle.color,
              opacity: y < 5 ? opacity * Math.max(y / 5, 0) : opacity,
            }}
          />
        );
      })}

      <div style={{ position: "absolute", top: 38, left: "50%", transform: "translateX(-50%)", opacity: logoOpacity }}>
        <AdLogo logoUrl={assets.logoUrl} brandName={brandContext.brandName} maxHeight={18} style={{ filter: "drop-shadow(0 0 3px rgba(197,160,89,0.4)) brightness(0.85)" }} color="rgba(197,160,89,0.7)" />
      </div>

      <div style={{ position: "absolute", left: 60, right: 60, bottom: 228, fontSize: 54, fontWeight: 800, lineHeight: 1.42, textAlign: "center" }}>
        {copy.headline.split(" ").map((word, index) => (
          <span
            key={`${word}-${index}`}
            style={{
              opacity: interpolate(frame, [140 + index * 10, 156 + index * 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
              color: highlightIndex >= 0 && word.toLowerCase().includes(copy.highlight.toLowerCase().split(" ")[0]) ? "#D4A84B" : "#F5F0E0",
              marginRight: 8,
            }}
          >
            {word}
          </span>
        ))}
        {highlightIndex >= 0 ? (
          <div style={{ marginTop: 8, opacity: interpolate(frame, [163, 168], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
            <div style={{ width: `${interpolate(frame, [165, 190], [0, 260], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}px`, height: 3, margin: "0 auto", borderRadius: 999, background: "linear-gradient(90deg, transparent, #D4A84B, transparent)" }} />
          </div>
        ) : null}
      </div>

      <div style={{ position: "absolute", left: 80, right: 80, bottom: 136, fontSize: 28, lineHeight: 1.6, textAlign: "center", color: "rgba(245,240,224,0.7)", opacity: supportOpacity }}>
        {copy.support}
      </div>

      <div style={{ position: "absolute", left: 60, right: 60, bottom: 66, opacity: ctaOpacity }}>
        <AdCta text={copy.cta} bgColor={dt.cta_bg} textColor={dt.cta_text} borderRadius={12} />
      </div>
    </AbsoluteFill>
  );
};
