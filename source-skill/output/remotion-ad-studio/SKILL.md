---
name: remotion-ad-studio
description: Convert static ad JSON into animated video reels using Remotion. Interactive editor for tweaking copy, design tokens, timing, voiceover, and exporting Remotion-ready configs.
allowed-tools:
  - AskUserQuestion
  - Bash
  - Read
  - Write
  - Edit
  - WebFetch
metadata:
  tags: remotion, video, reels, ads, animation, json, editor
  sources:
    - https://github.com/remotion-dev/skills
    - https://www.remotion.dev/prompts
    - https://www.remotion.dev/docs/the-fundamentals
---

# Remotion Ad Studio

Convert static ad JSON (from Memorabil.ai or similar) into animated video reels using Remotion.

## When to Use

Trigger this skill when the user wants to:
- Convert a static ad into a video reel
- Edit ad JSON variables and preview the animation
- Generate Remotion compositions from ad configs
- Add voiceover to an ad reel
- Export Remotion-ready JSON configs

## Quick Start

1. Open the interactive editor:
   ```bash
   open ./editor.html
   ```
2. Paste your ad JSON in the JSON tab, or edit fields in the Copy/Design/Timing tabs
3. Hit Play to preview the animated reel
4. Adjust timing, colors, and copy until it looks right
5. Click "Export Remotion Config" to get the Remotion-ready JSON

## Remotion Best Practices

This skill bundles the official Remotion skills from `remotion-dev/skills`.
Load individual rule files for domain-specific knowledge:

- [rules/animations.md](rules/animations.md) - Frame-driven animations (NO CSS animations)
- [rules/timing.md](rules/timing.md) - Interpolation, spring, easing curves
- [rules/sequencing.md](rules/sequencing.md) - Sequence, Series, timing delays
- [rules/transitions.md](rules/transitions.md) - TransitionSeries, fade, slide, wipe
- [rules/text-animations.md](rules/text-animations.md) - Typewriter, word highlighting
- [rules/compositions.md](rules/compositions.md) - Composition setup, defaultProps, calculateMetadata
- [rules/parameters.md](rules/parameters.md) - Zod schema for parametrizable videos
- [rules/voiceover.md](rules/voiceover.md) - ElevenLabs TTS integration
- [rules/audio.md](rules/audio.md) - Audio import, trim, volume, speed
- [rules/assets.md](rules/assets.md) - Import images, videos, audio, fonts
- [rules/fonts.md](rules/fonts.md) - Google Fonts and local fonts
- [rules/tailwind.md](rules/tailwind.md) - TailwindCSS in Remotion
- [rules/charts.md](rules/charts.md) - Bar, pie, line charts
- [rules/3d.md](rules/3d.md) - Three.js and React Three Fiber
- [rules/maps.md](rules/maps.md) - Mapbox animated maps
- [rules/light-leaks.md](rules/light-leaks.md) - Light leak overlay effects
- [rules/measuring-text.md](rules/measuring-text.md) - Text measurement and fitting

See [remotion-best-practices.md](remotion-best-practices.md) for the full index.

## Entry Point — Interactive Flow

When invoked, determine the user's intent:

### A) "Build a reel from this ad JSON"

**Step 1**: Ask for the ad JSON if not provided.

```
AskUserQuestion: "Paste your static ad JSON or point me to the file."
```

**Step 2**: Parse the JSON and open the editor with it pre-loaded.

```bash
# Open editor
open ./editor.html
```

Tell the user: "The editor is open. Edit your variables in the tabs on the left, preview the animation on the right, then export when ready."

**Step 3**: When the user has the exported Remotion config, scaffold a Remotion project:

```bash
# Create Remotion project from the exported config
npx create-video@latest --template blank my-reel
cd my-reel
```

Then generate the composition file using the exported JSON. Read [rules/compositions.md](rules/compositions.md) and [rules/parameters.md](rules/parameters.md) for the patterns.

### B) "Generate a Remotion composition from this config"

Take the Remotion config JSON (from the editor's export) and generate:

1. **Zod schema** from the defaultProps
2. **Composition component** with scene sequences matching the config's `scenes` array
3. **Root.tsx** registering the composition

Use these patterns from the bundled rules:

```tsx
// Zod schema from ad JSON
import { z } from "zod";

export const AdReelSchema = z.object({
  copy: z.object({
    headline: z.string(),
    support: z.string(),
    cta: z.string(),
    highlight: z.string(),
    badge: z.string(),
    angle: z.string(),
  }),
  designTokens: z.object({
    primary: z.string(),
    headline_text: z.string(),
    support_text: z.string(),
    surface: z.string(),
    badge_bg: z.string(),
    badge_text: z.string(),
    cta_bg: z.string(),
    cta_text: z.string(),
    gradient_from: z.string(),
    gradient_to: z.string(),
  }),
  assets: z.object({
    logoUrl: z.string(),
    afterPhotoUrl: z.string(),
  }),
  brandContext: z.object({
    brandName: z.string(),
  }),
});
```

```tsx
// Scene composition using TransitionSeries
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";

export const AdReel: React.FC<z.infer<typeof AdReelSchema>> = (props) => {
  return (
    <AbsoluteFill style={{
      background: `linear-gradient(180deg, ${props.designTokens.gradient_from}, ${props.designTokens.gradient_to})`
    }}>
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={scenes.logo.durationFrames}>
          <LogoScene logoUrl={props.assets.logoUrl} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 15 })}
        />
        {/* ... more scenes */}
      </TransitionSeries>
    </AbsoluteFill>
  );
};
```

### C) "Add voiceover"

Read [rules/voiceover.md](rules/voiceover.md) for the full pattern. Key steps:

1. Check for `ELEVENLABS_API_KEY` env var
2. Generate speech from the voiceover script
3. Use `calculateMetadata` to size the composition to the audio duration
4. Layer audio with `<Audio>` component

### D) "Render the video"

```bash
# Preview in Remotion Studio
npx remotion studio

# Render to MP4
npx remotion render AdReel out/reel.mp4

# Render with custom props
npx remotion render AdReel out/reel.mp4 --props='./props.json'
```

## Ad JSON Schema Reference

```
{
  source: string,              // "palette" | "brief" | "template"
  templateId: string,          // Template identifier
  templatePhotoMode: number,   // 0 = no photo, 1 = after only, 2 = before/after

  copy: {
    headline: string,          // Main text
    support: string,           // Supporting text
    cta: string,               // Call-to-action button text
    highlight: string,         // Word(s) in headline to emphasize
    badge: string,             // Badge/category label
    angle: string,             // Content angle (family-memory, nostalgia, etc.)
    style: {
      textAlign: "center" | "left" | "right",
      headlineSize: number,    // Scale factor
      ctaStyle: "filled" | "outline" | "ghost",
      ctaRadius: number,       // Border radius (999 = pill)
      backgroundStyle: "gradient" | "solid" | "image",
      textTone: "light" | "dark",
      emphasisStyle: "highlight-bg" | "underline" | "bold" | "color"
    }
  },

  designTokens: {
    primary: hex,              // Brand primary color
    ink: hex,                  // Dark text color
    headline_text: hex,        // Headline color
    support_text: hex,         // Support text color
    surface: hex,              // Background surface
    badge_bg: hex,             // Badge background
    badge_text: hex,           // Badge text
    cta_bg: hex,               // CTA button background
    cta_text: hex,             // CTA button text
    gradient_from: hex,        // Gradient start
    gradient_to: hex           // Gradient end
  },

  assets: {
    logoUrl: string,           // Brand logo image URL
    beforePhotoUrl: string,    // Before photo (optional)
    afterPhotoUrl: string      // After/main photo
  },

  brandContext: {
    brandName: string          // Brand name
  }
}
```

## Scene Timing Defaults

| Scene | Start | Duration | Animation |
|-------|-------|----------|-----------|
| Logo | 0s | 1s | spring |
| Badge | 0.5s | 0.7s | fade |
| Headline | 1s | 1.5s | spring |
| Photo | 2s | 2s | slide-up |
| Support | 3s | 1s | fade |
| CTA | 4s | 1s | bounce |

Total default duration: 8 seconds at 30fps (240 frames).

## Critical Rules

1. **NO CSS animations** — all motion must be frame-driven via `useCurrentFrame()` + `interpolate()`/`spring()`
2. **Always premount Sequences** — use `premountFor={1 * fps}` on every `<Sequence>`
3. **Zod schema required** — every parametrizable prop needs a Zod type for the Remotion Studio sidebar editor
4. **9:16 aspect ratio** — reels are 1080x1920
5. **Spring defaults** — use `{ damping: 200 }` for smooth, `{ damping: 8 }` for bouncy
