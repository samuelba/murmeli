# Murmeli brand assets

This folder is the source of truth for the logo, the mascot, the avatars and the design tokens. The frontend copies from here into `frontend/public/brand/`. Open `preview.html` in a browser to see everything at once. It works offline and has a light/dark toggle.

## Contents

```
brand/
├── logo/
│   ├── murmeli-mark.svg            static mark, 128×128 (emails, static contexts)
│   ├── murmeli-mark-animated.svg   self-contained 5 s loop: pop up, blink, wink with sparkle, duck
│   ├── murmeli-mark.parts.md       structure, classes and keyframes for porting to <mu-logo [animated]>
│   ├── murmeli-wordmark.svg        mark plus "Murmeli" lettering as outlines, for light backgrounds
│   ├── murmeli-wordmark-dark.svg   the same with light lettering, for dark backgrounds
│   ├── favicon.svg                 head-only mark, legible at 16–32 px
│   └── murmeli-app-icon.svg        full-bleed square (source of the maskable and Apple icons)
├── icons/
│   ├── favicon-32.png
│   ├── icon-192.png, icon-512.png  PWA "any" icons (rounded tile, transparent corners)
│   ├── icon-maskable-512.png       PWA "maskable" icon (opaque, content inside the 80% safe zone)
│   └── apple-touch-icon.png        180×180, opaque
├── mascot/
│   ├── happy.svg                   waving: welcome, home screen
│   ├── thinking.svg                paw on chin with a question mark
│   ├── thinking-animated.svg       gentle bob and pulsing question mark: loading indicator
│   ├── cheering.svg                arms up with confetti: success, level complete
│   ├── encouraging.svg             kind smile and thumbs up: "try again" (never sad or punishing)
│   └── sleeping.svg                curled up with "Zzz": break reminder, daily limit reached
├── avatars/
│   ├── <animal>.svg                30 animal heads, 120×120, no background
│   ├── accessories/<item>.svg      8 overlays in the same 120×120 frame
│   └── manifest.json               ids, files, de-CH/en-US names and 10 background colors
├── tokens/
│   ├── tokens.json                 source tokens
│   └── tokens.css                  generated CSS custom properties (--mu-*)
├── scripts/                        generators (see "Regenerating")
└── preview.html                    self-contained visual check
```

## Usage

**Favicon and PWA**

```html
<link rel="icon" href="/brand/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/brand/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/brand/apple-touch-icon.png">
```

In the web app manifest, list `icon-192.png` and `icon-512.png` with `"purpose": "any"` and `icon-maskable-512.png` with `"purpose": "maskable"`.

**Logo:** use the Angular component `<mu-logo [animated]="true">` in the app. See `logo/murmeli-mark.parts.md` for how to port it. Use the static SVG in emails and anywhere CSS animation is unwanted. The animation stops under `prefers-reduced-motion: reduce` and shows the marmot fully visible.

**Avatars:** draw a circle with one of `manifest.backgrounds`, then the animal SVG, then an optional accessory SVG on top. All three share the 120×120 frame, so stacking them with `position: absolute; inset: 0` lines them up. Eyes sit at about y = 60 (where the sunglasses go), and head tops sit at about y = 26–32 (where the hats go). The SVGs have no background, so the app picks the color. Every background keeps the dark outlines readable.

**Tokens:** import `tokens/tokens.css` once, globally. Light values live on `:root`. Dark values apply with `[data-theme="dark"]`, or through `prefers-color-scheme: dark` unless `data-theme="light"` is set. Everything is prefixed `--mu-`: colors (`--mu-color-*`), `--mu-radius-*`, `--mu-space-*`, `--mu-shadow-*`, `--mu-touch-kid` (64px) and `--mu-touch-adult` (48px), `--mu-font-ui`, `--mu-font-learn`, durations and easings. Under reduced motion, the duration tokens drop to 0ms.

**Colors and accessibility:** every text pair passes WCAG AA (4.5:1) in both themes, and `build.mjs` fails if one doesn't. Success and error also differ clearly in luminance, not just in hue: dark green with white text and light coral with dark text in the light theme (2.33:1 between them), and light mint against a mid coral in the dark theme (1.90:1). Always pair them with an icon or the mascot as well. "Error" is a soft coral on purpose: wrong answers should feel like "try again", not like punishment.

## Fonts

- UI text: Nunito (Fredoka as fallback). Learning content: Andika. Both must be **self-hosted** (no Google Fonts CDN, for nFADP/GDPR reasons). The token stacks fall back to system fonts.
- The wordmark lettering is outlines of Nunito Black (900), converted to paths with opentype.js, with a slight playful tilt per letter. The SVG doesn't need the font. Nunito is licensed under the SIL Open Font License 1.1, which allows this use.

## Regenerating

The SVGs, `manifest.json`, `tokens.css` and `preview.html` are generated. Edit the sources in `scripts/lib/` or `tokens/tokens.json`, then run:

```bash
node brand/scripts/build.mjs          # SVGs, manifest, tokens.css, preview.html, contrast report
node brand/scripts/render-icons.mjs   # PNG icons (needs ImageMagick with the librsvg delegate)
```

`build.mjs` prints the contrast table and exits non-zero if a pair fails. It also rejects German names that contain the sharp s (U+00DF).

The generator files are:

- `scripts/lib/logo.mjs`: the mark, the app icon and the favicon
- `scripts/lib/mascot.mjs`: the poses, built from one shared head and body so they stay consistent
- `scripts/lib/avatars.mjs`
- `scripts/lib/accessories.mjs`
- `scripts/lib/wordmark.mjs` and `wordmark-glyphs.mjs`: the lettering outlines
- `scripts/lib/tokens-css.mjs`
- `scripts/lib/contrast.mjs`
- `scripts/lib/preview.mjs`

## Style rules

- Flat, rounded shapes with a warm dark-brown outline (`#3B2A20`). The outline is 3.5 units in the 200-unit mascot frame, 3 in the 120-unit avatar frame and 2.4 in the 128-unit logo.
- At most a few gradients: sky, meadow and fur. No embedded raster images.
- Expressions are always friendly. Even "try again" uses the encouraging pose.
- The wool hat is a plain red beanie on purpose. The Swiss cross is a protected national emblem, so the artwork does not use it.

## License

Original artwork, © the Murmeli project. All rights reserved unless the project states otherwise. The wordmark lettering is derived from Nunito (SIL OFL 1.1).
