# Remotion Ad Studio — Integration Guide

**Audience**: AI agent (Claude/Codex) working inside the `photoapp` project.
**Goal**: Add all 10 Ad Studio animated templates to the photoapp's Remotion pipeline so they can be selected, rendered, and published alongside the existing `ReelFromSpec` compositions.

---

## 1. Overview

### What the Remotion Ad Studio is

The Ad Studio (`/Users/jeffdai/ClaudeSkills/remotion-ad-studio/`) is a standalone Remotion project that provides 10 polished, fully-animated 9:16 video templates for photo-restoration ad reels. Each template is a self-contained React component that accepts a single typed `AdReelProps` object and produces an MP4-ready composition.

### What it provides

- **10 animated templates** covering distinct visual styles (physical/tactile, kinetic type, cyberpunk glitch, cinema, mosaic, etc.)
- **Shared `AdReelSchema`** — a Zod schema that validates all props at the boundary
- **Shared helper library** (`helpers.ts`) — spring, typewriter, seeded random, clamp
- **6 shared UI components** — `AdBackground`, `AdLogo`, `AdBadge`, `AdPhoto`, `AdSupport`, `AdCta`
- **`DEFAULT_PROPS`** — ready-made default values for local development

### Why it is being integrated

The photoapp already has a Remotion render pipeline (`fb-marketing/remotion/`) that supports `ReelFromSpec` (a scene-graph-driven composition). The Ad Studio templates are a qualitatively different class of creative — frame-by-frame cinematic animation rather than scene stacking. Integrating them enables the reel-agent to scaffold and render these templates from a `creative_package` (static winner) exactly as it does with existing templates.

### Architecture fit

```
creative_package (static_winner)
  → reel-agent.js  (scaffoldReelSpecFromPackage)
  → ad_reel_props JSON written into reel spec
  → render-reel.mjs  (selectComposition by template ID)
  → Remotion bundle (Root.jsx now includes all 10 Ad Studio compositions)
  → MP4 to creative-output/reels/
```

---

## 2. Source Files to Copy

All source files live under:
```
/Users/jeffdai/ClaudeSkills/remotion-ad-studio/remotion/src/
```

Copy them into:
```
/Users/jeffdai/photoapp/fb-marketing/remotion/src/ad-studio/
```

### File mapping — source → destination

```
SOURCE (remotion-ad-studio/remotion/src/)          DESTINATION (photoapp/fb-marketing/remotion/src/ad-studio/)
─────────────────────────────────────────────────  ───────────────────────────────────────────────────────────
schema.ts                                          schema.ts
helpers.ts                                         helpers.ts
components/AdBackground.tsx                        components/AdBackground.tsx
components/AdLogo.tsx                              components/AdLogo.tsx
components/AdBadge.tsx                             components/AdBadge.tsx
components/AdHeadline.tsx                          components/AdHeadline.tsx
components/AdPhoto.tsx                             components/AdPhoto.tsx
components/AdSupport.tsx                           components/AdSupport.tsx
components/AdCta.tsx                               components/AdCta.tsx
templates/Template1Polaroid.tsx                    templates/Template1Polaroid.tsx
templates/Template2Slider.tsx                      templates/Template2Slider.tsx
templates/Template3Kinetic.tsx                     templates/Template3Kinetic.tsx
templates/Template4Magazine.tsx                    templates/Template4Magazine.tsx
templates/Template5Glitch.tsx                      templates/Template5Glitch.tsx
templates/Template6Peel.tsx                        templates/Template6Peel.tsx
templates/Template7Blinds.tsx                      templates/Template7Blinds.tsx
templates/Template8Orbit.tsx                       templates/Template8Orbit.tsx
templates/Template9Film.tsx                        templates/Template9Film.tsx
templates/Template10Mosaic.tsx                     templates/Template10Mosaic.tsx
```

Do NOT copy `Root.tsx` or `index.ts` from the Ad Studio — the photoapp has its own `Root.jsx` and `index.jsx` that you will modify in place.

### Create the destination directory

```bash
mkdir -p /Users/jeffdai/photoapp/fb-marketing/remotion/src/ad-studio/components
mkdir -p /Users/jeffdai/photoapp/fb-marketing/remotion/src/ad-studio/templates
```

### Copy all files in one pass

```bash
DEST=/Users/jeffdai/photoapp/fb-marketing/remotion/src/ad-studio
SRC=/Users/jeffdai/ClaudeSkills/remotion-ad-studio/remotion/src

cp "$SRC/schema.ts"   "$DEST/schema.ts"
cp "$SRC/helpers.ts"  "$DEST/helpers.ts"
cp "$SRC/components/"*.tsx  "$DEST/components/"
cp "$SRC/templates/"*.tsx   "$DEST/templates/"
```

### Dependency check

The Ad Studio templates import from `remotion` and `zod`. The photoapp's Remotion package (`fb-marketing/remotion/package.json`) already has:

```json
"@remotion/bundler": "^4.0.434",
"@remotion/renderer": "^4.0.434",
"remotion": "^4.0.434"
```

You need to add `zod` because the schema uses it:

```bash
cd /Users/jeffdai/photoapp/fb-marketing/remotion
npm install zod
```

The templates are TypeScript (`.tsx`). Remotion bundles TypeScript natively — no tsconfig change is required as long as the Remotion version supports it (4.x does). If the bundler complains, add a minimal `tsconfig.json` at `/Users/jeffdai/photoapp/fb-marketing/remotion/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ES2020",
    "moduleResolution": "bundler",
    "jsx": "react",
    "strict": false,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

---

## 3. Schema Bridging

### `AdReelProps` definition

The Ad Studio schema (in `ad-studio/schema.ts`) is:

```typescript
AdReelProps = {
  copy: {
    headline: string,
    support: string,
    cta: string,
    highlight: string,
    badge: string,
    angle?: string,
  },
  designTokens: {
    primary: string,
    secondary?: string,
    ink?: string,
    light?: string,
    headline_text: string,
    support_text: string,
    surface: string,
    chrome?: string,
    media_fill?: string,
    badge_bg: string,
    badge_text: string,
    cta_bg: string,
    cta_text: string,
    cta_border?: string | null,
    gradient_from: string,
    gradient_to: string,
  },
  assets: {
    logoUrl: string,
    beforePhotoUrl?: string,
    afterPhotoUrl: string,
  },
  brandContext: {
    brandName: string,
  },
}
```

### Creative package structure (photoapp)

A `creative_package` (stored via `creative-package-store.js`) for a `static_winner` or `reel_render` role has these relevant fields:

```js
{
  package_id: string,
  package_role: "static_winner" | "reel_render",
  copy: {
    headline: string,
    support: string,   // also appears as content.support
    cta: string,
    badge: string,
    angle?: string,
    highlight?: string,
  },
  // also duplicated under content.*
  content: {
    headline, support, cta, badge, angle, subheadline,
  },
  design_tokens: {
    // same key names as AdReelProps.designTokens — already aligned
    primary, secondary, ink, light,
    headline_text, support_text, surface, chrome,
    media_fill, badge_bg, badge_text,
    cta_bg, cta_text, gradient_from, gradient_to, ...
  },
  design_token_overrides: { ... },  // per-variant overrides, merged on top of design_tokens
  assets: {
    logo_url: string,        // NOTE: snake_case in package
    before_photo_url?: string,
    after_photo_url: string,
  },
  brand_context: {
    brandName?: string,
    brandKit?: { name, tagline, ... },
  },
  palette: { primary, secondary, ink, light },
}
```

### Field-by-field mapping

| Creative package field | AdReelProps field | Notes |
|---|---|---|
| `copy.headline` or `content.headline` | `copy.headline` | Prefer `content.headline`, fall back to `copy.headline` |
| `copy.support` or `content.support` | `copy.support` | Same fallback chain |
| `copy.cta` or `content.cta` | `copy.cta` | |
| `copy.highlight` | `copy.highlight` | Default to first word of headline if missing |
| `copy.badge` or `content.badge` | `copy.badge` | Default to `"Family Story"` |
| `copy.angle` or `content.angle` | `copy.angle` | Optional |
| `design_tokens` merged with `design_token_overrides` | `designTokens` | Apply overrides on top |
| `assets.logo_url` | `assets.logoUrl` | camelCase conversion |
| `assets.before_photo_url` | `assets.beforePhotoUrl` | Optional |
| `assets.after_photo_url` | `assets.afterPhotoUrl` | Required |
| `brand_context.brandName` or `brand_context.brandKit.name` | `brandContext.brandName` | |

### Mapping function

Place this at `/Users/jeffdai/photoapp/fb-marketing/control-plane/lib/agents/creative/creative-package-to-ad-reel-props.js`:

```js
/**
 * Converts a normalized creative_package to AdReelProps (the Ad Studio schema).
 * Works for static_winner and reel_render packages.
 */
export function creativePackageToAdReelProps(pkg) {
  const copy = pkg.copy || {};
  const content = pkg.content || {};
  const tokens = { ...(pkg.design_tokens || {}), ...(pkg.design_token_overrides || {}) };
  const assets = pkg.assets || {};
  const brandContext = pkg.brand_context || {};
  const brandKit = brandContext.brandKit || {};

  const headline = String(content.headline || copy.headline || "Bring old memories back.").trim();

  return {
    copy: {
      headline,
      support: String(content.support || content.subheadline || copy.support || copy.subhead || "Restore treasured photos with AI.").trim(),
      cta: String(content.cta || copy.cta || "Restore old photos").trim(),
      highlight: String(copy.highlight || headline.split(" ")[0] || "").trim(),
      badge: String(content.badge || copy.badge || "Family Story").trim(),
      angle: String(content.angle || copy.angle || "family-memory").trim() || undefined,
    },
    designTokens: {
      primary:        tokens.primary        || "#d26739",
      secondary:      tokens.secondary      || tokens.primary || "#d26739",
      ink:            tokens.ink            || "#261d1a",
      light:          tokens.light          || "#efe7db",
      headline_text:  tokens.headline_text  || tokens.primary || "#d26739",
      support_text:   tokens.support_text   || tokens.primary || "#d26739",
      surface:        tokens.surface        || "#42291f",
      chrome:         tokens.chrome         || tokens.surface || "#42291f",
      media_fill:     tokens.media_fill     || "#4f2f21",
      badge_bg:       tokens.badge_bg       || tokens.primary || "#d26739",
      badge_text:     tokens.badge_text     || "#efe7db",
      cta_bg:         tokens.cta_bg         || tokens.primary || "#d26739",
      cta_text:       tokens.cta_text       || "#efe7db",
      cta_border:     tokens.cta_border     ?? null,
      gradient_from:  tokens.gradient_from  || "#261d1a",
      gradient_to:    tokens.gradient_to    || "#6e3c27",
    },
    assets: {
      logoUrl:        String(assets.logo_url || "").trim(),
      beforePhotoUrl: String(assets.before_photo_url || "").trim() || undefined,
      afterPhotoUrl:  String(assets.after_photo_url || "").trim(),
    },
    brandContext: {
      brandName: String(brandContext.brandName || brandKit.name || "Memorabil.ai").trim(),
    },
  };
}
```

### Validation

After mapping, validate with the Zod schema before passing to Remotion. In a Node.js context you can call the schema directly because `schema.ts` compiles to a plain ES module:

```js
// In reel-agent.js or the render pipeline — ES module import
// (The bundler transpiles .ts; for Node.js server code use a compiled version or skip and rely on Remotion validation)
// Option A: skip server-side Zod validation, let Remotion validate at render time
// Option B: add a lightweight runtime check:

function validateAdReelProps(props) {
  const required = ["headline", "support", "cta", "highlight", "badge"];
  for (const key of required) {
    if (!props?.copy?.[key] && props?.copy?.[key] !== "") {
      throw new Error(`AdReelProps.copy.${key} is required`);
    }
  }
  if (!props?.assets?.afterPhotoUrl) {
    throw new Error("AdReelProps.assets.afterPhotoUrl is required");
  }
  if (!props?.brandContext?.brandName) {
    throw new Error("AdReelProps.brandContext.brandName is required");
  }
}
```

---

## 4. Template Registration

### Current state of photoapp Root.jsx

`/Users/jeffdai/photoapp/fb-marketing/remotion/src/Root.jsx` currently registers exactly one composition:

```jsx
export const Root = () => (
  <Composition
    id="ReelFromSpec"
    component={ReelFromSpec}
    durationInFrames={390}
    fps={30}
    width={1080}
    height={1920}
    defaultProps={{spec: defaultReelSpec}}
    calculateMetadata={calculateReelMetadata}
  />
);
```

### Updated Root.jsx

Replace the entire file contents with:

```jsx
import React from "react";
import {Composition, Folder} from "remotion";
import {ReelFromSpec, calculateReelMetadata, defaultReelSpec} from "./compositions/ReelFromSpec.jsx";

// Ad Studio templates
import {Template1Polaroid}  from "./ad-studio/templates/Template1Polaroid";
import {Template2Slider}    from "./ad-studio/templates/Template2Slider";
import {Template3Kinetic}   from "./ad-studio/templates/Template3Kinetic";
import {Template4Magazine}  from "./ad-studio/templates/Template4Magazine";
import {Template5Glitch}    from "./ad-studio/templates/Template5Glitch";
import {Template6Peel}      from "./ad-studio/templates/Template6Peel";
import {Template7Blinds}    from "./ad-studio/templates/Template7Blinds";
import {Template8Orbit}     from "./ad-studio/templates/Template8Orbit";
import {Template9Film}      from "./ad-studio/templates/Template9Film";
import {Template10Mosaic}   from "./ad-studio/templates/Template10Mosaic";
import {DEFAULT_PROPS}      from "./ad-studio/schema";

export const Root = () => (
  <>
    {/* Existing scene-graph composition */}
    <Composition
      id="ReelFromSpec"
      component={ReelFromSpec}
      durationInFrames={390}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{spec: defaultReelSpec}}
      calculateMetadata={calculateReelMetadata}
    />

    {/* Ad Studio animated templates */}
    <Folder name="Ad-Reels">
      <Composition id="PolaroidDrop"    component={Template1Polaroid}  durationInFrames={240} fps={30} width={1080} height={1920} defaultProps={DEFAULT_PROPS} />
      <Composition id="SliderReveal"    component={Template2Slider}    durationInFrames={300} fps={30} width={1080} height={1920} defaultProps={DEFAULT_PROPS} />
      <Composition id="KineticType"     component={Template3Kinetic}   durationInFrames={270} fps={30} width={1080} height={1920} defaultProps={DEFAULT_PROPS} />
      <Composition id="MagazineCover"   component={Template4Magazine}  durationInFrames={240} fps={30} width={1080} height={1920} defaultProps={DEFAULT_PROPS} />
      <Composition id="TheGlitch"       component={Template5Glitch}    durationInFrames={210} fps={30} width={1080} height={1920} defaultProps={DEFAULT_PROPS} />
      <Composition id="PeelAway"        component={Template6Peel}      durationInFrames={270} fps={30} width={1080} height={1920} defaultProps={DEFAULT_PROPS} />
      <Composition id="VenetianBlinds"  component={Template7Blinds}    durationInFrames={240} fps={30} width={1080} height={1920} defaultProps={DEFAULT_PROPS} />
      <Composition id="TheOrbit"        component={Template8Orbit}     durationInFrames={300} fps={30} width={1080} height={1920} defaultProps={DEFAULT_PROPS} />
      <Composition id="Filmstrip"       component={Template9Film}      durationInFrames={270} fps={30} width={1080} height={1920} defaultProps={DEFAULT_PROPS} />
      <Composition id="MosaicAssemble"  component={Template10Mosaic}   durationInFrames={270} fps={30} width={1080} height={1920} defaultProps={DEFAULT_PROPS} />
    </Folder>
  </>
);
```

Key differences from the Ad Studio's `Root.tsx`:
- The original exports `RemotionRoot`; the photoapp file exports `Root` (matches the existing `index.jsx` import).
- The `Folder` is cosmetic — Remotion renders compositions whether or not they are inside a `Folder`.
- No `schema` prop is needed in JSX (schemas are TypeScript-only at build time; they are irrelevant at render time).

---

## 5. Render Pipeline Integration

### Current behavior of render-reel.mjs

`/Users/jeffdai/photoapp/fb-marketing/remotion/render-reel.mjs` always calls:

```js
const composition = await selectComposition({
  serveUrl: bundleInfo.serveUrl,
  id: "ReelFromSpec",
  inputProps,
  ...
});
```

`inputProps` is `{ spec: remotionSpec }` where `remotionSpec` is the hydrated reel-spec JSON.

### What needs to change

For Ad Studio templates, `inputProps` must be the `AdReelProps` object directly (not wrapped in `{ spec: ... }`). The composition ID is determined by which template was selected.

The reel spec written by `reel-agent.js` needs one new field:

```json
{
  "template_source": "ad-studio",
  "ad_reel_composition_id": "PolaroidDrop",
  "ad_reel_props": { ...AdReelProps... }
}
```

### Updated render-reel.mjs — key section

Find the block starting at line 394 that builds `inputProps` and calls `selectComposition`. Replace it with the following routing logic:

```js
// Detect Ad Studio render path
const isAdStudio = originalSpec.template_source === "ad-studio" &&
                   originalSpec.ad_reel_composition_id &&
                   originalSpec.ad_reel_props;

const compositionId = isAdStudio
  ? originalSpec.ad_reel_composition_id
  : "ReelFromSpec";

const inputProps = isAdStudio
  ? originalSpec.ad_reel_props           // AdReelProps directly
  : { spec: remotionSpec };              // existing scene-graph format

const compositionStartedAt = Date.now();
const composition = await selectComposition({
  serveUrl: bundleInfo.serveUrl,
  id: compositionId,
  inputProps,
  puppeteerInstance: browser,
  logLevel: "error"
});
const compositionSelectMs = Date.now() - compositionStartedAt;

// posterFrameForSpec falls back to 42% of duration for Ad Studio reels
// (no scenes array) — this already works with the existing implementation.
```

The `hydrateSpecForRemotion` function resolves local file paths and copies them into the bundle staging directory. For Ad Studio renders, `assets.afterPhotoUrl` and `assets.logoUrl` may be:
- Absolute URLs (CDN) — Remotion fetches them natively, no staging needed
- Absolute local paths — need staging

Add a helper to stage Ad Studio assets before rendering:

```js
const hydrateAdReelPropsForRemotion = (adReelProps, specDir, stagingDir, publicPrefix) => {
  const next = JSON.parse(JSON.stringify(adReelProps));

  // Stage afterPhotoUrl if it is a local path
  const afterPath = resolveInputPath(adReelProps.assets?.afterPhotoUrl, specDir);
  if (afterPath && fs.existsSync(afterPath)) {
    next.assets.afterPhotoUrl = stageAsset(afterPath, stagingDir, publicPrefix) ?? adReelProps.assets.afterPhotoUrl;
  }

  // Stage beforePhotoUrl if present and local
  if (adReelProps.assets?.beforePhotoUrl) {
    const beforePath = resolveInputPath(adReelProps.assets.beforePhotoUrl, specDir);
    if (beforePath && fs.existsSync(beforePath)) {
      next.assets.beforePhotoUrl = stageAsset(beforePath, stagingDir, publicPrefix) ?? adReelProps.assets.beforePhotoUrl;
    }
  }

  // Stage logoUrl if local
  if (adReelProps.assets?.logoUrl) {
    const logoPath = resolveInputPath(adReelProps.assets.logoUrl, specDir);
    if (logoPath && fs.existsSync(logoPath)) {
      next.assets.logoUrl = stageAsset(logoPath, stagingDir, publicPrefix) ?? adReelProps.assets.logoUrl;
    }
  }

  return next;
};
```

Then update the `main()` function to call it for Ad Studio paths:

```js
const remotionSpec = hydrateSpecForRemotion(originalSpec, specDir, stagingDir, publicPrefix);

const isAdStudio = originalSpec.template_source === "ad-studio" &&
                   originalSpec.ad_reel_composition_id &&
                   originalSpec.ad_reel_props;

const inputProps = isAdStudio
  ? hydrateAdReelPropsForRemotion(originalSpec.ad_reel_props, specDir, stagingDir, publicPrefix)
  : { spec: remotionSpec };

const compositionId = isAdStudio
  ? originalSpec.ad_reel_composition_id
  : "ReelFromSpec";
```

The rest of `main()` (renderMedia, renderStill, writeManifest, cleanup) works unchanged because it uses `originalSpec` and `composition` — both of which are already set correctly.

---

## 6. Reel Agent Updates

### File to modify

`/Users/jeffdai/photoapp/fb-marketing/control-plane/lib/agents/reel-agent.js`

### What to add

Add the template-ID-to-composition-ID mapping and a new build path for Ad Studio specs.

#### Step 1 — Add the mapping constant near the top of the file (after existing constants)

```js
// Ad Studio composition IDs indexed by template registry ID.
// These must match the composition `id` props registered in Root.jsx.
const AD_STUDIO_TEMPLATE_MAP = {
  "polaroid-drop":    "PolaroidDrop",
  "slider-reveal":    "SliderReveal",
  "kinetic-type":     "KineticType",
  "magazine-cover":   "MagazineCover",
  "the-glitch":       "TheGlitch",
  "peel-away":        "PeelAway",
  "venetian-blinds":  "VenetianBlinds",
  "the-orbit":        "TheOrbit",
  "filmstrip":        "Filmstrip",
  "mosaic-assemble":  "MosaicAssemble",
};

function isAdStudioTemplateId(templateRegistryId) {
  return Boolean(AD_STUDIO_TEMPLATE_MAP[String(templateRegistryId || "").toLowerCase()]);
}
```

#### Step 2 — Import the mapping helper

Add this import near the top (with the other imports):

```js
import { creativePackageToAdReelProps } from "./creative/creative-package-to-ad-reel-props.js";
```

#### Step 3 — Add a new `buildAdStudioReelSpec` function

Insert this function before `scaffoldReelSpec`:

```js
async function buildAdStudioReelSpec(packageId, { templateId } = {}) {
  const creativePackage = getCreativePackage(packageId);
  if (!creativePackage) {
    throw new Error(`Creative package not found: ${packageId}`);
  }
  if (creativePackage.package_role !== CREATIVE_PACKAGE_ROLES.STATIC_WINNER) {
    throw new Error("Ad Studio reels require a static_winner package.");
  }

  const normalizedTemplateId = String(templateId || "polaroid-drop").toLowerCase();
  const compositionId = AD_STUDIO_TEMPLATE_MAP[normalizedTemplateId];
  if (!compositionId) {
    throw new Error(`Unknown Ad Studio template: ${normalizedTemplateId}. Valid IDs: ${Object.keys(AD_STUDIO_TEMPLATE_MAP).join(", ")}`);
  }

  const adReelProps = creativePackageToAdReelProps(creativePackage);
  const reelId = `${creativePackage.package_id}-adstudio-${normalizedTemplateId}-${id("variant")}`;

  // Duration in seconds per template (matches composition durationInFrames / 30)
  const TEMPLATE_DURATION_MS = {
    "polaroid-drop":   8000,
    "slider-reveal":  10000,
    "kinetic-type":    9000,
    "magazine-cover":  8000,
    "the-glitch":      7000,
    "peel-away":       9000,
    "venetian-blinds": 8000,
    "the-orbit":      10000,
    "filmstrip":       9000,
    "mosaic-assemble": 9000,
  };

  return {
    reel_id: reelId,
    version: 1,
    source_package_id: creativePackage.package_id,
    static_winner_package_id: creativePackage.package_id,
    // Render routing flags — render-reel.mjs reads these
    template_source: "ad-studio",
    ad_reel_composition_id: compositionId,
    ad_reel_props: adReelProps,
    // Metadata for manifest and catalog
    template_id: "classic",              // fallback for legacy manifest fields
    template_registry_id: normalizedTemplateId,
    template_label: compositionId,
    angle: adReelProps.copy.angle || "family-memory",
    hook_text: adReelProps.copy.headline,
    caption: [adReelProps.copy.headline, adReelProps.copy.support].filter(Boolean).join(" "),
    cta: adReelProps.copy.cta,
    hashtags: ["#PastPix", "#PhotoRestoration", "#FamilyMemories"],
    distribution: {
      primary_channel: "tiktok",
      repurpose_channels: ["instagram_reel", "youtube_short"],
      creator_fit: ["ugc_emotional"],
    },
    output: {
      aspect_ratio: "9:16",
      fps: 30,
      width: 1080,
      height: 1920,
      render_poster: true,
    },
    compliance: {
      requires_manual_review: true,
      claim_notes: "Ad Studio animated template — review before posting.",
    },
    // duration_ms used for manifest summary
    duration_ms: TEMPLATE_DURATION_MS[normalizedTemplateId] || 9000,
    // scenes is empty — Ad Studio templates do not use the scene graph
    scenes: [],
  };
}
```

#### Step 4 — Export new public functions

Add these exports alongside `scaffoldReelSpecFromPackage`:

```js
export async function scaffoldAdStudioReelSpec(packageId, { templateId } = {}) {
  const reelSpec = await buildAdStudioReelSpec(packageId, { templateId });
  ensureDir(paths.generatedReelSpecsDir);
  const filePath = reelSpecFilePath(reelSpec.reel_id);
  writeJson(filePath, reelSpec);
  await persistReelArtifacts({ reelSpec, specPath: filePath });
  logEvent("reels.ad_studio_spec_scaffolded", {
    packageId,
    reelId: reelSpec.reel_id,
    templateId: reelSpec.template_registry_id,
  });
  return { filePath, ...reelSpec };
}

export function listAdStudioTemplates() {
  return Object.entries(AD_STUDIO_TEMPLATE_MAP).map(([id, compositionId]) => ({
    id,
    compositionId,
    source: "ad-studio",
  }));
}
```

---

## 7. API Endpoint

### Existing endpoint pattern

Reel render requests flow through route handlers under:
```
/Users/jeffdai/photoapp/fb-marketing/control-plane/lib/http/routes/
```

Look for the handler that calls `scaffoldReelSpecFromPackage` or `renderReelSpecAsync`. It likely responds to a `POST /api/action/reel/*` route.

### What to add

In the route handler that accepts reel render requests, add a branch for Ad Studio templates. The caller passes `templateId` in the request body. When `templateId` matches one of the 10 Ad Studio IDs, route to `scaffoldAdStudioReelSpec` instead of `scaffoldReelSpecFromPackage`.

```js
import {
  scaffoldReelSpecFromPackage,
  scaffoldAdStudioReelSpec,
  renderReelSpecAsync,
  listAdStudioTemplates,
} from "../agents/reel-agent.js";

// Determine if the requested templateId is an Ad Studio template
const AD_STUDIO_IDS = new Set([
  "polaroid-drop", "slider-reveal", "kinetic-type", "magazine-cover", "the-glitch",
  "peel-away", "venetian-blinds", "the-orbit", "filmstrip", "mosaic-assemble",
]);

// In the route handler for POST /api/action/reel/render-from-package
async function handleReelRenderFromPackage(req, res) {
  const { packageId, templateId } = req.body;

  let specResult;
  if (AD_STUDIO_IDS.has(String(templateId || "").toLowerCase())) {
    specResult = await scaffoldAdStudioReelSpec(packageId, { templateId });
  } else {
    specResult = await scaffoldReelSpecFromPackage(packageId, { templateId });
  }

  const manifest = await renderReelSpecAsync(specResult.filePath);
  return res.json({ ok: true, data: manifest });
}

// Add a GET endpoint to expose the template catalog to the UI
// GET /api/surface/ad-studio-templates
function handleListAdStudioTemplates(req, res) {
  return res.json({ ok: true, data: listAdStudioTemplates() });
}
```

The `renderReelSpecAsync` function in `reel-agent.js` calls the shell script `render-reel-from-spec.sh` which in turn calls `render-reel.mjs`. No changes to the shell script are needed — it passes the spec path through unchanged.

---

## 8. JSON Format

### The reel spec JSON (written to disk, then passed to render-reel.mjs)

For an Ad Studio render, the spec file at
`fb-marketing/creative-inputs/generated-reel-specs/<reel_id>.json`
looks like this:

```json
{
  "reel_id": "static-winner-pkg-abc123-adstudio-polaroid-drop-xyz789",
  "version": 1,
  "source_package_id": "static-winner-pkg-abc123",
  "static_winner_package_id": "static-winner-pkg-abc123",
  "template_source": "ad-studio",
  "ad_reel_composition_id": "PolaroidDrop",
  "ad_reel_props": {
    "copy": {
      "headline": "My mom's wedding day. Clear enough to share again.",
      "support": "Restore the faces, the fabric, and the feeling in one tap.",
      "cta": "Restore This Photo",
      "highlight": "share again",
      "badge": "Family Story",
      "angle": "family-memory"
    },
    "designTokens": {
      "primary": "#d26739",
      "secondary": "#d26739",
      "ink": "#261d1a",
      "light": "#d26739",
      "headline_text": "#d26739",
      "support_text": "#d26739",
      "surface": "#42291f",
      "chrome": "#42291f",
      "media_fill": "#4f2f21",
      "badge_bg": "#d26739",
      "badge_text": "#efe7db",
      "cta_bg": "#d26739",
      "cta_text": "#efe7db",
      "cta_border": null,
      "gradient_from": "#261d1a",
      "gradient_to": "#6e3c27"
    },
    "assets": {
      "logoUrl": "https://pub-c7a5cb270590471c86fa625084a338d2.r2.dev/control-plane/creative-inputs/brand-logos/Screenshot_2026-03-12_at_3_10_35_PM-1773582223562.png",
      "beforePhotoUrl": "",
      "afterPhotoUrl": "https://pub-c7a5cb270590471c86fa625084a338d2.r2.dev/control-plane/creative-inputs/brand-images/Gemini_Generated_Image_re7mc5re7mc5re7m-1773584518003.png"
    },
    "brandContext": {
      "brandName": "Memorabil.ai"
    }
  },
  "template_id": "classic",
  "template_registry_id": "polaroid-drop",
  "template_label": "PolaroidDrop",
  "angle": "family-memory",
  "hook_text": "My mom's wedding day. Clear enough to share again.",
  "caption": "My mom's wedding day. Clear enough to share again. Restore the faces, the fabric, and the feeling in one tap.",
  "cta": "Restore This Photo",
  "hashtags": ["#PastPix", "#PhotoRestoration", "#FamilyMemories"],
  "distribution": {
    "primary_channel": "tiktok",
    "repurpose_channels": ["instagram_reel", "youtube_short"],
    "creator_fit": ["ugc_emotional"]
  },
  "output": {
    "aspect_ratio": "9:16",
    "fps": 30,
    "width": 1080,
    "height": 1920,
    "render_poster": true
  },
  "compliance": {
    "requires_manual_review": true,
    "claim_notes": "Ad Studio animated template — review before posting."
  },
  "duration_ms": 8000,
  "scenes": []
}
```

### What Remotion receives as inputProps

```json
{
  "copy": {
    "headline": "My mom's wedding day. Clear enough to share again.",
    "support": "Restore the faces, the fabric, and the feeling in one tap.",
    "cta": "Restore This Photo",
    "highlight": "share again",
    "badge": "Family Story",
    "angle": "family-memory"
  },
  "designTokens": {
    "primary": "#d26739",
    "secondary": "#d26739",
    "ink": "#261d1a",
    "light": "#d26739",
    "headline_text": "#d26739",
    "support_text": "#d26739",
    "surface": "#42291f",
    "chrome": "#42291f",
    "media_fill": "#4f2f21",
    "badge_bg": "#d26739",
    "badge_text": "#efe7db",
    "cta_bg": "#d26739",
    "cta_text": "#efe7db",
    "cta_border": null,
    "gradient_from": "#261d1a",
    "gradient_to": "#6e3c27"
  },
  "assets": {
    "logoUrl": "https://...",
    "beforePhotoUrl": "",
    "afterPhotoUrl": "https://..."
  },
  "brandContext": {
    "brandName": "Memorabil.ai"
  }
}
```

This is the `AdReelProps` object directly. All 10 templates receive this same shape.

---

## 9. Template Catalog

All templates are 1080x1920 (9:16 vertical), 30fps.

| # | Template Registry ID | Remotion Composition ID | Duration | Frames | Description | Best use case |
|---|---|---|---|---|---|---|
| 1 | `polaroid-drop` | `PolaroidDrop` | 8s | 240 | Physical polaroid drops from above and bounces. Logo drops in first, polaroid frame follows, headline types out with blinking cursor, CTA bounces up from bottom. | Nostalgia/family angle, emotionally warm |
| 2 | `slider-reveal` | `SliderReveal` | 10s | 300 | Before/after photo reveal via a horizontal wipe slider that scrubs across the frame. Shows dramatic restoration comparison. | Before/after transformation, high visual impact |
| 3 | `kinetic-type` | `KineticType` | 9s | 270 | Bold kinetic typography — words fly in, scale, and exit with spring physics. Headline is the hero; photo is secondary background. | Punchy copy-first ads, engagement hooks |
| 4 | `magazine-cover` | `MagazineCover` | 8s | 240 | High-end editorial layout. Content slides in as if composing a magazine page. Clean grid, serif-adjacent type. | Premium positioning, trust-building |
| 5 | `the-glitch` | `TheGlitch` | 7s | 210 | Cyberpunk/digital aesthetic. Static noise burst opens, photo strips slide in from alternating sides, headline scrambles from GLITCH_CHARS to real text, support text types in terminal style. | Younger demographic, tech-forward, TikTok native |
| 6 | `peel-away` | `PeelAway` | 9s | 270 | Corner page peel reveals the restored photo underneath. Tactile paper metaphor. | Before/after reveal with physical metaphor |
| 7 | `venetian-blinds` | `VenetianBlinds` | 8s | 240 | Horizontal blinds animate open to reveal the photo, like raising window shades. Satisfying mechanical reveal. | Any restoration demo, satisfying reveal |
| 8 | `the-orbit` | `TheOrbit` | 10s | 300 | Elements orbit into position around a central photo. Dynamic spatial motion, premium feel. | High-awareness campaigns, premium product |
| 9 | `filmstrip` | `Filmstrip` | 9s | 270 | Full cinema aesthetic. Opens with a film countdown (3-2-1), sprocket holes appear on both sides, photo slides in from right, clapperboard snaps shut into badge, light leak sweeps across, headline reveals line-by-line with projector flicker, support scrolls up like credits. | Cinematic storytelling, heritage/legacy angle |
| 10 | `mosaic-assemble` | `MosaicAssemble` | 9s | 270 | Photo tiles assemble from scattered positions into the full image. Satisfying assembly metaphor. | Visual proof of restoration quality |

---

## 10. Testing

### Step 1 — Verify the bundle compiles

Start the Remotion studio to confirm all 10 compositions are registered and the bundle builds without TypeScript errors:

```bash
cd /Users/jeffdai/photoapp/fb-marketing/remotion
npx remotion studio
```

Open `http://localhost:3000`. You should see the `Ad-Reels` folder in the left panel with all 10 compositions listed alongside `ReelFromSpec`. If TypeScript errors appear in the terminal, fix them before proceeding.

### Step 2 — Render a single Ad Studio spec manually

Write a minimal test spec to disk:

```bash
cat > /tmp/test-ad-studio-reel.json << 'EOF'
{
  "reel_id": "test-ad-studio-polaroid-001",
  "version": 1,
  "template_source": "ad-studio",
  "ad_reel_composition_id": "PolaroidDrop",
  "ad_reel_props": {
    "copy": {
      "headline": "My mom's wedding day. Clear enough to share again.",
      "support": "Restore the faces, the fabric, and the feeling in one tap.",
      "cta": "Restore This Photo",
      "highlight": "share again",
      "badge": "Family Story",
      "angle": "family-memory"
    },
    "designTokens": {
      "primary": "#d26739",
      "secondary": "#d26739",
      "ink": "#261d1a",
      "light": "#d26739",
      "headline_text": "#d26739",
      "support_text": "#d26739",
      "surface": "#42291f",
      "chrome": "#42291f",
      "media_fill": "#4f2f21",
      "badge_bg": "#d26739",
      "badge_text": "#efe7db",
      "cta_bg": "#d26739",
      "cta_text": "#efe7db",
      "cta_border": null,
      "gradient_from": "#261d1a",
      "gradient_to": "#6e3c27"
    },
    "assets": {
      "logoUrl": "https://pub-c7a5cb270590471c86fa625084a338d2.r2.dev/control-plane/creative-inputs/brand-logos/Screenshot_2026-03-12_at_3_10_35_PM-1773582223562.png",
      "beforePhotoUrl": "",
      "afterPhotoUrl": "https://pub-c7a5cb270590471c86fa625084a338d2.r2.dev/control-plane/creative-inputs/brand-images/Gemini_Generated_Image_re7mc5re7mc5re7m-1773584518003.png"
    },
    "brandContext": {
      "brandName": "Memorabil.ai"
    }
  },
  "scenes": [],
  "output": { "aspect_ratio": "9:16", "fps": 30, "width": 1080, "height": 1920 }
}
EOF
```

Run the renderer directly:

```bash
cd /Users/jeffdai/photoapp/fb-marketing/remotion
node render-reel.mjs /tmp/test-ad-studio-reel.json
```

Check that output files were created:

```bash
ls /Users/jeffdai/photoapp/fb-marketing/creative-output/reels/test-ad-studio-polaroid-001/
# Expected: test-ad-studio-polaroid-001.mp4  test-ad-studio-polaroid-001-poster.png  manifest.json  summary.md
```

### Step 3 — Verify reel-spec validator does not reject Ad Studio specs

The existing `validateReelSpec` in `fb-marketing/remotion/src/lib/reel-layout-validator.js` validates the scene-graph format. It should pass or skip gracefully for Ad Studio specs (which have `scenes: []`). Check whether it requires at least one scene:

```bash
node -e "
import('./fb-marketing/remotion/src/lib/reel-layout-validator.js').then(m => {
  const result = m.validateReelSpec({ reel_id: 'test', template_source: 'ad-studio', scenes: [] });
  console.log(JSON.stringify(result, null, 2));
});
"
```

If the validator rejects `scenes: []`, add an exemption in `reel-layout-validator.js`:

```js
// At the top of validateReelSpec:
if (spec?.template_source === "ad-studio") {
  return { ok: true, errors: [] };
}
```

### Step 4 — Test all 10 templates

Run a quick loop to verify each composition renders:

```bash
for COMP_ID in PolaroidDrop SliderReveal KineticType MagazineCover TheGlitch PeelAway VenetianBlinds TheOrbit Filmstrip MosaicAssemble; do
  REEL_ID="test-${COMP_ID,,}-$(date +%s)"
  cat > /tmp/test-${COMP_ID}.json << EOF
{
  "reel_id": "${REEL_ID}",
  "version": 1,
  "template_source": "ad-studio",
  "ad_reel_composition_id": "${COMP_ID}",
  "ad_reel_props": $(cat /tmp/test-ad-studio-reel.json | node -e "const d=require('/dev/stdin');process.stdout.write(JSON.stringify(d.ad_reel_props))"),
  "scenes": [],
  "output": { "aspect_ratio": "9:16", "fps": 30, "width": 1080, "height": 1920 }
}
EOF
  echo "Rendering ${COMP_ID}..."
  node /Users/jeffdai/photoapp/fb-marketing/remotion/render-reel.mjs /tmp/test-${COMP_ID}.json && echo "OK: ${COMP_ID}" || echo "FAIL: ${COMP_ID}"
done
```

### Step 5 — Test the mapping function

```js
// test-mapping.mjs
import { creativePackageToAdReelProps } from "./fb-marketing/control-plane/lib/agents/creative/creative-package-to-ad-reel-props.js";

const testPackage = {
  package_id: "test-pkg-001",
  package_role: "static_winner",
  copy: { headline: "Grandma's 1965 wedding photo restored.", badge: "Family Story", cta: "Restore Free" },
  content: { support: "Faces, fabric, and feeling — all back.", angle: "family-memory" },
  design_tokens: { primary: "#d26739", surface: "#42291f", badge_bg: "#d26739", badge_text: "#efe7db", cta_bg: "#d26739", cta_text: "#efe7db", gradient_from: "#261d1a", gradient_to: "#6e3c27", headline_text: "#d26739", support_text: "#efe7db" },
  assets: { logo_url: "https://example.com/logo.png", after_photo_url: "https://example.com/photo.jpg" },
  brand_context: { brandName: "Memorabil.ai" },
};

const props = creativePackageToAdReelProps(testPackage);
console.log(JSON.stringify(props, null, 2));
// Verify all required fields are present and non-empty
console.assert(props.copy.headline, "headline missing");
console.assert(props.copy.cta, "cta missing");
console.assert(props.assets.afterPhotoUrl, "afterPhotoUrl missing");
console.assert(props.brandContext.brandName, "brandName missing");
console.log("All assertions passed.");
```

Run: `node test-mapping.mjs`

---

## 11. Implementation Checklist

Work through these steps in order. Mark each complete before moving to the next.

### Phase 1 — File setup

- [ ] Create destination directories:
  ```
  photoapp/fb-marketing/remotion/src/ad-studio/
  photoapp/fb-marketing/remotion/src/ad-studio/components/
  photoapp/fb-marketing/remotion/src/ad-studio/templates/
  ```
- [ ] Copy `schema.ts` and `helpers.ts` from Ad Studio into `ad-studio/`
- [ ] Copy all 7 component `.tsx` files into `ad-studio/components/`
- [ ] Copy all 10 template `.tsx` files into `ad-studio/templates/`
- [ ] Run `npm install zod` in `fb-marketing/remotion/`
- [ ] Verify the bundle compiles: `npx remotion studio` shows no errors

### Phase 2 — Remotion registration

- [ ] Edit `fb-marketing/remotion/src/Root.jsx` to add the 10 Ad Studio compositions inside a `<Folder name="Ad-Reels">` block (see Section 4)
- [ ] Verify Remotion Studio shows all 10 compositions in the Ad-Reels folder
- [ ] Preview each composition in the Remotion Studio using the DEFAULT_PROPS to confirm animations play

### Phase 3 — Render pipeline

- [ ] Add `hydrateAdReelPropsForRemotion` function to `render-reel.mjs`
- [ ] Update the `selectComposition` block in `render-reel.mjs` to route on `template_source === "ad-studio"` (see Section 5)
- [ ] Write the test spec JSON and run `render-reel.mjs` manually to confirm an MP4 is produced
- [ ] Check that `manifest.json` is written with the correct `template_source` and `ad_reel_composition_id` fields

### Phase 4 — Validator exemption

- [ ] Check if `validateReelSpec` rejects `scenes: []`
- [ ] If it does, add the `template_source === "ad-studio"` early-return exemption

### Phase 5 — Reel agent

- [ ] Create `creative-package-to-ad-reel-props.js` with the `creativePackageToAdReelProps` function
- [ ] Add `AD_STUDIO_TEMPLATE_MAP`, `isAdStudioTemplateId`, `buildAdStudioReelSpec` to `reel-agent.js`
- [ ] Export `scaffoldAdStudioReelSpec` and `listAdStudioTemplates` from `reel-agent.js`
- [ ] Test the mapping function with a real `static_winner` package from the local package store
- [ ] Call `scaffoldAdStudioReelSpec` manually and confirm the spec file is written to `generated-reel-specs/`

### Phase 6 — API

- [ ] Locate the existing reel render route handler (search for `scaffoldReelSpecFromPackage` in the routes directory)
- [ ] Add the `AD_STUDIO_IDS` set and routing branch (see Section 7)
- [ ] Add the `GET /api/surface/ad-studio-templates` endpoint
- [ ] Restart the control plane server and test via curl or the dashboard UI

### Phase 7 — End-to-end verification

- [ ] From the dashboard, select a `static_winner` package
- [ ] Initiate a reel render with `templateId: "polaroid-drop"`
- [ ] Confirm the job runs, MP4 is produced, and the manifest appears in the reels catalog
- [ ] Repeat for at least 3 other templates
- [ ] Run all 10 templates via the batch test script in Section 10
- [ ] Confirm rendered videos play correctly with correct brand colors, copy, and photo assets

### Phase 8 — Cleanup and audit

- [ ] Remove any temporary test spec files from `/tmp/`
- [ ] Confirm bundle cache is invalidated after source changes (first render after changes shows a cache miss)
- [ ] Review the `audit_events` table for `reels.ad_studio_spec_scaffolded` log entries
- [ ] Update `STARTER_REEL_TEMPLATES` or equivalent preset registry in the photoapp if the UI needs to display the new template IDs in a dropdown

---

## Key file paths at a glance

```
SOURCE (read-only reference)
/Users/jeffdai/ClaudeSkills/remotion-ad-studio/remotion/src/

DESTINATION — new files you create
/Users/jeffdai/photoapp/fb-marketing/remotion/src/ad-studio/
/Users/jeffdai/photoapp/fb-marketing/control-plane/lib/agents/creative/creative-package-to-ad-reel-props.js

DESTINATION — existing files you modify
/Users/jeffdai/photoapp/fb-marketing/remotion/src/Root.jsx
/Users/jeffdai/photoapp/fb-marketing/remotion/render-reel.mjs
/Users/jeffdai/photoapp/fb-marketing/control-plane/lib/agents/reel-agent.js
/Users/jeffdai/photoapp/fb-marketing/remotion/src/lib/reel-layout-validator.js  (if needed)
```
