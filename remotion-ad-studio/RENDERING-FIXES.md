# Remotion Rendering Fixes — Instructions for Photoapp Agent

**Context**: The Remotion Ad Studio templates have been audited for rendering consistency. These fixes must be applied to ensure MP4 exports match the Studio preview and work reliably in production.

---

## Critical Fix: Template5Glitch Uses Bare `<img>`

**File**: `remotion/src/ad-studio/templates/Template5Glitch.tsx` (or wherever you copied it)

**Problem**: The photo strip elements use native HTML `<img>` tags instead of Remotion's `<Img>` component. This causes:
- Blank/missing frames during MP4 export
- Images not loaded before frame capture
- Preview looks fine but export has holes

**Fix**: Find all `<img src={...}` in Template5Glitch and replace with:
```tsx
import { Img } from "remotion";

// Replace every:
<img src={assets.afterPhotoUrl} style={{...}} />

// With:
<Img src={assets.afterPhotoUrl} style={{...}} />
```

There are approximately 12 photo strip elements that each render the photo with a vertical offset. All must use `<Img>`.

---

## Cloud Rendering Performance

If rendering on Lambda/cloud (no GPU), these CSS properties are 10-50x slower:

| Property | Templates Using It | Impact |
|---|---|---|
| `filter: blur()` | Face Returns (14), Memory Returns (11), Filmstrip (9) | HIGH |
| `box-shadow` (large) | Polaroid (1), Triple (19), most templates | MEDIUM |
| `text-shadow` (glow) | Glitch (5), Kinetic (3), emotional templates | MEDIUM |
| Complex gradients | All templates | LOW-MEDIUM |

**For local rendering**: No action needed. GPU handles these fine.

**For cloud rendering**: Two options:
1. Accept 2-5 minute render times per reel (vs 10-30s locally)
2. Replace GPU-heavy effects with precomputed PNG images where possible

### Precomputed Image Approach (if needed)

For blur effects, instead of:
```tsx
<div style={{ filter: `blur(${blurPx}px)` }}>
  <Img src={photoUrl} />
</div>
```

Pre-render blurred versions of photos and swap between them:
```tsx
// Use sharp or canvas to generate blurred.jpg at build time
<Img src={frame < 60 ? blurredPhotoUrl : photoUrl} />
```

This is only worth doing if cloud render times are unacceptable.

---

## ClipPath Testing Checklist

These templates use `clipPath` which may have subtle antialiasing differences between preview and MP4 export:

- [ ] Template 2 (Slider Reveal) — `inset()` for before/after wipe
- [ ] Template 4 (Magazine Cover) — `inset()` for center-outward reveal
- [ ] Template 6 (Peel Away) — `inset()` for headline wipe
- [ ] Template 12 (Legacy Unlocked) — `circle()` for radial reveal
- [ ] Template 18 (Face to Face) — `inset()` for horizontal sliver

**Test**: Render each as MP4, compare frame-by-frame with Studio preview at the clipPath transition point. Look for:
- 1px edge artifacts
- Slight position shifts at clip boundaries
- Different antialiasing on curved clips (Template 12 circle)

**Fix if issues found**: Add 1px padding to clipped elements or adjust clipPath by 0.5%.

---

## Remotion Best Practices Checklist

Verify all templates follow these rules:

### Must Follow (rendering breaks if violated)
- [ ] All animations driven by `useCurrentFrame()` — NO CSS transitions/animations
- [ ] All images use Remotion `<Img>` component — NO bare `<img>` tags
- [ ] No `requestAnimationFrame`, `setTimeout`, `setInterval`
- [ ] No `Math.random()` — use `seededRandom()` from helpers or Remotion's `random()`
- [ ] No `Date.now()` or time-based calculations
- [ ] Use `transform: scale()` — NOT standalone `scale:` CSS property
- [ ] No `background-image` CSS for photos — use `<Img>` inside `<AbsoluteFill>`
- [ ] No `position: fixed` — use `position: absolute`

### Should Follow (quality/consistency)
- [ ] `extrapolateLeft: "clamp"` and `extrapolateRight: "clamp"` on all `interpolate()` calls
- [ ] `premountFor={fps}` on any `<Sequence>` components
- [ ] Fonts loaded via `@remotion/google-fonts` with specific weights (not all weights)
- [ ] Source videos re-encoded to constant frame rate (CFR) before import
- [ ] `calculateMetadata()` used for data fetching instead of `delayRender()` where possible

### Performance (for cloud/Lambda)
- [ ] Minimize `filter: blur()` usage — precompute if render time matters
- [ ] Minimize large `box-shadow` and `text-shadow` — use precomputed images
- [ ] Keep `--concurrency` tuned via `npx remotion benchmark`
- [ ] Use H.264 codec (not VP8/VP9 WebM — extremely slow to encode)
- [ ] Use `--jpeg-quality=80` for non-transparent renders

---

## Template Status Matrix

| # | Template | `<Img>` OK | clipPath | GPU Effects | Status |
|---|---|---|---|---|---|
| 1 | Polaroid Drop | ✓ | No | box-shadow | OK |
| 2 | Slider Reveal | ✓ | Yes — test | minimal | Test clipPath |
| 3 | Kinetic Type | ✓ | No | text-shadow glow | OK |
| 4 | Magazine Cover | ✓ | Yes — test | blur, box-shadow | Test clipPath |
| 5 | The Glitch | **✗ FIX** | No | blend modes | **Fix `<img>` tags** |
| 6 | Peel Away | ✓ | Yes — test | box-shadow | Test clipPath |
| 8 | The Orbit | ✓ | No | box-shadow, glow | OK |
| 9 | Filmstrip | ✓ | No | blur (logo focus) | OK |
| 11 | Memory Returns | ✓ | No | blur (photo deblur) | OK |
| 12 | Legacy Unlocked | ✓ | Yes — test | box-shadow glow | Test clipPath |
| 13 | Through Generations | ✓ | No | box-shadow | OK |
| 14 | Face Returns | ✓ | Yes — test | blur (30px deblur) | Test clipPath |
| 15 | Dust of Time | ✓ | No | minimal | OK |
| 16 | Warmth Returns | ✓ | No | grayscale filter | OK |
| 17 | Opening Album | ✓ | No | box-shadow | OK |
| 18 | Face to Face | ✓ | Yes — test | blur (deblur) | Test clipPath |
| 19 | Triple Restore | ✓ | No | box-shadow, glow | OK |

---

## Implementation Order

1. **Fix Template5Glitch `<img>` → `<Img>`** (5 minutes, critical)
2. **Render test all 17 templates** as MP4 locally — verify no blank frames
3. **Spot-check clipPath templates** (2, 4, 6, 12, 18) — compare preview vs export
4. **If deploying to cloud**: benchmark render times, decide if GPU effects need precomputing
