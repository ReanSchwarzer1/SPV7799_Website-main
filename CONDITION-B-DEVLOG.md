# Condition B — development log

The gamified variant of *One Molecule, Two Markets*, built as a standalone desktop
application. This file records what was built, why it was built that way, and every
problem that had to be solved along the way. It covers the application only; the
paper is tracked separately.

---

## 1. What Condition B is

Condition A is the original ten-section web document: a paragraph of explanation
paired with a slider or a chart, read top to bottom in a browser.

Condition B delivers **the same ten sections, the same numbers and the same economic
model**, but the reader acts on them as objects in a 3D scene instead of operating
form controls. The player is the Health Minister of India for a full term, from an
opening briefing to a closing reckoning.

The two conditions must not drift apart on the numbers. That constraint drove the
architecture more than anything else.

---

## 2. Architecture

Three layers, bottom to top.

| Layer | File(s) | Responsibility |
|---|---|---|
| Model and state | `index.html` logic in `script.js`, embedded in `index-gamified.html` but never displayed | The economic model, the charts, the case data. The single source of truth. |
| Scene harness | `interludes.js`, `interludes.css` | Renderer, camera, lights, animation loop, raycasting, keyboard, resize, teardown, label layout, canvas textures, footer UI. |
| Modules | `interlude-*.js` | Each scene describes only its own objects and its own interaction. |
| Director | `game.js` | Briefings, objectives, scoring, cross-module consequences, and what happens next. |

The original explorable is present in the Condition B document but hidden from view.
Every scene reads its figures from it and writes its decisions back to it. Nothing is
recomputed in a second place, so the two conditions cannot disagree.

### Why a custom `game://` protocol

Chromium refuses to load ES modules over `file://`, and the whole 3D layer is ES
modules. `electron-main.js` registers `game://` as a privileged standard scheme and
serves the app directory over it. That gives module loading a real origin without
opening a TCP port on the machine.

This is also why double-clicking `index-gamified.html` does not work and never will.

### Vendored dependencies

Everything is local, so a session can run on a lab machine with no internet:

- `vendor/three.module.min.js` — three.js r160, resolved through an importmap
- `vendor/chart.umd.js` — Chart.js
- `vendor/3Dmol-min.js` — 3Dmol.js
- `vendor/tailwind.js` — Tailwind

---

## 3. The ten modules

Each is a registered scene entered directly by the director, not opted into.

| # | Scene | Registered id | Economics |
|---|---|---|---|
| 1 | The comparison bench | `molecule` | Price against cost; the same compound in two markets |
| 2 | The bench | `courtroom` | Six real patent cases, ruled by the player |
| 3 | The market floor | `market-floor` | Producer and consumer surplus as entrants arrive |
| 4 | The clearing house | `equilibrium` | Supply and demand, where the price settles |
| 5 | The ward | `ward` | Fixed budget into patients treated and QALYs |
| 6 | The trade globe | `globe` | Diffusion of exports, and dependence on imported ingredients |
| 7 | The wage floor | `wage` | Price as days of labour; the Lerner index |
| 8 | The concentration room | `antitrust` | HHI and the Aghion inverted-U |
| 9 | The patent race | `race` | Payoff matrix for duplicated R&D |
| 10 | The generic paradox | `oecd` | Volume share against value share across health systems |

Plus **four record rooms** (`dispatch`, `dispatch-market`, `dispatch-reach`,
`dispatch-power`), one after each pair of modules, where decisions are read back as
expandable cards; and a **closing scene** (`reckoning`) that lays out every choice
made across the term.

### Consequences that carry

Four chains run between modules. Each is a real causal link, not bookkeeping.

1. Rulings at the bench set whether the market is open. Uphold the patents and the
   gate on the market floor is bolted.
2. Competitors admitted on the floor arrive in the clearing house as supply already
   present, so the beam starts part of the way across.
3. The price the market settles at is the price the health budget then pays, so the
   ward's wheel starts where the player left it.
4. The cheap generic in module 7 exists only because a compulsory licence was granted
   in the Bayer case. A player who upheld that patent finds the switch to the cheaper
   market welded shut.

Verified across two opposed playthroughs: licence granted ends at Access 85 /
Innovation 44; licence denied ends at Access 16 / Innovation 88.

---

## 4. Design decisions worth remembering

**Gameplay is linear and directed.** An earlier build put the 3D scenes behind opt-in
buttons on the page. That was wrong on game-design grounds: a player will not click a
button they cannot see the point of, and it made Condition B a reskin of Condition A.
Finishing a module now takes the player straight into the next scene.

**Context is diegetic.** Nothing important is presented in a panel floating over the
scene. In the courtroom the case arrives as a physical file the player picks up and
opens. The evidence is an object in the world, not UI on top of it.

**No website chrome at all.** Condition B shows only the game. The page underneath is
the model, never the interface.

**Objectives are explicit.** Every module has one success condition drawn from its own
economics, stated up front, with progress shown continuously.

**Two meters, in tension by construction.** Access and Innovation. A term that
maximises one at the expense of the other is a legible outcome, not a failure.

---

## 5. Problem log

Chronological. Each entry is a real defect or a real design failure, and what fixed it.

### Molecule superimposition was impossible
Three-axis orientation matching driven by a two-degree-of-freedom drag. Collapsed to a
single Y-axis rotation, added yellow marker cones, tolerance 26°, and a magnetic assist
inside 50°. The task is to understand the idea, not to beat a puzzle.

### 3D scenes did not auto-load
ES modules were blocked because the file was being opened directly from disk. Added
retry polling, an explicit toast, a red `file://` banner, and `run-game.cmd`.

### Case file showed a blank underside
`rotation.x = -1.15` pointed the printed +Y face away from the camera. Corrected to
`+1.02` (facing dot 0.984).

### Courtroom failed to build
`ReferenceError: keep is not defined` — the disposal helper existed only in the
molecule file. Added a local `keep()`.

### WebGL framebuffer error spam
I first assumed a headless artifact. Re-ran with `show:true` and the errors persisted,
proving it real: the 3Dmol viewer was initialising against a hidden `main`. Fixed with
a guard in `script.js`, the only change made to that file:

```js
if (!container || container.offsetParent === null) return;
```

### Camera cut off the scene
Projection showed the ruling papers 162px below the canvas. Replaced the fixed camera
with an auto-fit that iterates the frustum corners, so every scene frames itself across
window sizes and aspect ratios.

### Level 4 was impossible
The objective asked for a clearing price at or below $60, but the model bottoms out at
$65. Changed to $70.

### Ward wheel had a dead direction
The wheel starts at maximum price, so one turn direction did nothing and read as broken.
Added three white arrows and an explicit "turn the wheel LEFT".

### Supersampling script damaged canvases
A blanket regex rename missed ternary forms like `c.width = expanded ? 1100 : 580`,
creating implicit globals with unsized canvases. Found by grep, repaired five occurrences.

### UI overlap and pixelation on a 2K monitor
Centralised the texture pipeline in the harness: supersampling by device pixel ratio
(`texScale = min(4, max(2, dpr * 2))`), anisotropic filtering, mipmapping. Added a
ten-pass screen-space label relaxation in aspect-corrected NDC. Overlaps went from 29
to 7, the remainder being floors, tables and walls that labels are meant to float over.

### Scientific formulae and data audit
30 of 30 checks pass. One genuine discrepancy was found and **deliberately not fixed**:

> The artifact's text claims six or more competitors cut price by 80–90%. Its own decay
> curve, `P_N = P_0 × N^(−0.75)`, gives 73.9% at N=6 and does not reach 80% until N=9.
> The FDA's reported figure is steeper than either, about 94%.

The exponent is shared by both conditions. Changing it mid-study would alter Condition A
as well, so it was left alone and recorded as a limitation instead.

---

## 6. Packaging and distribution

Co-authors could not run the app. The cause was `run-game.cmd` calling `npm install`
and `npx electron .`, which needs Node.js installed plus a ~200 MB Electron download.
They had neither, and the old script failed silently when `npm` was missing.

**Fix: ship a self-contained executable.**

```
npm run dist
```

produces, in `dist/`:

- `One Molecule Two Markets 1.0.0.exe` — portable, ~85 MB, double-click and it runs
- `One Molecule Two Markets Setup 1.0.0.exe` — installer, same app
- `READ ME FIRST.txt` — instructions written for non-technical testers

`run-game.cmd` now checks for Node and npm first and prints a plain-English message
pointing at the `.exe` instead of failing quietly. It is a from-source developer script
and is labelled as such.

### Build gotcha: winCodeSign symlink failure

electron-builder downloads a code-signing helper whose archive contains two macOS
symlinks. Extracting them needs privileges this account does not have, so the build
fails with `Cannot create symbolic link ... libcrypto.dylib`. Signing is never used.

Workaround: pre-extract the archive into the cache without the macOS files.

```bash
CACHE="$LOCALAPPDATA/electron-builder/Cache/winCodeSign"
curl -L -o "$CACHE/wcs.7z" https://github.com/electron-userland/electron-builder-binaries/releases/download/winCodeSign-2.6.0/winCodeSign-2.6.0.7z
node_modules/7zip-bin/win/x64/7za.exe x "$CACHE/wcs.7z" -o"$CACHE/winCodeSign-2.6.0" -xr'!'darwin -y
```

Then `npm run dist` succeeds.

### What testers need to be told

- Windows SmartScreen **will** block it. More info → Run anyway. The build is unsigned;
  a certificate is not worth buying for a playtest.
- Antivirus may quarantine it for the same reason.
- Windows x64 only. A Mac build has to be produced on Mac hardware.
- `dist/` is gitignored, so pushing to the repo does not deliver the executable. Send
  the file directly.

Packaged build verified by launching it with remote debugging and probing the live page:
`import("three")` resolves to r160 from inside the asar archive, `fetch("game://app/...")`
returns 200, the harness and `game.js` both load, and a forced cache-clearing reload
produces zero errors and zero failed requests.

---

## 7. Co-author feedback round

Feedback arrived as annotated screenshots. All of it was implemented.

### Previous button, scoped to the case module
Requested generally; scoped deliberately to the courtroom so the player can re-read
earlier cases and change a decision. It appears only from case 2 onward.

### Undoing a mis-click
"What if someone ruled on a case by unknowingly clicking?" Added to `game.js`:

```js
window.GameRulingFor(num)   // read a ruling back
window.GameUndoRuling(num)  // withdraw it
```

The meter deltas a ruling applies are **recorded at ruling time** rather than
re-derived on undo, because clamping at 0 or 100 can swallow part of a delta and a
re-derived reversal would silently drift. Undo also clears the record so re-ruling
scores the new choice instead of being swallowed by the "already ruled" guard, and
reopens the term if the sixth ruling had closed it.

Walking back onto a decided case shows the verdict on the file, status reads
"Already ruled: …", and the footer offers **Change this ruling**.

### The harness gained a second footer button
`ctx.setAux([{ label, onClick }])` renders any number of scene-supplied buttons. The
first attempt had a single aux slot and Previous silently overwrote Change on an
already-ruled case, which is why the API takes a list.

### Module 6 briefing rewritten
"Cheap medicine is worth nothing where it cannot arrive" read as confusing. Replaced
with: *"Infrastructure often dictates medical access. The functional value of any drug
is strictly zero if it cannot physically reach the patient who needs it."*

### Record-room legibility
Body copy was `#22303a` at 25px and read as washed out. Now `#111318` at 27px with
looser leading; the italic strapline under the big number went from `#5a6069` to
`#3a4048`. Applied across all four record rooms and the finale. Note these cards use
`MeshBasicMaterial`, so they are unlit and the texture renders exactly as authored,
which is why contrast alone fixes it.

### Module 10 completion latch — a real bug
After solving, clicking a different pedestal re-labelled the plaque "LOCK IN \<that
system\>" while the term stayed closeable, offering an affordance that would have been
refused. Now, once solved, inspecting another system still updates the readout for
comparison but the plaque keeps naming the actual answer.

---

## 8. The case file, rebuilt

The document zoom went through three iterations. Worth recording because the first two
were wrong in instructive ways.

1. **Scaled the held page to 2.15×.** Too large; the page overflowed the frame and the
   whole case could no longer be read.
2. **Reduced the zoom and added wheel scrolling.** Readable, but the co-author's point
   was that a case should be *presented*, not scrolled through, and it ended up more
   zoomed out than the original.
3. **Rebuilt as a two-page file.** Current design.

### How it works now

Closed, a folder lies flat on the bench, cover reading `CASE FILE 001 / 006`, the case
title, and "Click the file to open it."

Opening runs in **two overlapping beats** rather than one blended morph, so it reads as
a physical object:

```js
var lift = smooth(openT / 0.62);          // rise and turn to face the reader
var fold = smooth((openT - 0.34) / 0.66); // covers swing apart
```

The spine slides as the leaf swings (`spine.position.x = -(PAGE_W / 2) * (1 - fold)`)
so the stack stays centred while closed and the spread stays centred while open.

Left page carries the case number, title, drug and THE CLAIM. Right page carries THE
LAW THAT APPLIES, and ON THE RECORD once ruled. Clicking either page folds it shut.

### Two things that had to be solved

**Sizing is camera-relative, not a fixed world position.** The 3D stage is 1424×662,
aspect 2.15 — very wide and short. Any hardcoded placement either clipped the spread
vertically or, when pulled close enough to fill the frame, keystoned the pages into a
trapezoid. The open file is now parked at a fixed distance in front of the camera and
scaled to fit the frame, with an upward nudge along the camera's own up-axis so it
clears the hint pill.

**Pages self-illuminate.** Once they turn to face the camera the key light sits off-axis
and drains the paper to grey. The page texture is its own `emissiveMap` at intensity
0.5, so it stays cream at any angle without going fully unlit and flat.

---

## 9. How this gets verified

There is no test suite. Verification is done by launching the app with remote debugging
and driving it over the Chrome DevTools Protocol:

```bash
npx electron . --remote-debugging-port=9444
```

Then a Node script attaches to the page's WebSocket debugger URL and evaluates
expressions, dispatches real mouse and key events, captures screenshots, and collects
`Runtime.exceptionThrown` and console errors.

This is how the following were confirmed rather than assumed:

- Ruling and undo move the meters and restore them **exactly** (10/50 → 17/49 → 10/50)
- Previous appears only from case 2, Change only on a decided case
- Open → close → open toggling (`held=false openT=0` → `held=true openT=1` → `held=false openT=0`)
- All nine registered scenes build with zero console errors
- The packaged `.exe` loads three.js and its assets from inside the asar

**A caution learned the hard way.** Two apparent bugs turned out to be artefacts of the
test harness, not the game: one where a stale Electron session had stopped its animation
loop and reported frozen state, and one where a test called `window.makeRuling()`
directly instead of striking the gavel, leaving the scene in a state a player cannot
reach. Drive the real input path, and restart the app between runs.

---

## 10. Condition A is untouched

This matters for the study's validity and is checked after every change:

- `index.html` and `script.js` have **zero** diffs apart from the one `offsetParent`
  guard noted above.
- `index.html` contains **no** reference to `game.js`, `game.css`, or any `interlude-*`
  file.

Only these files belong to Condition B: `index-gamified.html`, `game.js`, `game.css`,
`interludes.js`, `interludes.css`, `interlude-*.js`, `electron-main.js`, `preload.js`,
`vendor/`.

---

## 11. Open items

- Visual polish, game feel, audio — the next planned pass.
- Participant playtesting. The scenes are built but have not been run with participants.
- **Rebuild before the next distribution.** The `.exe` currently in `dist/` predates the
  co-author feedback round and the two-page case file.

---

## 12. Polish pipeline — Phase 0 (foundations)

Infrastructure only. No visual change ships in this phase; it exists so the rest of the
polish pipeline has something safe to stand on. Plan: `POLISH-PLAN.md`.

### three.js addons are now vendored

Every post-processing effect in the polish brief lives in `three/examples/jsm/`, and the
importmap previously exposed only `"three"`. The core build contains none of the addons,
and the app is deliberately offline, so nothing could be pulled at runtime. This blocked
roughly two thirds of the pipeline.

Resolved by installing `three@0.160.1` as a devDependency (matching the vendored core,
which reports `r160`) and copying the **transitive import closure** of the entry points
into `vendor/jsm/`, preserving directory structure:

```
14 modules, 69 KB
  math/SimplexNoise.js                shaders/CopyShader.js
  postprocessing/EffectComposer.js    shaders/FXAAShader.js
  postprocessing/MaskPass.js          shaders/LuminosityHighPassShader.js
  postprocessing/OutputPass.js        shaders/OutputShader.js
  postprocessing/Pass.js              shaders/SSAOShader.js
  postprocessing/RenderPass.js
  postprocessing/SSAOPass.js
  postprocessing/ShaderPass.js
  postprocessing/UnrealBloomPass.js
```

The importmap gained a folder mapping:

```json
{ "imports": { "three": "./vendor/three.module.min.js",
               "three/addons/": "./vendor/jsm/" } }
```

Verified: the only bare specifier anywhere in the vendored set is `three`, all 18
relative imports resolve, every module imports at runtime inside the app, and an
`EffectComposer` instantiates. `three` stays a devDependency and is never shipped; the
runtime uses the vendored copies, which `vendor/**` already packages.

### Quality tiers

`high` / `medium` / `low`, controlling shadows, post-processing and shadow map size.
Manual selection persists to `localStorage`; automatic downgrade triggers only after
three consecutive slow windows, so a single hitch while a scene builds cannot demote the
session. Sessions run on machines we do not control, and a study that stutters is worse
than one that looks plain.

```js
Interludes.quality()          // read
Interludes.quality("medium")  // set and lock
```

### Frame metering

A rolling meter publishes `window.__ilPerf` with fps, mean, median and 95th percentile
frame time, readable over the debugger. It also feeds the automatic downgrade.

### Camera offset layer

Scenes own their framing: each writes `camera.position` directly from its own
`fitCamera()`. Anything wanting to nudge the camera therefore cannot write to
`camera.position`, because the scene's next fit would overwrite it.

The offset is instead applied around the draw call and removed immediately after:

```js
_camSaved.copy(camera.position);
camera.position.add(camOffset);
renderFrame();
camera.position.copy(_camSaved);
```

`ctx.shake(amplitude, seconds)` rides on this, decaying quadratically across the camera's
own screen axes. It checks reduced motion before doing anything.

Verified: camera position is byte-identical before, during and after a shake
(`0,4.1341,5.6101` throughout), so the scene transform is never corrupted; and the shake
visibly moves pixels, 86x the at-rest noise floor, decaying back to rest.

### Reduced motion

`prefers-reduced-motion` is honoured from the outset, with a manual override. Every
camera kick and rapid flash added later must check it. Participants sit with this for
half an hour and some are motion sensitive.

### Composer render path

Built lazily behind a dynamic import so a broken addon can never stop a scene rendering:
on failure it logs once and stays on the direct path. Currently `RenderPass -> OutputPass`,
which exists to prove the plumbing; Phase 3 adds real passes. Off by default, flipped with
`Interludes.setPost(true)`.

**Parity proof.** Comparing screenshots between paths is confounded by animation, so the
test measures a control first: two captures on the *same* path at the same interval
establish an animation noise floor, then the cross-path difference is compared against it.

| Scene | Same-path noise | Cross-path diff | Verdict |
|---|---|---|---|
| courtroom | 0.552 | 0.132 | within noise |
| antitrust | 0.221 | 0.152 | within noise |
| reckoning | 4.465 | 0.217 | within noise |

The cross-path difference is *smaller* than the animation noise in every scene.

### Background throttling — a real bug, found by accident

While building the meter, `requestAnimationFrame` was found not to be firing at all.
Chromium throttles, then freezes, the render loop of a window it considers backgrounded
or occluded.

This is not merely a measurement problem. **A participant who alt-tabs mid-session would
return to a stalled scene.** It also retroactively explains the "frozen session" that
wasted time during the case-file work, where a scene reported unchanging state.

Fixed in `electron-main.js`:

```js
app.commandLine.appendSwitch("disable-backgrounding-occluded-windows");
app.commandLine.appendSwitch("disable-renderer-backgrounding");
// and on the window:
webPreferences: { backgroundThrottling: false }
```

### A temporal dead zone bug I introduced

`resize()` runs during setup and reads `composer`. Declaring `let composer` further down,
next to `buildComposer()`, left it in the temporal dead zone at that moment, so `play()`
threw `ReferenceError: Cannot access 'composer' before initialization` and aborted
**before starting the render loop**.

The scenes still appeared to build, because the canvas had already been appended and
`Page.captureScreenshot` forces a frame. The verification runner reported
`built=y, errors=0` for all fifteen. It was invisible until the frame meter reported
nothing at all.

Two fixes: the declaration moved up with the rest of the session state, and the runner
now surfaces a throwing `play()` instead of ignoring its return value. `play()` also
clears any overlay orphaned by a failed build.

### `tools/verify-scenes.js`

The throwaway debugger scripts are now one repeatable runner. For each of the fifteen
registered scenes it builds the scene, records console errors and uncaught exceptions,
measures frame time, and captures a screenshot, then writes `report.json`.

```bash
npx electron . --remote-debugging-port=9444
node tools/verify-scenes.js
node tools/verify-scenes.js --post --tier=high
```

This is the gate for every later phase: run it before and after, and diff the report.

### Baseline

All 15 scenes, direct path and composer path alike:

```
built=y   fps=120   median=8.3ms   p95=8.4ms   errors=0
```

8.3 ms is the vsync interval on a 120 Hz display, so these numbers show **zero dropped
frames anywhere**, not the true GPU headroom. The useful property is the p95: any
regression in a later phase will show up as p95 climbing toward 16.7 ms.

### Phase 0 exit criteria

| Criterion | Status |
|---|---|
| Addons import cleanly offline | met |
| Composer flag flips with no visual change | met, proven against a noise control |
| Baseline frame times for all 15 scenes | met |
| Regression runner green | met, 15/15 built, 0 errors |
| Condition A untouched | met, zero diff in `index.html` and `script.js` |

Still open, carried into Phase 6: the audio asset decision (procedural, sourced CC0, or
hybrid) has not been made.

---

## 13. Polish pipeline — Phase 1 (light, shadow, atmosphere)

First phase that changes what the player sees. Frame cost: none measurable.

### A standard three point rig

Every scene file declares zero lights, so the harness rig is the only lighting in the
application. It replaces the previous two ad hoc lights with a hemisphere fill, a
shadow-casting key, and a cool rim for separation. Total illumination was kept close to
the old setup so existing scenes did not shift in brightness; what changed is direction
and the presence of a key that casts.

Scenes override it without building a rig of their own:

```js
Interludes.register("id", {
  lighting: { hemi: 1.0, key: 0.55, rim: 0.26, shadows: false },
  fog: { color: 0x0e111a, density: 0.02 },
  ...
});
```

The key sits high (`[3.2, 11.5, 5.2]`). A low raking key looks more dramatic but throws
long shadows straight across the printed labels the player has to read.

### Shadows without editing twelve scene files

`PCFSoftShadowMap`, map size from the quality tier, `bias -0.0004` and
`normalBias 0.018` — the thin boxes in these scenes (papers, cards, plaques) acne badly
and normal bias does more of the work than a constant depth bias would.

Participation is assigned by walking the graph after `build()` rather than by hand:

- **Unlit billboards opt out entirely.** Labels, readouts, record cards and plaques are
  `MeshBasicMaterial`, ignore lighting, and would drop hard rectangles across the scene.
- **Wide flat geometry receives but does not cast**, so floors and table tops do not
  spend shadow map area on themselves.
- Everything else casts and receives.

The shadow camera is then fitted to what actually casts, so small scenes get a tight
sharp map instead of a blurry one stretched over empty space. Scenes that add geometry
later call `ctx.refitLights()`.

### Fog, and why text is exempt from it

Fog is opt-in per scene. The reckoning uses it so the far side of the monument ring
recedes into the page instead of ending at a hard silhouette. Density is deliberately
low because the stones carry text.

The first attempt washed out the decision cards along with the floor. **Readable
surfaces are now exempt from fog**, both at the point labels are created and in the
post-build traversal. Atmosphere applies to the environment; anything carrying text
keeps full contrast. Legibility wins that conflict every time — this is a study
instrument before it is a game.

### Record rooms kept their flat look on purpose

Shadows made the four record rooms worse, not better. They present cards and meters,
not physical objects, and the meter bars threw dark rectangles across walls that are
already almost black. The result read as a rendering fault rather than as light.

They now use a presentational rig, `{ hemi: 1.0, key: 0.55, rim: 0.26, shadows: false }`,
which restores the clean look while keeping the improved fill. The shadow rationale —
grounding physical objects like the case file and the gavel — simply does not apply to
a room made of floating cards.

### A latent bug this phase exposed: framing depended on the quality tier

Screenshots taken at the low and high tiers framed their scenes differently. The cause
was not lighting.

Each scene's `frameScene()` builds a bounding box with `expandByObject`, which reads
world matrices. Those matrices were not guaranteed to be current at that moment, so
scenes were fitting their camera to a slightly wrong box. `fitShadowCamera()` happened
to call `scene.updateMatrixWorld(true)` first, which meant the shadowed tier fitted
correctly and the unshadowed tier did not.

`scene.updateMatrixWorld(true)` now runs unconditionally after every build, before
anything measures the scene. Framing is identical across tiers, and it is the *shadowed*
framing that was right all along.

### What shadows actually bought

- **Molecule:** the two samples were floating above their landing pads. They now sit on
  them.
- **Courtroom:** the case file, the ruling papers and the gavel all have contact
  shadows. The gavel's shadow falls on whichever ruling paper is currently selected,
  which doubles as a selection cue.
- **OECD:** the towers are grounded on the hall floor.

### Verification

| Check | Result |
|---|---|
| All 15 scenes build | yes, 0 console errors |
| Frame budget | 120 fps, median 8.3 ms, p95 8.4 ms — unchanged from Phase 0 |
| Legibility regression | none; fog exemption added after the reckoning showed one |
| Framing consistent across tiers | yes, after the `updateMatrixWorld` fix |
| Condition A untouched | yes |

Screenshots: `tools/verify-out-p1/`.

### Known, pre-existing, not introduced here

The pedestal name plates in the OECD hall overlap each other (UNITED KINGDOM / UNITED
STATES / JAPAN). Confirmed identical in the pre-Phase-1 capture, so it is not a
regression from the framing fix. It belongs to the label relaxation system and is worth
a targeted pass later.
