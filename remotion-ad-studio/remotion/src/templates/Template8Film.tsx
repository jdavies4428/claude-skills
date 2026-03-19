import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { AdReelProps } from "../schema";
import { AdLogo } from "../components/AdLogo";
import { AdPhoto } from "../components/AdPhoto";
import { clamp, seededRandom } from "../helpers";

// 270 frames @ 30fps — The Filmstrip / Cinema aesthetic
const W = 1080;
const H = 1920;
const SPROCKET_W = 72; // px each side
const HOLE_COUNT = 24;

// Pre-compute grain pattern seed offsets
const GRAIN_SEEDS = Array.from({ length: 80 }, (_, i) => ({
  x: seededRandom(i * 3.7) * W,
  y: seededRandom(i * 5.1) * H,
  size: 2 + seededRandom(i * 2.3) * 5,
}));

// Compute headline lines (3 words per line approx)
function buildLines(text: string, wordsPerLine = 3): string[] {
  const ws = text.split(" ");
  const lines: string[] = [];
  for (let i = 0; i < ws.length; i += wordsPerLine) {
    lines.push(ws.slice(i, i + wordsPerLine).join(" "));
  }
  return lines;
}

export const Template8Film: React.FC<AdReelProps> = ({
  copy,
  designTokens: T,
  assets,
  brandContext,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const hlLines = buildLines(copy.headline, 3);

  // ── Countdown (0-30) ──────────────────────────────────────────────────────
  const countdownOpacity =
    frame < 30
      ? interpolate(frame, [28, 32], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 0;
  const countNum = frame < 5 ? "3" : frame < 10 ? "2" : frame < 15 ? "1" : "";
  const countFlicker = frame < 15 ? (frame % 2 === 0 ? 1 : 0.25) : 1;

  // ── Leader flash (15-30): flicker on/off ─────────────────────────────────
  const showLeader = frame >= 15 && frame < 30 && frame % 3 < 2;

  // ── Sprocket holes (30-40 fade in) ───────────────────────────────────────
  const sprocketOpacity = interpolate(frame, [30, 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── Film grain (intensifies over time) ───────────────────────────────────
  const grainBase = interpolate(frame, [30, 40], [0, 0.18], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const grainIntensify = frame >= 240
    ? interpolate(frame, [240, 270], [0.18, 0.35], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : grainBase;
  const grainFlicker = 0.04 * Math.sin(frame * 13.7);
  const grainOpacity = grainIntensify + grainFlicker;

  // ── Photo slides in from right (30-60) ───────────────────────────────────
  const photoSpring = spring({
    frame: Math.max(0, frame - 30),
    fps,
    config: { damping: 14, stiffness: 90 },
  });
  const photoOpacity = clamp(photoSpring * 3, 0, 1);
  const photoTranslateX = interpolate(photoSpring, [0, 1], [W, 0]);

  // ── Logo blur-to-sharp (55-85) ────────────────────────────────────────────
  const logoT = clamp((frame - 55) / 30, 0, 1);
  const logoOpacity = logoT;
  const logoBlur = interpolate(logoT, [0, 1], [12, 0]);
  const logoSepia = interpolate(logoT, [0, 0.5, 1], [1, 0.5, 0]);

  // ── Clapperboard → badge pill (75-110) ───────────────────────────────────
  const clapperVisible = frame >= 75;
  const clapSnapT = clapperVisible
    ? clamp((frame - 75) / 12, 0, 1)
    : 0;
  // rotateX from -60 -> 0 (snap shut)
  const clapRotateX = interpolate(
    clapSnapT < 1 ? clapSnapT : 1,
    [0, 1],
    [-60, 0]
  );
  const clapTopOpacity =
    frame >= 100 && frame < 108
      ? interpolate(frame, [100, 108], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : frame >= 108
      ? 0
      : 1;
  const badgeTextOpacity = interpolate(frame, [86, 92], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const badgePillOpacity =
    frame >= 100 && frame < 108
      ? interpolate(frame, [100, 108], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : frame >= 108
      ? 1
      : 0;

  // ── Light leak (100-150): warm orange sweep left→right ───────────────────
  const leakT =
    frame >= 100 && frame <= 150 ? clamp((frame - 100) / 50, 0, 1) : -1;
  const leakX =
    leakT >= 0
      ? interpolate(leakT, [0, 1], [-150, 150])
      : -200;
  const leakOpacity =
    leakT >= 0
      ? interpolate(leakT, [0, 0.3, 0.7, 1], [0, 0.6, 0.6, 0])
      : 0;

  // ── Headline scroll up like movie credits (80-130) ───────────────────────
  const headlineOpacity = interpolate(frame, [80, 90], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const headlineTop =
    frame >= 80
      ? interpolate(frame, [80, 130], [H * 0.62, H * 0.46], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : H * 0.62;

  // ── Support credits scroll up (170-220) ──────────────────────────────────
  const supportTop =
    frame >= 170
      ? interpolate(frame, [170, 220], [H * 0.72, H * 0.58], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : H * 0.72;

  // ── Spotlight scan → CTA reveal (170-210) ────────────────────────────────
  const spotlightT = frame >= 170 ? clamp((frame - 170) / 40, 0, 1) : 0;
  const spotlightX = interpolate(spotlightT, [0, 0.6, 1], [-150, 0, 0]);
  const spotlightOpacity = interpolate(
    spotlightT,
    [0, 0.2, 0.8, 1],
    [0, 0.7, 0.9, 0.5]
  );
  const ctaOpacity = interpolate(frame, [200, 212], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── "Try Free" flicker (200-250) ─────────────────────────────────────────
  const finOpacity =
    frame >= 200 && frame < 250
      ? frame % 3 < 2
        ? 1
        : 0.2
      : 0;

  // ── Logo bottom (224-235) ─────────────────────────────────────────────────
  const logoBottomOpacity = interpolate(frame, [224, 235], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── Sprocket hole pattern ─────────────────────────────────────────────────
  const sprocketHoles = Array.from({ length: HOLE_COUNT }, (_, i) => {
    const holeH = 52;
    const gap = 28;
    const totalUnit = holeH + gap;
    const top = 28 + i * totalUnit;
    return top;
  });

  return (
    <AbsoluteFill
      style={{
        background: T.gradient_from,
        overflow: "hidden",
        fontFamily: "Playfair Display, serif",
      }}
    >
      {/* Film grain overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 8,
          pointerEvents: "none",
          opacity: grainOpacity,
          backgroundImage:
            "repeating-radial-gradient(circle at 50% 50%, transparent 1px, rgba(0,0,0,0.18) 2px), repeating-radial-gradient(circle at 20% 80%, transparent 1px, rgba(255,255,255,0.04) 2px)",
          backgroundSize: "4px 4px, 6px 6px",
        }}
      />

      {/* Vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(0,0,0,0.7) 100%)",
          zIndex: 9,
          pointerEvents: "none",
        }}
      />

      {/* Left sprocket strip */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: SPROCKET_W,
          background: "rgba(0,0,0,0.55)",
          zIndex: 10,
          opacity: sprocketOpacity,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          paddingTop: 28,
        }}
      >
        {sprocketHoles.map((top, i) => (
          <div
            key={i}
            style={{
              flexShrink: 0,
              width: 38,
              height: 52,
              background: "#111",
              borderRadius: 10,
              boxShadow: "inset 0 0 0 2px #000",
              marginBottom: 28,
            }}
          />
        ))}
      </div>

      {/* Right sprocket strip */}
      <div
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: SPROCKET_W,
          background: "rgba(0,0,0,0.55)",
          zIndex: 10,
          opacity: sprocketOpacity,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          paddingTop: 28,
        }}
      >
        {sprocketHoles.map((top, i) => (
          <div
            key={i}
            style={{
              flexShrink: 0,
              width: 38,
              height: 52,
              background: "#111",
              borderRadius: 10,
              boxShadow: "inset 0 0 0 2px #000",
              marginBottom: 28,
            }}
          />
        ))}
      </div>

      {/* Content area (between sprockets) */}
      <div
        style={{
          position: "absolute",
          left: SPROCKET_W,
          right: SPROCKET_W,
          top: 0,
          bottom: 0,
          display: "flex",
          flexDirection: "column",
          padding: "60px 40px",
          gap: 36,
        }}
      >
        {/* Logo (blur-to-sharp, sepia shift) */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            opacity: logoOpacity,
            filter: `blur(${logoBlur}px) sepia(${logoSepia})`,
          }}
        >
          <AdLogo
            logoUrl={assets.logoUrl}
            brandName={brandContext.brandName}
            maxHeight={90}
            color={T.badge_text || "#efe7db"}
          />
        </div>

        {/* Photo film frame */}
        <div
          style={{
            position: "relative",
            height: 680,
            flexShrink: 0,
            overflow: "hidden",
            opacity: photoOpacity,
            transform: `translateX(${photoTranslateX}px)`,
          }}
        >
          {/* Film border */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              border: "10px solid #000",
              zIndex: 2,
              pointerEvents: "none",
            }}
          />
          <AdPhoto
            photoUrl={assets.afterPhotoUrl}
            fallbackGradient={`linear-gradient(135deg, ${T.surface}, ${T.gradient_to})`}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
            imgStyle={{ objectFit: "cover" }}
          />
          {/* Grain on photo */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage:
                "repeating-radial-gradient(circle, transparent 1px, rgba(0,0,0,0.12) 2px)",
              backgroundSize: "4px 4px",
              zIndex: 1,
              pointerEvents: "none",
            }}
          />
        </div>

        {/* Clapperboard → badge pill */}
        {clapperVisible && (
          <div
            style={{
              position: "relative",
              height: 100,
              flexShrink: 0,
            }}
          >
            {/* Clapper top half (snaps shut) */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: 50,
                background: T.badge_bg,
                transformOrigin: "bottom center",
                transform: `perspective(600px) rotateX(${clapRotateX}deg)`,
                opacity: clapTopOpacity,
                zIndex: 2,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: 10,
                  backgroundImage:
                    "repeating-linear-gradient(90deg, #000 0, #000 24px, transparent 24px, transparent 48px)",
                }}
              />
            </div>
            {/* Clapper bottom half */}
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                height: 50,
                background: T.badge_bg,
                opacity: clapTopOpacity,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1,
              }}
            >
              <span
                style={{
                  fontSize: 30,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  color: T.badge_text,
                  opacity: badgeTextOpacity,
                }}
              >
                {copy.badge}
              </span>
            </div>
            {/* Full pill badge */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: T.badge_bg,
                borderRadius: 60,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: badgePillOpacity,
                zIndex: 3,
              }}
            >
              <span
                style={{
                  fontSize: 30,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  color: T.badge_text,
                }}
              >
                {copy.badge}
              </span>
            </div>
          </div>
        )}

        {/* Headline scrolls up like movie credits */}
        <div
          style={{
            position: "absolute",
            left: SPROCKET_W + 40,
            right: SPROCKET_W + 40,
            top: headlineTop,
            opacity: headlineOpacity,
            textAlign: "center",
          }}
        >
          {hlLines.map((line, li) => (
            <div
              key={li}
              style={{
                fontSize: 70,
                fontWeight: 800,
                color: T.headline_text,
                lineHeight: 1.35,
              }}
            >
              {line}
            </div>
          ))}
        </div>

        {/* Support text scrolling up like credits */}
        <div
          style={{
            position: "absolute",
            left: SPROCKET_W + 40,
            right: SPROCKET_W + 40,
            top: supportTop,
            fontSize: 36,
            color: T.support_text,
            lineHeight: 1.6,
            textAlign: "center",
          }}
        >
          {copy.support}
        </div>

        {/* "Try Free" flash — above CTA */}
        <div
          style={{
            textAlign: "center",
            opacity: finOpacity,
            flexShrink: 0,
            marginTop: "auto",
          }}
        >
          <div
            style={{
              fontSize: 52,
              fontWeight: 900,
              fontStyle: "italic",
              color: "#fff",
              letterSpacing: "0.12em",
            }}
          >
            Try Free
          </div>
        </div>

        {/* CTA with spotlight */}
        <div
          style={{
            position: "relative",
            flexShrink: 0,
          }}
        >
          {/* Spotlight radial scan */}
          <div
            style={{
              position: "absolute",
              inset: -120,
              background:
                "radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.18) 0%, transparent 60%)",
              opacity: spotlightOpacity,
              transform: `translateX(${spotlightX}%)`,
              pointerEvents: "none",
              zIndex: 1,
            }}
          />
          <div
            style={{
              padding: "46px 60px",
              background: T.cta_bg,
              borderRadius: 24,
              fontSize: 46,
              fontWeight: 700,
              color: T.cta_text,
              textAlign: "center",
              opacity: ctaOpacity,
              position: "relative",
              zIndex: 2,
            }}
          >
            {copy.cta}
          </div>
        </div>

        {/* Logo bottom */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            opacity: logoBottomOpacity,
            paddingBottom: 16,
            flexShrink: 0,
          }}
        >
          <AdLogo
            logoUrl={assets.logoUrl}
            brandName={brandContext.brandName}
            maxHeight={70}
            color={T.badge_text || "#efe7db"}
          />
        </div>
      </div>

      {/* Light leak warm orange sweep */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 7,
          pointerEvents: "none",
          background: `linear-gradient(90deg, transparent, ${T.primary}55, transparent)`,
          opacity: leakOpacity,
          transform: `translateX(${leakX}%)`,
        }}
      />

      {/* Leader flash */}
      {showLeader && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 19,
            background: "rgba(200,200,180,0.12)",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 80,
              border: "8px solid rgba(255,255,255,0.5)",
              borderRadius: 12,
            }}
          />
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: 80,
              right: 80,
              height: 4,
              background: "rgba(255,255,255,0.35)",
              transform: "translateY(-50%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: 80,
              bottom: 80,
              width: 4,
              background: "rgba(255,255,255,0.35)",
              transform: "translateX(-50%)",
            }}
          />
        </div>
      )}

      {/* Countdown overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "#000",
          zIndex: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: countdownOpacity,
          pointerEvents: "none",
        }}
      >
        <div style={{ position: "relative", width: 380, height: 380 }}>
          {/* Crosshair */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: 0,
              right: 0,
              height: 3,
              background: "rgba(255,255,255,0.3)",
              transform: "translateY(-50%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: 0,
              bottom: 0,
              width: 3,
              background: "rgba(255,255,255,0.3)",
              transform: "translateX(-50%)",
            }}
          />
          {/* Circle */}
          <div
            style={{
              position: "absolute",
              inset: 40,
              borderRadius: "50%",
              border: "6px solid rgba(255,255,255,0.4)",
            }}
          />
          {/* Number */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 160,
              fontWeight: 900,
              color: "#fff",
              opacity: countFlicker,
              fontFamily: "Playfair Display, serif",
            }}
          >
            {countNum}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
