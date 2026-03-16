import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";
import { AdReelProps } from "../schema";
import { AdLogo } from "../components/AdLogo";
import { AdPhoto } from "../components/AdPhoto";
import { AdBadge } from "../components/AdBadge";
import { AdCta } from "../components/AdCta";

// 240 frames @ 30fps — Venetian Blinds / Mechanical
const STRIP_COUNT = 8;
// 1080x1920 canvas
const CANVAS_W = 1080;
const CANVAS_H = 1920;
const STRIP_H = CANVAS_H / STRIP_COUNT; // 240px each

// Easing
function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

// Flip schedule matching the reference: strips 0-3 cascade early, 4 early-mid,
// 5 mid, 6 late, 7 at end
const FLIP_STARTS = [10, 15, 20, 25, 70, 85, 140, 170];
const FLIP_DUR = 30; // frames to complete one flip

export const Template7Blinds: React.FC<AdReelProps> = ({
  copy,
  designTokens: T,
  assets,
  brandContext,
}) => {
  const frame = useCurrentFrame();

  // ── Per-strip content (what shows after flip) ───────────────────────────
  // Strip content nodes — each is placed absolutely at top:0 of the strip
  function stripContent(i: number): React.ReactNode {
    const bgColors = [
      T.gradient_from,
      T.surface || T.gradient_from,
      T.gradient_to,
      T.surface || T.gradient_from,
      T.gradient_from,
      T.surface || T.gradient_from,
      T.gradient_to,
      T.cta_bg,
    ];

    switch (i) {
      case 0:
        // Logo strip
        return (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: bgColors[0],
            }}
          >
            <AdLogo
              logoUrl={assets.logoUrl}
              brandName={brandContext.brandName}
              maxHeight={STRIP_H * 0.7}
              color={T.badge_text || "#efe7db"}
            />
          </div>
        );

      case 1:
        // Headline part 1
        return (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              paddingLeft: 60,
              paddingRight: 60,
              background: bgColors[1],
            }}
          >
            <span
              style={{
                fontSize: 46,
                fontWeight: 800,
                color: T.headline_text,
                lineHeight: 1.3,
              }}
            >
              {copy.headline.split(" ").slice(0, 4).join(" ")}
            </span>
          </div>
        );

      case 2:
        // Headline part 2
        return (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              paddingLeft: 60,
              paddingRight: 60,
              background: bgColors[2],
            }}
          >
            <span
              style={{
                fontSize: 46,
                fontWeight: 800,
                color: T.badge_text || "#efe7db",
                lineHeight: 1.3,
              }}
            >
              {copy.headline.split(" ").slice(4, 8).join(" ")}
            </span>
          </div>
        );

      case 3:
        // Badge
        return (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: T.badge_bg,
            }}
          >
            <AdBadge
              text={copy.badge}
              bgColor="transparent"
              textColor={T.badge_text}
              style={{
                fontSize: 33,
                letterSpacing: "0.08em",
                boxShadow: "none",
              }}
            />
          </div>
        );

      case 4:
        // Headline highlight word + photo slice
        return (
          <div
            style={{
              width: "100%",
              height: "100%",
              position: "relative",
              overflow: "hidden",
              background: bgColors[4],
            }}
          >
            {/* Photo slice at strip position */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                opacity: 0.35,
              }}
            >
              <AdPhoto
                photoUrl={assets.afterPhotoUrl}
                fallbackGradient={`linear-gradient(90deg, ${T.gradient_from}, ${T.gradient_to})`}
                style={{
                  position: "absolute",
                  top: -STRIP_H * 4,
                  left: 0,
                  width: CANVAS_W,
                  height: CANVAS_H,
                }}
                imgStyle={{ objectFit: "cover" }}
              />
            </div>
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                paddingLeft: 60,
                paddingRight: 60,
              }}
            >
              <span
                style={{
                  fontSize: 46,
                  fontWeight: 800,
                  color: T.primary,
                }}
              >
                {copy.highlight || copy.headline.split(" ").slice(8).join(" ")}
              </span>
            </div>
          </div>
        );

      case 5:
        // Support line 1
        return (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              paddingLeft: 60,
              paddingRight: 60,
              background: bgColors[5],
            }}
          >
            <span
              style={{
                fontSize: 30,
                color: T.support_text,
                lineHeight: 1.5,
              }}
            >
              {copy.support.split(/[.,]/)[0]?.trim() || copy.support}
            </span>
          </div>
        );

      case 6:
        // Support line 2 + photo
        return (
          <div
            style={{
              width: "100%",
              height: "100%",
              position: "relative",
              overflow: "hidden",
              background: bgColors[6],
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                opacity: 0.25,
              }}
            >
              <AdPhoto
                photoUrl={assets.afterPhotoUrl}
                fallbackGradient={`linear-gradient(90deg, ${T.gradient_from}, ${T.gradient_to})`}
                style={{
                  position: "absolute",
                  top: -STRIP_H * 6,
                  left: 0,
                  width: CANVAS_W,
                  height: CANVAS_H,
                }}
                imgStyle={{ objectFit: "cover" }}
              />
            </div>
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                paddingLeft: 60,
                paddingRight: 60,
              }}
            >
              <span
                style={{
                  fontSize: 30,
                  color: T.support_text,
                  lineHeight: 1.5,
                }}
              >
                {copy.support.split(/[.,]/)[1]?.trim() || ""}
              </span>
            </div>
          </div>
        );

      case 7:
        // CTA
        return (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: T.cta_bg,
            }}
          >
            <span
              style={{
                fontSize: 39,
                fontWeight: 700,
                color: T.cta_text,
                letterSpacing: "0.02em",
              }}
            >
              {copy.cta}
            </span>
          </div>
        );

      default:
        return null;
    }
  }

  // ── Background strip colors (before flip / unflipped face) ─────────────
  const bgColors = [
    T.gradient_from,
    T.surface || T.gradient_from,
    T.gradient_to,
    T.surface || T.gradient_from,
    T.gradient_from,
    T.surface || T.gradient_from,
    T.gradient_to,
    T.surface || T.gradient_from,
  ];

  return (
    <AbsoluteFill style={{ background: T.gradient_from, overflow: "hidden" }}>
      {Array.from({ length: STRIP_COUNT }, (_, i) => {
        const top = i * STRIP_H;
        const fs = FLIP_STARTS[i];
        const flipF = frame - fs;

        // Calculate rotateX: 0 -> 180 over FLIP_DUR frames
        let rotX = 0;
        if (flipF < 0) {
          rotX = 0;
        } else if (flipF < FLIP_DUR) {
          const t = easeInOut(Math.min(1, flipF / FLIP_DUR));
          rotX = t * 180;
        } else {
          rotX = 180;
        }

        // ── Highlight strip vibration (strip 4, frames 110-150) ──────────
        let stripTranslateX = 0;
        if (i === 4 && frame >= 110 && frame <= 150) {
          const pulseF = frame - 110;
          const decay = interpolate(frame, [110, 150], [1, 0], {
            extrapolateRight: "clamp",
            extrapolateLeft: "clamp",
          });
          stripTranslateX = Math.sin(pulseF * 0.9) * 6 * decay;
        }

        // ── Wave settle — staggered translateY bounce (210-240) ──────────
        let stripTranslateY = 0;
        if (frame >= 210) {
          const waveF = frame - 210;
          const phase = i * 0.6;
          const decay = interpolate(frame, [210, 240], [1, 0], {
            extrapolateRight: "clamp",
            extrapolateLeft: "clamp",
          });
          stripTranslateY = Math.sin(waveF * 0.25 + phase) * 9 * decay;
        }

        // Horizontal divider shadow between strips
        const dividerStyle: React.CSSProperties = {
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 3,
          background: "rgba(0,0,0,0.3)",
          zIndex: 1,
          pointerEvents: "none",
        };

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top,
              height: STRIP_H,
              perspective: 1200,
              transform: `translate(${stripTranslateX}px, ${stripTranslateY}px)`,
              zIndex: 2,
            }}
          >
            {/* Inner — preserves 3d for rotateX flip */}
            <div
              style={{
                width: "100%",
                height: "100%",
                transformStyle: "preserve-3d",
                transform: `rotateX(${rotX}deg)`,
                transformOrigin: "center",
                position: "relative",
              }}
            >
              {/* Front face — solid bg color (before flip) */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: bgColors[i],
                  backfaceVisibility: "hidden",
                }}
              />

              {/* Back face — content revealed after flip */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  backfaceVisibility: "hidden",
                  transform: "rotateX(180deg)",
                  overflow: "hidden",
                }}
              >
                {stripContent(i)}
              </div>
            </div>

            {/* Divider line */}
            <div style={dividerStyle} />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
