import { interpolate, spring as remotionSpring } from "remotion";

// Re-export for convenience
export { interpolate };

// Spring helper matching our template patterns
export function springVal(
  frame: number,
  fps: number,
  delay: number = 0,
  config: { damping?: number; stiffness?: number; mass?: number } = {}
): number {
  const localFrame = Math.max(0, frame - delay);
  return remotionSpring({
    frame: localFrame,
    fps,
    config: {
      damping: config.damping ?? 10,
      stiffness: config.stiffness ?? 100,
      mass: config.mass ?? 1,
    },
  });
}

// Typewriter: returns substring up to current char
export function typewriter(
  text: string,
  frame: number,
  startFrame: number,
  charsPerFrame: number = 0.5
): string {
  const elapsed = Math.max(0, frame - startFrame);
  const chars = Math.floor(elapsed * charsPerFrame);
  return text.substring(0, Math.min(chars, text.length));
}

// Highlight text: splits text and wraps highlight word in a span
export function splitHighlight(
  text: string,
  highlight: string
): { text: string; isHighlight: boolean }[] {
  if (!highlight) return [{ text, isHighlight: false }];
  const regex = new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  return text.split(regex).map((part) => ({
    text: part,
    isHighlight: part.toLowerCase() === highlight.toLowerCase(),
  }));
}

// Seeded random for deterministic "random" effects (glitch, noise)
export function seededRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

// Clamp helper
export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}
