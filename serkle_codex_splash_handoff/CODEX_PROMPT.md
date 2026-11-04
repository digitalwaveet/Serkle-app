# CODEX TASK — Build the Serkle animated app opening

You are working inside the existing Serkle app repository.

## Your first action
Before changing code, inspect the repository and identify:
- framework/runtime (Expo/React Native, React Native CLI, Flutter, SwiftUI/UIKit, Android Compose, web, etc.)
- existing navigation architecture
- current splash/launch implementation
- animation libraries already installed
- theme/design-token system
- where static assets belong

Do **not** rewrite the app or change frameworks. Reuse the current architecture and dependencies when reasonable.

## Goal
Implement a premium animated opening scene for **cold launch / once per app session** that bridges the static native launch screen into the real app.

The animation is logo-led, calm, fluid, human, and lightweight. It must not feel like an ad or slow down the product.

Read these files before implementing:
- `MOTION_SPEC.json`
- `ASSET_MANIFEST.json`
- `references/reference_animation_guide.png`
- `references/reference_opening_experience.png`

Use assets from `assets/`.

## Important platform rule
Native iOS/Android launch screens are static. Keep the native launch screen visually compatible, then mount an **in-app animated splash screen** immediately after the runtime starts. Hide/release the native splash only after the animated splash is mounted so there is no white flash.

## Exact motion
### Phase 1 — arrival | 0–220ms
- Background fills the entire viewport.
- Serkle mark is centered.
- opacity 0 → 1
- scale 0.92 → 1.00
- no rotation

### Phase 2 — split | 220–540ms
- Use `serkle_mark_left.png` and `serkle_mark_right.png` as perfectly aligned layers.
- left half moves about -14dp horizontally
- right half moves about +14dp horizontally
- `serkle_plus` fades in at the exact center, opacity 0 → ~0.80
- plus scales 0.75 → 1.00
- keep motion soft and controlled

### Phase 3 — reconnect | 540–980ms
- halves flow back to their original positions
- allow only a tiny ~2dp overshoot, then settle
- plus fades out during the last ~140ms
- the final reconstructed mark must be pixel-perfect with the original full mark

### Phase 4 — light sweep | 980–1240ms
- optional, subtle warm shimmer/highlight from left to right
- max opacity ~0.16
- do not create lens-flare or flashy effects

### Phase 5 — hold | 1240–1500ms
- mark completely still
- no pulsing

### Phase 6 — enter app | 1500–1800ms
- when app/home is ready, crossfade the splash out and the app in
- optional logo scale 1.00 → 0.94
- do not slide the whole app
- if data/init is not ready at 1800ms, hold the final frame until ready, then transition
- do not keep decorative animation running forever

## Background
Use `assets/opening_background_1080x1920.png` with cover/aspect-fill behavior.
Fallback color: `#FFFDF9`.

The background should remain mostly static. If motion is added, use only a 1–2% slow drift/parallax. No looping waves.

## Layout
- Mark centered horizontally.
- Visual mark width: about 34% of viewport width.
- Clamp approximate visual size to 132–220dp where appropriate.
- Respect safe areas.
- Never stretch/distort the logo.

## Motion character
Use smooth spring/ease curves, not bounce-heavy motion:
- primary reveal: cubic-bezier(0.22, 1, 0.36, 1)
- split: cubic-bezier(0.4, 0, 0.2, 1)
- reconnect: cubic-bezier(0.16, 1, 0.3, 1)
- exit: cubic-bezier(0.4, 0, 0.2, 1)

Prefer transform + opacity animations for performance.

## Reduced motion / accessibility
Respect the platform's reduced-motion setting.
When reduced motion is enabled:
- static centered logo
- 180ms fade in
- no splitting
- no plus animation
- no shimmer
- 180ms crossfade into app once ready

## Replay policy
- Run on true cold launch / once per app session.
- Do not replay when switching tabs.
- Do not replay every time the app returns from background unless the current product explicitly requires it.

## Framework-specific guidance
Use this only after detecting the actual stack:

### Expo / React Native
- Prefer existing Reanimated if already installed.
- Otherwise use built-in `Animated` with native-driver-compatible properties.
- If Expo SplashScreen exists, keep it visible until the custom splash has mounted, then hide it.
- Use absolute-fill layers for the two halves so their coordinate systems are identical.

### Flutter
- Use an `AnimationController` + `TweenSequence` / `CurvedAnimation`.
- Overlay the full/left/right/plus assets in a `Stack`.
- Use `Transform.translate`, `Transform.scale`, and `Opacity`.

### SwiftUI
- Use a ZStack, clipped/duplicated image layers, `offset`, `scaleEffect`, and `opacity`.
- Bridge from the static launch storyboard/screen.

### Android Compose
- Use Box overlays with `Animatable` or transition APIs.
- Animate translation/scale/alpha only.

### Web
- Use absolutely positioned layers, CSS transforms/opacity, and `prefers-reduced-motion`.

## State architecture
Keep two independent concepts:
1. **appReady** — initialization/navigation/data is ready
2. **animationReachedExitPoint** — decorative sequence reached the exit point

Dismiss the splash only when:
- minimum visible duration is reached, AND
- appReady is true

Still enforce a reasonable safety fallback so a startup error cannot trap the user behind the splash indefinitely. If the repository already has an error/loading flow, hand off to it instead of hiding failures.

## Native launch screen
Update native/static splash configuration only if needed to avoid a visual flash:
- background color should match `#FFFDF9`
- centered static Serkle mark
- no attempt to animate the native launch screen itself

## Deliverables
Implement the feature and then provide:
1. list of files changed
2. explanation of how the animation is structured
3. instructions to run it locally
4. any new dependency added and why
5. note on reduced-motion behavior
6. note on cold-launch replay behavior
7. screenshots or a short screen recording if your environment supports it

## Acceptance checklist
- No blank/white flash between native launch and custom splash
- Logo remains undistorted
- Split halves reconnect perfectly
- Animation feels smooth at 60fps
- Background fills tall and short screens
- Home screen does not jump when splash disappears
- Works on at least one small phone and one larger phone/emulator
- Reduced-motion path works
- Splash is not replayed on normal app resume
- No navigation regression
- No unnecessary framework rewrite

## Important asset preference
If the repository already includes the official Serkle logo as SVG/vector, use that production asset and reproduce the split with masks/clipping. Use the supplied PNG halves as exact visual references. Do not trace/redesign the logo.
