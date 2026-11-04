# Brand Guidelines

**MomsNest — Brand Guidelines**  
**Version:** 1.0  
**Date:** March 4, 2026  

---

## 1. Brand Overview

### Brand Name
- **Full Name:** MomsNest
- **Capitalization:** Always written as **MomsNest** (capital M, capital N, no space)
- **Never:** Momsnest, MOMSNEST, moms nest, Mom's Nest, Moms-Nest

### Tagline
> *"Connect, Share, Support"*

### Brand Personality
| Trait | Description |
|-------|-------------|
| **Warm** | Friendly, approachable, maternal |
| **Supportive** | Encouraging, empowering, non-judgmental |
| **Trustworthy** | Reliable, safe, verified |
| **Modern** | Clean, minimal, contemporary design |
| **Inclusive** | Welcoming to all mothers, cultures, and backgrounds |

### Brand Voice
| Context | Tone |
|---------|------|
| **Social/Community** | Warm, conversational, encouraging — like talking to a supportive friend |
| **Safety/SOS** | Calm, clear, reassuring — like a trusted advisor |
| **Marketplace** | Friendly, trustworthy, professional — like a helpful shop assistant |
| **Expert/Q&A** | Informative, compassionate, evidence-based — like a kind doctor |
| **Legal/Policy** | Clear, respectful, transparent — firm but fair |

---

## 2. Color Palette

### Primary Colors
| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| **MomsNest Purple** | `#4B164C` | rgb(75, 22, 76) | Primary brand color, headers, CTAs, app icon |
| **Deep Purple** | `#3A0E3B` | rgb(58, 14, 59) | Dark accents, hover states |
| **Light Purple** | `#7B3A7C` | rgb(123, 58, 124) | Secondary elements, badges |
| **Lavender** | `#E8D5E8` | rgb(232, 213, 232) | Soft backgrounds, cards |

### Neutral Colors
| Name | Hex | Usage |
|------|-----|-------|
| **White** | `#FFFFFF` | Primary background |
| **Off-White** | `#F9FAFB` | Secondary background, cards |
| **Light Gray** | `#F3F4F6` | Dividers, input backgrounds |
| **Medium Gray** | `#9CA3AF` | Placeholder text, icons |
| **Dark Gray** | `#6B7280` | Secondary text, captions |
| **Charcoal** | `#374151` | Body text |
| **Near Black** | `#1A1A2E` | Headlines, primary text |

### Semantic Colors
| Name | Hex | Usage |
|------|-----|-------|
| **Success Green** | `#10B981` | Confirmations, online status, verified badges |
| **Warning Amber** | `#F59E0B` | Warnings, pending status |
| **Danger Red** | `#EF4444` | Errors, SOS alerts, delete actions |
| **Info Blue** | `#3B82F6` | Information, links, selected states |
| **Coin Gold** | `#F59E0B` | Coin/wallet indicators |

### Gradient
| Name | Definition | Usage |
|------|-----------|-------|
| **Brand Gradient** | `linear-gradient(135deg, #4B164C 0%, #7B3A7C 100%)` | Hero sections, onboarding screens |
| **Warm Accent** | `linear-gradient(135deg, #4B164C 0%, #EF4444 100%)` | SOS/Safety UI elements |

---

## 3. Typography

### Font Family
| Weight | Font | Fallback |
|--------|------|----------|
| **Primary** | Inter | `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif` |

### Type Scale
| Element | Size | Weight | Line Height | Letter Spacing |
|---------|------|--------|-------------|----------------|
| **H1 (Page Title)** | 24px / 1.5rem | 700 (Bold) | 1.2 | -0.02em |
| **H2 (Section)** | 20px / 1.25rem | 600 (Semi-Bold) | 1.3 | -0.01em |
| **H3 (Subsection)** | 18px / 1.125rem | 600 (Semi-Bold) | 1.3 | -0.01em |
| **H4 (Label)** | 16px / 1rem | 500 (Medium) | 1.4 | 0 |
| **Body Large** | 16px / 1rem | 400 (Regular) | 1.5 | 0 |
| **Body** | 14px / 0.875rem | 400 (Regular) | 1.5 | 0 |
| **Caption** | 12px / 0.75rem | 400 (Regular) | 1.4 | 0.01em |
| **Tiny** | 10px / 0.625rem | 400 (Regular) | 1.3 | 0.02em |
| **Button** | 14px / 0.875rem | 500 (Medium) | 1 | 0.01em |

---

## 4. Iconography

### Icon Library
- **Primary:** Lucide React (v0.462.0)
- **Style:** Outlined, 24px default, 1.5px stroke width
- **Consistency:** All icons from Lucide — do not mix icon libraries

### Icon Usage
| Context | Icon Size | Color |
|---------|-----------|-------|
| **Navigation (bottom bar)** | 24px | Gray (inactive), Purple (active) |
| **Action buttons** | 20px | Matches text color |
| **Feature icons** | 24–32px | Brand purple or semantic color |
| **Inline text** | 16px | Matches text color |
| **Empty states** | 48–64px | Light gray |

---

## 5. Spacing & Layout

### Spacing Scale
Based on 4px base unit:

| Token | Value | Usage |
|-------|-------|-------|
| `space-1` | 4px | Tight spacing between related elements |
| `space-2` | 8px | Default gap between elements |
| `space-3` | 12px | Between form elements |
| `space-4` | 16px | Card padding, section margins |
| `space-5` | 20px | Between sections |
| `space-6` | 24px | Page padding (horizontal) |
| `space-8` | 32px | Between major sections |
| `space-10` | 40px | Between page sections |
| `space-16` | 64px | Hero section spacing |

### Border Radius
| Element | Radius |
|---------|--------|
| **Buttons** | 8px (`rounded-lg`) |
| **Cards** | 12px (`rounded-xl`) |
| **Modals/Sheets** | 16px top (`rounded-t-2xl`) |
| **Avatars** | 50% (`rounded-full`) |
| **Inputs** | 8px (`rounded-lg`) |
| **Images (posts)** | 12px (`rounded-xl`) |
| **Badges** | 9999px (`rounded-full`) |

---

## 6. Components

### Buttons
| Variant | Background | Text | Border | Usage |
|---------|-----------|------|--------|-------|
| **Primary** | `#4B164C` | White | None | Main CTAs |
| **Secondary** | Transparent | `#4B164C` | 1px `#4B164C` | Alternative actions |
| **Destructive** | `#EF4444` | White | None | Delete, remove actions |
| **Ghost** | Transparent | `#6B7280` | None | Subtle actions |
| **Link** | Transparent | `#3B82F6` | None | Text links |

### Cards
- Background: White (`#FFFFFF`)
- Shadow: `0 1px 3px rgba(0,0,0,0.1)`
- Border: `1px solid #F3F4F6`
- Padding: 16px
- Border radius: 12px

### Avatars
| Size | Dimensions | Usage |
|------|-----------|-------|
| **Small** | 32×32px | Comments, lists |
| **Medium** | 40×40px | Post headers, messages |
| **Large** | 64×64px | Profile previews |
| **XL** | 96–128px | Profile page header |

---

## 7. Logo Usage

### Placement Rules
- Minimum clear space: Equal to the height of the "M" in MomsNest on all sides
- Minimum size: 24px height for digital, 10mm for print
- Always use on high-contrast backgrounds

### Do's ✅
- Use the official logo files provided
- Maintain aspect ratio when scaling
- Use the logo on white, light, or brand purple backgrounds
- Ensure sufficient contrast between logo and background

### Don'ts ❌
- Do not stretch or distort the logo
- Do not change the logo colors
- Do not add effects (shadows, glows, outlines)
- Do not place on busy or low-contrast backgrounds
- Do not rotate the logo
- Do not recreate or modify the logo

---

## 8. Photography & Imagery

### Style Guidelines
| Aspect | Guideline |
|--------|-----------|
| **Subject** | Real mothers and families — diverse ages, ethnicities, abilities |
| **Mood** | Warm, authentic, joyful, supportive |
| **Lighting** | Natural, warm lighting preferred |
| **Composition** | Clean, uncluttered backgrounds |
| **Diversity** | Represent all mothers — different races, family structures, abilities |

### Avoid
- Stock photo clichés (overly posed, unrealistic perfection)
- Images that exclude or stereotype certain groups
- Overly filtered or artificial-looking photos
- Images depicting unsafe practices (car seats misused, etc.)

---

## 9. Emoji Usage

MomsNest uses emoji to add warmth and personality:

| Context | Emoji | Usage |
|---------|-------|-------|
| **Brand** | 💜 | Primary brand emoji (purple heart) |
| **Safety** | 🛡️ | SOS/safety features |
| **Community** | 🤝 | Circles, connections |
| **Trust** | ✅ | Verified, completed |
| **Marketplace** | 🛍️ | Shopping features |
| **Support** | 🫶 | Emotional support, encouragement |
| **Alert** | ⚠️ | Warnings, important notices |
| **Expert** | 👩‍⚕️ | Expert/professional features |

---

## 10. Contact

For brand usage inquiries:
- **Email:** brand@momsnest.com
- **Subject:** "Brand Usage Request"
