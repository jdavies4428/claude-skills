import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";
import { AdReelProps } from "../schema";
import { AdPhoto } from "../components/AdPhoto";
import { AdBadge } from "../components/AdBadge";
import { seededRandom } from "../helpers";

// 290 frames @ 30fps — Digital Glitch / Cyberpunk
export const Template5Glitch: React.FC<AdReelProps> = ({
  copy,
  designTokens: T,
  assets,
  brandContext,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ── Seeded random helpers ──────────────────────────────────────────────
  // Build a tiny seeded sequence from a seed value
  function makeRandSeq(seed: number): () => number {
    let s = seed;
    return () => {
      s = s + 1;
      return seededRandom(s);
    };
  }

  // ── Static noise blocks (0-20) ─────────────────────────────────────────
  const NOISE_COUNT = 80;
  const noiseOpacity = interpolate(frame, [0, 5, 18, 22], [0, 1, 0.8, 0], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });
  const noiseBlocks = Array.from({ length: NOISE_COUNT }, (_, i) => {
    const r0 = makeRandSeq(i * 17 + 3);
    // Base position is deterministic per block
    const bx = seededRandom(i * 31.7) * 1080;
    const by = seededRandom(i * 47.3) * 1920;
    const bw = seededRandom(i * 13.1) * 80 + 16;
    const bh = seededRandom(i * 23.9) * 16 + 8;
    // Per-frame positional jitter
    const jx = noiseOpacity > 0 ? (r0() - 0.5) * 40 : 0;
    const jy = noiseOpacity > 0 ? (r0() - 0.5) * 40 : 0;
    const colors = ["#ff003c", "#00ff88", "#0088ff", "#ffffff", "#ffcc00"];
    const colorIdx = Math.floor(seededRandom(i * 7.1 + frame * 0.3) * colors.length);
    const blockOpacity = noiseOpacity > 0 ? seededRandom(i * 5.3 + frame * 0.7) * noiseOpacity * 0.9 : 0;
    return (
      <div
        key={`noise-${i}`}
        style={{
          position: "absolute",
          left: bx + jx,
          top: by + jy,
          width: bw,
          height: bh,
          background: colors[colorIdx],
          opacity: blockOpacity,
          pointerEvents: "none",
        }}
      />
    );
  });

  // ── Logo glitch RGB split (15-45) ──────────────────────────────────────
  const logoResolved = frame > 45;
  const logoInRange = frame >= 15 && frame <= 45;
  const flickerSeed = makeRandSeq(frame * 17);
  const flicker = flickerSeed();
  const logoContainerOpacity = logoResolved ? 1 : logoInRange ? (flicker > 0.3 ? 1 : 0) : 0;
  const sliceOffset = logoInRange ? (flickerSeed() - 0.5) * 60 : 0;
  const rgbActive = logoInRange && flickerSeed() > 0.4;
  const logoMainOpacity = logoResolved ? 1 : logoInRange && flicker > 0.3 ? 1 : 0;

  // ── Photo strips (40-70), 12 strips from alternating sides ─────────────
  const STRIP_COUNT = 12;
  const photoStrips = Array.from({ length: STRIP_COUNT }, (_, i) => {
    const fromLeft = i % 2 === 0;
    const stripH = 1920 / STRIP_COUNT;
    const stripStart = 40 + i * 2.5;
    const stripProg = interpolate(frame, [stripStart, stripStart + 18], [0, 1], {
      extrapolateRight: "clamp",
      extrapolateLeft: "clamp",
    });
    const tx = fromLeft
      ? interpolate(stripProg, [0, 1], [-100, 0])
      : interpolate(stripProg, [0, 1], [100, 0]);
    return (
      <div
        key={`strip-${i}`}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: i * stripH,
          height: stripH,
          transform: `translateX(${tx}%)`,
          overflow: "hidden",
        }}
      >
        {assets.afterPhotoUrl ? (
          <img
            src={assets.afterPhotoUrl}
            style={{
              position: "absolute",
              top: -i * stripH,
              left: 0,
              width: 1080,
              height: 1920,
              objectFit: "cover",
            }}
          />
        ) : (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `linear-gradient(90deg, ${T.gradient_from}, ${T.gradient_to}, ${T.primary})`,
            }}
          />
        )}
      </div>
    );
  });

  // ── Badge flash then reveal (65-95) ────────────────────────────────────
  const flashProg = interpolate(frame, [65, 80], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
  const badgeFlashW = frame >= 65 && frame <= 80
    ? interpolate(flashProg, [0, 0.5, 1], [0, 480, 0])
    : 0;
  const badgeFlashOpacity = frame >= 65 && frame <= 80
    ? interpolate(flashProg, [0, 0.3, 0.8, 1], [0, 0.9, 0.6, 0])
    : 0;
  const badgeOpacity = interpolate(frame, [78, 88], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });

  // ── Headline departures-board scramble (85-130) ─────────────────────────
  const GLITCH_CHARS = "!@#$%^&*<>?/\\|[]{}0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  function scrambleText(target: string, progress: number): string {
    const randSeq = makeRandSeq(frame * 7 + 13);
    let result = "";
    for (let i = 0; i < target.length; i++) {
      if (target[i] === " ") {
        result += " ";
        continue;
      }
      const charProgress = Math.max(0, Math.min(1, (progress * target.length - i) / 3));
      if (charProgress >= 1) {
        result += target[i];
      } else if (charProgress > 0) {
        const r = randSeq();
        result += r < charProgress ? target[i] : GLITCH_CHARS[Math.floor(randSeq() * GLITCH_CHARS.length)];
      } else {
        result += GLITCH_CHARS[Math.floor(randSeq() * GLITCH_CHARS.length)];
      }
    }
    return result;
  }

  const headlineOpacity = frame >= 85 ? 1 : 0;
  const scrambleProg = frame >= 85
    ? interpolate(frame, [85, 130], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" })
    : 0;
  const scrambledText = frame >= 85 ? scrambleText(copy.headline, scrambleProg) : "";

  // RGB split on highlight word after resolved
  const hlWords = copy.highlight.toLowerCase().split(" ");
  const headlineWords = scrambledText.split(" ");
  const origWords = copy.headline.split(" ");
  const rgbIn = interpolate(frame, [125, 135], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
  const rgbOut = interpolate(frame, [185, 200], [1, 0], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
  const rgbSplit = frame < 185 ? rgbIn : rgbOut;
  const cursorBlink = Math.floor(frame / 6) % 2 === 0 ? 1 : 0;

  // ── Support terminal typing (120-150) ──────────────────────────────────
  const supportOpacity = frame >= 120 ? 1 : 0;
  const typeProg = interpolate(frame, [120, 155], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
  const charsToShow = Math.floor(typeProg * copy.support.length);
  const visText = copy.support.slice(0, charsToShow);
  const supportCursorBlink = Math.floor(frame / 5) % 2 === 0 ? 1 : 0;

  // ── CTA pixel assembly (140-175) ───────────────────────────────────────
  const ctaAssembled = interpolate(frame, [162, 175], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
  const PIXEL_COUNT = 20;
  const pixelBlocks = Array.from({ length: PIXEL_COUNT }, (_, i) => {
    const pbStart = 140 + i * 1.5;
    const pbProg = interpolate(frame, [pbStart, pbStart + 18], [0, 1], {
      extrapolateRight: "clamp",
      extrapolateLeft: "clamp",
    });
    if (pbProg >= 1) return null;
    const randAngle = (i / PIXEL_COUNT) * Math.PI * 2;
    const dist = (1 - pbProg) * 240;
    const px = Math.cos(randAngle) * dist - 36 + (i % 4) * 24;
    const py = Math.sin(randAngle) * dist - 24 + Math.floor(i / 4) * 24;
    const pbOpacity = interpolate(pbProg, [0, 0.3, 0.9, 1], [0.8, 0.6, 0.3, 0]);
    return (
      <div
        key={`pixel-${i}`}
        style={{
          position: "absolute",
          width: 24,
          height: 24,
          background: T.cta_bg,
          borderRadius: 4,
          opacity: pbOpacity,
          transform: `translate(${px}px, ${py}px)`,
        }}
      />
    );
  });

  // ── Glitch burst (175-178) ─────────────────────────────────────────────
  const burst = frame >= 175 && frame <= 178;
  const burstRand = makeRandSeq(frame * 53);
  const burstBg = burst
    ? `rgba(${Math.floor(burstRand() * 255)},0,${Math.floor(burstRand() * 255)},0.15)`
    : "transparent";
  const burstX = burst ? (burstRand() - 0.5) * 36 : 0;

  return (
    <AbsoluteFill style={{ background: "#050510", overflow: "hidden" }}>

      {/* Static noise blocks */}
      <div style={{ position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none" }}>
        {noiseBlocks}
      </div>

      {/* Photo strips container */}
      <div
        style={{
          position: "absolute",
          top: 216,
          left: 36,
          right: 36,
          height: 540,
          overflow: "hidden",
          borderRadius: 18,
          boxShadow: "0 18px 72px rgba(0,0,0,0.7)",
          zIndex: 2,
        }}
      >
        <div style={{ position: "absolute", inset: 0 }}>
          {photoStrips}
        </div>
      </div>

      {/* Logo — RGB split glitch */}
      <div
        style={{
          position: "absolute",
          top: 72,
          left: "50%",
          transform: `translateX(calc(-50% + ${sliceOffset}px))`,
          zIndex: 8,
          opacity: logoContainerOpacity,
          whiteSpace: "nowrap",
        }}
      >
        {/* Red channel offset */}
        {rgbActive && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              fontFamily: '"SF Mono","Fira Code",monospace',
              fontSize: 39,
              fontWeight: 800,
              letterSpacing: "0.12em",
              color: "red",
              opacity: 0.5,
              mixBlendMode: "screen",
              transform: "translateX(6px)",
              whiteSpace: "nowrap",
            }}
          >
            {brandContext.brandName.toUpperCase()}
          </div>
        )}
        {/* Green channel offset */}
        {rgbActive && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              fontFamily: '"SF Mono","Fira Code",monospace',
              fontSize: 39,
              fontWeight: 800,
              letterSpacing: "0.12em",
              color: "lime",
              opacity: 0.5,
              mixBlendMode: "screen",
              transform: "translateX(-6px)",
              whiteSpace: "nowrap",
            }}
          >
            {brandContext.brandName.toUpperCase()}
          </div>
        )}
        {/* Main white layer */}
        <div
          style={{
            position: "relative",
            fontFamily: '"SF Mono","Fira Code",monospace',
            fontSize: 39,
            fontWeight: 800,
            letterSpacing: "0.12em",
            color: T.badge_text || "#efe7db",
            opacity: logoMainOpacity,
            whiteSpace: "nowrap",
          }}
        >
          {brandContext.brandName.toUpperCase()}
        </div>
      </div>

      {/* Badge — white flash then badge reveals */}
      <div
        style={{
          position: "absolute",
          top: 792,
          left: 36,
          zIndex: 6,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            background: "white",
            width: badgeFlashW,
            height: 78,
            borderRadius: 12,
            opacity: badgeFlashOpacity,
          }}
        />
        <div style={{ opacity: badgeOpacity }}>
          <AdBadge
            text={copy.badge}
            bgColor={T.badge_bg}
            textColor={T.badge_text}
            style={{ fontSize: 28, padding: "12px 30px", borderRadius: 12 }}
          />
        </div>
      </div>

      {/* Headline scramble */}
      <div
        style={{
          position: "absolute",
          top: 900,
          left: 36,
          right: 36,
          fontFamily: '"SF Mono","Fira Code",monospace',
          fontSize: 46,
          fontWeight: 800,
          color: T.headline_text,
          lineHeight: 1.35,
          zIndex: 6,
          opacity: headlineOpacity,
        }}
      >
        {headlineWords.map((word, wi) => {
          const isHighlight = hlWords.some(
            (hw) => origWords[wi] && origWords[wi].toLowerCase().includes(hw)
          );
          if (isHighlight && scrambleProg >= 0.95) {
            return (
              <span
                key={wi}
                style={{
                  color: T.primary,
                  textShadow: `${rgbSplit * 9}px 0 red, ${-rgbSplit * 9}px 0 cyan`,
                }}
              >
                {word}{wi < headlineWords.length - 1 ? " " : ""}
              </span>
            );
          }
          return (
            <span key={wi}>
              {word}{wi < headlineWords.length - 1 ? " " : ""}
            </span>
          );
        })}
        {/* Terminal cursor */}
        {frame < 140 && (
          <span style={{ color: "#00ff88", opacity: cursorBlink }}>_</span>
        )}
      </div>

      {/* Support — terminal typing with green cursor */}
      <div
        style={{
          position: "absolute",
          top: 1260,
          left: 36,
          right: 36,
          fontFamily: '"SF Mono","Fira Code",monospace',
          fontSize: 30,
          color: "#00ff88",
          lineHeight: 1.5,
          opacity: supportOpacity,
          zIndex: 6,
        }}
      >
        <span style={{ color: "#888", marginRight: 12 }}>&gt;</span>
        {visText}
        <span style={{ opacity: supportCursorBlink, color: "#00ff88" }}>█</span>
      </div>

      {/* CTA — pixel blocks converging then button */}
      <div
        style={{
          position: "absolute",
          bottom: 108,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 8,
        }}
      >
        {/* Pixel blocks */}
        <div style={{ position: "absolute", inset: 0 }}>
          {pixelBlocks}
        </div>
        {/* CTA button */}
        <div
          style={{
            background: T.cta_bg,
            color: T.cta_text,
            padding: "36px 84px",
            borderRadius: 24,
            fontFamily: '"SF Mono","Fira Code",monospace',
            fontSize: 36,
            fontWeight: 700,
            letterSpacing: "0.05em",
            whiteSpace: "nowrap",
            boxShadow: "0 12px 60px rgba(0,0,0,0.7)",
            opacity: ctaAssembled,
            position: "relative",
          }}
        >
          {copy.cta}
        </div>
      </div>

      {/* Scan lines — persistent overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 9px, rgba(0,0,0,0.15) 9px, rgba(0,0,0,0.15) 12px)",
          zIndex: 20,
          pointerEvents: "none",
          opacity: 0.6,
        }}
      />

      {/* Glitch burst */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: burstBg,
          transform: `translateX(${burstX}px)`,
          opacity: burst ? 1 : 0,
          zIndex: 19,
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};
