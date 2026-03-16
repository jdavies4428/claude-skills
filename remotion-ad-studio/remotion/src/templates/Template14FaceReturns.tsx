import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { AdLogo } from "../components/AdLogo";
import { AdPhoto } from "../components/AdPhoto";
import { AdBadge } from "../components/AdBadge";
import { AdCta } from "../components/AdCta";
import { splitHighlight } from "../helpers";
import type { AdReelProps } from "../schema";

export const Template14FaceReturns: React.FC<AdReelProps> = ({
  copy,
  designTokens: dt,
  assets,
  brandContext,
}) => {
  const frame = useCurrentFrame();
  const lightOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const photoOpacity = interpolate(frame, [15, 50], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const blurPx = interpolate(frame, [40, 100], [30, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const photoScale = frame < 280
    ? interpolate(frame, [40, 100], [1.3, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : interpolate(frame, [280, 300], [1, 0.98], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const logoOpacity = interpolate(frame, [120, 160], [0, 0.9], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const supportOpacity = interpolate(frame, [180, 220], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const badgeOpacity = interpolate(frame, [210, 250], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const ctaOpacity = interpolate(frame, [240, 280], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const segments = splitHighlight(copy.headline, copy.highlight);

  return (
    <AbsoluteFill style={{ background: "#000", color: "#F5F0E0", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <div
        style={{
          position: "absolute",
          top: 140,
          left: "50%",
          transform: "translateX(-50%)",
          width: 120,
          height: 120,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(197,160,89,0.95) 0%, rgba(197,160,89,0.1) 55%, transparent 75%)",
          opacity: lightOpacity,
        }}
      />
      <div style={{ position: "absolute", inset: 0, opacity: photoOpacity, transform: `scale(${photoScale})`, transformOrigin: "center center" }}>
        <AdPhoto
          photoUrl={assets.afterPhotoUrl}
          fallbackGradient={`linear-gradient(135deg, ${dt.gradient_from}, ${dt.gradient_to})`}
          style={{ width: "100%", height: "100%" }}
          imgStyle={{ filter: `blur(${blurPx}px)` }}
        />
      </div>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 50%, transparent 45%, rgba(0,0,0,0.78) 100%)", opacity: interpolate(frame, [280, 300], [0.2, 0.6], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }} />

      <div style={{ position: "absolute", top: 34, left: "50%", transform: "translateX(-50%)", opacity: logoOpacity }}>
        <AdLogo logoUrl={assets.logoUrl} brandName={brandContext.brandName} maxHeight={22} style={{ filter: "drop-shadow(0 0 3px rgba(197,160,89,0.4)) brightness(0.9)" }} color="rgba(197,160,89,0.7)" />
      </div>

      <div style={{ position: "absolute", top: 54, left: 34, opacity: badgeOpacity }}>
        <AdBadge text={copy.badge} bgColor="rgba(197,160,89,0.18)" textColor="#D4A84B" style={{ borderRadius: 999, border: "1px solid rgba(197,160,89,0.45)", boxShadow: "none" }} fontSize={16} />
      </div>

      <div style={{ position: "absolute", left: 60, right: 60, bottom: 258, fontSize: 56, fontWeight: 800, lineHeight: 1.18, textAlign: "center" }}>
        {segments.map((segment, index) => {
          const start = 150 + index * 10;
          return (
            <span
              key={`${segment.text}-${index}`}
              style={{
                opacity: interpolate(frame, [start, start + 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
                color: segment.isHighlight ? "#D4A84B" : "#F5F0E0",
                textShadow: segment.isHighlight ? `0 0 ${interpolate(frame, [150, 190], [0, 18], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}px rgba(212,168,75,0.55)` : "none",
                marginRight: 8,
              }}
            >
              {segment.text}
            </span>
          );
        })}
      </div>

      <div style={{ position: "absolute", left: 88, right: 88, bottom: 178, fontSize: 30, lineHeight: 1.55, textAlign: "center", color: "rgba(245,240,224,0.72)", opacity: supportOpacity }}>
        {copy.support}
      </div>

      <div style={{ position: "absolute", left: 60, right: 60, bottom: 72, opacity: ctaOpacity }}>
        <AdCta text={copy.cta} bgColor={dt.cta_bg} textColor={dt.cta_text} borderRadius={12} style={{ boxShadow: "0 4px 22px rgba(0,0,0,0.45)" }} />
      </div>
    </AbsoluteFill>
  );
};
