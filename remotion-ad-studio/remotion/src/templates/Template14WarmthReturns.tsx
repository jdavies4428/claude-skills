import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { AdPhoto } from "../components/AdPhoto";
import { AdLogo } from "../components/AdLogo";
import { AdBadge } from "../components/AdBadge";
import { AdCta } from "../components/AdCta";
import type { AdReelProps } from "../schema";

export const Template14WarmthReturns: React.FC<AdReelProps> = ({
  copy,
  designTokens: dt,
  assets,
  brandContext,
}) => {
  const frame = useCurrentFrame();
  const colorProgress = interpolate(frame, [30, 90], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const glowPulse = frame < 100
    ? 0
    : frame < 130
      ? interpolate(frame, [100, 130], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
      : frame >= 270
        ? Math.sin((frame - 270) * 0.18) * 0.02 + 0.03
        : 0;
  const logoOpacity = interpolate(frame, [110, 150], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const supportOpacity = interpolate(frame, [170, 210], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const badgeOpacity = interpolate(frame, [200, 240], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const ctaOpacity = interpolate(frame, [230, 270], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "linear-gradient(180deg,#1a1208 0%,#2a1e10 100%)", fontFamily: "Playfair Display, serif", color: "#F5F0E0" }}>
      <div style={{ position: "absolute", top: 150, left: 60, right: 60, height: 720 }}>
        <div
          style={{
            position: "absolute",
            inset: -10,
            borderRadius: 30,
            boxShadow: `0 0 ${glowPulse * 420}px rgba(197,160,89,${glowPulse * 8})`,
          }}
        />
        <div style={{ position: "absolute", inset: 0, borderRadius: 26, border: `4px solid rgba(212,168,75,${interpolate(frame, [80, 120], [0.3, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })})` }} />
        <AdPhoto
          photoUrl={assets.afterPhotoUrl}
          fallbackGradient={`linear-gradient(135deg, ${dt.gradient_from}, ${dt.gradient_to})`}
          style={{ width: "100%", height: "100%", borderRadius: 24 }}
          imgStyle={{
            filter: `grayscale(${1 - colorProgress}) sepia(${(1 - colorProgress) * 0.3})`,
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 24,
            background: `radial-gradient(circle at 50% 50%, rgba(212,168,75,${0.3 * colorProgress}) 0%, rgba(212,168,75,${0.18 * colorProgress}) 18%, rgba(212,168,75,0) 56%)`,
            mixBlendMode: "screen",
            opacity: colorProgress,
          }}
        />
      </div>

      <div style={{ position: "absolute", top: 1540, left: "50%", transform: "translateX(-50%)", opacity: logoOpacity }}>
        <AdLogo logoUrl={assets.logoUrl} brandName={brandContext.brandName} maxHeight={24} style={{ filter: "drop-shadow(0 0 4px rgba(197,160,89,0.6))" }} color="#C5A059" />
      </div>

      <div style={{ position: "absolute", top: 922, left: 68, right: 68, fontSize: 54, lineHeight: 1.28, fontWeight: 800, textAlign: "center" }}>
        {copy.headline.split(" ").map((word, index) => {
          const start = 140 + index * 12;
          const highlighted = copy.highlight && word.toLowerCase().includes(copy.highlight.toLowerCase().split(" ")[0]);
          return (
            <span key={`${word}-${index}`} style={{ opacity: interpolate(frame, [start, start + 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), marginRight: 8 }}>
              {highlighted ? <span style={{ background: "rgba(212,168,75,0.25)", color: "#D4A84B", borderRadius: 8, padding: "0 6px" }}>{word}</span> : word}
            </span>
          );
        })}
      </div>

      <div style={{ position: "absolute", top: 1095, left: 82, right: 82, fontSize: 28, lineHeight: 1.6, textAlign: "center", color: "rgba(245,240,224,0.7)", opacity: supportOpacity }}>
        {copy.support}
      </div>

      <div style={{ position: "absolute", top: 1190, left: "50%", transform: "translateX(-50%)", opacity: badgeOpacity }}>
        <AdBadge text={copy.badge} bgColor="rgba(197,160,89,0.2)" textColor="#D4A84B" style={{ borderRadius: 999, border: "1px solid rgba(197,160,89,0.5)", boxShadow: "none", padding: "8px 22px" }} fontSize={18} />
      </div>

      <div style={{ position: "absolute", left: 60, right: 60, bottom: 68, opacity: ctaOpacity }}>
        <AdCta text={copy.cta} bgColor={dt.cta_bg} textColor={dt.cta_text} borderRadius={12} />
      </div>
    </AbsoluteFill>
  );
};
