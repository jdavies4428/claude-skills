import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { AdBackground } from "../components/AdBackground";
import { AdLogo } from "../components/AdLogo";
import { AdBadge } from "../components/AdBadge";
import { AdPhoto } from "../components/AdPhoto";
import { AdCta } from "../components/AdCta";
import type { AdReelProps } from "../schema";

// ─── Template 3: Kinetic Typography ──────────────────────────────────────────
// 270 frames / 9s @ 30fps
// Words are the star — massive, flying from edges and colliding into place.

// Word entry directions cycling top/right/bottom/left
const WORD_OFFSETS: Array<[number, number]> = [
  [0, -300],  // top
  [300, 0],   // right
  [0, 300],   // bottom
  [-300, 0],  // left
];

// 16 particle angles evenly distributed
const PARTICLE_ANGLES = Array.from({ length: 16 }, (_, i) => (i / 16) * Math.PI * 2);

export const Template3Kinetic: React.FC<AdReelProps> = ({
  copy,
  designTokens: dt,
  assets,
  brandContext,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headlineWords = copy.headline.split(" ");
  const highlightLower = copy.highlight.toLowerCase();
  const supportWords = copy.support.split(" ");

  // ── Background hue pulse (0-20) ─────────────────────────────────────────────
  const hueShift = Math.sin(frame * 0.1) * 5;

  // ── Words fly in (10-60, stagger 8 frames) — heavy spring ───────────────────
  // Photo pushes headline container up (70-100)
  const headlinePush = interpolate(frame, [70, 100], [0, -20], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── Photo punches in from bottom (70-100) ────────────────────────────────────
  const photoSpring = spring({
    frame: Math.max(0, frame - 70),
    fps,
    config: { damping: 10, stiffness: 200, mass: 0.8 },
  });
  const photoY = interpolate(photoSpring, [0, 1], [300, 0]);
  const photoScale = interpolate(photoSpring, [0, 1], [0.3, 1]);
  const photoOp = interpolate(frame, [70, 82], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── Badge rotates in (90-110) ────────────────────────────────────────────────
  const badgeSpring = spring({
    frame: Math.max(0, frame - 90),
    fps,
    config: { damping: 12, stiffness: 150 },
  });
  const badgeRot = interpolate(badgeSpring, [0, 1], [-180, 0]);
  const badgeOp = interpolate(frame, [90, 102], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── CTA stamps down (150-190) ────────────────────────────────────────────────
  const ctaSpring = spring({
    frame: Math.max(0, frame - 150),
    fps,
    config: { damping: 8, stiffness: 300, mass: 0.5 },
  });
  const ctaScale = interpolate(ctaSpring, [0, 1], [2, 1]);
  const ctaY = interpolate(ctaSpring, [0, 1], [-80, 0]);
  const ctaOp = interpolate(frame, [150, 162], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── Logo fades in (190-230) ──────────────────────────────────────────────────
  const logoDrift = interpolate(frame, [190, 220], [10, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const logoOp = interpolate(frame, [190, 220], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── Floating sin-wave oscillation (230-270) ──────────────────────────────────
  const floatY = frame >= 230 ? Math.sin((frame - 230) * 0.15) * 3 : 0;

  return (
    <AbsoluteFill style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      {/* Background with hue pulse */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(180deg, ${dt.gradient_from} 0%, ${dt.gradient_to} 100%)`,
          filter: `hue-rotate(${hueShift}deg)`,
        }}
      />

      {/* Floating oscillation wrapper (230-270) */}
      <AbsoluteFill style={{ transform: `translateY(${floatY}px)` }}>

        {/* Headline word container — pushed up by photo (70-100) */}
        <div
          style={{
            position: "absolute",
            top: 50,
            left: 12,
            right: 12,
            fontSize: 22,
            fontWeight: 900,
            color: dt.headline_text,
            lineHeight: 1.2,
            transform: `translateY(${headlinePush}px)`,
          }}
        >
          {headlineWords.map((word, i) => {
            const [ox, oy] = WORD_OFFSETS[i % 4];
            const wStart = 10 + i * 8;

            // Heavy spring: damping 15, mass 2
            const wSpring = spring({
              frame: Math.max(0, frame - wStart),
              fps,
              config: { damping: 15, stiffness: 120, mass: 2 },
            });

            const wx = interpolate(wSpring, [0, 1], [ox, 0]);
            const wy = interpolate(wSpring, [0, 1], [oy, 0]);
            const wScale = interpolate(wSpring, [0, 1], [2, 1]);
            const wOp = interpolate(frame, [wStart, wStart + 10], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });

            const isHighlight =
              word.toLowerCase().includes(highlightLower) ||
              highlightLower.split(" ").some((hw) => word.toLowerCase().includes(hw));

            // Highlight flash: scale 120%, glow (50-70)
            let extraScale = 1;
            let glowShadow: string | undefined;
            if (isHighlight) {
              const flashScale = interpolate(frame, [50, 58, 70], [1, 1.2, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              extraScale = flashScale;
              const flashProg = interpolate(frame, [50, 60], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              const glowAmt = flashProg * 12;
              if (glowAmt > 0) {
                glowShadow = `0 0 ${glowAmt}px ${dt.primary}`;
              }
            }

            const combinedScale = wScale * extraScale;

            return (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  marginRight: 6,
                  marginBottom: 4,
                  transform: `translate(${wx}px, ${wy}px) scale(${combinedScale})`,
                  opacity: wOp,
                  color: isHighlight ? dt.primary : dt.headline_text,
                  textShadow: glowShadow,
                }}
              >
                {word}
              </span>
            );
          })}
        </div>

        {/* Photo punches in from bottom (70-100) */}
        <div
          style={{
            position: "absolute",
            top: 210,
            left: 12,
            right: 12,
            height: 180,
            borderRadius: 8,
            overflow: "hidden",
            transform: `translateY(${photoY}px) scale(${photoScale})`,
            opacity: photoOp,
            boxShadow: "0 8px 30px rgba(0,0,0,0.5)",
            background: `linear-gradient(135deg, ${dt.gradient_from}, ${dt.gradient_to}, ${dt.primary})`,
          }}
        >
          <AdPhoto
            photoUrl={assets.afterPhotoUrl}
            fallbackGradient={`linear-gradient(135deg, ${dt.gradient_from}, ${dt.gradient_to}, ${dt.primary})`}
            style={{ width: "100%", height: "100%", borderRadius: 8 }}
          />
        </div>

        {/* Badge rotates in (90-110) */}
        <AdBadge
          text={copy.badge}
          bgColor={dt.badge_bg}
          textColor={dt.badge_text}
          style={{
            position: "absolute",
            top: 195,
            left: "50%",
            transform: `translateX(-50%) rotate(${badgeRot}deg)`,
            opacity: badgeOp,
            zIndex: 10,
          }}
        />

        {/* Support words cascade in (110-150) */}
        <div
          style={{
            position: "absolute",
            top: 408,
            left: 12,
            right: 12,
            fontSize: 11,
            color: dt.support_text,
            lineHeight: 1.5,
          }}
        >
          {supportWords.map((word, i) => {
            const swStart = 110 + i * 4;
            const swSpring = spring({
              frame: Math.max(0, frame - swStart),
              fps,
              config: { damping: 12, stiffness: 200, mass: 0.7 },
            });
            const swY = interpolate(swSpring, [0, 1], [12, 0]);
            const swOp = interpolate(frame, [swStart, swStart + 8], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            return (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  marginRight: 4,
                  marginBottom: 3,
                  transform: `translateY(${swY}px)`,
                  opacity: swOp,
                }}
              >
                {word}
              </span>
            );
          })}
        </div>

        {/* CTA stamps down from above (150-190) */}
        <div
          style={{
            position: "absolute",
            top: 480,
            left: "50%",
            transform: `translateX(-50%) translateY(${ctaY}px) scale(${ctaScale})`,
            opacity: ctaOp,
          }}
        >
          <AdCta
            text={copy.cta}
            bgColor={dt.cta_bg}
            textColor={dt.cta_text}
          />
        </div>

        {/* Particle burst (155-185): 16 dots fly outward and fade */}
        <div
          style={{
            position: "absolute",
            top: 480,
            left: "50%",
            pointerEvents: "none",
            zIndex: 5,
          }}
        >
          {PARTICLE_ANGLES.map((angle, i) => {
            const pProg = interpolate(frame, [155, 185], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const dist = pProg * 60;
            const px = Math.cos(angle) * dist;
            const py = Math.sin(angle) * dist;
            const pOp = interpolate(pProg, [0, 0.2, 1], [0, 1, 0]);
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  width: 4,
                  height: 4,
                  borderRadius: "50%",
                  background: dt.primary,
                  opacity: pOp,
                  transform: `translate(calc(-50% + ${px}px), calc(-50% + ${py}px))`,
                }}
              />
            );
          })}
        </div>

        {/* Logo fades in at bottom (190-230) */}
        <div
          style={{
            position: "absolute",
            bottom: 20,
            left: "50%",
            transform: `translateX(-50%) translateY(${logoDrift}px)`,
            opacity: logoOp,
            width: 70,
            height: 30,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <AdLogo
            logoUrl={assets.logoUrl}
            brandName={brandContext.brandName}
            maxHeight={30}
            style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.5))" }}
          />
        </div>

      </AbsoluteFill>
    </AbsoluteFill>
  );
};
