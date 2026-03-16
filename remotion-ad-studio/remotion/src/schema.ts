import { z } from "zod";

export const AdReelSchema = z.object({
  copy: z.object({
    headline: z.string(),
    support: z.string(),
    cta: z.string(),
    highlight: z.string(),
    badge: z.string(),
    angle: z.string().optional(),
  }),
  designTokens: z.object({
    primary: z.string(),
    secondary: z.string().optional(),
    ink: z.string().optional(),
    light: z.string().optional(),
    headline_text: z.string(),
    support_text: z.string(),
    surface: z.string(),
    chrome: z.string().optional(),
    media_fill: z.string().optional(),
    badge_bg: z.string(),
    badge_text: z.string(),
    cta_bg: z.string(),
    cta_text: z.string(),
    cta_border: z.string().nullable().optional(),
    gradient_from: z.string(),
    gradient_to: z.string(),
  }),
  assets: z.object({
    logoUrl: z.string(),
    beforePhotoUrl: z.string().optional(),
    afterPhotoUrl: z.string(),
  }),
  brandContext: z.object({
    brandName: z.string(),
  }),
});

export type AdReelProps = z.infer<typeof AdReelSchema>;

export const DEFAULT_PROPS: AdReelProps = {
  copy: {
    headline: "My mom's wedding day. Clear enough to share again.",
    support: "Restore the faces, the fabric, and the feeling in one tap.",
    cta: "Restore This Photo",
    highlight: "share again",
    badge: "Family Story",
    angle: "family-memory",
  },
  designTokens: {
    primary: "#d26739",
    secondary: "#d26739",
    ink: "#261d1a",
    light: "#d26739",
    headline_text: "#d26739",
    support_text: "#d26739",
    surface: "#42291f",
    chrome: "#42291f",
    media_fill: "#4f2f21",
    badge_bg: "#d26739",
    badge_text: "#efe7db",
    cta_bg: "#d26739",
    cta_text: "#efe7db",
    gradient_from: "#261d1a",
    gradient_to: "#6e3c27",
  },
  assets: {
    logoUrl: "https://pub-c7a5cb270590471c86fa625084a338d2.r2.dev/control-plane/creative-inputs/brand-logos/Screenshot_2026-03-12_at_3_10_35_PM-1773582223562.png",
    beforePhotoUrl: "",
    afterPhotoUrl: "https://pub-c7a5cb270590471c86fa625084a338d2.r2.dev/control-plane/creative-inputs/brand-images/Gemini_Generated_Image_re7mc5re7mc5re7m-1773584518003.png",
  },
  brandContext: {
    brandName: "Memorabil.ai",
  },
};
