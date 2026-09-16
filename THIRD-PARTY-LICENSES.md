# Third-party licences

Everything the application needs is vendored, so a session can run offline.
This file records what is bundled and under which licence. The project's own
code is MIT; see `LICENSE`.

| Component | Where | Licence | Upstream |
|---|---|---|---|
| three.js r160 | `vendor/three.module.min.js`, `vendor/jsm/` | MIT (`Copyright 2010–2023 Three.js Authors`, SPDX header in the file; full text in `node_modules/three/LICENSE`) | https://threejs.org |
| Chart.js | `vendor/chart.umd.js` | MIT (`Copyright (c) 2014–2024 Chart.js Contributors`) | https://www.chartjs.org |
| 3Dmol.js | `vendor/3Dmol-min.js` | BSD-3-Clause (the project states 3Dmol.js incorporates code from GLmol, Three.js and jQuery and is licensed under BSD-3-Clause) | https://3dmol.csb.pitt.edu |
| Tailwind CSS (play CDN build) | `vendor/tailwind.js` | MIT (`Copyright (c) Tailwind Labs, Inc.`) | https://tailwindcss.com |
| Electron | runtime, added at package time | MIT (`node_modules/electron/LICENSE`) | https://electronjs.org |

Chromium and Node.js ship inside Electron and carry their own licences, which
Electron distributes with the runtime (`LICENSES.chromium.html` in the packaged
app folder).

## Not bundled

No audio files: every sound is synthesised at runtime in `il-audio.js`,
precisely so that no clip licence has to be tracked. No fonts are bundled
either; the interface uses the system UI font and Georgia.

## Molecular data

The imatinib geometry in `interlude-molecule.js` is the heavy-atom structure
from PubChem CID 5291. PubChem data are in the public domain in the United
States (National Library of Medicine).

## A note on Windows and code signing

The build is **not** code-signed. Windows SmartScreen will warn the first time
a tester runs it ("Windows protected your PC" → *More info* → *Run anyway*),
and some antivirus products may quarantine it. A licence file does not change
this: only an Authenticode certificate from a recognised CA does, and the
certificate has to be bought and kept for the life of the software. Adding
`LICENSE` to the installer gives the tester something to read and makes the
build's provenance explicit; it does not remove the warning.
