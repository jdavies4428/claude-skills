import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Sequence,
} from "remotion";
import { AdReelProps } from "../schema";
import { AdLogo } from "../components/AdLogo";
import { AdPhoto } from "../components/AdPhoto";
import { seededRandom, clamp, splitHighlight } from "../helpers";

// 300 frames @ 30fps — The Orbit (cosmic spiral)
const W = 1080;
const H = 1920;
const CX = W / 2; // 540
const CY = H / 2; // 960

function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 2);
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

// Generate deterministic star positions
const STARS = Array.from({ length: 60 }, (_, i) => ({
  x: seededRandom(i * 3.1) * W,
  y: seededRandom(i * 7.3) * H,
  size: 1 + seededRandom(i * 2.7) * 4,
  opacity: 0.08 + seededRandom(i * 5.1) * 0.18,
  phaseOffset: seededRandom(i * 11.3) * Math.PI * 2,
}));

// CTA particle orbit config
const CTA_PARTICLES = Array.from({ length: 20 }, (_, i) => {
  const angle = (i / 20) * Math.PI * 2;
  const r = 200 + seededRandom(i * 4.4) * 120;
  return { angle, r };
});

export const Template8Orbit: React.FC<AdReelProps> = ({
  copy,
  designTokens: T,
  assets,
  brandContext,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const words = copy.headline.split(" ");
  const highlightIdx = words.findIndex(
    (w) => w.toLowerCase().includes(copy.highlight?.toLowerCase() ?? "")
  );

  // ── Central dot pulse (0-70) ──────────────────────────────────────────────
  const dotOpacity =
    frame < 10
      ? interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" })
      : frame < 50
      ? 1
      : interpolate(frame, [50, 70], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
  const dotPulse = 0.8 + 0.4 * Math.sin(frame * 0.4);

  // ── Logo orbit spiral inward (frames 20-60), then settle top ─────────────
  let logoX = CX;
  let logoY = 130;
  let logoOpacity = 0;
  let logoVisible = false;

  if (frame >= 20 && frame <= 250) {
    logoVisible = true;
    if (frame <= 60) {
      const t = easeOut(clamp((frame - 20) / 40, 0, 1));
      const r = interpolate(t, [0, 1], [380, 0]);
      const angle = -Math.PI / 2 + (1 - t) * Math.PI * 3;
      logoX = CX + Math.cos(angle) * r;
      logoY = CY + Math.sin(angle) * r;
      logoOpacity = clamp(t * 2, 0, 1);
    } else {
      const floatY = Math.sin(frame * 0.05) * 8;
      logoX = CX;
      logoY = 130 + floatY;
      logoOpacity = 1;
    }
  } else if (frame > 250) {
    logoVisible = false;
    logoOpacity = interpolate(frame, [250, 260], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    logoX = CX;
    logoY = 130;
    logoVisible = logoOpacity > 0;
  }

  // Ghost trails (offset 5 frames back per ghost)
  const ghostData = [1, 2, 3].map((g) => {
    if (frame < 20 || frame > 65) return { x: CX, y: CY, opacity: 0 };
    const backF = frame - g * 5;
    if (backF < 20 || backF > 60) return { x: CX, y: CY, opacity: 0 };
    const t = easeOut(clamp((backF - 20) / 40, 0, 1));
    const r = interpolate(t, [0, 1], [380, 0]);
    const angle = -Math.PI / 2 + (1 - t) * Math.PI * 3;
    return {
      x: CX + Math.cos(angle) * r,
      y: CY + Math.sin(angle) * r,
      opacity: 0.3 - g * 0.08,
    };
  });

  // ── Badge spiral (50-90), settle at 90+ ───────────────────────────────────
  let badgeX = CX;
  let badgeY = 260;
  let badgeOpacity = 0;

  if (frame >= 50) {
    if (frame <= 90) {
      const t = easeOut(clamp((frame - 50) / 40, 0, 1));
      const r = interpolate(t, [0, 1], [600, 0]);
      const angle = Math.PI / 4 + (1 - t) * Math.PI * 1.5;
      badgeX = CX + Math.cos(angle) * r;
      badgeY = CY + Math.sin(angle) * r;
      badgeOpacity = clamp(t * 3, 0, 1);
    } else {
      const floatY = Math.sin(frame * 0.05 + 1) * 8;
      badgeX = CX;
      badgeY = 260 + floatY;
      badgeOpacity = 1;
    }
  }

  // ── Headline words orbit in (80-145), then show full text ────────────────
  const wordData = words.map((word, i) => {
    const wordStart = 80 + i * 7;
    if (frame < wordStart) return { x: 0, y: 0, opacity: 0 };
    const t = easeOut(clamp((frame - wordStart) / 25, 0, 1));
    const r = interpolate(t, [0, 1], [500, 0]);
    const angle = (i / words.length) * Math.PI * 2 - Math.PI / 2;
    // Target position: grid-like layout in headline zone
    const cols = 4;
    const targetX = 80 + (i % cols) * 240 + 120;
    const targetY = 680 + Math.floor(i / cols) * 100 + 50;
    const px = CX + Math.cos(angle) * r * (1 - t) + targetX * t;
    const py = CY + Math.sin(angle) * r * (1 - t) + targetY * t;
    return { x: px, y: py, opacity: clamp(t * 2, 0, 1) };
  });

  const showFullHeadline = frame >= 145;

  // Flash on highlight word arrival
  const lastWordStart = 80 + (words.length - 1) * 7;
  const flashOpacity =
    frame >= lastWordStart && frame <= lastWordStart + 4
      ? interpolate(frame, [lastWordStart, lastWordStart + 4], [0.6, 0], {
          extrapolateRight: "clamp",
        })
      : 0;

  // ── Photo morph (130-170): circle → rectangle ────────────────────────────
  const photoSpring = spring({
    frame: Math.max(0, frame - 130),
    fps,
    config: { damping: 12, stiffness: 80 },
  });
  const photoVisible = frame >= 130;
  const photoWidth = interpolate(photoSpring, [0, 1], [0, 860]);
  const photoHeight = interpolate(photoSpring, [0, 1], [0, 540]);
  const photoBorderRadius = interpolate(photoSpring, [0, 1], [50, 3.6]); // percent
  const photoRotation = interpolate(photoSpring, [0, 1], [-15, 0]);
  const photoOpacity = photoVisible ? clamp(photoSpring * 3, 0, 1) : 0;

  // ── Support text (160-200) ────────────────────────────────────────────────
  const supportSpring = spring({
    frame: Math.max(0, frame - 160),
    fps,
    config: { damping: 14, stiffness: 90 },
  });
  const supportOpacity = clamp(supportSpring * 2, 0, 1);
  const supportY = interpolate(supportSpring, [0, 1], [40, 0]);

  // ── CTA particles converge (200-250) ─────────────────────────────────────
  const ctaAreaCX = CX;
  const ctaAreaCY = H - 200; // CTA center Y

  const particleData = CTA_PARTICLES.map(({ angle, r }) => {
    if (frame < 200) return { x: 0, y: 0, opacity: 0 };
    const t = clamp((frame - 200) / 40, 0, 1);
    const curR = r * (1 - easeInOut(t));
    return {
      x: ctaAreaCX + Math.cos(angle) * curR,
      y: ctaAreaCY + Math.sin(angle) * curR,
      opacity:
        t < 0.9
          ? clamp(t * 3, 0, 0.9)
          : interpolate(frame, [235, 242], [0.9, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
    };
  });

  const ctaSpring = spring({
    frame: Math.max(0, frame - 236),
    fps,
    config: { damping: 12, stiffness: 180 },
  });
  const ctaOpacity =
    frame >= 236
      ? clamp(ctaSpring * 4, 0, 1)
      : frame > 240
      ? 1
      : 0;
  const ctaScale = frame >= 236 ? interpolate(ctaSpring, [0, 1], [0.9, 1]) : 0.9;

  // ── Logo bottom (250+) ────────────────────────────────────────────────────
  const logoBottomOpacity = interpolate(frame, [250, 265], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── Ambient float (270+) ──────────────────────────────────────────────────
  function ambientFloat(idx: number): { x: number; y: number } {
    if (frame < 270) return { x: 0, y: 0 };
    const dy = Math.sin(frame * 0.04 + idx * 1.2) * 6;
    const dx = Math.cos(frame * 0.03 + idx * 0.8) * 3;
    return { x: dx, y: dy };
  }

  const badgeFloat = ambientFloat(0);
  const ctaFloat = ambientFloat(1);
  const supportFloat = ambientFloat(2);
  const hlFloat = ambientFloat(3);

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at 50% 50%, ${T.gradient_to} 0%, ${T.gradient_from} 70%)`,
        overflow: "hidden",
        fontFamily: "Playfair Display, serif",
      }}
    >
      {/* Star field */}
      {STARS.map((star, i) => {
        const twinkle = 0.7 + 0.3 * Math.sin(frame * 0.03 + star.phaseOffset);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: star.x,
              top: star.y,
              width: star.size,
              height: star.size,
              borderRadius: "50%",
              background: "rgba(255,255,255,1)",
              opacity: star.opacity * twinkle,
            }}
          />
        );
      })}

      {/* Central pulsing dot */}
      <div
        style={{
          position: "absolute",
          left: CX,
          top: CY,
          width: 48,
          height: 48,
          borderRadius: "50%",
          background: T.primary,
          transform: `translate(-50%, -50%) scale(${dotPulse})`,
          opacity: dotOpacity,
          boxShadow: `0 0 80px ${T.primary}, 0 0 160px ${T.primary}66`,
        }}
      />

      {/* Logo ghost trails */}
      {ghostData.map((g, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: g.x,
            top: g.y,
            transform: "translate(-50%, -50%)",
            opacity: g.opacity,
            fontSize: 28,
            fontWeight: 800,
            letterSpacing: 4,
            color: T.primary,
            whiteSpace: "nowrap",
          }}
        >
          {brandContext.brandName}
        </div>
      ))}

      {/* Logo orbiting */}
      {(logoVisible || logoOpacity > 0) && (
        <div
          style={{
            position: "absolute",
            left: logoX,
            top: logoY,
            transform: "translate(-50%, -50%)",
            opacity: logoOpacity,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <AdLogo
            logoUrl={assets.logoUrl}
            brandName={brandContext.brandName}
            maxHeight={80}
            color={T.badge_text || "#efe7db"}
            style={{ filter: "drop-shadow(0 0 24px rgba(0,0,0,0.6))" }}
          />
        </div>
      )}

      {/* Badge spiral in */}
      <div
        style={{
          position: "absolute",
          left: badgeX,
          top: badgeY + badgeFloat.y,
          transform: `translate(-50%, -50%) translateX(${badgeFloat.x}px)`,
          opacity: badgeOpacity,
          padding: "16px 48px",
          background: T.badge_bg,
          borderRadius: 60,
          fontSize: 30,
          fontWeight: 700,
          color: T.badge_text,
          whiteSpace: "nowrap",
          letterSpacing: "0.06em",
        }}
      >
        {copy.badge}
      </div>

      {/* Headline word orbit layer */}
      {!showFullHeadline &&
        wordData.map((wd, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: wd.x,
              top: wd.y,
              transform: "translate(-50%, -50%)",
              opacity: wd.opacity,
              fontSize: 60,
              fontWeight: 800,
              color: i === highlightIdx ? T.badge_bg : T.headline_text,
              whiteSpace: "nowrap",
            }}
          >
            {words[i]}
          </div>
        ))}

      {/* Flash burst overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "#fff",
          opacity: flashOpacity,
          pointerEvents: "none",
          borderRadius: 96,
        }}
      />

      {/* Full headline (after words snap) */}
      {showFullHeadline && (
        <div
          style={{
            position: "absolute",
            left: 80,
            right: 80,
            top: 680 + hlFloat.y,
            transform: `translateX(${hlFloat.x}px)`,
          }}
        >
          <div
            style={{
              fontSize: 72,
              fontWeight: 800,
              color: T.headline_text,
              lineHeight: 1.3,
            }}
          >
            {splitHighlight(copy.headline, copy.highlight ?? "").map(
              (seg, i) => (
                <span
                  key={i}
                  style={{ color: seg.isHighlight ? T.badge_bg : T.headline_text }}
                >
                  {seg.text}
                </span>
              )
            )}
          </div>
        </div>
      )}

      {/* Photo morph */}
      {photoVisible && (
        <div
          style={{
            position: "absolute",
            left: CX - photoWidth / 2,
            top: CY - 420 - photoHeight / 2,
            width: photoWidth,
            height: photoHeight,
            borderRadius: `${photoBorderRadius}%`,
            overflow: "hidden",
            transform: `rotate(${photoRotation}deg)`,
            opacity: photoOpacity,
          }}
        >
          <AdPhoto
            photoUrl={assets.afterPhotoUrl}
            fallbackGradient={`linear-gradient(135deg, ${T.surface}, ${T.gradient_to})`}
            style={{ width: "100%", height: "100%" }}
            imgStyle={{ objectFit: "cover" }}
          />
        </div>
      )}

      {/* Support text */}
      <div
        style={{
          position: "absolute",
          left: 80,
          right: 80,
          bottom: 420,
          opacity: supportOpacity,
          transform: `translateY(${supportY + supportFloat.y}px) translateX(${supportFloat.x}px)`,
          fontSize: 38,
          color: T.support_text,
          lineHeight: 1.6,
          textAlign: "center",
        }}
      >
        {copy.support}
      </div>

      {/* CTA particle layer */}
      {frame >= 200 && frame < 242 &&
        particleData.map((p, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: p.x,
              top: p.y,
              width: 18,
              height: 18,
              borderRadius: "50%",
              background: T.primary,
              transform: "translate(-50%, -50%)",
              opacity: p.opacity,
            }}
          />
        ))}

      {/* CTA button */}
      <div
        style={{
          position: "absolute",
          left: 80,
          right: 80,
          bottom: 160,
          height: 130,
          background: T.cta_bg,
          borderRadius: 30,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 48,
          fontWeight: 700,
          color: T.cta_text,
          opacity: ctaOpacity,
          transform: `scale(${ctaScale}) translateY(${ctaFloat.y}px) translateX(${ctaFloat.x}px)`,
        }}
      >
        {copy.cta}
      </div>

      {/* Logo bottom */}
      <div
        style={{
          position: "absolute",
          bottom: 60,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          opacity: logoBottomOpacity,
        }}
      >
        <AdLogo
          logoUrl={assets.logoUrl}
          brandName={brandContext.brandName}
          maxHeight={70}
          color={T.badge_text || "#efe7db"}
        />
      </div>
    </AbsoluteFill>
  );
};
