# OpenThesaurus

Source: https://www.openthesaurus.de/ and https://www.openthesaurus.de/about/download

Downloaded from https://www.openthesaurus.de/export/OpenThesaurus-Textversion.zip on 2026-09-05.
Export timestamp: 2026-09-04 23:01. Copyright (C) 2003–2025 Daniel Naber.
48,479 synonym groups. The downloaded text file explicitly grants **GNU LGPL 2.1 or later**.

`public/thesaurus.json` is a mechanical transformation: comments and blank lines removed,
each semicolon-separated row converted to a JSON string array. Terms and annotations are retained.
The transformed data remains under LGPL 2.1 or later, separately from Feder's MIT source code.
The original license is included in `public/OPENTHESAURUS-LICENSE.txt`.
Users can replace the JSON data file independently. Source credit is visible beside all synonym results.
No API calls are made to OpenThesaurus by the app. Thus no manuscript or search term leaves the device.

## Bundled software

Every production build generates `docs/licenses.html`, `docs/THIRD-PARTY-LICENSES.txt`
and `docs/license-manifest.json` from the packages represented in the JavaScript bundles
(including transitive dependencies), plus the Tailwind, tw-animate-css and shadcn UI/CSS foundations.
Full package LICENSE/COPYING/NOTICE texts, including Lucide's Feather attribution,
are retained rather than replaced by SPDX labels. A missing license file fails the build.
The generated notices ship with GitHub Pages and are precached for offline use.
Settings → App & Daten → Lizenzen & Quellen links to the readable page.

The npm dependencies and build tools retain their own licenses in their installed package directories;
the generated manifest describes the distributed browser build, not every development tool.
Lucide icons are ISC licensed. The app icons consist of the letter f and a geometric dot.
