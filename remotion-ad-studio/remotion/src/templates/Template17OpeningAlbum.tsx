import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { AdLogo } from "../components/AdLogo";
import { AdPhoto } from "../components/AdPhoto";
import { AdCta } from "../components/AdCta";
import type { AdReelProps } from "../schema";

export const Template17OpeningAlbum: React.FC<AdReelProps> = ({
  copy,
  designTokens: dt,
  assets,
  brandContext,
}) => {
  const frame = useCurrentFrame();
  const openProgress = interpolate(frame, [20, 60], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const coverOpacity = frame > 70 ? interpolate(frame, [70, 85], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1;
  const photoSlide = interpolate(frame, [80, 130], [100, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const photoOpacity = interpolate(frame, [80, 110], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const logoOpacity = interpolate(frame, [75, 110], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const supportOpacity = interpolate(frame, [150, 190], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const badgeOpacity = interpolate(frame, [180, 220], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const ctaOpacity = interpolate(frame, [250, 290], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const zoom = frame >= 210 ? interpolate(frame, [210, 260], [1, 1.05], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1;
  const breathe = frame >= 290 ? Math.sin((frame - 290) * 0.15) * 0.5 : 0;

  return (
    <AbsoluteFill style={{ background: "#F0E8D6", overflow: "hidden", fontFamily: "Playfair Display, serif", color: "#4a3018" }}>
      <div style={{ position: "absolute", inset: 0, background: "repeating-radial-gradient(circle at 2px 2px, rgba(0,0,0,0.025) 1px, transparent 1px) 0 0 / 6px 6px" }} />
      <div style={{ position: "absolute", inset: 16, border: "2px solid rgba(139,111,71,0.25)", borderRadius: 10 }} />

      <div style={{ position: "absolute", inset: 0, transform: `scale(${zoom}) translateY(${breathe}px)`, transformOrigin: "center 45%" }}>
        <div style={{ position: "absolute", top: 1510, left: "50%", transform: "translateX(-50%)", opacity: logoOpacity }}>
          <AdLogo logoUrl={assets.logoUrl} brandName={brandContext.brandName} maxHeight={20} style={{ filter: "sepia(0.5) saturate(0.7) brightness(0.6)" }} color="#8B6F47" />
        </div>

        <div style={{ position: "absolute", top: 124, left: 68, right: 68, height: 750, opacity: photoOpacity, transform: `translateX(${photoSlide}%)` }}>
          <AdPhoto photoUrl={assets.afterPhotoUrl} fallbackGradient={`linear-gradient(135deg, ${dt.surface}, ${dt.gradient_to})`} style={{ width: "100%", height: "100%", borderRadius: 4 }} />
        </div>

        {[
          { top: 110, left: 56, sides: { borderTop: true, borderLeft: true } },
          { top: 110, right: 56, sides: { borderTop: true, borderRight: true } },
          { top: 854, left: 56, sides: { borderBottom: true, borderLeft: true } },
          { top: 854, right: 56, sides: { borderBottom: true, borderRight: true } },
        ].map((corner, index) => {
          const delay = [0, 6, 10, 16][index];
          const opacity = interpolate(frame, [50 + delay, 70 + delay], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const scale = interpolate(frame, [50 + delay, 70 + delay], [0.7, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <div
              key={index}
              style={{
                position: "absolute",
                ...corner,
                width: 34,
                height: 34,
                borderTop: corner.sides.borderTop ? "4px solid #8B6F47" : undefined,
                borderRight: corner.sides.borderRight ? "4px solid #8B6F47" : undefined,
                borderBottom: corner.sides.borderBottom ? "4px solid #8B6F47" : undefined,
                borderLeft: corner.sides.borderLeft ? "4px solid #8B6F47" : undefined,
                opacity,
                transform: `scale(${scale})`,
              }}
            />
          );
        })}

        <div style={{ position: "absolute", top: 948, left: 70, right: 70, fontSize: 52, fontStyle: "italic", fontWeight: 700, lineHeight: 1.45, textAlign: "center" }}>
          {copy.headline.split(" ").map((word, index) => (
            <span
              key={`${word}-${index}`}
              style={{
                opacity: interpolate(frame, [120 + index * 10, 136 + index * 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
              }}
            >
              {word}
              {index < copy.headline.split(" ").length - 1 ? " " : ""}
            </span>
          ))}
        </div>

        <div style={{ position: "absolute", top: 1134, left: 86, right: 86, fontSize: 24, fontStyle: "italic", lineHeight: 1.7, textAlign: "center", color: "rgba(74,48,24,0.65)", opacity: supportOpacity }}>
          {copy.support}
        </div>

        <div style={{ position: "absolute", top: 1240, left: "50%", transform: "translateX(-50%) rotate(-2deg)", opacity: badgeOpacity, padding: "8px 24px", background: "rgba(197,160,89,0.2)", border: "2px solid rgba(139,111,71,0.5)", borderRadius: 8, fontSize: 18, fontWeight: 700, color: "#8B6F47", letterSpacing: "0.05em" }}>
          {copy.badge}
        </div>
      </div>

      <div style={{ position: "absolute", inset: 0, perspective: 700, transformStyle: "preserve-3d", pointerEvents: "none" }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: coverOpacity,
            background: "linear-gradient(135deg,#2c1f0e 0%,#4a3018 40%,#2c1f0e 100%)",
            transformOrigin: "left center",
            transform: `rotateY(${interpolate(openProgress, [0, 1], [0, -90])}deg)`,
          }}
        >
          <div style={{ position: "absolute", inset: 0, background: "repeating-radial-gradient(circle at 1px 1px, rgba(255,255,255,0.03) 1px, transparent 1px) 0 0 / 4px 4px" }} />
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24 }}>
            <div style={{ fontSize: 20, letterSpacing: "0.25em", color: "rgba(197,160,89,0.7)", textTransform: "uppercase", fontWeight: 600 }}>Family Album</div>
            <div style={{ width: 120, height: 2, background: "rgba(197,160,89,0.4)" }} />
            <div style={{ fontSize: 18, letterSpacing: "0.15em", color: "rgba(197,160,89,0.5)", textTransform: "uppercase" }}>{brandContext.brandName}</div>
          </div>
        </div>
      </div>

      <div style={{ position: "absolute", left: 60, right: 60, bottom: 68, opacity: ctaOpacity }}>
        <AdCta text={copy.cta} bgColor={dt.cta_bg} textColor={dt.cta_text} borderRadius={12} />
      </div>
    </AbsoluteFill>
  );
};
