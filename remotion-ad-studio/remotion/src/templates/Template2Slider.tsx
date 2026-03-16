import React from "react";
import {
  AbsoluteFill,
  Img,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { AdBackground } from "../components/AdBackground";
import { AdLogo } from "../components/AdLogo";
import { AdBadge } from "../components/AdBadge";
import { AdPhoto } from "../components/AdPhoto";
import { AdSupport } from "../components/AdSupport";
import { AdCta } from "../components/AdCta";
import type { AdReelProps } from "../schema";

// ─── Template 2: The Slider Reveal ───────────────────────────────────────────
// 300 frames / 10s @ 30fps
// Before/after comparison slider — signature interaction for photo restoration.

export const Template2Slider: React.FC<AdReelProps> = ({
  copy,
  designTokens: dt,
  assets,
  brandContext,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ── Logo springs in (0-30) ──────────────────────────────────────────────────
  const logoSpring = spring({
    frame: Math.max(0, frame),
    fps,
    config: { damping: 12, stiffness: 100 },
  });
  const logoScale = interpolate(logoSpring, [0, 1], [0.8, 1]);
  const logoOp = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── Badge pops (20-50): scale 0→1.1→1 ──────────────────────────────────────
  const badgeSpring = spring({
    frame: Math.max(0, frame - 20),
    fps,
    config: { damping: 10, stiffness: 250, mass: 0.7 },
  });
  const badgeScale = interpolate(badgeSpring, [0, 1], [0, 1]);

  // ── Slider sweep (60-150) ───────────────────────────────────────────────────
  const sliderPct = interpolate(frame, [60, 150], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // "After" photo revealed via clipPath inset
  const afterClip = `inset(0 ${100 - sliderPct}% 0 0)`;

  // After label appears when slider crosses 50%
  const afterLabelOp = interpolate(frame, [100, 120], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── Headline springs in from below (140-180) ─────────────────────────────────
  const hlSpring = spring({
    frame: Math.max(0, frame - 140),
    fps,
    config: { damping: 12, stiffness: 120 },
  });
  const hlY = interpolate(hlSpring, [0, 1], [16, 0]);
  const hlOp = interpolate(frame, [140, 160], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Underline self-draws on highlight word (165-185)
  const underlinePct = interpolate(frame, [165, 185], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── Support fades in (170-210) ───────────────────────────────────────────────
  const supportOp = interpolate(frame, [170, 210], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── CTA slides up (200-260) ──────────────────────────────────────────────────
  const ctaSpring = spring({
    frame: Math.max(0, frame - 200),
    fps,
    config: { damping: 14, stiffness: 120 },
  });
  const ctaY = interpolate(ctaSpring, [0, 1], [60, 0]);
  const ctaOp = interpolate(frame, [200, 220], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── Logo pulse outro (260-300) ───────────────────────────────────────────────
  const pulseProg =
    interpolate(frame, [260, 280], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) -
    interpolate(frame, [280, 300], [0, 0.3], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const logoGlow = pulseProg * 10;

  // ── Headline word rendering with underline ───────────────────────────────────
  const highlightLower = copy.highlight.toLowerCase();
  const headlineWords = copy.headline.split(" ");

  return (
    <AbsoluteFill style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      {/* Background */}
      <AdBackground
        gradientFrom={dt.gradient_from}
        gradientTo={dt.gradient_to}
        angle="180deg"
      />

      {/* Logo springs in at top (0-30) */}
      <div
        style={{
          position: "absolute",
          top: 14,
          left: "50%",
          transform: `translateX(-50%) scale(${logoScale})`,
          opacity: logoOp,
          zIndex: 10,
          width: 80,
          height: 36,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          filter: logoGlow > 0 ? `drop-shadow(0 0 ${logoGlow}px ${dt.primary})` : undefined,
        }}
      >
        <AdLogo
          logoUrl={assets.logoUrl}
          brandName={brandContext.brandName}
          maxHeight={36}
          style={{ filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.5))" }}
        />
      </div>

      {/* Badge pops (20-50) */}
      <AdBadge
        text={copy.badge}
        bgColor={dt.badge_bg}
        textColor={dt.badge_text}
        style={{
          position: "absolute",
          top: 50,
          right: 12,
          transform: `scale(${badgeScale})`,
          transformOrigin: "right center",
          zIndex: 10,
          borderRadius: 20,
        }}
      />

      {/* Photo container: before/after (30-150) */}
      <div
        style={{
          position: "absolute",
          top: 80,
          left: 12,
          right: 12,
          height: 210,
          borderRadius: 8,
          overflow: "hidden",
          boxShadow: "0 8px 30px rgba(0,0,0,0.5)",
        }}
      >
        {/* Before photo — sepia/grayscale degraded look */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            filter: "sepia(0.8) grayscale(0.3) brightness(0.8)",
            overflow: "hidden",
          }}
        >
          <AdPhoto
            photoUrl={assets.beforePhotoUrl ?? assets.afterPhotoUrl}
            fallbackGradient={`linear-gradient(135deg, ${dt.gradient_from} 0%, ${dt.gradient_to} 100%)`}
            style={{ width: "100%", height: "100%" }}
          />
        </div>

        {/* After photo — full color, masked by clipPath */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            clipPath: afterClip,
            overflow: "hidden",
          }}
        >
          <AdPhoto
            photoUrl={assets.afterPhotoUrl}
            fallbackGradient={`linear-gradient(135deg, ${dt.gradient_from} 0%, ${dt.gradient_to} 100%)`}
            style={{ width: "100%", height: "100%" }}
          />
        </div>

        {/* Before label */}
        <div
          style={{
            position: "absolute",
            top: 8,
            left: 10,
            fontSize: 9,
            fontWeight: 700,
            color: "rgba(255,255,255,0.7)",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            background: "rgba(0,0,0,0.4)",
            padding: "2px 6px",
            borderRadius: 3,
          }}
        >
          BEFORE
        </div>

        {/* After label — fades in when slider passes 50% */}
        <div
          style={{
            position: "absolute",
            top: 8,
            right: 10,
            fontSize: 9,
            fontWeight: 700,
            color: "rgba(255,255,255,0.9)",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            background: "rgba(0,0,0,0.5)",
            padding: "2px 6px",
            borderRadius: 3,
            opacity: afterLabelOp,
          }}
        >
          AFTER
        </div>

        {/* Divider line with circular handle */}
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${sliderPct}%`,
            width: 2,
            background: "rgba(255,255,255,0.9)",
            boxShadow:
              "0 0 12px rgba(255,255,255,0.8), 0 0 4px rgba(255,255,255,1)",
            zIndex: 5,
          }}
        >
          {/* Circular handle */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%,-50%)",
              width: 24,
              height: 24,
              borderRadius: "50%",
              background: "white",
              boxShadow:
                "0 0 12px rgba(255,255,255,0.8), 0 2px 8px rgba(0,0,0,0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 8,
              color: "#333",
              fontWeight: 800,
            }}
          >
            ⟺
          </div>
        </div>
      </div>

      {/* Headline springs in (140-180) with self-drawing underline */}
      <div
        style={{
          position: "absolute",
          top: 308,
          left: 12,
          right: 12,
          fontSize: 16,
          fontWeight: 800,
          color: dt.headline_text,
          lineHeight: 1.3,
          opacity: hlOp,
          transform: `translateY(${hlY}px)`,
        }}
      >
        {headlineWords.map((word, wi) => {
          const isHl =
            word.toLowerCase().includes(highlightLower) ||
            highlightLower.split(" ").some((hw) => word.toLowerCase().includes(hw));
          return (
            <span key={wi}>
              {isHl ? (
                <span style={{ position: "relative", display: "inline" }}>
                  {word}
                  {/* Self-drawing underline */}
                  <span
                    style={{
                      position: "absolute",
                      bottom: -2,
                      left: 0,
                      height: 2,
                      background: dt.primary,
                      width: `${underlinePct}%`,
                      borderRadius: 1,
                    }}
                  />
                </span>
              ) : (
                word
              )}
              {wi < headlineWords.length - 1 ? " " : ""}
            </span>
          );
        })}
      </div>

      {/* Support fades in (170-210) */}
      <AdSupport
        text={copy.support}
        color={dt.support_text}
        style={{
          position: "absolute",
          top: 400,
          left: 12,
          right: 12,
          opacity: supportOp,
        }}
      />

      {/* CTA slides up (200-260) */}
      <div
        style={{
          position: "absolute",
          bottom: 30,
          left: "50%",
          transform: `translateX(-50%) translateY(${ctaY}px)`,
          opacity: ctaOp,
        }}
      >
        <AdCta
          text={copy.cta}
          bgColor={dt.cta_bg}
          textColor={dt.cta_text}
        />
      </div>
    </AbsoluteFill>
  );
};
