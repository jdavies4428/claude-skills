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

// 270 frames @ 30fps — Mosaic Assemble
const W = 1080;
const H = 1920;
const COLS = 9;
const ROWS = 16;
const TILE_W = W / COLS;   // 120px
const TILE_H = H / ROWS;   // 120px

// Region boundaries (row ranges)
function getTileRegion(row: number): string {
  if (row <= 1) return "logo";
  if (row === 2) return "badge";
  if (row >= 3 && row <= 8) return "photo";
  if (row >= 9 && row <= 12) return "headline";
  if (row >= 13 && row <= 14) return "support";
  if (row >= 15) return "cta";
  return "bg";
}

// Spiral order precompute
function computeSpiralOrder(): { row: number; col: number; dist: number; idx: number }[] {
  const cx = Math.floor(COLS / 2);
  const cy = Math.floor(ROWS / 2);
  const tiles: { row: number; col: number; dist: number; idx: number }[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      tiles.push({
        row: r,
        col: c,
        dist: Math.sqrt((c - cx) ** 2 + (r - cy) ** 2),
        idx: r * COLS + c,
      });
    }
  }
  tiles.sort((a, b) => a.dist - b.dist);
  return tiles;
}

const SPIRAL_ORDER = computeSpiralOrder();
const SPIRAL_INDEX_MAP: number[] = new Array(COLS * ROWS).fill(0);
SPIRAL_ORDER.forEach((tile, si) => {
  SPIRAL_INDEX_MAP[tile.idx] = si;
});

// Color helpers
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return [isNaN(r) ? 0 : r, isNaN(g) ? 0 : g, isNaN(b) ? 0 : b];
}

function lerpColor(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `rgb(${r},${g},${bl})`;
}

function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 2);
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

// Pre-compute CTA explosion velocities (deterministic)
const CTA_VELS: { vx: number; vy: number }[] = Array.from(
  { length: COLS * ROWS },
  (_, i) => {
    const angle = seededRandom(i * 3.7) * Math.PI * 2;
    const speed = 6 + seededRandom(i * 7.3) * 14;
    return { vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed };
  }
);

// Pre-compute initial tile colors (seeded palette)
function buildPalette(T: AdReelProps["designTokens"]): string[] {
  return [
    T.gradient_from,
    T.gradient_to,
    T.surface,
    T.primary,
    "#1a0f0a",
    "#3d1f12",
    "#562810",
  ];
}

function getInitialColor(idx: number, palette: string[]): string {
  return palette[idx % palette.length];
}

function getLogoTileColor(col: number, T: AdReelProps["designTokens"]): string {
  return col % 2 === 0 ? T.badge_bg : (T.surface || T.gradient_from);
}

function getPhotoBgColor(
  row: number,
  col: number,
  T: AdReelProps["designTokens"]
): string {
  const ty = (row - 3) / 5;
  const tx = col / (COLS - 1);
  return lerpColor(T.gradient_from, T.gradient_to, clamp(ty + tx * 0.3, 0, 1));
}

// Individual tile component
const MosaicTile: React.FC<{
  idx: number;
  row: number;
  col: number;
  frame: number;
  fps: number;
  T: AdReelProps["designTokens"];
  palette: string[];
  hlWords: string[];
  support: string;
  badge: string;
  headline: string;
  highlight: string;
}> = ({ idx, row, col, frame, fps, T, palette, hlWords, support, badge, headline, highlight }) => {
  const region = getTileRegion(row);
  const si = SPIRAL_INDEX_MAP[idx];
  const initColor = getInitialColor(idx, palette);

  // Shimmer (0-20)
  const shimmerOpacity =
    frame < 20
      ? 0.3 + 0.7 * Math.abs(Math.sin((frame + seededRandom(idx * 3.3) * 100) * 0.4))
      : 1;

  // Track background color through phases
  let bgColor = initColor;
  let tileTransform = "none";
  let tileOpacity = shimmerOpacity;
  let frontContent: React.ReactNode = null;
  let backContent: React.ReactNode = null;
  let flipRotateY = 0;
  let showBack = false;

  // ── Logo tiles (20-70): spiral morph to logo colors ───────────────────────
  if (region === "logo" && frame >= 20) {
    const tileDelay = si * 0.4;
    const tileF = frame - 20 - tileDelay;
    if (tileF >= 0) {
      const t = easeOut(clamp(tileF / 8, 0, 1));
      bgColor = lerpColor(initColor, getLogoTileColor(col, T), t);
      // Pop scale: 0→1.3→1
      const pop = tileF < 3 ? 1 + tileF * 0.1 : tileF < 5 ? 1.3 - (tileF - 3) * 0.15 : 1;
      tileTransform = `scale(${pop})`;
    }
  }

  // ── Photo tiles (60-110): gradient morph, then fade out to reveal photo ───
  if (region === "photo" && frame >= 60) {
    const tileDelay = (col + row * 0.5) * 1.2;
    const tileF = frame - 60 - tileDelay;
    if (tileF >= 0) {
      const t = easeInOut(clamp(tileF / 15, 0, 1));
      bgColor = lerpColor(initColor, getPhotoBgColor(row, col, T), t);
      // Subdivision: show inner grid lines after t > 0.67
      if (t > 0.67) {
        frontContent = (
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `repeating-linear-gradient(0deg, rgba(0,0,0,0.14) 0px, rgba(0,0,0,0.14) 2px, transparent 2px, transparent ${TILE_H / 2}px), repeating-linear-gradient(90deg, rgba(0,0,0,0.14) 0px, rgba(0,0,0,0.14) 2px, transparent 2px, transparent ${TILE_W / 2}px)`,
              opacity: clamp((t - 0.67) * 3, 0, 1),
              pointerEvents: "none",
            }}
          />
        );
      }
    }
    // Fade out tiles to reveal photo underneath (staggered per tile)
    if (frame >= 85) {
      const fadeDelay = (col + (row - 3) * 1.5) * 1.0;
      const fadeT = clamp((frame - 85 - fadeDelay) / 12, 0, 1);
      tileOpacity = 1 - fadeT;
    }
  }

  // ── Badge tiles (100-140) ──────────────────────────────────────────────────
  if (region === "badge" && frame >= 100) {
    const tileDelay = col * 2;
    const tileF = frame - 100 - tileDelay;
    if (tileF >= 0) {
      const t = easeOut(clamp(tileF / 12, 0, 1));
      const targetColor = col === Math.floor(COLS / 2) ? T.badge_text : T.badge_bg;
      bgColor = lerpColor(initColor, targetColor, t);
      const pop = tileF < 3 ? 1 + tileF * 0.1 : tileF < 5 ? 1.3 - (tileF - 3) * 0.15 : 1;
      tileTransform = `scale(${pop})`;
      if (t > 0.5) {
        frontContent = (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              fontWeight: 700,
              color: T.badge_text,
              opacity: clamp((t - 0.5) * 2, 0, 1),
            }}
          >
            {badge.charAt(col % badge.length)}
          </div>
        );
      }
    }
  }

  // ── Headline tiles (130-180): rotateY flip left-to-right stagger ──────────
  if (region === "headline" && frame >= 130) {
    const tileDelay = col * 3.5;
    const tileF = frame - 130 - tileDelay;
    if (tileF >= 0) {
      const t = easeInOut(clamp(tileF / 18, 0, 1));
      flipRotateY = interpolate(t, [0, 1], [0, 180]);
      showBack = t > 0.5;

      // Determine highlight region
      const hlStart = headline.indexOf(highlight ?? "");
      const charPos = col + (row - 9) * COLS;
      const isHighlight =
        hlStart >= 0 &&
        charPos >= Math.floor(hlStart / 3) &&
        charPos < Math.floor((hlStart + (highlight?.length ?? 0)) / 3);
      const backBg = isHighlight ? T.badge_bg : T.gradient_to;

      const wordIdx = Math.floor((col / COLS) * hlWords.length);
      const lineIdx = row - 9;
      const word = hlWords[Math.min(wordIdx + lineIdx, hlWords.length - 1)] ?? "";
      const char = word.charAt(col % Math.max(word.length, 1));

      backContent = (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: backBg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 22,
            fontWeight: 700,
            color: T.badge_text,
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
          }}
        >
          {char}
        </div>
      );
    }
  }

  // ── Support tiles (170-210): rotateY flip top-to-bottom stagger ───────────
  if (region === "support" && frame >= 170) {
    const tileDelay = (row - 13) * 10 + col * 1.5;
    const tileF = frame - 170 - tileDelay;
    if (tileF >= 0) {
      const t = easeInOut(clamp(tileF / 16, 0, 1));
      flipRotateY = interpolate(t, [0, 1], [0, 180]);
      showBack = t > 0.5;

      const charIdx = col + (row - 13) * COLS;
      const char = support.charAt(charIdx % support.length);

      backContent = (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: T.surface,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            fontWeight: 700,
            color: T.support_text,
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
          }}
        >
          {char}
        </div>
      );
    }
  }

  // ── CTA tiles (200-240): explode outward ──────────────────────────────────
  if (region === "cta" && frame >= 200) {
    const explodeF = frame - 200;
    const vel = CTA_VELS[idx];
    const dx = vel.vx * explodeF;
    const dy = vel.vy * explodeF;
    const rot = explodeF * vel.vx * 3;
    tileTransform = `translate(${dx}px, ${dy}px) rotate(${rot}deg)`;
    tileOpacity = interpolate(frame, [200, 240], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  }

  // ── Wave ripple (240-270) on non-flip tiles ────────────────────────────────
  if (region !== "cta" && region !== "headline" && region !== "support" && frame >= 240) {
    const waveF = frame - 240;
    const phase = (col + row) * 0.4;
    const dy = Math.sin(waveF * 0.2 + phase) * 8;
    tileTransform = `translateY(${dy}px)`;
  }

  const innerTransform =
    flipRotateY !== 0
      ? `perspective(400px) rotateY(${flipRotateY}deg)`
      : "none";

  return (
    <div
      style={{
        position: "absolute",
        left: col * TILE_W,
        top: row * TILE_H,
        width: TILE_W,
        height: TILE_H,
        background: bgColor,
        border: "1px solid rgba(0,0,0,0.18)",
        transform: tileTransform,
        opacity: tileOpacity,
        overflow: "hidden",
        transformStyle: "preserve-3d",
      }}
    >
      {/* Inner wrapper for flip */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          transformStyle: "preserve-3d",
          transform: innerTransform,
        }}
      >
        {/* Front face */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backfaceVisibility: "hidden",
          }}
        >
          {frontContent}
        </div>
        {/* Back face */}
        {backContent}
      </div>
    </div>
  );
};

export const Template10Mosaic: React.FC<AdReelProps> = ({
  copy,
  designTokens: T,
  assets,
  brandContext,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const palette = buildPalette(T);
  const hlWords = copy.headline.split(" ");

  // Photo spring reveal (starts frame 80, after tile morph at 60-110)
  const photoSpring = spring({
    frame: Math.max(0, frame - 80),
    fps,
    config: { damping: 10, stiffness: 150, mass: 1 },
  });
  const photoY = interpolate(photoSpring, [0, 1], [200, 0]);
  const photoScale = interpolate(photoSpring, [0, 1], [0.7, 1]);
  const photoOp = interpolate(frame, [80, 95], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Logo spring reveal (starts frame 50, after logo tile morph at 20-70)
  const logoSpring = spring({
    frame: Math.max(0, frame - 50),
    fps,
    config: { damping: 12, stiffness: 120, mass: 0.8 },
  });
  const logoScale = interpolate(logoSpring, [0, 1], [0.5, 1]);
  const logoOp = interpolate(frame, [50, 65], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // CTA spring reveal
  const ctaSpring = spring({
    frame: Math.max(0, frame - 200),
    fps,
    config: { damping: 14, stiffness: 100 },
  });
  const ctaOpacity = clamp(ctaSpring * 2, 0, 1);
  const ctaScale = interpolate(ctaSpring, [0, 1], [0.9, 1]);

  // Build all tile indices
  const tiles = Array.from({ length: COLS * ROWS }, (_, idx) => {
    const row = Math.floor(idx / COLS);
    const col = idx % COLS;
    return { idx, row, col };
  });

  return (
    <AbsoluteFill
      style={{
        background: T.gradient_from,
        overflow: "hidden",
        fontFamily: "sans-serif",
      }}
    >
      {/* Grid layer */}
      <div style={{ position: "absolute", inset: 0 }}>
        {tiles.map(({ idx, row, col }) => (
          <MosaicTile
            key={idx}
            idx={idx}
            row={row}
            col={col}
            frame={frame}
            fps={fps}
            T={T}
            palette={palette}
            hlWords={hlWords}
            support={copy.support}
            badge={copy.badge}
            headline={copy.headline}
            highlight={copy.highlight ?? ""}
          />
        ))}
      </div>

      {/* Photo — spring entry from below like Template3Kinetic */}
      <div
        style={{
          position: "absolute",
          left: 12,
          right: 12,
          top: TILE_H * 3 + 12,
          height: TILE_H * 6 - 24,
          overflow: "hidden",
          borderRadius: 8,
          boxShadow: "0 8px 30px rgba(0,0,0,0.5)",
          opacity: photoOp,
          transform: `translateY(${photoY}px) scale(${photoScale})`,
          zIndex: 1,
        }}
      >
        <AdPhoto
          photoUrl={assets.afterPhotoUrl}
          fallbackGradient={`linear-gradient(135deg, ${T.gradient_from} 0%, ${T.gradient_to} 60%, ${T.primary} 100%)`}
          style={{ position: "absolute", inset: 0 }}
        />
      </div>

      {/* Logo — spring scale-in like Template1Polaroid */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: W,
          height: TILE_H * 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: logoOp,
          transform: `scale(${logoScale})`,
          zIndex: 1,
        }}
      >
        <AdLogo
          logoUrl={assets.logoUrl}
          brandName={brandContext.brandName}
          maxHeight={80}
          color={T.badge_text}
        />
      </div>

      {/* CTA button revealed behind exploding tiles */}
      <div
        style={{
          position: "absolute",
          left: 40,
          right: 40,
          bottom: 40,
          height: TILE_H * 1 - 20,
          background: T.cta_bg,
          borderRadius: 30,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 46,
          fontWeight: 700,
          color: T.cta_text,
          opacity: ctaOpacity,
          transform: `scale(${ctaScale})`,
          zIndex: 2,
        }}
      >
        {copy.cta}
      </div>
    </AbsoluteFill>
  );
};
