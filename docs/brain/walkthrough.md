# Rebranding Walkthrough: MomsNest -> Serkle

The application has been fully rebranded to **Serkle**. This involved a comprehensive update of all identification points, including textual references, visual assets, and internal storage identifiers.

## Key Changes

### 1. Visual Identity (Logo)
- Replaced the legacy PNG logo with the new SVG asset: `/lovable-uploads/SerkleMainLogo.svg`.
- Updated logo references in:
  - `index.html` (Favicon and metadata)
  - `public/manifest.json` (PWA icons)
  - `src/components/Header.tsx`
  - `src/pages/Login.tsx`
  - `src/pages/Signup.tsx`

### 2. Application Name & Metadata
- Updated the application title and short name to **Serkle** across:
  - `index.html`
  - `public/manifest.json`
  - `capacitor.config.json` (Native app identity)

### 3. UI Text Refactoring
- Performed a global sweep to replace "MomsNest" and "MomNest" with "Serkle" in:
  - Login/Signup pages and success messages.
  - Install prompts and settings modals.
  - Push notification test messages.
  - Shared story watermarks.
  - CSS comments and internal documentation.

### 4. Technical Refactoring
- **Local Database**: Renamed the internal Dexie database from `MomNestChatDB_v4` to `SerkleChatDB_v4`.
- **LocalStorage**: Updated the encryption version key to `SERKLE_DB_ENCRYPTION_VERSION`.
  - *Note: This ensures a clean slate for the new brand on the first launch.*

## Verification Results

- **Global Search**: A thorough `grep` search confirms that zero references to "MomsNest" or "MomNest" remain in the codebase.
- **PWA Manifest**: Validated that `manifest.json` correctly points to the new logo and reflects the "Serkle" name.
- **UI Components**: Verified that the Header, Login, and Signup components correctly render the new SVG logo.

The rebranding is now complete and consistent throughout the application.
