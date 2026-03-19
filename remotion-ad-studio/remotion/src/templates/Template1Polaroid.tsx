import React from "react";
import {
  AbsoluteFill,
  Sequence,
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
import { splitHighlight } from "../helpers";
import type { AdReelProps } from "../schema";

// ─── Template 1: The Polaroid Drop ───────────────────────────────────────────
// 240 frames / 8s @ 30fps
// Physical, tactile feel — objects drop and bounce like real objects.

export const Template1Polaroid: React.FC<AdReelProps> = ({
  copy,
  designTokens: dt,
  assets,
  brandContext,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ── Shutter pulse (0-30) ────────────────────────────────────────────────────
  const shutterOp =
    interpolate(frame, [0, 10], [0, 0.6], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) -
    interpolate(frame, [20, 30], [0, 0.6], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const shutterScale = 0.8 + 0.4 * Math.abs(Math.sin(frame * 0.3));

  // ── Logo drop (15-45) bounce spring ─────────────────────────────────────────
  const logoSpring = spring({
    frame: Math.max(0, frame - 15),
    fps,
    config: { damping: 8, stiffness: 120, mass: 1.2 },
  });
  const logoY = interpolate(logoSpring, [0, 1], [-80, 0]);
  const logoOp = interpolate(frame, [15, 28], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // Shadow opacity on landing
  const logoShadowOp = interpolate(logoSpring, [0.8, 1], [0, 0.8], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── Polaroid drop (40-70) bounce spring ─────────────────────────────────────
  const polSpring = spring({
    frame: Math.max(0, frame - 40),
    fps,
    config: { damping: 8, stiffness: 100, mass: 1.5 },
  });
  const polY = interpolate(polSpring, [0, 1], [-400, 0]);
  const polOp = interpolate(frame, [40, 52], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── Impact ripple (66-84) ───────────────────────────────────────────────────
  const rippleProg = interpolate(frame, [66, 84], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const rippleSize = interpolate(rippleProg, [0, 1], [0, 140]);
  const rippleOp = interpolate(rippleProg, [0, 0.3, 1], [0, 0.7, 0]);

  // ── Badge slides in from left (60-90) snappy spring ─────────────────────────
  const badgeSpring = spring({
    frame: Math.max(0, frame - 60),
    fps,
    config: { damping: 10, stiffness: 200, mass: 0.8 },
  });
  const badgeX = interpolate(badgeSpring, [0, 1], [-120, 14]);

  // ── Headline typewriter (80-140) ────────────────────────────────────────────
  const charsToShow = Math.floor(
    interpolate(frame, [80, 140], [0, copy.headline.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
  );
  const showCursor = frame >= 80 && frame < 150;
  const cursorBlink = Math.floor(frame / 8) % 2 === 0 ? 1 : 0;

  // Build headline segments with highlight support
  const highlightLower = copy.highlight.toLowerCase();
  const headlineWords = copy.headline.split(" ");
  let charCount = 0;
  const headlineSegments: Array<{ text: string; isHighlight: boolean; visible: boolean; partial: boolean }> = [];
  headlineWords.forEach((word, wi) => {
    const wordStart = charCount;
    const wordEnd = charCount + word.length;
    const isHighlight = word.toLowerCase().includes(highlightLower) ||
      highlightLower.split(" ").some((hw) => word.toLowerCase().includes(hw));
    const visibleChars = Math.max(0, charsToShow - wordStart);
    const visiblePart = word.slice(0, visibleChars);
    headlineSegments.push({
      text: visiblePart + (wi < headlineWords.length - 1 && wordEnd < charsToShow ? " " : ""),
      isHighlight: isHighlight && charsToShow >= wordEnd,
      visible: wordStart < charsToShow,
      partial: !isHighlight || charsToShow < wordEnd,
    });
    charCount += word.length + 1;
  });

  // ── Support fade in (130-170) ────────────────────────────────────────────────
  const supportOp = interpolate(frame, [130, 170], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const supportY = interpolate(frame, [130, 160], [8, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── CTA bounce up (160-200) ─────────────────────────────────────────────────
  const ctaSpring = spring({
    frame: Math.max(0, frame - 160),
    fps,
    config: { damping: 12, stiffness: 150, mass: 1 },
  });
  const ctaY = interpolate(ctaSpring, [0, 1], [80, 0]);
  const ctaOp = interpolate(frame, [160, 175], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── Outro zoom (200-240) ────────────────────────────────────────────────────
  const outroScale = interpolate(frame, [200, 240], [1, 0.95], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ fontFamily: "Playfair Display, serif" }}>
      {/* Background */}
      <AdBackground
        gradientFrom={dt.gradient_from}
        gradientTo={dt.gradient_to}
        angle="180deg"
      />

      {/* Outro scale wrapper */}
      <AbsoluteFill
        style={{
          transform: `scale(${outroScale})`,
          transformOrigin: "center center",
        }}
      >
        {/* Camera shutter icon (0-30) */}
        <div
          style={{
            position: "absolute",
            top: 30,
            left: "50%",
            transform: `translateX(-50%) scale(${shutterScale})`,
            fontSize: 22,
            opacity: Math.max(0, shutterOp),
            userSelect: "none",
          }}
        >
          📷
        </div>

        {/* Logo shadow (appears on landing) */}
        <div
          style={{
            position: "absolute",
            top: 76,
            left: "50%",
            transform: "translateX(-50%)",
            width: 80,
            height: 4,
            background: "rgba(0,0,0,0.4)",
            borderRadius: "50%",
            filter: "blur(4px)",
            opacity: logoShadowOp,
          }}
        />

        {/* Logo drop (15-45) */}
        <div
          style={{
            position: "absolute",
            top: 54,
            left: "50%",
            transform: `translateX(-50%) translateY(${logoY}px)`,
            opacity: logoOp,
            width: 80,
            height: 36,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <AdLogo
            logoUrl={assets.logoUrl}
            brandName={brandContext.brandName}
            maxHeight={36}
            style={{ filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.5))" }}
          />
        </div>

        {/* Polaroid wrapper (40-70) */}
        <div
          style={{
            position: "absolute",
            top: 80,
            left: "50%",
            transform: `translateX(-50%) translateY(${polY}px) rotate(-3deg)`,
            transformOrigin: "center top",
            opacity: polOp,
          }}
        >
          {/* Polaroid frame: white padding 10px sides, 30px bottom */}
          <div
            style={{
              background: "#fff",
              padding: "10px 10px 30px",
              boxShadow: "0 12px 40px rgba(0,0,0,0.7), 0 2px 8px rgba(0,0,0,0.4)",
              borderRadius: 2,
            }}
          >
            {/* Photo area inside polaroid */}
            <AdPhoto
              photoUrl={assets.afterPhotoUrl}
              fallbackGradient={`linear-gradient(135deg, ${dt.gradient_from} 0%, ${dt.gradient_to} 60%, ${dt.primary} 100%)`}
              style={{
                width: 175,
                height: 175,
                borderRadius: 1,
              }}
            />
            {/* Polaroid brand label */}
            <div
              style={{
                textAlign: "center",
                paddingTop: 8,
                fontSize: 9,
                color: "#aaa",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              {brandContext.brandName}
            </div>
          </div>
        </div>

        {/* Impact ripple (66-84) */}
        <div
          style={{
            position: "absolute",
            top: 320,
            left: "50%",
            marginLeft: -rippleSize / 2,
            marginTop: -rippleSize / 2,
            width: rippleSize,
            height: rippleSize,
            border: `2px solid ${dt.primary}`,
            borderRadius: "50%",
            opacity: rippleOp,
          }}
        />

        {/* Badge slides in from left (60-90) */}
        <AdBadge
          text={copy.badge}
          bgColor={dt.badge_bg}
          textColor={dt.badge_text}
          style={{
            position: "absolute",
            top: 330,
            left: badgeX,
          }}
        />

        {/* Headline typewriter (80-140) */}
        <div
          style={{
            position: "absolute",
            top: 360,
            left: 12,
            right: 12,
            fontSize: 16,
            fontWeight: 800,
            color: dt.headline_text,
            lineHeight: 1.3,
            minHeight: 60,
          }}
        >
          {headlineSegments.map((seg, i) =>
            seg.visible ? (
              seg.isHighlight ? (
                <span
                  key={i}
                  style={{
                    background: dt.badge_bg,
                    color: dt.badge_text,
                    padding: "1px 4px",
                    borderRadius: 3,
                  }}
                >
                  {seg.text}
                </span>
              ) : (
                <span key={i}>{seg.text}</span>
              )
            ) : null
          )}
          {showCursor && (
            <span
              style={{
                display: "inline-block",
                width: 2,
                height: "0.9em",
                background: dt.primary,
                marginLeft: 1,
                verticalAlign: "middle",
                opacity: cursorBlink,
              }}
            />
          )}
        </div>

        {/* Support text (130-170) */}
        <AdSupport
          text={copy.support}
          color={dt.support_text}
          style={{
            position: "absolute",
            top: 430,
            left: 12,
            right: 12,
            opacity: supportOp,
            transform: `translateY(${supportY}px)`,
          }}
        />

        {/* CTA bounce up (160-200) */}
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
    </AbsoluteFill>
  );
};
