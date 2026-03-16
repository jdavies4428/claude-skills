# Voiceover Integration Spec

**Audience**: AI agent implementing voiceover in the photoapp's Remotion pipeline.
**Goal**: Add AI-generated voiceover audio to reel videos using OpenAI TTS.

---

## 1. Overview

Add voiceover to any reel by generating an MP3 from ad copy via OpenAI TTS, then layering it into the Remotion composition with `<Audio>`. The composition duration auto-adjusts to fit the voiceover length.

### Flow

```
Creative Package (static_winner)
  → reel-agent.js scaffolds reel spec
  → generate-voiceover.js creates MP3 from copy text
  → MP3 saved to public/voiceover/{reel_id}.mp3
  → Remotion composition reads MP3, measures duration
  → calculateMetadata sets durationInFrames = max(templateDuration, audioDuration)
  → <Audio> component plays voiceover synced to animation
  → renderMedia() outputs MP4 with voice
```

---

## 2. TTS Provider: OpenAI

### Why OpenAI

- Already in the photoapp's dependency tree and provider settings
- Cost: ~$0.002 per reel voiceover ($15/1M characters, ~150 chars per reel)
- Quality: `tts-1-hd` model is excellent for short emotional copy
- Latency: ~1-2 seconds per generation
- No additional account/API key setup needed

### Voice Selection

| Voice | Style | Best For |
|-------|-------|----------|
| `nova` | Warm, empathetic female | Family/emotional angles (recommended default) |
| `onyx` | Deep, warm male | Legacy/heritage angles |
| `shimmer` | Gentle, soothing female | Nostalgia angles |
| `alloy` | Neutral, clear | Product-focused angles |
| `echo` | Warm, rounded male | Storytelling |
| `fable` | Expressive, dynamic | Energetic templates (Kinetic, Glitch) |

### Recommendation

Default to `nova` for emotional templates (11-19) and `alloy` for energetic templates (1-9). Allow override via reel spec.

---

## 3. Script Generation

### Option A: Direct Copy (simplest, start here)

Concatenate headline + support text:

```js
function buildVoiceoverScript(pkg) {
  const headline = pkg.copy.headline || '';
  const support = pkg.copy.support || '';
  return `${headline} ${support}`.trim();
}
```

Example output: *"My mom's wedding day. Clear enough to share again. Restore the faces, the fabric, and the feeling in one tap."*

### Option B: LLM-Refined Script (better, phase 2)

Use Gemini/OpenAI to rewrite the copy as natural spoken text:

```js
async function buildVoiceoverScript(pkg) {
  const prompt = `Rewrite this ad copy as a natural, warm voiceover script for a 10-second video ad.
Keep it under 30 words. Make it emotional and conversational, not salesy.

Headline: ${pkg.copy.headline}
Support: ${pkg.copy.support}
Brand: ${pkg.brandContext.brandName}
Angle: ${pkg.copy.angle}

Return ONLY the voiceover script text, nothing else.`;

  const response = await llm.generate(prompt);
  return response.text.trim();
}
```

Example output: *"Mom's wedding day — I can finally see her smile again. One tap brought the whole photo back to life."*

### Option C: Manual Script (most control)

The editor already has a Voice tab with a script textarea. If `reel_spec.voiceover.script` is provided, use it directly. This takes priority over A and B.

### Priority Order

```js
function getVoiceoverScript(spec, pkg) {
  // 1. Manual script from reel spec (user typed it)
  if (spec.voiceover?.script?.trim()) return spec.voiceover.script.trim();

  // 2. Direct copy concatenation (always available)
  return buildVoiceoverScript(pkg);
}
```

---

## 4. Audio Generation

### New File: `generate-voiceover.js`

Location: `/Users/jeffdai/photoapp/fb-marketing/remotion/generate-voiceover.js`

```js
import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Generate voiceover MP3 from text.
 *
 * @param {Object} opts
 * @param {string} opts.text - The voiceover script
 * @param {string} opts.voice - OpenAI voice name (default: 'nova')
 * @param {number} opts.speed - Playback speed 0.25-4.0 (default: 0.95)
 * @param {string} opts.outputPath - Where to save the MP3
 * @returns {Promise<{ path: string, durationMs: number }>}
 */
export async function generateVoiceover({ text, voice = 'nova', speed = 0.95, outputPath }) {
  // Ensure output directory exists
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  // Generate speech
  const response = await openai.audio.speech.create({
    model: 'tts-1-hd',
    voice,
    input: text,
    speed,
    response_format: 'mp3',
  });

  // Write to file
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(outputPath, buffer);

  // Measure duration using Remotion's getAudioDuration (or ffprobe)
  const durationMs = await measureDuration(outputPath);

  return { path: outputPath, durationMs };
}

/**
 * Measure audio duration in milliseconds.
 * Uses ffprobe (available in Remotion's Docker images).
 */
async function measureDuration(filePath) {
  const { execSync } = await import('child_process');
  try {
    const result = execSync(
      `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${filePath}"`,
      { encoding: 'utf8' }
    );
    return Math.ceil(parseFloat(result.trim()) * 1000);
  } catch (e) {
    // Fallback: estimate from file size (~16kbps for speech MP3)
    const stats = fs.statSync(filePath);
    return Math.ceil((stats.size / 2000) * 1000); // rough estimate
  }
}

/**
 * Voice mapping by template angle/style.
 */
export function selectVoice(spec) {
  // Manual override
  if (spec.voiceover?.voice) return spec.voiceover.voice;

  // Emotional templates → warm female
  const templateId = spec.template_id || '';
  const emotionalTemplates = [
    'memory-returns', 'legacy-unlocked', 'through-generations',
    'face-returns', 'dust-of-time', 'warmth-returns',
    'opening-album', 'face-to-face', 'triple-restore'
  ];
  if (emotionalTemplates.includes(templateId)) return 'nova';

  // Default
  return 'alloy';
}
```

---

## 5. Remotion Integration

### 5A. Schema Update

Add voiceover fields to the schema:

```ts
// In schema.ts — add to AdReelSchema
voiceover: z.object({
  enabled: z.boolean().optional().default(false),
  audioUrl: z.string().optional(),    // path to MP3 (staticFile or URL)
  startFrame: z.number().optional(),  // when voice starts (default: 0)
  volume: z.number().optional(),      // 0-1 (default: 0.9)
}).optional(),
```

### 5B. Shared VoiceoverLayer Component

New file: `remotion/src/ad-studio/components/VoiceoverLayer.tsx`

```tsx
import React from 'react';
import { Audio, Sequence, staticFile, useVideoConfig } from 'remotion';

interface VoiceoverLayerProps {
  audioUrl?: string;
  startFrame?: number;
  volume?: number;
}

export const VoiceoverLayer: React.FC<VoiceoverLayerProps> = ({
  audioUrl,
  startFrame = 0,
  volume = 0.9,
}) => {
  if (!audioUrl) return null;

  // Resolve path — if relative, use staticFile()
  const src = audioUrl.startsWith('http') ? audioUrl : staticFile(audioUrl);

  return (
    <Sequence from={startFrame} premountFor={30}>
      <Audio src={src} volume={volume} />
    </Sequence>
  );
};
```

### 5C. Add VoiceoverLayer to Each Template

In every template component, add at the end of the render:

```tsx
import { VoiceoverLayer } from '../components/VoiceoverLayer';

export const Template1Polaroid: React.FC<AdReelProps> = (props) => {
  // ... existing animation code ...

  return (
    <AbsoluteFill>
      {/* ... existing visual layers ... */}

      {/* Voiceover audio */}
      <VoiceoverLayer
        audioUrl={props.voiceover?.audioUrl}
        startFrame={props.voiceover?.startFrame ?? 30}  // start after opening hook
        volume={props.voiceover?.volume ?? 0.9}
      />
    </AbsoluteFill>
  );
};
```

### 5D. Dynamic Duration with calculateMetadata

Each composition needs `calculateMetadata` to extend duration if voiceover is longer than the template's default:

```tsx
// In Root.tsx — for each composition
import { CalculateMetadataFunction } from 'remotion';
import { getAudioDurationInSeconds } from '@remotion/media-utils';

const calculateMetadata: CalculateMetadataFunction<AdReelProps> = async ({ props }) => {
  const defaultDuration = 240; // template's default frames

  if (!props.voiceover?.enabled || !props.voiceover?.audioUrl) {
    return { durationInFrames: defaultDuration };
  }

  try {
    const audioDuration = await getAudioDurationInSeconds(props.voiceover.audioUrl);
    const audioFrames = Math.ceil(audioDuration * 30) + (props.voiceover.startFrame || 30);
    // Use whichever is longer: template default or audio + start offset + 30 frame buffer
    return {
      durationInFrames: Math.max(defaultDuration, audioFrames + 30)
    };
  } catch {
    return { durationInFrames: defaultDuration };
  }
};

// Then in the Composition:
<Composition
  id="PolaroidDrop"
  component={Template1Polaroid}
  durationInFrames={240}
  fps={30}
  width={1080}
  height={1920}
  schema={AdReelSchema}
  defaultProps={DEFAULT_PROPS}
  calculateMetadata={calculateMetadata}
/>
```

### 5E. Install Required Package

```bash
cd fb-marketing/remotion
npm install @remotion/media-utils
```

---

## 6. Render Pipeline Update

### Update `render-reel.mjs`

Add voiceover generation before the Remotion render step:

```js
import { generateVoiceover, selectVoice } from './generate-voiceover.js';

async function renderReel(spec, outputDir) {
  // ... existing setup code ...

  // ── NEW: Generate voiceover if enabled ──
  let voiceoverProps = {};
  if (spec.voiceover?.enabled !== false) {  // default ON
    const script = getVoiceoverScript(spec, pkg);
    if (script && script.length > 5) {
      const voice = selectVoice(spec);
      const speed = spec.voiceover?.speed || 0.95;
      const audioPath = path.join(outputDir, 'voiceover.mp3');

      console.log(`Generating voiceover: "${script.substring(0, 50)}..." (voice: ${voice})`);
      const { durationMs } = await generateVoiceover({
        text: script,
        voice,
        speed,
        outputPath: audioPath,
      });

      // Copy to Remotion's public/ so staticFile() can find it
      const publicPath = `voiceover/${spec.reel_id}.mp3`;
      const publicFullPath = path.join(__dirname, 'public', publicPath);
      fs.mkdirSync(path.dirname(publicFullPath), { recursive: true });
      fs.copyFileSync(audioPath, publicFullPath);

      voiceoverProps = {
        voiceover: {
          enabled: true,
          audioUrl: publicPath,
          startFrame: spec.voiceover?.startFrame || 30,
          volume: spec.voiceover?.volume || 0.9,
        }
      };

      console.log(`Voiceover generated: ${durationMs}ms`);
    }
  }

  // Merge voiceover props with existing input props
  const inputProps = {
    ...existingProps,
    ...voiceoverProps,
  };

  // ... existing Remotion bundle + renderMedia() code ...
}
```

---

## 7. Reel Spec Update

### Add voiceover fields to the reel spec JSON:

```json
{
  "reel_id": "reel-abc123",
  "template_id": "memory-returns",
  "voiceover": {
    "enabled": true,
    "script": null,
    "voice": "nova",
    "speed": 0.95,
    "startFrame": 30,
    "volume": 0.9
  },
  "copy": { "headline": "...", "support": "..." },
  "palette": { ... },
  "assets": { ... }
}
```

### Field Reference

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `voiceover.enabled` | boolean | `true` | Generate voiceover (set false to skip) |
| `voiceover.script` | string\|null | `null` | Manual script. If null, auto-generates from copy. |
| `voiceover.voice` | string | auto | OpenAI voice name. Auto-selects by template type. |
| `voiceover.speed` | number | `0.95` | Playback speed. 0.95 = slightly slower for emotional weight. |
| `voiceover.startFrame` | number | `30` | Frame when voiceover begins (after opening hook). |
| `voiceover.volume` | number | `0.9` | Audio volume 0-1. |

---

## 8. Reel Agent Update

### In `reel-agent.js`, update `scaffoldReelSpec`:

```js
function scaffoldReelSpec(pkg, templateId) {
  // ... existing spec building ...

  // Add voiceover defaults
  spec.voiceover = {
    enabled: true,
    script: null,         // auto-generate from copy
    voice: null,          // auto-select by template
    speed: 0.95,
    startFrame: 30,
    volume: 0.9,
  };

  return spec;
}
```

---

## 9. Per-Template Voice Start Times

Each template has a different "right moment" for the voiceover to begin — usually after the opening hook, when the photo is visible:

| Template | Default startFrame | Why |
|----------|-------------------|-----|
| 1 Polaroid | 40 | After polaroid lands |
| 2 Slider | 60 | When slider starts sweeping |
| 3 Kinetic | 15 | Words are already flying, voice adds energy |
| 4 Magazine | 20 | Photo reveals early |
| 5 Glitch | 45 | After RGB noise settles |
| 6 Peel | 40 | After peel begins |
| 8 Orbit | 30 | After dot pulse |
| 9 Film | 30 | After countdown |
| 11 Memory | 25 | During blur-to-sharp |
| 12 Legacy | 45 | After lock dissolves |
| 13 Generations | 30 | When first photo appears |
| 14 Face | 20 | During the slow deblur (voice amplifies emotion) |
| 15 Dust | 25 | As particles lift |
| 16 Warmth | 30 | As color starts spreading |
| 17 Album | 50 | After album page opens |
| 18 Face to Face | 20 | During sliver opening |
| 19 Triple | 30 | After first flash |

Store these as constants:

```js
const VOICE_START_FRAMES = {
  'polaroid-drop': 40,
  'slider-reveal': 60,
  'kinetic-type': 15,
  'magazine-cover': 20,
  'the-glitch': 45,
  'peel-away': 40,
  'the-orbit': 30,
  'filmstrip': 30,
  'memory-returns': 25,
  'legacy-unlocked': 45,
  'through-generations': 30,
  'face-returns': 20,
  'dust-of-time': 25,
  'warmth-returns': 30,
  'opening-album': 50,
  'face-to-face': 20,
  'triple-restore': 30,
};
```

---

## 10. Cost Estimate

| Volume | Monthly Cost | Notes |
|--------|-------------|-------|
| 10 reels/month | ~$0.02 | Testing phase |
| 50 reels/month | ~$0.10 | Early launch |
| 500 reels/month | ~$1.00 | Scaling |
| 5,000 reels/month | ~$10.00 | High volume |

OpenAI TTS is effectively free at any reasonable volume.

---

## 11. Implementation Phases

### Phase 1: Basic (1-2 hours)
- [ ] Create `generate-voiceover.js` with OpenAI TTS
- [ ] Add `voiceover` to reel spec schema
- [ ] Update `render-reel.mjs` to generate MP3 before render
- [ ] Add `VoiceoverLayer` component
- [ ] Add `<Audio>` to one template (Template 11 Memory Returns — most emotional)
- [ ] Test: render one reel with voice, play MP4

### Phase 2: All Templates (1 hour)
- [ ] Add `VoiceoverLayer` to all 17 active templates
- [ ] Set per-template `startFrame` defaults
- [ ] Add `calculateMetadata` for dynamic duration
- [ ] Test: render 3 different templates with voice

### Phase 3: Voice Selection (30 min)
- [ ] Add voice auto-selection by template type
- [ ] Add voice/speed/volume to editor's Voice tab → reel config export
- [ ] Test: compare `nova` vs `onyx` on same content

### Phase 4: LLM Script Refinement (optional, 1 hour)
- [ ] Add Gemini/OpenAI script rewrite step
- [ ] A/B test direct copy vs refined script
- [ ] Add script preview in editor

---

## 12. File Checklist

| File | Action |
|------|--------|
| `remotion/generate-voiceover.js` | **NEW** — OpenAI TTS generation + duration measurement |
| `remotion/render-reel.mjs` | **MODIFY** — Add voiceover generation before render |
| `remotion/src/ad-studio/components/VoiceoverLayer.tsx` | **NEW** — Remotion Audio wrapper |
| `remotion/src/ad-studio/schema.ts` | **MODIFY** — Add voiceover fields |
| `remotion/src/Root.jsx` | **MODIFY** — Add calculateMetadata to compositions |
| `remotion/package.json` | **MODIFY** — Add @remotion/media-utils |
| `control-plane/lib/agents/reel-agent.js` | **MODIFY** — Add voiceover to spec scaffolding |
| All 17 template `.tsx` files | **MODIFY** — Add `<VoiceoverLayer>` |

---

## 13. Testing

### Quick test (no photoapp needed):

```bash
cd /Users/jeffdai/photoapp/fb-marketing/remotion

# Generate a test voiceover
node -e "
import { generateVoiceover } from './generate-voiceover.js';
await generateVoiceover({
  text: 'My mom\'s wedding day. Clear enough to share again. Restore the faces, the fabric, and the feeling in one tap.',
  voice: 'nova',
  speed: 0.95,
  outputPath: './public/voiceover/test.mp3'
});
console.log('Done');
"

# Render with voiceover
npx remotion render MemoryReturns out/test-voice.mp4 --props='{
  "copy": { "headline": "My mom'\''s wedding day.", "support": "Restore the feeling.", "cta": "Try Free", "highlight": "wedding", "badge": "Family" },
  "designTokens": { ... },
  "assets": { "logoUrl": "", "afterPhotoUrl": "https://your-photo-url" },
  "brandContext": { "brandName": "Memorabil.ai" },
  "voiceover": { "enabled": true, "audioUrl": "voiceover/test.mp3", "startFrame": 25, "volume": 0.9 }
}'

# Play the result
open out/test-voice.mp4
```

### Verify:
1. MP3 generates without errors
2. MP4 has audio track (check in QuickTime/VLC)
3. Voice starts at the right moment (after opening hook)
4. Voice doesn't get cut off (duration auto-extends)
5. Volume is balanced (not too loud, not buried)
