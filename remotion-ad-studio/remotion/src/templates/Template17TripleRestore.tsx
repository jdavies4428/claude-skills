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

function hexToRgba(hex: string, alpha: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return `rgba(${r},${g},${b},${alpha})`;
}
import type { AdReelProps } from "../schema";

// ─── Template 19: Triple Restore ─────────────────────────────────────────────
// 330 frames / 11s @ 30fps
// Three polaroids fan out with a camera flash, start in sepia, gold sweep
// reveals color. Sparkle particles float up. Emotional, warm, tactile.

// Polaroid configs: left, center, right
const POLAROIDS = [
  { left: 40, top: 220, rotation: -13, centerX: 179 },
  { left: 400, top: 170, rotation: 0, centerX: 540 },
  { left: 760, top: 220, rotation: 13, centerX: 899 },
];

const SPRING_DELAYS = [20, 35, 50];

// 20 sparkle particles — seeded for determinism
const SPARKLES = Array.from({ length: 20 }, (_, i) => ({
  x: 80 + seededRandom(i * 13 + 7) * 920,
  baseY: 500 + seededRandom(i * 17 + 3) * 300,
  size: 3 + seededRandom(i * 11 + 19) * 5,
  vx: (seededRandom(i * 23 + 5) - 0.5) * 1.2,
  vy: 0.8 + seededRandom(i * 29 + 2) * 1.2,
  phase: seededRandom(i * 31 + 41) * Math.PI * 2,
  opacity: 0.6 + seededRandom(i * 37 + 11) * 0.2,
}));

export const Template17TripleRestore: React.FC<AdReelProps> = ({
  copy,
  designTokens: dt,
  assets,
  brandContext,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ── Camera flash: peaks at frame 7, gone by 15 ──────────────────────────────
  const flashOpacity =
    interpolate(frame, [0, 7], [0, 0.92], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) -
    interpolate(frame, [7, 15], [0, 0.92], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // ── Gold sweep line: x from -50 to 1130 over frames 80-160 ──────────────────
  const sweepX = interpolate(frame, [80, 160], [-50, 1130], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const sweepGlowOpacity = interpolate(frame, [80, 95, 155, 165], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── Logo fade in: 100-130 ────────────────────────────────────────────────────
  const logoOpacity = interpolate(frame, [100, 130], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── Support text: 185-230 ────────────────────────────────────────────────────
  const supportOpacity = interpolate(frame, [185, 230], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── CTA spring: 230-290 ──────────────────────────────────────────────────────
  const ctaSpring = spring({
    frame: Math.max(0, frame - 230),
    fps,
    config: { damping: 12, stiffness: 160, mass: 1 },
  });
  const ctaY = interpolate(ctaSpring, [0, 1], [80, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ctaOpacity = interpolate(frame, [230, 250], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── Outro vignette: 280-330 ──────────────────────────────────────────────────
  const vignetteOpacity = interpolate(frame, [280, 330], [0, 0.55], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── Headline words: 130-185, staggered 12 frames/word ───────────────────────
  const headlineWords = copy.headline.split(" ");
  const highlightLower = copy.highlight ? copy.highlight.toLowerCase() : "";

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(180deg, ${dt.gradient_from} 0%, ${dt.gradient_to} 100%)`,
        fontFamily: "Playfair Display, serif",
        color: dt.headline_text,
        overflow: "hidden",
      }}
    >
      {/* Camera flash overlay */}
      {frame < 20 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "#ffffff",
            opacity: Math.max(0, flashOpacity),
            pointerEvents: "none",
            zIndex: 100,
          }}
        />
      )}

      {/* Three polaroids */}
      {POLAROIDS.map((pol, idx) => {
        const delay = SPRING_DELAYS[idx];
        const dropSpring = spring({
          frame: Math.max(0, frame - delay),
          fps,
          config: { damping: 8, stiffness: 100, mass: 1.4 },
        });
        const translateY = interpolate(dropSpring, [0, 1], [-500, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const polOpacity = interpolate(frame, [delay, delay + 6], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        // Sepia: sweep line passes the polaroid's center x
        const distFromSweep = sweepX - pol.centerX;
        const sepia = interpolate(distFromSweep, [-30, 30], [100, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        return (
          <div
            key={idx}
            style={{
              position: "absolute",
              left: pol.left,
              top: pol.top,
              transform: `translateY(${translateY}px) rotate(${pol.rotation}deg)`,
              transformOrigin: "center top",
              opacity: polOpacity,
              zIndex: idx === 1 ? 3 : 2,
            }}
          >
            {/* Polaroid frame */}
            <div
              style={{
                background: "#fff",
                padding: "10px 10px 32px",
                boxShadow: "0 12px 40px rgba(0,0,0,0.65)",
                borderRadius: 2,
                width: 280,
              }}
            >
              <AdPhoto
                photoUrl={assets.afterPhotoUrl}
                fallbackGradient={`linear-gradient(135deg, ${dt.gradient_from}, ${dt.gradient_to})`}
                style={{ width: 260, height: 260, borderRadius: 1 }}
                imgStyle={{ filter: `sepia(${sepia}%)` }}
              />
              {/* Brand label in polaroid bottom strip */}
              <div
                style={{
                  fontSize: 10,
                  color: "#aaa",
                  textAlign: "center",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  paddingTop: 6,
                }}
              >
                {brandContext.brandName}
              </div>
            </div>
          </div>
        );
      })}

      {/* Gold sweep glow strip */}
      {frame >= 80 && frame <= 165 && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: sweepX - 30,
            width: 60,
            height: "100%",
            background:
              `linear-gradient(90deg, transparent, ${hexToRgba(dt.primary, 0.6)}, transparent)`,
            opacity: sweepGlowOpacity,
            pointerEvents: "none",
            zIndex: 10,
          }}
        />
      )}

      {/* Sparkle particles — active 150-220 */}
      {SPARKLES.map((sp, i) => {
        const activeFrame = Math.max(0, frame - 150);
        const maxActiveFrame = 70;
        if (activeFrame <= 0 || activeFrame > maxActiveFrame + 40) return null;
        const currentY = sp.baseY - sp.vy * activeFrame;
        const currentX = sp.x + sp.vx * activeFrame + Math.sin(activeFrame * 0.08 + sp.phase) * 6;
        const opacity =
          interpolate(activeFrame, [0, 12], [0, sp.opacity], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) *
          interpolate(activeFrame, [maxActiveFrame, maxActiveFrame + 30], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: currentX,
              top: currentY,
              width: sp.size,
              height: sp.size,
              borderRadius: "50%",
              background: i % 2 === 0 ? hexToRgba(dt.primary, 0.85) : hexToRgba(dt.headline_text, 0.75),
              opacity: Math.max(0, opacity),
              filter: "blur(0.5px)",
              pointerEvents: "none",
              zIndex: 20,
            }}
          />
        );
      })}

      {/* Logo — fades in 100-130 */}
      <div
        style={{
          position: "absolute",
          top: 44,
          left: "50%",
          transform: "translateX(-50%)",
          opacity: logoOpacity,
          zIndex: 30,
        }}
      >
        <AdLogo
          logoUrl={assets.logoUrl}
          brandName={brandContext.brandName}
          maxHeight={26}
          style={{ filter: `drop-shadow(0 0 4px ${hexToRgba(dt.primary, 0.5)})` }}
          color={hexToRgba(dt.primary, 0.85)}
        />
      </div>

      {/* Headline — word-by-word, frames 130-185, stagger 12 frames/word */}
      <div
        style={{
          position: "absolute",
          top: 590,
          left: 60,
          right: 60,
          fontSize: 62,
          fontWeight: 800,
          lineHeight: 1.3,
          textAlign: "center",
          zIndex: 30,
        }}
      >
        {headlineWords.map((word, i) => {
          const wordStart = 130 + i * 12;
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

      {/* Support text — 185-230 */}
      <div
        style={{
          position: "absolute",
          top: 820,
          left: 80,
          right: 80,
          fontSize: 30,
          lineHeight: 1.6,
          textAlign: "center",
          color: dt.support_text,
          opacity: supportOpacity,
          zIndex: 30,
        }}
      >
        {copy.support}
      </div>

      {/* CTA — spring bounce 230-290 */}
      <div
        style={{
          position: "absolute",
          bottom: 80,
          left: 60,
          right: 60,
          transform: `translateY(${ctaY}px)`,
          opacity: ctaOpacity,
          zIndex: 30,
        }}
      >
        <AdCta
          text={copy.cta}
          bgColor={dt.cta_bg}
          textColor={dt.cta_text}
          borderRadius={14}
        />
      </div>

      {/* Outro vignette — 280-330 */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(0,0,0,0.8) 100%)",
          opacity: vignetteOpacity,
          pointerEvents: "none",
          zIndex: 50,
        }}
      />
    </AbsoluteFill>
  );
};
