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
import { AdBadge } from "../components/AdBadge";
import { springVal, seededRandom } from "../helpers";

// 270 frames @ 30fps — Paper Peel / Physical
export const Template6Peel: React.FC<AdReelProps> = ({
  copy,
  designTokens: T,
  assets,
  brandContext,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ── Photo peel (30-140): perspective rotateX/rotateY/scaleX ────────────
  // Easing helpers (inline for self-containment)
  function easeInOut(t: number): number {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }
  function easeOut(t: number): number {
    return 1 - Math.pow(1 - t, 2);
  }

  const peelRaw = interpolate(frame, [30, 140], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });
  const peelProgress = easeInOut(peelRaw);

  const rotX = interpolate(peelProgress, [0, 1], [0, -35]);
  const rotY = interpolate(peelProgress, [0, 1], [0, 40]);
  const scaleX = interpolate(peelProgress, [0, 1], [1, 0.6]);
  const photoLayerOpacity = interpolate(frame, [140, 170], [1, 0], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });
  const shadowOpacity = interpolate(peelProgress, [0, 0.5, 1], [0, 0.8, 0]);

  // Paper texture — repeating dot pattern
  const paperTextureStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    backgroundImage:
      "repeating-radial-gradient(circle at 1px 1px, rgba(255,255,255,0.04) 1px, transparent 1px)",
    backgroundSize: "12px 12px",
    pointerEvents: "none",
  };

  // ── Badge slides from behind peel (80-120) ─────────────────────────────
  const badgeSpring = springVal(frame, fps, 80, { damping: 10, stiffness: 120 });
  const badgeX = interpolate(badgeSpring, [0, 1], [180, 0]);
  const badgeOpacity = interpolate(frame, [80, 95], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  // ── Headline clip wipe synced to peel (100-150) ─────────────────────────
  const wipeRaw = interpolate(frame, [100, 150], [100, 0], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });
  const wipe = easeOut(1 - wipeRaw / 100) * 100;
  const headlineClipPath = `inset(0 ${100 - wipe}% 0 0)`;

  // SVG underline draw (130-160)
  const underlineDash = interpolate(frame, [130, 160], [660, 0], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });
  const underlineOpacity = interpolate(frame, [128, 135], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  // Logo at top reveals as peel exposes content (100-115)
  const logoOpacity = interpolate(frame, [100, 115], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  // Small photo under peel (145-165)
  const smallPhotoSpring = springVal(frame, fps, 145, { damping: 12, stiffness: 100 });
  const smallPhotoOpacity = Math.min(1, Math.max(0, smallPhotoSpring));
  const smallPhotoScale = interpolate(smallPhotoSpring, [0, 1], [0.92, 1]);

  // ── Support text char-by-char with jitter (170-210) ────────────────────
  const supportChars = copy.support.split("");

  // ── CTA border traces then fills (200-240) ─────────────────────────────
  const ctaTraceP = interpolate(frame, [200, 230], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });
  const ctaBorderOpacity = Math.min(1, ctaTraceP * 2);
  const ctaGlow = ctaTraceP * 24;
  const ctaFillScaleX = interpolate(frame, [228, 240], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  // ── Logo stamp at bottom (240-270) ─────────────────────────────────────
  const stampSpring = springVal(frame, fps, 240, { damping: 6, stiffness: 200 });
  const stampOpacity = interpolate(frame, [240, 248], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });
  const stampScale = interpolate(stampSpring, [0, 1], [1.4, 1]);

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(160deg, ${T.gradient_from}, ${T.gradient_to})`,
        overflow: "hidden",
      }}
    >

      {/* ── Content underneath peel ─────────────────────────────────────── */}
      <AbsoluteFill>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            padding: "72px 60px",
            gap: 36,
          }}
        >
          {/* Logo */}
          <div style={{ opacity: logoOpacity, height: 108 }}>
            <AdLogo
              logoUrl={assets.logoUrl}
              brandName={brandContext.brandName}
              maxHeight={96}
              color={T.badge_text || "#efe7db"}
            />
          </div>

          {/* Badge */}
          <div
            style={{
              opacity: badgeOpacity,
              transform: `translateX(${badgeX}px)`,
              alignSelf: "flex-start",
            }}
          >
            <AdBadge
              text={copy.badge}
              bgColor={T.badge_bg}
              textColor={T.badge_text}
              style={{ fontSize: 28, padding: "14px 36px", borderRadius: 60 }}
            />
          </div>

          {/* Small photo */}
          <div
            style={{
              width: "100%",
              height: 420,
              borderRadius: 36,
              overflow: "hidden",
              opacity: smallPhotoOpacity,
              transform: `scale(${smallPhotoScale})`,
            }}
          >
            <AdPhoto
              photoUrl={assets.afterPhotoUrl}
              fallbackGradient={`linear-gradient(135deg, ${T.surface}, ${T.gradient_to})`}
              style={{ width: "100%", height: "100%" }}
              imgStyle={{ objectFit: "cover" }}
            />
          </div>

          {/* Headline with clip wipe */}
          <div style={{ position: "relative", overflow: "visible", marginTop: 12 }}>
            <div
              style={{
                fontSize: 52,
                fontWeight: 800,
                color: T.headline_text,
                lineHeight: 1.35,
                clipPath: headlineClipPath,
              }}
            >
              {copy.headline}
            </div>
            {/* Animated underline */}
            <svg
              style={{
                position: "absolute",
                bottom: -12,
                left: 0,
                width: "100%",
                height: 24,
                overflow: "visible",
                opacity: underlineOpacity,
              }}
              viewBox="0 0 960 24"
              preserveAspectRatio="none"
            >
              <path
                d="M0,15 Q80,3 160,15 Q240,27 320,15 Q400,3 480,15 Q560,27 640,15 Q720,3 800,15 Q880,27 960,15"
                fill="none"
                stroke={T.primary}
                strokeWidth="7.5"
                strokeLinecap="round"
                strokeDasharray="1100"
                strokeDashoffset={underlineDash}
              />
            </svg>
          </div>

          {/* Support text char-by-char */}
          <div
            style={{
              fontSize: 33,
              color: T.support_text,
              lineHeight: 1.6,
              marginTop: 12,
            }}
          >
            {supportChars.map((ch, i) => {
              if (frame < 170) return null;
              const delay = (i / supportChars.length) * 40 + ((i * 7) % 5 - 2);
              const charF = frame - 170 - delay;
              const charOpacity = interpolate(charF, [0, 4], [0, 1], {
                extrapolateRight: "clamp",
                extrapolateLeft: "clamp",
              });
              // Jitter: tiny translateY based on seeded random
              const jitterY = charOpacity < 1 ? (seededRandom(i * 3.7 + frame * 0.1) - 0.5) * 6 : 0;
              return (
                <span
                  key={i}
                  style={{
                    opacity: charOpacity,
                    display: "inline",
                    transform: `translateY(${jitterY}px)`,
                  }}
                >
                  {ch === " " ? "\u00a0" : ch}
                </span>
              );
            })}
          </div>

          {/* CTA — border trace then fill */}
          <div style={{ marginTop: "auto", position: "relative" }}>
            <div
              style={{
                padding: "36px 60px",
                borderRadius: 24,
                fontSize: 39,
                fontWeight: 700,
                color: T.cta_text,
                textAlign: "center",
                position: "relative",
                overflow: "hidden",
              }}
            >
              {/* Border trace */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: 24,
                  border: `6px solid ${T.cta_bg}`,
                  opacity: ctaBorderOpacity,
                  boxShadow: `0 0 ${ctaGlow}px ${T.cta_bg}`,
                  pointerEvents: "none",
                }}
              />
              {/* Fill */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: T.cta_bg,
                  transform: `scaleX(${ctaFillScaleX})`,
                  transformOrigin: "left",
                  borderRadius: 24,
                }}
              />
              <span style={{ position: "relative", zIndex: 1 }}>{copy.cta}</span>
            </div>
          </div>
        </div>
      </AbsoluteFill>

      {/* ── Peeling photo layer ──────────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          perspective: 1800,
          transformStyle: "preserve-3d",
          opacity: photoLayerOpacity,
          pointerEvents: "none",
        }}
      >
        {/* The photo page — transforms as if top-right corner peeling */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            transformOrigin: "top right",
            transform: `perspective(1800px) rotateX(${rotX}deg) rotateY(${rotY}deg) scaleX(${scaleX})`,
            transformStyle: "preserve-3d",
            backfaceVisibility: "hidden",
          }}
        >
          {/* Front face — paper texture + photo */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `linear-gradient(135deg, ${T.surface} 0%, ${T.gradient_to} 50%, ${T.gradient_from} 100%)`,
              backfaceVisibility: "hidden",
              overflow: "hidden",
            }}
          >
            <div style={paperTextureStyle} />
            {/* Watermark brand */}
            <div
              style={{
                position: "absolute",
                bottom: 60,
                right: 48,
                fontSize: 33,
                fontWeight: 700,
                letterSpacing: "3px",
                color: "white",
                opacity: 0.15,
              }}
            >
              {brandContext.brandName.toUpperCase()}
            </div>
            {/* Inset photo */}
            <div
              style={{
                position: "absolute",
                inset: 120,
                borderRadius: 30,
                overflow: "hidden",
              }}
            >
              <AdPhoto
                photoUrl={assets.afterPhotoUrl}
                fallbackGradient={`linear-gradient(45deg, ${T.surface}, ${T.gradient_to})`}
                style={{ width: "100%", height: "100%" }}
                imgStyle={{ objectFit: "cover" }}
              />
            </div>
          </div>

          {/* Back face — lighter parchment color (visible as page curls) */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(135deg, #c8a080, #e8d0b0)",
              transform: "rotateY(180deg)",
              backfaceVisibility: "hidden",
            }}
          />
        </div>

        {/* Peel shadow */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse at top right, rgba(0,0,0,0.5) 0%, transparent 60%)",
            opacity: shadowOpacity,
            pointerEvents: "none",
          }}
        />
      </div>

      {/* ── Logo stamp at bottom (240-270) ─────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          bottom: 72,
          left: "50%",
          transform: `translateX(-50%) scale(${stampScale})`,
          opacity: stampOpacity,
          zIndex: 10,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <AdLogo
          logoUrl={assets.logoUrl}
          brandName={brandContext.brandName}
          maxHeight={84}
          color={T.badge_text || "#efe7db"}
        />
      </div>
    </AbsoluteFill>
  );
};
