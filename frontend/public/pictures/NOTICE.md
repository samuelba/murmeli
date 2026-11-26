# Picture attribution

Most pictures in this folder are emoji artwork from **Noto Emoji** by Google:

- Source: https://github.com/googlefonts/noto-emoji, directory `2D/svg/`
- Pinned commit: `9411589157168199e31fab898cb64ea633b6b81a` (September 2026)
- License: Apache License, Version 2.0 (full text in `LICENSE` next to this file).
  The upstream repository uses the SIL Open Font License only for the emoji *fonts*; the SVG
  image resources in `2D/svg/` carry the Apache-2.0 notice reproduced at the top of `LICENSE`.

Copyright 2013 Google, Inc. All Rights Reserved.

## Changes

- Files are renamed from `emoji_u<codepoint>.svg` to `<picture-id>.svg`. `pictures.yaml` records the
  original codepoint of every picture (`source.codepoint`).
- These 10 files were modified: the Adobe Illustrator metadata was removed (the DOCTYPE with its
  internal entity declarations, the `i:`/`x:`/`graph:` namespaces and attributes, and the embedded
  `<i:aipgf>` private data blob). The drawing itself is unchanged.
  `book.svg`, `dog.svg`, `hat.svg`, `leaf.svg`, `map.svg`, `mouse.svg`, `rocket.svg`, `ship.svg`,
  `web.svg`, `whale.svg`.
- All other Noto files are byte-identical to upstream.

## Murmeli originals

`shape-circle.svg`, `shape-square.svg`, `shape-triangle.svg` and `shape-rectangle.svg` were drawn
for Murmeli and use the brand palette (`brand/tokens/tokens.json`).

`money/*.svg` (generic coins and notes with their value written on them) were also drawn for Murmeli.
They do not reproduce any real coin or banknote design or national symbol.
