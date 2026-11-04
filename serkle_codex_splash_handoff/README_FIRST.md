# Serkle animated opening — Codex handoff

This folder is ready to place inside the Serkle app repository and hand to Codex.

## What is included
- `CODEX_PROMPT.md` — main implementation prompt
- `CODEX_REFINEMENT_PROMPT.md` — second-pass polish prompt
- `MOTION_SPEC.json` — exact timings, easing, sizes and behavior
- `ASSET_MANIFEST.json` — asset purpose and preference rules
- `assets/` — production-ready raster handoff assets
- `references/` — visual direction/reference images

## Recommended workflow

### 1. Put this folder in the repository
Copy the whole folder into the app repo, for example:

`design-handoff/serkle-opening/`

Do not scatter the files into the production asset folders yet. Let Codex inspect the project first and place them where the framework expects.

### 2. Open Codex from the root of the app repository
Codex should have access to the full repo, package/config files, native folders and current navigation.

### 3. Give Codex this first instruction
Use:

> Read `design-handoff/serkle-opening/CODEX_PROMPT.md` completely. Then inspect the repository, tell me the detected app stack and your implementation plan. After that, implement the opening animation end-to-end and run the available checks/tests.

If you put this handoff folder elsewhere, adjust the path.

### 4. Let Codex inspect before coding
The prompt explicitly tells it not to rewrite your stack or add unnecessary dependencies.

### 5. Run the app from a true cold launch
Test:
- first app launch
- app already open → background → resume
- small screen
- large screen
- slow startup/network
- reduced-motion accessibility setting

### 6. Use the refinement prompt
After you watch the first implementation, tell Codex:

> Read `design-handoff/serkle-opening/CODEX_REFINEMENT_PROMPT.md`, compare the current implementation to the visual reference and motion spec, then refine it.

### 7. Final production check
Ask Codex to report:
- changed files
- package/dependency changes
- native splash configuration changes
- replay/session logic
- reduced-motion logic
- performance considerations

## Important
The supplied transparent PNG mark was extracted from the supplied Serkle logo image for this implementation handoff. If your actual repo contains the original official SVG/vector logo, use the vector file in production. The PNGs remain useful for visual matching and split-mask reference.

## Design intent
The opening should feel:
**simple · human · connected · premium · fluid**

It should not feel:
**flashy · bouncy · long · game-like · promotional**
