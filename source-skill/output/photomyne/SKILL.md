---
name: Photomyne Competitive Intel
description: >
  Competitive intelligence on Photomyne — photo scanning/digitization platform.
  Tracks pricing, features, apps, positioning for competitor analysis.
---

# Photomyne — Competitive Intelligence

Source: https://photomyne.com/
Last updated: 2026-03-14

## Company Overview

Photomyne is a photo digitization platform that converts physical photos, slides,
negatives, and artwork into digital albums. Positioned as the consumer-friendly
scanning suite with AI enhancement features.

**Press coverage:** NYT, WSJ, TechCrunch, The Today Show

## Pricing

| Plan | Price | Notes |
|------|-------|-------|
| Monthly | $14.99/mo | Auto-renews |
| Annual | $59.99/yr | ~$5/mo, 67% savings vs monthly |
| Free trial | 3 days | Full access to Scanning Suite |

- No family plan, no enterprise tier
- Frequent 30-40% discount promotions
- Scanning Suite bundle: Photo Scan + SlideScan + FilmBox + Colorize
- Delivery via SMS download links, account tied to phone number

## App Portfolio

| App | Category | Purpose | Platforms |
|-----|----------|---------|-----------|
| Photo Scan | Scanning (core) | Digitize printed photos, auto-crop, multi-scan | iOS, Android |
| SlideScan | Scanning | Digitize photographic slides | iOS, Android |
| FilmBox | Scanning | Scan film negatives with backlight correction | iOS, Android |
| Colorize | Enhancement | AI-powered B&W to color conversion | iOS, Android |
| Sharpen | Enhancement | AI photo clarity and detail enhancement | iOS, Android |
| Photo Family Tree | Organization | Genealogy-linked photo organization | iOS, Android |
| FridgeArt | Niche | Children's artwork display and sharing | iOS, Android |

**Bundle:** Scanning Suite = Photo Scan + SlideScan + FilmBox + Colorize (all included in subscription)

## Feature Matrix

### Scanning
- Auto-detection and cropping (multiple photos per scan)
- Auto-rotation and perspective correction
- Color restoration for faded photos
- Voice control scanning (iOS only)
- Support: photos, slides, negatives, children's artwork

### AI & Enhancement
- B&W colorization (Colorize app)
- Photo sharpening (Sharpen app)
- Color filters
- Backlight source correction (FilmBox)

### Organization
- Album arrangement and curation
- Text and audio annotations
- People tagging and naming
- Location and date tagging
- Family tree integration

### Sharing & Access
- Web-based viewing and editing
- QR code sharing
- Collage creation
- Public photo discovery feed
- Cross-device access via web portal

### Accessories
- Scanning accessory bundle via Amazon (phone holders, light pads, cotton gloves)

## Positioning & Messaging

**Tagline focus:** "Scan dozens of photos into digital albums in minutes"

**Key value props:**
1. Speed — batch scanning, not one-at-a-time
2. Quality — AI-powered enhancement and restoration
3. Family legacy — genealogy angle, multi-generational appeal
4. Simplicity — consumer-friendly, no technical knowledge required

**Target audience:**
- Family historians and genealogy enthusiasts
- Baby boomers with large print photo collections
- Multi-generational families preserving legacy
- Not targeting professional archivists or businesses

## SWOT Analysis

### Strengths
- **App ecosystem** — 7 specialized apps covering full scanning workflow
- **AI features** — colorization and sharpening are differentiation
- **Press credibility** — major publication coverage builds trust
- **Bundle pricing** — $5/mo for 4 apps is competitive
- **Multi-format** — photos + slides + negatives in one subscription

### Weaknesses
- **No free tier** — 3-day trial only, competitors offer limited free scanning
- **Phone-number auth** — unusual, may deter privacy-conscious users
- **No API** — no developer/integration ecosystem
- **Fragmented apps** — 7 separate apps can confuse users vs. single unified app
- **No desktop app** — mobile-only scanning, limits quality ceiling

### Opportunities
- Enterprise/business tier for professional archivists
- Desktop scanning with flatbed scanner integration
- Video digitization (VHS, film reels)
- Social features beyond public photo feed

### Threats
- Google PhotoScan (free, good enough for casual users)
- Apple's built-in document scanner improving each iOS release
- AI upscaling tools commoditizing enhancement features
- Smartphone cameras getting good enough that scanning apps feel unnecessary

## Competitive Landscape

| Competitor | Price | Key Differentiator |
|------------|-------|-------------------|
| **Google PhotoScan** | Free | Google ecosystem integration, good enough quality |
| **Microsoft Lens** | Free | OCR focus, Office integration |
| **Remini** | $9.99/wk | AI enhancement focus, social/selfie market |
| **Pic Scanner Gold** | $7.99 one-time | No subscription, batch scanning |
| **iScanner** | $19.99/yr | Document + photo scanning combined |

## Usage

```bash
# Check for changes to Photomyne's site
node scripts/monitor.js --skill-dir ./output/photomyne

# Open the interactive dashboard
open ./output/photomyne/dashboard.html

# Refresh after changes detected
node scripts/refresh.js --skill-dir ./output/photomyne
```

## Monitoring Notes

Track these signals for competitive changes:
- Pricing page for plan/price changes
- Homepage for positioning/messaging shifts
- App store listings for new app launches or feature additions
- Blog/press section for strategic announcements
