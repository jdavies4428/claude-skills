import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { AdLogo } from "../components/AdLogo";
import { AdPhoto } from "../components/AdPhoto";
import { AdCta } from "../components/AdCta";
import { seededRandom } from "../helpers";
import type { AdReelProps } from "../schema";

// ─── Template 20: The Passage of Time ────────────────────────────────────────
// 360 frames / 12s @ 30fps
// Sun arcs across the sky as time passes. Photo ages then a warm restoration
// light radiates from center, revealing the restored photo.
// Emotional arc: had it → lost it → got it back.

// Sun arc parameters
const ARC_CX = 540;
const ARC_CY = 700;
const ARC_R = 580;

// 8 tick marks along the arc at angles π*i/7 for i=0..7
const TICK_MARKS = Array.from({ length: 8 }, (_, i) => {
  const angle = (Math.PI * i) / 7;
  const x = ARC_CX + ARC_R * Math.cos(angle);
  const y = ARC_CY - ARC_R * Math.sin(angle);
  // Rotation so the tick points radially toward center
  const angleDeg = (angle * 180) / Math.PI;
  return { x, y, angleDeg };
});

// 20 amber particles — seeded
const AMBER_PARTICLES = Array.from({ length: 20 }, (_, i) => ({
  x: 90 + seededRandom(i * 19 + 11) * 900,
  baseY: 620 + seededRandom(i * 23 + 7) * 500,
  size: 3 + seededRandom(i * 31 + 13) * 6,
  vx: (seededRandom(i * 37 + 5) - 0.5) * 1.4,
  vy: 0.7 + seededRandom(i * 41 + 3) * 1.1,
  phase: seededRandom(i * 47 + 17) * Math.PI * 2,
  opacity: 0.55 + seededRandom(i * 53 + 23) * 0.3,
}));

// Lerp helper
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// Hex color to rgb components
function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function hexToRgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

function lerpColor(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  const r = Math.round(lerp(ar, br, t));
  const g = Math.round(lerp(ag, bg, t));
  const bv = Math.round(lerp(ab, bb, t));
  return `rgb(${r},${g},${bv})`;
}

export const Template20PassageOfTime: React.FC<AdReelProps> = ({
  copy,
  designTokens: dt,
  assets,
  brandContext,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ── Sun arc position ─────────────────────────────────────────────────────────
  const arcAngle = interpolate(frame, [0, 150], [Math.PI, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const sunX = ARC_CX + ARC_R * Math.cos(arcAngle);
  const sunY = ARC_CY - ARC_R * Math.sin(arcAngle);
  const sunVisible = sunY < ARC_CY; // only above horizon

  // Sun glow intensity — brightest at noon (angle π/2)
  const sunNoon = 1 - Math.abs(arcAngle - Math.PI / 2) / (Math.PI / 2);
  const sunGlowSize = 40 + sunNoon * 60;

  // ── Tick mark fade in: 0-30 ──────────────────────────────────────────────────
  const tickOpacity = interpolate(frame, [0, 30], [0, 0.5], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── Sky background color transitions ─────────────────────────────────────────
  // 0-50: day blue #4A8FD4, 50-110: sunset orange #E8762B,
  // 110-165: night #100620, 165-200: stay dark, 200-260: warm amber dark #2a0e00
  const skyColor = (() => {
    if (frame <= 50) return "#4A8FD4";
    if (frame <= 110) {
      const t = interpolate(frame, [50, 110], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      return lerpColor("#4A8FD4", "#E8762B", t);
    }
    if (frame <= 165) {
      const t = interpolate(frame, [110, 165], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      return lerpColor("#E8762B", "#100620", t);
    }
    if (frame <= 200) return "#100620";
    if (frame <= 260) {
      const t = interpolate(frame, [200, 260], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      return lerpColor("#100620", "#2a0e00", t);
    }
    return "#2a0e00";
  })();

  // ── Photo aging filters ──────────────────────────────────────────────────────
  const sepia = interpolate(frame, [40, 160], [0, 95], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const brightness = interpolate(frame, [100, 170], [1, 0.35], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const contrast = interpolate(frame, [100, 170], [1, 0.6], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Restoration (frame 200+)
  const restoreSepia = interpolate(frame, [200, 280], [95, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const restoreBrightness = interpolate(frame, [200, 280], [0.35, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const restoreContrast = interpolate(frame, [200, 280], [0.6, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const finalSepia = frame < 200 ? sepia : restoreSepia;
  const finalBrightness = frame < 200 ? brightness : restoreBrightness;
  const finalContrast = frame < 200 ? contrast : restoreContrast;

  // ── Restoration reveal — clean photo circles in ──────────────────────────────
  const revealRadius = interpolate(frame, [195, 285], [0, 700], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── Restoration glow overlay ─────────────────────────────────────────────────
  const glowOpacity =
    frame < 225
      ? interpolate(frame, [185, 225], [0, 0.7], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : interpolate(frame, [225, 270], [0.7, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

  // ── Logo fade in: 20-50 ──────────────────────────────────────────────────────
  const logoOpacity = interpolate(frame, [20, 50], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── Headline words: 250-310, stagger 12 frames/word ─────────────────────────
  const headlineWords = copy.headline.split(" ");
  const highlightLower = copy.highlight ? copy.highlight.toLowerCase() : "";

  // ── Support text: 305-340 ────────────────────────────────────────────────────
  const supportOpacity = interpolate(frame, [305, 340], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── CTA spring: 330-360 ──────────────────────────────────────────────────────
  const ctaSpring = spring({
    frame: Math.max(0, frame - 330),
    fps,
    config: { damping: 12, stiffness: 180, mass: 0.9 },
  });
  const ctaY = interpolate(ctaSpring, [0, 1], [70, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ctaOpacity = interpolate(frame, [330, 348], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: dt.gradient_from,
        fontFamily: "Playfair Display, serif",
        color: dt.headline_text,
        overflow: "hidden",
      }}
    >
      {/* Sky section — top half */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 860,
          backgroundColor: skyColor,
          transition: "background-color 0ms",
        }}
      >
        {/* Subtle sky gradient overlay for depth */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(180deg, rgba(0,0,0,0.18) 0%, transparent 60%)",
          }}
        />

        {/* 8 Arc tick marks */}
        {TICK_MARKS.map((tick, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: tick.x - 1,
              top: tick.y - 8,
              width: 2,
              height: 16,
              background: "rgba(255,255,255,0.55)",
              opacity: tickOpacity,
              transform: `rotate(${90 - tick.angleDeg}deg)`,
              transformOrigin: "center center",
            }}
          />
        ))}

        {/* Sun */}
        {sunVisible && (
          <div
            style={{
              position: "absolute",
              left: sunX - 35,
              top: sunY - 35,
              width: 70,
              height: 70,
              borderRadius: "50%",
              background: "#FFD700",
              boxShadow: `0 0 ${sunGlowSize}px ${sunGlowSize / 2}px rgba(255,215,0,0.55), 0 0 ${sunGlowSize * 2}px rgba(255,180,30,0.25)`,
            }}
          />
        )}
      </div>

      {/* Horizon ground line */}
      <div
        style={{
          position: "absolute",
          top: 858,
          left: 0,
          right: 0,
          height: 2,
          background: hexToRgba(dt.primary, 0.25),
        }}
      />

      {/* Photo — two stacked layers for the reveal */}
      <div
        style={{
          position: "absolute",
          top: 620,
          left: 90,
          right: 90,
          height: 540,
        }}
      >
        {/* Bottom layer: degraded/aging photo */}
        <AdPhoto
          photoUrl={assets.afterPhotoUrl}
          fallbackGradient={`linear-gradient(135deg, ${dt.gradient_from}, ${dt.gradient_to})`}
          style={{ width: "100%", height: "100%", borderRadius: 8 }}
          imgStyle={{
            filter: `sepia(${finalSepia}%) brightness(${finalBrightness}) contrast(${finalContrast})`,
          }}
        />

        {/* Top layer: clean photo, revealed via circle clip */}
        {revealRadius > 0 && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 8,
              overflow: "hidden",
              clipPath: `circle(${revealRadius}px at 50% 50%)`,
            }}
          >
            <AdPhoto
              photoUrl={assets.afterPhotoUrl}
              fallbackGradient={`linear-gradient(135deg, ${dt.gradient_from}, ${dt.gradient_to})`}
              style={{ width: "100%", height: "100%" }}
            />
          </div>
        )}

        {/* Restoration glow radial overlay */}
        {glowOpacity > 0 && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 8,
              background:
                `radial-gradient(circle at 50% 50%, ${hexToRgba(dt.primary, 0.8)}, transparent 60%)`,
              opacity: glowOpacity,
              pointerEvents: "none",
            }}
          />
        )}
      </div>

      {/* Amber particles — active 285-360 */}
      {AMBER_PARTICLES.map((p, i) => {
        const activeFrame = Math.max(0, frame - 285);
        const maxActive = 75;
        if (activeFrame <= 0) return null;
        const currentY = p.baseY - p.vy * activeFrame;
        const currentX =
          p.x + p.vx * activeFrame + Math.sin(activeFrame * 0.07 + p.phase) * 7;
        const opacity =
          interpolate(activeFrame, [0, 14], [0, p.opacity], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }) *
          interpolate(activeFrame, [maxActive, maxActive + 25], [1, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: currentX,
              top: currentY,
              width: p.size,
              height: p.size,
              borderRadius: "50%",
              background:
                i % 3 === 0
                  ? hexToRgba(dt.primary, 0.85)
                  : i % 3 === 1
                  ? hexToRgba(dt.primary, 0.65)
                  : hexToRgba(dt.headline_text, 0.55),
              opacity: Math.max(0, opacity),
              filter: "blur(0.4px)",
              pointerEvents: "none",
            }}
          />
        );
      })}

      {/* Logo — top center, fades in 20-50 */}
      <div
        style={{
          position: "absolute",
          top: 48,
          left: "50%",
          transform: "translateX(-50%)",
          opacity: logoOpacity,
          zIndex: 20,
        }}
      >
        <AdLogo
          logoUrl={assets.logoUrl}
          brandName={brandContext.brandName}
          maxHeight={28}
          style={{ filter: `drop-shadow(0 0 5px ${hexToRgba(dt.primary, 0.5)})` }}
          color={hexToRgba(dt.primary, 0.9)}
        />
      </div>

      {/* Headline — word-by-word, 250-310, stagger 12 frames/word */}
      <div
        style={{
          position: "absolute",
          top: 1210,
          left: 64,
          right: 64,
          fontSize: 58,
          fontWeight: 800,
          lineHeight: 1.3,
          textAlign: "center",
          zIndex: 20,
        }}
      >
        {headlineWords.map((word, i) => {
          const wordStart = 250 + i * 12;
          const wordEnd = wordStart + 16;
          const wordOpacity = interpolate(frame, [wordStart, wordEnd], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const isHighlight =
            highlightLower.length > 0 &&
            word.toLowerCase().includes(highlightLower.split(" ")[0]);
          return (
            <span
              key={`${word}-${i}`}
              style={{
                opacity: wordOpacity,
                color: isHighlight ? dt.primary : dt.headline_text,
                marginRight: 10,
                display: "inline-block",
              }}
            >
              {word}
            </span>
          );
        })}
      </div>

      {/* Support text — 305-340 */}
      <div
        style={{
          position: "absolute",
          top: 1440,
          left: 84,
          right: 84,
          fontSize: 28,
          lineHeight: 1.6,
          textAlign: "center",
          color: dt.support_text,
          opacity: supportOpacity,
          zIndex: 20,
        }}
      >
        {copy.support}
      </div>

      {/* CTA — spring bounce 330-360 */}
      <div
        style={{
          position: "absolute",
          bottom: 72,
          left: 60,
          right: 60,
          transform: `translateY(${ctaY}px)`,
          opacity: ctaOpacity,
          zIndex: 20,
        }}
      >
        <AdCta
          text={copy.cta}
          bgColor={dt.cta_bg}
          textColor={dt.cta_text}
          borderRadius={14}
        />
      </div>
    </AbsoluteFill>
  );
};
