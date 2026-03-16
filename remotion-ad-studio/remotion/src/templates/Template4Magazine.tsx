import React from "react";
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { AdReelProps } from "../schema";
import { AdLogo } from "../components/AdLogo";
import { AdPhoto } from "../components/AdPhoto";
import { AdBadge } from "../components/AdBadge";
import { AdCta } from "../components/AdCta";
import { springVal } from "../helpers";

// 240 frames @ 30fps — Magazine Cover
export const Template4Magazine: React.FC<AdReelProps> = ({
  copy,
  designTokens: T,
  assets,
  brandContext,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ── Opening line (0-15) ─────────────────────────────────────────────────
  const lineWidth = interpolate(frame, [0, 15], [0, 1080], { extrapolateRight: "clamp" });

  // ── Photo clip-path reveal from center outward (15-45) ─────────────────
  const revealPct = interpolate(frame, [15, 45], [0, 100], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
  const topClip = Math.max(0, 50 - revealPct / 2);
  const bottomClip = Math.max(0, 50 - revealPct / 2);
  const photoClipPath = `inset(${topClip}% 0 ${bottomClip}% 0)`;

  // ── Ken Burns zoom on photo (170-240) ───────────────────────────────────
  const kbScale = interpolate(frame, [170, 240], [1.1, 1.15], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const kbX = interpolate(frame, [170, 240], [0, 10], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const photoTransform = `scale(${kbScale}) translateX(${kbX}px)`;

  // Overlay darkens as photo reveals
  const overlayOpacity = interpolate(frame, [30, 55], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });

  // ── Masthead logo (35-65) ────────────────────────────────────────────────
  const mastheadOpacity = interpolate(frame, [35, 55], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
  const mastheadSpring = springVal(frame, fps, 35, { damping: 14, stiffness: 100 });
  const mastheadY = interpolate(mastheadSpring, [0, 1], [-20, 0]);

  // ── Color bar slides from left (55-85) ──────────────────────────────────
  const barX = interpolate(frame, [55, 85], [-100, 0], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });

  // ── Headline slides from right (65-95) ──────────────────────────────────
  const hlSpring = springVal(frame, fps, 65, { damping: 12, stiffness: 150 });
  const hlX = interpolate(hlSpring, [0, 1], [300, 0]);

  // ── Badge sticker pop at -12deg (80-110) ────────────────────────────────
  const badgeSpring = springVal(frame, fps, 80, { damping: 10, stiffness: 250, mass: 0.7 });
  const badgeScale = interpolate(badgeSpring, [0, 1], [0, 1]);

  // ── Support text lines staggered fade-in (100-140) ──────────────────────
  const supportLines = copy.support
    .split(/[.,]/)
    .map((s) => s.trim())
    .filter(Boolean);

  // ── CTA pill slides from right (130-170) + arrow fade ───────────────────
  const ctaRight = interpolate(frame, [130, 165], [-300, 60], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
  const arrowOpacity = interpolate(frame, [160, 175], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
  const arrowX = interpolate(frame, [160, 175], [-20, 0], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });

  // ── White flash (200-202) ────────────────────────────────────────────────
  const flashOpacity =
    frame >= 200 && frame <= 202
      ? interpolate(frame, [200, 201, 202], [0, 0.85, 0])
      : 0;

  // ── Vignette (203+) ─────────────────────────────────────────────────────
  const vignetteOpacity = interpolate(frame, [203, 218], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });

  // ── Bottom logo (205+) ──────────────────────────────────────────────────
  const bottomLogoOpacity = interpolate(frame, [205, 225], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });

  const hlWords = copy.headline.split(" ").slice(0, 5).join(" ").toUpperCase();

  return (
    <AbsoluteFill style={{ background: T.gradient_from, overflow: "hidden" }}>

      {/* Opening center line */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          height: 4,
          width: lineWidth,
          background: T.primary,
          boxShadow: `0 0 16px ${T.primary}`,
          zIndex: 5,
        }}
      />

      {/* Photo layer with clip-path reveal */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          clipPath: photoClipPath,
          transform: photoTransform,
          transformOrigin: "center center",
          overflow: "hidden",
        }}
      >
        <AdPhoto
          photoUrl={assets.afterPhotoUrl}
          fallbackGradient={`linear-gradient(160deg, ${T.gradient_from}, ${T.gradient_to}, ${T.primary})`}
          style={{ position: "absolute", inset: 0 }}
          imgStyle={{ objectPosition: "center center" }}
        />
      </div>

      {/* Dark overlay for text legibility */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.6) 55%, rgba(0,0,0,0.9) 100%)",
          opacity: overlayOpacity,
          zIndex: 2,
        }}
      />

      {/* Masthead logo — small caps, wide tracking */}
      <div
        style={{
          position: "absolute",
          top: 48,
          left: 0,
          right: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10,
          opacity: mastheadOpacity,
          transform: `translateY(${mastheadY}px)`,
        }}
      >
        <AdLogo
          logoUrl={assets.logoUrl}
          brandName={brandContext.brandName}
          style={{ letterSpacing: "0.2em", textTransform: "uppercase" }}
          maxHeight={52}
          color={T.badge_text || "#efe7db"}
        />
      </div>

      {/* Colored bar behind headline */}
      <div
        style={{
          position: "absolute",
          top: 870,
          left: `${barX}%`,
          right: 0,
          height: 210,
          background: T.badge_bg,
          zIndex: 4,
        }}
      />

      {/* Headline on top of bar */}
      <div
        style={{
          position: "absolute",
          top: 882,
          left: 0,
          right: 0,
          paddingLeft: 42,
          paddingRight: 42,
          fontSize: 60,
          fontWeight: 900,
          color: T.badge_text,
          lineHeight: 1.15,
          letterSpacing: "-0.01em",
          textTransform: "uppercase",
          transform: `translateX(${hlX}px)`,
          zIndex: 5,
        }}
      >
        {hlWords}
      </div>

      {/* Badge sticker — angled -12deg */}
      <div
        style={{
          position: "absolute",
          top: 156,
          right: 42,
          zIndex: 10,
          transform: `rotate(-12deg) scale(${badgeScale})`,
          transformOrigin: "right top",
        }}
      >
        <AdBadge
          text={copy.badge}
          bgColor={T.badge_bg}
          textColor={T.badge_text}
          style={{
            fontSize: 28,
            padding: "16px 28px",
            borderRadius: 8,
            letterSpacing: "0.08em",
            boxShadow: "0 6px 24px rgba(0,0,0,0.6)",
          }}
        />
      </div>

      {/* Support text lines with stagger */}
      <div
        style={{
          position: "absolute",
          top: 1130,
          left: 42,
          right: 42,
          zIndex: 6,
        }}
      >
        {supportLines.map((line, i) => {
          const seStart = 100 + i * 12;
          const lineSpring = springVal(frame, fps, seStart, { damping: 14, stiffness: 120 });
          const lineY = interpolate(lineSpring, [0, 1], [18, 0]);
          const lineOpacity = interpolate(frame, [seStart, seStart + 12], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
          return (
            <div
              key={i}
              style={{
                fontSize: 32,
                color: "rgba(239,231,219,0.85)",
                lineHeight: 1.5,
                marginBottom: 12,
                opacity: lineOpacity,
                transform: `translateY(${lineY}px)`,
              }}
            >
              {line}{i === 0 && supportLines.length > 1 ? "." : ""}
            </div>
          );
        })}
      </div>

      {/* CTA pill with arrow */}
      <div
        style={{
          position: "absolute",
          bottom: 108,
          right: ctaRight,
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          gap: 16,
          background: T.cta_bg,
          color: T.cta_text,
          padding: "30px 52px",
          borderRadius: 9999,
          fontSize: 34,
          fontWeight: 700,
          letterSpacing: "0.02em",
          whiteSpace: "nowrap",
          boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
        }}
      >
        {copy.cta}
        <span
          style={{
            display: "inline-block",
            opacity: arrowOpacity,
            transform: `translateX(${arrowX}px)`,
            fontSize: 36,
          }}
        >
          →
        </span>
      </div>

      {/* White flash */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "white",
          opacity: flashOpacity,
          zIndex: 20,
          pointerEvents: "none",
        }}
      />

      {/* Vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.75) 100%)",
          opacity: vignetteOpacity,
          zIndex: 15,
          pointerEvents: "none",
        }}
      />

      {/* Bold logo at bottom */}
      <div
        style={{
          position: "absolute",
          bottom: 42,
          left: "50%",
          transform: "translateX(-50%)",
          opacity: bottomLogoOpacity,
          zIndex: 16,
        }}
      >
        <AdLogo
          logoUrl={assets.logoUrl}
          brandName={brandContext.brandName}
          maxHeight={68}
          color={T.badge_text || "#efe7db"}
          style={{ filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.6))" }}
        />
      </div>
    </AbsoluteFill>
  );
};
