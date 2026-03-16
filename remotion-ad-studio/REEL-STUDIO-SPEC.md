# Reel Studio — Product and Technical Implementation Spec

**Version:** 1.0
**Date:** 2026-03-16
**Status:** Ready for implementation
**Target codebase:** `/Users/jeffdai/photoapp/fb-marketing/`

---

## 1. Product Vision

Reel Studio is a visual ad-builder page inside the Memorabil.ai marketing control plane that lets any non-technical team member drag brand components onto an iPhone 9:16 mockup, pick from 18 curated animation templates, fine-tune timing on a mini-timeline, toggle cinematic effects, and export a Remotion-ready grammar JSON that renders directly to a production MP4 — all in under two minutes, without touching code. The "wow" moment is frame 0: opening the page auto-loads your brand kit and the current winning creative package, pre-populates the phone with positioned elements, and immediately plays a live animation preview inside the mockup — the user sees a finished-looking ad before they have done a single thing.

---

## 2. User Flow

The complete end-to-end flow from navigation to exported MP4.

**Step 1 — Navigate to Reel Studio**
User clicks "Reel Studio" in the left sidebar of the control plane. The URL is `/reel-studio` (or `/reel-studio?packageId=<id>` when launched from the design-variants page via the "Build Reel" button).

**Step 2 — Brand kit and creative package auto-load**
On page init, `reel-studio-page.js` reads `brandKitId` from the session (same pattern as `brand-kit-browser.js`) and calls `GET /api/reel-studio/context?packageId=<id>`. The response returns brand logo URL, primary/secondary colors, fonts, and the winning creative package's copy (headline, support, CTA, badge, highlight word), before/after photo URLs, and recommended template ID. All fields populate the grammar state immediately.

**Step 3 — Three-panel layout appears**
Left sidebar (280px) shows the component palette and template gallery. Center stage shows the iPhone 9:16 mockup with the pre-populated elements. Right sidebar (300px) shows the properties panel for the currently selected element.

**Step 4 — User picks a template from the template gallery**
At the bottom of the left sidebar, a scrollable row of 18 thumbnail cards (plus a "Blank" option) shows all available templates. Clicking any card applies that template's default grammar JSON to the current state, replacing element positions and entrance configs while preserving the live brand kit values (logo, colors, copy).

**Step 5 — Template pre-populates the iPhone with animated elements**
The grammar JSON for the selected template is loaded into `state.grammar`. Elements are rendered as absolutely-positioned draggable layers inside the phone mockup. The miniature animation preview immediately plays (or loops) in the phone frame using the iframe preview renderer.

**Step 6 — User drags elements to reposition**
Any element can be selected by clicking it (blue outline + resize handles appear). Drag to reposition using the same normalized 0-1 coordinate system and pointer event pattern as `design-variants-page.js`. Position snaps to center, original position, and sibling elements. Dragging updates `element.position` in `state.grammar` in real time. The preview re-renders on `requestAnimationFrame`.

**Step 7 — User adds or removes elements from the component palette**
Left sidebar palette shows all 9 component types. Clicking a component drags a new instance onto the phone at a default position. Selecting an element and pressing Delete (or clicking the trash icon in the properties panel) removes it from `state.grammar.elements`.

**Step 8 — User adjusts timing on the mini-timeline**
Below the phone mockup, a horizontal timeline panel shows one bar per element. Each bar's left edge is the `entrance.startFrame` and width is the entrance duration. Dragging a bar's left edge adjusts `startFrame`. The playhead scrubber can be dragged to preview any frame. Clicking the play button animates the playhead from frame 0 to `meta.totalFrames` in real time.

**Step 9 — User picks entrance animations per element**
When an element is selected, the right panel shows an "Entrance" dropdown with all 25+ entrance types grouped by category. Changing the dropdown updates `element.entrance.type` in `state.grammar` and triggers a preview re-render.

**Step 10 — User toggles effects**
At the bottom of the left sidebar, effect toggles (Film Grain, Vignette, Light Leak, etc.) add or remove entries from `state.grammar.overlays`. Each effect has an intensity slider. Changes propagate to the preview iframe in real time.

**Step 11 — Live preview plays in the phone mockup**
The center phone mockup contains an `<iframe>` pointed at `/reel-preview.html?grammar=<encoded>`. This page is a lightweight HTML renderer that runs requestAnimationFrame and applies the same entrance functions as `GrammarRenderer.tsx`, but rendered in plain DOM (CSS transforms/opacity). On grammar change, the iframe src is updated (or a `postMessage` is sent for incremental updates).

**Step 12 — User clicks "Render" and MP4 exports**
The "Render MP4" button calls `POST /api/reel-studio/render` with `{ grammar, packageId, brandKitId }`. The server writes the grammar JSON to disk, invokes `render-reel-grammar.mjs` (modeled on `render-reel.mjs`), and returns a `{ jobId }`. The UI polls `GET /api/reel-studio/render/:jobId` every 1.5 seconds, showing a progress bar. On completion the response includes the MP4 path and a download link appears. Output is saved to `creative-output/reels/<jobId>/`.

**Step 13 — User iterates and compares versions**
A "Versions" drawer (bottom-right) shows thumbnails of all previously rendered variants for the current package. The user can load any saved grammar to continue editing, or click "Compare" to show two phone mockups side by side.

---

## 3. UI Layout

The page is a full-viewport three-column layout with no scroll on the outer shell. All three columns have internal scroll where needed.

```
┌─────────────────────────────────────────────────────────────────┐
│ Topbar: "Reel Studio"  [package name]  [Render MP4]  [Versions] │
├──────────────┬──────────────────────────────┬───────────────────┤
│ LEFT 280px   │ CENTER (flex-grow)            │ RIGHT 300px       │
│              │                              │                   │
│ Component    │  iPhone mockup 9:16          │ Properties Panel  │
│ Palette      │  (scaled to fit height)      │                   │
│              │                              │ - Element label   │
│ ─────────    │  [play] [pause] [0:00/0:08]  │ - X / Y sliders   │
│              │                              │ - W / H sliders   │
│ Effect       │  ─────────────────────────── │ - Entrance type   │
│ Toggles      │  Timeline Editor (140px)     │ - Spring feel     │
│              │                              │ - Start frame     │
│ ─────────    │                              │ - Highlight style │
│              │                              │ - Effects (elem)  │
│ Template     │                              │ - Delete button   │
│ Gallery      │                              │                   │
│ (scrollable) │                              │ [JSON editor]     │
└──────────────┴──────────────────────────────┴───────────────────┘
```

### Left Sidebar (280px fixed)

Three stacked sections with dividers:

1. **Component Palette** (top, ~200px) — A grid of 3 columns with icon + label cards for each of the 9 draggable component types. Clicking a card instantiates a new element at the grammar default position. The grid is not scrollable; all 9 fit without scroll.

2. **Effect Toggles** (~220px) — A labeled section "Global Effects" with a vertical list of toggle rows. Each row has a checkbox/switch, effect name, and a compact range slider (0-100 intensity) that shows only when the toggle is on.

3. **Template Gallery** (flex-grow, scrollable) — A scrollable column of template thumbnail cards. Each card is 100% width, shows an animated GIF preview (96px tall), template name, and an emotional tag badge. The currently applied template has a purple highlight border.

### Center Stage

Outer div is `display: flex; flex-direction: column; align-items: center; height: 100%;`.

**Phone Mockup Container** (flex-grow): Contains the iPhone SVG shell and the draggable canvas inside it. The phone is scaled via CSS `transform: scale()` to fit the available height minus 140px for the timeline, while maintaining the 9:16 aspect ratio. The phone shell is a CSS-drawn iPhone frame (no image dependency required) with rounded corners, a camera notch, and a home indicator.

**Preview Controls** (40px): `[<<]` rewind, `[|>]` play/pause, `[>>]` advance, current frame counter `"08 / 240"`, total duration `"8.0s"`. Play button triggers the `requestAnimationFrame` animation loop.

**Timeline Editor** (140px): Described fully in Section 7.

### Right Sidebar (300px fixed)

Shows properties for the currently selected element. When nothing is selected, shows a placeholder "Select an element to edit its properties." The panel has a fixed header with the element name and a trash icon.

All controls use the same design tokens as the existing control-plane UI (dark theme, `rgba(167, 139, 250, 0.x)` purple accents, `rgba(255,255,255,0.x)` whites).

---

## 4. Component Palette

The nine draggable brand components available in the palette. Each maps to a React component in `remotion/src/components/` and has a default `size` in normalized coordinates.

| Palette Label  | Grammar `component` value | Default size (w x h) | Notes |
|----------------|---------------------------|----------------------|-------|
| Logo           | `AdLogo`                  | 0.30 x 0.06          | Uses `assets.logoUrl` from brand kit |
| Badge          | `AdBadge`                 | 0.42 x 0.04          | Text pill, brand primary color |
| Photo          | `AdPhoto`                 | 0.88 x 0.40          | Before/after from creative package |
| Headline       | `AdHeadline`              | 0.90 x 0.14          | Supports `highlightWord` |
| Support Text   | `AdSupport`               | 0.90 x 0.10          | Body copy |
| CTA Button     | `AdCta`                   | 0.72 x 0.065         | Pill button |
| Custom Text    | `AdCustomText`            | 0.70 x 0.06          | User-defined string |
| Divider Line   | `AdDivider`               | 0.80 x 0.005         | Horizontal rule |
| Shape          | `AdShape`                 | 0.30 x 0.30          | `shapeType`: rectangle / circle / pill |

Each component type has a default position that stacks sensibly:

```js
const COMPONENT_DEFAULTS = {
  AdLogo:       { position: { x: 0.35, y: 0.04 }, size: { width: 0.30, height: 0.06 } },
  AdBadge:      { position: { x: 0.29, y: 0.12 }, size: { width: 0.42, height: 0.04 } },
  AdPhoto:      { position: { x: 0.06, y: 0.18 }, size: { width: 0.88, height: 0.40 } },
  AdHeadline:   { position: { x: 0.05, y: 0.62 }, size: { width: 0.90, height: 0.14 } },
  AdSupport:    { position: { x: 0.05, y: 0.78 }, size: { width: 0.90, height: 0.10 } },
  AdCta:        { position: { x: 0.14, y: 0.90 }, size: { width: 0.72, height: 0.065 } },
  AdCustomText: { position: { x: 0.05, y: 0.50 }, size: { width: 0.70, height: 0.06 } },
  AdDivider:    { position: { x: 0.10, y: 0.58 }, size: { width: 0.80, height: 0.005 } },
  AdShape:      { position: { x: 0.35, y: 0.35 }, size: { width: 0.30, height: 0.30 } },
};
```

---

## 5. Animation Grammar

The grammar is the single source of truth for a reel variant. It is a pure-JSON object with no functions, no DOM refs, and no circular references. The grammar is what gets saved, loaded, and passed to `GrammarRenderer.tsx`.

### 5.1 Complete Grammar Schema

```json
{
  "meta": {
    "name": "My Reel Variant",
    "templateId": "polaroid-drop",
    "totalFrames": 240,
    "fps": 30,
    "width": 1080,
    "height": 1920,
    "createdAt": "2026-03-16T00:00:00Z",
    "packageId": "pkg_abc123"
  },
  "background": {
    "type": "gradient",
    "direction": "180deg",
    "from": "#261d1a",
    "to": "#6e3c27"
  },
  "elements": [
    {
      "id": "logo-1",
      "component": "AdLogo",
      "position": { "x": 0.35, "y": 0.04 },
      "size": { "width": 0.30, "height": 0.06 },
      "entrance": {
        "type": "spring-drop",
        "startFrame": 15,
        "durationFrames": 30,
        "spring": {
          "damping": 8,
          "stiffness": 120,
          "mass": 1.2
        }
      },
      "props": {
        "logoUrl": "{{assets.logoUrl}}",
        "brandName": "{{brandContext.brandName}}"
      },
      "highlightStyle": null,
      "effects": []
    },
    {
      "id": "headline-1",
      "component": "AdHeadline",
      "position": { "x": 0.05, "y": 0.62 },
      "size": { "width": 0.90, "height": 0.14 },
      "entrance": {
        "type": "typewriter",
        "startFrame": 80,
        "durationFrames": 60,
        "spring": null
      },
      "props": {
        "text": "{{copy.headline}}",
        "highlightWord": "{{copy.highlight}}",
        "color": "{{designTokens.headline_text}}"
      },
      "highlightStyle": "pill",
      "effects": []
    }
  ],
  "overlays": [
    {
      "id": "film-grain",
      "type": "film-grain",
      "intensity": 0.35,
      "enabled": true
    }
  ],
  "outro": {
    "type": "scale-down",
    "startFrame": 200,
    "durationFrames": 40
  }
}
```

### 5.2 Template Binding Tokens

`props` values can contain `{{token}}` references that are resolved at render time against the live brand context. Valid tokens:

| Token | Resolved from |
|-------|--------------|
| `{{copy.headline}}` | `creativePackage.content.headline` |
| `{{copy.support}}` | `creativePackage.content.support` |
| `{{copy.cta}}` | `creativePackage.content.cta` |
| `{{copy.badge}}` | `creativePackage.content.badge` |
| `{{copy.highlight}}` | `creativePackage.content.highlight` |
| `{{assets.logoUrl}}` | `brandKit.logoUrl` |
| `{{assets.afterPhotoUrl}}` | `creativePackage.assets.after_photo_url` |
| `{{assets.beforePhotoUrl}}` | `creativePackage.assets.before_photo_url` |
| `{{brandContext.brandName}}` | `brandKit.name` |
| `{{designTokens.primary}}` | `creativePackage.design_tokens.primary` |
| `{{designTokens.headline_text}}` | `creativePackage.design_tokens.headline_text` |
| `{{designTokens.cta_bg}}` | `creativePackage.design_tokens.cta_bg` |
| `{{designTokens.cta_text}}` | `creativePackage.design_tokens.cta_text` |
| `{{designTokens.gradient_from}}` | `creativePackage.design_tokens.gradient_from` |
| `{{designTokens.gradient_to}}` | `creativePackage.design_tokens.gradient_to` |
| `{{designTokens.badge_bg}}` | `creativePackage.design_tokens.badge_bg` |
| `{{designTokens.badge_text}}` | `creativePackage.design_tokens.badge_text` |

Token resolution happens in `GrammarRenderer.tsx`'s `resolveTokens(grammar, context)` function before any element is rendered.

### 5.3 Entrance Types (25+)

All entrance functions share the signature: `(frame: number, config: EntranceConfig) => EntranceStyle`
where `EntranceStyle = { opacity: number; transform: string; clipPath?: string }`.

**Spring group (physical, bouncy):**

| Type | Description | Key params |
|------|-------------|------------|
| `spring-drop` | Falls from above with spring bounce | `damping`, `stiffness`, `mass` |
| `spring-rise` | Rises from below with spring bounce | `damping`, `stiffness`, `mass` |
| `spring-left` | Enters from left with spring settle | `damping`, `stiffness`, `mass` |
| `spring-right` | Enters from right with spring settle | `damping`, `stiffness`, `mass` |
| `spring-scale` | Scales from 0 to 1 with spring overshoot | `damping`, `stiffness`, `mass` |
| `spring-pop` | Scales from 0 with aggressive overshoot | high `stiffness`, low `damping` |

**Fade group (smooth, editorial):**

| Type | Description | Key params |
|------|-------------|------------|
| `fade-in` | Pure opacity fade | `durationFrames` |
| `fade-up` | Opacity + subtle Y translate | `durationFrames`, `offsetY` |
| `fade-down` | Opacity + subtle Y translate downward | `durationFrames`, `offsetY` |
| `fade-scale` | Opacity + scale from 0.85 to 1.0 | `durationFrames` |
| `fade-blur` | Opacity + CSS blur 8px → 0 | `durationFrames` |

**Slide group (directional, fast):**

| Type | Description | Key params |
|------|-------------|------------|
| `slide-up` | Hard Y translate, no spring | `durationFrames`, `easing` |
| `slide-down` | Hard Y translate downward | `durationFrames`, `easing` |
| `slide-left` | Hard X translate from left | `durationFrames`, `easing` |
| `slide-right` | Hard X translate from right | `durationFrames`, `easing` |

**Reveal group (cinematic, dramatic):**

| Type | Description | Key params |
|------|-------------|------------|
| `clip-reveal-up` | `clipPath` wipe from bottom | `durationFrames` |
| `clip-reveal-down` | `clipPath` wipe from top | `durationFrames` |
| `clip-reveal-left` | `clipPath` wipe from left | `durationFrames` |
| `clip-reveal-right` | `clipPath` wipe from right | `durationFrames` |
| `iris-reveal` | `clipPath` circle wipe from center | `durationFrames` |

**Text-specific group:**

| Type | Description | Key params |
|------|-------------|------------|
| `typewriter` | Characters appear one at a time | `durationFrames`, `charsPerFrame` |
| `word-by-word` | Each word fades in sequentially | `durationFrames` |
| `kinetic-stagger` | Letters stagger in from below | `durationFrames`, `staggerMs` |

**Special group:**

| Type | Description | Key params |
|------|-------------|------------|
| `glitch-in` | RGB split + jitter on entrance | `durationFrames`, `intensity` |
| `film-develop` | Photo slot desaturated → color | `durationFrames` |
| `none` | Element visible from `startFrame` with no transition | — |

### 5.4 Effect (Overlay) Types (15+)

Global overlay effects applied as composited layers on top of all elements. Rendered as absolutely-positioned `<AbsoluteFill>` components in Remotion.

| Type | Description | Intensity range |
|------|-------------|-----------------|
| `film-grain` | Animated noise texture via SVG feTurbulence | 0–1 |
| `scan-lines` | Horizontal dark lines at 2px intervals | 0–1 |
| `vignette` | Radial gradient dark edges | 0–1 |
| `light-leak` | Animated amber/white streaks from corner | 0–1 |
| `paper-texture` | Subtle aged paper overlay image | 0–1 |
| `dust-particles` | Small animated specks drifting | 0–1 |
| `static-noise` | TV static flicker overlay | 0–1 |
| `warm-wash` | Semi-transparent warm amber fill | 0–1 |
| `color-grade-warm` | Sepia / warm tone via CSS filter | 0–1 |
| `color-grade-cool` | Cool blue tone via CSS filter | 0–1 |
| `halftone` | Dot pattern overlay | 0–1 |
| `lens-flare` | Animated bright spot crossing frame | 0–1 |
| `chromatic-aberration` | RGB channel offset on full frame | 0–1 |
| `flicker` | Subtle opacity oscillation throughout | 0–1 |
| `letterbox` | Black bars top/bottom for cinematic ratio | 0 / 1 (binary) |

### 5.5 Highlight Styles (5)

Applied to the `AdHeadline` component's `highlightWord`. The style controls how the matching word is visually emphasized.

| Value | Appearance |
|-------|-----------|
| `pill` | Rounded background badge in `badge_bg` color |
| `underline` | Colored underline in `primary` color |
| `italic` | Italic weight with accent font |
| `caps` | Uppercase + wide letter-spacing in `primary` color |
| `highlight-bg` | Semi-transparent colored background span |

### 5.6 Outro Types (5)

Applied as a wrapper transform on the entire composition for the last `durationFrames` frames.

| Type | Description |
|------|-------------|
| `scale-down` | Whole frame scales from 1.0 → 0.95 |
| `fade-out` | Whole frame opacity 1 → 0 |
| `slide-out-up` | Whole frame translates upward off screen |
| `slide-out-down` | Whole frame translates downward off screen |
| `none` | No outro transition |

### 5.7 Spring Feel Presets

Four named presets map to specific spring configs:

```js
const SPRING_PRESETS = {
  bouncy:  { damping: 6,  stiffness: 120, mass: 1.0 },
  snappy:  { damping: 14, stiffness: 200, mass: 0.8 },
  heavy:   { damping: 18, stiffness: 80,  mass: 2.0 },
  smooth:  { damping: 22, stiffness: 100, mass: 1.0 },
};
```

---

## 6. Drag Interaction

The drag system on the iPhone mockup follows the exact same pattern established in `design-variants-page.js`. The implementation maps directly.

### 6.1 Coordinate System

All positions are stored as normalized 0-to-1 values relative to the phone frame inner bounds. `x: 0, y: 0` is the top-left corner of the content area inside the phone (not including the bezel). `x: 1, y: 1` is the bottom-right.

Phone frame pixel dimensions are computed at render time:
```js
const PHONE_ASPECT = 9 / 16;
// phoneHeightPx = availableHeight - TIMELINE_HEIGHT_PX
// phoneWidthPx  = phoneHeightPx * PHONE_ASPECT
```

### 6.2 Drag State Shape

```js
const drag = {
  elementId: "logo-1",       // grammar element id
  startX: 0,                  // clientX at pointerdown
  startY: 0,                  // clientY at pointerdown
  originX: 0.35,              // element.position.x at drag start
  originY: 0.04,              // element.position.y at drag start
  elementWidth: 0.30,         // element.size.width
  elementHeight: 0.06,        // element.size.height
  phoneWidthPx: 360,          // computed phone frame pixel width
  phoneHeightPx: 640,         // computed phone frame pixel height
};
```

### 6.3 Drag Event Flow

```js
// On element pointerdown:
function beginDrag(event, elementId) {
  if (event.button !== 0) return;
  event.preventDefault();
  event.stopPropagation();
  const el = state.grammar.elements.find(e => e.id === elementId);
  const phoneRect = phoneFrameEl.getBoundingClientRect();
  state.drag = {
    elementId,
    startX: event.clientX,
    startY: event.clientY,
    originX: el.position.x,
    originY: el.position.y,
    elementWidth: el.size.width,
    elementHeight: el.size.height,
    phoneWidthPx: phoneRect.width,
    phoneHeightPx: phoneRect.height,
  };
  state.selectedElementId = elementId;
  document.body.classList.add("is-reel-dragging");
  window.addEventListener("pointermove", handleDragMove);
  window.addEventListener("pointerup", finishDrag);
  window.addEventListener("pointercancel", finishDrag);
  scheduleDragRender();
}

// On pointermove:
function handleDragMove(event) {
  if (!state.drag) return;
  const deltaX = (event.clientX - state.drag.startX) / state.drag.phoneWidthPx;
  const deltaY = (event.clientY - state.drag.startY) / state.drag.phoneHeightPx;
  applyElementPositionPatch(state.drag.elementId, {
    x: state.drag.originX + deltaX,
    y: state.drag.originY + deltaY,
  });
  scheduleDragRender(); // requestAnimationFrame debounced
}

// On pointerup:
function finishDrag() {
  if (!state.drag) return;
  state.drag = null;
  document.body.classList.remove("is-reel-dragging");
  window.removeEventListener("pointermove", handleDragMove);
  window.removeEventListener("pointerup", finishDrag);
  window.removeEventListener("pointercancel", finishDrag);
  renderAll();
  queueGrammarPersist(true); // immediate save
}
```

### 6.4 Snap Guides

Snap threshold is `0.01` (same as design-variants-page.js). Snap candidates for each element:

1. **Horizontal center**: `x = (1 - element.size.width) / 2`
2. **Original template position**: stored as `element._templateOrigin` (set when template is applied, read-only)
3. **Other elements**: horizontal center of every sibling element

Snapping adds a guide line overlay (`.rs-guide-line.is-vertical` or `.is-horizontal`) that fades out after 650ms via `setTimeout`.

### 6.5 Bounds Clamping

```js
function clampPosition(x, y, el) {
  const maxX = Math.max(1 - el.size.width, 0.45);
  const maxY = Math.max(1 - el.size.height, 0.45);
  return {
    x: clamp(x, -0.1, maxX),
    y: clamp(y, -0.1, maxY),
  };
}
```

Allows slight overflow (-0.1) for elements intentionally bleeding off the phone edge.

### 6.6 Selected Element Visual

When an element is selected:
- Blue `2px solid rgba(96, 165, 250, 0.9)` outline
- Four corner resize handles (8x8px squares, same blue color)
- Drag cursor on the element body
- Resize cursor on the handles

Resize handle drag updates `element.size.width` and `element.size.height` proportionally. Minimum size: `0.05 x 0.02`.

### 6.7 requestAnimationFrame Render Debounce

```js
let dragRafId = 0;
function scheduleDragRender() {
  if (dragRafId) return;
  dragRafId = window.requestAnimationFrame(() => {
    dragRafId = 0;
    renderPhoneMockup();       // re-renders phone canvas elements
    syncPropertiesPanel();     // updates X/Y slider values
    updatePreviewIframe();     // posts grammar update to preview iframe
  });
}
```

### 6.8 Grammar Persistence Debounce

After drag ends (or after any property change), grammar is persisted to the server with a 360ms debounce (matching the design-variants-page.js pattern):

```js
function queueGrammarPersist(immediate = false) {
  clearTimeout(state.saveTimer);
  const persist = () => requestJson("/api/reel-studio/save", {
    method: "POST",
    body: { grammar: state.grammar, packageId: state.packageId }
  });
  if (immediate) { persist(); return; }
  state.saveTimer = setTimeout(persist, 360);
}
```

---

## 7. Timeline Editor

The timeline is a 140px-tall panel directly below the phone mockup controls, spanning the full center column width.

### 7.1 Visual Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ TIMELINE                                          08 / 240  8.0s │
├────────────┬────────────────────────────────────────────────────┤
│  logo-1    │    ████████                                        │
│  badge-1   │         ████████                                   │
│  headline  │                   ██████████████                   │
│  support   │                          ██████████████            │
│  cta-1     │                                     ████████       │
│  film-grain│ ████████████████████████████████████████████████  │
├────────────┴────────────────────────────────────────────────────┤
│ [0]    [30]   [60]   [90]   [120]  [150]  [180]  [210]  [240]  │
│        |                                                         │
│        ^ playhead                                                │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Bar Data Model

Each bar maps to a grammar element or overlay. Bar geometry is computed from:
```js
const barLeft = (element.entrance.startFrame / totalFrames) * timelineWidthPx;
const barWidth = (element.entrance.durationFrames / totalFrames) * timelineWidthPx;
```

Overlays span the full timeline width (full duration).

### 7.3 Color Coding

| Component type | Bar color |
|---------------|-----------|
| `AdLogo` | `#a78bfa` (purple) |
| `AdBadge` | `#f59e0b` (amber) |
| `AdPhoto` | `#60a5fa` (blue) |
| `AdHeadline` | `#f472b6` (pink) |
| `AdSupport` | `#e2e8f0` (light gray) |
| `AdCta` | `#34d399` (green) |
| `AdCustomText` | `#e2e8f0` (light gray) |
| `AdDivider` | `#6b7280` (gray) |
| `AdShape` | `#fb923c` (orange) |
| Overlays | `rgba(255,255,255,0.25)` striped |

### 7.4 Bar Drag Interaction

Dragging a bar's **left edge** adjusts `entrance.startFrame`. Dragging the **bar body** moves the entire entrance window (updates `startFrame` while keeping `durationFrames` constant). Dragging the **right edge** adjusts `durationFrames`.

Constraints:
- `startFrame >= 0`
- `startFrame + durationFrames <= meta.totalFrames`
- Minimum `durationFrames` = 6 (0.2s at 30fps)

On bar drag end, `queueGrammarPersist(true)` fires.

### 7.5 Playhead

The playhead is an absolutely-positioned vertical red line. Dragging the playhead scrubs through frames. `state.previewFrame` is updated on drag, and `updatePreviewIframe({ frame: state.previewFrame })` is called on each `requestAnimationFrame` tick.

When the play button is running, `state.previewFrame` is incremented each `requestAnimationFrame` by `meta.fps / (1000 / 16.67)` (approximately 1 frame per ~33ms at 30fps) until it reaches `meta.totalFrames`, then it resets to 0 and loops.

### 7.6 Entrance Type Icon Dots

Each bar shows a small icon dot at the left edge indicating the entrance type category:

- Spring types: `◉`
- Fade types: `◌`
- Slide types: `→`
- Reveal/clip types: `◧`
- Text types: `T`
- Special types: `✦`

---

## 8. Template Gallery

### 8.1 Template Data Structure

Each template is a pre-made grammar JSON file, stored in `fb-marketing/control-plane/templates/reel-grammar/`. Templates do not contain literal copy or asset URLs — they use `{{token}}` references. When applied, the tokens are resolved against the current creative package.

Template metadata (used for the gallery card):

```js
{
  id: "polaroid-drop",
  label: "Polaroid Drop",
  description: "Objects fall and bounce like physical prints.",
  emotionalTag: "Nostalgic",
  category: "original",   // "original" | "emotional"
  previewGif: "/templates/previews/polaroid-drop.gif",
  totalFrames: 240,
  fps: 30,
  grammarPath: "polaroid-drop.json"
}
```

### 8.2 The 18 Templates

**Original templates (10):**

| ID | Label | Emotional tag |
|----|-------|--------------|
| `polaroid-drop` | Polaroid Drop | Nostalgic |
| `slider-reveal` | Slider Reveal | Discovery |
| `kinetic-type` | Kinetic Type | Energetic |
| `magazine-cover` | Magazine Cover | Premium |
| `glitch` | Glitch | Modern |
| `peel-away` | Peel Away | Transformative |
| `venetian-blinds` | Venetian Blinds | Dramatic |
| `orbit` | Orbit | Playful |
| `filmstrip` | Filmstrip | Cinematic |
| `mosaic` | Mosaic | Dynamic |

**Emotional templates (8):**

| ID | Label | Emotional tag |
|----|-------|--------------|
| `memory-returns` | Memory Returns | Tender |
| `legacy-unlocked` | Legacy Unlocked | Reverent |
| `through-generations` | Through Generations | Family |
| `face-returns` | Face Returns | Intimate |
| `dust-of-time` | Dust of Time | Poetic |
| `warmth-returns` | Warmth Returns | Comforting |
| `opening-album` | Opening Album | Curious |
| `face-to-face` | Face to Face | Emotional |

Plus a "Blank" option that initializes an empty grammar with only the background.

### 8.3 Applying a Template

```js
function applyTemplate(templateId) {
  const grammar = loadGrammarFromFile(templateId); // fetched from /api/reel-studio/templates/:id
  // Store template origin on each element for snap-guide "original position" feature
  grammar.elements.forEach(el => {
    el._templateOrigin = { x: el.position.x, y: el.position.y };
  });
  state.grammar = grammar;
  state.selectedElementId = null;
  state.activeTemplateId = templateId;
  renderAll();
  updatePreviewIframe();
}
```

### 8.4 Custom Template Saving

When the user clicks "Save as Template", the current `state.grammar` (with `_templateOrigin` stripped) is posted to `POST /api/reel-studio/save` with `{ type: "custom-template", label: "My Template" }`. Custom templates appear at the top of the gallery with a "Custom" badge.

---

## 9. Properties Panel

The right sidebar properties panel shows when an element is selected (`state.selectedElementId` is set). All controls sync bidirectionally with the element's grammar data.

### 9.1 Panel Sections

**Element header row:**
```
[icon] Headline         [trash icon]
```

**Position (X/Y):**
Two range sliders, -20 to 120 (representing -0.20 to 1.20 in normalized coords), labeled "X" and "Y". Value shown as percentage to the right of each slider. Sliders update on `input` event with `requestAnimationFrame` debounce. Values are clamped inside `applyElementPositionPatch`.

**Size (W/H):**
Two range sliders, 5 to 100 (normalized 0.05 to 1.0). Labeled "W" and "H". Aspect-ratio lock toggle.

**Entrance:**
A `<select>` dropdown grouping all 25+ entrance types under `<optgroup>` headers:
- `<optgroup label="Spring">` — spring-drop, spring-rise, spring-left, spring-right, spring-scale, spring-pop
- `<optgroup label="Fade">` — fade-in, fade-up, fade-down, fade-scale, fade-blur
- `<optgroup label="Slide">` — slide-up, slide-down, slide-left, slide-right
- `<optgroup label="Reveal">` — clip-reveal-up, clip-reveal-down, clip-reveal-left, clip-reveal-right, iris-reveal
- `<optgroup label="Text">` — typewriter, word-by-word, kinetic-stagger (shown only when component is a text type)
- `<optgroup label="Special">` — glitch-in, film-develop, none

**Spring Feel** (shows only when entrance type is in the Spring group):
Four preset buttons: `[Bouncy]` `[Snappy]` `[Heavy]` `[Smooth]`. Below the presets, a "Show advanced" toggle reveals three individual sliders for `damping` (1–30), `stiffness` (30–300), and `mass` (0.3–3.0).

**Start Frame:**
Range slider 0 to `meta.totalFrames - 6`. Value shown as both a frame number and a time string `"2.5s"`. Bidirectionally synced with the timeline bar's left edge.

**Highlight Style** (shows only when component is `AdHeadline`):
Five option buttons in a segmented control: `[Pill]` `[Underline]` `[Italic]` `[Caps]` `[Highlight-bg]`. Updates `element.highlightStyle`.

**Element Effects:**
Three toggle rows for element-level effects: Glow, Shadow, RGB Split. Each has an intensity slider.

**Delete:**
A `[Delete Element]` button at the bottom, styled destructively (red text). Removes the element from `state.grammar.elements`, clears `state.selectedElementId`, and calls `queueGrammarPersist(true)`.

**JSON Editor Toggle:**
A `[< > JSON]` link at the very bottom. Clicking replaces the panel content with a `<textarea>` showing the full grammar JSON. Changes are parsed on blur and applied to `state.grammar` if valid JSON.

---

## 10. Effect Panel

Located in the left sidebar between the Component Palette and Template Gallery, the Effect Panel controls global overlay effects.

### 10.1 Toggle Row Structure

Each effect row:
```html
<div class="rs-effect-row">
  <label class="rs-effect-toggle">
    <input type="checkbox" data-effect-type="film-grain" />
    <span class="rs-toggle-track"></span>
  </label>
  <span class="rs-effect-label">Film Grain</span>
  <input type="range" class="rs-effect-intensity" min="0" max="100" value="35"
    data-effect-type="film-grain" style="display: none;" />
</div>
```

When the toggle is checked, the intensity slider reveals. Intensity `0–100` maps to `0.0–1.0` in the grammar overlay config.

### 10.2 Effect State in Grammar

Adding an effect appends to `state.grammar.overlays`:
```js
{ id: "film-grain", type: "film-grain", intensity: 0.35, enabled: true }
```

Removing unchecks the toggle and sets `enabled: false` (preserving the intensity setting for re-enabling).

### 10.3 Live Preview Update

Every toggle or intensity change calls `updatePreviewIframe()` with a 100ms debounce. The preview iframe receives the updated grammar via `postMessage`.

---

## 11. Render Pipeline

### 11.1 Overview

```
Reel Studio UI
  → grammar JSON (resolved tokens)
  → POST /api/reel-studio/render
  → server writes grammar to disk: creative-output/reels/<jobId>/grammar.json
  → spawns: node render-reel-grammar.mjs <grammar.json>
  → render-reel-grammar.mjs:
      1. reads grammar.json
      2. calls ensureBundle() (cached, same logic as render-reel.mjs)
      3. selectComposition("GrammarReel", { grammar })
      4. renderMedia() → <jobId>.mp4
      5. renderStill() → <jobId>-poster.png
      6. writes manifest.json + summary.md
  → MP4 saved to: creative-output/reels/<jobId>/<jobId>.mp4
  → GET /api/reel-studio/render/:jobId returns status + mp4_url on completion
```

### 11.2 render-reel-grammar.mjs

Modeled directly on `render-reel.mjs`. Key differences:

1. Reads a grammar JSON (not a reel spec JSON).
2. Resolves `{{token}}` references against a `context.json` file (written alongside by the route handler, containing the resolved brand kit and creative package fields).
3. Targets the `GrammarReel` composition (not `ReelFromSpec`).
4. Bundle cache key includes the grammar source files in `remotion/src/grammar/`.

```js
// render-reel-grammar.mjs (key section)
const grammarRaw = JSON.parse(fs.readFileSync(grammarPath, "utf8"));
const context = JSON.parse(fs.readFileSync(contextPath, "utf8"));
const grammar = resolveGrammarTokens(grammarRaw, context);

const inputProps = { grammar };
const composition = await selectComposition({
  serveUrl: bundleInfo.serveUrl,
  id: "GrammarReel",
  inputProps,
  puppeteerInstance: browser,
  logLevel: "error"
});
```

### 11.3 Remotion Root Registration

`remotion/src/Root.jsx` is extended to register the `GrammarReel` composition:

```jsx
// Root.jsx (addition)
import { GrammarReel, calculateGrammarMetadata, defaultGrammar } from "./grammar/GrammarRenderer";

export const Root = () => (
  <>
    <Composition
      id="ReelFromSpec"
      component={ReelFromSpec}
      // ... existing
    />
    <Composition
      id="GrammarReel"
      component={GrammarReel}
      durationInFrames={240}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{ grammar: defaultGrammar }}
      calculateMetadata={calculateGrammarMetadata}
    />
  </>
);
```

### 11.4 Render Job Lifecycle

```
POST /api/reel-studio/render
  ← { jobId: "grammar-reel-abc123", status: "queued" }

GET /api/reel-studio/render/grammar-reel-abc123
  ← { jobId, status: "rendering", progressPct: 42 }

GET /api/reel-studio/render/grammar-reel-abc123
  ← { jobId, status: "complete", mp4Url: "/creative-output/reels/.../file.mp4", posterUrl: "..." }
```

Status values: `"queued"` | `"rendering"` | `"complete"` | `"error"`.

The render route uses the same `childProcess.spawn` + stdout parsing pattern as the existing reel agent. Job state is stored in a simple in-memory Map (same process) with filesystem fallback via `manifest.json`.

---

## 12. GrammarRenderer.tsx

The universal Remotion component that interprets any grammar JSON and renders it to video.

### 12.1 File Location

`remotion/src/grammar/GrammarRenderer.tsx`

### 12.2 Component Signature

```tsx
export const GrammarReel: React.FC<{ grammar: ReelGrammar }> = ({ grammar }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  // ...
};

export const calculateGrammarMetadata: CalculateMetadataFunction<{ grammar: ReelGrammar }> = ({ props }) => ({
  durationInFrames: props.grammar.meta.totalFrames,
  fps: props.grammar.meta.fps,
  width: props.grammar.meta.width ?? 1080,
  height: props.grammar.meta.height ?? 1920,
  props,
});

export const defaultGrammar: ReelGrammar = { /* minimal valid grammar */ };
```

### 12.3 Rendering Logic

```tsx
// Inside GrammarReel:
const outro = computeOutroTransform(frame, grammar.outro, grammar.meta.totalFrames);

return (
  <AbsoluteFill>
    {/* Background */}
    <AdBackground
      gradientFrom={grammar.background.from}
      gradientTo={grammar.background.to}
      angle={grammar.background.direction}
    />

    {/* Outro wrapper */}
    <AbsoluteFill style={{ transform: outro.transform, opacity: outro.opacity }}>

      {/* Elements */}
      {grammar.elements.map(el => (
        <GrammarElement
          key={el.id}
          element={el}
          frame={frame}
          fps={fps}
          canvasWidth={width}
          canvasHeight={height}
        />
      ))}

    </AbsoluteFill>

    {/* Overlay effects (above everything) */}
    {grammar.overlays
      .filter(o => o.enabled)
      .map(overlay => (
        <EffectLayer key={overlay.id} overlay={overlay} frame={frame} fps={fps} />
      ))
    }
  </AbsoluteFill>
);
```

### 12.4 GrammarElement Sub-Component

```tsx
const GrammarElement: React.FC<{
  element: GrammarElementDef;
  frame: number;
  fps: number;
  canvasWidth: number;
  canvasHeight: number;
}> = ({ element, frame, fps, canvasWidth, canvasHeight }) => {
  const entrance = computeEntrance(frame, element.entrance, fps);
  // entrance = { opacity, transform, clipPath }

  const left   = element.position.x * canvasWidth;
  const top    = element.position.y * canvasHeight;
  const width  = element.size.width * canvasWidth;
  const height = element.size.height * canvasHeight;

  const elementStyle: React.CSSProperties = {
    position: "absolute",
    left,
    top,
    width,
    height,
    opacity: entrance.opacity,
    transform: entrance.transform,
    clipPath: entrance.clipPath,
    overflow: "visible",
  };

  const Component = COMPONENT_MAP[element.component];
  if (!Component) return null;

  return (
    <div style={elementStyle}>
      <Component {...element.props} highlightStyle={element.highlightStyle} />
    </div>
  );
};
```

### 12.5 Component Map

```tsx
// remotion/src/grammar/GrammarRenderer.tsx
import { AdLogo }       from "../components/AdLogo";
import { AdBadge }      from "../components/AdBadge";
import { AdPhoto }      from "../components/AdPhoto";
import { AdHeadline }   from "../components/AdHeadline";
import { AdSupport }    from "../components/AdSupport";
import { AdCta }        from "../components/AdCta";
import { AdCustomText } from "../components/AdCustomText";   // new
import { AdDivider }    from "../components/AdDivider";      // new
import { AdShape }      from "../components/AdShape";        // new

const COMPONENT_MAP: Record<string, React.ComponentType<any>> = {
  AdLogo,
  AdBadge,
  AdPhoto,
  AdHeadline,
  AdSupport,
  AdCta,
  AdCustomText,
  AdDivider,
  AdShape,
};
```

`AdCustomText`, `AdDivider`, and `AdShape` are new components that must be created in `remotion/src/components/`. They are simple: `AdCustomText` renders a styled `<div>` with user-provided text; `AdDivider` renders a horizontal `<hr>`-style div; `AdShape` renders a styled div with `borderRadius` determined by `shapeType`.

### 12.6 Entrance Function Library

Location: `remotion/src/grammar/entrance-library.ts`

Every entrance function takes `(frame, config, fps)` and returns `{ opacity, transform, clipPath }`.

```ts
// entrance-library.ts

import { interpolate, spring } from "remotion";
import type { EntranceConfig, EntranceStyle } from "./types";

export function computeEntrance(
  frame: number,
  config: EntranceConfig,
  fps: number
): EntranceStyle {
  if (frame < config.startFrame) {
    return { opacity: 0, transform: "none" };
  }
  const localFrame = frame - config.startFrame;
  const fn = ENTRANCE_FNS[config.type] ?? ENTRANCE_FNS["fade-in"];
  return fn(localFrame, config, fps);
}

const ENTRANCE_FNS: Record<string, EntranceFn> = {
  "spring-drop": (f, cfg, fps) => {
    const s = spring({ frame: f, fps, config: cfg.spring ?? SPRING_PRESETS.bouncy });
    return {
      opacity: interpolate(f, [0, 8], [0, 1], { extrapolateRight: "clamp" }),
      transform: `translateY(${interpolate(s, [0, 1], [-120, 0])}px)`,
    };
  },
  "spring-rise": (f, cfg, fps) => {
    const s = spring({ frame: f, fps, config: cfg.spring ?? SPRING_PRESETS.bouncy });
    return {
      opacity: interpolate(f, [0, 8], [0, 1], { extrapolateRight: "clamp" }),
      transform: `translateY(${interpolate(s, [0, 1], [120, 0])}px)`,
    };
  },
  "spring-left": (f, cfg, fps) => {
    const s = spring({ frame: f, fps, config: cfg.spring ?? SPRING_PRESETS.snappy });
    return {
      opacity: interpolate(f, [0, 6], [0, 1], { extrapolateRight: "clamp" }),
      transform: `translateX(${interpolate(s, [0, 1], [-160, 0])}px)`,
    };
  },
  "spring-right": (f, cfg, fps) => {
    const s = spring({ frame: f, fps, config: cfg.spring ?? SPRING_PRESETS.snappy });
    return {
      opacity: interpolate(f, [0, 6], [0, 1], { extrapolateRight: "clamp" }),
      transform: `translateX(${interpolate(s, [0, 1], [160, 0])}px)`,
    };
  },
  "spring-scale": (f, cfg, fps) => {
    const s = spring({ frame: f, fps, config: cfg.spring ?? SPRING_PRESETS.bouncy });
    return {
      opacity: interpolate(f, [0, 8], [0, 1], { extrapolateRight: "clamp" }),
      transform: `scale(${interpolate(s, [0, 1], [0.4, 1])})`,
    };
  },
  "spring-pop": (f, cfg, fps) => {
    const s = spring({ frame: f, fps, config: { damping: 4, stiffness: 280, mass: 0.6 } });
    return {
      opacity: interpolate(f, [0, 4], [0, 1], { extrapolateRight: "clamp" }),
      transform: `scale(${interpolate(s, [0, 1], [0, 1])})`,
    };
  },
  "fade-in": (f, cfg) => ({
    opacity: interpolate(f, [0, cfg.durationFrames ?? 20], [0, 1], { extrapolateRight: "clamp" }),
    transform: "none",
  }),
  "fade-up": (f, cfg) => ({
    opacity: interpolate(f, [0, cfg.durationFrames ?? 20], [0, 1], { extrapolateRight: "clamp" }),
    transform: `translateY(${interpolate(f, [0, cfg.durationFrames ?? 20], [cfg.offsetY ?? 16, 0], { extrapolateRight: "clamp" })}px)`,
  }),
  "fade-down": (f, cfg) => ({
    opacity: interpolate(f, [0, cfg.durationFrames ?? 20], [0, 1], { extrapolateRight: "clamp" }),
    transform: `translateY(${interpolate(f, [0, cfg.durationFrames ?? 20], [-(cfg.offsetY ?? 16), 0], { extrapolateRight: "clamp" })}px)`,
  }),
  "fade-scale": (f, cfg) => ({
    opacity: interpolate(f, [0, cfg.durationFrames ?? 20], [0, 1], { extrapolateRight: "clamp" }),
    transform: `scale(${interpolate(f, [0, cfg.durationFrames ?? 20], [0.85, 1], { extrapolateRight: "clamp" })})`,
  }),
  "fade-blur": (f, cfg) => ({
    opacity: interpolate(f, [0, cfg.durationFrames ?? 24], [0, 1], { extrapolateRight: "clamp" }),
    transform: `blur(${interpolate(f, [0, cfg.durationFrames ?? 24], [8, 0], { extrapolateRight: "clamp" })}px)`,
  }),
  "slide-up": (f, cfg) => ({
    opacity: 1,
    transform: `translateY(${interpolate(f, [0, cfg.durationFrames ?? 16], [200, 0], { extrapolateRight: "clamp" })}px)`,
  }),
  "slide-down": (f, cfg) => ({
    opacity: 1,
    transform: `translateY(${interpolate(f, [0, cfg.durationFrames ?? 16], [-200, 0], { extrapolateRight: "clamp" })}px)`,
  }),
  "slide-left": (f, cfg) => ({
    opacity: 1,
    transform: `translateX(${interpolate(f, [0, cfg.durationFrames ?? 16], [300, 0], { extrapolateRight: "clamp" })}px)`,
  }),
  "slide-right": (f, cfg) => ({
    opacity: 1,
    transform: `translateX(${interpolate(f, [0, cfg.durationFrames ?? 16], [-300, 0], { extrapolateRight: "clamp" })}px)`,
  }),
  "clip-reveal-up": (f, cfg) => {
    const pct = interpolate(f, [0, cfg.durationFrames ?? 20], [100, 0], { extrapolateRight: "clamp" });
    return { opacity: 1, transform: "none", clipPath: `inset(0 0 ${pct}% 0)` };
  },
  "clip-reveal-down": (f, cfg) => {
    const pct = interpolate(f, [0, cfg.durationFrames ?? 20], [100, 0], { extrapolateRight: "clamp" });
    return { opacity: 1, transform: "none", clipPath: `inset(${pct}% 0 0 0)` };
  },
  "clip-reveal-left": (f, cfg) => {
    const pct = interpolate(f, [0, cfg.durationFrames ?? 20], [100, 0], { extrapolateRight: "clamp" });
    return { opacity: 1, transform: "none", clipPath: `inset(0 ${pct}% 0 0)` };
  },
  "clip-reveal-right": (f, cfg) => {
    const pct = interpolate(f, [0, cfg.durationFrames ?? 20], [100, 0], { extrapolateRight: "clamp" });
    return { opacity: 1, transform: "none", clipPath: `inset(0 0 0 ${pct}%)` };
  },
  "iris-reveal": (f, cfg) => {
    const pct = interpolate(f, [0, cfg.durationFrames ?? 24], [0, 150], { extrapolateRight: "clamp" });
    return { opacity: 1, transform: "none", clipPath: `circle(${pct}% at 50% 50%)` };
  },
  "typewriter": (f, cfg) => ({
    // opacity handled by the AdHeadline component itself using frame + startFrame
    opacity: 1,
    transform: "none",
    // _typewriterFrame is a signal: AdHeadline reads element.entrance.startFrame directly
  }),
  "word-by-word": (f, cfg) => ({ opacity: 1, transform: "none" }),
  "kinetic-stagger": (f, cfg) => ({ opacity: 1, transform: "none" }),
  "glitch-in": (f, cfg) => {
    const progress = interpolate(f, [0, cfg.durationFrames ?? 12], [0, 1], { extrapolateRight: "clamp" });
    const intensity = (cfg.intensity ?? 0.5) * (1 - progress);
    const jitter = intensity * 6 * Math.sin(f * 47.3);
    return {
      opacity: interpolate(f, [0, 4], [0, 1], { extrapolateRight: "clamp" }),
      transform: `translateX(${jitter}px)`,
    };
  },
  "film-develop": (f, cfg) => ({
    // Photo component handles its own desaturation; this is just the fade
    opacity: interpolate(f, [0, cfg.durationFrames ?? 30], [0, 1], { extrapolateRight: "clamp" }),
    transform: "none",
  }),
  "none": () => ({ opacity: 1, transform: "none" }),
};
```

Note: `typewriter`, `word-by-word`, and `kinetic-stagger` return `opacity: 1` from the entrance function because the character-level animation is handled inside the `AdHeadline` component itself. `AdHeadline` accepts `entranceConfig` as a prop and uses `useCurrentFrame()` to compute which characters are visible, using the same logic as `Template1Polaroid.tsx`.

### 12.7 Effect Layer Library

Location: `remotion/src/grammar/effect-library.tsx`

Each effect is a React component that renders a full-frame overlay.

```tsx
// effect-library.tsx

export const EffectLayer: React.FC<{ overlay: OverlayDef; frame: number; fps: number }> = ({
  overlay, frame, fps
}) => {
  const Component = EFFECT_MAP[overlay.type];
  if (!Component) return null;
  return <Component intensity={overlay.intensity} frame={frame} fps={fps} />;
};

const EFFECT_MAP: Record<string, React.ComponentType<EffectProps>> = {
  "film-grain": FilmGrainEffect,
  "scan-lines": ScanLinesEffect,
  "vignette": VignetteEffect,
  "light-leak": LightLeakEffect,
  "paper-texture": PaperTextureEffect,
  "dust-particles": DustParticlesEffect,
  "static-noise": StaticNoiseEffect,
  "warm-wash": WarmWashEffect,
  "color-grade-warm": ColorGradeWarmEffect,
  "color-grade-cool": ColorGradeCoolEffect,
  "halftone": HalftoneEffect,
  "lens-flare": LensFlareEffect,
  "chromatic-aberration": ChromaticAberrationEffect,
  "flicker": FlickerEffect,
  "letterbox": LetterboxEffect,
};
```

Implementation note for `FilmGrainEffect`: Use an SVG with `<feTurbulence>` and `<feColorMatrix>` filters, animating `baseFrequency` via `interpolate(frame, [0, 1], [0.65, 0.68])` to create motion. This is the same technique used in existing Remotion grain implementations (see `rules/light-leaks.md` for the pattern).

`VignetteEffect`: A radial gradient `rgba(0,0,0,0)` to `rgba(0,0,0,<intensity>)`, absolute fill, pointer-events none.

`LightLeakEffect`: Animated `<div>` with a gradient from transparent to warm amber, translated and rotated over time using `interpolate(frame, ...)`.

### 12.8 Outro Computation

```ts
// In GrammarRenderer.tsx
function computeOutroTransform(frame: number, outro: OutroDef, totalFrames: number) {
  if (!outro || outro.type === "none") return { transform: "none", opacity: 1 };
  const localFrame = Math.max(0, frame - outro.startFrame);
  const progress = interpolate(localFrame, [0, outro.durationFrames], [0, 1], { extrapolateRight: "clamp" });

  switch (outro.type) {
    case "scale-down":
      return { transform: `scale(${interpolate(progress, [0, 1], [1, 0.95])})`, opacity: 1 };
    case "fade-out":
      return { transform: "none", opacity: interpolate(progress, [0, 1], [1, 0]) };
    case "slide-out-up":
      return { transform: `translateY(${interpolate(progress, [0, 1], [0, -200])}px)`, opacity: 1 };
    case "slide-out-down":
      return { transform: `translateY(${interpolate(progress, [0, 1], [0, 200])}px)`, opacity: 1 };
    default:
      return { transform: "none", opacity: 1 };
  }
}
```

### 12.9 TypeScript Type Definitions

Location: `remotion/src/grammar/types.ts`

```ts
export interface ReelGrammar {
  meta: GrammarMeta;
  background: BackgroundDef;
  elements: GrammarElementDef[];
  overlays: OverlayDef[];
  outro: OutroDef;
}

export interface GrammarMeta {
  name: string;
  templateId: string;
  totalFrames: number;
  fps: number;
  width?: number;
  height?: number;
  createdAt?: string;
  packageId?: string;
}

export interface BackgroundDef {
  type: "gradient" | "solid" | "image";
  direction?: string;
  from: string;
  to?: string;
  imageUrl?: string;
}

export interface GrammarElementDef {
  id: string;
  component: keyof typeof COMPONENT_MAP;
  position: { x: number; y: number };
  size: { width: number; height: number };
  entrance: EntranceConfig;
  props: Record<string, unknown>;
  highlightStyle?: HighlightStyle | null;
  effects?: ElementEffect[];
  _templateOrigin?: { x: number; y: number }; // UI-only, stripped before save
}

export interface EntranceConfig {
  type: EntranceType;
  startFrame: number;
  durationFrames: number;
  spring?: SpringConfig;
  offsetY?: number;
  charsPerFrame?: number;
  staggerMs?: number;
  intensity?: number;
}

export interface SpringConfig {
  damping: number;
  stiffness: number;
  mass: number;
}

export interface OverlayDef {
  id: string;
  type: EffectType;
  intensity: number;
  enabled: boolean;
}

export interface OutroDef {
  type: OutroType;
  startFrame: number;
  durationFrames: number;
}

export interface ElementEffect {
  type: "glow" | "shadow" | "rgb-split";
  intensity: number;
}

export type HighlightStyle = "pill" | "underline" | "italic" | "caps" | "highlight-bg";

export type EntranceType =
  | "spring-drop" | "spring-rise" | "spring-left" | "spring-right" | "spring-scale" | "spring-pop"
  | "fade-in" | "fade-up" | "fade-down" | "fade-scale" | "fade-blur"
  | "slide-up" | "slide-down" | "slide-left" | "slide-right"
  | "clip-reveal-up" | "clip-reveal-down" | "clip-reveal-left" | "clip-reveal-right" | "iris-reveal"
  | "typewriter" | "word-by-word" | "kinetic-stagger"
  | "glitch-in" | "film-develop" | "none";

export type EffectType =
  | "film-grain" | "scan-lines" | "vignette" | "light-leak" | "paper-texture"
  | "dust-particles" | "static-noise" | "warm-wash" | "color-grade-warm" | "color-grade-cool"
  | "halftone" | "lens-flare" | "chromatic-aberration" | "flicker" | "letterbox";

export type OutroType = "scale-down" | "fade-out" | "slide-out-up" | "slide-out-down" | "none";

export type EntranceFn = (frame: number, config: EntranceConfig, fps: number) => EntranceStyle;

export interface EntranceStyle {
  opacity: number;
  transform: string;
  clipPath?: string;
}

export type SpringPresetName = "bouncy" | "snappy" | "heavy" | "smooth";
```

---

## 13. Data Flow

```
Creative Package (copy, tokens, assets)
      +
Brand Kit (logo, colors, fonts)
      |
      v
GET /api/reel-studio/context
      |
      v
Reel Studio UI (reel-studio-page.js)
  - state.grammar (live, mutable)
  - state.selectedElementId
  - state.activeTemplateId
  - state.previewFrame
      |
      +──── drag/property change ────> applyElementPositionPatch()
      |                                       |
      |                                       v
      +──── grammar updated ─────────> updatePreviewIframe()  (postMessage to /reel-preview.html)
      |                                       |
      |                                       v
      |                                Preview DOM Renderer (reel-preview.html)
      |                                (vanilla JS, CSS transforms, rAF loop)
      |
      +──── "Render MP4" click ──────> POST /api/reel-studio/render
                                             |
                                             v
                                    write grammar.json + context.json to disk
                                             |
                                             v
                                    spawn: node render-reel-grammar.mjs grammar.json
                                             |
                                             v
                                    GrammarReel Remotion composition
                                             |
                                             v
                                    renderMedia() → MP4
                                             |
                                             v
                                    creative-output/reels/<jobId>/<jobId>.mp4
```

### 13.1 Context Object

The context object written to disk alongside the grammar before render:

```json
{
  "packageId": "pkg_abc123",
  "brandKitId": "bk_xyz",
  "copy": {
    "headline": "My mom's wedding day. Clear enough to share again.",
    "support": "Restore the faces, the fabric, and the feeling in one tap.",
    "cta": "Restore This Photo",
    "badge": "Family Story",
    "highlight": "share again"
  },
  "designTokens": {
    "primary": "#d26739",
    "headline_text": "#d26739",
    "gradient_from": "#261d1a",
    "gradient_to": "#6e3c27",
    "badge_bg": "#d26739",
    "badge_text": "#efe7db",
    "cta_bg": "#d26739",
    "cta_text": "#efe7db"
  },
  "assets": {
    "logoUrl": "https://...",
    "afterPhotoUrl": "https://...",
    "beforePhotoUrl": "https://..."
  },
  "brandContext": {
    "brandName": "Memorabil.ai"
  }
}
```

---

## 14. API Endpoints

All endpoints live in `fb-marketing/control-plane/lib/http/routes/reel-studio-routes.js`. The file exports `handleReelStudioRoutes({ request, response, url, currentUser, helpers })` and is registered in the main route dispatcher (same pattern as all other route files).

### GET /api/reel-studio/context

Returns brand context and creative package data needed to initialize the studio.

Query params: `?packageId=<id>` (optional; loads the named package; defaults to the user's most recent winner)

Response:
```json
{
  "ok": true,
  "packageId": "pkg_abc123",
  "copy": { ... },
  "designTokens": { ... },
  "assets": { ... },
  "brandContext": { ... },
  "recommendedTemplateId": "polaroid-drop"
}
```

### GET /api/reel-studio/templates

Returns the list of all 18 built-in templates plus any custom templates saved by the user.

Response:
```json
{
  "ok": true,
  "templates": [
    {
      "id": "polaroid-drop",
      "label": "Polaroid Drop",
      "description": "Objects fall and bounce like physical prints.",
      "emotionalTag": "Nostalgic",
      "category": "original",
      "previewGif": "/templates/previews/polaroid-drop.gif",
      "totalFrames": 240,
      "fps": 30
    }
  ]
}
```

### GET /api/reel-studio/templates/:id

Returns the full grammar JSON for a specific template.

Response: `{ "ok": true, "grammar": { ... } }`

### POST /api/reel-studio/save

Saves a grammar as a named template or as the current draft for a package.

Request body:
```json
{
  "grammar": { ... },
  "packageId": "pkg_abc123",
  "type": "draft",           // "draft" | "custom-template"
  "label": "My Draft"
}
```

Response: `{ "ok": true, "savedId": "draft_xyz" }`

### POST /api/reel-studio/render

Queues a Remotion render job for the given grammar.

Request body:
```json
{
  "grammar": { ... },
  "packageId": "pkg_abc123",
  "brandKitId": "bk_xyz"
}
```

Response: `{ "ok": true, "jobId": "grammar-reel-abc123-1710000000000", "status": "queued" }`

Implementation: the route resolves token references from the DB (same as `requestCreativePackage`), writes `grammar.json` and `context.json` to `creative-output/reels/<jobId>/`, then spawns `node render-reel-grammar.mjs <grammar-path> <context-path>` as a child process. Job status is tracked in a module-level `renderJobs` Map.

### GET /api/reel-studio/render/:jobId

Polls render job status.

Response (in progress): `{ "ok": true, "jobId": "...", "status": "rendering", "progressPct": 42 }`

Response (complete): `{ "ok": true, "jobId": "...", "status": "complete", "mp4Url": "/dl/reels/...", "posterUrl": "/dl/reels/...", "durationMs": 8000 }`

Response (error): `{ "ok": false, "jobId": "...", "status": "error", "error": "..." }`

### POST /api/reel-studio/preview-frame (optional, Phase 4)

Server-side renders a single still frame of the grammar using `renderStill()`. Useful as a fallback when the iframe preview cannot load (e.g., missing asset URLs). Not required for Phase 1.

---

## 15. File Structure

All new files and their locations within the `fb-marketing/` directory.

```
fb-marketing/
├── control-plane/
│   ├── public/
│   │   ├── js/
│   │   │   └── reel-studio-page.js          ← main UI module (vanilla JS)
│   │   │       (imports: browser-utils.js, creative-package.js,
│   │   │                 reel-template-presets.js, brand-kit-browser.js)
│   │   ├── reel-studio.html                 ← HTML template
│   │   └── reel-preview.html                ← iframe DOM preview renderer
│   └── lib/
│       └── http/routes/
│           └── reel-studio-routes.js        ← API route handler
│
├── remotion/
│   └── src/
│       ├── components/
│       │   ├── AdLogo.tsx                   ← existing, unchanged
│       │   ├── AdBadge.tsx                  ← existing, unchanged
│       │   ├── AdPhoto.tsx                  ← existing, unchanged
│       │   ├── AdHeadline.tsx               ← existing, add entranceConfig prop
│       │   ├── AdSupport.tsx                ← existing, unchanged
│       │   ├── AdCta.tsx                    ← existing, unchanged
│       │   ├── AdCustomText.tsx             ← NEW
│       │   ├── AdDivider.tsx                ← NEW
│       │   └── AdShape.tsx                  ← NEW
│       ├── grammar/
│       │   ├── GrammarRenderer.tsx          ← NEW (universal grammar interpreter)
│       │   ├── entrance-library.ts          ← NEW (25+ entrance functions)
│       │   ├── effect-library.tsx           ← NEW (15+ overlay components)
│       │   └── types.ts                     ← NEW (TypeScript types)
│       ├── templates/
│       │   └── [Template1..7 existing]      ← unchanged
│       ├── Root.jsx                         ← add GrammarReel composition
│       ├── index.jsx                        ← unchanged
│       ├── helpers.ts                       ← unchanged
│       └── schema.ts                        ← unchanged (AdReelProps still used by existing templates)
│
├── remotion/
│   └── render-reel-grammar.mjs             ← NEW (modeled on render-reel.mjs)
│
└── control-plane/
    └── templates/
        └── reel-grammar/
            ├── polaroid-drop.json           ← NEW: template grammar JSONs (18 files)
            ├── slider-reveal.json
            ├── kinetic-type.json
            ├── magazine-cover.json
            ├── glitch.json
            ├── peel-away.json
            ├── venetian-blinds.json
            ├── orbit.json
            ├── filmstrip.json
            ├── mosaic.json
            ├── memory-returns.json
            ├── legacy-unlocked.json
            ├── through-generations.json
            ├── face-returns.json
            ├── dust-of-time.json
            ├── warmth-returns.json
            ├── opening-album.json
            └── face-to-face.json
```

### 15.1 reel-studio-page.js Module Structure

The file is a single vanilla ES module (no bundler, same as all other control-plane JS files). Internal organization:

```js
// ── Imports ─────────────────────────────────────────────────────────────────
import { escapeHtml, readSearchParam, requestJson } from "/js/browser-utils.js";
import { readBrief } from "/js/creative-brief.js";

// ── Constants ────────────────────────────────────────────────────────────────
const SNAP_THRESHOLD = 0.01;
const TIMELINE_HEIGHT_PX = 140;
const PHONE_ASPECT_RATIO = 9 / 16;
const GRAMMAR_PERSIST_DEBOUNCE_MS = 360;
const PREVIEW_UPDATE_DEBOUNCE_MS = 100;

// ── State ────────────────────────────────────────────────────────────────────
const state = {
  grammar: null,
  selectedElementId: null,
  activeTemplateId: null,
  previewFrame: 0,
  isPlaying: false,
  drag: null,
  timelineDrag: null,
  saveTimer: null,
  previewTimer: null,
  rafId: 0,
  dragRafId: 0,
  guides: { x: null, y: null },
  guideTimer: null,
  packageId: "",
  brandKitId: "",
  renderJobId: null,
  renderPollInterval: null,
};

// ── DOM helpers ──────────────────────────────────────────────────────────────
// ── Grammar token resolver ───────────────────────────────────────────────────
// ── Drag system ──────────────────────────────────────────────────────────────
// ── Timeline system ──────────────────────────────────────────────────────────
// ── Preview iframe bridge ────────────────────────────────────────────────────
// ── Properties panel ─────────────────────────────────────────────────────────
// ── Effect panel ─────────────────────────────────────────────────────────────
// ── Template gallery ─────────────────────────────────────────────────────────
// ── Component palette ────────────────────────────────────────────────────────
// ── Render pipeline ──────────────────────────────────────────────────────────
// ── Render functions ─────────────────────────────────────────────────────────
// ── Init ─────────────────────────────────────────────────────────────────────
```

### 15.2 reel-preview.html

A standalone HTML page served as a static file. Used as the `src` of the iPhone mockup `<iframe>`. It:

1. Receives grammar JSON via `window.addEventListener("message", ...)` on `postMessage`.
2. Runs a `requestAnimationFrame` loop that increments a local frame counter.
3. Applies entrance transforms to DOM elements using a pure-DOM version of `computeEntrance()` that mirrors the TypeScript entrance-library exactly.
4. Uses `will-change: transform, opacity` on all animated elements for GPU compositing.
5. Contains zero external dependencies (no React, no Remotion).

The grammar-to-DOM mapping mirrors the component map: each element's `component` value determines which HTML structure is rendered (e.g., `AdLogo` → `<img>`, `AdHeadline` → `<div class="rs-headline">`).

Token references in `props` are resolved on the client side against the context object also passed via `postMessage`.

---

## 16. Implementation Phases

### Phase 1 — MVP (estimated: 3–4 days)

Goal: Working page that lets you pick a template, see the phone mockup populated with elements, drag to reposition, and export an MP4.

Deliverables:
- `reel-studio.html` (three-panel layout, iPhone shell, controls)
- `reel-studio-page.js` (state, drag system, properties panel X/Y/size, template gallery, component palette add/remove)
- `reel-studio-routes.js` (GET context, GET templates/:id, POST render, GET render/:id)
- `GrammarRenderer.tsx` (element rendering, position/size only — no entrance animations yet, all elements simply visible)
- `entrance-library.ts` (stub: all types map to `fade-in` with 20 frame duration)
- `render-reel-grammar.mjs` (full render pipeline)
- `types.ts`
- Grammar JSON files for all 18 templates (positions and sizes only; entrance types filled in Phase 2)
- Wire `/reel-studio` route into the page registry and left sidebar nav

MVP does NOT include: live animation preview, timeline editor, effect toggles, spring config, compare versions.

### Phase 2 — Animation and Effects (estimated: 3–4 days)

Goal: All 25+ entrance types working in both the preview and in the rendered MP4. Effect toggles working.

Deliverables:
- `entrance-library.ts` (all 25+ entrance functions implemented)
- `effect-library.tsx` (all 15 effect components)
- Entrance dropdown in properties panel
- Spring feel presets in properties panel
- Effect toggles panel (left sidebar)
- Start frame slider (properties panel)
- `AdHeadline.tsx` updated with `entranceConfig` prop for typewriter/word-by-word support

### Phase 3 — Timeline and Custom Templates (estimated: 2–3 days)

Goal: Timeline editor fully functional. Custom template saving working.

Deliverables:
- Timeline editor (bars, playhead scrubber, bar drag for timing)
- Start frame slider bidirectionally synced with timeline bar
- POST /api/reel-studio/save with `type: "custom-template"`
- Custom templates appear in gallery
- JSON editor toggle in properties panel
- `AdCustomText.tsx`, `AdDivider.tsx`, `AdShape.tsx` new components

### Phase 4 — Live Preview and Compare (estimated: 2–3 days)

Goal: Smooth animated preview playing inside the iPhone mockup. Version comparison.

Deliverables:
- `reel-preview.html` (full DOM-based animation renderer, `postMessage` API)
- `postMessage` integration in `reel-studio-page.js`
- Play/pause/scrub controls wired to preview iframe
- Versions drawer (load previous grammar, side-by-side compare)
- POST /api/reel-studio/preview-frame (optional server fallback still)

---

## 17. Technical Constraints

**Vanilla JS for the control plane UI.** `reel-studio-page.js` must follow the same pattern as `design-variants-page.js`: no build step, no bundler, imported via ES module `<script type="module">`. No React, no Vite, no Tailwind. Use the same CSS custom properties and class conventions as the existing dark-theme UI.

**No inline event handlers.** All event listeners are attached via `addEventListener` in JS, never `onclick=` in HTML attributes.

**Remotion in the remotion/ folder only.** React and Remotion code lives entirely inside `fb-marketing/remotion/src/`. The control plane never imports from this folder.

**Grammar JSON must be serializable.** No functions, no Symbols, no DOM references, no `undefined` values. Use `null` for absent values. The grammar must survive `JSON.parse(JSON.stringify(grammar))` round-trips without data loss.

**Normalized 0-1 coordinates throughout.** No pixel values stored in the grammar. Pixel values are only computed at render time by multiplying by `meta.width` / `meta.height` in Remotion and by phone frame pixel dimensions in the UI.

**Render jobs are async.** The render endpoint returns a `jobId` immediately. The UI polls status. Never block the HTTP response thread on a render.

**Bundle cache.** `render-reel-grammar.mjs` uses the same `ensureBundle()` / `computeBundleCacheKey()` logic as `render-reel.mjs`. The bundle cache key must include all files in `remotion/src/grammar/` in addition to the existing source set. The grammar JSON itself does NOT affect the bundle key (it is passed as `inputProps`, not compiled).

**Template grammar files are not code.** They are JSON files loaded via the API, not imported as JS modules. This ensures templates can be edited by non-engineers.

**Preview iframe is sandboxed.** The iframe has `sandbox="allow-scripts allow-same-origin"` to prevent cross-frame issues. Communication is via `postMessage` only.

**Grammar size target.** Keep grammars under 5KB. The average built-in template grammar should be ~1.5–2KB. The 18 template grammars serve as the authoritative size budget check.

---

## 18. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Time to first MP4 (new reel from template) | Under 2 minutes | Stopwatch test: open page, pick template, click Render, download MP4 |
| Render time per MP4 (8s, 30fps, 9:16) | Under 30 seconds | `render_perf.total_ms` in `manifest.json` |
| Template variation coverage | 90%+ of variants achievable without code | Manual audit: can all 18 templates be meaningfully varied (different positions, entrances, effects) in the UI? |
| Grammar file size | Under 5KB per template | `wc -c` on all 18 grammar JSON files |
| Drag responsiveness | No visible lag at 60fps | Chrome DevTools Performance trace during drag — no frames over 16ms |
| Preview sync fidelity | Preview matches rendered MP4 within 1 frame | Side-by-side manual check at 5 random frames across 3 templates |
| Zero UI framework dependencies in control plane | 0 React/Vue/etc imports in reel-studio-page.js | `grep -i "from 'react'" reel-studio-page.js` returns nothing |
| Render pipeline reliability | Zero crashes on all 18 built-in templates | CI/smoke test: `render-reel-grammar.mjs` run against each template grammar JSON |

---

## 19. New Component Specifications

### AdCustomText.tsx

```tsx
export const AdCustomText: React.FC<{
  text: string;
  color?: string;
  fontSize?: number;
  fontWeight?: string | number;
  textAlign?: "left" | "center" | "right";
  style?: React.CSSProperties;
}> = ({ text, color = "#ffffff", fontSize = 28, fontWeight = 600, textAlign = "left", style = {} }) => (
  <div style={{
    color,
    fontSize,
    fontWeight,
    textAlign,
    lineHeight: 1.3,
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    ...style,
  }}>
    {text}
  </div>
);
```

### AdDivider.tsx

```tsx
export const AdDivider: React.FC<{
  color?: string;
  opacity?: number;
  style?: React.CSSProperties;
}> = ({ color = "rgba(255,255,255,0.3)", opacity = 1, style = {} }) => (
  <div style={{
    width: "100%",
    height: "100%",
    background: color,
    opacity,
    borderRadius: 1,
    ...style,
  }} />
);
```

### AdShape.tsx

```tsx
export const AdShape: React.FC<{
  shapeType?: "rectangle" | "circle" | "pill";
  fillColor?: string;
  opacity?: number;
  style?: React.CSSProperties;
}> = ({ shapeType = "rectangle", fillColor = "rgba(255,255,255,0.1)", opacity = 1, style = {} }) => {
  const borderRadius = shapeType === "circle" ? "50%" : shapeType === "pill" ? "999px" : "8px";
  return (
    <div style={{
      width: "100%",
      height: "100%",
      background: fillColor,
      borderRadius,
      opacity,
      ...style,
    }} />
  );
};
```

---

## 20. Grammar JSON Example — Polaroid Drop Template

This is the full grammar JSON for the `polaroid-drop` template. It serves as the implementation reference for how all 18 grammar files should be structured.

```json
{
  "meta": {
    "name": "Polaroid Drop",
    "templateId": "polaroid-drop",
    "totalFrames": 240,
    "fps": 30,
    "width": 1080,
    "height": 1920
  },
  "background": {
    "type": "gradient",
    "direction": "180deg",
    "from": "{{designTokens.gradient_from}}",
    "to": "{{designTokens.gradient_to}}"
  },
  "elements": [
    {
      "id": "logo-1",
      "component": "AdLogo",
      "position": { "x": 0.35, "y": 0.028 },
      "size": { "width": 0.30, "height": 0.056 },
      "entrance": {
        "type": "spring-drop",
        "startFrame": 15,
        "durationFrames": 30,
        "spring": { "damping": 8, "stiffness": 120, "mass": 1.2 }
      },
      "props": {
        "logoUrl": "{{assets.logoUrl}}",
        "brandName": "{{brandContext.brandName}}"
      },
      "highlightStyle": null,
      "effects": []
    },
    {
      "id": "photo-1",
      "component": "AdPhoto",
      "position": { "x": 0.10, "y": 0.10 },
      "size": { "width": 0.80, "height": 0.42 },
      "entrance": {
        "type": "spring-drop",
        "startFrame": 40,
        "durationFrames": 35,
        "spring": { "damping": 8, "stiffness": 100, "mass": 1.5 }
      },
      "props": {
        "photoUrl": "{{assets.afterPhotoUrl}}",
        "beforePhotoUrl": "{{assets.beforePhotoUrl}}",
        "mode": "polaroid"
      },
      "highlightStyle": null,
      "effects": []
    },
    {
      "id": "badge-1",
      "component": "AdBadge",
      "position": { "x": 0.05, "y": 0.555 },
      "size": { "width": 0.42, "height": 0.038 },
      "entrance": {
        "type": "spring-left",
        "startFrame": 60,
        "durationFrames": 25,
        "spring": { "damping": 10, "stiffness": 200, "mass": 0.8 }
      },
      "props": {
        "text": "{{copy.badge}}",
        "bgColor": "{{designTokens.badge_bg}}",
        "textColor": "{{designTokens.badge_text}}"
      },
      "highlightStyle": null,
      "effects": []
    },
    {
      "id": "headline-1",
      "component": "AdHeadline",
      "position": { "x": 0.05, "y": 0.60 },
      "size": { "width": 0.90, "height": 0.16 },
      "entrance": {
        "type": "typewriter",
        "startFrame": 80,
        "durationFrames": 60,
        "spring": null
      },
      "props": {
        "text": "{{copy.headline}}",
        "highlightWord": "{{copy.highlight}}",
        "color": "{{designTokens.headline_text}}"
      },
      "highlightStyle": "pill",
      "effects": []
    },
    {
      "id": "support-1",
      "component": "AdSupport",
      "position": { "x": 0.05, "y": 0.775 },
      "size": { "width": 0.90, "height": 0.085 },
      "entrance": {
        "type": "fade-up",
        "startFrame": 130,
        "durationFrames": 30,
        "spring": null,
        "offsetY": 8
      },
      "props": {
        "text": "{{copy.support}}",
        "color": "{{designTokens.support_text}}"
      },
      "highlightStyle": null,
      "effects": []
    },
    {
      "id": "cta-1",
      "component": "AdCta",
      "position": { "x": 0.14, "y": 0.89 },
      "size": { "width": 0.72, "height": 0.058 },
      "entrance": {
        "type": "spring-rise",
        "startFrame": 160,
        "durationFrames": 28,
        "spring": { "damping": 12, "stiffness": 150, "mass": 1.0 }
      },
      "props": {
        "text": "{{copy.cta}}",
        "bgColor": "{{designTokens.cta_bg}}",
        "textColor": "{{designTokens.cta_text}}"
      },
      "highlightStyle": null,
      "effects": []
    }
  ],
  "overlays": [
    {
      "id": "film-grain",
      "type": "film-grain",
      "intensity": 0.25,
      "enabled": true
    }
  ],
  "outro": {
    "type": "scale-down",
    "startFrame": 210,
    "durationFrames": 30
  }
}
```

---

## 21. Key Implementation Decisions

**Decision: iframe preview, not a re-implemented Remotion player**

The preview inside the phone mockup is a plain HTML page, not an embedded Remotion player or React component. This decision was made because:
1. The control plane uses vanilla JS with no build step — importing React/Remotion into the control plane would require significant infrastructure changes.
2. A DOM-based preview that mirrors the entrance functions is fast, lightweight, and sufficient for visual positioning/timing feedback.
3. The iframe can be loaded/reloaded without affecting the outer page state.

The trade-off is that maintaining parity between `reel-preview.html`'s JS entrance functions and `entrance-library.ts`'s TypeScript functions requires discipline. The test strategy (Section 18's "Preview sync fidelity" metric) catches drift.

**Decision: grammar JSON over function-per-template approach**

Rather than each template being a static React component (like `Template1Polaroid.tsx` etc.), the Reel Studio grammar system separates data from renderer. Templates are data (JSON), the renderer is code (`GrammarRenderer.tsx`). This enables:
- Templates editable without code changes
- Custom templates saved by users
- Grammar diff/compare between versions
- The UI reading and writing the same format the renderer consumes

The existing per-template React components (`Template1Polaroid.tsx` etc.) are not deleted — they continue to work for the existing render pipeline. The grammar system is additive.

**Decision: token references with `{{}}` syntax over pre-resolved values**

Grammar template files use `{{copy.headline}}` references rather than resolved literal values. This means the same grammar file produces different outputs for different creative packages. The trade-off is a resolution step at render time, but the benefit is that templates are package-agnostic and reusable.

**Decision: normalized 0-1 coordinates throughout**

Matching the design-variants-page.js coordinate system exactly. This means the UI drag code, the preview renderer, and the Remotion renderer all work in the same coordinate space. Coordinate conversion happens exactly twice: phone-frame-px → 0-1 at drag input, and 0-1 → canvas-px at render output. This eliminates a class of bugs where coordinates look right in one context but break in another.
