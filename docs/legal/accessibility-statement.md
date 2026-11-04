# Accessibility Statement

**MomsNest — Accessibility Statement**  
**Effective Date:** March 4, 2026  
**Last Updated:** March 4, 2026  

---

## 1. Our Commitment

MomsNest is committed to ensuring that our platform is accessible to all users, including people with disabilities. We strive to conform to the **Web Content Accessibility Guidelines (WCAG) 2.1** at the **Level AA** standard.

We believe every mother deserves equal access to community support, marketplace features, safety tools, and expert guidance — regardless of ability.

---

## 2. Current Accessibility Features

### 2.1 Visual Accessibility
| Feature | Implementation |
|---------|---------------|
| **Semantic HTML** | `<header>`, `<nav>`, `<main>`, `<footer>`, `<button>`, `<form>` used throughout |
| **Heading Hierarchy** | Proper `<h1>` through `<h6>` structure on all pages |
| **ARIA Labels** | Radix UI primitives provide automatic ARIA attributes for interactive components |
| **Color Contrast** | WCAG AA compliant (4.5:1 ratio for body text, 3:1 for large text) |
| **Focus Indicators** | Visible focus rings on all interactive elements via Tailwind CSS |
| **Alt Text** | Descriptive alt text for informational images |
| **Responsive Design** | Full functionality from 320px to 2560px viewport widths |
| **Text Scaling** | Supports browser text zoom up to 200% without loss of content |

### 2.2 Motor Accessibility
| Feature | Implementation |
|---------|---------------|
| **Keyboard Navigation** | Full keyboard support via Radix UI component library |
| **Touch Targets** | Minimum 44×44px for all interactive elements |
| **No Time Limits** | No timed interactions that cannot be extended (except stories, which are passive) |
| **Drag-Free UI** | All interactions achievable via tap/click (no drag-only operations) |
| **Reduced Motion** | `useReducedMotion` hook disables animations when user prefers reduced motion |

### 2.3 Cognitive Accessibility
| Feature | Implementation |
|---------|---------------|
| **Clear Navigation** | Consistent 5-tab bottom navigation across the app |
| **Consistent Layout** | Predictable page structure with fixed header and footer |
| **Error Messages** | Clear, descriptive error messages with suggested actions (Sonner toasts) |
| **Form Validation** | Real-time validation with Zod + React Hook Form |
| **Confirmation Dialogs** | Destructive actions require confirmation before execution |
| **Simple Language** | UI text written in plain, accessible language |

### 2.4 Hearing Accessibility
| Feature | Implementation |
|---------|---------------|
| **Text-Based Content** | Primary content is text-based (posts, comments, Q&A) |
| **No Audio-Only Content** | No features that require hearing to use |
| **Visual Notifications** | All notifications have visual indicators (badges, toasts, banners) |
| **Haptic Feedback** | Capacitor haptics provide tactile feedback on native devices |

---

## 3. Technology Stack Supporting Accessibility

| Technology | Accessibility Benefit |
|-----------|----------------------|
| **Radix UI** | Built-in ARIA attributes, keyboard navigation, focus management, screen reader support |
| **React** | Component-based architecture ensures consistent accessible patterns |
| **Tailwind CSS** | `focus:`, `focus-visible:` utilities for focus styles; `sr-only` for screen reader text |
| **Semantic HTML5** | Proper document structure and landmark roles |
| **React Router** | Route announcements for screen readers via `aria-live` regions |
| **Sonner (Toast)** | Accessible toast notifications with `aria-live` announcements |
| **React Hook Form + Zod** | Accessible form validation with error association |

---

## 4. WCAG 2.1 AA Conformance Status

### Perceivable
| Guideline | Status | Notes |
|-----------|--------|-------|
| 1.1 Text Alternatives | ✅ Conformant | Alt text on images; decorative images marked appropriately |
| 1.2 Time-Based Media | 🟡 Partial | Video captions not yet implemented for user videos |
| 1.3 Adaptable | ✅ Conformant | Semantic structure, logical reading order |
| 1.4 Distinguishable | ✅ Conformant | Color contrast AA, text resize, no color-only information |

### Operable
| Guideline | Status | Notes |
|-----------|--------|-------|
| 2.1 Keyboard Accessible | ✅ Conformant | All interactions keyboard-accessible |
| 2.2 Enough Time | ✅ Conformant | No timed interactions requiring user action |
| 2.3 Seizures | ✅ Conformant | No flashing content above 3 flashes/second |
| 2.4 Navigable | ✅ Conformant | Skip links, page titles, focus order, link purpose |
| 2.5 Input Modalities | ✅ Conformant | Touch, keyboard, mouse all supported |

### Understandable
| Guideline | Status | Notes |
|-----------|--------|-------|
| 3.1 Readable | ✅ Conformant | Language specified in HTML; clear, plain language |
| 3.2 Predictable | ✅ Conformant | Consistent navigation, no unexpected context changes |
| 3.3 Input Assistance | ✅ Conformant | Error identification, labels, validation messages |

### Robust
| Guideline | Status | Notes |
|-----------|--------|-------|
| 4.1 Compatible | ✅ Conformant | Valid HTML5, ARIA where needed, Radix UI compliance |

---

## 5. Known Limitations

| Limitation | Status | Timeline |
|-----------|--------|----------|
| **Video captions** | User-uploaded videos lack automatic captions | Phase 3 (Q3 2026) |
| **Screen reader testing** | Not yet tested with NVDA/JAWS/VoiceOver | Phase 2 (Q2 2026) |
| **Live stream captions** | No real-time captioning for live streams | Phase 3 (Q3 2026) |
| **Language support** | Currently English only | Phase 2 (Q2 2026) |
| **Right-to-left (RTL)** | Not yet supported | Future consideration |
| **Dark mode** | Infrastructure exists but not fully implemented | Phase 2 (Q2 2026) |
| **Map accessibility** | Mapbox maps have limited screen reader support | Investigating alternatives |

---

## 6. Testing & Validation

### 6.1 Current Testing
| Method | Frequency | Tool |
|--------|-----------|------|
| **Automated scanning** | Per deployment | Lighthouse accessibility audit |
| **Browser testing** | Per feature | Chrome DevTools accessibility inspector |
| **Keyboard testing** | Per component | Manual tab-through testing |
| **Color contrast** | Per design change | Contrast ratio tool |

### 6.2 Planned Testing
| Method | Planned Date |
|--------|-------------|
| Screen reader testing (VoiceOver, NVDA) | Q2 2026 |
| User testing with disabled users | Q3 2026 |
| Third-party accessibility audit | Q4 2026 |
| VPAT (Voluntary Product Accessibility Template) | Q4 2026 |

---

## 7. Feedback & Contact

We welcome feedback on the accessibility of MomsNest. If you encounter any accessibility barriers or have suggestions for improvement:

- **Email:** accessibility@momsnest.com
- **Subject:** "Accessibility Feedback — [Brief Description]"
- **Response time:** Within **5 business days**

When contacting us, please include:
- Description of the accessibility barrier
- Page or feature where the issue occurs
- Device, browser, and assistive technology used
- Suggestions for improvement (if any)

We take all accessibility feedback seriously and will work to address barriers as quickly as possible.

---

## 8. Continuous Improvement

Accessibility is an ongoing effort. We commit to:
- Regularly reviewing and updating our accessibility practices
- Training our development team on accessible coding standards
- Including accessibility requirements in all new feature specifications
- Testing with real assistive technologies and real users
- Updating this statement as we make improvements
