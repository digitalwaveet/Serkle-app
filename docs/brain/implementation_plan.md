# Implementation Plan - App Rebranding to "Serkle"

This plan outlines the steps to rebrand the app from **MomsNest** to **Serkle** and replace the current logo with the new SVG logo.

## Proposed Changes

### 1. Identify and Replace App Name
The app name "MomsNest" (and "MomNest") will be replaced with **"Serkle"** in the following locations:
- `index.html` (Title, Meta tags)
- `public/manifest.json` (PWA name and short name)
- `capacitor.config.json` (appName)
- `src/components/Header.tsx` (Alt text)
- `src/pages/Login.tsx` & `src/pages/Signup.tsx` (Alt text, Headings)
- `src/index.css` (Comments, Design System name)
- `src/lib/db.ts` (Database name, LocalStorage keys)
- Various toast messages and UI text.

### 2. Identify and Replace Logo
The new logo is located at `/lovable-uploads/SerkleMainLogo.svg`.
The old logo `/lovable-uploads/0cbbe835-9c4c-4a9c-87ae-8385aa0d34ee.png` will be replaced.

**Logo Specifications:**
- **Standard Size**: Used at `h-7` (approx 28px) to `h-8` (approx 32px) in the UI.
- **PWA Icons**: 192x192 and 512x512 pixels (SVG is ideal for these).
- **Format**: SVG.

### 3. Font and Typography
The current font remains **Inter**.

---

## Verification Plan

### Automated Tests
- Grep the entire codebase for "MomsNest" and "MomNest" to ensure no occurrences remain.
- Grep for the old logo filename to ensure all references are updated.

### Manual Verification
- Verify the app title in the browser tab.
- Verify the logo in the Header, Login, and Signup pages.
- Check the PWA installation prompt to see the new name and icon.
- Verify that the database and localStorage keys are correctly updated.
