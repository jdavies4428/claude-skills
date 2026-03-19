import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { AdLogo } from "../components/AdLogo";
import { AdPhoto } from "../components/AdPhoto";
import { AdCta } from "../components/AdCta";
import { seededRandom } from "../helpers";
import type { AdReelProps } from "../schema";

const FRAGMENTS = Array.from({ length: 8 }, (_, index) => ({
  angle: (index / 8) * Math.PI * 2,
  size: seededRandom(index * 13 + 17) * 16 + 10,
}));

export const Template12LegacyUnlocked: React.FC<AdReelProps> = ({
  copy,
  designTokens: dt,
  assets,
  brandContext,
}) => {
  const frame = useCurrentFrame();
  const frameOpacity = interpolate(frame, [0, 20], [0, 0.5], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const lockOpacity = frame < 40
    ? interpolate(frame, [15, 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : interpolate(frame, [40, 55], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const clipSize = interpolate(frame, [70, 120], [0, 150], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const logoOpacity = interpolate(frame, [110, 140], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const lineDraw = interpolate(frame, [120, 150], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const annotationOpacity = interpolate(frame, [170, 200], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const badgeOpacity = interpolate(frame, [190, 208], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const badgeScale = interpolate(frame, [190, 225], [0.5, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const badgeRotate = interpolate(frame, [190, 225], [18, -8], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const ctaOpacity = interpolate(frame, [220, 255], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ fontFamily: "Playfair Display, serif", color: "#efe7db", background: "radial-gradient(ellipse at 50% 45%, #251508 0%, #120a03 65%, #080401 100%)" }}>
      <div style={{ position: "absolute", inset: 40, border: `2px solid rgba(197,160,89,${frameOpacity})`, borderRadius: 18, boxShadow: `0 0 ${frameOpacity * 18}px rgba(197,160,89,${frameOpacity * 0.24})` }} />

      <div
        style={{
          position: "absolute",
          top: 170,
          left: 56,
          right: 56,
          height: 680,
          borderRadius: 24,
          overflow: "hidden",
          clipPath: `circle(${clipSize}% at 50% 50%)`,
        }}
      >
        <AdPhoto
          photoUrl={assets.afterPhotoUrl}
          fallbackGradient={`linear-gradient(135deg, ${dt.gradient_from}, ${dt.gradient_to})`}
          style={{ width: "100%", height: "100%" }}
        />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(20,10,2,0.3) 0%, transparent 40%, rgba(10,5,1,0.4) 100%)" }} />
      </div>

      <div style={{ position: "absolute", top: 320, left: "50%", transform: "translate(-50%, -50%)", opacity: lockOpacity }}>
        <div style={{ position: "relative", width: 160, height: 160 }}>
          <div style={{ width: 160, height: 160, borderRadius: "50%", border: "6px solid #C5A059", boxShadow: `0 0 ${Math.sin(frame * 0.35) * 8 + 12}px rgba(197,160,89,0.5)` }} />
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -26%)", width: 34, height: 58, background: "#C5A059", borderRadius: "17px 17px 4px 4px" }} />
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -12%)", width: 18, height: 18, background: "#120a03", borderRadius: "50%" }} />
        </div>
      </div>

      {FRAGMENTS.map((fragment, index) => {
        const localFrame = frame - 40 - index * 2;
        const distance = interpolate(localFrame, [0, 35], [0, 110], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const opacity = interpolate(localFrame, [0, 5, 30, 38], [0, 0.9, 0.7, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return (
          <div
            key={index}
            style={{
              position: "absolute",
              left: "50%",
              top: 320,
              width: fragment.size,
              height: fragment.size,
              background: "#C5A059",
              borderRadius: index % 2 === 0 ? "50%" : 4,
              transform: `translate(calc(-50% + ${Math.cos(fragment.angle) * distance}px), calc(-50% + ${Math.sin(fragment.angle) * distance}px))`,
              opacity,
            }}
          />
        );
      })}

      <div style={{ position: "absolute", top: 76, left: "50%", transform: "translateX(-50%)", opacity: logoOpacity }}>
        <AdLogo logoUrl={assets.logoUrl} brandName={brandContext.brandName} maxHeight={30} style={{ filter: "drop-shadow(0 1px 6px rgba(0,0,0,0.5))" }} />
      </div>

      <div style={{ position: "absolute", top: 144, left: "50%", transform: "translateX(-50%)", width: 260, height: 8, opacity: interpolate(frame, [118, 126], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
        <div style={{ position: "absolute", top: 3, left: 0, width: 260 * lineDraw, height: 2, background: "#C5A059" }} />
        <div style={{ position: "absolute", top: 0, left: 0, width: 8, height: 8, borderRadius: "50%", background: "#C5A059", opacity: interpolate(frame, [148, 155], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }} />
        <div style={{ position: "absolute", top: 0, right: 0, width: 8, height: 8, borderRadius: "50%", background: "#C5A059", opacity: interpolate(frame, [148, 155], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }} />
      </div>

      <div style={{ position: "absolute", top: 900, left: 60, right: 60, fontSize: 54, lineHeight: 1.42, fontWeight: 700, textAlign: "center" }}>
        {copy.headline.split("").map((char, index) => {
          const revealStart = 140 + (index / Math.max(copy.headline.length, 1)) * 40;
          const opacity = interpolate(frame, [revealStart, revealStart + 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const highlightRange = copy.highlight ? copy.headline.toLowerCase().indexOf(copy.highlight.toLowerCase()) : -1;
          const highlighted = highlightRange >= 0 && index >= highlightRange && index < highlightRange + copy.highlight.length;
          return (
            <span
              key={`${char}-${index}`}
              style={{
                opacity,
                color: highlighted ? "#C5A059" : "#efe7db",
                textShadow: highlighted ? "0 0 12px #C5A059, 0 0 4px #C5A059" : "none",
              }}
              dangerouslySetInnerHTML={{ __html: char === " " ? "&nbsp;" : char }}
            />
          );
        })}
      </div>

      <div style={{ position: "absolute", top: 1110, left: 64, right: 64, textAlign: "right", fontSize: 26, fontStyle: "italic", lineHeight: 1.5, color: "rgba(197,160,89,0.75)", opacity: annotationOpacity }}>
        {copy.support}
      </div>

      <div style={{ position: "absolute", top: 1060, left: "50%", transform: `translateX(-50%) rotate(${badgeRotate}deg) scale(${badgeScale})`, opacity: badgeOpacity, width: 144, height: 144, borderRadius: "50%", background: dt.badge_bg, color: dt.badge_text, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", fontSize: 22, fontWeight: 700, boxShadow: `0 2px 12px rgba(0,0,0,0.5), 0 0 0 4px #C5A059` }}>
        {copy.badge}
      </div>

      <div style={{ position: "absolute", left: 60, right: 60, bottom: 82, opacity: ctaOpacity }}>
        <AdCta text={copy.cta} bgColor={dt.cta_bg} textColor={dt.cta_text} borderRadius={14} style={{ boxShadow: "0 4px 24px rgba(197,160,89,0.25)" }} />
      </div>
    </AbsoluteFill>
  );
};
